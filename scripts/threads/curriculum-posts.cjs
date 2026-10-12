#!/usr/bin/env node
// LetterBrick Korean 56일 커리큘럼(public/ko-curriculum.js)을 영어권 스레드(EN 채널) 글로 바꾼다.
// 사용: node scripts/threads/curriculum-posts.cjs --start=2026-10-15 --time=22:00 [--from=1] [--to=56] > en-posts.json
// 결과 JSON을 노션 '스레드 발행 큐'에 초안으로 넣는다. 발행 시각은 서울 시간 기준이다.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { TEXT_LIMIT, countChars } = require('./lib.cjs');

const CURRICULUM_PATH = path.join(__dirname, '..', '..', 'public', 'ko-curriculum.js');
const LANDING_URL = 'https://letter-brick.vercel.app/korean-en.html';

// 같은 마무리 문장이 매일 반복되지 않게 돌려 쓴다
const PROMPTS = [
  (day) => `Your turn: write one sentence with ${day.grammar.pattern} in the replies.`,
  () => 'Which word was new to you? Tell me below.',
  () => 'Say it out loud three times, then write your own version below.',
  (day) => `How would you use ${day.vocab[0].ko} in a sentence of your own?`
];

function loadCurriculum(file = CURRICULUM_PATH) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  // vm 안에서 만든 배열은 다른 realm 객체라서, 평범한 데이터로 옮겨 둔다
  return JSON.parse(JSON.stringify(sandbox.window.KO_CURRICULUM));
}

function creditLine(sentence) {
  if (!sentence.author || sentence.author === 'LetterBrick') return '';
  if (/K-drama adapted/i.test(sentence.author)) return '(a classic K-drama style line)';
  return `— ${sentence.author}`;
}

function formatCurriculumPost(day, { landingUrl = LANDING_URL } = {}) {
  const s = day.sentence;
  const head = [`Korean sentence of the day · Day ${day.day}`, '', s.ko, s.romanization, `"${s.translation}"`];
  const credit = creditLine(s);
  if (credit) head.push(credit);

  const grammar = `✏️ ${day.grammar.pattern}: ${day.grammar.explanation}`;
  const vocab = `📚 ${day.vocab.map((v) => `${v.ko} (${v.meaning})`).join(' · ')}`;
  const casual = day.variations && day.variations.casual ? `💬 To a friend: ${day.variations.casual.text}` : '';
  const prompt = PROMPTS[(day.day - 1) % PROMPTS.length](day);
  // 한 주의 마지막 날에만 전체 과정 안내를 붙인다
  const invite = day.day % 7 === 0 ? `Day ${day.day} of an 8-week course. The full daily routine: ${landingUrl}` : '';

  const single = [head.join('\n'), grammar, vocab, casual, prompt, invite].filter(Boolean).join('\n\n');
  const parts = countChars(single) <= TEXT_LIMIT
    ? [single]
    : [
        [head.join('\n'), grammar].join('\n\n'),
        [vocab, casual, prompt, invite].filter(Boolean).join('\n\n')
      ];

  parts.forEach((text) => {
    if (countChars(text) > TEXT_LIMIT) throw new Error(`Day ${day.day} 글이 ${countChars(text)}자라 나눠도 너무 길어요.`);
  });
  return parts;
}

// 노션 큐에 넣을 글 목록을 만든다. 하루에 하나씩, 서울 시간 기준 같은 시각에 놓는다.
function buildQueue(curriculum, { start, time = '22:00', from = 1, to = curriculum.length, landingUrl = LANDING_URL }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '')) throw new Error('--start=YYYY-MM-DD 형식으로 시작일을 넣어 주세요.');
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error('--time=HH:MM 형식으로 시각을 넣어 주세요.');

  const startMs = Date.parse(`${start}T${time}:00+09:00`);
  return curriculum
    .filter((day) => day.day >= from && day.day <= to)
    .map((day, index) => {
      const notes = [];
      const credit = creditLine(day.sentence);
      if (credit.startsWith('— ')) notes.push(`출처 표기 확인 필요: ${day.sentence.author}`);
      if (day.day % 7 === 0) notes.push(`링크 확인 필요: ${landingUrl}`);
      return {
        title: `EN Day ${day.day} · ${day.sentence.ko}`,
        publishAt: toSeoulIso(new Date(startMs + index * 86400000)),
        parts: formatCurriculumPost(day, { landingUrl }),
        notes
      };
    });
}

function toSeoulIso(date) {
  const seoul = new Date(date.getTime() + 9 * 3600000);
  return `${seoul.toISOString().slice(0, 19)}+09:00`;
}

function parseArgs(argv) {
  return Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => {
    const [key, ...rest] = a.slice(2).split('=');
    return [key, rest.join('=')];
  }));
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const queue = buildQueue(loadCurriculum(), {
      start: args.start,
      time: args.time || '22:00',
      from: args.from ? Number(args.from) : 1,
      to: args.to ? Number(args.to) : undefined,
      landingUrl: args.url || LANDING_URL
    });
    process.stdout.write(`${JSON.stringify(queue, null, 2)}\n`);
  } catch (error) {
    console.error(`[threads-curriculum] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { LANDING_URL, loadCurriculum, formatCurriculumPost, buildQueue, toSeoulIso };
