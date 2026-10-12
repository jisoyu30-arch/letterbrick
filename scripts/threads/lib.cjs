// 스레드 자동 발행에 쓰는 순수 함수 모음. 네트워크 없이 테스트할 수 있게 분리했다.
'use strict';

const TEXT_LIMIT = 500; // Threads 글 한 개 최대 글자 수
const MAX_PARTS = 10; // 답글로 이어 붙이는 글 최대 개수
const PLACEHOLDER = /\[\[[\s\S]*?\]\]/; // [[작가가 채울 자리]]
const DEFAULT_TIME_ZONE = 'Asia/Seoul';

const STATUS = Object.freeze({
  draft: '초안',
  approved: '승인',
  publishing: '발행 중',
  published: '발행됨',
  failed: '실패'
});

const PROP = Object.freeze({
  title: '제목',
  channel: '채널',
  status: '상태',
  publishAt: '발행 시각',
  link: '게시 링크',
  publishedAt: '발행된 시각',
  memo: '메모'
});

const TEXT_BLOCKS = new Set([
  'paragraph',
  'heading_1',
  'heading_2',
  'heading_3',
  'quote',
  'callout',
  'bulleted_list_item',
  'numbered_list_item'
]);

function richTextToPlain(richText) {
  return (richText || []).map((rt) => {
    const text = rt.plain_text || '';
    const href = rt.href || (rt.text && rt.text.link && rt.text.link.url) || '';
    // 링크 글자만 남으면 주소가 사라지므로 주소를 뒤에 붙인다
    if (href && !text.includes(href)) return `${text} ${href}`;
    return text;
  }).join('');
}

// 노션 블록 목록을 Threads 글 묶음으로 바꾼다. 구분선(---)마다 다음 글(답글)로 넘어간다.
function blocksToParts(blocks) {
  const parts = [[]];
  let numbered = 0;

  for (const block of blocks) {
    const type = block.type;
    if (type === 'divider') {
      parts.push([]);
      numbered = 0;
      continue;
    }
    if (!TEXT_BLOCKS.has(type)) {
      throw new Error(`지원하지 않는 블록(${type})이 있어요. 글과 구분선만 넣어 주세요.`);
    }
    if (block.has_children) {
      throw new Error('들여쓴 블록이 있어요. 들여쓰기를 풀어 주세요.');
    }

    const text = richTextToPlain(block[type] && block[type].rich_text);
    const lines = parts[parts.length - 1];
    if (type === 'numbered_list_item') {
      numbered += 1;
      lines.push(`${numbered}. ${text}`);
      continue;
    }
    numbered = 0;
    lines.push(type === 'bulleted_list_item' ? `- ${text}` : text);
  }

  return parts
    .map((lines) => trimBlankLines(lines).join('\n'))
    .filter((text) => text.trim() !== '');
}

function trimBlankLines(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') start += 1;
  while (end > start && lines[end - 1].trim() === '') end -= 1;
  return lines.slice(start, end);
}

function countChars(text) {
  return [...text].length;
}

function validateParts(parts) {
  if (parts.length === 0) throw new Error('본문이 비어 있어요.');
  if (parts.length > MAX_PARTS) {
    throw new Error(`이어지는 글은 ${MAX_PARTS}개까지만 돼요. 지금 ${parts.length}개예요.`);
  }
  parts.forEach((text, index) => {
    const label = parts.length > 1 ? `${index + 1}번째 글` : '글';
    if (PLACEHOLDER.test(text)) {
      throw new Error(`${label}에 [[ ]]로 표시한 채울 자리가 남아 있어요.`);
    }
    const length = countChars(text);
    if (length > TEXT_LIMIT) {
      throw new Error(`${label}이 ${length}자예요. ${TEXT_LIMIT}자 이하로 줄여 주세요.`);
    }
  });
}

// 노션 날짜 속성을 Date로 바꾼다. 시간대 표기가 없으면 노션 time_zone(없으면 서울) 기준으로 읽는다.
function parseNotionDate(date, fallbackTimeZone = DEFAULT_TIME_ZONE) {
  if (!date || !date.start) return null;
  const start = date.start;
  if (/(?:[zZ]|[+-]\d{2}:\d{2})$/.test(start)) return new Date(start);
  return zonedLocalToUtc(start, date.time_zone || fallbackTimeZone);
}

function zonedLocalToUtc(local, timeZone) {
  const [datePart, timePart = '00:00:00'] = local.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour = '0', minute = '0', second = '0'] = timePart.split(':');
  const naive = Date.UTC(year, month - 1, day, Number(hour), Number(minute), Math.floor(Number(second)));
  const offset = timeZoneOffsetMinutes(new Date(naive), timeZone);
  return new Date(naive - offset * 60000);
}

function timeZoneOffsetMinutes(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

// 이번 실행에서 올릴 글, 미뤄 둘 글, 너무 늦어 사람에게 돌려보낼 글을 나눈다.
function planRun(items, now, { staleHours = 24, maxPerRun = 1 } = {}) {
  const due = [];
  const stale = [];
  const missingTime = [];

  for (const item of items) {
    if (!item.publishAt || Number.isNaN(item.publishAt.getTime())) {
      missingTime.push(item);
      continue;
    }
    const lateMs = now.getTime() - item.publishAt.getTime();
    if (lateMs < 0) continue;
    if (lateMs > staleHours * 3600 * 1000) stale.push(item);
    else due.push(item);
  }

  due.sort((a, b) => a.publishAt - b.publishAt);
  return {
    publish: due.slice(0, maxPerRun),
    waiting: due.slice(maxPerRun),
    stale,
    missingTime
  };
}

module.exports = {
  TEXT_LIMIT,
  MAX_PARTS,
  DEFAULT_TIME_ZONE,
  STATUS,
  PROP,
  richTextToPlain,
  blocksToParts,
  countChars,
  validateParts,
  parseNotionDate,
  zonedLocalToUtc,
  planRun
};
