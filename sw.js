const CACHE_NAME = 'adastra-app-v16'; // <-- ВАЖНО: версия изменена для сброса кэша
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-v2.png',
  '/robots.txt',
  '/sitemap.xml',
  '/privacy.html',
  '/terms.html',
  '/payment.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/')) return;
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
