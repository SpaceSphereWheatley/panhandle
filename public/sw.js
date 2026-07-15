/* Panhandle service worker — app-shell caching for real offline support.
 *
 * All /api/* requests are always passed straight to the network, untouched:
 * they carry the auth/X-Refresh-Token flow and must never be
 * served from or written to cache. Everything else (the app shell —
 * app.html plus its hashed JS/CSS/image assets) uses stale-while-revalidate:
 * respond from cache immediately if available (instant load, works offline),
 * then refresh the cache from the network in the background for next time.
 */

const CACHE_NAME = 'panhandle-shell-v1';

self.addEventListener('install', () => {
  // Activate this SW immediately rather than waiting for existing tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
