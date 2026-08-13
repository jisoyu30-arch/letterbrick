#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');

const DEFAULT_BUCKET = 'letterbrick.firebasestorage.app';
const WRITE_BATCH_LIMIT = 450;

async function main() {
  const month = getRequiredMonth();
  const commit = hasFlag('--commit') || process.env.RESTORE_COMMIT === 'true';
  const confirmValue = process.env.RESTORE_CONFIRM || '';
  const resultPath = process.env.RESTORE_RESULT_PATH || 'restore-result.json';
  const serviceAccount = loadServiceAccount();
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || DEFAULT_BUCKET;
  const startedAt = new Date().toISOString();
  const runId = `${month}_${startedAt.replace(/[:.]/g, '-')}`;
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const { getStorage } = require('firebase-admin/storage');

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`Invalid restore month: ${month}`);
  }

  if (commit && confirmValue !== `RESTORE_${month}`) {
    throw new Error(`Commit restore requires RESTORE_CONFIRM=RESTORE_${month}`);
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: bucketName
    });
  }

  const db = getFirestore();
  const bucket = getStorage().bucket(bucketName);
  const runRef = db.collection('admin_archive_restore_runs').doc(runId);

  console.log(`[restore] month=${month} commit=${commit}`);

  await runRef.set({
    runId,
    month,
    status: 'running',
    mode: commit ? 'commit' : 'dry-run',
    startedAt,
    source: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local'
  });

  try {
    const archive = await loadArchiveMeta(db, month);
    const recordsPath = resolveRecordsPath(month, archive);
    const sogamPath = resolveSogamPath(month, archive);
    const recordsCsv = await downloadText(bucket, recordsPath);
    const sogamCsv = sogamPath ? await tryDownloadText(bucket, sogamPath) : '';
    const records = parseCsv(recordsCsv).map(recordToEntry);
    const sogamByKey = mapSogamRows(sogamCsv ? parseCsv(sogamCsv) : []);
    const entries = records.map(entry => mergeSogam(entry, sogamByKey));
    const validation = validateEntries(entries, month);

    if (validation.errors.length) {
      throw new Error(`Restore validation failed: ${validation.errors.join(' | ')}`);
    }

    const duplicateReport = await detectDuplicates(db, entries);
    const writeCandidates = entries.filter((entry, index) => !duplicateReport.duplicateIndexes[index]);
    const preview = writeCandidates.slice(0, 10).map(entry => ({
      uid: entry.uid,
      date: entry.date,
      edition: entry.edition,
      sentence: truncate(entry.sentence, 80)
    }));

    let writtenCount = 0;
    if (commit && writeCandidates.length) {
      writtenCount = await writeEntries(db, writeCandidates, runId, month);
    }

    const completedAt = new Date().toISOString();
    const status = commit ? 'restored' : 'dry-run';
    const result = {
      status,
      month,
      runId,
      commit,
      startedAt,
      completedAt,
      recordsPath,
      sogamPath,
      totalRows: entries.length,
      validRows: validation.validCount,
      duplicateRows: duplicateReport.duplicates.length,
      restoreCandidates: writeCandidates.length,
      writtenCount,
      warnings: validation.warnings,
      preview,
      runDocPath: `admin_archive_restore_runs/${runId}`,
      githubRunUrl: getGithubRunUrl(),
      error: ''
    };

    await runRef.set({
      status,
      completedAt,
      recordsPath,
      sogamPath,
      totalRows: entries.length,
      validRows: validation.validCount,
      duplicateRows: duplicateReport.duplicates.length,
      restoreCandidates: writeCandidates.length,
      writtenCount,
      warnings: validation.warnings,
      preview,
      githubRunUrl: result.githubRunUrl,
      updatedAt: completedAt
    }, { merge: true });

    writeResult(resultPath, result);
    console.log(`[restore] complete status=${status} candidates=${writeCandidates.length} written=${writtenCount}`);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    const failedAt = new Date().toISOString();
    await runRef.set({
      status: 'error',
      failedAt,
      error: message,
      updatedAt: failedAt
    }, { merge: true });
    writeResult(resultPath, {
      status: 'error',
      month,
      runId,
      commit,
      startedAt,
      failedAt,
      runDocPath: `admin_archive_restore_runs/${runId}`,
      githubRunUrl: getGithubRunUrl(),
      error: message
    });
    console.error('[restore] failed:', message);
    process.exitCode = 1;
  }
}

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT secret');
  return JSON.parse(raw);
}

function getRequiredMonth() {
  const month = getArgValue('--month') || process.env.RESTORE_MONTH || process.env.ARCHIVE_MONTH || '';
  if (!month) throw new Error('Restore month is required. Use --month=YYYY-MM or RESTORE_MONTH.');
  return month;
}

function getArgValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.find(arg => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : '';
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function loadArchiveMeta(db, month) {
  const doc = await db.collection('admin_archives').doc(month).get();
  return doc.exists ? doc.data() : {};
}

function resolveRecordsPath(month, archive) {
  if (archive.recordsStorage && archive.recordsStorage.path) return archive.recordsStorage.path;
  return `admin_archives/${month}/letterbrick_archive_records_${month}.csv`;
}

function resolveSogamPath(month, archive) {
  if (archive.sogamStorage && archive.sogamStorage.path) return archive.sogamStorage.path;
  if (archive.sogamFile) return `admin_archives/${month}/${archive.sogamFile}`;
  return `admin_archives/${month}/letterbrick_archive_sogam_${month}.csv`;
}

async function downloadText(bucket, path) {
  const [buffer] = await bucket.file(path).download();
  return stripBom(buffer.toString('utf8'));
}

async function tryDownloadText(bucket, path) {
  try {
    return await downloadText(bucket, path);
  } catch (err) {
    console.log(`[restore] optional sogam CSV skipped: ${path} (${err.message || err})`);
    return '';
  }
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    const next = csv[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map(header => header.trim());
  return rows.slice(1).filter(row => row.some(value => value !== '')).map(row => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index] || '';
    });
    return item;
  });
}

