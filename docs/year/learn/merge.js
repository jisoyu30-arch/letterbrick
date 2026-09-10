// 청크 병합 — 사용법: node docs/year/learn/merge.js [월] [--force]
//
// 기본 동작은 '빈 자리 채우기'다. 병합본에 이미 있는 날은 건드리지 않는다.
//
// 이렇게 만든 이유: 검수 에이전트가 병합본(growth-N-learn.json)의 goodExample 을
// 고친 뒤 누군가 merge.js 를 다시 돌리면 그 수정이 통째로 사라진다. 실제로
// 한 번 발생해 QA 수정 5건이 유실됐다. 병합은 parts 를 정본으로 보고 덮어쓰지만,
// 검수는 병합본을 정본으로 보고 고치기 때문에 두 정본이 충돌한다.
//
// 그래서 기본값을 안전한 쪽으로 뒤집었다.
//   - 병합본에 없는 날    → parts 에서 채운다
//   - 병합본에 있는 날    → 그대로 둔다. parts 와 내용이 다르면 경고만 찍는다
//   - --force            → 예전처럼 parts 로 전부 덮어쓴다 (검수 전에만 쓸 것)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PARTS = path.join(__dirname, 'parts');
const FORCE = process.argv.includes('--force');

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function mergeMonth(m) {
  const src = readJson(path.join(ROOT, `growth-${m}.json`));
  if (!src) { console.log(`growth-${m}.json 없음 — 건너뜀`); return { missing: 0, conflicts: 0 }; }

  const files = fs.existsSync(PARTS)
    ? fs.readdirSync(PARTS).filter(f => new RegExp(`^growth-${m}-c\\d+\\.json$`).test(f)).sort()
    : [];
  const byDay = new Map();
  for (const f of files) {
    const arr = readJson(path.join(PARTS, f));
    if (!Array.isArray(arr)) { console.log(`  ${f}: 읽지 못함`); continue; }
    for (const o of arr) if (o && typeof o.day === 'number') byDay.set(o.day, o);
  }

  const target = path.join(__dirname, `growth-${m}-learn.json`);
  const existing = readJson(target) || [];
  const existingByDay = new Map(existing.map(d => [d.day, d]));

  const out = [];
  const missing = [];
  const filled = [];
  const conflicts = [];

  for (const s of src) {
    const have = existingByDay.get(s.day);
    const part = byDay.get(s.day);
    const fromPart = part
      ? { day: s.day, doy: s.doy, A: { learn: part.A && part.A.learn }, B: { learn: part.B && part.B.learn } }
      : null;

    if (have && !FORCE) {
      out.push(have);
      // 병합본을 유지하되, parts 와 갈라졌으면 알려준다 — 어느 쪽이 최신인지는 사람이 판단할 일이다
      if (fromPart && JSON.stringify(have) !== JSON.stringify(fromPart)) conflicts.push(s.day);
      continue;
    }
    if (fromPart) { out.push(fromPart); if (!have) filled.push(s.day); continue; }
    missing.push(s.day);
  }

  fs.writeFileSync(target, JSON.stringify(out, null, 2) + '\n', 'utf8');

  const bits = [`${out.length}/${src.length}일`];
  if (FORCE) bits.push('전체 덮어씀');
  else if (filled.length) bits.push(`새로 채움 ${filled.length}일`);
  else bits.push('변경 없음');
  console.log(`growth-${m}-learn.json : ${bits.join(' · ')} (청크 ${files.length}개)` +
    (missing.length ? ` — 누락 day ${missing.join(',')}` : ''));
  if (conflicts.length) {
    console.log(`   [주의] parts 와 내용이 다른 day ${conflicts.join(',')} — 병합본을 그대로 두었다.`);
    console.log(`          parts 쪽을 쓰려면 그 날짜만 손으로 옮기거나 --force 로 전체를 덮어써라.`);
  }
  return { missing: missing.length, conflicts: conflicts.length };
}

const arg = process.argv.find(a => /^\d+$/.test(a));
const months = arg ? [Number(arg)] : Array.from({ length: 12 }, (_, i) => i + 1);
let miss = 0, conf = 0;
for (const m of months) { const r = mergeMonth(m); miss += r.missing; conf += r.conflicts; }
console.log('');
console.log(miss === 0 ? '누락 없음' : `누락 ${miss}일`);
if (conf) console.log(`parts 와 갈라진 ${conf}일이 있다. 위 [주의] 줄을 확인할 것.`);
if (!FORCE) console.log('(기본은 빈 자리만 채운다. 전체 재생성은 --force)');
