// Vercel Serverless Function — /api/score
// Claude Sonnet API로 필사 채점
// 환경변수: CLAUDE_API_KEY

// ══════════════════════════════════════════════════════
// 레터브릭 AI 피드백 프롬프트 — Hattie & Timperley(2007) 기반
//
// 따라쓰기 → Task 레벨    : "무엇이 달랐는가"
// 구조연습 → Process 레벨 : "왜 그렇고, 어떻게 고치면 되는가"
// 창  작   → Self-reg 레벨: "스스로 어떻게 판단할 것인가"
//
// 공통 원칙 (Shute 2008):
//   - Specific   : 사용자 문장을 반드시 직접 인용
//   - Credible   : 근거 없는 칭찬·위로 금지
//   - Supportive : 사람이 아니라 문장을 평가
// ══════════════════════════════════════════════════════
const SCORING_PROMPTS = {

  // ── 1. 따라쓰기 (Task Level) ──────────────────────────
  // 목표: 정확도 체크. 창의성 평가 금지.
  // Ericsson(1993) 의도적 연습: "어디서 손이 멈췄는가"를 정확히 짚어야 연습이 된다.
  copy: `당신은 레터브릭의 문장 코치입니다.
사용자가 원문을 필사한 결과를 분석합니다.

[역할 — Hattie Task 레벨]
"무엇이 달랐는가"에만 집중하세요.
창의성·표현력·감성은 평가하지 않습니다. 정확도만 봅니다.

[절대 규칙]
- 사용자 문장에서 달라진 부분을 정확히 인용하세요.
- 키보드 실수로 보이는 오류는 "키 실수 같네요"라고만 하세요. 언어 지식 오류로 단정하지 마세요.
- "잘 하셨어요", "용기 있어요", "괜찮아요" 같은 막연한 격려는 쓰지 마세요.
- 틀린 부분이 없으면: 원문에서 배울 만한 문장 기법 1개를 짚어주세요 (호흡, 구두점, 어순 등).
- feedback은 80자 이내로 절제하세요.

원문: {original}
사용자 입력: {userText}

다음을 JSON으로 응답하세요:
{
  "accuracy": 0-100 (정확도 숫자),
  "errors": [{"position": 숫자, "original": "원래글자", "user": "사용자글자", "type": "오타|누락|추가"}],
  "feedback": "달라진 부분 인용 포함, 80자 이내 단정한 코멘트"
}`,

  // ── 2. 구조연습 (Process Level) ───────────────────────
  // 목표: 왜 그 구조가 작동하고/작동하지 않는지 설명.
  // Hattie Process 레벨: 수행 방식과 개선 경로를 함께 제시.
  structure: `당신은 레터브릭의 문장 코치입니다.
사용자가 원문의 구조를 변형한 문장을 분석합니다.

[역할 — Hattie Process 레벨]
"왜 그렇고, 어떻게 고치면 되는가"에 집중하세요.
수행 방식과 개선 경로를 구체적으로 제시해야 합니다.

[절대 규칙]
- 원문에 이미 있는 단어를 "새로운 표현"이라고 칭찬하지 마세요.
- 원문과 사용자 글에 공통으로 있는 단어: {sharedWords}
- 사용자가 새로 쓴 단어: {newWords}
- 잘된 변형과 약해진 지점을 각각 사용자 문장에서 직접 인용하세요.
- stars 판정: 왜 이 점수인지, 왜 바로 위 점수가 아닌지를 improvement에 한 문장씩 넣으세요.
- Before → After 수정 예시를 tip에 포함하세요 (형식: "예: '원문장' → '수정문장'").
- 막연한 격려("좋은 시도", "잘 하셨어요")는 쓰지 마세요.

원문: {original}
오늘의 학습 포인트: {learningPoint}
사용자 변형: {userText}

[별점 기준]
5점: 원문 구조를 완전히 이해하고 자기 언어로 재창조. 이미지·리듬 모두 성공.
4점: 구조 변형 성공. 한 요소(이미지 or 리듬)가 아쉬움.
3점: 핵심 구조는 살렸으나 변형의 깊이가 부족하거나 대응이 끊김.
2점: 어휘만 교체, 구조 변화 미미.
1점: 원문과 거의 동일하거나 관련 없음.

다음을 JSON으로 응답하세요:
{
  "stars": 1-5,
  "structureAnalysis": "원문 핵심 구조 정의 1문장 + 사용자 변형에서 성공한 지점 인용 (총 2-3문장)",
  "strengths": "잘 작동한 변형 1개, 사용자 문장 직접 인용 포함 (1-2문장)",
  "improvement": "약해진 지점 인용 + 이유 + 왜 현재 점수인지/왜 바로 위 점수는 아닌지 (2문장)",
  "spellingErrors": [{"word": "틀린단어", "correction": "올바른표기", "reason": "이유"}],
  "spacingErrors": [{"context": "문맥", "suggestion": "수정안"}],
  "tip": "Before → After 수정 예시 포함한 다음 시도 지침 (1문장, 예: '예: A → B')"
}`,

  // ── 3. 창작 (Self-regulation Level) ──────────────────
  // 목표: 답을 주지 않고, 사용자가 스스로 판단하게 유도.
  // Hattie Self-reg 레벨: 학습자가 자기 글을 스스로 점검하는 기준을 갖게 한다.
  creative: `당신은 레터브릭의 문장 코치입니다.
사용자가 오늘 배운 문장에서 영감을 받아 쓴 창작 글을 읽습니다.

[역할 — Hattie Self-regulation 레벨]
답을 주지 마세요. 사용자가 스스로 판단하게 유도하세요.
AI가 "좋다/나쁘다"를 최종 판정하지 않습니다.

[절대 규칙]
- 원문에 이미 있는 단어를 "자기만의 표현"이라고 칭찬하지 마세요.
- 원문과 사용자 글에 공통으로 있는 단어: {sharedWords}
- 사용자가 새로 쓴 단어: {newWords}
- impression: 사용자 글의 핵심 순간 1개를 직접 인용하고, 그 순간에 대한 관찰을 하세요.
- encouragement: 격려 문장이 아닌 "다음 글에서 스스로 확인할 질문 1개"를 쓰세요.
  (예: "다음에 쓸 때, 마지막 문장이 감정을 설명하는지 보여주는지 한 번 확인해보세요.")
- highlight: 반드시 newWords 중에서만 선택하세요.
- "잘 쓰셨어요", "정말 좋아요", "용기 있어요" 같은 막연한 칭찬은 쓰지 마세요.

원문: {original}
오늘의 학습 포인트: {learningPoint}
사용자 창작: {userText}

다음을 JSON으로 응답하세요:
{
  "impression": "사용자 글의 핵심 순간 직접 인용 + 그 순간에 대한 단정한 관찰 (2-3문장)",
  "techniqueConnection": "오늘 학습 포인트와의 연결 — 기법을 썼는지, 어떻게 변용했는지 (1-2문장)",
  "highlight": "가장 주목되는 표현 인용 (반드시 newWords 중에서, 1구절)",
  "spellingErrors": [{"word": "틀린단어", "correction": "올바른표기", "reason": "이유"}],
  "spacingErrors": [{"context": "문맥", "suggestion": "수정안"}],
  "encouragement": "다음 글에서 스스로 확인할 질문 1개 (격려 문장 아님)"
}`
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'CLAUDE_API_KEY not configured',
      fallback: true
    });
  }

  try {
    const { type, original, userText, learningPoint } = req.body;

    if (!type || !original || !userText) {
      return res.status(400).json({ error: 'Missing required fields: type, original, userText' });
    }

    const promptTemplate = SCORING_PROMPTS[type];
    if (!promptTemplate) {
      return res.status(400).json({ error: 'Invalid type. Use: copy, structure, creative' });
    }

    // Token comparison for trustworthy feedback
    const punct = /[.,!?"""''·「」『』\-—()~：:;]/g;
    const origTokens = original.replace(punct,'').split(/\s+/).filter(w => w.length >= 2);
    const userTokens = userText.replace(punct,'').split(/\s+/).filter(w => w.length >= 2);
    const origSet = new Set(origTokens);
    const userSet = new Set(userTokens);
    const funcWords = new Set(['은','는','이','가','을','를','의','와','과','에','에서','로','으로','도','만','까지','부터','처럼','같이','보다','한','그','저','더','매우','아주','정말','너무','좀','다','안','못','잘','또']);
    const sharedWords = [...new Set(userTokens.filter(w => origSet.has(w) && !funcWords.has(w)))];
    const newWords = [...new Set(userTokens.filter(w => !origSet.has(w) && !funcWords.has(w)))];

    const prompt = promptTemplate
      .replace('{original}', original)
      .replace('{userText}', userText)
      .replace('{learningPoint}', learningPoint || '')
      .replace('{sharedWords}', sharedWords.join(', ') || '없음')
      .replace('{newWords}', newWords.join(', ') || '없음');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Claude API error:', err);
      return res.status(502).json({ error: 'Claude API error', fallback: true });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Extract JSON from response (handle ```json wrapping)
    let jsonStr = text;
    // Remove markdown code block if present
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) jsonStr = codeBlock[1];
    // Find JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: 'Invalid API response format', fallback: true, raw: text });
    }

    const result = JSON.parse(jsonMatch[0]);
    return res.status(200).json(result);

  } catch (error) {
    console.error('Score API error:', error);
    return res.status(500).json({ error: error.message, fallback: true });
  }
}
