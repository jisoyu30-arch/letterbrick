// learn 블록 검증 공용 라이브러리
function len(s) { return [...String(s)].length; }

function checkLearn(L, ctx, srcText, errs, warns) {
  const E = (m) => errs.push(`${ctx}: ${m}`);
  const W = (m) => warns.push(`${ctx}: ${m}`);
  if (!L || typeof L !== 'object') return E('learn 객체 없음');

  if (!L.coreSkill || typeof L.coreSkill !== 'string' || !L.coreSkill.trim()) E('coreSkill 비어 있음');

  const A = L.anatomy;
  if (!A || typeof A !== 'object') return E('anatomy 없음');
  if (!Array.isArray(A.grammar) || A.grammar.length < 3 || A.grammar.length > 5)
    E(`anatomy.grammar 개수 ${A.grammar ? A.grammar.length : 'none'} (3-5 필요)`);
  else A.grammar.forEach((g, i) => {
    if (!g || typeof g !== 'object') return E(`grammar[${i}] 객체 아님`);
    const keys = Object.keys(g).sort().join(',');
    if (keys !== 'label,value') E(`grammar[${i}] 키가 label,value 가 아님 (${keys})`);
    if (!g.label || !String(g.label).trim()) E(`grammar[${i}].label 비어 있음`);
    if (!g.value || !String(g.value).trim()) E(`grammar[${i}].value 비어 있음`);
  });

  if (!Array.isArray(A.rhetoric) || A.rhetoric.length < 2 || A.rhetoric.length > 3)
    E(`anatomy.rhetoric 개수 ${A.rhetoric ? A.rhetoric.length : 'none'} (2-3 필요)`);
  else A.rhetoric.forEach((r, i) => {
    if (typeof r !== 'string' || !r.trim()) E(`rhetoric[${i}] 비어 있음`);
    else if (!r.includes('—')) W(`rhetoric[${i}] em dash(—) 없음`);
  });

  if (!A.effect || len(A.effect) < 40) E(`anatomy.effect 너무 짧음(${A.effect ? len(A.effect) : 0}자, 40자 이상 필요)`);
  if (!A.rhythm || !String(A.rhythm).trim()) E('anatomy.rhythm 비어 있음');

  if (!L.practiceMission || !String(L.practiceMission).startsWith('오늘 미션 — '))
    E('practiceMission 이 "오늘 미션 — " 으로 시작하지 않음');
  if (L.practiceMission && !/_{2,}/.test(L.practiceMission)) W('practiceMission 에 빈칸(___) 없음');

  if (!Array.isArray(L.pitfalls) || L.pitfalls.length !== 3) E(`pitfalls 개수 ${L.pitfalls ? L.pitfalls.length : 'none'} (3 필요)`);
  else L.pitfalls.forEach((p, i) => { if (typeof p !== 'string' || len(p) < 10) E(`pitfalls[${i}] 너무 짧음`); });

  if (!L.goodExample || len(L.goodExample) < 10) E('goodExample 비어 있거나 너무 짧음');

  if (!L.exampleExplain || !String(L.exampleExplain).trim()) E('exampleExplain 비어 있음');
  else if (len(L.exampleExplain) > 120) E(`exampleExplain ${len(L.exampleExplain)}자 (120자 초과)`);

  if (srcText && L.goodExample) {
    const src = String(srcText).split(/\s+/).filter(Boolean);
    const ex = String(L.goodExample);
    for (let i = 0; i + 5 <= src.length; i++) {
      const chunk = src.slice(i, i + 5).join(' ');
      if (ex.includes(chunk)) { E(`goodExample 이 원문 5어절 그대로 포함: "${chunk}"`); break; }
    }
  }

  const r3 = L.step3Rubric;
  if (!Array.isArray(r3) || r3.length < 3 || r3.length > 4) E(`step3Rubric 개수 ${r3 ? r3.length : 'none'} (3-4 필요)`);
  else {
    const sum = r3.reduce((a, x) => a + (Number(x && x.weight) || 0), 0);
    if (sum !== 5) E(`step3Rubric weight 합 ${sum} (5 필요)`);
    r3.forEach((x, i) => {
      if (!x || !x.name || !String(x.name).trim()) E(`step3Rubric[${i}].name 비어 있음`);
      if (!x || !x.desc || len(x.desc) < 8) E(`step3Rubric[${i}].desc 너무 짧음`);
    });
  }

  const r4 = L.step4Rubric;
  if (!Array.isArray(r4) || r4.length !== 4) E(`step4Rubric 개수 ${r4 ? r4.length : 'none'} (4 필요)`);
  else {
    const sum = r4.reduce((a, x) => a + (Number(x && x.weight) || 0), 0);
    if (sum !== 6) E(`step4Rubric weight 합 ${sum} (6 필요)`);
    if (r4[0].name !== '오늘 기법 적용') E(`step4Rubric[0].name = "${r4[0].name}" (반드시 "오늘 기법 적용")`);
    if (Number(r4[0].weight) !== 2) E('step4Rubric[0].weight != 2');
    if (L.coreSkill && r4[0].desc && !String(r4[0].desc).includes(L.coreSkill))
      E('step4Rubric[0].desc 에 coreSkill 인용이 없음');
    if (r4[1].name !== '구체성') E(`step4Rubric[1].name = "${r4[1].name}" (반드시 "구체성")`);
    if (Number(r4[1].weight) !== 1) E('step4Rubric[1].weight != 1');
    if (r4[2].name !== '글의 통일성') E(`step4Rubric[2].name = "${r4[2].name}" (반드시 "글의 통일성")`);
    if (Number(r4[2].weight) !== 1) E('step4Rubric[2].weight != 1');
    if (r4[3].name !== '마무리 여운') E(`step4Rubric[3].name = "${r4[3].name}" (반드시 "마무리 여운")`);
    if (Number(r4[3].weight) !== 2) E('step4Rubric[3].weight != 2');
    r4.forEach((x, i) => { if (!x || !x.desc || len(x.desc) < 8) E(`step4Rubric[${i}].desc 너무 짧음`); });
  }

  const all = JSON.stringify(L);
  if (/\d\s*~\s*\d/.test(all)) E('물결표(~)로 범위 표기 — 하이픈(-)을 쓸 것');
  if (/~~/.test(all)) E('취소선(~~) 사용');
}

module.exports = { checkLearn, len };
