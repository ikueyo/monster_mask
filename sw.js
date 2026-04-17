/* 怪物變身鏡 — Service Worker
   策略：本地檔案 cache-first，CDN 資源 network-first + fallback
*/
const CACHE = 'monster-mask-v4';
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ── 安裝：快取本地資源 ──────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(LOCAL_ASSETS))
    // 不在此呼叫 skipWaiting()，改由頁面主動觸發（讓用戶確認後再更新）
  );
});

// ── 啟用：清除舊版快取 ──────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── 接收頁面訊息：用戶確認後跳過等待 ─────────────
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── 攔截請求 ────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 只處理 GET 請求
  if (e.request.method !== 'GET') return;

  // 同源（本地檔案）：cache-first
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // CDN 資源（MediaPipe、p5.js）：network-first，失敗時回傳快取
  if (
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
