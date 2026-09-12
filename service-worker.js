/**
 * SERVICE-WORKER.JS - PWA / OFFLINE-FIRST
 * Estratégia: cache-first para estáticos (com revalidação) e
 * network-first para as APIs (/api/*) para nunca perder sincronização.
 * Fontes do Google: cache-first com revalidação (funciona offline após 1ª visita).
 */
const CACHE = 'portal-senai-v3';
const CORE = [
  '/pages/index.html',
  '/pages/dashboard.html',
  '/pages/turma.html',
  '/pages/diario.html',
  '/pages/carometro.html',
  '/pages/mapa.html',
  '/pages/ia.html',
  '/pages/ocorrencias.html',
  '/pages/relatorios.html',
  '/pages/configuracao.html',
  '/pages/materiais.html',
  '/pages/central.html',
  '/pages/calendario.html',
  '/pages/mural.html',
  '/pages/instalacao.html',
  '/css/style.css',
  '/css/features.css',
  '/js/data.js',
  '/js/auth.js',
  '/js/login.js',
  '/js/dashboard.js',
  '/js/turma.js',
  '/js/diario.js',
  '/js/carometro.js',
  '/js/mapa.js',
  '/js/ia.js',
  '/js/ocorrencias.js',
  '/js/relatorios.js',
  '/js/pdf.js',
  '/js/configuracao.js',
  '/js/classroom.js',
  '/js/materiais.js',
  '/js/central.js',
  '/js/calendario.js',
  '/js/mural.js',
  '/js/sidebar.js',
  '/js/vendor/jspdf.umd.min.js',
  '/js/vendor/jspdf.plugin.autotable.min.js',
  '/img/senailogo.png',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/manifest.json'
];

function precacheAll() {
  return caches.open(CACHE).then(cache => {
    return Promise.all(
      CORE.map(url => cache.add(url).catch(() => {}))
    );
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAll().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function staleWhileRevalidate(req) {
  return caches.match(req).then(cached => {
    const network = fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => cached);
    return cached || network;
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // Fontes do Google: cache-first com revalidação em segundo plano.
    if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
      event.respondWith(staleWhileRevalidate(req));
    }
    return;
  }

  // API: network-first, cache de fallback (decisivo: não perder dados offline)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(m => m || Response.error()))
    );
    return;
  }

  // Estáticos: cache-first + revalidação em segundo plano
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached || caches.match('/pages/index.html'));
      return cached || network;
    })
  );
});