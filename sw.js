const CACHE_NAME = 'adastra-app-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
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
  // API запросы (база данных) всегда из сети
  if (event.request.url.includes('/api/')) return;
  
  // Остальное из кэша для скорости
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
