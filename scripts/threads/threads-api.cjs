// Threads API 클라이언트. 토큰은 요청 본문·쿼리로만 보내고 로그에는 남기지 않는다.
'use strict';

const THREADS_HOST = 'https://graph.threads.net';
const THREADS_API = `${THREADS_HOST}/v1.0`;

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createThreadsClient({ token, fetchImpl = fetch, sleep = defaultSleep, pollIntervalMs = 2000, pollAttempts = 15 }) {
  async function call(url, { method = 'GET', params = {} } = {}) {
    const search = new URLSearchParams({ ...params, access_token: token });
    const init = { method };
    let target = url;
    if (method === 'GET') {
      target += `?${search}`;
    } else {
      init.body = search;
      init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    }
    const res = await fetchImpl(target, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      const error = data.error || {};
      const code = error.code ? ` (${error.code})` : '';
      throw new Error(`Threads API ${res.status}${code}: ${error.message || 'unknown error'}`);
    }
    return data;
  }

  function me() {
    return call(`${THREADS_API}/me`, { params: { fields: 'id,username' } });
  }

  async function createTextContainer(userId, text, replyToId) {
    const params = { media_type: 'TEXT', text };
    if (replyToId) params.reply_to_id = replyToId;
    const data = await call(`${THREADS_API}/${userId}/threads`, { method: 'POST', params });
    return data.id;
  }

  async function waitUntilReady(containerId) {
    for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
      const data = await call(`${THREADS_API}/${containerId}`, { params: { fields: 'status,error_message' } });
      if (data.status === 'FINISHED') return;
      if (data.status === 'ERROR' || data.status === 'EXPIRED') {
        throw new Error(`Threads 컨테이너 ${data.status}: ${data.error_message || '이유 없음'}`);
      }
      await sleep(pollIntervalMs);
    }
    throw new Error('Threads가 글을 준비하는 데 너무 오래 걸려요. 잠시 뒤 다시 승인해 주세요.');
  }

  async function publishContainer(userId, containerId) {
    const data = await call(`${THREADS_API}/${userId}/threads_publish`, {
      method: 'POST',
      params: { creation_id: containerId }
    });
    return data.id;
  }

  async function permalink(mediaId) {
    const data = await call(`${THREADS_API}/${mediaId}`, { params: { fields: 'permalink' } });
    return data.permalink || null;
  }

  // 글 묶음을 순서대로 올린다. 두 번째 글부터는 바로 앞 글의 답글로 이어 붙인다.
  // 중간에 실패하면 이미 올라간 글 id를 error.publishedIds에 담아 던진다.
  async function publishThread(userId, parts) {
    const mediaIds = [];
    try {
      for (const text of parts) {
        const containerId = await createTextContainer(userId, text, mediaIds[mediaIds.length - 1]);
        await waitUntilReady(containerId);
        mediaIds.push(await publishContainer(userId, containerId));
      }
    } catch (error) {
      error.publishedIds = mediaIds;
      throw error;
    }
    return mediaIds;
  }

  // 60일짜리 장기 토큰을 새로 받는다. 받은 지 24시간이 지나고 만료 전인 토큰만 갱신된다.
  function refreshToken() {
    return call(`${THREADS_HOST}/refresh_access_token`, { params: { grant_type: 'th_refresh_token' } });
  }

  return { me, publishThread, permalink, refreshToken };
}

module.exports = { THREADS_API, createThreadsClient };
