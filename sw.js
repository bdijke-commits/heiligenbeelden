// Service worker: maakt de app installeerbaar en bruikbaar zonder internet.
// Verhoog VERSIE als je bestanden aanpast, zodat telefoons de nieuwe versie ophalen.
const VERSIE = 'heiligen-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSIE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Firebase niet onderscheppen
  e.respondWith(
    fetch(e.request)
      .then(res => { if (res.ok) { const k = res.clone(); caches.open(VERSIE).then(c => c.put(e.request, k)) } return res })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
