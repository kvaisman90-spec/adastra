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
  
  // 1. ПОЛНОСТЬЮ ИГНОРИРУЕМ превью-домены Vercel, чтобы избежать ошибок CORS и редиректов
  if (url.hostname !== 'adastra-lime.vercel.app' && url.hostname.includes('vercel.app')) {
    return;
  }

  // 2. НЕ кэшируем API запросы
  if (url.pathname.startsWith('/api/')) return;
  
  // 3. НЕ кэшируем Cloudinary
  if (url.hostname.includes('cloudinary.com')) return;
  
  // 4. НЕ кэшируем Resend
  if (url.hostname.includes('resend.com')) return;

  // 5. Обрабатываем остальные запросы
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then(networkResponse => {
        // Если ответ успешный и не является CORS-запросом, сохраняем в кэш
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      }).catch(() => {
        // Если сеть недоступна, для HTML-страниц возвращаем офлайн-страницу
        if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
          return caches.match('/index.html');
        }
        // Для остальных ресурсов (manifest, картинки) возвращаем корректный пустой ответ, 
        // чтобы НЕ было ошибки "Failed to convert value to 'Response'"
        return new Response(null, { status: 404, statusText: 'Not Found' });
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
