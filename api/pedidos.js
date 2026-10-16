import { FieldValue } from 'firebase-admin/firestore'
import { rota, exigirAdmin, HttpError } from './_lib/auth.js'
import { blingFetch } from './_lib/bling.js'
import { adminDb } from './_lib/firebaseAdmin.js'

// Pedidos vão para o Bling (com cópia aqui para listas rápidas).
// Orçamentos ficam só no site.
const colPedidos    = () => adminDb.collection('pedidos')
const colOrcamentos = () => adminDb.collection('orcamentos')

const esperar = ms => new Promise(r => setTimeout(r, ms))

// Data local (Brasília) em YYYY-MM-DD, somando dias
function dataISO(diasAMais = 0) {
  const d = new Date(Date.now() + diasAMais * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
}

async function produtosBling() {
  const todos = []
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data = [] } = await blingFetch('/produtos', { query: { pagina, limite: 100, criterio: 2, tipo: 'T' } })
    todos.push(...data.map(p => ({ id: String(p.id), nome: p.nome, codigo: p.codigo ?? '', preco: p.preco ?? 0 })))
    if (data.length < 100) break
    await esperar(350)
  }
  return todos
}

async function formasPagamento() {
  const { data = [] } = await blingFetch('/formas-pagamentos', { query: { limite: 100 } })
  return data
    .filter(f => f.situacao !== 0)
    .map(f => ({ id: String(f.id), descricao: f.descricao, padrao: f.padrao === 1 }))
}

function validarItens(itens) {
  if (!Array.isArray(itens) || itens.length === 0) throw new HttpError(400, 'Adicione ao menos um produto.')
  return itens.map(it => {
    const quantidade = Number(it.quantidade)
    const valor = Number(it.precoUnitario)
    if (!(quantidade > 0)) throw new HttpError(400, `Quantidade inválida em "${it.nome}".`)
    if (!(valor >= 0))     throw new HttpError(400, `Preço inválido em "${it.nome}".`)
    return { ...it, quantidade, precoUnitario: valor }
  })
}

const totalDe = itens => Math.round(itens.reduce((acc, it) => acc + it.quantidade * it.precoUnitario, 0) * 100) / 100

async function criarPedido(p, usuario) {
  if (!p?.cliente?.id) throw new HttpError(400, 'Selecione um cliente cadastrado para criar o pedido no Bling.')
  if (!p.formaPagamentoId) throw new HttpError(400, 'Escolha a forma de pagamento.')
  const itens = validarItens(p.itens)
  const semVinculo = itens.filter(it => !it.blingProdutoId).map(it => it.nome)
  if (semVinculo.length) {
    throw new HttpError(400, `Vincule ao Bling no Catálogo antes de criar o pedido: ${semVinculo.join(', ')}.`)
  }

  const total = totalDe(itens)
  const prazo = Math.max(0, parseInt(p.prazoDias) || 0)
  const entrega = /^\d{4}-\d{2}-\d{2}$/.test(p.dataEntrega ?? '') ? p.dataEntrega : dataISO()

  const corpo = {
    contato:      { id: Number(p.cliente.id) },
    data:         dataISO(),
    dataSaida:    entrega,
    dataPrevista: entrega,
    itens: itens.map(it => ({
      produto:    { id: Number(it.blingProdutoId) },
      quantidade: it.quantidade,
      valor:      it.precoUnitario,
      descricao:  it.nome,
    })),
    parcelas: [{
      dataVencimento: dataISO(prazo),
      valor:          total,
      formaPagamento: { id: Number(p.formaPagamentoId) },
    }],
    observacoes: (p.obs ?? '').trim(),
  }

  const { data } = await blingFetch('/pedidos/vendas', { method: 'POST', body: corpo })
  const id = String(data.id)
  let numero = data.numero ?? null
  if (!numero) {
    try { numero = (await blingFetch(`/pedidos/vendas/${id}`)).data?.numero ?? null } catch {}
  }

  const copia = {
    blingId: id,
    numero,
    situacao: 'aberto',
    cliente: {
      id: String(p.cliente.id), nome: p.cliente.nome ?? '', apelido: p.cliente.apelido ?? '',
      numeroDocumento: p.cliente.numeroDocumento ?? '', grupoId: p.cliente.grupoId ?? null,
    },
    itens,
    total,
    obs: corpo.observacoes,
    formaPagamentoId: String(p.formaPagamentoId),
    prazoDias: prazo,
    dataEntrega: entrega,
    data: corpo.data,
    origem: 'site',
    criadoPor: usuario.email,
    criadoEm: FieldValue.serverTimestamp(),
  }
  await colPedidos().doc(id).set(copia)
  if (p.orcamentoId) await colOrcamentos().doc(String(p.orcamentoId)).set({ convertidoEm: id }, { merge: true })
  return { id, numero, total }
}

async function salvarOrcamento(o, usuario) {
  const nomeCliente = (o?.cliente?.nome || o?.clienteNome || '').trim()
  if (!nomeCliente) throw new HttpError(400, 'Informe o cliente do orçamento.')
  const itens = validarItens(o.itens)
  const ref = o.id ? colOrcamentos().doc(String(o.id)) : colOrcamentos().doc()
  const dados = {
    cliente: o.cliente?.id
      ? { id: String(o.cliente.id), nome: o.cliente.nome ?? '', apelido: o.cliente.apelido ?? '',
          numeroDocumento: o.cliente.numeroDocumento ?? '', grupoId: o.cliente.grupoId ?? null }
      : { id: null, nome: nomeCliente, apelido: '', numeroDocumento: o.clienteDocumento ?? '', grupoId: null },
    itens,
    total: totalDe(itens),
    obs: (o.obs ?? '').trim(),
    formaPagamentoId: o.formaPagamentoId ?? null,
    prazoDias: Math.max(0, parseInt(o.prazoDias) || 0),
    dataEntrega: o.dataEntrega ?? null,
    atualizadoEm: FieldValue.serverTimestamp(),
    atualizadoPor: usuario.email,
  }
  if (!o.id) { dados.criadoEm = FieldValue.serverTimestamp(); dados.criadoPor = usuario.email }
  await ref.set(dados, { merge: true })
  return { id: ref.id, total: dados.total }
}

export default rota(['GET', 'POST'], async (req, res) => {
  const usuario = await exigirAdmin(req)

  if (req.method === 'GET') {
    const { recurso } = req.query
    if (recurso === 'produtosBling')   return res.json({ produtos: await produtosBling() })
    if (recurso === 'formasPagamento') return res.json({ formas: await formasPagamento() })
    throw new HttpError(400, 'Recurso inválido.')
  }

  const { acao } = req.body ?? {}
  if (acao === 'criar')            return res.json(await criarPedido(req.body.pedido, usuario))
  if (acao === 'orcamento_salvar') return res.json(await salvarOrcamento(req.body.orcamento, usuario))
  throw new HttpError(400, 'Ação inválida.')
})
