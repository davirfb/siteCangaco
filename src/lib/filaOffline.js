import { api } from './api.js'

// Fila de pedidos/orçamentos salvos sem internet. Fica no aparelho (localStorage)
// e é enviada ao servidor quando a conexão volta. Cada item tem uma chave única,
// então reenviar nunca duplica o pedido no Bling.

const CHAVE = 'fila:pedidos'

export function lerFila() {
  try { return JSON.parse(localStorage.getItem(CHAVE)) ?? [] } catch { return [] }
}

function gravarFila(fila) {
  try { localStorage.setItem(CHAVE, JSON.stringify(fila)) } catch {}
  window.dispatchEvent(new CustomEvent('cangaco:fila', { detail: fila }))
}

// corpo: o mesmo enviado a /api/pedidos ({ acao: 'criar' | 'editar' | 'orcamento_salvar', ... })
export function enfileirar({ corpo, resumo }) {
  const id = corpo.pedido?.chave ?? corpo.orcamento?.chave ?? crypto.randomUUID()
  const fila = lerFila().filter(i => i.id !== id)
  fila.push({ id, corpo, resumo, criadoEm: Date.now(), erro: null })
  gravarFila(fila)
}

export function removerDaFila(id) {
  gravarFila(lerFila().filter(i => i.id !== id))
}

let processando = false

// Envia o que estiver na fila. Para no primeiro sinal de falta de conexão/manutenção.
// Itens recusados pelo servidor (ex.: produto sem vínculo) ficam com o erro para correção.
export async function processarFila() {
  if (processando || !navigator.onLine) return []
  processando = true
  const enviados = []
  try {
    for (const item of lerFila()) {
      if (item.erro) continue
      try {
        const r = await api('/pedidos', { method: 'POST', body: item.corpo })
        removerDaFila(item.id)
        enviados.push({ item, r })
      } catch (err) {
        if (err.offline || err.manutencao) break
        gravarFila(lerFila().map(i => i.id === item.id ? { ...i, erro: err.message } : i))
      }
    }
  } finally {
    processando = false
  }
  if (enviados.length) window.dispatchEvent(new CustomEvent('cangaco:filaEnviada', { detail: enviados }))
  return enviados
}

// Tenta de novo um item que tinha dado erro
export function liberarParaReenvio(id) {
  gravarFila(lerFila().map(i => i.id === id ? { ...i, erro: null } : i))
}
