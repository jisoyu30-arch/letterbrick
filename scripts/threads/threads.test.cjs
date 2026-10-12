// 스레드 자동 발행 테스트: node --test scripts/threads/threads.test.cjs
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { blocksToParts, validateParts, parseNotionDate, planRun, STATUS, PROP } = require('./lib.cjs');
const { run } = require('./publish.cjs');
const { loadCurriculum, formatCurriculumPost, buildQueue, LANDING_URL } = require('./curriculum-posts.cjs');
const { TEXT_LIMIT, countChars } = require('./lib.cjs');

const paragraph = (text) => ({
  type: 'paragraph',
  has_children: false,
  paragraph: { rich_text: text ? [{ plain_text: text }] : [] }
});
const divider = () => ({ type: 'divider', has_children: false, divider: {} });

test('구분선마다 다음 글로 나누고 빈 줄을 지킨다', () => {
  const parts = blocksToParts([
    paragraph(''),
    paragraph('첫 줄'),
    paragraph(''),
    paragraph('셋째 줄'),
    divider(),
    paragraph('이어지는 글'),
    paragraph('')
  ]);
  assert.deepEqual(parts, ['첫 줄\n\n셋째 줄', '이어지는 글']);
});

test('링크 글자에는 주소를 붙인다', () => {
  const parts = blocksToParts([{
    type: 'paragraph',
    has_children: false,
    paragraph: { rich_text: [{ plain_text: '레터브릭', href: 'https://example.com' }] }
  }]);
  assert.deepEqual(parts, ['레터브릭 https://example.com']);
});

test('글이 아닌 블록이나 들여쓴 블록은 거절한다', () => {
  assert.throws(() => blocksToParts([{ type: 'image', has_children: false, image: {} }]), /지원하지 않는 블록/);
  assert.throws(() => blocksToParts([{ ...paragraph('부모'), has_children: true }]), /들여쓴 블록/);
});

test('500자 넘는 글과 채울 자리가 남은 글은 막는다', () => {
  assert.throws(() => validateParts(['가'.repeat(TEXT_LIMIT + 1)]), /501자/);
  assert.throws(() => validateParts(['좋은 글', '오늘의 한 마디: [[작가님 문장]]']), /2번째 글에 \[\[ \]\]/);
  assert.throws(() => validateParts([]), /비어 있어요/);
  assert.doesNotThrow(() => validateParts(['가'.repeat(TEXT_LIMIT)]));
});

test('노션 날짜를 서울 시간 기준으로 읽는다', () => {
  assert.equal(parseNotionDate({ start: '2026-10-14T21:30:00.000+09:00' }).toISOString(), '2026-10-14T12:30:00.000Z');
  assert.equal(parseNotionDate({ start: '2026-10-14T21:30:00.000', time_zone: 'Asia/Seoul' }).toISOString(), '2026-10-14T12:30:00.000Z');
  assert.equal(parseNotionDate({ start: '2026-10-14' }).toISOString(), '2026-10-13T15:00:00.000Z');
  assert.equal(parseNotionDate(null), null);
});

test('때가 된 글만 고르고, 너무 늦은 글과 시각 없는 글은 따로 뺀다', () => {
  const now = new Date('2026-10-14T13:00:00Z');
  const item = (id, iso) => ({ id, publishAt: iso ? new Date(iso) : null });
  const plan = planRun([
    item('later', '2026-10-14T13:00:00Z'),
    item('future', '2026-10-14T14:00:00Z'),
    item('first', '2026-10-14T12:30:00Z'),
    item('old', '2026-10-12T12:00:00Z'),
    item('none', null)
  ], now, { staleHours: 24, maxPerRun: 1 });
  assert.deepEqual(plan.publish.map((i) => i.id), ['first']);
  assert.deepEqual(plan.waiting.map((i) => i.id), ['later']);
  assert.deepEqual(plan.stale.map((i) => i.id), ['old']);
  assert.deepEqual(plan.missingTime.map((i) => i.id), ['none']);
});

// 노션·Threads API를 흉내 내는 가짜 fetch
function fakeApis({ pages, blocks, failPublish = false }) {
  const calls = [];
  const updates = [];
  let containerSeq = 0;
  let mediaSeq = 0;
  const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });

  async function fetchImpl(url, init = {}) {
    const method = init.method || 'GET';
    calls.push({ method, url });
    if (url.startsWith('https://api.notion.com/v1/data_sources/')) {
      const body = JSON.parse(init.body);
      assert.equal(body.filter.and[0].select.equals, STATUS.approved);
      return json({ results: pages, has_more: false });
    }
    if (url.startsWith('https://api.notion.com/v1/blocks/')) return json({ results: blocks, has_more: false });
    if (url.startsWith('https://api.notion.com/v1/pages/')) {
      updates.push({ id: url.split('/').pop(), properties: JSON.parse(init.body).properties });
      return json({});
    }
    if (url.startsWith('https://graph.threads.net/v1.0/me?')) return json({ id: '42', username: 'letterbrick' });
    if (url.startsWith('https://graph.threads.net/v1.0/42/threads') && !url.includes('threads_publish')) {
      const params = new URLSearchParams(init.body);
      calls[calls.length - 1].params = Object.fromEntries(params);
      return json({ id: `c${++containerSeq}` });
    }
    if (url.startsWith('https://graph.threads.net/v1.0/c')) return json({ status: 'FINISHED' });
    if (url.startsWith('https://graph.threads.net/v1.0/42/threads_publish')) {
      if (failPublish) return json({ error: { code: 190, message: 'Invalid OAuth access token' } }, 400);
      return json({ id: `m${++mediaSeq}` });
    }
    if (url.startsWith('https://graph.threads.net/v1.0/m1?')) return json({ permalink: 'https://www.threads.net/@letterbrick/post/abc' });
    throw new Error(`예상하지 못한 요청: ${method} ${url}`);
  }
  return { fetchImpl, calls, updates };
}

