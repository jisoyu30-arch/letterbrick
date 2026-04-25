// LetterBrick Service Worker — v9 (network-first HTML/JS, cache-first assets)
const CACHE_NAME = 'letterbrick-v9';
const ASSETS = [
  '/',
  '/demo.html',
  '/data.js',
  '/images/paper-texture.svg',
  '/images/brick-texture.svg',
  '/images/icon_pen_tool.svg',
  '/images/icon_moon.svg',
  '/images/icon_leaf.svg',
  '/images/icon_sun.svg',
  '/images/icon_sparkles.svg',
  '/images/icon_star.svg',
  '/images/icon_orbit.svg',
  '/images/icon_telescope.svg',
  '/images/icon_coffee.svg'
];

// 설치: 캐시 프리워밍 + 즉시 활성화
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 활성화: 구 캐시 삭제 + 모든 탭 즉시 제어
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // API 호출은 항상 네트워크 직통
  if (url.includes('/api/')) return;

  // HTML / JS : network-first (항상 최신 코드 반영)
  const isDoc = e.request.destination === 'document';
  const isScript = url.match(/\.(html|js)(\?|$)/);
  if (isDoc || isScript) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // 성공 시 캐시 갱신
          var clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request)) // 오프라인 폴백
    );
    return;
  }

  // 이미지·폰트·CSS : cache-first (변경 빈도 낮음)
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
