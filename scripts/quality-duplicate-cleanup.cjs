#!/usr/bin/env node

const fs = require('node:fs');

const resultPath = process.env.QUALITY_DUPLICATE_RESULT_PATH || 'quality-duplicate-cleanup-result.json';
const SAMPLE_LIMIT = Number(process.env.QUALITY_DUPLICATE_LIMIT || 500);

async function main() {
  const commit = process.argv.includes('--commit') || process.env.QUALITY_DUPLICATE_COMMIT === 'true';
  if (commit && process.env.QUALITY_DUPLICATE_CONFIRM !== 'DELETE_DUPLICATES') {
    throw new Error('Commit requires QUALITY_DUPLICATE_CONFIRM=DELETE_DUPLICATES');
  }
  const serviceAccount = loadServiceAccount();
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  const startedAt = new Date().toISOString();
  const runId = startedAt.replace(/[:.]/g, '-');
  const snap = await db.collectionGroup('entries').orderBy('savedAt', 'desc').limit(SAMPLE_LIMIT).get();
  const rows = snap.docs.map(doc => ({ path: doc.ref.path, ref: doc.ref, ...doc.data() }));
  const groups = groupDuplicates(rows);
  const candidates = buildCandidates(groups);
  let deletedCount = 0;

  if (commit) {
    for (const item of candidates) {
      await db.doc(item.deletePath).delete();
      deletedCount += 1;
    }
  }

  const result = {
    status: commit ? 'committed' : 'dry-run',
    runId,
    startedAt,
    completedAt: new Date().toISOString(),
    sampledEntries: rows.length,
    duplicateGroups: groups.length,
    deleteCandidates: candidates.length,
    deletedCount,
    candidates: candidates.slice(0, 100),
    githubRunUrl: getGithubRunUrl()
  };
  await writeFirestoreResult(db, result);
  writeResult(resultPath, result);
  printReport(result);
}

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT secret');
  return JSON.parse(raw);
}

function groupDuplicates(rows) {
  const map = {};
  rows.forEach(row => {
    if (!row.uid || !row.date || !row.sentence) return;
    const key = `${row.uid}|${row.date}|${normalize(row.sentence)}`;
    if (!map[key]) map[key] = [];
    map[key].push(row);
  });
  return Object.keys(map).map(key => {
    const items = map[key].slice().sort(compareForKeep);
    return { key, keep: items[0], duplicates: items.slice(1) };
  }).filter(group => group.duplicates.length > 0);
}

function buildCandidates(groups) {
  const candidates = [];
  groups.forEach(group => {
    group.duplicates.forEach(item => {
      candidates.push({
        key: group.key,
        keepPath: group.keep.path,
        deletePath: item.path,
        date: item.date || '',
        uid: item.uid || '',
        savedAt: item.savedAt || '',
        sentence: truncate(item.sentence || '', 90)
      });
    });
  });
  return candidates;
}

function compareForKeep(a, b) {
  const aSaved = String(a.savedAt || '');
  const bSaved = String(b.savedAt || '');
  if (aSaved && bSaved && aSaved !== bSaved) return aSaved.localeCompare(bSaved);
  return String(a.path || '').localeCompare(String(b.path || ''));
}

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().replace(/[“”"「」『』.,!?;:，。！？\s]/g, '').toLowerCase();
}

function truncate(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function writeResult(file, result) {
  fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

async function writeFirestoreResult(db, result) {
  const doc = {
    runId: result.runId,
    status: result.status,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    sampledEntries: result.sampledEntries,
    duplicateGroups: result.duplicateGroups,
    deleteCandidates: result.deleteCandidates,
    deletedCount: result.deletedCount,
    candidatesTop: result.candidates.slice(0, 30),
    githubRunUrl: result.githubRunUrl || '',
    source: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local'
  };
  await db.collection('admin_quality_cleanup_runs').doc(result.runId).set(doc);
  await db.collection('admin_quality_cleanup').doc('latest').set(doc, { merge: true });
}

function printReport(result) {
  console.log('LetterBrick Duplicate Cleanup');
  console.log('=============================');
  console.log(`Status           : ${result.status}`);
  console.log(`Sampled entries  : ${result.sampledEntries}`);
  console.log(`Duplicate groups : ${result.duplicateGroups}`);
  console.log(`Delete candidates: ${result.deleteCandidates}`);
  console.log(`Deleted          : ${result.deletedCount}`);
}

function getGithubRunUrl() {
  if (!process.env.GITHUB_SERVER_URL || !process.env.GITHUB_REPOSITORY || !process.env.GITHUB_RUN_ID) return '';
  return `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
}

main().catch(err => {
  const result = {
    status: 'fatal',
    failedAt: new Date().toISOString(),
    error: err && err.message ? err.message : String(err),
    githubRunUrl: getGithubRunUrl()
  };
  writeResult(resultPath, result);
  console.error('[quality-duplicates] fatal:', result.error);
  process.exit(1);
});
