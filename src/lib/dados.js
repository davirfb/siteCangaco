import { api } from './api.js'

// Cache das listas grandes (clientes e pedidos) no navegador.
// Na primeira vez busca tudo; depois pede ao servidor só o que mudou ("?desde="),
// o que poupa leituras do Firestore (o plano gratuito tem limite diário).
// Sem internet (ou em manutenção), devolve a última cópia guardada.

const PREFIXO = 'cache:'
const MARGEM_MS = 60 * 1000 // pega também o que foi gravado perto do último corte
const memoria = {}

function ler(nome) {
  if (memoria[nome]) return memoria[nome]
  try {
    const salvo = JSON.parse(localStorage.getItem(PREFIXO + nome))
    if (salvo) return (memoria[nome] = salvo)
  } catch {}
  return null
}

function gravar(nome, cache) {
  memoria[nome] = cache
  try { localStorage.setItem(PREFIXO + nome, JSON.stringify(cache)) } catch {}
}

// Sem conexão ou servidor fora: usa o que já está guardado (se houver)
async function comFallback(nome, buscar) {
  try {
    return { ...(await buscar()), offline: false }
  } catch (err) {
    const atual = ler(nome)
    if ((err.offline || err.manutencao) && atual) return { ...atual, offline: true }
    throw err
  }
}

async function atualizar(nome, rota, campo, extras) {
  return comFallback(nome, async () => {
    const atual = ler(nome)
    const sep = rota.includes('?') ? '&' : '?'
    const r = await api(atual?.desde ? `${rota}${sep}desde=${atual.desde}` : rota)
    const itens = r.incremental && atual?.itens ? { ...atual.itens } : {}
    r[campo].forEach(x => { itens[x.id] = x })
    const cache = { itens, desde: r.agora - MARGEM_MS, ...extras(r) }
    gravar(nome, cache)
    return cache
  })
}

export async function obterClientes() {
  const c = await atualizar('clientes', '/clientes', 'clientes', r => ({ grupos: r.grupos ?? [], ultimaSincronizacao: r.ultimaSincronizacao }))
  return { clientes: Object.values(c.itens), grupos: c.grupos, ultimaSincronizacao: c.ultimaSincronizacao, offline: c.offline }
}

export async function obterPedidos() {
  const c = await atualizar('pedidos', '/pedidos?recurso=lista', 'pedidos', r => ({ orcamentos: r.orcamentos ?? [], ultimaSincronizacao: r.ultimaSincronizacao }))
  // Pedidos excluídos no Bling ficam marcados no servidor e não aparecem
  return { pedidos: Object.values(c.itens).filter(p => !p.excluido), orcamentos: c.orcamentos, ultimaSincronizacao: c.ultimaSincronizacao, offline: c.offline }
}

export async function obterFormasPagamento() {
  const c = await comFallback('formas', async () => {
    const r = await api('/pedidos?recurso=formasPagamento')
    const cache = { formas: r.formas }
    gravar('formas', cache)
    return cache
  })
  return c.formas ?? []
}

// Ao sair da conta, apaga os dados guardados neste navegador
export function limparCacheDados() {
  Object.keys(memoria).forEach(k => delete memoria[k])
  try {
    Object.keys(localStorage).filter(k => k.startsWith(PREFIXO)).forEach(k => localStorage.removeItem(k))
  } catch {}
}
