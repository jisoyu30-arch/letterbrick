// Vercel Serverless Function — /api/score
// 레터브릭 문장 코치 AI (Claude Sonnet) — 관찰→근거→개선→예시 구조

// ── 루브릭 기본값 ────────────────────────────────────────
const DEFAULT_STEP3_RUBRIC = [
  { name: '구조 재현도', weight: 2, desc: '원문의 핵심 패턴(반복·비교·병렬 등)이 사용자 문장에 살아 있는가' },
  { name: '독창성',     weight: 2, desc: '원문 소재와 다른 자신만의 소재·장면·인물을 사용했는가' },
  { name: '완성도',     weight: 1, desc: '문장이 자연스럽고 읽는 호흡이 완결되는가' }
];
const DEFAULT_STEP4_RUBRIC = [
  { name: '생각의 선명성', weight: 2, desc: '하고 싶은 말이 문장 안에 선명하게 담겨 있는가' },
  { name: '구체성',        weight: 1, desc: '추상어 대신 장면·감각·사건으로 표현했는가' },
  { name: '마무리 여운',   weight: 2, desc: '마지막 문장이 읽고 나서도 머릿속에 남는가' }
];

// ── 루브릭 → 프롬프트 텍스트 변환 ──────────────────────
function rubricToText(rubric) {
  return rubric.map(function(r, i) {
    return `${i + 1}. ${r.name} (0~${r.weight} 벽돌)\n   기준: ${r.desc}\n   ${r.weight}벽돌: 완전히 충족 / 1벽돌: 절반 충족(weight>1일 때) / 0벽돌: 미충족`;
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
}`;
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

[피드백 구조 — 반드시 아래 5개 필드 모두 출력]
1. observation: 사용자 글에서 가장 인상적인 표현 직접 인용 + 단정한 관찰 1문장
2. evidence: 가장 인상적이거나 가장 아쉬운 표현 직접 인용 + 판단 근거 (1~2문장)
3. improvement: 무엇을 바꾸면 더 좋아지는지 (추상어 → 장면, 마무리 보완 등) 구체적으로
4. example: '사용자 표현' → '더 구체적인 버전' 형식
5. encouragement: 칭찬이 아닌 "다음 글에서 스스로 확인할 질문 1개" (예: "그 감정이 일어난 장면이 언제였는지 쓸 수 있다면?")

[절대 규칙]
- 원문에 이미 있는 단어를 "자기만의 표현"이라 칭찬하지 마세요
- "좋은 글입니다", "인상적입니다" 같은 추상적 평가 금지
- criteria의 각 comment도 사용자 문장 인용 필수

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
  "improvement": "구체적 개선 방향 (1~2문장)",
  "example": "'사용자 표현' → '더 구체적인 버전'",
  "worldMessage": "bricks 값에 맞는 세계관 메시지",
  "spellingErrors": [{"word": "틀린단어", "correction": "올바른표기", "reason": "이유"}],
  "spacingErrors": [{"context": "문맥", "suggestion": "수정안"}],
  "encouragement": "다음 글에서 스스로 확인할 질문 1개"
}`;
    }

    // ── 힐링 코치 ─────────────────────────────────────────
    else if (type === 'healing') {
      prompt = `당신은 레터브릭의 힐링 코치입니다.
사용자가 저녁 필사를 마치고 쓴 소감을 읽고, 개인화된 코칭 답변을 드립니다.

[오늘 필사한 문장]
${original}

[사용자의 오늘 소감]
${userText}

[사용자 맥락 — 과거 기록]
${learningPoint || '오늘 첫 힐링 필사'}

[코칭 원칙]
1. 사용자의 소감에서 구체적 표현을 반드시 직접 인용하세요 (따옴표 사용)
2. "잘 하셨어요", "대단해요", "훌륭해요" 같은 공허한 칭찬 금지
3. 과거 소감 기록이 있으면 변화·성장·일관성을 자연스럽게 언급하세요 ("지난번엔...", "처음과 달리...")
4. 오늘 필사 문장과 소감을 연결해서 말하세요 — 왜 이 문장이 오늘 이 사람에게 닿았는지
5. 정답이나 조언을 주기보다, 관찰이나 열린 질문으로 마무리하세요
6. 전체 2~3문장. 따뜻하되 진부하지 않게.

JSON으로만 응답:
{
  "impression": "개인화된 코치 답변 (2~3문장, 소감 직접 인용 포함)"
}`;
    }

    else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      console.error('Claude API error:', await response.text());
      return res.status(502).json({ error: 'Claude API error', fallback: true });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = codeBlock ? codeBlock[1] : text;
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(502).json({ error: 'Invalid response format', fallback: true });

    const result = JSON.parse(jsonMatch[0]);
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