const approvedPage = {
  id: 'page-0000-1111',
  properties: {
    [PROP.title]: { title: [{ plain_text: '첫 글' }] },
    [PROP.publishAt]: { date: { start: '2026-10-14T21:30:00.000+09:00' } }
  }
};
const env = {
  THREADS_CHANNEL: 'KO',
  THREADS_TOKEN_KO: 'token-ko',
  NOTION_TOKEN: 'notion-token',
  NOTION_THREADS_DATA_SOURCE_ID: 'ds-1'
};
const now = new Date('2026-10-14T12:40:00Z');

test('승인된 글을 답글 체인으로 올리고 노션에 링크를 남긴다', async () => {
  const api = fakeApis({ pages: [approvedPage], blocks: [paragraph('하나'), divider(), paragraph('둘')] });
  const result = await run({ env, argv: [], now, fetchImpl: api.fetchImpl, sleep: async () => {} });

  assert.equal(result.failed.length, 0);
  assert.equal(result.published[0].link, 'https://www.threads.net/@letterbrick/post/abc');
  const containers = api.calls.filter((c) => c.params);
  assert.equal(containers.length, 2);
  assert.equal(containers[0].params.text, '하나');
  assert.equal(containers[0].params.reply_to_id, undefined);
  assert.equal(containers[1].params.reply_to_id, 'm1');
  assert.equal(containers[1].params.access_token, 'token-ko');

  const statuses = api.updates.map((u) => u.properties[PROP.status] && u.properties[PROP.status].select.name);
  assert.deepEqual(statuses, [STATUS.publishing, STATUS.published]);
  assert.equal(api.updates[1].properties[PROP.link].url, 'https://www.threads.net/@letterbrick/post/abc');
});

test('점검 모드에서는 Threads에 올리지 않고 노션도 바꾸지 않는다', async () => {
  const api = fakeApis({ pages: [approvedPage], blocks: [paragraph('하나')] });
  const result = await run({ env, argv: ['--dry-run'], now, fetchImpl: api.fetchImpl, sleep: async () => {} });

  assert.equal(result.dryRun, true);
  assert.equal(result.account, 'letterbrick');
  assert.equal(result.published.length, 1);
  assert.equal(api.updates.length, 0);
  assert.equal(api.calls.filter((c) => c.method === 'POST' && c.url.includes('graph.threads.net')).length, 0);
});

test('발행에 실패하면 실패로 돌리고 이유를 메모에 남긴다', async () => {
  const api = fakeApis({ pages: [approvedPage], blocks: [paragraph('하나')], failPublish: true });
  const result = await run({ env, argv: [], now, fetchImpl: api.fetchImpl, sleep: async () => {} });

  assert.equal(result.failed.length, 1);
  const last = api.updates[api.updates.length - 1].properties;
  assert.equal(last[PROP.status].select.name, STATUS.failed);
  assert.match(last[PROP.memo].rich_text[0].text.content, /Invalid OAuth access token/);
});

test('설정 전이거나 올릴 글이 없으면 Threads를 부르지 않는다', async () => {
  const notConfigured = await run({ env: { THREADS_CHANNEL: 'EN' }, argv: [], now });
  assert.match(notConfigured.skipped, /노션 연결 전/);

  const api = fakeApis({ pages: [], blocks: [] });
  const empty = await run({ env, argv: [], now, fetchImpl: api.fetchImpl });
  assert.equal(empty.published.length, 0);
  assert.equal(api.calls.filter((c) => c.url.includes('graph.threads.net')).length, 0);
});

test('커리큘럼 56일이 모두 500자 안의 글이 된다', () => {
  const curriculum = loadCurriculum();
  assert.equal(curriculum.length, 56);
  for (const day of curriculum) {
    const parts = formatCurriculumPost(day);
    assert.ok(parts.length >= 1 && parts.length <= 2, `Day ${day.day}`);
    for (const text of parts) assert.ok(countChars(text) <= TEXT_LIMIT, `Day ${day.day}: ${countChars(text)}자`);
    assert.ok(parts[0].includes(day.sentence.ko));
  }
  const day7 = formatCurriculumPost(curriculum[6]).join('\n');
  assert.ok(day7.includes(LANDING_URL));
});

test('커리큘럼 큐는 하루씩 서울 시간으로 놓인다', () => {
  const queue = buildQueue(loadCurriculum(), { start: '2026-10-15', time: '22:00', from: 1, to: 3 });
  assert.deepEqual(queue.map((q) => q.publishAt), [
    '2026-10-15T22:00:00+09:00',
    '2026-10-16T22:00:00+09:00',
    '2026-10-17T22:00:00+09:00'
  ]);
  assert.match(queue[0].notes.join(' '), /출처 표기 확인/);
});
