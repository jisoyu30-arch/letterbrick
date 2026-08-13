#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { remediationFor } = require('./quality-remediation-map.cjs');

const root = path.resolve(__dirname, '..');
const dataFile = path.join(root, 'public', 'data.js');
const resultPath = process.env.DATA_QUALITY_RESULT_PATH || 'data-quality-result.json';
const SOURCE_LABELS = [
  '레터브릭 오리지널',
  '온:사유 번역',
  '온:사유 의역',
  '온:사유 확장',
  '레터브릭 편역',
  '레터브릭 번역',
  '레터브릭 의역',
  '원문 영감',
  '영감'
];
const ALLOWED_SHORT_GROWTH = new Set([
  'GROWTH_DAYS[8].A',
  'GROWTH_DAYS[16].A',
  'GROWTH_DAYS[18].A'
]);

async function main() {
  const startedAt = new Date().toISOString();
  const issues = [];
  const data = loadPublicData();
  const contentSummary = auditContent(data, issues);
  const firestoreSummary = await auditFirestore(issues);
  const counts = countIssues(issues);
  const status = counts.error > 0 ? 'error' : counts.warn > 0 ? 'warn' : 'ok';

  const result = {
    status,
    runId: buildRunId(startedAt),
    startedAt,
    completedAt: new Date().toISOString(),
    content: contentSummary,
    firestore: firestoreSummary,
    issueCounts: counts,
    issues,
    githubRunUrl: getGithubRunUrl()
  };

  await writeFirestoreResult(result);
  writeResult(resultPath, result);
  printReport(result);
  process.exitCode = counts.error > 0 ? 1 : 0;
}

function loadPublicData() {
  const code = fs.readFileSync(dataFile, 'utf8');
  const sandbox = { console: { log() {}, warn() {}, error() {} } };
  const probe = `
    globalThis.__LETTERBRICK_DATA_QUALITY__ = {
      GROWTH_DAYS: typeof GROWTH_DAYS !== 'undefined' ? GROWTH_DAYS : [],
      HEALING_DAYS: typeof HEALING_DAYS !== 'undefined' ? HEALING_DAYS : []
    };
  `;
  vm.runInNewContext(code + probe, sandbox, { filename: dataFile, timeout: 5000 });
  return sandbox.__LETTERBRICK_DATA_QUALITY__;
}

