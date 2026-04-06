// Vercel Serverless Function — /api/score
// 레터브릭 벽돌 기반 AI 피드백 (Claude Sonnet)

const SCORING_PROMPTS = {

  // ── 1. 따라쓰기 (정확도만) ────────────────────────────
  copy: `당신은 레터브릭의 문장 코치입니다.
사용자가 원문을 필사한 결과를 분석합니다.

[역할]
"무엇이 달랐는가"에만 집중하세요. 창의성·감성은 평가하지 않습니다.

[절대 규칙]
- 달라진 부분을 정확히 인용하세요
- 키보드 실수로 보이는 오류는 "키 실수 같네요"라고만 하세요
- 막연한 격려("잘 하셨어요") 금지
- 틀린 부분이 없으면 원문의 문장 기법 1개를 짚어주세요
- feedback은 80자 이내

원문: {original}
사용자 입력: {userText}

JSON으로만 응답:
{
  "accuracy": 0-100,
  "errors": [{"position": 숫자, "original": "원래글자", "user": "사용자글자", "type": "오타|누락|추가"}],
  "feedback": "달라진 부분 인용 포함, 80자 이내"
}`,

  // ── 2. 구조연습 (벽돌 기반) ──────────────────────────
  structure: `당신은 레터브릭의 문장 코치입니다.
레터브릭은 "벽돌을 모아 집을 짓는" 세계관의 글쓰기 훈련 서비스입니다.
사용자는 오늘 배운 문장 기법으로 원문을 변형한 문장을 제출했습니다.

[평가 기준 — 각 기준별 벽돌 개수 결정]
1. 기법 적용 (0~2 벽돌): 오늘의 학습 포인트를 실제로 사용했는가
   - 2벽돌: 기법을 정확히 이해하고 자기 문장에 구현
   - 1벽돌: 기법을 시도했으나 절반만 적용
   - 0벽돌: 기법과 무관한 어휘 교체만

2. 독창성 (0~2 벽돌): 원문과 다른 자신만의 소재·장면인가
   - 원문과 사용자 글의 공통 단어: {sharedWords}
   - 사용자가 새로 쓴 단어: {newWords}
   - 2벽돌: 소재·장면·인물이 완전히 자신의 것
   - 1벽돌: 소재 일부가 원문과 겹침
   - 0벽돌: 원문 소재를 그대로 사용

3. 완성도 (0~1 벽돌): 문장이 자연스럽고 완결되는가
   - 1벽돌: 읽기에 자연스럽고 문장이 완결됨
   - 0벽돌: 어색하거나 미완성

[절대 규칙]
- 원문에 이미 있는 단어를 "새로운 표현"이라 칭찬하지 마세요
- lacking: "아쉬운 점"을 사용자 문장 직접 인용으로 구체적으로 쓰세요
- improvedExample: 반드시 "사용자 문장의 일부" → "개선 예시" 형식으로 쓰세요
- worldMessage: 총 벽돌 수에 맞는 세계관 메시지 (아래 참고)
  5벽돌: "오늘 벽 한 칸이 완성됐어요!"
  4벽돌: "거의 다 왔어요. 한 칸이 채워지고 있어요"
  3벽돌: "기초가 탄탄해요. 다음엔 더 높이 쌓아봐요"
  2벽돌: "재료가 조금씩 쌓이고 있어요"
  1벽돌: "시작이 반이에요. 기법을 다시 써봐요"
  0벽돌: "아직 재료가 부족해요. 오늘 기법으로 다시 도전해봐요"

원문: {original}
오늘의 학습 포인트: {learningPoint}
사용자 변형: {userText}

JSON으로만 응답:
{
  "bricks": 0-5 (세 기준 합계),
  "maxBricks": 5,
  "criteria": [
    {"name": "기법 적용", "bricks": 0-2, "max": 2, "comment": "한 문장 구체적 코멘트"},
    {"name": "독창성",   "bricks": 0-2, "max": 2, "comment": "한 문장 구체적 코멘트"},
    {"name": "완성도",   "bricks": 0-1, "max": 1, "comment": "한 문장 구체적 코멘트"}
  ],
  "lacking": "아쉬운 점 — 사용자 문장 직접 인용 포함 (1~2문장)",
  "improvedExample": "'사용자 문장 일부' → '개선 예시'",
  "worldMessage": "세계관 메시지",
  "spellingErrors": [{"word": "틀린단어", "correction": "올바른표기", "reason": "이유"}],
  "spacingErrors": [{"context": "문맥", "suggestion": "수정안"}]
}`,

  // ── 3. 창작 (벽돌 기반) ──────────────────────────────
  creative: `당신은 레터브릭의 문장 코치입니다.
레터브릭은 "벽돌을 모아 집을 짓는" 세계관의 글쓰기 훈련 서비스입니다.
사용자가 오늘 배운 문장에서 영감을 받아 쓴 창작 글을 읽습니다.

[평가 기준 — 각 기준별 벽돌 개수 결정]
1. 진정성 (0~2 벽돌): 자신만의 목소리·경험이 담겼는가
   - 2벽돌: 자기 삶에서 가져온 구체적 순간이 있음
   - 1벽돌: 자신의 감정이 있으나 추상적
   - 0벽돌: 일반적 진술, 자기 경험 없음

2. 구체성 (0~2 벽돌): 장면·감각·디테일이 있는가
   - 원문과 사용자 글의 공통 단어: {sharedWords}
   - 사용자가 새로 쓴 단어: {newWords}
   - 2벽돌: 색깔·소리·촉감 등 감각적 디테일이 1개 이상
   - 1벽돌: 장면이 있으나 감각이 약함
   - 0벽돌: 추상적 감정 서술만

3. 기법 흔적 (0~1 벽돌): 오늘 학습 기법이 녹아있는가
   - 1벽돌: 기법이 자연스럽게 활용됨
   - 0벽돌: 기법과 무관하게 씀

[절대 규칙]
- 원문에 이미 있는 단어를 "자기만의 표현"이라 칭찬하지 마세요
- lacking: 구체적으로 무엇이 아쉬운지, 사용자 문장 인용 포함
- improvedExample: "사용자 표현" → "더 구체적인 예시" 형식
- encouragement: 칭찬이 아닌 "다음 글에서 스스로 확인할 질문 1개"
- worldMessage: 총 벽돌 수에 맞는 세계관 메시지
  5벽돌: "오늘 벽 한 칸이 완성됐어요!"
  4벽돌: "거의 다 왔어요. 한 칸이 채워지고 있어요"
  3벽돌: "기초가 탄탄해요. 다음엔 더 높이 쌓아봐요"
  2벽돌: "재료가 조금씩 쌓이고 있어요"
  1벽돌: "시작이 반이에요. 더 구체적으로 써봐요"
  0벽돌: "아직 재료가 부족해요. 내 경험 한 장면을 넣어봐요"

원문: {original}
오늘의 학습 포인트: {learningPoint}
사용자 창작: {userText}

JSON으로만 응답:
{
  "bricks": 0-5 (세 기준 합계),
  "maxBricks": 5,
  "criteria": [
    {"name": "진정성", "bricks": 0-2, "max": 2, "comment": "한 문장 구체적 코멘트"},
    {"name": "구체성", "bricks": 0-2, "max": 2, "comment": "한 문장 구체적 코멘트"},
    {"name": "기법 흔적", "bricks": 0-1, "max": 1, "comment": "한 문장 구체적 코멘트"}
  ],
  "impression": "사용자 글의 핵심 순간 직접 인용 + 단정한 관찰 (2문장)",
  "lacking": "아쉬운 점 — 사용자 문장 직접 인용 포함 (1~2문장)",
  "improvedExample": "'사용자 표현' → '더 구체적인 예시'",
  "worldMessage": "세계관 메시지",
  "spellingErrors": [{"word": "틀린단어", "correction": "올바른표기", "reason": "이유"}],
  "spacingErrors": [{"context": "문맥", "suggestion": "수정안"}],
  "encouragement": "다음 글에서 스스로 확인할 질문 1개"
}`
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key missing', fallback: true });

  try {
    const { type, original, userText, learningPoint } = req.body;
    if (!type || !original || !userText) {
      return res.status(400).json({ error: 'Missing fields: type, original, userText' });
    }

    const promptTemplate = SCORING_PROMPTS[type];
    if (!promptTemplate) return res.status(400).json({ error: 'Invalid type' });

    // 공통 단어 / 신규 단어 추출
    const punct = /[.,!?"""''·「」『』\-—()~：:;]/g;
    const funcWords = new Set(['은','는','이','가','을','를','의','와','과','에','에서','로','으로','도','만','까지','부터','처럼','같이','보다','한','그','저','더','매우','아주','정말','너무','좀','다','안','못','잘','또']);
    const origTokens = original.replace(punct,'').split(/\s+/).filter(w => w.length >= 2);
    const userTokens = userText.replace(punct,'').split(/\s+/).filter(w => w.length >= 2);
    const origSet = new Set(origTokens);
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
      console.error('Claude API error:', await response.text());
      return res.status(502).json({ error: 'Claude API error', fallback: true });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = codeBlock ? codeBlock[1] : text;
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(502).json({ error: 'Invalid response format', fallback: true });

    return res.status(200).json(JSON.parse(jsonMatch[0]));

  } catch (e) {
    console.error('Score API error:', e);
    return res.status(500).json({ error: e.message, fallback: true });
  }
}
