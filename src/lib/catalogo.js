import { avisarManutencao } from './api.js'

// Catálogo público vindo de /api/catalogo (com cache na Vercel), uma vez por página aberta
let pedido = null

export function obterCatalogo() {
  if (!pedido) {
    pedido = fetch('/api/catalogo')
      .then(r => {
        // Falha do servidor: mostra a faixa de manutenção no site
        if (!r.ok) { if (r.status >= 500) avisarManutencao(true); throw new Error(`HTTP ${r.status}`) }
        return r.json()
      })
      .catch(err => { pedido = null; throw err })
  }
  return pedido
}
