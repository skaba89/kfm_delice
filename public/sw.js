// KFM Delice Service Worker — PWA offline support
// Caches static assets + API responses for offline use.
//
// Mission P1.2: Kitchen offline mode — caches /api/kitchen responses
// so the kitchen tablet can keep displaying active tickets during a
// network outage. PATCH requests (status updates) are queued and
// replayed when connectivity returns (see KitchenDashboard.tsx
// offline-queue logic).

const CACHE_NAME = 'kfm-delice-v2';
const STATIC_CACHE = `${CACHE_NAME}-static`;
const API_CACHE = `${CACHE_NAME}-api`;

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/menu',
  '/manifest.json',
];

// API routes that can be cached (GET only)
const CACHEABLE_API = [
  '/api/menu',
  '/api/restaurant',
  '/api/status',
  '/api/kitchen', // Mission P1.2: kitchen tickets available offline
];

// ── Install: cache static assets ───────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ─────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith('kfm-delice-') && name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for static, network-first for API ──────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // API requests: network-first, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    const isCacheable = CACHEABLE_API.some((route) => url.pathname.startsWith(route));
    if (!isCacheable) return;

    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// ── Push notifications ─────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'KFM Delice', body: event.data?.text() || '' };
  }

  const title = data.title || 'KFM Delice';
  const options = {
    body: data.body || 'Nouvelle notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data.url ? { url: data.url } : {},
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ─────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/admin';
  event.waitUntil(self.clients.openWindow(url));
});
