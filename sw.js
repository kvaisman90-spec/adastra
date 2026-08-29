const CACHE_NAME = 'adastra-app-v17';
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
  const url = event.request.url;
  
  // НЕ кэшируем API запросы
  if (url.includes('/api/')) return;
  
  // НЕ кэшируем Cloudinary (загрузка файлов с iOS)
  if (url.includes('cloudinary.com')) return;
  
  // НЕ кэшируем Resend
  if (url.includes('resend.com')) return;
  
  // Кэшируем только статику
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(() => {
        if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
