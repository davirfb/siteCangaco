import { FieldValue } from 'firebase-admin/firestore'
import { rota, exigirAdmin, HttpError } from './_lib/auth.js'
import { blingFetch } from './_lib/bling.js'
import { colClientes, colGrupos, paraCache, sincronizarClientes, ultimaSincronizacao } from './_lib/clientes.js'
import { adminDb } from './_lib/firebaseAdmin.js'

// Campos aceitos pelo Bling ao criar/alterar um contato (POST/PUT /contatos)
const CAMPOS_BLING = [
  'nome', 'codigo', 'situacao', 'numeroDocumento', 'telefone', 'celular', 'fantasia', 'tipo',
  'indicadorIe', 'ie', 'rg', 'inscricaoMunicipal', 'orgaoEmissor', 'email', 'emailNotaFiscal',
  'orgaoPublico', 'endereco', 'vendedor', 'dadosAdicionais', 'financeiro', 'pais', 'tiposContato', 'pessoasContato',
]
// Campos que o formulário do site edita
const CAMPOS_FORM = [
  'nome', 'fantasia', 'tipo', 'numeroDocumento', 'indicadorIe', 'ie',
  'email', 'emailNotaFiscal', 'telefone', 'celular',
]

const limparDestaques = lista => [...new Set((Array.isArray(lista) ? lista : []).map(d => String(d).trim()).filter(Boolean))].slice(0, 20)

// Campos que existem só no site
function camposSite(c) {
  return { apelido: c?.apelido ?? '', destaques: c?.destaques ?? [], grupoId: c?.grupoId ?? null }
}

const pick = (obj, campos) => Object.fromEntries(campos.filter(k => obj?.[k] !== undefined).map(k => [k, obj[k]]))

async function detalhe(id) {
  const [{ data }, snap] = await Promise.all([
    blingFetch(`/contatos/${id}`),
    colClientes().doc(String(id)).get(),
  ])
  await colClientes().doc(String(id)).set(paraCache(data), { merge: true })
  return { ...data, ...camposSite(snap.data()) }
}

async function salvar(cliente) {
  if (!cliente?.nome?.trim()) throw new HttpError(400, 'Informe o nome do cliente.')

  const campos = pick(cliente, CAMPOS_FORM)
  campos.nome = campos.nome.trim()
  if (campos.numeroDocumento !== undefined) campos.numeroDocumento = String(campos.numeroDocumento).replace(/\D/g, '')
  if (campos.indicadorIe !== undefined) campos.indicadorIe = Number(campos.indicadorIe)
  const geral = cliente.endereco?.geral ?? {}

  let id = cliente.id
  if (id) {
    // PUT substitui o contato inteiro: parte da ficha atual e aplica só o que o formulário mudou
    const { data: atual } = await blingFetch(`/contatos/${id}`)
    const corpo = {
      ...pick(atual, CAMPOS_BLING),
      ...campos,
      endereco: { ...atual.endereco, geral: { ...atual.endereco?.geral, ...geral } },
    }
    await blingFetch(`/contatos/${id}`, { method: 'PUT', body: corpo })
  } else {
    const { data } = await blingFetch('/contatos', {
      method: 'POST',
      body: { tipo: 'J', ...campos, situacao: 'A', endereco: { geral } },
    })
    id = data.id
  }

  await colClientes().doc(String(id)).set({
    apelido:   (cliente.apelido ?? '').trim(),
    destaques: limparDestaques(cliente.destaques),
    grupoId:   cliente.grupoId || null,
  }, { merge: true })
  return detalhe(id)
}

async function alterarSituacao(id, ativo) {
  const situacao = ativo ? 'A' : 'I'
  await blingFetch(`/contatos/${id}/situacoes`, { method: 'PATCH', body: { situacao } })
  await colClientes().doc(String(id)).set({ situacao, sincronizadoEm: FieldValue.serverTimestamp() }, { merge: true })
  return { id: String(id), situacao }
}

// Cria ou altera um grupo (rede) e define quais clientes (filiais) fazem parte dele
async function salvarGrupo(grupo) {
  const nome = (grupo?.nome ?? '').trim()
  if (!nome) throw new HttpError(400, 'Informe o nome do grupo.')
  const ref = grupo.id ? colGrupos().doc(grupo.id) : colGrupos().doc()
  const membros = new Set((grupo.clienteIds ?? []).map(String))

  const batch = adminDb.batch()
  batch.set(ref, { nome, destaques: limparDestaques(grupo.destaques) }, { merge: true })
  const atuais = await colClientes().where('grupoId', '==', ref.id).get()
  atuais.docs.forEach(d => { if (!membros.has(d.id)) batch.set(d.ref, { grupoId: null }, { merge: true }) })
  membros.forEach(id => batch.set(colClientes().doc(id), { grupoId: ref.id }, { merge: true }))
  await batch.commit()
  return { id: ref.id, nome, destaques: limparDestaques(grupo.destaques), clienteIds: [...membros] }
}

async function excluirGrupo(id) {
  const batch = adminDb.batch()
  const membros = await colClientes().where('grupoId', '==', id).get()
  membros.docs.forEach(d => batch.set(d.ref, { grupoId: null }, { merge: true }))
  batch.delete(colGrupos().doc(id))
  await batch.commit()
  return { ok: true }
}

export default rota(['GET', 'POST'], async (req, res) => {
  await exigirAdmin(req)

  if (req.method === 'GET') {
    if (req.query.id) return res.json(await detalhe(req.query.id))
    const [snap, gruposSnap, ultimaEm] = await Promise.all([colClientes().get(), colGrupos().get(), ultimaSincronizacao()])
    const clientes = snap.docs.map(d => {
      const { sincronizadoEm, ...dados } = d.data()
      return { id: d.id, ...dados }
    })
    const grupos = gruposSnap.docs.map(d => ({ id: d.id, destaques: [], ...d.data() }))
    return res.json({ clientes, grupos, ultimaSincronizacao: ultimaEm })
  }

  const { acao } = req.body ?? {}
  if (acao === 'sincronizar') return res.json(await sincronizarClientes({ completo: !!req.body.completo }))
  if (acao === 'salvar')      return res.json(await salvar(req.body.cliente))
  if (acao === 'situacao')    return res.json(await alterarSituacao(req.body.id, !!req.body.ativo))
  if (acao === 'grupo_salvar')  return res.json(await salvarGrupo(req.body.grupo))
  if (acao === 'grupo_excluir') return res.json(await excluirGrupo(req.body.id))
  throw new HttpError(400, 'Ação inválida.')
})
