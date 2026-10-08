/* Service Worker MelMK v5 — сброс старого кэша */
const CACHE = 'melmk-shell-v12';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/schedule.css',
  './css/week.css',
  './css/effects.css',
  './css/animations.css',
  './css/melmk-ui.css',
  './css/themes.css',
  './css/week-badge-mode.css',
  './js/app.js',
  './js/config.js',
  './js/effects/ui-effects.js',
  './js/models/schedule.js',
  './js/models/bells.js',
  './js/models/substitutions.js',
  './js/storage/store.js',
  './js/utils/time.js',
  './js/utils/toast.js',
  './js/utils/dom.js',
  './js/utils/theme.js',
  './js/utils/share.js',
  './js/utils/pwa.js',
  './js/utils/normalize.js',
  './js/utils/search.js',
  './js/utils/groups-pref.js',
  './js/api/config.js',
  './js/api/client.js',
  './js/api/adapt.js',
  './js/api/sync.js',
  './js/views/lesson.js',
  './js/views/now.js',
  './js/views/day.js',
  './js/views/week.js',
  './js/views/month.js',
  './js/views/empty.js',
  './js/views/browse.js',
  './js/views/bells.js',
  './js/views/group-picker.js',
  './js/views/theme-sheet.js',
  './js/views/export-sheet.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.pathname.includes('/admin')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // HTML и JS — сначала сеть, чтобы телефон не залипал на старом UI
  const isShell = url.pathname.endsWith('.html')
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('.js')
    || url.pathname.endsWith('sw.js');

  if (isShell && url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
