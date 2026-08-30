const CACHE_NAME = 'adastra-app-v19';
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
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        ASSETS.map(url => 
          fetch(url).then(response => {
            if (response.ok) {
              return cache.put(url, response);
            }
          }).catch(() => {})
        )
      );
    }).catch(() => {})
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
  const url = new URL(event.request.url);
  
  // НЕ кэшируем API
  if (url.pathname.startsWith('/api/')) return;
  
  // НЕ кэшируем Cloudinary
  if (url.hostname.includes('cloudinary.com')) return;
  
  // НЕ кэшируем Resend
  if (url.hostname.includes('resend.com')) return;
  
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then(networkResponse => {
        // Проверяем что ответ валиден
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache).catch(() => {});
        });
        
        return networkResponse;
      }).catch(error => {
        // Для HTML возвращаем index.html
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        // Для остальных ресурсов возвращаем пустой ответ вместо undefined
        return new Response('', { status: 404 });
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
