// 로컬 개발 서버 — vercel dev 대체
// node server.js 로 실행
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// .env 로드
try {
  const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
  env.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
  console.log('Loaded .env — CLAUDE_API_KEY:', process.env.CLAUDE_API_KEY ? 'SET (' + process.env.CLAUDE_API_KEY.substring(0,15) + '...)' : 'NOT SET');
} catch(e) { console.log('.env not found'); }

const MIME = {
  '.html':'text/html;charset=utf-8', '.js':'application/javascript;charset=utf-8',
  '.css':'text/css;charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.mp3':'audio/mpeg', '.woff2':'font/woff2'
};

// Score API 핸들러 (api/score.js 로직 인라인)
const SCORING_PROMPTS = {
  copy: `당신은 한국어 필사 교정 전문가입니다. 사용자가 원문을 따라 쓴 결과를 검수해주세요.
원문: {original}
사용자 입력: {userText}
다음을 JSON으로 응답하세요 (코드블록 없이 순수 JSON만):
{"accuracy":0-100,"errors":[{"position":숫자,"original":"원래글자","user":"사용자글자","type":"오타|누락|추가"}],"feedback":"한 줄 격려 코멘트"}`,

  structure: `당신은 한국어 문장 구조 분석 전문가입니다. 성장을 북돋우는 따뜻하면서도 정확한 톤으로 응답하세요.
⚠️ 중요: 원문에 이미 존재하는 단어를 "새로운 표현"이라고 칭찬하지 마세요. 공통단어: {sharedWords} / 새로운단어: {newWords}
원문: {original}
학습 포인트: {learningPoint}
사용자 변형: {userText}
다음을 JSON으로 응답하세요 (코드블록 없이 순수 JSON만):
{"stars":1-5,"structureAnalysis":"원문과 비교한 구조 변화 분석 2-3문장","strengths":"잘한 점 1-2문장 (newWords에서만 독창성 언급)","improvement":"더 나아질 수 있는 방향 1-2문장","spellingErrors":[{"word":"틀린단어","correction":"올바른표기","reason":"이유"}],"spacingErrors":[{"context":"문맥","suggestion":"수정안"}],"tip":"다음 시도를 위한 구체적 팁 1문장"}`,

  creative: `당신은 한국어 창의적 글쓰기 코치입니다. 좋은 점을 먼저 찾아 소감 형태로 따뜻하게 말해주세요.
⚠️ 중요: 원문에 이미 존재하는 단어를 "새로운 표현"이라고 칭찬하지 마세요. 공통단어: {sharedWords} / 새로운단어: {newWords}
원문: {original}
학습 포인트: {learningPoint}
사용자 창작: {userText}
다음을 JSON으로 응답하세요 (코드블록 없이 순수 JSON만):
{"impression":"읽고 난 소감 따뜻한 2-3문장 좋은 점 위주 코멘트 중심","techniqueConnection":"오늘 배운 기법과의 연결 분석 1-2문장","highlight":"가장 인상적인 부분 (newWords에서만 인용)","spellingErrors":[{"word":"틀린단어","correction":"올바른표기","reason":"이유"}],"spacingErrors":[{"context":"문맥","suggestion":"수정안"}],"encouragement":"마무리 격려 1문장"}`
};

async function handleScore(req, res) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const { type, original, userText, learningPoint } = JSON.parse(body);
      if (!type || !original || !userText) {
        res.writeHead(400, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({error:'Missing fields'}));
      }
      const apiKey = process.env.CLAUDE_API_KEY;
      if (!apiKey) {
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({error:'No API key', fallback:true}));
      }

      // Token comparison for trustworthy feedback
      const punct = /[.,!?"""''·「」『』\-—()~：:;]/g;
      const origTokens = original.replace(punct,'').split(/\s+/).filter(w => w.length >= 2);
      const userTokens = userText.replace(punct,'').split(/\s+/).filter(w => w.length >= 2);
      const origSet = new Set(origTokens);
      const funcW = new Set(['은','는','이','가','을','를','의','와','과','에','에서','로','으로','도','만','까지','부터','처럼','같이','보다','한','그','저','더','매우','아주','정말','너무','좀','다','안','못','잘','또']);
      const sharedW = [...new Set(userTokens.filter(w => origSet.has(w) && !funcW.has(w)))];
      const newW = [...new Set(userTokens.filter(w => !origSet.has(w) && !funcW.has(w)))];

      const prompt = (SCORING_PROMPTS[type]||SCORING_PROMPTS.structure)
        .replace('{original}', original).replace('{userText}', userText)
        .replace('{learningPoint}', learningPoint||'')
        .replace('{sharedWords}', sharedW.join(', ')||'없음')
        .replace('{newWords}', newW.join(', ')||'없음');

      const apiBody = JSON.stringify({
        model:'claude-sonnet-4-6', max_tokens:768,
        messages:[{role:'user',content:prompt}]
      });

      const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
        body:apiBody
      });

      if (!apiResp.ok) {
        const err = await apiResp.text();
        console.error('Claude API error:', apiResp.status, err);
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({error:'API error '+apiResp.status, fallback:true}));
      }

      const data = await apiResp.json();
      let text = data.content?.[0]?.text || '';
      // Remove code block wrapper
      const cb = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (cb) text = cb[1];
      const jm = text.match(/\{[\s\S]*\}/);
      if (!jm) {
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({error:'Parse error', fallback:true, raw:text}));
      }
      const result = JSON.parse(jm[0]);
      console.log('Score result:', type, '→ stars:', result.stars);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify(result));
    } catch(e) {
      console.error('Score error:', e.message);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:e.message, fallback:true}));
    }
  });
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  // API route
  if (req.url === '/api/score' && req.method === 'POST') return handleScore(req, res);

  // Static files — try root first, then /public/
  let reqPath = req.url === '/' ? '/index.html' : req.url;
  let filePath = path.join(__dirname, reqPath);

  // If not found at root, try /public/
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'public', reqPath);
  }

  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {'Content-Type': MIME[ext] || 'application/octet-stream'});
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  LetterBrick Dev Server');
  console.log('  http://localhost:' + PORT);
  console.log('  API: http://localhost:' + PORT + '/api/score');
  console.log('');
});
