import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './firebaseAdmin.js'
import { blingFetch } from './bling.js'
import { HttpError } from './auth.js'

// Cópia local dos pedidos de venda do Bling (listas, filtros e PDFs rápidos)
export const colPedidos    = () => adminDb.collection('pedidos')
export const colOrcamentos = () => adminDb.collection('orcamentos')
const metaDoc       = () => adminDb.collection('integracoes').doc('pedidosSync')
const situacoesDoc  = () => adminDb.collection('integracoes').doc('situacoesVendas')

export const esperar = ms => new Promise(r => setTimeout(r, ms))

export const NOTA_SITUACAO = {
  1: 'Pendente', 2: 'Cancelada', 3: 'Aguardando recibo', 4: 'Rejeitada', 5: 'Autorizada',
  6: 'Emitida DANFE', 7: 'Registrada', 8: 'Aguardando protocolo', 9: 'Denegada', 10: 'Consulta situação', 11: 'Bloqueada',
}
export const notaAutorizada = codigo => [5, 6, 7].includes(Number(codigo))

const semAcento = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Situações do módulo Vendas no Bling (ids variam por conta). Guardadas por 1 dia.
export async function situacoesVendas(forcar = false) {
  const cache = (await situacoesDoc().get()).data()
  if (!forcar && cache?.lista?.length && Date.now() - cache.em < 86400000) return cache.lista

  let lista
  try {
    const { data: modulos = [] } = await blingFetch('/situacoes/modulos')
    const vendas = modulos.find(m => semAcento(m.nome).includes('vendas') || semAcento(m.descricao).includes('pedidos de venda'))
    if (!vendas) throw new HttpError(502, 'Não encontrei o módulo de Vendas nas situações do Bling.')
    const { data = [] } = await blingFetch(`/situacoes/modulos/${vendas.id}`)
    lista = data.map(s => ({ id: String(s.id), nome: s.nome, idHerdado: s.idHerdado ? String(s.idHerdado) : null }))
  } catch (err) {
    // Sem o escopo de Situações: usa as situações padrão do Bling para pedidos de venda
    if (!err.semPermissao) throw err
    lista = SITUACOES_PADRAO
  }
  await situacoesDoc().set({ lista, em: Date.now() })
  return lista
}

// Situações padrão do módulo Vendas no Bling (situações criadas pelo usuário herdam de uma destas)
const SITUACOES_PADRAO = [
  { id: '6',  nome: 'Em aberto' },
  { id: '9',  nome: 'Atendido' },
  { id: '12', nome: 'Cancelado' },
  { id: '15', nome: 'Em andamento' },
  { id: '18', nome: 'Venda Agenciada' },
  { id: '21', nome: 'Em digitação' },
  { id: '24', nome: 'Verificado' },
].map(s => ({ ...s, idHerdado: null }))

// Classifica a situação do Bling no que a página usa: aberto, concluido, cancelado, outro
export function classificar(nome) {
  const n = semAcento(nome)
  if (n.includes('cancel')) return 'cancelado'
  if (n.includes('atendido')) return 'concluido'
  if (n.includes('aberto') || n.includes('andamento')) return 'aberto'
  return 'outro'
}

export async function idSituacao(destino) {
  const lista = await situacoesVendas()
  const alvo = { concluido: 'atendido', cancelado: 'cancelado', aberto: 'em aberto' }[destino]
  const s = lista.find(x => semAcento(x.nome) === alvo) ?? lista.find(x => semAcento(x.nome).includes(alvo))
  if (!s) throw new HttpError(502, `Situação "${alvo}" não encontrada no Bling.`)
  return s.id
}

function nomeSituacao(lista, id) {
  return lista.find(s => s.id === String(id))?.nome ?? ''
}

// Campos da listagem do Bling
function paraCache(p, situacoes) {
  const situacaoNome = nomeSituacao(situacoes, p.situacao?.id)
  return {
    blingId:      String(p.id),
    numero:       p.numero ?? null,
    data:         p.data ?? null,
    dataPrevista: p.dataPrevista ?? null,
    total:        Number(p.total ?? 0),
    situacaoId:   p.situacao?.id ? String(p.situacao.id) : null,
    situacaoNome,
    situacao:     classificar(situacaoNome),
    // merge: true mescla o mapa, preservando campos do site (apelido, grupoId)
    cliente: {
      id:              p.contato?.id ? String(p.contato.id) : null,
      nome:            p.contato?.nome ?? '',
      numeroDocumento: (p.contato?.numeroDocumento ?? '').replace(/\D/g, ''),
    },
    sincronizadoEm: FieldValue.serverTimestamp(),
  }
}

