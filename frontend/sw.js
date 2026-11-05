// Public shell only. Authenticated data is never cached here.
const CACHE='melmk-shell-v38-clean-labels';
const ASSETS=["./", "./index.html", "./manifest.json", "./css/animations.css", "./css/base.css", "./css/effects.css", "./css/layout.css", "./css/melmk-ui.css", "./css/moods/bordeaux.css", "./css/moods/coral.css", "./css/moods/dusk.css", "./css/moods/graphite.css", "./css/moods/indigo.css", "./css/moods/lavender.css", "./css/moods/mint.css", "./css/moods/ocean.css", "./css/moods/sand.css", "./css/moods/sky.css", "./css/schedule.css", "./css/themes.css", "./css/variables.css", "./css/week-badge-mode.css", "./css/week.css", "./js/api/adapt.js", "./js/api/client.js", "./js/api/config.js", "./js/api/overrides.js", "./js/api/sync.js", "./js/app.js", "./js/config.js", "./js/data/demo.js", "./js/effects/ui-effects.js", "./js/export/export.js", "./js/models/bell-state.js", "./js/models/bells.js", "./js/models/schedule.js", "./js/models/substitutions.js", "./js/parser/mapper.js", "./js/storage/store.js", "./js/storage/api-snapshot.js", "./js/utils/audit.js", "./js/utils/auth.js", "./js/utils/dom.js", "./js/utils/groups-pref.js", "./js/utils/normalize.js", "./js/utils/pwa.js", "./js/utils/search.js", "./js/utils/share.js", "./js/utils/theme.js", "./js/utils/time.js", "./js/utils/sync-status.js", "./js/utils/toast.js", "./js/views/bells.js", "./js/views/browse.js", "./js/views/day.js", "./js/views/empty.js", "./js/views/export-sheet.js", "./js/views/group-picker.js", "./js/views/lesson.js", "./js/views/month.js", "./js/views/now.js", "./js/views/stats.js", "./js/views/theme-sheet.js", "./js/views/week.js", "./fonts/jetbrains-mono-600.woff2", "./fonts/jetbrains-mono-700.woff2", "./fonts/manrope-cyr-400.woff2", "./fonts/manrope-cyr-600.woff2", "./fonts/manrope-cyr-700.woff2", "./fonts/manrope-cyr-800.woff2", "./fonts/manrope-latin-400.woff2", "./fonts/manrope-latin-600.woff2", "./fonts/manrope-latin-700.woff2", "./fonts/manrope-latin-800.woff2", "./fonts/plus-jakarta-sans-400.woff2", "./fonts/plus-jakarta-sans-600.woff2", "./fonts/plus-jakarta-sans-700.woff2", "./fonts/plus-jakarta-sans-800.woff2", "./fonts/plus-jakarta-sans-cyr-ext-400.woff2", "./fonts/plus-jakarta-sans-cyr-ext-600.woff2", "./fonts/plus-jakarta-sans-cyr-ext-700.woff2", "./fonts/plus-jakarta-sans-cyr-ext-800.woff2", "./icons/icon-192.png", "./icons/icon-180.png", "./icons/icon-512.png", "./icons/icon-32.png", "./icons/favicon.ico"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('melmk-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/admin/')||url.pathname.startsWith('/teacher/'))return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).catch(()=>caches.match('./index.html')));return;
 }
 // Ignore version query strings when matching the precached shell.
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const cached=await cache.match(req,{ignoreSearch:true});if(cached)return cached;
  return fetch(req);
 }));
});
