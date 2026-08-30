const CACHE_NAME = 'adastra-app-v18';
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
        ASSETS.map(url => {
          return fetch(url).then(response => {
            if (response.ok) {
              return cache.put(url, response);
            }
          }).catch(() => {
            // Игнорируем ошибки кэширования
          });
        })
      );
    }).catch(() => {
      // Игнорируем ошибки открытия кэша
    })
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
  
  // НЕ кэшируем API запросы
  if (url.pathname.startsWith('/api/')) return;
  
  // НЕ кэшируем Cloudinary
  if (url.hostname.includes('cloudinary.com')) return;
  
  // НЕ кэшируем Resend
  if (url.hostname.includes('resend.com')) return;
  
  // НЕ кэшируем Vercel SSO и превью домены
  if (url.hostname.includes('vercel.app') && url.pathname.includes('manifest.json')) {
    return;
  }
  
  // Кэшируем только статику
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }
      return fetch(event.request).then(response => {
        if (!response.ok || response.status !== 200) {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache).catch(() => {
            // Игнорируем ошибки
          });
        });
        return response;
      }).catch(() => {
        if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html').catch(() => {});
        }
      });
    }).catch(() => {})
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
