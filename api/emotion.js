// 레터브릭 — 감정 분석 API (Google AI / Gemma)
// 힐링편 소감 텍스트 → 감정 분류 + 다음 콘텐츠 추천

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body || {};
  if (!text || text.trim().length < 5) {
    return res.status(400).json({ error: '분석할 텍스트가 너무 짧아요.' });
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 없음' });

  const prompt = `당신은 감정 분석 전문가입니다. 아래 텍스트를 읽고 JSON만 반환하세요. 다른 말은 절대 하지 마세요.

텍스트: "${text.slice(0, 500)}"

다음 JSON 형식으로만 응답:
{
  "emotion": "평온" | "불안" | "슬픔" | "기쁨" | "다짐" | "그리움" | "피로" | "설렘",
  "intensity": 1~5 사이 정수,
  "summary": "감정을 15자 이내로 한 줄 요약",
  "nextTheme": "힐링" | "다짐" | "여운",
  "nextReason": "다음 테마를 추천하는 이유 20자 이내"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 200,
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Google AI error:', data);
      return res.status(200).json(getFallback(text));
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // JSON 파싱 (마크다운 코드블록 제거)
    const cleaned = raw.replace(/```json?/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleaned);

    return res.status(200).json({ ok: true, ...result });

  } catch (e) {
    console.error('emotion API error:', e.message);
    // 파싱 실패 시 규칙 기반 폴백
    return res.status(200).json(getFallback(text));
  }
}

// 규칙 기반 폴백 (API 실패 시)
function getFallback(text) {
  const t = text;
  let emotion = '평온', nextTheme = '힐링';

  if (/힘들|지치|피곤|모르겠|막막/.test(t)) { emotion = '피로'; nextTheme = '힐링'; }
  else if (/불안|두렵|걱정|무서/.test(t)) { emotion = '불안'; nextTheme = '다짐'; }
  else if (/슬프|눈물|그립|보고싶/.test(t)) { emotion = '슬픔'; nextTheme = '여운'; }
  else if (/기쁘|행복|좋아|감사|설레/.test(t)) { emotion = '기쁨'; nextTheme = '힐링'; }
  else if (/해야|결심|다짐|하겠/.test(t)) { emotion = '다짐'; nextTheme = '다짐'; }

  return {
    ok: true,
    emotion,
    intensity: 3,
    summary: '오늘의 감정을 담았어요',
    nextTheme,
    nextReason: '오늘 감정에 맞는 글을 골랐어요',
    fallback: true
  };
}
