// Caché del "app shell" para que funcione sin conexión (el gimnasio suele tener mala cobertura).
const CACHE = 'diario-v12';
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'pdf.js', 'media.js', 'cloud.js', 'backup.js', 'config.js', 'vendor/jspdf.umd.min.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero (para recibir actualizaciones), caché como respaldo.
self.addEventListener('fetch', (e) => {
  // Solo archivos de la propia app. Las peticiones a Google (inicio de sesión, Drive) van directas a la red
  // y nunca se guardan en caché: contienen datos personales.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
