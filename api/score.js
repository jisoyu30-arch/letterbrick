// Vercel Serverless Function — /api/score
// 레터브릭 문장 코치 AI (Claude Haiku 4.5) — 관찰→근거→개선→예시 구조
// 재현성: temperature 0.2 + 창작은 2회 채점 보수 병합 + 5단계 앵커 보충 + 인용 검증

// ── 루브릭 기본값 (AI Hub 논술형·서술형 글쓰기 평가 데이터 기반) ──
const DEFAULT_STEP3_RUBRIC = [
  {
    name: '구조 재현도',
    weight: 2,
    desc: '원문의 핵심 문장 패턴(반복·비교·병렬·전환 등)이 사용자 문장에 살아 있는가',
    levels: [
      '원문 구조를 전혀 사용하지 않았다',
      '원문 구조를 부분적으로 시도했으나 형태가 어색하다',
      '원문의 핵심 구조를 사용했다',
      '원문 구조를 충실히 재현하고 자연스럽게 변형했다',
      '원문 구조를 탁월하게 재현하고 자신의 언어로 완전히 소화했다'
    ]
  },
  {
    name: '내용의 구체성',
    weight: 2,
    desc: '원문 소재와 다른 자신만의 장면·감각·인물·사건으로 표현했는가',
    levels: [
      '원문 소재를 그대로 베꼈거나 내용이 없다',
      '원문 소재와 거의 유사한 내용을 사용했다',
      '자신의 소재를 사용했으나 구체적이지 않다',
      '자신만의 구체적인 장면이나 감각으로 표현했다',
      '풍부하고 독창적인 세부 내용으로 표현했다'
    ]
  },
  {
    name: '문장의 완성도',
    weight: 1,
    desc: '문장이 어법에 맞고 읽는 호흡이 자연스럽게 완결되는가',
    levels: [
      '문장이 어색하고 의미 전달이 되지 않는다',
      '문장이 부분적으로 어색하다',
      '문장이 자연스럽게 읽힌다',
      '문장이 매끄럽고 호흡이 좋다',
      '문장이 수려하고 완성도가 뛰어나다'
    ]
  }
];

const DEFAULT_STEP4_RUBRIC = [
  {
    name: '주제의 선명성',
    weight: 2,
    desc: '하고 싶은 말이 문장 안에 명확하게 담겨 있는가',
    levels: [
      '전달하려는 주제나 정서가 드러나지 않는다',
      '주제가 있으나 불분명하다',
      '전달하려는 주제와 정서가 드러난다',
      '주제와 정서가 선명하게 드러난다',
      '깊이 있는 해석을 바탕으로 주제와 정서가 탁월하게 드러난다'
    ]
  },
  {
    name: '표현의 구체성',
    weight: 2,
    desc: '추상어 대신 장면·감각·사건으로 구체적으로 표현했는가',
    levels: [
      '추상적 표현만 있고 구체적 장면이 없다',
      '구체적 표현을 시도했으나 미흡하다',
      '구체적인 세부 내용을 들어 표현했다',
      '다양하고 구체적인 장면·감각으로 표현했다',
      '풍부하고 독창적인 세부 표현으로 깊이 있게 표현했다'
    ]
  },
  {
    name: '글의 통일성',
    weight: 1,
    desc: '글 전체가 하나의 감정이나 주제를 향해 일관되게 흐르는가',
    levels: [
      '글 전체의 통일성이 없고 흐름이 뒤섞인다',
      '일관성이 부족해 글이 산만하다',
      '전체적으로 일관성이 있으나 부분적으로 흐름이 흔들린다',
      '글의 대부분이 일관된 주제와 정서로 연결되어 있다',
      '글 전체가 하나의 정서·주제를 향해 완벽하게 일관되어 있다'
    ]
  },
  {
    name: '마무리 여운',
    weight: 1,
    desc: '마지막 문장이 읽고 나서도 머릿속에 남는가',
    levels: [
      '마무리가 없거나 글이 갑자기 끊긴다',
      '마무리가 있으나 인상이 약하다',
      '글이 자연스럽게 마무리된다',
      '마지막 문장이 여운을 남긴다',
      '마지막 문장이 글 전체를 빛나게 하는 통찰로 마무리된다'
    ]
  }
];

