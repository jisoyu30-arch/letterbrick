#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const DEFAULT_BUCKET = 'letterbrick.firebasestorage.app';
const PAGE_SIZE = 500;
const MAX_PAGES = 80;

async function main() {
  const month = getArchiveMonth();
  const dryRun = hasFlag('--dry-run') || process.env.DRY_RUN === 'true';
  const resultPath = getResultPath();
  const serviceAccount = loadServiceAccount();
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || DEFAULT_BUCKET;

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`Invalid archive month: ${month}`);
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: bucketName
    });
  }

  const db = getFirestore();
  const bucket = getStorage().bucket(bucketName);
  const runId = `${month}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const archiveRef = db.collection('admin_archives').doc(month);
  const runRef = db.collection('admin_archive_runs').doc(runId);
  const startedAt = new Date().toISOString();

  console.log(`[archive] month=${month} dryRun=${dryRun}`);

  if (!dryRun) {
    await runRef.set({
      runId,
      month,
      status: 'running',
      mode: 'scheduled',
      startedAt,
      source: 'github-actions'
    });
    await archiveRef.set({
      month,
      scheduleStatus: 'running',
      lastRunId: runId,
      lastRunAt: startedAt,
      lastError: '',
      updatedAt: startedAt
    }, { merge: true });
  }

  try {
    const rows = await fetchMonthlyEntries(db, month);
    const sogamRows = rows.filter(hasSogam);

    if (!rows.length) {
      throw new Error(`${month} has no entries to archive`);
    }

    const recordsFile = `letterbrick_archive_records_${month}.csv`;
    const sogamFile = `letterbrick_archive_sogam_${month}.csv`;
    const recordsCsv = buildRecordsCsv(rows);
    const sogamCsv = sogamRows.length ? buildSogamCsv(sogamRows) : '';

    let recordsUpload = {
      status: dryRun ? 'dry-run' : 'pending',
      file: recordsFile,
      path: storagePath(month, recordsFile),
      downloadURL: '',
      error: ''
    };
    let sogamUpload = sogamCsv
      ? {
          status: dryRun ? 'dry-run' : 'pending',
          file: sogamFile,
          path: storagePath(month, sogamFile),
          downloadURL: '',
          error: ''
        }
      : { status: 'skipped', file: '', path: '', downloadURL: '', error: 'No sogam rows' };

    if (!dryRun) {
      recordsUpload = await uploadArchiveCsv(bucket, month, recordsFile, recordsCsv);
      if (sogamCsv) {
        sogamUpload = await uploadArchiveCsv(bucket, month, sogamFile, sogamCsv);
      }
    }

    const meta = buildArchiveMeta({
      month,
      rows,
      sogamRows,
      recordsFile,
      sogamFile: sogamRows.length ? sogamFile : '',
      recordsUpload,
      sogamUpload,
      runId,
      startedAt,
      dryRun
    });

    if (!dryRun) {
      await archiveRef.set(meta, { merge: true });
      await runRef.set({
        status: meta.uploadStatus === 'uploaded' ? 'success' : meta.uploadStatus,
        completedAt: new Date().toISOString(),
        recordsCount: rows.length,
        sogamCount: sogamRows.length,
        uploadStatus: meta.uploadStatus,
        recordsStorage: recordsUpload,
        sogamStorage: sogamUpload
      }, { merge: true });
    }

    const status = meta.uploadStatus === 'uploaded' ? 'success' : meta.uploadStatus;
    writeArchiveResult(resultPath, {
      status,
      month,
      dryRun,
      runId,
      startedAt,
      completedAt: meta.lastCompletedAt,
      recordsCount: rows.length,
      sogamCount: sogamRows.length,
      uploadStatus: meta.uploadStatus,
      recordsStorage: recordsUpload,
      sogamStorage: sogamUpload,
      archiveDocPath: `admin_archives/${month}`,
      runDocPath: `admin_archive_runs/${runId}`,
      githubRunUrl: getGithubRunUrl(),
      error: meta.lastError || ''
    });

    console.log(`[archive] complete records=${rows.length} sogam=${sogamRows.length} upload=${meta.uploadStatus}`);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    console.error('[archive] failed:', message);

    if (!dryRun) {
      const failedAt = new Date().toISOString();
      await archiveRef.set({
        month,
        scheduleStatus: 'error',
        lastRunId: runId,
        lastRunAt: startedAt,
        lastFailedAt: failedAt,
        lastError: message,
        retryCount: FieldValue.increment(1),
        updatedAt: failedAt
      }, { merge: true });
      await runRef.set({
        status: 'error',
        failedAt,
        error: message
      }, { merge: true });
    }

    writeArchiveResult(resultPath, {
      status: 'error',
      month,
      dryRun,
      runId,
      startedAt,
      failedAt: new Date().toISOString(),
      uploadStatus: 'error',
      archiveDocPath: `admin_archives/${month}`,
      runDocPath: `admin_archive_runs/${runId}`,
      githubRunUrl: getGithubRunUrl(),
      error: message
    });

    process.exitCode = 1;
  }
}

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT secret');
  }
  return JSON.parse(raw);
}

function getArchiveMonth() {
  const argMonth = getArgValue('--month');
  if (argMonth) return argMonth;
  if (process.env.ARCHIVE_MONTH) return process.env.ARCHIVE_MONTH;

  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = nowKst.getUTCFullYear();
  const month = nowKst.getUTCMonth();
  const previous = new Date(Date.UTC(year, month - 1, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getArgValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.find(arg => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : '';
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function getResultPath() {
  return process.env.ARCHIVE_RESULT_PATH || 'archive-result.json';
}

function writeArchiveResult(resultPath, result) {
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`[archive] result written to ${resultPath}`);
}

function getGithubRunUrl() {
  if (!process.env.GITHUB_SERVER_URL || !process.env.GITHUB_REPOSITORY || !process.env.GITHUB_RUN_ID) {
    return '';
  }
  return `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
}