export async function lerNota(tipo, id) {
  const { data } = await blingFetch(`/${tipo}/${id}`)
  return {
    tipo,
    id:            String(id),
    numero:        data.numero ?? null,
    serie:         data.serie ?? null,
    situacao:      data.situacao ?? null,
    situacaoTexto: NOTA_SITUACAO[data.situacao] ?? '',
    chaveAcesso:   data.chaveAcesso ?? null,
    linkDanfe:     data.linkDanfe ?? null,
    linkPDF:       data.linkPDF ?? null,
    xml:           data.xml ?? null,
    valor:         data.valorNota ?? null,
    naturezaOperacao: data.naturezaOperacao?.id ? String(data.naturezaOperacao.id) : null,
    dataEmissao:   data.dataEmissao ?? null,
  }
}

// Ficha completa do pedido (itens, parcelas, nota) → cópia local
export async function detalharPedido(id) {
  const ref = colPedidos().doc(String(id))
  const [{ data: p }, situacoes, atual] = await Promise.all([
    blingFetch(`/pedidos/vendas/${id}`), situacoesVendas(), ref.get(),
  ])
  const dados = {
    ...paraCache(p, situacoes),
    itens: (p.itens ?? []).map(it => ({
      nome:          it.descricao ?? '',
      codigo:        it.codigo ?? '',
      unidade:       it.unidade ?? '',
      quantidade:    Number(it.quantidade ?? 0),
      precoUnitario: Number(it.valor ?? 0),
      desconto:      Number(it.desconto ?? 0),
      blingProdutoId: it.produto?.id ? String(it.produto.id) : null,
    })),
    parcelas: (p.parcelas ?? []).map(x => ({
      dataVencimento: x.dataVencimento ?? null, valor: Number(x.valor ?? 0),
      formaPagamentoId: x.formaPagamento?.id ? String(x.formaPagamento.id) : null,
    })),
    obs: p.observacoes ?? '',
    detalheEm: Date.now(),
  }

  // Nota vinculada ao pedido (o Bling informa só o id; o tipo pode ser NF-e ou NFC-e)
  const notaId = p.notaFiscal?.id ? String(p.notaFiscal.id) : null
  const notaAtual = atual.data()?.nota
  if (notaId && notaId !== '0') {
    if (notaAtual?.id === notaId && notaAutorizada(notaAtual.situacao)) {
      // já conhecida e autorizada: não muda mais
    } else {
      const tipos = notaAtual?.id === notaId ? [notaAtual.tipo] : ['nfe', 'nfce']
      for (const tipo of tipos) {
        try { dados.nota = await lerNota(tipo, notaId); break } catch {}
      }
    }
  }

  await ref.set(dados, { merge: true })
  const anterior = atual.data() ?? {}
  return { id: String(id), ...anterior, ...dados, cliente: { ...(anterior.cliente ?? {}), ...dados.cliente }, nota: dados.nota ?? anterior.nota ?? null }
}

// Data/hora de Brasília no formato do Bling
function dataHoraBling(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms)).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day} ${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second}`
}

// Traz do Bling os pedidos alterados desde a última sincronização (ou todos).
// Pedidos alterados têm a ficha completa atualizada (até um limite por execução).
export async function sincronizarPedidos({ completo = false, limiteDetalhes = 25 } = {}) {
  const inicio = Date.now()
  const meta = (await metaDoc().get()).data()
  const desde = !completo && meta?.ultimaEm ? meta.ultimaEm - 10 * 60 * 1000 : null
  const situacoes = await situacoesVendas(completo)

  const alterados = []
  for (let pagina = 1; pagina <= 50; pagina++) {
    const { data = [] } = await blingFetch('/pedidos/vendas', {
      query: { pagina, limite: 100, dataAlteracaoInicial: desde ? dataHoraBling(desde) : undefined },
    })
    if (data.length) {
      const batch = adminDb.batch()
      data.forEach(p => {
        batch.set(colPedidos().doc(String(p.id)), paraCache(p, situacoes), { merge: true })
        alterados.push(String(p.id))
      })
      await batch.commit()
    }
    if (data.length < 100) break
    await esperar(350)
  }

  // Atualiza itens/nota dos alterados (os mais recentes primeiro)
  let detalhados = 0
  for (const id of alterados.slice(0, limiteDetalhes)) {
    try { await detalharPedido(id); detalhados++ } catch (err) { console.error('detalhe', id, err.message) }
    await esperar(350)
  }
  // Os que passaram do limite ficam para quando forem abertos
  if (alterados.length > limiteDetalhes) {
    const batch = adminDb.batch()
    alterados.slice(limiteDetalhes).forEach(id => batch.set(colPedidos().doc(id), { detalheEm: null }, { merge: true }))
    await batch.commit()
  }

  await metaDoc().set({ ultimaEm: inicio }, { merge: true })
  return { total: alterados.length, detalhados, ultimaEm: inicio }
}

export async function ultimaSincronizacaoPedidos() {
  return (await metaDoc().get()).data()?.ultimaEm ?? null
}
