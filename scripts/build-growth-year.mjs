/* 성장편 1년치 빌더
 *
 * 입력: docs/year/growth-{1..12}.json      (문장 배치 — text/author/work/technique)
 *       docs/year/learn/growth-{1..12}-learn.json  (학습 블록 — anatomy/rubric/mission 등)
 * 출력: public/data-year.js 의 GROWTH_YEAR 블록
 *
 * 학습 블록이 없는 달은 건너뛴다. 일부만 있어도 그만큼만 빌드해
 * 앱이 부분적으로라도 365일을 쓸 수 있게 한다.
 *
 * 실행: node scripts/build-growth-year.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const YEAR = path.join(ROOT, 'docs', 'year');
const LEARN = path.join(YEAR, 'learn');
const TARGET = path.join(ROOT, 'public', 'data-year.js');

// 학습 블록이 없을 때 쓰는 최소 루브릭 — 채점은 되게 하되 화면 학습은 비운다
function fallbackLearn(v) {
  const skill = v.technique || '오늘의 문장 기법';
  return {
    coreSkill: skill,
    anatomy: null,                       // 화면에서 '구조 가이드' 숨김 처리
    practiceMission: '오늘 미션 — 원문의 구조를 빌려, 다른 소재로 한 문장을 써보세요.',
    pitfalls: [],
    goodExample: '',
    exampleExplain: '',
    step3Rubric: [
      { name: '구조 재현도', weight: 2, desc: '원문의 핵심 문장 패턴이 사용자 문장에 살아 있는가' },
      { name: '내용의 구체성', weight: 2, desc: '원문 소재와 다른 자신만의 장면·감각으로 표현했는가' },
      { name: '문장의 완성도', weight: 1, desc: '문장이 어법에 맞고 읽는 호흡이 자연스럽게 완결되는가' }
    ],
    step4Rubric: [
      { name: '오늘 기법 적용', weight: 2, desc: "'" + skill + "' — 오늘 배운 이 기법이 내 문장의 뼈대로 실제 작동하는가" },
      { name: '구체성', weight: 1, desc: '추상어 대신 장면·감각으로 표현했는가' },
      { name: '글의 통일성', weight: 1, desc: '글 전체가 하나의 감정이나 주제를 향해 일관되게 흐르는가' },
      { name: '마무리 여운', weight: 2, desc: '마지막 문장이 읽고 나서도 머릿속에 남는가' }
    ],
    _fallback: true
  };
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

const days = [];
let withLearn = 0, withFallback = 0;
const monthStatus = [];

for (let m = 1; m <= 12; m++) {
  const placed = readJson(path.join(YEAR, `growth-${m}.json`));
  if (!placed) { monthStatus.push(`${m}월: 배치 파일 없음`); continue; }
  const learnFile = readJson(path.join(LEARN, `growth-${m}-learn.json`));
  const learnByDay = {};
  if (learnFile) learnFile.forEach(x => { learnByDay[x.day] = x; });

  let mWith = 0;
  placed.forEach(r => {
    const L = learnByDay[r.day];
    function pack(v, slot) {
      const lb = L && L[slot] && L[slot].learn;
      if (lb) { withLearn++; mWith++; } else { withFallback++; }
      return {
        t: v.text,
        a: v.author,
        s: v.work,
        sourceUrl: v.sourceUrl,
        pt: v.technique,
        isTranslation: !!v.isTranslation,
        learn: lb || fallbackLearn(v),
        example: (lb && lb.goodExample) || ''
      };
    }
    days.push({
      doy: r.doy, month: m, day: r.day, week: r.week,
      weekTheme: r.weekTheme, techniqueFamily: r.techniqueFamily,
      contrastAxis: r.contrastAxis,
      lp: r.why || '',
      A: pack(r.A, 'A'),
      B: pack(r.B, 'B')
    });
  });
  monthStatus.push(`${m}월: ${placed.length}일 · 학습블록 ${mWith}/${placed.length * 2}`);
}

days.sort((a, b) => a.doy - b.doy);

// 기존 data-year.js 의 HEALING_YEAR 는 보존하고 GROWTH_YEAR 만 갈아 끼운다
let existing = '';
try { existing = fs.readFileSync(TARGET, 'utf8'); } catch (e) {}
const growthBlock = 'const GROWTH_YEAR = ' + JSON.stringify(days, null, 1) + ';\n'
  + 'if (typeof window !== "undefined") { window.GROWTH_YEAR = GROWTH_YEAR; }\n';

let out;
if (/const GROWTH_YEAR =/.test(existing)) {
  out = existing.replace(/const GROWTH_YEAR =[\s\S]*?window\.GROWTH_YEAR = GROWTH_YEAR; \}\n/, growthBlock);
} else {
  out = existing.trimEnd() + '\n\n' + growthBlock;
}
fs.writeFileSync(TARGET, out, 'utf8');

console.log('=== 성장편 빌드 ===');
monthStatus.forEach(s => console.log('  ' + s));
console.log('');
console.log('총 ' + days.length + '일 / ' + (days.length * 2) + '문장');
console.log('학습블록 보유 ' + withLearn + ' · 폴백 ' + withFallback);
console.log('doy 연속: ' + (days.every((d, i) => d.doy === i + 1) ? '1-' + days.length + ' 정상' : '결번 있음'));
console.log('data-year.js ' + (fs.statSync(TARGET).size / 1024).toFixed(0) + 'KB');
if (withFallback > 0) {
  console.log('\n주의: 폴백 ' + withFallback + '문장은 anatomy가 비어 있어 2단계(구조 학습) 화면이 축소된다.');
  console.log('      채점(3·4단계)은 최소 루브릭으로 동작한다.');
}