function auditContent(data, issues) {
  const growth = collectGrowth(data.GROWTH_DAYS || []);
  const healing = collectHealing(data.HEALING_DAYS || []);
  const duplicateMap = new Map();

  growth.forEach(item => auditContentItem(item, issues, duplicateMap));
  healing.forEach(item => auditContentItem(item, issues, duplicateMap));

  duplicateMap.forEach(locations => {
    if (locations.length > 1) {
      addIssue(issues, 'error', 'duplicate-content-text', locations.join(', '), '중복 또는 거의 동일한 콘텐츠 텍스트가 있습니다.');
    }
  });

  const healingThemeCounts = {};
  healing.forEach(item => {
    healingThemeCounts[item.theme] = (healingThemeCounts[item.theme] || 0) + 1;
  });

  ['다짐', '힐링', '여운'].forEach(theme => {
    if ((healingThemeCounts[theme] || 0) !== 10) {
      addIssue(issues, 'warn', 'healing-theme-count', `HEALING_DAYS.${theme}`, `${theme} 테마 수가 ${healingThemeCounts[theme] || 0}개입니다.`);
    }
  });

  return {
    growthCount: growth.length,
    healingCount: healing.length,
    sourceLabels: growth.concat(healing).reduce((acc, item) => {
      const label = sourceLabel(item.source);
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {})
  };
}

function collectGrowth(days) {
  const items = [];
  days.forEach((day, index) => {
    ['A', 'B'].forEach(variant => {
      const entry = day && day[variant];
      if (!entry) return;
      items.push({
        type: 'growth',
        where: `GROWTH_DAYS[${index}].${variant}`,
        text: entry.t || entry.text || '',
        author: entry.a || entry.author || '',
        source: entry.s || entry.source || '',
        reason: entry.pt || entry.reason || '',
        coreSkill: entry.learn && entry.learn.coreSkill ? entry.learn.coreSkill : ''
      });
    });
  });
  return items;
}

function collectHealing(days) {
  return days.map((entry, index) => ({
    type: 'healing',
    where: `HEALING_DAYS[${index}]`,
    theme: entry.theme || '',
    text: entry.t || entry.text || '',
    author: entry.inspiration || entry.author || '',
    source: entry.source || '',
    reason: entry.why || entry.reason || '',
    question: entry.question || ''
  }));
}

function auditContentItem(item, issues, duplicateMap) {
  const text = compact(item.text);
  if (!text) addIssue(issues, 'error', 'missing-content-text', item.where, '콘텐츠 텍스트가 없습니다.');
  if (!compact(item.author)) addIssue(issues, 'error', 'missing-content-author', item.where, '저자/영감 출처가 없습니다.');
  if (!compact(item.source)) addIssue(issues, 'error', 'missing-content-source', item.where, '출처가 없습니다.');

  const label = sourceLabel(item.source);
  if (label === 'unlabeled') addIssue(issues, 'warn', 'unlabeled-content-source', item.where, '출처 라벨이 명확하지 않습니다.');

  if (item.type === 'growth') {
    if (text.length > 0 && text.length < 18 && !ALLOWED_SHORT_GROWTH.has(item.where)) addIssue(issues, 'warn', 'growth-too-short', item.where, `성장 문장이 짧습니다. 현재 ${text.length}자.`);
    if (!compact(item.reason)) addIssue(issues, 'warn', 'missing-growth-point', item.where, '성장 학습 포인트가 없습니다.');
    if (!compact(item.coreSkill)) addIssue(issues, 'warn', 'missing-core-skill', item.where, 'coreSkill이 없습니다.');
  }

  if (item.type === 'healing') {
    if (!['다짐', '힐링', '여운'].includes(item.theme)) addIssue(issues, 'error', 'invalid-healing-theme', item.where, `잘못된 힐링 테마: ${item.theme}`);
    if (!compact(item.question)) addIssue(issues, 'error', 'missing-healing-question', item.where, '힐링 질문이 없습니다.');
    if (text.length > 0 && text.length < 220) addIssue(issues, 'warn', 'healing-too-short', item.where, `힐링 문단이 짧습니다. 현재 ${text.length}자.`);
  }

  const duplicateKey = normalizeForDuplicate(text);
  if (duplicateKey) {
    if (!duplicateMap.has(duplicateKey)) duplicateMap.set(duplicateKey, []);
    duplicateMap.get(duplicateKey).push(item.where);
  }
}

async function auditFirestore(issues) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return {
      checked: false,
      reason: 'FIREBASE_SERVICE_ACCOUNT is not set'
    };
  }

  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  const snap = await db.collectionGroup('entries').orderBy('savedAt', 'desc').limit(500).get();
  const entries = snap.docs.map(doc => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
  const today = new Date().toISOString().slice(0, 10);
  const last7 = dateDaysAgo(6);
  const recent = entries.filter(entry => (entry.date || '') >= last7);
  const todayCount = entries.filter(entry => entry.date === today).length;
  const malformed = [];
  const duplicateKeys = {};

  entries.forEach(entry => {
    const missing = [];
    if (!entry.uid) missing.push('uid');
    if (!entry.date) missing.push('date');
    if (!entry.sentence) missing.push('sentence');
    if (!entry.edition) missing.push('edition');
    if (missing.length) malformed.push({ path: entry.path, missing });

    const key = `${entry.uid || ''}|${entry.date || ''}|${normalizeForDuplicate(entry.sentence || '')}`;
    if (key.replace(/\|/g, '')) {
      if (!duplicateKeys[key]) duplicateKeys[key] = [];
      duplicateKeys[key].push(entry.path);
    }
  });

  malformed.slice(0, 20).forEach(item => {
    addIssue(issues, 'error', 'malformed-record', item.path, `필수 필드 누락: ${item.missing.join(', ')}`);
  });

  Object.keys(duplicateKeys).forEach(key => {
    if (duplicateKeys[key].length > 1) {
      addIssue(issues, 'warn', 'duplicate-saved-record', duplicateKeys[key].join(', '), '동일 uid/date/sentence 저장 기록이 중복으로 보입니다.');
    }
  });

  if (recent.length === 0 && entries.length > 0) {
    addIssue(issues, 'warn', 'recent-record-drop', 'Firestore entries', '최근 7일 저장 기록이 없습니다.');
  }

  return {
    checked: true,
    sampledEntries: entries.length,
    todayCount,
    recent7DayCount: recent.length,
    malformedCount: malformed.length,
    duplicateKeyCount: Object.keys(duplicateKeys).filter(key => duplicateKeys[key].length > 1).length
  };
}

