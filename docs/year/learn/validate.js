// 최종 learn 파일 검증 — 사용법: node docs/year/learn/validate.js [월]  (생략하면 1-12 전부)
const fs = require('fs');
const path = require('path');
const { checkLearn } = require('./check-lib');

const ROOT = path.resolve(__dirname, '..');
const LEARN = __dirname;

function checkMonth(m) {
  const outPath = path.join(LEARN, `growth-${m}-learn.json`);
  if (!fs.existsSync(outPath)) return { m, missing: true };
  const src = JSON.parse(fs.readFileSync(path.join(ROOT, `growth-${m}.json`), 'utf8'));
  let out;
  try { out = JSON.parse(fs.readFileSync(outPath, 'utf8')); }
  catch (e) { return { m, parseError: e.message }; }
  if (!Array.isArray(out)) return { m, parseError: '최상위가 배열이 아님' };

  const errs = [], warns = [];
  if (out.length !== src.length) errs.push(`일자 수 ${out.length} (원본 ${src.length})`);

  const byDay = new Map(out.map(o => [o.day, o]));
  const dupCore = new Map(), dupEx = new Map();
  for (const s of src) {
    const o = byDay.get(s.day);
    if (!o) { errs.push(`day ${s.day} 누락`); continue; }
    for (const side of ['A', 'B']) {
      const ctx = `M${m} D${String(s.day).padStart(2, '0')}${side}`;
      const L = o[side] && o[side].learn;
      checkLearn(L, ctx, s[side].text, errs, warns);
      if (L && L.coreSkill) {
        const k = L.coreSkill.trim();
        if (!dupCore.has(k)) dupCore.set(k, []);
        dupCore.get(k).push(ctx);
      }
      if (L && L.goodExample) {
        const k = L.goodExample.trim();
        if (!dupEx.has(k)) dupEx.set(k, []);
        dupEx.get(k).push(ctx);
      }
    }
  }
  for (const [k, v] of dupCore) if (v.length >= 4) warns.push(`coreSkill "${k}" ${v.length}회 반복 (${v.slice(0, 4).join(', ')}...)`);
  for (const [k, v] of dupEx) if (v.length > 1) errs.push(`goodExample 중복: ${v.join(', ')}`);
  return { m, errs, warns, days: out.length };
}

const arg = process.argv[2];
const months = arg ? [Number(arg)] : Array.from({ length: 12 }, (_, i) => i + 1);
let totalErr = 0, totalDays = 0;
for (const m of months) {
  const r = checkMonth(m);
  if (r.missing) { console.log(`growth-${m}-learn.json : 파일 없음`); totalErr++; continue; }
  if (r.parseError) { console.log(`growth-${m}-learn.json : JSON 오류 - ${r.parseError}`); totalErr++; continue; }
  totalErr += r.errs.length; totalDays += r.days;
  console.log(`growth-${m}-learn.json : ${r.days}일 / ${r.days * 2}블록, 오류 ${r.errs.length}건, 경고 ${r.warns.length}건`);
  r.errs.slice(0, 40).forEach(e => console.log('   [ERR] ' + e));
  if (r.errs.length > 40) console.log(`   ... 외 ${r.errs.length - 40}건`);
  r.warns.slice(0, 8).forEach(e => console.log('   [WARN] ' + e));
  if (r.warns.length > 8) console.log(`   ... 경고 외 ${r.warns.length - 8}건`);
}
console.log(`\n합계 ${totalDays}일 / ${totalDays * 2}블록`);
console.log(totalErr === 0 ? '검증 통과 (오류 0건)' : `총 오류 ${totalErr}건`);
process.exit(totalErr === 0 ? 0 : 1);
