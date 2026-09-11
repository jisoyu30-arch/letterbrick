// 한 달치 검수용 요약 출력 — 사용법: node docs/year/learn/show.js <월> [시작일] [끝일]
const fs = require('fs'), path = require('path');
const m = Number(process.argv[2]), from = Number(process.argv[3] || 1), to = Number(process.argv[4] || 31);
const src = JSON.parse(fs.readFileSync(path.join(__dirname, '..', `growth-${m}.json`), 'utf8'));
const out = JSON.parse(fs.readFileSync(path.join(__dirname, `growth-${m}-learn.json`), 'utf8'));
const by = new Map(out.map(o => [o.day, o]));
for (const s of src) {
  if (s.day < from || s.day > to) continue;
  for (const side of ['A', 'B']) {
    const L = by.get(s.day)[side].learn;
    console.log(`\n===== M${m} D${s.day} ${side} =====`);
    console.log('원문   : ' + s[side].text);
    console.log('기법   : ' + s[side].technique);
    console.log('coreSkill: ' + L.coreSkill);
    console.log('미션   : ' + L.practiceMission);
    L.pitfalls.forEach((p, i) => console.log(`pit${i + 1}   : ${p}`));
    console.log('예문   : ' + L.goodExample);
    console.log('해설   : ' + L.exampleExplain);
    console.log('step3  : ' + L.step3Rubric.map(r => `${r.name}(${r.weight}) ${r.desc}`).join(' | '));
  }
}
