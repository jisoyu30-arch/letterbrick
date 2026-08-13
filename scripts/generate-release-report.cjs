#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const OUT_DIR = process.env.RELEASE_REPORT_DIR || 'release-reports';
const REPORT_ID = process.env.RELEASE_REPORT_ID || new Date().toISOString().replace(/[:.]/g, '-');

async function main() {
  const startedAt = new Date().toISOString();
  const db = await maybeFirestore();
  const data = db ? await loadFirestoreSignals(db) : localSignals();
  const gates = buildReleaseGates(data);
  const overall = summarizeGates(gates);
  const report = {
    reportId: REPORT_ID,
    status: overall.status,
    generatedAt: new Date().toISOString(),
    startedAt,
    gates,
    summary: overall,
    signals: sanitizeSignals(data),
    githubRunUrl: getGithubRunUrl()
  };

  ensureDir(OUT_DIR);
  const markdown = buildMarkdown(report);
  const html = buildHtml(report, markdown);
  const mdPath = path.join(OUT_DIR, `${REPORT_ID}.md`);
  const htmlPath = path.join(OUT_DIR, `${REPORT_ID}.html`);
  const jsonPath = path.join(OUT_DIR, `${REPORT_ID}.json`);
  fs.writeFileSync(mdPath, markdown, 'utf8');
  fs.writeFileSync(htmlPath, html, 'utf8');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (db) await writeFirestoreReport(db, report);

  console.log('LetterBrick Release Report');
  console.log('==========================');
  console.log(`Status : ${report.status}`);
  console.log(`Report : ${mdPath}`);
  console.log(`HTML   : ${htmlPath}`);
  console.log(`JSON   : ${jsonPath}`);
  process.exitCode = overall.failCount > 0 ? 1 : 0;
}

async function maybeFirestore() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(raw)) });
  return getFirestore();
}

async function loadFirestoreSignals(db) {
  const [
    quality,
    cleanup,
    archive,
    restoreRun,
    archiveRun,
    recordSample
  ] = await Promise.all([
    readDocOrNull(db, 'admin_data_quality', 'latest'),
    readDocOrNull(db, 'admin_quality_cleanup', 'latest'),
    readLatestBy(db, 'admin_archives', 'month'),
    readLatestBy(db, 'admin_archive_restore_runs', 'completedAt'),
    readLatestBy(db, 'admin_archive_runs', 'startedAt'),
    db.collectionGroup('entries').orderBy('savedAt', 'desc').limit(20).get().then(snap => snap.size).catch(() => 0)
  ]);
  return { readCount: recordSample, quality, cleanup, archive, restoreRun, archiveRun };
}

async function readDocOrNull(db, collection, docId) {
  const doc = await db.collection(collection).doc(docId).get();
  return doc.exists ? doc.data() : null;
}

async function readLatestBy(db, collection, field) {
  try {
    const snap = await db.collection(collection).orderBy(field, 'desc').limit(1).get();
    if (snap.empty) return null;
    return { _id: snap.docs[0].id, ...snap.docs[0].data() };
  } catch (err) {
    return null;
  }
}

function localSignals() {
  return {
    readCount: 0,
    quality: loadLocalQualityResult(),
    cleanup: null,
    archive: null,
    restoreRun: null,
    archiveRun: null
  };
}

function loadLocalQualityResult() {
  const resultPath = process.env.DATA_QUALITY_RESULT_PATH || 'data-quality-result.json';
  const absolutePath = path.resolve(resultPath);
  if (!fs.existsSync(absolutePath)) return null;
  try {
    const result = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    return { source: 'local-file', ...result };
  } catch (err) {
    return {
      status: 'error',
      issueCounts: { error: 1, warn: 0, info: 0 },
      issues: [{
        severity: 'error',
        code: 'invalid-local-data-quality-result',
        where: resultPath,
        message: `로컬 data quality 결과를 읽을 수 없습니다: ${err.message}`
      }]
    };
  }
}

function buildReleaseGates(data) {
  const gates = [];
  gates.push(gate('firebase', 'Firebase read', data.readCount > 0 ? 'pass' : 'warn',
    data.readCount > 0 ? `${data.readCount} record samples loaded` : 'No Firestore record sample was loaded.'));

  const qualityStatus = data.quality ? data.quality.status : 'missing';
  gates.push(gate('quality', 'Data quality',
    qualityStatus === 'ok' ? 'pass' : qualityStatus === 'error' || qualityStatus === 'fatal' ? 'fail' : 'warn',
    data.quality ? `errors ${(data.quality.issueCounts || {}).error || 0}, warnings ${(data.quality.issueCounts || {}).warn || 0}` : 'No saved data quality result.'));

  const archiveStatus = data.archive ? (data.archive.uploadStatus || data.archive.scheduleStatus || 'metadata') : 'missing';
  gates.push(gate('archive', 'Monthly archive',
    archiveStatus === 'uploaded' || archiveStatus === 'success' ? 'pass' : archiveStatus === 'error' || archiveStatus === 'partial' ? 'fail' : 'warn',
    data.archive ? `${data.archive.month || data.archive._id || ''} ${archiveStatus}` : 'No archive metadata.'));

  const archiveRunStatus = data.archiveRun ? (data.archiveRun.status || data.archiveRun.uploadStatus || 'unknown') : 'missing';
  gates.push(gate('archiveRun', 'Archive job',
    archiveRunStatus === 'success' || archiveRunStatus === 'uploaded' ? 'pass' : archiveRunStatus === 'error' || archiveRunStatus === 'partial' ? 'fail' : 'warn',
    data.archiveRun ? `${archiveRunStatus} ${(data.archiveRun.startedAt || '').slice(0, 10)}` : 'No scheduled archive run.'));

  const restoreStatus = data.restoreRun ? (data.restoreRun.status || 'unknown') : 'missing';
  gates.push(gate('restore', 'Restore run',
    restoreStatus === 'error' || restoreStatus === 'fatal' ? 'fail' : data.restoreRun ? 'pass' : 'warn',
    data.restoreRun ? `${restoreStatus} ${(data.restoreRun.completedAt || data.restoreRun.startedAt || '').slice(0, 10)}` : 'No restore run history.'));

  const cleanupStatus = data.cleanup ? (data.cleanup.status || 'unknown') : 'missing';
  gates.push(gate('cleanup', 'Duplicate cleanup',
    cleanupStatus === 'fatal' || cleanupStatus === 'error' ? 'fail' : data.cleanup ? 'pass' : 'warn',
    data.cleanup ? `${cleanupStatus}, candidates ${data.cleanup.deleteCandidates || 0}` : 'No duplicate cleanup run.'));

  const contentWarnings = data.quality && data.quality.issueCounts ? data.quality.issueCounts.warn || 0 : 0;
  const contentErrors = data.quality && data.quality.issueCounts ? data.quality.issueCounts.error || 0 : 0;
  gates.push(gate('content', 'Content audit',
    contentErrors ? 'fail' : contentWarnings ? 'warn' : data.quality ? 'pass' : 'warn',
    data.quality ? `errors ${contentErrors}, warnings ${contentWarnings}` : 'Data quality audit result required.'));

  return gates;
}

