// Vercel Serverless Function — /api/ocr
// Claude Vision API로 손글씨 이미지 → 텍스트 추출
// 환경변수: CLAUDE_API_KEY

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY not configured', fallback: true });
  }

  try {
    const { image, context } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Missing required field: image (base64 data URL)' });
    }

    // Extract base64 data and media type from data URL
    const dataUrlMatch = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!dataUrlMatch) {
      return res.status(400).json({ error: 'Invalid image format. Expected base64 data URL.' });
    }

    const mediaType = dataUrlMatch[1];
    const base64Data = dataUrlMatch[2];

    // Build prompt
    let prompt = '이 손글씨 이미지에 적힌 한국어 텍스트를 정확히 읽어서 텍스트로 변환해주세요.\n\n규칙:\n- 손글씨를 최대한 정확하게 읽어주세요\n- 줄바꿈은 원본과 동일하게 유지해주세요\n- 읽을 수 없는 글자는 □로 표시해주세요\n- 맞춤법 교정 없이 쓰여진 그대로 옮겨주세요';

    if (context) {
      prompt += '\n\n참고: 사용자가 다음 원문을 따라 쓰거나 변형한 것일 수 있습니다:\n"' + context + '"';
    }

    prompt += '\n\n다음 JSON 형식으로 응답해주세요:\n{\n  "text": "인식된 전체 텍스트",\n  "confidence": "high 또는 medium 또는 low"\n}';

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
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Claude Vision API error:', err);
      return res.status(502).json({ error: 'Claude Vision API error', fallback: true });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Extract JSON from response
    let jsonStr = text;
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) jsonStr = codeBlock[1];
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // If no JSON, treat the whole response as extracted text
      return res.status(200).json({ text: text.trim(), confidence: 'medium' });
    }

    const result = JSON.parse(jsonMatch[0]);
    return res.status(200).json(result);

  } catch (error) {
    console.error('OCR API error:', error);
    return res.status(500).json({ error: error.message, fallback: true });
  }
}
