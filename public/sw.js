// LetterBrick Service Worker — v11 (FCM + network-first HTML/JS, cache-first assets)

// ── FCM 백그라운드 메시지 ──
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBPzmE-iGxHcBoifKJwWUtpMwBDGcH3h64",
  authDomain: "letterbrick.firebaseapp.com",
  projectId: "letterbrick",
  storageBucket: "letterbrick.firebasestorage.app",
  messagingSenderId: "702996495709",
  appId: "1:702996495709:web:ef9443cbed4d5042b67cb4"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = (payload.notification && payload.notification.title) || '레터브릭';
  const body  = (payload.notification && payload.notification.body)  || '오늘의 필사를 시작해보세요.';
  const link  = (payload.fcmOptions  && payload.fcmOptions.link)     || '/';
  return self.registration.showNotification(title, {
    body,
    icon:     '/images/icon_pen_tool.svg',
    badge:    '/images/icon_pen_tool.svg',
    tag:      'lb-reminder',
    renotify: true,
    data:     { url: link }
  });
});

// 알림 클릭 → 앱 열기
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// ── 캐시 전략 ──
const CACHE_NAME = 'letterbrick-v12';
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
          var clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 이미지·폰트·CSS : cache-first
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
