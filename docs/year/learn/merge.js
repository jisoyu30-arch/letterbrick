// 청크 병합 — 사용법: node docs/year/learn/merge.js [월]  (생략하면 1-12 전부)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PARTS = path.join(__dirname, 'parts');

function mergeMonth(m) {
  const src = JSON.parse(fs.readFileSync(path.join(ROOT, `growth-${m}.json`), 'utf8'));
  const files = fs.existsSync(PARTS)
    ? fs.readdirSync(PARTS).filter(f => new RegExp(`^growth-${m}-c\\d+\\.json$`).test(f)).sort()
    : [];
  const byDay = new Map();
  for (const f of files) {
    let arr;
    try { arr = JSON.parse(fs.readFileSync(path.join(PARTS, f), 'utf8')); }
    catch (e) { console.log(`  ${f}: JSON 파싱 실패 - ${e.message}`); continue; }
    if (!Array.isArray(arr)) { console.log(`  ${f}: 배열 아님`); continue; }
    for (const o of arr) if (o && typeof o.day === 'number') byDay.set(o.day, o);
  }
  const out = [];
  const missing = [];
  for (const s of src) {
    const o = byDay.get(s.day);
    if (!o) { missing.push(s.day); continue; }
    out.push({ day: s.day, doy: s.doy, A: { learn: o.A && o.A.learn }, B: { learn: o.B && o.B.learn } });
  }
  fs.writeFileSync(path.join(__dirname, `growth-${m}-learn.json`), JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`growth-${m}-learn.json : ${out.length}/${src.length}일 병합 (청크 ${files.length}개)` +
    (missing.length ? ` — 누락 day ${missing.join(',')}` : ''));
  return missing.length;
}

const arg = process.argv[2];
const months = arg ? [Number(arg)] : Array.from({ length: 12 }, (_, i) => i + 1);
let miss = 0;
for (const m of months) miss += mergeMonth(m);
console.log(miss === 0 ? '병합 완료 — 누락 없음' : `누락 ${miss}일`);
