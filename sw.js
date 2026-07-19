// VELA_CHAMCONG — Service Worker v4
const CACHE = 'vela-cc-v4';
const ASSETS = ['/VELA_CHAMCONG/', '/VELA_CHAMCONG/index.html', '/VELA_CHAMCONG/css/main.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (/chrome-extension|supabase\.co|googleapis\.com/.test(e.request.url)) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.status === 200) {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
