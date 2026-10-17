import { api } from './api.js'

// Cache das listas grandes (clientes e pedidos) no navegador.
// Na primeira vez busca tudo; depois pede ao servidor só o que mudou ("?desde="),
// o que poupa leituras do Firestore (o plano gratuito tem limite diário).

const PREFIXO = 'cache:'
const MARGEM_MS = 60 * 1000 // pega também o que foi gravado perto do último corte
const memoria = {}

function ler(nome) {
  if (memoria[nome]) return memoria[nome]
  try {
    const salvo = JSON.parse(localStorage.getItem(PREFIXO + nome))
    if (salvo?.itens) return (memoria[nome] = salvo)
  } catch {}
  return null
}

function gravar(nome, cache) {
  memoria[nome] = cache
  try { localStorage.setItem(PREFIXO + nome, JSON.stringify(cache)) } catch {}
}

async function atualizar(nome, rota, campo, extras) {
  const atual = ler(nome)
  const sep = rota.includes('?') ? '&' : '?'
  const r = await api(atual?.desde ? `${rota}${sep}desde=${atual.desde}` : rota)
  const itens = r.incremental && atual ? { ...atual.itens } : {}
  r[campo].forEach(x => { itens[x.id] = x })
  const cache = { itens, desde: r.agora - MARGEM_MS, ...extras(r) }
  gravar(nome, cache)
  return cache
}

// Atualiza um item no cache depois de uma alteração feita na própria página
export function atualizarNoCache(nome, item) {
  const atual = ler(nome)
  if (!atual || !item?.id) return
  gravar(nome, { ...atual, itens: { ...atual.itens, [item.id]: { ...(atual.itens[item.id] ?? {}), ...item } } })
}

export async function obterClientes() {
  const c = await atualizar('clientes', '/clientes', 'clientes', r => ({ grupos: r.grupos ?? [], ultimaSincronizacao: r.ultimaSincronizacao }))
  return { clientes: Object.values(c.itens), grupos: c.grupos, ultimaSincronizacao: c.ultimaSincronizacao }
}

export async function obterPedidos() {
  const c = await atualizar('pedidos', '/pedidos?recurso=lista', 'pedidos', r => ({ orcamentos: r.orcamentos ?? [], ultimaSincronizacao: r.ultimaSincronizacao }))
  return { pedidos: Object.values(c.itens), orcamentos: c.orcamentos, ultimaSincronizacao: c.ultimaSincronizacao }
}

// Ao sair da conta, apaga os dados guardados neste navegador
export function limparCacheDados() {
  Object.keys(memoria).forEach(k => delete memoria[k])
  try {
    Object.keys(localStorage).filter(k => k.startsWith(PREFIXO)).forEach(k => localStorage.removeItem(k))
  } catch {}
}
