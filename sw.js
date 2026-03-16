// LetterBrick Service Worker — 오프라인 캐싱
const CACHE_NAME = 'letterbrick-v1';
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

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  // API 호출은 캐시하지 않음
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
