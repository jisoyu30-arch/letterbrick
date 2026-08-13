/**
 * 레터브릭 — PD 번역 초안 AI 사전 검수 (S2a)
 *
 * pd-sentences-100.json에서 translationNote가 draft/convergent인 항목을
 * 하담 스타일 역설계 문서(R1-R15) 기준으로 검사해 위험도를 매긴다.
 * 결과는 감수 콘솔(tools/review-console.html)이 읽는 translation-review.json과
 * 사람이 읽는 translation-review.md로 저장한다.
 *
 * 사용법:
 *   node scripts/review-translations.cjs                # 전체 draft 검수
 *   node scripts/review-translations.cjs --limit=3      # 앞에서 3건만 (테스트)
 *   node scripts/review-translations.cjs --include-convergent
 *
 * 필요: ANTHROPIC_API_KEY (.env 또는 환경변수)
 */

const fs = require('fs');
const path = require('path');

// ── 설정 ────────────────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const PD_JSON = path.join(ROOT, 'data', 'pd-sentences-100', 'pd-sentences-100.json');
const OUT_JSON = path.join(ROOT, 'data', 'pd-sentences-100', 'translation-review.json');
const OUT_MD = path.join(ROOT, 'data', 'pd-sentences-100', 'translation-review.md');
const STYLE_DOC = 'C:\\Users\\njell\\kim-secretary\\engine-shared\\context-packs\\author-style\\하담-스타일-역설계.md';
const MODEL = 'claude-sonnet-4-6'; // 문체 판정은 haiku보다 sonnet — 채점(api/score.js)과 달리 배치 1회성이라 비용 부담 적음
const BATCH_SIZE = 6;

// ── .env 로드 (외부 패키지 없이) ─────────────────────────────────────────────
function loadEnv() {
  if (process.env.ANTHROPIC_API_KEY) return;
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

// ── Claude API 호출 ─────────────────────────────────────────────────────────
async function callClaude(system, user) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`API ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.content[0].text;
}

// ── JSON 응답 파싱 (코드펜스 허용) ───────────────────────────────────────────
function parseJson(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = m ? m[1] : text;
  return JSON.parse(raw.slice(raw.indexOf('[')));
}

// ── 검수 프롬프트 ────────────────────────────────────────────────────────────
function buildSystem(styleDoc) {
  return `너는 한국어 문학 번역 감수자다. 아래는 감수 기준이 되는 문체 역설계 문서다.

${styleDoc}

역할: 퍼블릭 도메인 외국 문학의 한국어 번역 초안을 검수한다. 이 번역문은 필사 훈련 앱에 수록될 문장이므로, (1) 원문 의미 충실성 (2) 한국어 문장의 자연스러움·리듬 (3) 필사할 가치가 있는 문장인가를 본다.

각 항목에 대해 JSON으로만 답한다:
[{"id": "...", "risk": "high|medium|low", "flags": ["직역투", "리듬 붕괴", "조사 어색", "의미 훼손 의심", "어휘 시대착오", ...], "reason": "한 줄 근거 — 반드시 번역문에서 직접 인용", "suggestion": "개선 번역 제안 (문제 없으면 null)"}]

판정 기준:
- high: 그대로 수록하면 안 됨 — 의미 훼손, 심한 직역투, 비문
- medium: 수록 가능하나 다듬으면 좋아짐 — 리듬·어순·어휘 선택
- low: 그대로 수록해도 좋음
근거 없는 지적 금지. 문제가 없으면 low로 판정하고 suggestion은 null.`;
}

function buildUser(items) {
  const lines = items.map((s) => ({
    id: s.id,
    원문: s.textOriginal || '(원문 없음 — 한문/중역 확인)',
    언어: s.language,
    번역초안: s.text,
    작가: s.author,
    작품: s.work,
  }));
  return `다음 번역 초안 ${items.length}건을 검수하라:\n\n${JSON.stringify(lines, null, 1)}`;
}

// ── 메인 ────────────────────────────────────────────────────────────────────
async function main() {
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY 없음 — .env 확인');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
  const includeConvergent = args.includes('--include-convergent');

  const db = JSON.parse(fs.readFileSync(PD_JSON, 'utf8'));
  const styleDoc = fs.readFileSync(STYLE_DOC, 'utf8');

  const notes = includeConvergent ? ['draft', 'convergent'] : ['draft'];
  const targets = db.sentences
    .filter((s) => notes.includes(s.translationNote))
    .slice(0, limit);

  console.log(`검수 대상 ${targets.length}건 (${notes.join('/')}) — 모델 ${MODEL}`);

  const system = buildSystem(styleDoc);
  const results = [];
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    process.stdout.write(`  배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(targets.length / BATCH_SIZE)} (${batch.map((b) => b.id).join(',')}) ... `);
    let parsed = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const text = await callClaude(system, buildUser(batch));
        parsed = parseJson(text);
        break;
      } catch (e) {
        console.log(`재시도 ${attempt} (${e.message.slice(0, 80)})`);
        if (attempt === 3) throw e;
      }
    }
    // id 매칭 검증 — 응답 누락 항목은 unreviewed로 표시
    for (const item of batch) {
      const r = parsed.find((p) => p.id === item.id);
      results.push(r || { id: item.id, risk: 'medium', flags: ['응답 누락'], reason: 'AI 응답에 항목 누락 — 수동 확인', suggestion: null });
    }
    console.log('완료');
  }

  // 결과 저장 — risk 순 정렬 (high → medium → low)
  const order = { high: 0, medium: 1, low: 2 };
  results.sort((a, b) => order[a.risk] - order[b.risk]);

  const output = {
    meta: { reviewedAt: new Date().toISOString().slice(0, 10), model: MODEL, count: results.length },
    reviews: results,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2), 'utf8');

  // 마크다운 리포트
  const byId = Object.fromEntries(db.sentences.map((s) => [s.id, s]));
  const md = [
    `# 번역 초안 AI 사전 검수 리포트`,
    ``,
    `검수일: ${output.meta.reviewedAt} · 모델: ${MODEL} · ${results.length}건`,
    ``,
    `| 위험 | 건수 |`,
    `|---|---:|`,
    `| high | ${results.filter((r) => r.risk === 'high').length} |`,
    `| medium | ${results.filter((r) => r.risk === 'medium').length} |`,
    `| low | ${results.filter((r) => r.risk === 'low').length} |`,
    ``,
  ];
  for (const r of results) {
    const s = byId[r.id];
    md.push(`## ${r.risk.toUpperCase()} — ${r.id} · ${s.author} 「${s.work}」`);
    md.push(``);
    if (s.textOriginal) md.push(`> 원문: ${s.textOriginal}`);
    md.push(`> 초안: ${s.text}`);
    md.push(``);
    md.push(`- 플래그: ${(r.flags || []).join(', ') || '없음'}`);
    md.push(`- 근거: ${r.reason}`);
    if (r.suggestion) md.push(`- 제안: ${r.suggestion}`);
    md.push(``);
  }
  fs.writeFileSync(OUT_MD, md.join('\n'), 'utf8');

  console.log(`\n저장: ${path.relative(ROOT, OUT_JSON)}, ${path.relative(ROOT, OUT_MD)}`);
  console.log(`high ${results.filter((r) => r.risk === 'high').length} / medium ${results.filter((r) => r.risk === 'medium').length} / low ${results.filter((r) => r.risk === 'low').length}`);
}

main().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
