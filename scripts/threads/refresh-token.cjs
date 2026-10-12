#!/usr/bin/env node
// Threads 장기 토큰(60일)이 살아 있는지 확인하고, 저장할 수 있으면 새 토큰으로 갱신한다.
// .github/workflows/threads-token-refresh.yml이 매월 1일·15일에 채널별로 실행한다.
// 새 토큰은 파일에만 쓰고 절대 로그에 찍지 않는다.
'use strict';

const fs = require('node:fs');
const { createThreadsClient } = require('./threads-api.cjs');

async function run({ env = process.env, fetchImpl = fetch } = {}) {
  const channel = (env.THREADS_CHANNEL || '').trim();
  const token = env.THREADS_ACCESS_TOKEN || (channel && env[`THREADS_TOKEN_${channel}`]) || '';
  const canStore = env.THREADS_CAN_STORE_SECRET === 'true';
  const outPath = env.THREADS_NEW_TOKEN_PATH || '';

  if (!token) return { channel, status: 'skipped', message: `${channel} 채널 토큰이 아직 없어요.` };

  const threads = createThreadsClient({ token, fetchImpl });
  // 토큰이 죽었으면 여기서 실패한다
  const profile = await threads.me();
  const base = { channel, username: profile.username };

  if (!canStore || !outPath) {
    return { ...base, status: 'checked', message: '토큰은 정상이에요. 자동 갱신은 꺼져 있어요 (THREADS_SECRETS_PAT 없음).' };
  }

  let refreshed;
  try {
    refreshed = await threads.refreshToken();
  } catch (error) {
    return { ...base, status: 'warning', message: `토큰은 정상이지만 갱신하지 못했어요: ${error.message}` };
  }
  if (!refreshed.access_token) {
    return { ...base, status: 'warning', message: '갱신 응답에 토큰이 없어요. 다음 실행에서 다시 시도해요.' };
  }

  if (env.GITHUB_ACTIONS) process.stdout.write(`::add-mask::${refreshed.access_token}\n`);
  fs.writeFileSync(outPath, refreshed.access_token, { mode: 0o600 });
  const days = Math.floor((Number(refreshed.expires_in) || 0) / 86400);
  return { ...base, status: 'refreshed', message: `새 토큰을 받았어요. ${days}일 동안 유효해요.` };
}

if (require.main === module) {
  run()
    .then((result) => {
      const line = `- ${result.channel}${result.username ? ` (@${result.username})` : ''}: ${result.message}`;
      console.log(line);
      if (process.env.GITHUB_STEP_SUMMARY) {
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Threads 토큰 · ${result.channel}\n\n${line}\n`);
      }
      if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `refreshed=${result.status === 'refreshed'}\n`);
      }
      if (result.status === 'warning') console.log(`::warning::${result.message}`);
    })
    .catch((error) => {
      console.error(`[threads-token] ${error.message}`);
      console.error('토큰이 만료됐을 수 있어요. THREADS_AUTOMATION.md의 "토큰 다시 받기"를 따라 주세요.');
      process.exitCode = 1;
    });
}

module.exports = { run };
