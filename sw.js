// Service worker Griya Aleena Admin
// Strategi: network-first untuk file situs sendiri (update selalu terbaru),
// cache hanya sebagai cadangan saat offline. API (workers.dev) TIDAK pernah di-cache.
const CACHE = 'griya-admin-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // API, R2, font Google → biarkan
  if (url.pathname.startsWith('/config.json')) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          return new Response(
            '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<body style="font-family:sans-serif;text-align:center;padding:48px 24px;color:#1c2e2e">' +
            '<h2>Tidak ada koneksi</h2><p>Sambungkan internet lalu coba lagi.</p>' +
            '<button onclick="location.reload()" style="padding:12px 24px;border:0;border-radius:10px;background:#1a5c5c;color:#fff;font-size:1rem">Muat ulang</button>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
        return Response.error();
      })
  );
});
