// Offline cache: everything is saved on the first visit. Bump V to force visitors to re-download changed images/files.
const V = 'ceiko-v2';
const CORE = ['./', 'index.html', 'images/Avatar_Mill.jpg', 'images/Banner_Mill.jpg', 'images/Icon1_Mill.jpg', 'images/Icon2_Mill.jpg', 'images/Icon3_Mill.jpg', 'images/Wallpaper.jpg', 'playlist.csv', 'changelog.json', 'README.md', 'playlist.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'precache') return;
  e.waitUntil((async () => { const c = await caches.open(V); for (const u of e.data.urls) { if (!(await c.match(u))) { try { await c.add(u); } catch (_) {} } } })());
});
async function ranged(req, res) {
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || ''); if (!m) return res;
  const b = await res.blob(), n = b.size;
  const s = m[1] === '' ? Math.max(0, n - +m[2]) : +m[1], en = m[1] !== '' && m[2] !== '' ? Math.min(+m[2], n - 1) : n - 1;
  return new Response(b.slice(s, en + 1), { status: 206, statusText: 'Partial Content', headers: { 'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': 'bytes ' + s + '-' + en + '/' + n, 'Content-Length': String(en + 1 - s), 'Accept-Ranges': 'bytes' } });
}
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(V), hit = await c.match(r.url);
    if (/\.(json|md|txt)$/.test(u.pathname)) {   // changelog + readme: network first so edits show up right away, the saved copy is used offline
      try { const x = await fetch(r); if (x.ok) c.put(r.url, x.clone()); return x; }
      catch (_) { return hit || Response.error(); }
    }
    if (r.mode === 'navigate' || /\.(html|csv)$/.test(u.pathname)) {   // open instantly from cache, refresh in the background
      const fresh = fetch(r).then(x => { if (x.ok) c.put(r.url, x.clone()); return x; });
      if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
      return fresh.catch(async () => (await c.match('index.html')) || Response.error());
    }
    if (hit) return ranged(r, hit);
    if (r.headers.get('range')) { e.waitUntil(c.add(r.url).catch(() => {})); return fetch(r); }  // stream now, save the whole file for next time
    const x = await fetch(r); if (x.ok) c.put(r.url, x.clone()); return x;
  })());
});
