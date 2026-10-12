// 노션 '스레드 발행 큐' 읽기·쓰기. Notion API 2025-09-03(data source) 기준.
'use strict';

const { PROP, STATUS, richTextToPlain, parseNotionDate } = require('./lib.cjs');

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2025-09-03';

function createNotionClient({ token, fetchImpl = fetch }) {
  async function request(path, { method = 'GET', body } = {}) {
    const res = await fetchImpl(`${NOTION_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Notion API ${res.status}: ${data.message || data.code || 'unknown error'}`);
    }
    return data;
  }

  // 채널의 '승인' 글을 발행 시각 순서로 가져온다
  async function queryApproved(dataSourceId, channel) {
    const pages = [];
    let cursor;
    do {
      const data = await request(`/data_sources/${dataSourceId}/query`, {
        method: 'POST',
        body: {
          filter: {
            and: [
              { property: PROP.status, select: { equals: STATUS.approved } },
              { property: PROP.channel, select: { equals: channel } }
            ]
          },
          sorts: [{ property: PROP.publishAt, direction: 'ascending' }],
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {})
        }
      });
      pages.push(...data.results);
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);
    return pages.map(toQueueItem);
  }

  async function listBlocks(pageId) {
    const blocks = [];
    let cursor;
    do {
      const query = new URLSearchParams({ page_size: '100', ...(cursor ? { start_cursor: cursor } : {}) });
      const data = await request(`/blocks/${pageId}/children?${query}`);
      blocks.push(...data.results);
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);
    return blocks;
  }

  async function updatePage(pageId, properties) {
    return request(`/pages/${pageId}`, { method: 'PATCH', body: { properties } });
  }

  return { queryApproved, listBlocks, updatePage };
}

function toQueueItem(page) {
  const props = page.properties || {};
  const title = props[PROP.title];
  const publishAt = props[PROP.publishAt];
  return {
    id: page.id,
    title: title ? richTextToPlain(title.title) : '',
    publishAt: parseNotionDate(publishAt && publishAt.date)
  };
}

// 노션 속성 값 만들기
const propsFor = {
  status: (name) => ({ [PROP.status]: { select: { name } } }),
  link: (url) => ({ [PROP.link]: { url: url || null } }),
  publishedAt: (date) => ({ [PROP.publishedAt]: { date: { start: date.toISOString() } } }),
  memo: (text) => ({
    [PROP.memo]: { rich_text: text ? [{ type: 'text', text: { content: text.slice(0, 1900) } }] : [] }
  })
};

module.exports = { NOTION_VERSION, createNotionClient, toQueueItem, propsFor };
