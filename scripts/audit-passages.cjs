const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const dataFile = path.join(root, 'public', 'data.js');

const SEVERITY_ORDER = { error: 0, warn: 1, info: 2 };
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

function loadData() {
  const code = fs.readFileSync(dataFile, 'utf8');
  const sandbox = { console: { log() {}, warn() {}, error() {} } };
  const probe = `
    globalThis.__LETTERBRICK_AUDIT__ = {
      GROWTH_DAYS: typeof GROWTH_DAYS !== 'undefined' ? GROWTH_DAYS : [],
      HEALING_DAYS: typeof HEALING_DAYS !== 'undefined' ? HEALING_DAYS : []
    };
  `;
  vm.runInNewContext(code + probe, sandbox, { filename: dataFile, timeout: 5000 });
  return sandbox.__LETTERBRICK_AUDIT__;
}

function compact(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function normalizeForDuplicate(text) {
  return compact(text).replace(/[“”"「」『』.,!?;:，。！？\s]/g, '').toLowerCase();
}

function addIssue(issues, severity, code, where, message, meta) {
  issues.push({ severity, code, where, message, meta: meta || {} });
}

function sourceLabel(source) {
  const s = compact(source);
  if (!s) return 'missing';
  const label = SOURCE_LABELS.find((item) => s.includes(item));
  if (label) return label;
  if (/[「」]/.test(s) || /\(\d{3,4}/.test(s)) return 'direct-source';
  return 'unlabeled';
}

function collectGrowth(growthDays) {
  const items = [];
  growthDays.forEach((day, index) => {
    ['A', 'B'].forEach((variant) => {
      const entry = day && day[variant];
      if (!entry) return;
      items.push({
        edition: 'growth',
        day: day.day || index + 1,
        variant,
        where: `GROWTH_DAYS[${index}].${variant}`,
        text: entry.t || entry.text || '',
        author: entry.a || entry.author || '',
        source: entry.s || entry.source || '',
        reason: entry.pt || entry.reason || '',
        learn: entry.learn || null
      });
    });
  });
  return items;
}

function collectHealing(healingDays) {
  return healingDays.map((entry, index) => ({
    edition: 'healing',
    day: entry.day || index + 1,
    theme: entry.theme || '',
    where: `HEALING_DAYS[${index}]`,
    text: entry.t || entry.text || '',
    author: entry.inspiration || entry.author || '',
    source: entry.source || '',
    reason: entry.why || entry.reason || '',
    question: entry.question || ''
  }));
}

function auditGrowth(items, issues, duplicateMap) {
  const dayVariant = new Set();
  items.forEach((item) => {
    const where = item.where;
    const text = compact(item.text);
    const key = `${item.day}:${item.variant}`;
    if (dayVariant.has(key)) {
      addIssue(issues, 'error', 'duplicate-growth-slot', where, `성장 ${key} 슬롯이 중복되었습니다.`);
    }
    dayVariant.add(key);

    if (!text) addIssue(issues, 'error', 'missing-text', where, '성장 문장 텍스트가 없습니다.');
    if (!compact(item.author)) addIssue(issues, 'error', 'missing-author', where, '성장 문장 저자가 없습니다.');
    if (!compact(item.source)) addIssue(issues, 'error', 'missing-source', where, '성장 문장 출처가 없습니다.');
    if (!compact(item.reason)) addIssue(issues, 'warn', 'missing-reason', where, '성장 문장 학습 포인트가 없습니다.');

    if (text.length > 0 && text.length < 18 && !ALLOWED_SHORT_GROWTH.has(where)) {
      addIssue(issues, 'warn', 'growth-too-short', where, `성장 문장이 짧습니다. 현재 ${text.length}자.`);
    }
    if (text.length > 180) {
      addIssue(issues, 'warn', 'growth-too-long', where, `성장 문장이 깁니다. 현재 ${text.length}자.`);
    }

    const label = sourceLabel(item.source);
    if (label === 'unlabeled') {
      addIssue(issues, 'warn', 'unlabeled-source', where, '출처에 번역/의역/영감/오리지널 같은 신뢰 라벨이 없습니다.', { source: item.source });
    }

    if (!item.learn || !item.learn.coreSkill) {
      addIssue(issues, 'warn', 'missing-core-skill', where, '성장 문장 coreSkill이 없습니다.');
    }
    if (item.learn) {
      const step3 = Array.isArray(item.learn.step3Rubric) ? item.learn.step3Rubric.length : 0;
      const step4 = Array.isArray(item.learn.step4Rubric) ? item.learn.step4Rubric.length : 0;
      if (step3 < 3) addIssue(issues, 'warn', 'thin-step3-rubric', where, `3단계 루브릭이 ${step3}개입니다.`);
      if (step4 < 3) addIssue(issues, 'warn', 'thin-step4-rubric', where, `4단계 루브릭이 ${step4}개입니다.`);
    }

    const dupKey = normalizeForDuplicate(text);
    if (dupKey) {
      if (!duplicateMap.has(dupKey)) duplicateMap.set(dupKey, []);
      duplicateMap.get(dupKey).push(where);
    }
  });
}

function auditHealing(items, issues, duplicateMap) {
  const validThemes = new Set(['다짐', '힐링', '여운']);
  const daySet = new Set();
  const themeCounts = {};

  items.forEach((item) => {
    const where = item.where;
    const text = compact(item.text);
    if (!validThemes.has(item.theme)) {
      addIssue(issues, 'error', 'invalid-theme', where, `알 수 없는 힐링 테마입니다: ${item.theme || '(empty)'}`);
    }
    if (daySet.has(item.day)) {
      addIssue(issues, 'error', 'duplicate-healing-day', where, `힐링 day ${item.day}가 중복되었습니다.`);
    }
    daySet.add(item.day);
    themeCounts[item.theme] = (themeCounts[item.theme] || 0) + 1;

    if (!text) addIssue(issues, 'error', 'missing-text', where, '힐링 문단 텍스트가 없습니다.');
    if (!compact(item.author)) addIssue(issues, 'error', 'missing-inspiration', where, '힐링 문단 inspiration/author가 없습니다.');
    if (!compact(item.source)) addIssue(issues, 'error', 'missing-source', where, '힐링 문단 출처 라벨이 없습니다.');
    if (!compact(item.reason)) addIssue(issues, 'error', 'missing-why', where, '힐링 문단 why/reason이 없습니다.');
    if (!compact(item.question)) addIssue(issues, 'error', 'missing-question', where, '힐링 문단 질문이 없습니다.');

    if (text.length > 0 && text.length < 220) {
      addIssue(issues, 'warn', 'healing-too-short', where, `힐링 문단이 짧습니다. 현재 ${text.length}자.`);
    }
    if (text.length > 760) {
      addIssue(issues, 'warn', 'healing-too-long', where, `힐링 문단이 깁니다. 현재 ${text.length}자.`);
    }

    const dupKey = normalizeForDuplicate(text);
    if (dupKey) {
      if (!duplicateMap.has(dupKey)) duplicateMap.set(dupKey, []);
      duplicateMap.get(dupKey).push(where);
    }
  });

  ['다짐', '힐링', '여운'].forEach((theme) => {
    const count = themeCounts[theme] || 0;
    if (count !== 10) {
      addIssue(issues, 'warn', 'theme-count-off', `HEALING_DAYS.${theme}`, `${theme} 테마가 ${count}개입니다. 목표는 10개입니다.`);
    }
  });

  for (let day = 1; day <= 30; day += 1) {
    if (!daySet.has(day)) {
      addIssue(issues, 'error', 'missing-healing-day', 'HEALING_DAYS', `힐링 day ${day}가 없습니다.`);
    }
  }
}

function addDuplicateIssues(issues, duplicateMap) {
  duplicateMap.forEach((locations) => {
    if (locations.length > 1) {
      addIssue(issues, 'error', 'duplicate-text', locations.join(', '), '동일하거나 거의 동일한 텍스트가 중복되었습니다.');
    }
  });
}

function buildSummary(growthItems, healingItems) {
  const sourceLabels = {};
  const healingLengths = healingItems.map((item) => compact(item.text).length).filter(Boolean);
  const growthLengths = growthItems.map((item) => compact(item.text).length).filter(Boolean);
  growthItems.concat(healingItems).forEach((item) => {
    const label = sourceLabel(item.source);
    sourceLabels[label] = (sourceLabels[label] || 0) + 1;
  });
  const avg = (arr) => arr.length ? Math.round(arr.reduce((sum, n) => sum + n, 0) / arr.length) : 0;
  return {
    growthCount: growthItems.length,
    healingCount: healingItems.length,
    growthAverageLength: avg(growthLengths),
    healingAverageLength: avg(healingLengths),
    sourceLabels
  };
}

function printReport(summary, issues) {
  const counts = issues.reduce((acc, item) => {
    acc[item.severity] = (acc[item.severity] || 0) + 1;
    return acc;
  }, {});
  console.log('LetterBrick Passage Audit');
  console.log('========================');
  console.log(`Growth items : ${summary.growthCount}`);
  console.log(`Healing items: ${summary.healingCount}`);
  console.log(`Avg length   : growth ${summary.growthAverageLength} chars / healing ${summary.healingAverageLength} chars`);
  console.log(`Issues       : ${counts.error || 0} errors, ${counts.warn || 0} warnings`);
  console.log('');
  console.log('Source labels');
  Object.keys(summary.sourceLabels).sort().forEach((label) => {
    console.log(`- ${label}: ${summary.sourceLabels[label]}`);
  });

  if (!issues.length) {
    console.log('\nNo issues found.');
    return;
  }

  console.log('\nIssues');
  issues
    .slice()
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.where.localeCompare(b.where))
    .forEach((issue) => {
      console.log(`[${issue.severity.toUpperCase()}] ${issue.code} @ ${issue.where}`);
      console.log(`  ${issue.message}`);
      if (issue.meta && issue.meta.source) console.log(`  source: ${issue.meta.source}`);
    });
}

function main() {
  const data = loadData();
  const growthItems = collectGrowth(data.GROWTH_DAYS || []);
  const healingItems = collectHealing(data.HEALING_DAYS || []);
  const issues = [];
  const duplicateMap = new Map();

  auditGrowth(growthItems, issues, duplicateMap);
  auditHealing(healingItems, issues, duplicateMap);
  addDuplicateIssues(issues, duplicateMap);

  const summary = buildSummary(growthItems, healingItems);
  printReport(summary, issues);

  const hasError = issues.some((issue) => issue.severity === 'error');
  process.exitCode = hasError ? 1 : 0;
}

main();
