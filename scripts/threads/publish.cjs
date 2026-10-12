#!/usr/bin/env node
// 노션 '스레드 발행 큐'에서 승인된 글을 찾아 Threads에 올린다.
// .github/workflows/threads-publish.yml이 매시 채널(KO, EN)별로 실행한다.
// 레포가 공개라 Actions 로그도 공개된다. 글 본문과 제목은 로그에 남기지 않는다.
'use strict';

const fs = require('node:fs');
const { STATUS, blocksToParts, countChars, validateParts, planRun } = require('./lib.cjs');
const { createNotionClient, propsFor } = require('./notion.cjs');
const { createThreadsClient } = require('./threads-api.cjs');

async function run({ env = process.env, argv = process.argv.slice(2), now = new Date(), fetchImpl = fetch, sleep } = {}) {
  const channel = (env.THREADS_CHANNEL || '').trim();
  const dryRun = argv.includes('--dry-run') || /^(1|true|yes)$/i.test(env.THREADS_DRY_RUN || '');
  const token = env.THREADS_ACCESS_TOKEN || (channel && env[`THREADS_TOKEN_${channel}`]) || '';
  const notionToken = env.NOTION_TOKEN || '';
  const dataSourceId = env.NOTION_THREADS_DATA_SOURCE_ID || '';
  const maxPerRun = toPositiveInt(env.THREADS_MAX_PER_RUN, 1);
  const staleHours = toPositiveInt(env.THREADS_STALE_HOURS, 24);

  const result = { channel, dryRun, account: null, published: [], failed: [], waiting: 0, skipped: null };

  if (!channel) throw new Error('THREADS_CHANNEL이 비어 있어요. (예: KO, EN)');
  // 설정 전에는 매시 실행이 실패로 쌓이지 않게 조용히 건너뛴다
  if (!notionToken || !dataSourceId) {
    result.skipped = '노션 연결 전이에요 (NOTION_TOKEN, NOTION_THREADS_DATA_SOURCE_ID).';
    return result;
  }
  if (!token && !dryRun) {
    result.skipped = `${channel} 채널 토큰이 아직 없어요 (THREADS_TOKEN_${channel}).`;
    return result;
  }

  const notion = createNotionClient({ token: notionToken, fetchImpl });
  const items = await notion.queryApproved(dataSourceId, channel);
  const plan = planRun(items, now, { staleHours, maxPerRun });
  result.waiting = plan.waiting.length;

  // 너무 늦은 글과 시각이 없는 글은 올리지 않고 사람에게 돌려보낸다
  for (const item of plan.stale) {
    await markFailed(item, `예약 시각이 ${staleHours}시간 넘게 지나 올리지 않았어요. 시각을 새로 정하고 다시 승인해 주세요.`);
  }
  for (const item of plan.missingTime) {
    await markFailed(item, '발행 시각이 비어 있어요. 시각을 정하고 다시 승인해 주세요.');
  }

  // 올릴 글이 없으면 Threads는 건드리지 않는다. 점검 모드에서는 토큰 확인을 위해 계정을 읽어 본다.
  if (plan.publish.length === 0 && !dryRun) return result;
  const threads = token ? createThreadsClient({ token, fetchImpl, sleep }) : null;
  const profile = threads ? await threads.me() : null;
  result.account = profile ? profile.username : null;

  for (const item of plan.publish) {
    let parts;
    try {
      parts = blocksToParts(await notion.listBlocks(item.id));
      validateParts(parts);
    } catch (error) {
      await markFailed(item, error.message);
      continue;
    }

    if (dryRun) {
      result.published.push({ id: shortId(item.id), parts: parts.length, chars: parts.map(countChars), link: null });
      continue;
    }

    // '발행 중'으로 먼저 바꿔 두면 도중에 멈춰도 같은 글이 두 번 올라가지 않는다
    await notion.updatePage(item.id, propsFor.status(STATUS.publishing));

    let mediaIds;
    try {
      mediaIds = await threads.publishThread(profile.id, parts);
    } catch (error) {
      const posted = error.publishedIds && error.publishedIds.length
        ? ` 앞의 글 ${error.publishedIds.length}개는 이미 올라갔으니 스레드에서 확인해 주세요.`
        : '';
      await markFailed(item, `${error.message}${posted}`);
      continue;
    }

    const link = await threads.permalink(mediaIds[0]).catch(() => null);
    try {
      await notion.updatePage(item.id, {
        ...propsFor.status(STATUS.published),
        ...propsFor.link(link),
        ...propsFor.publishedAt(new Date()),
        ...propsFor.memo('')
      });
      result.published.push({ id: shortId(item.id), parts: parts.length, chars: parts.map(countChars), link });
    } catch (error) {
      // 글은 올라갔으니 '발행 중'으로 남겨 두고 실행만 실패로 알린다
      result.failed.push({ id: shortId(item.id), message: `스레드에는 올라갔지만 노션 기록에 실패했어요: ${error.message}`, link });
    }
  }

  return result;

  async function markFailed(item, message) {
    result.failed.push({ id: shortId(item.id), message });
    if (dryRun) return;
    await notion.updatePage(item.id, { ...propsFor.status(STATUS.failed), ...propsFor.memo(message) });
  }
}

function toPositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function shortId(id) {
  return String(id).replace(/-/g, '').slice(-6);
}

function buildSummary(result) {
  const lines = [`## Threads 발행 · ${result.channel || '?'}`, ''];
  if (result.skipped) {
    lines.push(`- 건너뜀: ${result.skipped}`);
    return lines.join('\n');
  }
  lines.push(`- 모드: ${result.dryRun ? '점검 (실제로 올리지 않음)' : '발행'}`);
  if (result.account) lines.push(`- 계정: @${result.account}`);
  lines.push(`- ${result.dryRun ? '올릴 예정' : '발행'}: ${result.published.length}건`);
  for (const item of result.published) {
    const size = item.chars ? ` (${item.chars.join(' + ')}자)` : '';
    lines.push(`  - …${item.id}${size}${item.link ? ` ${item.link}` : ''}`);
  }
  lines.push(`- 다음 실행으로 미룸: ${result.waiting}건`);
  lines.push(`- 실패: ${result.failed.length}건`);
  for (const item of result.failed) lines.push(`  - …${item.id}: ${item.message}`);
  return lines.join('\n');
}

if (require.main === module) {
  run()
    .then((result) => {
      const summary = buildSummary(result);
      console.log(summary);
      if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
      if (result.failed.length) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(`[threads-publish] ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { run, buildSummary };
