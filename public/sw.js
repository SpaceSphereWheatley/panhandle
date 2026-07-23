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

  // The app shell document is the one cached response whose *content*
  // changes across deploys — it references Vite's content-hashed JS/CSS
  // filenames, which are different every build, and the previous build's
  // filenames stop existing on the server once a new deploy replaces
  // dist/. Serving it stale-while-revalidate like the hashed assets below
  // could hand a reload a stale app.html pointing at asset filenames the
  // current deploy no longer serves (404s, React never mounts) — that's
  // what caused the "update toast reloads into a white screen, only fixed
  // by fully closing and reopening the app" bug. Network-first (falling
  // back to cache only when actually offline) keeps offline support while
  // making a reload always resolve a consistent, current shell+asset set.
  //
  // /CHANGELOG.md is in the same boat: unlike the content-hashed assets, its
  // *content* changes across deploys under a stable URL, so stale-while-
  // revalidate would serve the previous deploy's copy on the first fetch
  // after a deploy — exactly when the "Hva er nytt" changelog modal
  // auto-opens (useDeployVersionCheck fires on the first load of the new
  // build), leaving it one version behind. Network-first keeps it current
  // there while still falling back to cache offline.
  if (request.mode === 'navigate' || url.pathname === '/app.html' || url.pathname === '/CHANGELOG.md') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

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

/* Web Push (TODO #7 phase 1). Payloads are kept minimal (title/body/url —
 * see runReminderPass in worker/index.js), so no assumptions here about
 * richer content. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* malformed/empty payload: fall back to generic text below */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Panhandle', {
      body: data.body || '',
      icon: '/icon-192.png',
      // Android masks the status-bar badge down to its alpha channel alone
      // and fills the silhouette itself — icon-192.png is fully opaque, so
      // reusing it here rendered as a plain solid square. This is a
      // dedicated white-on-transparent silhouette (rasterized from the same
      // panhandle-icon.svg mark) built for that masking.
      badge: '/badge-monochrome.png',
      data: { url: data.url || '/app.html' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/app.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((c) => new URL(c.url).pathname === url);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});

// Browsers can silently rotate/invalidate a subscription (key rotation,
// storage eviction) outside of any 404/410 the server would ever see. A
// service worker has no access to this app's auth token (it lives in
// localStorage, which isn't reachable from here), so this only keeps the
// *browser-level* registration alive — the new endpoint reaches the server
// the next time the app is opened, via PushContext's refresh() (see
// src/context/PushContext.jsx), whose upsert-by-endpoint design makes that
// re-sync a harmless no-op if nothing actually changed.
self.addEventListener('pushsubscriptionchange', (event) => {
  const applicationServerKey = event.oldSubscription?.options?.applicationServerKey;
  event.waitUntil(
    self.registration.pushManager.subscribe(
      applicationServerKey ? { userVisibleOnly: true, applicationServerKey } : { userVisibleOnly: true }
    )
  );
});
