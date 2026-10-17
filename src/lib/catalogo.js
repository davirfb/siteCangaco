// Catálogo público vindo de /api/catalogo (com cache na Vercel), uma vez por página aberta
let pedido = null

export function obterCatalogo() {
  if (!pedido) {
    pedido = fetch('/api/catalogo')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .catch(err => { pedido = null; throw err })
  }
  return pedido
}
