import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { rota, exigirAdmin, HttpError } from './_lib/auth.js'
import { blingFetch } from './_lib/bling.js'
import {
  colPedidos, colOrcamentos, esperar, situacoesVendas, classificar, idSituacao,
  detalharPedido, sincronizarPedidos, ultimaSincronizacaoPedidos, lerNota, notaAutorizada,
} from './_lib/pedidos.js'

// Pedidos vão para o Bling (com cópia no Firestore para listas rápidas).
// Orçamentos ficam só no site.

// Data local (Brasília) em YYYY-MM-DD, somando dias
function dataISO(diasAMais = 0) {
  const d = new Date(Date.now() + diasAMais * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
}

// Timestamps do Firestore → milissegundos (para o navegador)
function serializar(obj) {
  if (obj instanceof Timestamp) return obj.toMillis()
  if (Array.isArray(obj)) return obj.map(serializar)
  if (obj && typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serializar(v)]))
  return obj
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

async function naturezas() {
  const { data = [] } = await blingFetch('/naturezas-operacoes', { query: { limite: 100 } })
  return data.map(n => ({ id: String(n.id), descricao: n.descricao, padrao: n.padrao ?? null }))
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

const resumoCliente = c => ({
  id: c.id ? String(c.id) : null, nome: c.nome ?? '', apelido: c.apelido ?? '',
  numeroDocumento: c.numeroDocumento ?? '', grupoId: c.grupoId ?? null,
})

// Monta itens/parcelas/datas no formato do Bling a partir do formulário do site
function corpoBling(p) {
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
  return {
    itens, total, prazo, entrega,
    corpo: {
      contato:      { id: Number(p.cliente.id) },
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
    },
  }
}

async function criarPedido(p, usuario) {
  const { itens, total, prazo, entrega, corpo } = corpoBling(p)
  corpo.data = dataISO()

  const { data } = await blingFetch('/pedidos/vendas', { method: 'POST', body: corpo })
  const id = String(data.id)
  let numero = data.numero ?? null
  if (!numero) {
    try { numero = (await blingFetch(`/pedidos/vendas/${id}`)).data?.numero ?? null } catch {}
  }

  await colPedidos().doc(id).set({
    blingId: id, numero, situacao: 'aberto', situacaoNome: 'Em aberto',
    cliente: resumoCliente(p.cliente),
    itens, total, obs: corpo.observacoes,
    formaPagamentoId: String(p.formaPagamentoId), prazoDias: prazo, dataEntrega: entrega,
    data: corpo.data, dataPrevista: entrega,
    origem: 'site', criadoPor: usuario.email, criadoEm: FieldValue.serverTimestamp(), detalheEm: Date.now(),
  }, { merge: true })
  if (p.orcamentoId) await colOrcamentos().doc(String(p.orcamentoId)).set({ convertidoEm: id, convertidoNumero: numero }, { merge: true })
  return { id, numero, total }
}

// Altera um pedido em aberto: o PUT do Bling substitui o pedido inteiro,
// então parte da ficha atual e troca itens, parcelas, datas e observações
async function editarPedido(id, p, usuario) {
  const { data: atual } = await blingFetch(`/pedidos/vendas/${id}`)
  const situacoes = await situacoesVendas()
  const nome = situacoes.find(s => s.id === String(atual.situacao?.id))?.nome ?? ''
  if (classificar(nome) !== 'aberto') throw new HttpError(409, `Só pedidos em aberto podem ser alterados (este está "${nome}").`)

  const { itens, total, prazo, entrega, corpo } = corpoBling(p)
  const { id: _id, numero: _num, situacao: _sit, notaFiscal: _nf, total: _t, totalProdutos: _tp, ...base } = atual
  await blingFetch(`/pedidos/vendas/${id}`, { method: 'PUT', body: { ...base, ...corpo } })

  await colPedidos().doc(String(id)).set({
    cliente: resumoCliente(p.cliente), itens, total, obs: corpo.observacoes,
    formaPagamentoId: String(p.formaPagamentoId), prazoDias: prazo, dataEntrega: entrega, dataPrevista: entrega,
    alteradoPor: usuario.email, alteradoEm: FieldValue.serverTimestamp(), detalheEm: Date.now(),
  }, { merge: true })
  return { id: String(id), numero: atual.numero, total }
}

async function mudarSituacao(id, destino) {
  if (!['concluido', 'cancelado', 'aberto'].includes(destino)) throw new HttpError(400, 'Situação inválida.')
  const idSit = await idSituacao(destino)
  await blingFetch(`/pedidos/vendas/${id}/situacoes/${idSit}`, { method: 'PATCH' })
  const nome = (await situacoesVendas()).find(s => s.id === idSit)?.nome ?? ''
  await colPedidos().doc(String(id)).set({ situacaoId: idSit, situacaoNome: nome, situacao: destino }, { merge: true })
  return { id: String(id), situacao: destino, situacaoNome: nome }
}

// Garante itens carregados (para PDFs e detalhes); busca no Bling os que faltam
async function detalhes(ids) {
  const lista = [...new Set((ids ?? []).map(String))].slice(0, 200)
  const out = []
  for (const id of lista) {
    const snap = await colPedidos().doc(id).get()
    const d = snap.data()
    if (d?.itens?.length && d.detalheEm) { out.push({ id, ...d }); continue }
    out.push(await detalharPedido(id))
    await esperar(350)
  }
  return out.map(serializar)
}

/* ── Notas fiscais ── */
async function gerarNota(id, tipo) {
  if (!['nfe', 'nfce'].includes(tipo)) throw new HttpError(400, 'Tipo de nota inválido.')
  const ref = colPedidos().doc(String(id))
  const atual = (await ref.get()).data()
  const nota = atual?.nota
  if (nota?.id && ![2, 4, 9].includes(Number(nota.situacao))) {
    throw new HttpError(409, `Este pedido já tem ${nota.tipo === 'nfce' ? 'NFC-e' : 'NF-e'}${nota.numero ? ' nº ' + nota.numero : ''} (${nota.situacaoTexto || 'pendente'}).`)
  }

  const r = await blingFetch(`/pedidos/vendas/${id}/gerar-${tipo}`, { method: 'POST' })
  const notaId = r?.data?.idNotaFiscal ?? r?.idNotaFiscal ?? r?.data?.id
  if (!notaId) throw new HttpError(502, 'O Bling não informou a nota gerada.')
  const nova = await lerNota(tipo, notaId)
  await ref.set({ nota: nova }, { merge: true })

  let naturezaNome = null
  if (nova.naturezaOperacao) {
    try { naturezaNome = (await naturezas()).find(n => n.id === nova.naturezaOperacao)?.descricao ?? null } catch {}
  }
  return { nota: nova, naturezaNome }
}

async function enviarNota(id) {
  const ref = colPedidos().doc(String(id))
  const nota = (await ref.get()).data()?.nota
  if (!nota?.id) throw new HttpError(409, 'Gere a nota antes de enviar.')
  if (notaAutorizada(nota.situacao)) return { nota }

  let erroEnvio = null
  try {
    await blingFetch(`/${nota.tipo}/${nota.id}/enviar`, { method: 'POST', query: { enviarEmail: false } })
  } catch (err) { erroEnvio = err }

  const atualizada = await lerNota(nota.tipo, nota.id)
  await ref.set({ nota: atualizada }, { merge: true })
  if (erroEnvio && !notaAutorizada(atualizada.situacao)) throw erroEnvio
  return { nota: atualizada }
}

async function consultarNota(id) {
  const ref = colPedidos().doc(String(id))
  const nota = (await ref.get()).data()?.nota
  if (!nota?.id) throw new HttpError(404, 'Este pedido não tem nota.')
  const atualizada = await lerNota(nota.tipo, nota.id)
  await ref.set({ nota: atualizada }, { merge: true })
  return { nota: atualizada }
}

/* ── Orçamentos ── */
async function salvarOrcamento(o, usuario) {
  const nomeCliente = (o?.cliente?.nome || o?.clienteNome || '').trim()
  if (!nomeCliente) throw new HttpError(400, 'Informe o cliente do orçamento.')
  const itens = validarItens(o.itens)
  const ref = o.id ? colOrcamentos().doc(String(o.id)) : colOrcamentos().doc()
  const dados = {
    cliente: o.cliente?.id ? resumoCliente(o.cliente)
                           : { id: null, nome: nomeCliente, apelido: '', numeroDocumento: o.clienteDocumento ?? '', grupoId: null },
    itens,
    total: totalDe(itens),
    obs: (o.obs ?? '').trim(),
    formaPagamentoId: o.formaPagamentoId ?? null,
    prazoDias: Math.max(0, parseInt(o.prazoDias) || 0),
    dataEntrega: o.dataEntrega ?? null,
    tabela: o.tabela ?? null,
    atualizadoEm: FieldValue.serverTimestamp(),
    atualizadoPor: usuario.email,
  }
  if (!o.id) { dados.criadoEm = FieldValue.serverTimestamp(); dados.criadoPor = usuario.email }
  await ref.set(dados, { merge: true })
  return { id: ref.id, total: dados.total }
}

async function listar() {
  const [pedidos, orcamentos, ultimaEm] = await Promise.all([
    colPedidos().get(), colOrcamentos().get(), ultimaSincronizacaoPedidos(),
  ])
  return {
    pedidos:    pedidos.docs.map(d => serializar({ id: d.id, ...d.data() })),
    orcamentos: orcamentos.docs.map(d => serializar({ id: d.id, ...d.data() })),
    ultimaSincronizacao: ultimaEm,
  }
}

export default rota(['GET', 'POST'], async (req, res) => {
  const usuario = await exigirAdmin(req)

  if (req.method === 'GET') {
    const { recurso } = req.query
    if (recurso === 'lista')           return res.json(await listar())
    if (recurso === 'produtosBling')   return res.json({ produtos: await produtosBling() })
    if (recurso === 'formasPagamento') return res.json({ formas: await formasPagamento() })
    if (recurso === 'naturezas')       return res.json({ naturezas: await naturezas() })
    throw new HttpError(400, 'Recurso inválido.')
  }

  const b = req.body ?? {}
  switch (b.acao) {
    case 'criar':            return res.json(await criarPedido(b.pedido, usuario))
    case 'editar':           return res.json(await editarPedido(b.id, b.pedido, usuario))
    case 'situacao':         return res.json(await mudarSituacao(b.id, b.para))
    case 'sincronizar':      return res.json(await sincronizarPedidos({ completo: !!b.completo }))
    case 'detalhes':         return res.json({ pedidos: await detalhes(b.ids) })
    case 'nota_gerar':       return res.json(await gerarNota(b.id, b.tipo))
    case 'nota_enviar':      return res.json(await enviarNota(b.id))
    case 'nota_consultar':   return res.json(await consultarNota(b.id))
    case 'orcamento_salvar': return res.json(await salvarOrcamento(b.orcamento, usuario))
    case 'orcamento_excluir':
      await colOrcamentos().doc(String(b.id)).delete()
      return res.json({ ok: true })
    default: throw new HttpError(400, 'Ação inválida.')
  }
})