// ── 5단계 앵커 은행 — 클라이언트 루브릭에 levels가 없을 때 항목명으로 보충 ──
// data.js 루브릭은 desc만 있고 levels가 없어서, 같은 글도 호출마다 점수가 흔들렸다.
// 항목명에 키워드가 포함되면 해당 앵커를 붙여 채점 스케일을 고정한다.
const LEVEL_BANK = [
  { key: '기법', levels: [
    '오늘 기법의 흔적이 없거나 원문을 그대로 옮겼다',
    '기법을 흉내 냈으나 형태만 남고 뜻이 살지 않았다',
    '기법을 시도했고 알아볼 수 있다',
    '기법이 자기 소재 안에서 자연스럽게 작동한다',
    '기법이 문장의 뼈대가 되어 원문 없이도 홀로 선다'
  ]},
  { key: '선명성', levels: DEFAULT_STEP4_RUBRIC[0].levels },
  { key: '구체성', levels: DEFAULT_STEP4_RUBRIC[1].levels },
  { key: '통일성', levels: DEFAULT_STEP4_RUBRIC[2].levels },
  { key: '여운',   levels: DEFAULT_STEP4_RUBRIC[3].levels },
  { key: '진정성', levels: [
    '빌려온 말로만 채워져 있다',
    '자기 경험처럼 보이려 하나 겉돈다',
    '자기 경험에서 나온 대목이 한 곳 있다',
    '경험의 세부가 문장을 끌고 간다',
    '꾸미지 않은 고백이 문장 전체를 지탱한다'
  ]},
  { key: '재현', levels: DEFAULT_STEP3_RUBRIC[0].levels },
  { key: '완성도', levels: DEFAULT_STEP3_RUBRIC[2].levels }
];
function withLevels(rubric) {
  return rubric.map(r => {
    if (r.levels && r.levels.length) return r;
    const hit = LEVEL_BANK.find(b => String(r.name || '').includes(b.key));
    return hit ? { ...r, levels: hit.levels } : r;
  });
}

// ── 인용 검증 — 코멘트가 사용자 문장의 실제 구절을 담고 있는지 ──
// 공백을 제거한 뒤 6글자 이상 연속 일치가 있으면 인용으로 본다.
function sharesPhrase(comment, source, minLen = 6) {
  const c = String(comment || '').replace(/\s+/g, '');
  const s = String(source || '').replace(/\s+/g, '');
  if (!c || !s) return false;
  if (s.length <= minLen) return c.includes(s);
  for (let i = 0; i + minLen <= s.length; i++) {
    if (c.includes(s.slice(i, i + minLen))) return true;
  }
  return false;
}

// ── 2회 채점 병합 — 항목별로 낮은 쪽 채택, 산문 필드는 총점이 낮은 회차에서 ──
function mergeConservative(a, b) {
  const byName = {};
  (a.criteria || []).forEach(c => { byName[c.name] = { a: c }; });
  (b.criteria || []).forEach(c => { (byName[c.name] = byName[c.name] || {}).b = c; });
  const criteria = Object.keys(byName).map(n => {
    const { a: ca, b: cb } = byName[n];
    if (!ca) return cb;
    if (!cb) return ca;
    return (cb.bricks || 0) < (ca.bricks || 0) ? cb : ca;
  });
  const sum = r => (r.criteria || []).reduce((s, c) => s + (c.bricks || 0), 0);
  const base = sum(b) < sum(a) ? b : a;
  return { ...base, criteria, scoringPasses: 2 };
}

