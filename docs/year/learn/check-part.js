// 청크 파일 검증 — 사용법: node docs/year/learn/check-part.js <월> <시작일> <끝일>
// 예: node docs/year/learn/check-part.js 1 1 15
const fs = require('fs');
const path = require('path');
const { checkLearn } = require('./check-lib');

const ROOT = path.resolve(__dirname, '..');
const PARTS = path.join(__dirname, 'parts');

const m = Number(process.argv[2]);
const from = Number(process.argv[3]);
const to = Number(process.argv[4]);
if (!m || !from || !to) { console.error('사용법: node check-part.js <월> <시작일> <끝일>'); process.exit(2); }

const src = JSON.parse(fs.readFileSync(path.join(ROOT, `growth-${m}.json`), 'utf8'));
const srcByDay = new Map(src.map(s => [s.day, s]));

const files = fs.existsSync(PARTS)
  ? fs.readdirSync(PARTS).filter(f => new RegExp(`^growth-${m}-c\\d+\\.json$`).test(f)).sort()
  : [];

const errs = [], warns = [];
const seen = new Map();
for (const f of files) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(PARTS, f), 'utf8')); }
  catch (e) { errs.push(`${f}: JSON 파싱 실패 - ${e.message}`); continue; }
  if (!Array.isArray(arr)) { errs.push(`${f}: 최상위가 배열이 아님`); continue; }
  for (const o of arr) {
    if (!o || typeof o.day !== 'number') { errs.push(`${f}: day 필드 없는 원소`); continue; }
    if (o.day < from || o.day > to) continue;
    if (seen.has(o.day)) errs.push(`day ${o.day} 중복 (${seen.get(o.day)}, ${f})`);
    seen.set(o.day, f);
    const s = srcByDay.get(o.day);
    if (!s) { errs.push(`day ${o.day} 원본에 없음`); continue; }
    for (const side of ['A', 'B']) {
      checkLearn(o[side] && o[side].learn, `M${m} D${String(o.day).padStart(2, '0')}${side}`, s[side].text, errs, warns);
    }
  }
}

for (let d = from; d <= to; d++) {
  if (!srcByDay.has(d)) continue;
  if (!seen.has(d)) errs.push(`day ${d} 누락 — 아직 안 씀`);
}

console.log(`[M${m} day ${from}-${to}] 파일 ${files.length}개, 처리한 일자 ${seen.size}개`);
errs.slice(0, 60).forEach(e => console.log('  [ERR] ' + e));
if (errs.length > 60) console.log(`  ... 외 ${errs.length - 60}건`);
warns.slice(0, 15).forEach(e => console.log('  [WARN] ' + e));
if (warns.length > 15) console.log(`  ... 경고 외 ${warns.length - 15}건`);
console.log(errs.length === 0 ? 'OK — 오류 0건' : `실패 — 오류 ${errs.length}건`);
process.exit(errs.length === 0 ? 0 : 1);
