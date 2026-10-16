import { FieldValue } from 'firebase-admin/firestore'
import { rota, exigirAdmin, HttpError } from './_lib/auth.js'
import { blingFetch } from './_lib/bling.js'
import { colClientes, paraCache, sincronizarClientes, ultimaSincronizacao } from './_lib/clientes.js'

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

const pick = (obj, campos) => Object.fromEntries(campos.filter(k => obj?.[k] !== undefined).map(k => [k, obj[k]]))

async function detalhe(id) {
  const [{ data }, snap] = await Promise.all([
    blingFetch(`/contatos/${id}`),
    colClientes().doc(String(id)).get(),
  ])
  await colClientes().doc(String(id)).set(paraCache(data), { merge: true })
  return { ...data, apelido: snap.data()?.apelido ?? '' }
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

  await colClientes().doc(String(id)).set({ apelido: (cliente.apelido ?? '').trim() }, { merge: true })
  return detalhe(id)
}

async function alterarSituacao(id, ativo) {
  const situacao = ativo ? 'A' : 'I'
  await blingFetch(`/contatos/${id}/situacoes`, { method: 'PATCH', body: { situacao } })
  await colClientes().doc(String(id)).set({ situacao, sincronizadoEm: FieldValue.serverTimestamp() }, { merge: true })
  return { id: String(id), situacao }
}

export default rota(['GET', 'POST'], async (req, res) => {
  await exigirAdmin(req)

  if (req.method === 'GET') {
    if (req.query.id) return res.json(await detalhe(req.query.id))
    const [snap, ultimaEm] = await Promise.all([colClientes().get(), ultimaSincronizacao()])
    const clientes = snap.docs.map(d => {
      const { sincronizadoEm, ...dados } = d.data()
      return { id: d.id, ...dados }
    })
    return res.json({ clientes, ultimaSincronizacao: ultimaEm })
  }

  const { acao } = req.body ?? {}
  if (acao === 'sincronizar') return res.json(await sincronizarClientes({ completo: !!req.body.completo }))
  if (acao === 'salvar')      return res.json(await salvar(req.body.cliente))
  if (acao === 'situacao')    return res.json(await alterarSituacao(req.body.id, !!req.body.ativo))
  throw new HttpError(400, 'Ação inválida.')
})
