const CACHE_NAME = 'kfm-delice-v2';
const STATIC_ASSETS = [
  '/',
  '/menu',
  '/reservation',
  '/tracking',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png',
];

// API cache (short-lived, for menu/reviews data)
const API_CACHE_NAME = 'kfm-api-v1';
const API_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first with cache fallback, API caching for GET
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Cache API GET requests (menu, reviews, tracking) for 5 minutes
  if (url.pathname.startsWith('/api/')) {
    const cacheableAPIs = ['/api/menu', '/api/reviews', '/api/tracking'];
    const isCacheable = cacheableAPIs.some((path) => url.pathname.startsWith(path));

    if (isCacheable) {
      event.respondWith(
        caches.open(API_CACHE_NAME).then((cache) => {
          return cache.match(event.request).then((cached) => {
            if (cached) {
              const age = Date.now() - parseInt(cached.headers.get('sw-cache-time') || '0');
              if (age < API_CACHE_TTL) {
                return cached;
              }
            }
            return fetch(event.request)
              .then((response) => {
                if (response.ok) {
                  const responseClone = response.clone();
                  const headers = new Headers(responseClone.headers);
                  headers.set('sw-cache-time', Date.now().toString());
                  const cachedResponse = new Response(responseClone.body, {
                    status: responseClone.status,
                    statusText: responseClone.statusText,
                    headers,
                  });
                  cache.put(event.request, cachedResponse);
                }
                return response;
              })
              .catch(() => cached || new Response(JSON.stringify({ error: 'Hors ligne' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              }));
          });
        })
      );
      return;
    }

    // Non-cacheable API calls: network only
    return;
  }

  // Static assets: cache-first
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|ico|css|js|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Pages: network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('/').then((fallback) => {
            return fallback || new Response('Hors ligne — Vérifiez votre connexion internet', {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
          });
        });
      })
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'KFM Delice';
  const options = {
    body: data.body || 'Nouvelle notification',
    icon: '/images/icon-192.png',
    badge: '/images/icon-192.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: 'Ouvrir' },
      { action: 'close', title: 'Fermer' },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

// Background sync for offline order submission (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    // In production: replay failed order submissions
    console.log('[SW] Background sync: sync-orders');
  }
});
