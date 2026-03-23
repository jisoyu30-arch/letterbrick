// Vercel Serverless Function — /api/score
// Claude Sonnet API로 필사 채점
// 환경변수: CLAUDE_API_KEY

const SCORING_PROMPTS = {
  copy: `당신은 한국어 필사 교정 전문가입니다.
사용자가 원문을 따라 쓴 결과를 검수해주세요.

원문: {original}
사용자 입력: {userText}

다음을 JSON으로 응답하세요:
{
  "accuracy": 0-100 (정확도),
  "errors": [{"position": 숫자, "original": "원래글자", "user": "사용자글자", "type": "오타|누락|추가"}],
  "feedback": "한 줄 격려 코멘트"
}`,

  structure: `당신은 한국어 문장 구조 분석 전문가입니다.
사용자가 원문의 구조를 변형한 문장을 평가해주세요.
성장을 북돋우는 따뜻하면서도 정확한 톤으로 응답하세요.

⚠️ 중요 규칙:
- 원문에 이미 존재하는 단어를 "새로운 표현"이라고 절대 칭찬하지 마세요.
- 구조적 변화(어순, 문장 유형, 시점 변환 등)를 중심으로 분석하세요.
- 원문과 사용자 글에 공통으로 있는 단어: {sharedWords}
- 사용자가 새로 쓴 단어: {newWords}

원문: {original}
학습 포인트: {learningPoint}
사용자 변형: {userText}

다음을 JSON으로 응답하세요:
{
  "stars": 1-5,
  "structureAnalysis": "원문과 비교한 구조 변화 분석 (2-3문장, 실제 변화된 부분 인용)",
  "strengths": "잘한 점 (1-2문장, newWords에서만 독창성 언급)",
  "improvement": "더 나아질 수 있는 방향 (1-2문장)",
  "spellingErrors": [{"word": "틀린단어", "correction": "올바른표기", "reason": "이유"}],
  "spacingErrors": [{"context": "문맥", "suggestion": "수정안"}],
  "tip": "다음 시도를 위한 구체적 팁 (1문장)"
}`,

  creative: `당신은 한국어 창의적 글쓰기 코치입니다.
사용자가 오늘 배운 문장에서 영감을 받아 쓴 창의적 글을 평가해주세요.
좋은 점을 먼저 찾아 소감 형태로 따뜻하게 말해주세요.
비판보다는 성장을 응원하는 톤으로 응답하세요.

⚠️ 중요 규칙:
- 원문에 이미 존재하는 단어를 "새로운 표현"이나 "자기만의 단어"라고 절대 칭찬하지 마세요.
- highlight에는 반드시 원문에 없는, 사용자가 새로 만든 표현만 인용하세요.
- 원문과 사용자 글에 공통으로 있는 단어: {sharedWords}
- 사용자가 새로 쓴 단어: {newWords}

원문: {original}
학습 포인트: {learningPoint}
사용자 창작: {userText}

다음을 JSON으로 응답하세요:
{
  "impression": "읽고 난 소감 (따뜻한 2-3문장, 좋은 점 위주, 코멘트 중심)",
  "techniqueConnection": "오늘 배운 기법과의 연결 분석 (1-2문장)",
  "highlight": "가장 인상적인 부분 인용 (반드시 newWords 중에서만 선택)",
  "spellingErrors": [{"word": "틀린단어", "correction": "올바른표기", "reason": "이유"}],
  "spacingErrors": [{"context": "문맥", "suggestion": "수정안"}],
  "encouragement": "마무리 격려 (1문장)"
}`
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.CLAUDE_API_KEY;
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