async function fetchMonthlyEntries(db, month) {
  const start = `${month}-01`;
  const end = `${month}-31`;
  const rows = [];
  let lastDoc = null;

  for (let page = 1; page <= MAX_PAGES; page++) {
    let query = db.collectionGroup('entries')
      .where('date', '>=', start)
      .where('date', '<=', end)
      .orderBy('date')
      .limit(PAGE_SIZE);

    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    snap.docs.forEach(doc => {
      rows.push({ id: doc.id, path: doc.ref.path, ...doc.data() });
    });
    lastDoc = snap.docs[snap.docs.length - 1];
    console.log(`[archive] fetched page=${page} total=${rows.length}`);

    if (snap.docs.length < PAGE_SIZE) break;
  }

  if (rows.length >= PAGE_SIZE * MAX_PAGES) {
    throw new Error(`Archive query reached the ${rows.length} row safety limit`);
  }

  return rows;
}

function hasSogam(entry) {
  return Boolean((entry.sogam && entry.sogam.length > 0) ||
    (entry.coachResponse && entry.coachResponse.length > 0));
}

async function uploadArchiveCsv(bucket, month, filename, csv) {
  const path = storagePath(month, filename);
  const token = crypto.randomUUID();
  const file = bucket.file(path);

  try {
    await file.save(Buffer.from(`\ufeff${csv}`, 'utf8'), {
      resumable: false,
      contentType: 'text/csv;charset=utf-8',
      metadata: {
        contentType: 'text/csv;charset=utf-8',
        metadata: {
          firebaseStorageDownloadTokens: token,
          month,
          filename,
          generatedAt: new Date().toISOString(),
          generatedBy: 'scheduled-archive'
        }
      }
    });

    return {
      status: 'uploaded',
      file: filename,
      path,
      downloadURL: firebaseDownloadUrl(bucket.name, path, token),
      error: ''
    };
  } catch (err) {
    return {
      status: 'error',
      file: filename,
      path,
      downloadURL: '',
      error: err && err.message ? err.message : String(err)
    };
  }
}

function storagePath(month, filename) {
  return `admin_archives/${month}/${filename}`;
}

