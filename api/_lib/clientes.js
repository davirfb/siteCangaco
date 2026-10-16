import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './firebaseAdmin.js'
import { blingFetch } from './bling.js'

// Cópia local dos contatos do Bling (para listar e autocompletar rápido).
// O Bling é o dono dos dados; só o "apelido" existe apenas aqui.
export const colClientes = () => adminDb.collection('clientes')
// Grupos (redes de filiais) e destaques existem só no site
export const colGrupos   = () => adminDb.collection('grupos_clientes')
const metaDoc = () => adminDb.collection('integracoes').doc('clientesSync')

const esperar = ms => new Promise(r => setTimeout(r, ms))

// Campos da listagem do Bling + alguns da ficha completa, quando disponíveis
export function paraCache(c) {
  const dados = {
    nome:            c.nome ?? '',
    codigo:          c.codigo ?? '',
    situacao:        c.situacao ?? 'A',
    numeroDocumento: (c.numeroDocumento ?? '').replace(/\D/g, ''),
    telefone:        c.telefone ?? '',
    celular:         c.celular ?? '',
    sincronizadoEm:  FieldValue.serverTimestamp(),
  }
  if (c.fantasia !== undefined) dados.fantasia = c.fantasia ?? ''
  if (c.tipo     !== undefined) dados.tipo     = c.tipo
  if (c.email    !== undefined) dados.email    = c.email ?? ''
  if (c.endereco?.geral) {
    dados.municipio = c.endereco.geral.municipio ?? ''
    dados.uf        = c.endereco.geral.uf ?? ''
  }
  return dados
}

// Data no fuso de Brasília, formato aceito pelo Bling: "2026-10-16 18:35:00"
function dataBling(ms) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ms)).map(x => [x.type, x.value])
  )
  return `${p.year}-${p.month}-${p.day} ${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second}`
}

// Traz do Bling os contatos alterados desde a última sincronização (ou todos, se completo).
export async function sincronizarClientes({ completo = false } = {}) {
  const inicio = Date.now()
  const meta = (await metaDoc().get()).data()
  const desde = !completo && meta?.ultimaEm ? meta.ultimaEm - 10 * 60 * 1000 : null

  let pagina = 1
  let total = 0
  while (true) {
    const { data = [] } = await blingFetch('/contatos', {
      query: { pagina, limite: 100, criterio: 1, dataAlteracaoInicial: desde ? dataBling(desde) : undefined },
    })
    if (data.length) {
      const batch = adminDb.batch()
      data.forEach(c => batch.set(colClientes().doc(String(c.id)), paraCache(c), { merge: true }))
      await batch.commit()
      total += data.length
    }
    if (data.length < 100) break
    pagina++
    await esperar(350) // limite do Bling: 3 requisições por segundo
  }

  await metaDoc().set({ ultimaEm: inicio, ...(completo || !meta?.ultimaEm ? { completaEm: inicio } : {}) }, { merge: true })
  return { total, ultimaEm: inicio }
}

export async function ultimaSincronizacao() {
  return (await metaDoc().get()).data()?.ultimaEm ?? null
}
