/* Panhandle service worker — minimal, install-enabler only.
 *
 * Android Chrome offers the real "Install app" (WebAPK, standalone) path only
 * when a service worker with a fetch handler is registered. Without one you get
 * a plain "Add to home screen" shortcut instead. This SW exists solely to
 * satisfy that criterion.
 *
 * It deliberately does NOT cache anything: every request goes straight to the
 * network, so there's zero risk of serving a stale app shell after a Cloudflare
 * deploy, and nothing here can interfere with the /api + /seed calls or the
 * X-Refresh-Token response header the app relies on. A real offline app-shell
 * (precache + stale-while-revalidate) is a separate, bigger follow-up
 * (see docs/ui-review-plan.md U12). */

self.addEventListener('install', () => {
  // Activate this SW immediately rather than waiting for existing tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Only touch top-level navigations, and only to pass them straight to the
  // network. Everything else uses the browser's default path untouched. Having
  // this handler at all is what makes the app installable.
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request));
});