// ── Claude 호출 + JSON 추출 ──
async function callClaude(prompt, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      temperature: 0.2, // 재현성 — 같은 글이면 같은 점수에 가깝게
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    const err = new Error('Claude API error');
    err.status = response.status; err.detail = errText;
    throw err;
  }
  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1] : text;
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) { const e = new Error('Invalid response format'); e.raw = text; throw e; }
  try { return JSON.parse(jsonMatch[0]); }
  catch (pe) { const e = new Error('JSON parse error'); e.raw = text; throw e; }
}

// ── 루브릭 → 프롬프트 텍스트 변환 (5단계 기준 포함) ──
function rubricToText(rubric) {
  return withLevels(rubric).map(function(r, i) {
    const levelText = r.levels
      ? r.levels.map((l, li) => `     ${li + 1}단계: ${l}`).join('\n')
      : '';
    return `${i + 1}. ${r.name} (0~${r.weight} 벽돌)\n   평가 기준: ${r.desc}\n${levelText}\n   → ${r.weight}벽돌: 4~5단계 / ${r.weight > 1 ? '1벽돌: 3단계 / ' : ''}0벽돌: 1~2단계`;
  }).join('\n\n');
}

// ── worldMessage 매핑 ─────────────────────────────────
function worldMsg(bricks) {
  const map = {
    5: '오늘 벽 한 칸이 완성됐어요!',
    4: '거의 다 왔어요. 한 칸이 채워지고 있어요',
    3: '기초가 탄탄해요. 다음엔 더 높이 쌓아봐요',
    2: '재료가 조금씩 쌓이고 있어요',
    1: '시작이 반이에요. 기법을 다시 써봐요',
    0: '아직 재료가 부족해요. 오늘 기법으로 다시 도전해봐요'
  };
  return map[bricks] || map[0];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key missing', fallback: true });

  try {
    const { type, original, userText, learningPoint, rubric } = req.body;
    if (!type || !original || !userText) {
      return res.status(400).json({ error: 'Missing fields: type, original, userText' });
    }

    // 공통 단어 / 신규 단어 추출
    const punct = /[.,!?"""''·「」『』\-—()~：:;]/g;
    const funcWords = new Set(['은','는','이','가','을','를','의','와','과','에','에서','로','으로','도','만','까지','부터','처럼','같이','보다','한','그','저','더','매우','아주','정말','너무','좀','다','안','못','잘','또','그리고','하지만','그런데','때문에']);
    const origTokens = original.replace(punct,'').split(/\s+/).filter(w => w.length >= 2);
    const userTokens = userText.replace(punct,'').split(/\s+/).filter(w => w.length >= 2);
    const origSet = new Set(origTokens);
    const sharedWords = [...new Set(userTokens.filter(w => origSet.has(w) && !funcWords.has(w)))].slice(0,8);
    const newWords = [...new Set(userTokens.filter(w => !origSet.has(w) && !funcWords.has(w)))].slice(0,8);

    let prompt;

    // ── 따라쓰기 ─────────────────────────────────────────
    if (type === 'copy') {
      prompt = `당신은 레터브릭의 문장 코치입니다.
사용자가 원문을 필사한 결과를 분석합니다.

[절대 규칙]
- 달라진 부분을 정확히 인용하세요
- 키보드 실수로 보이는 오류는 "키 실수 같네요"라고만 하세요
- 막연한 격려("잘 하셨어요") 금지
- 틀린 부분이 없으면 원문의 문장 기법 1개를 짚어주세요
- feedback은 80자 이내

원문: ${original}
사용자 입력: ${userText}

JSON으로만 응답:
{
  "accuracy": 0-100,
  "errors": [{"position": 숫자, "original": "원래글자", "user": "사용자글자", "type": "오타|누락|추가"}],
  "feedback": "달라진 부분 인용 포함, 80자 이내"
}`;
    }

    // ── 구조 연습 ─────────────────────────────────────────
    else if (type === 'structure') {
      const step3Rubric = (rubric && rubric.length) ? rubric : DEFAULT_STEP3_RUBRIC;
      const maxBricks = step3Rubric.reduce((s, r) => s + r.weight, 0);
      const rubricText = rubricToText(step3Rubric);

      prompt = `당신은 레터브릭의 문장 코치입니다.
레터브릭은 "벽돌을 모아 집을 짓는" 세계관의 글쓰기 훈련 서비스입니다.
사용자는 오늘 배운 문장 기법으로 원문을 변형한 문장을 제출했습니다.

[오늘 학습 내용]
${learningPoint || ''}

[평가 기준 — 각 항목별 벽돌 개수 결정]
${rubricText}

[참고 — 원문과 사용자 문장의 단어 비교]
- 공통 단어: ${sharedWords.join(', ') || '없음'}
- 사용자의 새 단어: ${newWords.join(', ') || '없음'}

[피드백 구조 — 반드시 아래 4개 필드 모두 출력]
1. observation: 사용자가 무엇을 시도했는지 1문장 요약 (사용자 문장 전체 인용 포함)
2. evidence: 사용자 문장에서 직접 인용한 구절 + 왜 그렇게 판단했는지 근거 (1~2문장)
3. improvement: 무엇을 바꾸면 더 좋아지는지 구체적으로 (1~2문장)
4. example: 반드시 '사용자 문장 일부' → '개선된 버전' 형식으로

[절대 규칙]
- 원문에 이미 있는 단어를 "새로운 표현"이라 칭찬하지 마세요
- 모든 비평은 사용자 문장을 직접 인용하고 판단 근거를 제시하세요
- "좋은 시도입니다", "인상적입니다" 같은 추상적 평가 금지
- criteria의 각 comment도 반드시 사용자 문장 일부를 인용하세요

원문: ${original}
사용자 변형: ${userText}

JSON으로만 응답:
{
  "bricks": 0-${maxBricks} (각 기준 합계),
  "maxBricks": ${maxBricks},
  "criteria": [
    ${step3Rubric.map(r => `{"name": "${r.name}", "bricks": 0-${r.weight}, "max": ${r.weight}, "comment": "사용자 문장 일부 인용 포함한 구체적 코멘트"}`).join(',\n    ')}
  ],
  "observation": "사용자가 시도한 것 1문장 (문장 인용 포함)",
  "evidence": "사용자 문장 직접 인용 + 판단 근거 (1~2문장)",
  "improvement": "구체적 개선 방향 (1~2문장)",
  "example": "'사용자 문장 일부' → '개선된 버전'",
  "worldMessage": "${worldMsg(3)} 형식으로 bricks 값에 맞게",
  "spellingErrors": [{"word": "틀린단어", "correction": "올바른표기", "reason": "이유"}],
  "spacingErrors": [{"context": "문맥", "suggestion": "수정안"}]
}
[맞춤법 검수 원칙 — AI Hub 051·143 데이터 기반]
- 잡아야 할 오류: 오타(떄→때, 됬→됐), 붙여쓰기(고싶→고 싶, 수있→수 있, 안해→안 해)
- 과교정 금지: 구어체·방언·의도적 반복·리듬을 위한 문장 부호는 오류로 보지 마세요
- 창의적 선택(주어 생략, 비표준 어순, 감탄사)은 지적하지 마세요
- 확실한 오류만 spellingErrors에 넣고, 불확실하면 빈 배열로 두세요`;
    }

    // ── 창의적 글쓰기 ─────────────────────────────────────
    else if (type === 'creative') {
      const step4Rubric = (rubric && rubric.length) ? rubric : DEFAULT_STEP4_RUBRIC;
      const maxBricks = step4Rubric.reduce((s, r) => s + r.weight, 0);
      const rubricText = rubricToText(step4Rubric);

      prompt = `당신은 레터브릭의 문장 코치입니다.
레터브릭은 "벽돌을 모아 집을 짓는" 세계관의 글쓰기 훈련 서비스입니다.
사용자가 오늘 배운 문장에서 영감을 받아 쓴 창작 글을 읽습니다.

[오늘 학습 내용]
${learningPoint || ''}

[평가 기준 — 각 항목별 벽돌 개수 결정]
${rubricText}

[참고 — 원문과 사용자 문장의 단어 비교]
- 공통 단어: ${sharedWords.join(', ') || '없음'}
- 사용자의 새 단어: ${newWords.join(', ') || '없음'}

[피드백 구조 — 반드시 아래 4개 필드 모두 출력]
1. observation: 사용자 글에서 가장 인상적인 표현 직접 인용 + 단정한 관찰 1문장
2. evidence: 가장 인상적이거나 가장 아쉬운 표현 직접 인용 + 판단 근거 (1~2문장)
3. improvement: 힌트 — 어느 대목을 다시 보면 좋을지 방향만 (1~2문장). 문장을 대신 고쳐 쓰지 마세요. "여기서 ___를 장면으로 바꾼다면" 같은 가정형으로.
4. encouragement: 칭찬이 아닌 "다음 글에서 스스로 확인할 질문 1개" (예: "그 감정이 일어난 장면이 언제였는지 쓸 수 있다면?")

[절대 규칙]
- 원문에 이미 있는 단어를 "자기만의 표현"이라 칭찬하지 마세요
- "좋은 글입니다", "인상적입니다" 같은 추상적 평가 금지
- criteria의 각 comment는 사용자 문장 구절을 먼저 따옴표로 인용한 뒤 판정을 쓰세요 (인용 → 판정 순서)
- '여운' 항목의 comment는 객관 판정이 아니라 독자 한 사람의 감상으로 쓰세요 — "저에게는 ~가 남았습니다" 같은 1인칭
- 사용자 문장을 고쳐 쓴 '더 나은 버전'을 어디에도 제시하지 마세요 — 창작은 사용자 몫입니다

원문: ${original}
사용자 창작: ${userText}

JSON으로만 응답:
{
  "bricks": 0-${maxBricks} (각 기준 합계),
  "maxBricks": ${maxBricks},
  "criteria": [
    ${step4Rubric.map(r => `{"name": "${r.name}", "bricks": 0-${r.weight}, "max": ${r.weight}, "comment": "사용자 문장 일부 인용 포함한 구체적 코멘트"}`).join(',\n    ')}
  ],
  "observation": "가장 인상적 표현 직접 인용 + 관찰 (1문장)",
  "evidence": "직접 인용 + 판단 근거 (1~2문장)",
  "improvement": "힌트 — 다시 볼 대목과 방향만, 고쳐 쓰기 금지 (1~2문장)",
  "worldMessage": "bricks 값에 맞는 세계관 메시지",
  "spellingErrors": [{"word": "틀린단어", "correction": "올바른표기", "reason": "이유"}],
  "spacingErrors": [{"context": "문맥", "suggestion": "수정안"}],
  "encouragement": "다음 글에서 스스로 확인할 질문 1개"
}
[맞춤법 검수 원칙 — AI Hub 051·143 데이터 기반]
- 잡아야 할 오류: 오타(떄→때, 됬→됐), 붙여쓰기(고싶→고 싶, 수있→수 있, 안해→안 해)
- 과교정 금지: 구어체·방언·의도적 반복·리듬을 위한 문장 부호는 오류로 보지 마세요
- 창의적 선택(주어 생략, 비표준 어순, 감탄사)은 지적하지 마세요
- 확실한 오류만 spellingErrors에 넣고, 불확실하면 빈 배열로 두세요`;
    }

    // ── 힐링 코치 (사유 확장) ────────────────────────────
    else if (type === 'healing') {
      prompt = `당신은 레터브릭의 사유 코치입니다.
사용자가 오늘의 문단을 필사한 뒤, 제시된 질문에 답을 썼습니다.
당신의 역할은 공감·위로가 아니라, 사용자의 사유를 한 겹 더 깊이 열어주는 것입니다.

[오늘 필사한 문단]
${original}

[오늘의 질문과 사용자 맥락]
${learningPoint || '오늘 첫 힐링 필사'}

[사용자의 답]
${userText}

[코칭 원칙]
1. 사용자의 답에서 가장 핵심적인 표현을 직접 인용하세요 (따옴표 사용)
2. "잘 쓰셨어요", "공감해요", "따뜻하네요" 같은 감정 반영·칭찬 금지
3. 사용자가 답 안에서 스스로 알아차리지 못한 것을 짚어주세요
4. 오늘 필사 문단과 사용자의 답을 연결해 — 이 문단이 왜 이 답을 이끌어냈는지를 짚으세요
5. 마지막 문장은 사유를 정리하는 통찰 또는 선명한 관찰로 끝내세요 (질문 금지)
6. 전체 3문장 이내. 선명하고 정확하게.

[절대 규칙]
- 위로나 격려가 아닌 '사유의 확장'이 목적입니다
- 사용자의 답에 이미 있는 말을 그대로 돌려주지 마세요
- 마지막 문장을 질문으로 끝내지 마세요 — 통찰로 마무리하세요

JSON으로만 응답:
{
  "impression": "사유 확장 코칭 (3문장 이내, 답변 직접 인용 + 통찰로 마무리)"
}`;
    }

    else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    // 창작 채점은 2회 병렬 호출 후 보수적으로 병합 (SCORE_DOUBLE_PASS=0 이면 1회)
    const doublePass = type === 'creative' && process.env.SCORE_DOUBLE_PASS !== '0';
    let result;
    try {
      if (doublePass) {
        const settled = await Promise.allSettled([callClaude(prompt, apiKey), callClaude(prompt, apiKey)]);
        const ok = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
        if (ok.length === 0) throw settled[0].reason;
        result = ok.length === 2 ? mergeConservative(ok[0], ok[1]) : { ...ok[0], scoringPasses: 1 };
      } else {
        result = await callClaude(prompt, apiKey);
        if (type === 'creative' || type === 'structure') result.scoringPasses = 1;
      }
    } catch (err) {
      console.error('Claude call failed:', err.message, err.status || '', (err.detail || err.raw || '').slice(0, 500));
      if (err.status) return res.status(502).json({ error: 'Claude API error', status: err.status, detail: err.detail, fallback: true });
      return res.status(502).json({ error: err.message, rawText: (err.raw || '').slice(0, 800), fallback: true });
    }

    // criteria 누락 항목 자동 보완 (structure / creative 타입)
    const activeRubric = type === 'structure'
      ? ((rubric && rubric.length) ? rubric : DEFAULT_STEP3_RUBRIC)
      : type === 'creative'
        ? ((rubric && rubric.length) ? rubric : DEFAULT_STEP4_RUBRIC)
        : null;

    if (activeRubric && Array.isArray(result.criteria)) {
      const existingNames = result.criteria.map(c => c.name);
      activeRubric.forEach(r => {
        if (!existingNames.includes(r.name)) {
          result.criteria.push({
            name: r.name,
            bricks: 0,
            max: r.weight,
            comment: '평가 항목이 누락되었습니다.'
          });
        }
      });
      // 인용 검증 — 사용자 문장 구절이 코멘트에 없으면 cited:false 로 표시
      result.criteria.forEach(c => { c.cited = sharesPhrase(c.comment, userText); });
      result.uncitedCount = result.criteria.filter(c => !c.cited).length;
      // maxBricks 및 bricks 재계산
      result.maxBricks = activeRubric.reduce((s, r) => s + r.weight, 0);
      result.bricks = result.criteria.reduce((s, c) => s + (c.bricks || 0), 0);
    }

    // worldMessage 보정 (AI가 틀릴 경우)
    if (typeof result.bricks === 'number') {
      result.worldMessage = worldMsg(result.bricks);
    }
    return res.status(200).json(result);

  } catch (e) {
    console.error('Score API error:', e);
    return res.status(500).json({ error: e.message, fallback: true });
  }
}
