// Service worker: guarda as telas do site no aparelho para o painel abrir sem internet.
// - Páginas: rede primeiro; sem conexão, usa a última cópia.
// - Arquivos com hash (/assets) e imagens locais: cópia guardada primeiro.
// - Fontes e ícones (CDN) e fotos do Cloudinary: usa a cópia e atualiza em segundo plano.
// - /api e Firebase: nunca passam pelo cache (dados ficam a cargo do app).

const VERSAO = 'cangaco-v1'
const SHELL = ['/', '/index.html']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(k => k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

const EXTERNOS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'res.cloudinary.com']

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Páginas do site (SPA): rede primeiro, cópia guardada se offline
  if (req.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith(
      fetch(req)
        .then(resp => {
          const copia = resp.clone()
          caches.open(VERSAO).then(c => c.put('/index.html', copia))
          return resp
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api/')) return
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/img/')) {
      e.respondWith(
        caches.match(req).then(salvo => salvo || fetch(req).then(resp => {
          if (resp.ok) { const copia = resp.clone(); caches.open(VERSAO).then(c => c.put(req, copia)) }
          return resp
        }))
      )
    }
    return
  }

  if (EXTERNOS.includes(url.hostname)) {
    e.respondWith(
      caches.open(VERSAO).then(c => c.match(req).then(salvo => {
        const rede = fetch(req).then(resp => {
          if (resp.ok || resp.type === 'opaque') c.put(req, resp.clone())
          return resp
        }).catch(() => salvo)
        return salvo || rede
      }))
    )
  }
})