function firebaseDownloadUrl(bucketName, path, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

function buildArchiveMeta(options) {
  const userMap = {};
  let growth = 0;
  let healing = 0;
  let anonymous = 0;

  options.rows.forEach(entry => {
    const key = entry.uid || entry.email || entry.nickname || 'unknown';
    userMap[key] = true;
    if ((entry.edition || 'growth') === 'healing') healing += 1;
    else growth += 1;
    if (entry.isAnonymous) anonymous += 1;
  });

  const generatedAt = new Date().toISOString();
  const uploadStatus = getArchiveUploadStatus(options.recordsUpload, options.sogamUpload);

  return {
    month: options.month,
    generatedAt,
    generatedBy: 'scheduled-archive',
    recordsCount: options.rows.length,
    sogamCount: options.sogamRows.length,
    uniqueUsers: Object.keys(userMap).length,
    growthCount: growth,
    healingCount: healing,
    anonymousCount: anonymous,
    loggedInCount: options.rows.length - anonymous,
    recordsFile: options.recordsFile,
    sogamFile: options.sogamFile,
    recordsStorage: options.recordsUpload || null,
    sogamStorage: options.sogamUpload || null,
    uploadStatus,
    scheduleStatus: uploadStatus === 'uploaded' ? 'success' : uploadStatus,
    lastRunId: options.runId,
    lastRunAt: options.startedAt,
    lastCompletedAt: generatedAt,
    lastError: uploadStatus === 'uploaded' ? '' : collectUploadErrors(options.recordsUpload, options.sogamUpload),
    updatedAt: generatedAt,
    note: options.dryRun
      ? 'Dry run only. No Firestore metadata or Storage files were written.'
      : 'CSV files were generated by the scheduled archive job and uploaded to Firebase Storage.'
  };
}

function getArchiveUploadStatus(recordsUpload, sogamUpload) {
  if (recordsUpload && recordsUpload.status === 'error') return 'error';
  if (sogamUpload && sogamUpload.status === 'error') return 'partial';
  if (recordsUpload && recordsUpload.status === 'uploaded' &&
    (!sogamUpload || sogamUpload.status === 'uploaded' || sogamUpload.status === 'skipped')) {
    return 'uploaded';
  }
  if (recordsUpload && recordsUpload.status === 'dry-run') return 'dry-run';
  return 'unknown';
}

function collectUploadErrors(recordsUpload, sogamUpload) {
  return [recordsUpload, sogamUpload]
    .filter(item => item && item.error && item.status !== 'skipped')
    .map(item => `${item.file || 'archive'}: ${item.error}`)
    .join(' | ');
}

function buildRecordsCsv(rows) {
  const headers = [
    'date', 'savedAt', 'uid', 'nickname', 'email', 'userType', 'edition', 'score', 'starsEarned',
    'durationSeconds', 'inputMode', 'sentence', 'author', 'source', 'creative', 'structFb', 'creativeFb'
  ];
  const lines = [headers];
  rows.forEach(entry => {
    lines.push([
      entry.date || '',
      entry.savedAt || '',
      entry.uid || '',
      entry.nickname || '',
      entry.email || '',
      entry.isAnonymous ? 'anonymous' : 'logged-in',
      entry.edition || 'growth',
      pickScore(entry),
      entry.starsEarned || '',
      entry.durationSeconds || '',
      entry.inputMode || '',
      entry.sentence || '',
      entry.author || '',
      entry.source || '',
      entry.creative || '',
      entry.structFb || '',
      entry.creativeFb || ''
    ]);
  });
  return toCsv(lines);
}

function buildSogamCsv(rows) {
  const headers = [
    'date', 'savedAt', 'uid', 'nickname', 'email', 'userType', 'edition', 'sentence', 'sogam', 'coachResponse', 'emotionTag'
  ];
  const lines = [headers];
  rows.forEach(entry => {
    lines.push([
      entry.date || '',
      entry.savedAt || '',
      entry.uid || '',
      entry.nickname || '',
      entry.email || '',
      entry.isAnonymous ? 'anonymous' : 'logged-in',
      entry.edition || 'growth',
      entry.sentence || '',
      entry.sogam || '',
      entry.coachResponse || '',
      entry.emotionTag || ''
    ]);
  });
  return toCsv(lines);
}

function pickScore(entry) {
  if (entry.finalScore !== undefined && entry.finalScore !== null) return entry.finalScore;
  if (entry.score !== undefined && entry.score !== null) return entry.score;
  if (entry.structScore !== undefined && entry.structScore !== null) return entry.structScore;
  return '';
}

function toCsv(lines) {
  return lines.map(row => row.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value) {
  return `"${String(value === undefined || value === null ? '' : value).replace(/"/g, '""')}"`;
}

main().catch(err => {
  console.error('[archive] fatal:', err && err.message ? err.message : err);
  writeArchiveResult(getResultPath(), {
    status: 'fatal',
    month: safeArchiveMonth(),
    dryRun: hasFlag('--dry-run') || process.env.DRY_RUN === 'true',
    failedAt: new Date().toISOString(),
    githubRunUrl: getGithubRunUrl(),
    error: err && err.message ? err.message : String(err)
  });
  process.exit(1);
});

function safeArchiveMonth() {
  try {
    return getArchiveMonth();
  } catch (err) {
    return process.env.ARCHIVE_MONTH || '';
  }
}