function recordToEntry(row) {
  return {
    date: row.date || '',
    savedAt: row.savedAt || '',
    uid: row.uid || '',
    nickname: row.nickname || '',
    email: row.email || '',
    isAnonymous: row.userType === 'anonymous',
    edition: row.edition || 'growth',
    finalScore: parseOptionalNumber(row.score),
    score: parseOptionalNumber(row.score),
    starsEarned: parseOptionalNumber(row.starsEarned),
    durationSeconds: parseOptionalNumber(row.durationSeconds),
    inputMode: row.inputMode || '',
    sentence: row.sentence || '',
    author: row.author || '',
    source: row.source || '',
    creative: row.creative || '',
    structFb: row.structFb || '',
    creativeFb: row.creativeFb || ''
  };
}

function mapSogamRows(rows) {
  const map = {};
  rows.forEach(row => {
    const key = restoreKey(row.uid || '', row.date || '', row.sentence || '');
    map[key] = {
      sogam: row.sogam || '',
      coachResponse: row.coachResponse || '',
      emotionTag: row.emotionTag || ''
    };
  });
  return map;
}

function mergeSogam(entry, sogamByKey) {
  const merged = { ...entry };
  const extra = sogamByKey[restoreKey(entry.uid, entry.date, entry.sentence)];
  if (extra) {
    merged.sogam = extra.sogam;
    merged.coachResponse = extra.coachResponse;
    merged.emotionTag = extra.emotionTag;
  }
  return merged;
}

function validateEntries(entries, month) {
  const errors = [];
  const warnings = [];
  entries.forEach((entry, index) => {
    const row = index + 2;
    if (!entry.uid) errors.push(`row ${row}: uid missing`);
    if (!entry.date || entry.date.slice(0, 7) !== month) errors.push(`row ${row}: invalid month/date ${entry.date}`);
    if (!entry.sentence) errors.push(`row ${row}: sentence missing`);
    if (!entry.savedAt) warnings.push(`row ${row}: savedAt missing`);
  });
  return { errors, warnings, validCount: entries.length - errors.length };
}

async function detectDuplicates(db, entries) {
  const duplicateIndexes = {};
  const duplicates = [];

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (!entry.uid || !entry.date || !entry.sentence) continue;
    const existing = await db.collection('records').doc(entry.uid).collection('entries')
      .where('date', '==', entry.date)
      .limit(20)
      .get();
    const match = existing.docs.find(doc => (doc.data().sentence || '') === entry.sentence);
    if (match) {
      duplicateIndexes[index] = true;
      duplicates.push({
        index,
        uid: entry.uid,
        date: entry.date,
        sentence: truncate(entry.sentence, 80),
        path: match.ref.path
      });
    }
  }

  return { duplicateIndexes, duplicates };
}

async function writeEntries(db, entries, runId, month) {
  let batch = db.batch();
  let count = 0;
  let pending = 0;

  for (const entry of entries) {
    const docId = restoreDocId(entry);
    const ref = db.collection('records').doc(entry.uid).collection('entries').doc(docId);
    batch.set(ref, {
      ...removeEmptyUndefined(entry),
      restoredAt: new Date().toISOString(),
      restoredFromArchiveMonth: month,
      restoredRunId: runId,
      restoreSource: 'archive-csv'
    }, { merge: false });
    count += 1;
    pending += 1;

    if (pending >= WRITE_BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
      console.log(`[restore] committed ${count} entries`);
    }
  }

  if (pending) await batch.commit();
  return count;
}

function restoreDocId(entry) {
  return `restore_${crypto.createHash('sha1')
    .update(`${entry.uid}|${entry.date}|${entry.sentence}`)
    .digest('hex')
    .slice(0, 28)}`;
}

function restoreKey(uid, date, sentence) {
  return `${uid}|${date}|${sentence}`;
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
}

function removeEmptyUndefined(entry) {
  const result = {};
  Object.keys(entry).forEach(key => {
    if (entry[key] !== undefined) result[key] = entry[key];
  });
  return result;
}

function truncate(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function writeResult(resultPath, result) {
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`[restore] result written to ${resultPath}`);
}

function getGithubRunUrl() {
  if (!process.env.GITHUB_SERVER_URL || !process.env.GITHUB_REPOSITORY || !process.env.GITHUB_RUN_ID) return '';
  return `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
}

main().catch(err => {
  console.error('[restore] fatal:', err && err.message ? err.message : err);
  writeResult(process.env.RESTORE_RESULT_PATH || 'restore-result.json', {
    status: 'fatal',
    month: safeRestoreMonth(),
    commit: hasFlag('--commit') || process.env.RESTORE_COMMIT === 'true',
    failedAt: new Date().toISOString(),
    githubRunUrl: getGithubRunUrl(),
    error: err && err.message ? err.message : String(err)
  });
  process.exit(1);
});

function safeRestoreMonth() {
  try {
    return getRequiredMonth();
  } catch (err) {
    return process.env.RESTORE_MONTH || process.env.ARCHIVE_MONTH || '';
  }
}
