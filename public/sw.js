// ----------------------------------------------------------------------------
// 뜨개 기록 — Service Worker (manual, no build-time helper)
// ----------------------------------------------------------------------------
// 전략:
//   - install: 앱 shell 미리 캐시 (index.html)
//   - activate: 옛 버전 cache 정리 + 즉시 control
//   - fetch:
//     · navigate (HTML)         → NetworkFirst, 실패 시 cached index.html (SPA fallback)
//     · 동일 origin GET asset   → StaleWhileRevalidate
//     · 외부 (firestore 등)      → SW 우회 (Firestore SDK 가 자체 처리)
//
// ⚠️ CACHE 이름을 안 올리면 옛 캐시가 영영 남는다.
//    activate 는 이름이 다른 캐시만 지우는데, 이름이 늘 같으면 지울 게 없다.
//    그러면 배포를 해도 쓰는 사람은 옛 화면을 계속 보게 된다.
//
//    src/lib/appVersion.ts 의 APP_VERSION 을 올릴 때 이 값도 같이 올릴 것.
//    (빌드가 이 파일을 그대로 복사하므로 여기서 import 할 수 없다)

const CACHE = 'knit-app-v1.8.0';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {
      // app shell 캐싱 실패해도 SW 자체는 등록 진행
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 외부 origin (Firestore / Auth / Google APIs / CDN 등) 은 SW 우회
  if (url.origin !== self.location.origin) return;

  // SPA navigation: NetworkFirst → cache fallback (index.html)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // 동일 origin asset: StaleWhileRevalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && (res.type === 'basic' || res.type === 'default')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
