const CACHE_NAME = 'adastra-app-v6-fix';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-v2.png',
  '/privacy.html',
  '/terms.html',
  '/payment.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // API всегда из сети
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  // Остальное: сначала сеть, если ошибка - кэш
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
