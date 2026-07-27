/* Zero Lines service worker.
 *
 * The previous version was cache-first for EVERY GET, with a hardcoded cache
 * name ('zero-lines-v1') that was never bumped. Once a visitor loaded the site,
 * they were pinned to that copy of the HTML forever — no deploy could ever
 * reach them again. For a site being actively redesigned that is the worst
 * possible failure mode, and it hides every fix behind "works for me".
 *
 * Strategy now:
 *   - HTML / navigations : network-first, fall back to cache only when offline.
 *     Fresh content always wins; the cache is purely an offline safety net.
 *   - Static assets      : stale-while-revalidate. Instant paint from cache,
 *     refreshed in the background for next time.
 *   - Never cache: non-GET, cross-origin, or anything with a query string
 *     (the ?v= cache-busters, and form posts).
 */

const VERSION = 'zl-2026-07-28a';
const HTML_CACHE = `zl-html-${VERSION}`;
const ASSET_CACHE = `zl-assets-${VERSION}`;

const PRECACHE = ['/', '/assets/zl.css'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ASSET_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {})            // a failed precache must never block activation
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== HTML_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isHTML(request) {
  return request.mode === 'navigate'
    || (request.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // let cross-origin through untouched

  // ---- HTML: network-first -------------------------------------------------
  if (isHTML(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(HTML_CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // ---- Assets: stale-while-revalidate -------------------------------------
  if (url.search) return;         // versioned URLs fetch normally

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
