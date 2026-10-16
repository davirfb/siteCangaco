import { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api.js'
import { useRascunho, limparRascunhos } from '../../hooks/useRascunho.js'
import {
  formatarDocumento, nomeExibicao, filtrarClientes, ordenarClientes, destaquesDoCliente,
} from '../../lib/clientes.js'
import { gerarPedidoPDF } from '../../utils/gerarPDF.js'
import { ModalCliente } from './Clientes.jsx'

const WA_NUMERO = '5561984274420'
const PREFIXO   = 'rascunho:criarPedido:'
const inputCls  = 'w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors bg-white'
const labelCls  = 'block mb-1 text-sm font-semibold text-text-dark'
const brl = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
const hojeISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

// Dados do cliente que viajam com o pedido
const resumoCliente = c => c && ({
  id: c.id, nome: c.nome, apelido: c.apelido ?? '', numeroDocumento: c.numeroDocumento ?? '',
  grupoId: c.grupoId ?? null, celular: c.celular || c.telefone || '', destaques: c.destaques ?? [],
  tabelaPreco: c.tabelaPreco ?? null,
})

// Preço do produto conforme a tabela (atacado usa o preço de atacado, se houver)
const precoDe = (p, tabela) => tabela === 'atacado' && p.precoAtacado != null ? Number(p.precoAtacado) : Number(p.preco ?? 0)

/* ── Lista de produtos com imagem ── */
function EscolherProduto({ produtos, valor, tabela, onEscolher }) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca]   = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const fora = e => { if (ref.current && !ref.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  const sem = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const lista = produtos.filter(p => !busca.trim() || sem(p.nome).includes(sem(busca).trim()))
  const sel = produtos.find(p => p.id === valor)
  const Img = ({ p }) => (
    <img src={p.imagem || '/img/logocacto.svg'} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-100"
         onError={e => { e.target.src = '/img/logocacto.svg' }} />
  )
  const Preco = ({ p }) => (
    <span className="text-right shrink-0 leading-tight">
      <span className="block text-xs font-semibold text-text-dark">{brl(precoDe(p, tabela))}</span>
      <span className="block text-[10px] text-gray-400">
        {tabela === 'atacado' ? (p.precoAtacado != null ? 'atacado' : 'varejo (sem atacado)') : 'varejo'}
      </span>
    </span>
  )

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setAberto(a => !a)}
              className="w-full flex items-center gap-3 px-3 py-2 border-2 border-gray-200 rounded-lg bg-white text-left cursor-pointer hover:border-primary min-h-[46px]">
        {sel ? (
          <>
            <Img p={sel} />
            <span className="flex-1 min-w-0 text-sm font-semibold text-text-dark truncate">{sel.nome}</span>
            <Preco p={sel} />
          </>
        ) : <span className="flex-1 text-sm text-gray-400">Selecione um produto…</span>}
        <i className={`fas fa-chevron-${aberto ? 'up' : 'down'} text-gray-400 text-xs`}></i>
      </button>

      {aberto && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto"
                   className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {lista.length === 0 && <p className="px-3 py-3 text-sm text-gray-400">Nenhum produto encontrado.</p>}
            {lista.map(p => (
              <button type="button" key={p.id}
                      onClick={() => { onEscolher(p.id); setAberto(false); setBusca('') }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer border-none hover:bg-orange-50 ${p.id === valor ? 'bg-orange-50' : 'bg-white'}`}>
                <Img p={p} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-text-dark truncate">{p.nome}</span>
                  {(p.qtdFardo > 1 || !p.blingProdutoId) && (
                    <span className="block text-[10px] text-gray-400">
                      {p.qtdFardo > 1 && <>fardo {p.qtdFardo} un</>}
                      {p.qtdFardo > 1 && !p.blingProdutoId && ' · '}
                      {!p.blingProdutoId && <span className="text-red-500">sem Bling</span>}
                    </span>
                  )}
                </span>
                <Preco p={p} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Abre um pedido em aberto (edição) ou um orçamento no formulário do Criar Pedido.
// Escreve direto no rascunho; a seção lê ao ser aberta.
export function abrirNoCriarPedido({ cliente, clienteNome, itens, obs, formaPagamentoId, prazoDias, dataEntrega, tabela, editandoId, editandoNumero, orcamentoId }) {
  const grava = (k, v) => { try { localStorage.setItem(PREFIXO + k, JSON.stringify(v)) } catch {} }
  limparRascunhos(PREFIXO)
  grava('cliente', cliente ?? null)
  grava('texto', cliente ? '' : (clienteNome ?? ''))
  grava('itens', itens ?? [])
  grava('obs', obs ?? '')
  if (formaPagamentoId) grava('formaId', formaPagamentoId)
  grava('prazo', prazoDias ?? 0)
  grava('entrega', dataEntrega || hojeISO())
  if (tabela) grava('tabela', tabela)
  grava('edicao', editandoId ? { id: editandoId, numero: editandoNumero ?? null } : null)
  grava('orcamentoId', orcamentoId ?? null)
}

/* ── Autocompletar de cliente ── */
function BuscaCliente({ clientes, grupos, texto, setTexto, onEscolher, onNovo, carregando }) {
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo]   = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const fora = e => { if (ref.current && !ref.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  const ativos = clientes.filter(c => c.situacao !== 'I' && c.situacao !== 'E')
  const sugestoes = texto.trim() ? ordenarClientes(filtrarClientes(ativos, texto, grupos)).slice(0, 8) : []
  const nomeGrupo = id => grupos.find(g => g.id === id)?.nome

  function tecla(e) {
    if (!sugestoes.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(i => Math.min(i + 1, sugestoes.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setAtivo(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); onEscolher(sugestoes[ativo]); setAberto(false) }
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
        <input value={texto}
               onChange={e => { setTexto(e.target.value); setAberto(true); setAtivo(0) }}
               onFocus={() => setAberto(true)} onKeyDown={tecla}
               placeholder={carregando ? 'Carregando clientes…' : 'Digite apelido, nome, CNPJ ou telefone'}
               className={inputCls + ' pl-9'} />
      </div>
      {aberto && texto.trim() && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {sugestoes.map((c, i) => (
            <button type="button" key={c.id}
                    onMouseDown={e => { e.preventDefault(); onEscolher(c); setAberto(false) }}
                    onMouseEnter={() => setAtivo(i)}
                    className={`w-full text-left px-3 py-2 cursor-pointer border-none ${i === ativo ? 'bg-orange-50' : 'bg-white'}`}>
              <span className="block text-sm font-semibold text-text-dark truncate">
                {nomeExibicao(c)}
                {c.grupoId && nomeGrupo(c.grupoId) && <span className="font-normal text-primary"> · {nomeGrupo(c.grupoId)}</span>}
              </span>
              <span className="block text-xs text-gray-400 truncate">
                {[c.apelido && c.nome, formatarDocumento(c.numeroDocumento), c.municipio].filter(Boolean).join(' · ')}
              </span>
            </button>
          ))}
          {sugestoes.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">Nenhum cliente encontrado.</p>}
          <button type="button" onMouseDown={e => { e.preventDefault(); setAberto(false); onNovo() }}
                  className="w-full text-left px-3 py-2.5 text-sm font-semibold text-primary bg-gray-50 hover:bg-orange-50 cursor-pointer border-none border-t border-gray-100">
            <i className="fas fa-user-plus mr-2"></i>Cadastrar novo cliente no Bling
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Seção Criar Pedido ── */
export default function SecaoCriarPedido({ produtos, showToast }) {
  const [cliente,    setCliente]    = useRascunho(PREFIXO + 'cliente', null)
  const [texto,      setTexto]      = useRascunho(PREFIXO + 'texto', '')
  const [itens,      setItens]      = useRascunho(PREFIXO + 'itens', [])
  const [prodSel,    setProdSel]    = useRascunho(PREFIXO + 'prodSel', '')
  const [qtdSel,     setQtdSel]     = useRascunho(PREFIXO + 'qtdSel', 1)
  const [precoSel,   setPrecoSel]   = useRascunho(PREFIXO + 'precoSel', '')
  const [obs,        setObs]        = useRascunho(PREFIXO + 'obs', '')
  const [formaId,    setFormaId]    = useRascunho(PREFIXO + 'formaId', '')
  const [prazo,      setPrazo]      = useRascunho(PREFIXO + 'prazo', 0)
  const [entrega,    setEntrega]    = useRascunho(PREFIXO + 'entrega', hojeISO())
  const [resultado,  setResultado]  = useRascunho(PREFIXO + 'resultado', null)
  const [tabela,     setTabela]     = useRascunho(PREFIXO + 'tabela', 'atacado')
  const [fardosCustom, setFardosCustom] = useRascunho(PREFIXO + 'fardosCustom', {})
  const [editFardo,  setEditFardo]  = useState(false)
  const [nFardos,    setNFardos]    = useState('')
  const [novoCliente, setNovoCliente] = useRascunho('admin:criarPedido:novoCliente', false)
  const [edicao,      setEdicao]      = useRascunho(PREFIXO + 'edicao', null)
  const [orcamentoId, setOrcamentoId] = useRascunho(PREFIXO + 'orcamentoId', null)

  const [clientes, setClientes] = useState([])
  const [grupos,   setGrupos]   = useState([])
  const [formas,   setFormas]   = useState([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState('')
  const [erro,     setErro]     = useState('')

  useEffect(() => {
    api('/clientes')
      .then(r => { setClientes(r.clientes); setGrupos(r.grupos ?? []) })
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setCarregando(false))
    api('/pedidos?recurso=formasPagamento')
      .then(r => {
        setFormas(r.formas)
        setFormaId(atual => atual || r.formas.find(f => f.padrao)?.id || r.formas[0]?.id || '')
      })
      .catch(err => showToast(err.message, 'error'))
  }, [])

  const ativos = produtos.filter(p => p.ativo !== false)
  const total  = itens.reduce((acc, it) => acc + it.quantidade * it.precoUnitario, 0)
  // Vínculo com o Bling sempre lido do Catálogo atual (pode ter sido feito depois de adicionar o item)
  const blingDe = it => produtos.find(p => p.id === it.produtoId)?.blingProdutoId ?? it.blingProdutoId ?? null
  const semVinculo = itens.filter(it => !blingDe(it))
  // Fardo do Catálogo, ou o personalizado neste pedido
  const fardoPadrao = produtoId => produtos.find(p => p.id === produtoId)?.qtdFardo ?? 0
  const fardoDe = produtoId => Number(fardosCustom[produtoId]) || fardoPadrao(produtoId)
  const fardoSel = fardoDe(prodSel)
  const destaques = cliente ? destaquesDoCliente(clientes.find(c => c.id === cliente.id) ?? cliente, grupos) : []
  const grupoCliente = cliente?.grupoId ? grupos.find(g => g.id === cliente.grupoId) : null
  const nomeCliente = cliente ? nomeExibicao(cliente) : texto.trim()

  function escolherCliente(c) {
    setCliente(resumoCliente(c))
    setTexto('')
    setErro('')
    if (c.tabelaPreco && c.tabelaPreco !== tabela) trocarTabela(c.tabelaPreco)
  }

  // Troca varejo/atacado e reprecifica os itens já adicionados
  function trocarTabela(t) {
    setTabela(t)
    setItens(prev => prev.map(it => {
      const p = produtos.find(x => x.id === it.produtoId)
      return p ? { ...it, precoUnitario: precoDe(p, t) } : it
    }))
    const p = ativos.find(x => x.id === prodSel)
    if (p) setPrecoSel(precoDe(p, t))
  }

  function handleSelectProduto(id) {
    setProdSel(id)
    const p = ativos.find(p => p.id === id)
    setPrecoSel(p ? precoDe(p, tabela) : '')
    const f = fardoDe(id)
    setQtdSel(f > 1 ? f : 1)
    setNFardos(''); setEditFardo(false)
  }

  function adicionarItem() {
    if (!prodSel || !qtdSel || precoSel === '') return
    const p = ativos.find(p => p.id === prodSel)
    if (!p) return
    const idx = itens.findIndex(i => i.produtoId === prodSel)
    if (idx !== -1) {
      setItens(prev => prev.map((it, i) =>
        i === idx ? { ...it, quantidade: it.quantidade + Number(qtdSel), precoUnitario: Number(precoSel) } : it
      ))
    } else {
      setItens(prev => [...prev, {
        produtoId: prodSel, nome: p.nome, imagem: p.imagem,
        quantidade: Number(qtdSel), precoUnitario: Number(precoSel),
      }])
    }
    setProdSel(''); setQtdSel(1); setPrecoSel(''); setNFardos(''); setEditFardo(false)
  }

  const removerItem   = idx => setItens(prev => prev.filter((_, i) => i !== idx))
  const atualizarItem = (idx, campo, valor) => setItens(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: Number(valor) } : it))

  function payload() {
    return {
      cliente,
      clienteNome: texto.trim(),
      itens: itens.map(it => ({ ...it, blingProdutoId: blingDe(it) })),
      obs, formaPagamentoId: formaId, prazoDias: prazo, dataEntrega: entrega, tabela,
      orcamentoId: orcamentoId ?? undefined,
    }
  }

  function snapshot(extra) {
    return {
      cliente: nomeCliente, cnpj: formatarDocumento(cliente?.numeroDocumento ?? ''), celular: cliente?.celular ?? '',
      itens, total, obs, ...extra,
    }
  }

  async function salvarOrcamento() {
    setErro('')
    if (!nomeCliente) { setErro('Informe o cliente do orçamento.'); return }
    if (!itens.length) { setErro('Adicione ao menos um produto.'); return }
    setEnviando('orcamento')
    try {
      const r = await api('/pedidos', { method: 'POST', body: { acao: 'orcamento_salvar', orcamento: { ...payload(), id: orcamentoId ?? undefined } } })
      setResultado(snapshot({ tipo: 'orcamento', id: r.id }))
    } catch (err) { setErro(err.message) }
    finally { setEnviando('') }
  }

  async function criarPedido() {
    setErro('')
    if (!cliente) { setErro('Para criar o pedido no Bling, escolha um cliente cadastrado (ou salve como orçamento).'); return }
    if (!itens.length) { setErro('Adicione ao menos um produto.'); return }
    if (semVinculo.length) { setErro(`Vincule ao Bling no Catálogo: ${semVinculo.map(i => i.nome).join(', ')}.`); return }
    const forma = formas.find(f => f.id === formaId)?.descricao ?? '—'
    const resumo = `Cliente: ${nomeCliente}\nTotal: ${brl(total)}\nPagamento: ${forma}, ${Number(prazo) ? prazo + ' dias' : 'à vista'}`
    if (!window.confirm(edicao
      ? `Salvar alterações no pedido nº ${edicao.numero ?? ''} no Bling?\n\n${resumo}`
      : `Criar pedido no Bling?\n\n${resumo}\n\nO pedido entra no Bling como "Em aberto".`
    )) return
    setEnviando('pedido')
    try {
      const r = edicao
        ? await api('/pedidos', { method: 'POST', body: { acao: 'editar', id: edicao.id, pedido: payload() } })
        : await api('/pedidos', { method: 'POST', body: { acao: 'criar', pedido: payload() } })
      setResultado(snapshot({ tipo: 'pedido', id: r.id, numero: r.numero, editado: !!edicao }))
    } catch (err) { setErro(err.message) }
    finally { setEnviando('') }
  }

  function novoPedido() {
    limparRascunhos(PREFIXO)
    setCliente(null); setTexto(''); setItens([]); setProdSel(''); setQtdSel(1); setPrecoSel('')
    setObs(''); setPrazo(0); setEntrega(hojeISO()); setResultado(null); setTabela('atacado'); setFardosCustom({})
    setEdicao(null); setOrcamentoId(null)
    setFormaId(formas.find(f => f.padrao)?.id || formas[0]?.id || '')
  }

  function enviarWhatsApp(r, paraCliente) {
    const linhas = r.itens.map(it => `• ${it.nome} ×${it.quantidade} — ${brl(it.quantidade * it.precoUnitario)}`).join('\n')
    const cab = r.tipo === 'orcamento' ? '📋 *ORÇAMENTO*' : `🛍️ *PEDIDO${r.numero ? ' Nº ' + r.numero : ''}*`
    const msg = [
      cab, '',
      `👤 *Cliente:* ${r.cliente}`,
      r.cnpj ? `📋 *CNPJ:* ${r.cnpj}` : null,
      '', '*Produtos:*', linhas, '',
      `💰 *Total: ${brl(r.total)}*`,
      r.obs?.trim() ? `\n📝 *Obs:* ${r.obs.trim()}` : null,
    ].filter(l => l !== null).join('\n')
    const numero = paraCliente ? '55' + r.celular.replace(/\D/g, '').replace(/^55/, '') : WA_NUMERO
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  /* ── Tela de resultado ── */
  if (resultado) {
    const pedido = resultado.tipo === 'pedido'
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <i className={`fas ${pedido ? 'fa-check' : 'fa-file-alt'} text-4xl text-green-600`}></i>
        </div>
        <div>
          <p className="text-xl font-bold text-text-dark mb-1">
            {pedido
              ? `Pedido${resultado.numero ? ' nº ' + resultado.numero : ''} ${resultado.editado ? 'alterado' : 'criado'} no Bling!`
              : 'Orçamento salvo!'}
          </p>
          <p className="text-gray-400 text-sm">
            {resultado.cliente} · {brl(resultado.total)}
            {pedido ? ' · situação "Em aberto"' : ' · fica só no site, não vai para o Bling'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap justify-center">
          <button onClick={() => gerarPedidoPDF({ ...resultado, titulo: pedido ? 'PEDIDO' : 'ORÇAMENTO' })}
                  className="flex items-center justify-center gap-2 bg-white border-2 border-primary text-primary px-5 py-3 rounded-xl font-semibold hover:bg-primary hover:text-white transition-colors cursor-pointer">
            <i className="fas fa-file-pdf"></i> Baixar PDF
          </button>
          <button onClick={() => enviarWhatsApp(resultado, false)}
                  className="flex items-center justify-center gap-2 bg-white border-2 border-green-600 text-green-700 px-5 py-3 rounded-xl font-semibold hover:bg-green-600 hover:text-white transition-colors cursor-pointer">
            <i className="fab fa-whatsapp"></i> Enviar no WhatsApp
          </button>
          {resultado.celular && (
            <button onClick={() => enviarWhatsApp(resultado, true)}
                    className="flex items-center justify-center gap-2 bg-white border-2 border-green-600 text-green-700 px-5 py-3 rounded-xl font-semibold hover:bg-green-600 hover:text-white transition-colors cursor-pointer">
              <i className="fab fa-whatsapp"></i> Enviar ao cliente
            </button>
          )}
        </div>
        <button onClick={novoPedido}
                className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-dark-brown transition-colors cursor-pointer border-none">
          <i className="fas fa-plus"></i> Criar novo pedido
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl flex flex-col gap-5">

      {(edicao || orcamentoId) && (
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border-2 ${edicao ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-purple-50 border-purple-200 text-purple-800'}`}>
          <i className={`fas ${edicao ? 'fa-edit' : 'fa-file-alt'}`}></i>
          <p className="flex-1 text-sm font-semibold">
            {edicao ? `Editando o pedido nº ${edicao.numero ?? ''} (em aberto no Bling)` : 'Editando um orçamento salvo'}
          </p>
          <button type="button" onClick={() => { if (window.confirm('Descartar e começar um pedido novo?')) novoPedido() }}
                  className="text-xs font-semibold underline cursor-pointer bg-transparent border-none text-current">
            Descartar
          </button>
        </div>
      )}

      {/* Cliente */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
        <h3 className="font-bold text-text-dark flex items-center gap-2">
          <i className="fas fa-user text-primary"></i> Cliente
        </h3>

        {cliente ? (
          <div className="flex items-start gap-3 border-2 border-orange-100 bg-orange-50/50 rounded-xl p-3">
            <div className="w-10 h-10 rounded-full bg-white text-primary flex items-center justify-center shrink-0 font-bold">
              {nomeExibicao(cliente).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-text-dark truncate">
                {nomeExibicao(cliente)}
                {grupoCliente && <span className="font-normal text-primary text-sm"> · {grupoCliente.nome}</span>}
              </p>
              {cliente.apelido && <p className="text-xs text-gray-500 truncate">{cliente.nome}</p>}
              <p className="text-xs text-gray-400">{[formatarDocumento(cliente.numeroDocumento), cliente.celular].filter(Boolean).join(' · ')}</p>
            </div>
            <button type="button" onClick={() => setCliente(null)}
                    className="text-xs font-semibold text-primary hover:underline cursor-pointer bg-transparent border-none shrink-0">
              Trocar
            </button>
          </div>
        ) : (
          <>
            <BuscaCliente clientes={clientes} grupos={grupos} texto={texto} setTexto={setTexto}
                          onEscolher={escolherCliente} onNovo={() => setNovoCliente(true)} carregando={carregando} />
            {texto.trim() && (
              <p className="text-xs text-gray-400 -mt-2">
                Sem cliente cadastrado, dá para salvar só como <strong>orçamento</strong> com o nome "{texto.trim()}".
              </p>
            )}
          </>
        )}

        {destaques.length > 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-3">
            <p className="text-xs font-bold text-yellow-800 uppercase tracking-wide mb-1.5">
              <i className="fas fa-star mr-1"></i>Destaques deste cliente
            </p>
            <ul className="flex flex-col gap-1">
              {destaques.map(d => <li key={d} className="text-sm font-semibold text-yellow-900">• {d}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Produtos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-bold text-text-dark flex items-center gap-2">
            <i className="fas fa-box text-primary"></i> Produtos
          </h3>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {[['varejo', 'Varejo'], ['atacado', 'Atacado']].map(([v, l]) => (
              <button type="button" key={v} onClick={() => tabela !== v && trocarTabela(v)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer border-none transition-colors ${tabela === v ? 'bg-primary text-white' : 'bg-transparent text-text-dark hover:bg-white'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-600">Adicionar produto</p>
          <EscolherProduto produtos={ativos} valor={prodSel} tabela={tabela} onEscolher={handleSelectProduto} />
          {prodSel && (editFardo ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500"><i className="fas fa-boxes mr-1"></i>Unidades por fardo neste pedido:</span>
              <input type="number" min="2" step="1" autoFocus
                     value={fardosCustom[prodSel] ?? fardoPadrao(prodSel) ?? ''}
                     onChange={e => setFardosCustom(f => ({ ...f, [prodSel]: e.target.value }))}
                     onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setEditFardo(false) } }}
                     className="w-20 px-2 py-1 border-2 border-primary rounded-lg text-sm text-center focus:outline-none" />
              <button type="button" onClick={() => { setEditFardo(false); if (fardoSel > 1) setQtdSel(fardoSel) }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border-none bg-primary text-white">
                OK
              </button>
              {fardoPadrao(prodSel) > 1 && (
                <button type="button"
                        onClick={() => { setFardosCustom(({ [prodSel]: _, ...resto }) => resto); setEditFardo(false); setQtdSel(fardoPadrao(prodSel)) }}
                        className="text-xs font-semibold text-gray-500 hover:text-primary cursor-pointer bg-transparent border-none">
                  Voltar ao padrão ({fardoPadrao(prodSel)} un)
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {fardoSel > 1 && (
                <>
                  <span className="text-xs text-gray-500">
                    <i className="fas fa-boxes mr-1"></i>Fardo de {fardoSel} un{fardosCustom[prodSel] ? ' (personalizado)' : ''}:
                  </span>
                  {[1, 2, 3, 5].map(n => (
                    <button type="button" key={n} onClick={() => { setQtdSel(n * fardoSel); setNFardos('') }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border-2 transition-colors ${Number(qtdSel) === n * fardoSel && !nFardos ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 text-text-dark hover:border-primary'}`}>
                      {n} fardo{n > 1 ? 's' : ''}
                    </button>
                  ))}
                  <span className="flex items-center gap-1">
                    <input type="number" min="1" step="1" value={nFardos} placeholder="Nº"
                           onChange={e => { setNFardos(e.target.value); if (Number(e.target.value) > 0) setQtdSel(Number(e.target.value) * fardoSel) }}
                           className={`w-14 px-1 py-1 border-2 rounded-lg text-xs text-center focus:outline-none focus:border-primary ${nFardos ? 'border-primary' : 'border-gray-200'}`} />
                    <span className="text-xs text-gray-500">fardos</span>
                  </span>
                </>
              )}
              <button type="button" onClick={() => setEditFardo(true)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border-2 border-dashed border-gray-300 bg-white text-gray-500 hover:border-primary hover:text-primary">
                <i className="fas fa-pen mr-1"></i>{fardoSel > 1 ? 'Fardo personalizado' : 'Definir fardo'}
              </button>
            </div>
          ))}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block mb-1 text-xs text-gray-500">Quantidade</label>
              <input type="number" value={qtdSel} onChange={e => setQtdSel(e.target.value)} min="1" step="1" className={inputCls} />
            </div>
            <div>
              <label className="block mb-1 text-xs text-gray-500">Preço unit. (R$)</label>
              <input type="number" value={precoSel} onChange={e => setPrecoSel(e.target.value)} min="0" step="0.01" placeholder="0.00" className={inputCls} />
            </div>
            <div className="flex items-end col-span-2 sm:col-span-1">
              <button type="button" onClick={adicionarItem} disabled={!prodSel || !qtdSel || precoSel === ''}
                      className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-dark-brown transition-colors cursor-pointer border-none disabled:opacity-50 flex items-center justify-center gap-2">
                <i className="fas fa-plus"></i> Adicionar
              </button>
            </div>
          </div>
        </div>

        {itens.length > 0 && (
          <div className="flex flex-col gap-2">
            {itens.map((it, idx) => (
              <div key={idx} className="flex items-center gap-3 border border-gray-100 rounded-xl p-3">
                {it.imagem && (
                  <img src={it.imagem} alt={it.nome} className="w-10 h-10 object-cover rounded-lg shrink-0"
                       onError={e => { e.target.src = '/img/logocacto.svg' }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-dark truncate">{it.nome}</p>
                  {fardoDe(it.produtoId) > 1 && it.quantidade % fardoDe(it.produtoId) === 0 && (
                    <p className="text-[11px] text-gray-400">
                      {it.quantidade / fardoDe(it.produtoId)} fardo{it.quantidade / fardoDe(it.produtoId) > 1 ? 's' : ''} de {fardoDe(it.produtoId)} un
                    </p>
                  )}
                  {!blingDe(it) && (
                    <p className="text-[11px] text-red-500"><i className="fas fa-unlink mr-1"></i>Sem vínculo com o Bling</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 mb-1">Qtd</p>
                    <input type="number" value={it.quantidade} min="1" onChange={e => atualizarItem(idx, 'quantidade', e.target.value)}
                           className="w-14 px-1 py-1 border-2 border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 mb-1">R$ unit.</p>
                    <input type="number" value={it.precoUnitario} min="0" step="0.01" onChange={e => atualizarItem(idx, 'precoUnitario', e.target.value)}
                           className="w-20 px-1 py-1 border-2 border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 mb-1">Subtotal</p>
                    <p className="text-sm font-bold text-primary">{brl(it.quantidade * it.precoUnitario)}</p>
                  </div>
                  <button type="button" onClick={() => removerItem(idx)}
                          className="text-red-400 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-none ml-1">
                    <i className="fas fa-trash text-sm"></i>
                  </button>
                </div>
              </div>
            ))}
            <div className="flex justify-end mt-1">
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-5 py-3 flex items-center gap-4">
                <span className="text-text-light font-medium text-sm">Total</span>
                <span className="text-primary font-bold text-xl">{brl(total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pagamento e entrega */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
        <h3 className="font-bold text-text-dark flex items-center gap-2">
          <i className="fas fa-credit-card text-primary"></i> Pagamento e entrega
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Forma de pagamento</label>
            <select value={formaId} onChange={e => setFormaId(e.target.value)} className={inputCls}>
              {formas.length === 0 && <option value="">Carregando do Bling…</option>}
              {formas.map(f => <option key={f.id} value={f.id}>{f.descricao}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Data de entrega</label>
            <input type="date" value={entrega} onChange={e => setEntrega(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Prazo de pagamento</label>
          <div className="flex gap-2 flex-wrap items-center">
            {[0, 7, 14, 21, 28, 30].map(d => (
              <button type="button" key={d} onClick={() => setPrazo(d)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer border-2 transition-colors ${Number(prazo) === d ? 'bg-primary border-primary text-white' : 'bg-white border-gray-200 text-text-dark hover:border-primary'}`}>
                {d === 0 ? 'À vista' : `${d} dias`}
              </button>
            ))}
            <div className="flex items-center gap-2">
              <input type="number" min="0" value={prazo} onChange={e => setPrazo(e.target.value)}
                     className="w-20 px-2 py-2 border-2 border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-primary" />
              <span className="text-sm text-gray-500">dias</span>
            </div>
          </div>
        </div>
      </div>

      {/* Observações */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <label className="flex mb-2 text-sm font-semibold text-text-dark items-center gap-2">
          <i className="fas fa-comment-alt text-primary"></i> Observações
        </label>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
                  placeholder="Condições de entrega, etc. (vai para o pedido no Bling)"
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors resize-y" />
      </div>

      {erro && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm" role="alert">{erro}</div>}

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!edicao && <button onClick={salvarOrcamento} disabled={!!enviando || !itens.length}
                className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-primary text-primary py-3.5 rounded-xl font-bold hover:bg-primary hover:text-white transition-colors cursor-pointer disabled:opacity-50">
          <i className={`fas ${enviando === 'orcamento' ? 'fa-spinner fa-spin' : 'fa-file-alt'}`}></i>
          {enviando === 'orcamento' ? 'Salvando…' : orcamentoId ? 'Atualizar orçamento' : 'Salvar como orçamento'}
        </button>}
        <button onClick={criarPedido} disabled={!!enviando || !itens.length || !cliente}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-xl font-bold hover:bg-dark-brown transition-colors cursor-pointer border-none disabled:opacity-50">
          <i className={`fas ${enviando === 'pedido' ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
          {enviando === 'pedido' ? 'Enviando ao Bling…' : edicao ? 'Salvar alterações no Bling' : orcamentoId ? 'Converter em pedido no Bling' : 'Criar pedido no Bling'}
        </button>
      </div>

      {novoCliente && (
        <ModalCliente id="novo" grupos={grupos}
                      onClose={() => { limparRascunhos('rascunho:cliente:'); setNovoCliente(false) }}
                      onSaved={c => {
                        const item = {
                          id: String(c.id), nome: c.nome, apelido: c.apelido ?? '', numeroDocumento: c.numeroDocumento ?? '',
                          grupoId: c.grupoId ?? null, destaques: c.destaques ?? [], celular: c.celular || c.telefone || '',
                          situacao: 'A', municipio: c.endereco?.geral?.municipio ?? '',
                        }
                        setClientes(prev => [...prev, item])
                        escolherCliente(item)
                        showToast('Cliente cadastrado no Bling!')
                      }}
                      showToast={showToast} />
      )}
    </div>
  )
}