function gate(key, label, status, detail) {
  return { key, label, status, detail };
}

function summarizeGates(gates) {
  const failCount = gates.filter(g => g.status === 'fail').length;
  const warnCount = gates.filter(g => g.status === 'warn').length;
  return {
    status: failCount ? 'fail' : warnCount ? 'warn' : 'pass',
    passCount: gates.filter(g => g.status === 'pass').length,
    warnCount,
    failCount,
    gateCount: gates.length
  };
}

function buildMarkdown(report) {
  const lines = [
    '# LetterBrick Release Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status.toUpperCase()}`,
    '',
    '## Summary',
    '',
    `- Pass: ${report.summary.passCount}`,
    `- Warn: ${report.summary.warnCount}`,
    `- Fail: ${report.summary.failCount}`,
    `- Gates: ${report.summary.gateCount}`,
    report.githubRunUrl ? `- GitHub run: ${report.githubRunUrl}` : '',
    '',
    '## Gates',
    '',
    '| Gate | Status | Detail |',
    '| --- | --- | --- |'
  ].filter(Boolean);

  report.gates.forEach(g => {
    lines.push(`| ${escapeMd(g.label)} | ${g.status.toUpperCase()} | ${escapeMd(g.detail)} |`);
  });

  lines.push('', '## Operational Notes', '');
  if (report.status === 'pass') {
    lines.push('- All release gates are passing.');
  } else {
    lines.push('- Review warn/fail gates before release.');
    lines.push('- Missing operational history is treated as WARN.');
    lines.push('- FAIL gates should block release until remediated.');
  }
  return `${lines.join('\n')}\n`;
}

function buildHtml(report, markdown) {
  const rows = report.gates.map(g => `<tr><td>${esc(g.label)}</td><td class="${g.status}">${g.status.toUpperCase()}</td><td>${esc(g.detail)}</td></tr>`).join('');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>LetterBrick Release Report</title>
<style>
body{font-family:Arial,sans-serif;margin:32px;color:#2E2A26;background:#f7f2e8}
.wrap{max-width:920px;margin:0 auto;background:#fff;padding:28px;border-radius:10px}
h1{margin-top:0}
.status{font-weight:700}
.pass{color:#3D6B50}.warn{color:#8a5d00}.fail{color:#B65E3C}
table{border-collapse:collapse;width:100%;margin-top:18px}
th,td{border-bottom:1px solid #ddd;padding:10px;text-align:left;font-size:14px}
pre{white-space:pre-wrap;background:#f6f4ef;padding:16px;border-radius:8px}
</style>
</head>
<body><div class="wrap">
<h1>LetterBrick Release Report</h1>
<p>Generated: ${esc(report.generatedAt)}</p>
<p class="status ${report.status}">Status: ${report.status.toUpperCase()}</p>
<table><thead><tr><th>Gate</th><th>Status</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Markdown</h2>
<pre>${esc(markdown)}</pre>
</div></body></html>`;
}

async function writeFirestoreReport(db, report) {
  const doc = {
    reportId: report.reportId,
    status: report.status,
    generatedAt: report.generatedAt,
    summary: report.summary,
    gates: report.gates,
    githubRunUrl: report.githubRunUrl || '',
    markdownPath: `${OUT_DIR}/${REPORT_ID}.md`,
    htmlPath: `${OUT_DIR}/${REPORT_ID}.html`
  };
  await db.collection('admin_release_reports').doc(report.reportId).set(doc);
  await db.collection('admin_release').doc('latest').set(doc, { merge: true });
}

function sanitizeSignals(data) {
  return JSON.parse(JSON.stringify(data || {}));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeMd(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function esc(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getGithubRunUrl() {
  if (!process.env.GITHUB_SERVER_URL || !process.env.GITHUB_REPOSITORY || !process.env.GITHUB_RUN_ID) return '';
  return `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
}

main().catch(err => {
  console.error('[release-report] fatal:', err && err.message ? err.message : err);
  process.exit(1);
});
