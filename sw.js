const CACHE_NAME = 'adastra-app-v6';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-star.png',
  '/icon-v2.png',
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
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // API запросы никогда не кэшируются
  if (event.request.url.includes('/api/')) return;

  // Для навигации (HTML) используем NetworkFirst, чтобы меню было актуальным
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Для статики (CSS, JS, IMG) - CacheFirst
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
