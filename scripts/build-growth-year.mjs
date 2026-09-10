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

// 성장편은 일자별 파일로 쪼갠다.
// 성장편 인덱싱은 가입일 기준이라 사용자의 day N이 1-365 어디든 될 수 있어
// "이번 달만 로드"가 성립하지 않는다. 하루치만 받는 것이 유일하게 맞는 구조다.
const outDir = path.join(ROOT, 'public', 'growth');
fs.mkdirSync(outDir, { recursive: true });
// 이전 산출물 정리
for (const f of fs.readdirSync(outDir)) {
  if (/^\d{3}\.json$/.test(f)) fs.unlinkSync(path.join(outDir, f));
}
let bytes = 0;
days.forEach(d => {
  const name = String(d.doy).padStart(3, '0') + '.json';
  const body = JSON.stringify(d);
  fs.writeFileSync(path.join(outDir, name), body, 'utf8');
  bytes += Buffer.byteLength(body, 'utf8');
});

// data-year.js 에서 GROWTH_YEAR 블록은 제거하고, 목차만 남긴다
let existing = '';
try { existing = fs.readFileSync(TARGET, 'utf8'); } catch (e) {}
const NL = String.fromCharCode(10);
existing = existing.replace(/const GROWTH_YEAR =[\s\S]*?window\.GROWTH_YEAR = GROWTH_YEAR; \}/, '');
existing = existing.replace(/const GROWTH_INDEX =[\s\S]*?window\.GROWTH_INDEX = GROWTH_INDEX; \}/, '');
const index = days.map(d => ({
  doy: d.doy, week: d.week, weekTheme: d.weekTheme,
  fam: d.techniqueFamily, hasLearn: !d.A.learn._fallback && !d.B.learn._fallback
}));
const indexBlock = NL
  + 'const GROWTH_INDEX = ' + JSON.stringify(index) + ';' + NL
  + 'if (typeof window !== "undefined") { window.GROWTH_INDEX = GROWTH_INDEX; }' + NL;
fs.writeFileSync(TARGET, existing.trimEnd() + NL + indexBlock, 'utf8');

console.log('=== 성장편 빌드 ===');
monthStatus.forEach(s => console.log('  ' + s));
console.log('');
console.log('총 ' + days.length + '일 / ' + (days.length * 2) + '문장');
console.log('학습블록 보유 ' + withLearn + ' · 폴백 ' + withFallback);
console.log('doy 연속: ' + (days.every((d, i) => d.doy === i + 1) ? '1-' + days.length + ' 정상' : '결번 있음'));
console.log('일자별 파일 ' + days.length + '개, 평균 ' + Math.round(bytes / days.length / 1024 * 10) / 10 + 'KB, 총 ' + Math.round(bytes / 1024) + 'KB');
console.log('data-year.js ' + (fs.statSync(TARGET).size / 1024).toFixed(0) + 'KB (힐링 365일 + 성장 목차)');
if (withFallback > 0) {
  console.log('');
  console.log('폴백 ' + withFallback + '문장은 anatomy가 비어 2단계(구조 학습)가 축소된다.');
  console.log('채점(3·4단계)은 최소 루브릭으로 동작한다. GROWTH_INDEX.hasLearn 으로 구분 가능.');
}