async function writeFirestoreResult(result) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return;

  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  const doc = {
    runId: result.runId,
    status: result.status,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    issueCounts: result.issueCounts,
    content: result.content,
    firestore: result.firestore,
    issuesTop: result.issues.slice(0, 30),
    issueTotal: result.issues.length,
    githubRunUrl: result.githubRunUrl || '',
    source: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local'
  };
  await db.collection('admin_data_quality_runs').doc(result.runId).set(doc);
  await db.collection('admin_data_quality').doc('latest').set(doc, { merge: true });
}

function addIssue(issues, severity, code, where, message) {
  issues.push({ severity, code, where, message, remediation: remediationFor(code) });
}

function compact(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function normalizeForDuplicate(text) {
  return compact(text).replace(/[“”"「」『』.,!?;:，。！？\s]/g, '').toLowerCase();
}

function sourceLabel(source) {
  const text = compact(source);
  if (!text) return 'missing';
  const label = SOURCE_LABELS.find(item => text.includes(item));
  if (label) return label;
  if (/[「」]/.test(text) || /\(\d{3,4}/.test(text)) return 'direct-source';
  return 'unlabeled';
}

function dateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function countIssues(issues) {
  return issues.reduce((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, { error: 0, warn: 0, info: 0 });
}

function printReport(result) {
  console.log('LetterBrick Data Quality Audit');
  console.log('==============================');
  console.log(`Status       : ${result.status}`);
  console.log(`Content      : growth ${result.content.growthCount}, healing ${result.content.healingCount}`);
  console.log(`Firestore    : ${result.firestore.checked ? `${result.firestore.sampledEntries} sampled` : result.firestore.reason}`);
  console.log(`Issues       : ${result.issueCounts.error} errors, ${result.issueCounts.warn} warnings`);
  result.issues.slice(0, 50).forEach(issue => {
    console.log(`[${issue.severity.toUpperCase()}] ${issue.code} @ ${issue.where}`);
    console.log(`  ${issue.message}`);
  });
}

function writeResult(file, result) {
  fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function buildRunId(startedAt) {
  return startedAt.replace(/[:.]/g, '-');
}

function getGithubRunUrl() {
  if (!process.env.GITHUB_SERVER_URL || !process.env.GITHUB_REPOSITORY || !process.env.GITHUB_RUN_ID) return '';
  return `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
}

main().catch(err => {
  const result = {
    status: 'fatal',
    failedAt: new Date().toISOString(),
    issueCounts: { error: 1, warn: 0, info: 0 },
    issues: [{ severity: 'error', code: 'data-quality-fatal', where: 'data-quality-audit', message: err.message || String(err) }],
    githubRunUrl: getGithubRunUrl()
  };
  writeResult(resultPath, result);
  console.error('[data-quality] fatal:', err && err.message ? err.message : err);
  process.exit(1);
});
