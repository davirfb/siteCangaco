import { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api.js'
import { obterClientes, obterPedidos, obterFormasPagamento } from '../../lib/dados.js'
import { useRascunho } from '../../hooks/useRascunho.js'
import {
  formatarDocumento, nomeExibicao, filtrarClientes, ordenarClientes, destaquesDoCliente,
} from '../../lib/clientes.js'
import { gerarPedidoPDF, gerarPedidosPDF, gerarResumoProducaoPDF } from '../../utils/gerarPDF.js'
import { abrirNoCriarPedido } from './CriarPedido.jsx'

const brl = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
const dataBR = iso => iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—'
const hojeISO = (dias = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + dias * 86400000))
const inputCls = 'w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors bg-white'

const LINK_BLING = {
  pedido: id => `https://www.bling.com.br/vendas.php#edit/${id}`,
  nfe:    id => `https://www.bling.com.br/notas.fiscais.php#edit/${id}`,
  nfce:   id => `https://www.bling.com.br/nfces.php#edit/${id}`,
}
// Abre o WhatsApp do cliente com o link do DANFE (sem celular, o WhatsApp pede o contato)
function enviarDanfeWhatsApp({ nota, numeroPedido, clienteNome, celular }) {
  const link = nota.linkDanfe || nota.linkPDF
  const msg = [
    `Olá, ${clienteNome}!`,
    '',
    `Segue a ${nota.tipo === 'nfce' ? 'NFC-e' : 'nota fiscal (NF-e)'} nº ${nota.numero} referente ao pedido nº ${numeroPedido ?? ''}:`,
    link,
    '',
    'Cangaço Alimentos',
  ].join('\n')
  const cel = String(celular || '').replace(/\D/g, '').replace(/^55/, '')
  window.open(`https://wa.me/${cel ? '55' + cel : ''}?text=${encodeURIComponent(msg)}`, '_blank')
}

const notaAutorizada = n => [5, 6, 7].includes(Number(n?.situacao))
const notaAguardando = n => [3, 8, 10].includes(Number(n?.situacao))
const notaFalhou     = n => [2, 4, 9].includes(Number(n?.situacao))
const rotuloNota = n => `${n.tipo === 'nfce' ? 'NFC-e' : 'NF-e'}${n.numero ? ' ' + n.numero : ''}`

const SITUACAO_COR = {
  aberto:    'bg-orange-100 text-orange-800',
  concluido: 'bg-green-100 text-green-800',
  cancelado: 'bg-red-100 text-red-700',
  outro:     'bg-gray-100 text-gray-700',
}

const Chips = ({ lista }) => lista.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-1">
    {lista.map(d => (
      <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-800">
        <i className="fas fa-star text-[8px]"></i>{d}
      </span>
    ))}
  </div>
)

function BadgeNota({ nota }) {
  if (!nota?.id) return null
  const cor = notaAutorizada(nota) ? 'bg-blue-100 text-blue-800' : notaFalhou(nota) ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cor}`}>
      <i className="fas fa-receipt text-[9px]"></i>{rotuloNota(nota)} · {nota.situacaoTexto || 'Pendente'}
    </span>
  )
}

function Modal({ titulo, onClose, children, largura = 'max-w-2xl' }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full ${largura} max-h-[95vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-text-dark">{titulo}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-1">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── Emissão de nota: gerar (rascunho) → revisar → enviar à SEFAZ ── */
function FluxoNota({ pedido, tipo, onClose, onNota }) {
  const notaExistente = pedido.nota?.id && !notaFalhou(pedido.nota) ? pedido.nota : null
  const [etapa, setEtapa] = useState(notaExistente ? (notaAutorizada(notaExistente) ? 'pronta' : 'revisar') : 'gerando')
  const [nota, setNota]   = useState(notaExistente)
  const [natureza, setNatureza] = useState(null)
  const [erro, setErro]   = useState('')
  const tipoNota = nota?.tipo ?? tipo
  const nomeTipo = tipoNota === 'nfce' ? 'NFC-e' : 'NF-e'

  function atualizar(n) { setNota(n); onNota(n) }

  useEffect(() => {
    if (etapa !== 'gerando') return
    api('/pedidos', { method: 'POST', body: { acao: 'nota_gerar', id: pedido.id, tipo } })
      .then(r => { atualizar(r.nota); setNatureza(r.naturezaNome); setEtapa('revisar') })
      .catch(err => { setErro(err.message); setEtapa('erro') })
  }, [])

  async function enviar() {
    setErro('')
    setEtapa('enviando')
    try {
      let r = await api('/pedidos', { method: 'POST', body: { acao: 'nota_enviar', id: pedido.id } })
      atualizar(r.nota)
      // SEFAZ pode demorar alguns segundos: consulta de novo enquanto estiver aguardando
      for (let i = 0; i < 6 && notaAguardando(r.nota); i++) {
        await new Promise(res => setTimeout(res, 3000))
        r = await api('/pedidos', { method: 'POST', body: { acao: 'nota_consultar', id: pedido.id } })
        atualizar(r.nota)
      }
      setEtapa(notaAutorizada(r.nota) ? 'pronta' : notaAguardando(r.nota) ? 'aguardando' : 'rejeitada')
    } catch (err) {
      setErro(err.message)
      try { atualizar((await api('/pedidos', { method: 'POST', body: { acao: 'nota_consultar', id: pedido.id } })).nota) } catch {}
      setEtapa('rejeitada')
    }
  }

  async function consultar() {
    try {
      const r = await api('/pedidos', { method: 'POST', body: { acao: 'nota_consultar', id: pedido.id } })
      atualizar(r.nota)
      setEtapa(notaAutorizada(r.nota) ? 'pronta' : notaAguardando(r.nota) ? 'aguardando' : notaFalhou(r.nota) ? 'rejeitada' : 'revisar')
    } catch (err) { setErro(err.message) }
  }

  const linkBling = nota?.id ? LINK_BLING[tipoNota](nota.id) : null
  const btn = 'flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm cursor-pointer transition-colors'

  return (
    <Modal titulo={`${nomeTipo} do pedido nº ${pedido.numero ?? ''}`} onClose={onClose} largura="max-w-lg">
      <div className="p-5 flex flex-col gap-4">
        {(etapa === 'gerando' || etapa === 'enviando') && (
          <div className="flex flex-col items-center gap-3 py-10 text-primary text-center">
            <i className="fas fa-spinner fa-spin text-4xl"></i>
            <p className="font-semibold">{etapa === 'gerando' ? `Gerando ${nomeTipo} no Bling…` : 'Enviando à SEFAZ… pode levar alguns segundos'}</p>
          </div>
        )}

        {etapa === 'erro' && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">{erro}</div>
        )}

        {etapa === 'revisar' && nota && (
          <>
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 text-sm text-yellow-900">
              <p className="font-bold mb-1"><i className="fas fa-exclamation-triangle mr-1"></i>Confira antes de enviar</p>
              A {nomeTipo} foi criada no Bling como <strong>rascunho</strong>. Ao enviar, ela vai para a SEFAZ e passa a valer como nota fiscal.
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-gray-400">Número / série</dt><dd className="text-text-dark">{nota.numero ?? '—'} / {nota.serie ?? '—'}</dd>
              <dt className="text-gray-400">Cliente</dt>        <dd className="text-text-dark">{pedido.clienteNome}</dd>
              <dt className="text-gray-400">Valor</dt>          <dd className="text-text-dark font-bold">{brl(nota.valor ?? pedido.total)}</dd>
              <dt className="text-gray-400">Natureza</dt>       <dd className="text-text-dark">{natureza ?? 'a padrão do Bling'}</dd>
              <dt className="text-gray-400">Situação</dt>       <dd className="text-text-dark">{nota.situacaoTexto || 'Pendente'}</dd>
            </dl>
            <p className="text-xs text-gray-500">Para mudar natureza de operação, impostos ou outros dados, abra no Bling, ajuste e volte aqui para enviar.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={enviar} className={`${btn} flex-1 bg-primary text-white hover:bg-dark-brown border-none`}>
                <i className="fas fa-paper-plane"></i> Enviar à SEFAZ
              </button>
              <a href={linkBling} target="_blank" rel="noopener noreferrer" className={`${btn} bg-white border-2 border-gray-200 text-text-dark hover:border-primary`}>
                <i className="fas fa-external-link-alt"></i> Abrir no Bling
              </a>
            </div>
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-primary cursor-pointer bg-transparent border-none">Deixar para depois</button>
          </>
        )}

        {etapa === 'aguardando' && (
          <>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-900">
              A SEFAZ ainda está processando ({nota?.situacaoTexto}). Consulte de novo em instantes.
            </div>
            <button onClick={consultar} className={`${btn} bg-primary text-white border-none`}><i className="fas fa-sync-alt"></i> Consultar situação</button>
          </>
        )}

        {etapa === 'rejeitada' && (
          <>
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">
              <p className="font-bold mb-1">{nomeTipo} não autorizada{nota?.situacaoTexto ? ` (${nota.situacaoTexto})` : ''}</p>
              {erro || 'Veja o motivo no Bling, corrija e tente enviar de novo.'}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {nota?.id && !notaFalhou(nota) && (
                <button onClick={enviar} className={`${btn} flex-1 bg-primary text-white border-none`}><i className="fas fa-redo"></i> Tentar enviar de novo</button>
              )}
              {linkBling && (
                <a href={linkBling} target="_blank" rel="noopener noreferrer" className={`${btn} bg-white border-2 border-gray-200 text-text-dark hover:border-primary`}>
                  <i className="fas fa-external-link-alt"></i> Abrir no Bling
                </a>
              )}
              <button onClick={consultar} className={`${btn} bg-white border-2 border-gray-200 text-text-dark hover:border-primary`}><i className="fas fa-sync-alt"></i> Consultar</button>
            </div>
          </>
        )}

        {etapa === 'pronta' && nota && (
          <>
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <i className="fas fa-check text-3xl text-green-600"></i>
              </div>
              <p className="font-bold text-text-dark">{nomeTipo} nº {nota.numero} autorizada!</p>
              {nota.chaveAcesso && <p className="text-[11px] text-gray-400 break-all">{nota.chaveAcesso}</p>}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {(nota.linkDanfe || nota.linkPDF) && (
                <a href={nota.linkDanfe || nota.linkPDF} target="_blank" rel="noopener noreferrer" className={`${btn} flex-1 bg-primary text-white hover:bg-dark-brown`}>
                  <i className="fas fa-file-pdf"></i> Abrir DANFE
                </a>
              )}
              {nota.xml && (
                <a href={nota.xml} target="_blank" rel="noopener noreferrer" className={`${btn} bg-white border-2 border-gray-200 text-text-dark hover:border-primary`}>
                  <i className="fas fa-code"></i> XML
                </a>
              )}
            </div>
            {(nota.linkDanfe || nota.linkPDF) && (
              <button onClick={() => enviarDanfeWhatsApp({ nota, numeroPedido: pedido.numero, clienteNome: pedido.clienteNome, celular: pedido.clienteCelular })}
                      className={`${btn} bg-green-600 text-white hover:bg-green-700 border-none`}>
                <i className="fab fa-whatsapp text-lg"></i>
                Enviar DANFE ao cliente{pedido.clienteCelular ? ` (${pedido.clienteCelular})` : ''}
              </button>
            )}
            {!pedido.clienteCelular && <p className="text-xs text-gray-400 text-center -mt-2">Cliente sem celular cadastrado: o WhatsApp vai pedir o contato.</p>}
          </>
        )}
      </div>
    </Modal>
  )
}

/* ── Concluir pedido (pergunta sobre a nota) ── */
function ModalConcluir({ pedido, onClose, onConcluido }) {
  const [emitir, setEmitir] = useState('nenhuma')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const jaTemNota = pedido.nota?.id && !notaFalhou(pedido.nota)

  async function confirmar() {
    setSalvando(true)
    setErro('')
    try {
      const r = await api('/pedidos', { method: 'POST', body: { acao: 'situacao', id: pedido.id, para: 'concluido' } })
      onConcluido(r, jaTemNota ? 'nenhuma' : emitir)
    } catch (err) { setErro(err.message); setSalvando(false) }
  }

  const opcao = (valor, titulo, texto) => (
    <label className={`flex items-start gap-3 border-2 rounded-xl p-3 cursor-pointer ${emitir === valor ? 'border-primary bg-orange-50' : 'border-gray-200'}`}>
      <input type="radio" checked={emitir === valor} onChange={() => setEmitir(valor)} className="mt-1 accent-[#d2691e]" />
      <span><span className="block font-semibold text-sm text-text-dark">{titulo}</span><span className="block text-xs text-gray-500">{texto}</span></span>
    </label>
  )

  return (
    <Modal titulo={`Concluir pedido nº ${pedido.numero ?? ''}`} onClose={onClose} largura="max-w-md">
      <div className="p-5 flex flex-col gap-3">
        <p className="text-sm text-gray-600">O pedido passa para <strong>Atendido</strong> no Bling.</p>
        {jaTemNota ? (
          <p className="text-sm text-blue-800 bg-blue-50 rounded-lg px-3 py-2">Este pedido já tem {rotuloNota(pedido.nota)} ({pedido.nota.situacaoTexto}).</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-text-dark mt-1">Emitir nota fiscal?</p>
            {opcao('nenhuma', 'Não emitir agora', 'Dá para emitir depois, pelo detalhe do pedido.')}
            {opcao('nfe', 'Emitir NF-e', 'Nota fiscal eletrônica (empresas / CNPJ).')}
            {opcao('nfce', 'Emitir NFC-e', 'Nota de consumidor (venda ao consumidor final).')}
          </>
        )}
        {erro && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">{erro}</div>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-5 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-semibold text-text-dark hover:border-primary cursor-pointer">Cancelar</button>
          <button onClick={confirmar} disabled={salvando}
                  className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 cursor-pointer border-none disabled:opacity-60 flex items-center gap-2">
            <i className={`fas ${salvando ? 'fa-spinner fa-spin' : 'fa-check'}`}></i> Concluir
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ── Detalhe do pedido ── */
function ModalPedido({ pedido: inicial, info, formas, onClose, onAtualizar, onEditar, onConcluir, onNota, showToast }) {
  const [pedido, setPedido] = useState(inicial)
  const [carregando, setCarregando] = useState(true)
  const [acao, setAcao] = useState('')

  useEffect(() => {
    api('/pedidos', { method: 'POST', body: { acao: 'detalhes', ids: [inicial.id] } })
      .then(r => {
        const p = r.pedidos[0]
        if (p?.excluido) {
          showToast('Este pedido não existe mais no Bling (foi excluído lá). Ele foi removido da lista.', 'error')
          window.dispatchEvent(new Event('cangaco:pedidosMudaram'))
          return
        }
        if (p) { setPedido(p); onAtualizar(p) }
      })
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setCarregando(false))
  }, [inicial.id])

  useEffect(() => { setPedido(p => ({ ...p, ...inicial, itens: p.itens?.length ? p.itens : inicial.itens })) }, [inicial])

  async function mudar(para, pergunta) {
    if (!window.confirm(pergunta)) return
    setAcao(para)
    try {
      const r = await api('/pedidos', { method: 'POST', body: { acao: 'situacao', id: pedido.id, para } })
      const novo = { ...pedido, ...r }
      setPedido(novo); onAtualizar(novo)
      showToast(para === 'cancelado' ? 'Pedido cancelado no Bling.' : 'Pedido reaberto no Bling.')
    } catch (err) { showToast(err.message, 'error') }
    finally { setAcao('') }
  }

  const nomeCli = info.nome
  const pdf = () => gerarPedidoPDF({
    cliente: nomeCli, cnpj: formatarDocumento(pedido.cliente?.numeroDocumento), itens: pedido.itens ?? [],
    total: pedido.total, obs: pedido.obs, numero: pedido.numero, data: pedido.data, titulo: 'PEDIDO',
  })
  function whatsapp() {
    const linhas = (pedido.itens ?? []).map(it => `• ${it.nome} ×${it.quantidade} — ${brl(it.quantidade * it.precoUnitario)}`).join('\n')
    const msg = [`🛍️ *PEDIDO Nº ${pedido.numero ?? ''}*`, '', `👤 *Cliente:* ${nomeCli}`, '', '*Produtos:*', linhas, '', `💰 *Total: ${brl(pedido.total)}*`,
      pedido.nota && notaAutorizada(pedido.nota) && (pedido.nota.linkDanfe || pedido.nota.linkPDF) ? `\n🧾 *Nota fiscal:* ${pedido.nota.linkDanfe || pedido.nota.linkPDF}` : null,
    ].filter(Boolean).join('\n')
    const cel = (info.celular || '').replace(/\D/g, '').replace(/^55/, '')
    window.open(`https://wa.me/${cel ? '55' + cel : ''}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const forma = formas.find(f => f.id === (pedido.parcelas?.[0]?.formaPagamentoId ?? pedido.formaPagamentoId))?.descricao
  const aberto = pedido.situacao === 'aberto'
  const podeNota = pedido.situacao !== 'cancelado' && (!pedido.nota?.id || notaFalhou(pedido.nota))
  const btn = 'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm cursor-pointer transition-colors'

  return (
    <Modal titulo={`Pedido nº ${pedido.numero ?? ''}`} onClose={onClose}>
      <div className="p-5 flex flex-col gap-4">
        {info.destaques.length > 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-3">
            <p className="text-xs font-bold text-yellow-800 uppercase tracking-wide mb-1.5"><i className="fas fa-star mr-1"></i>Destaques deste cliente</p>
            <ul className="flex flex-col gap-1">{info.destaques.map(d => <li key={d} className="text-sm font-semibold text-yellow-900">• {d}</li>)}</ul>
          </div>
        )}

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="font-bold text-text-dark">{nomeCli}{info.grupo && <span className="font-normal text-primary text-sm"> · {info.grupo}</span>}</p>
            {info.apelido && <p className="text-xs text-gray-500">{pedido.cliente?.nome}</p>}
            <p className="text-xs text-gray-400">{formatarDocumento(pedido.cliente?.numeroDocumento)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${SITUACAO_COR[pedido.situacao] ?? SITUACAO_COR.outro}`}>{pedido.situacaoNome || pedido.situacao}</span>
            <BadgeNota nota={pedido.nota} />
          </div>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><dt className="text-[11px] text-gray-400 uppercase">Data</dt><dd className="text-text-dark">{dataBR(pedido.data)}</dd></div>
          <div><dt className="text-[11px] text-gray-400 uppercase">Entrega</dt><dd className="text-text-dark">{dataBR(pedido.dataPrevista)}</dd></div>
          <div><dt className="text-[11px] text-gray-400 uppercase">Pagamento</dt><dd className="text-text-dark">{forma ?? '—'}</dd></div>
          <div><dt className="text-[11px] text-gray-400 uppercase">Vencimento</dt><dd className="text-text-dark">{dataBR(pedido.parcelas?.[0]?.dataVencimento)}</dd></div>
        </dl>

        <div className="border border-gray-100 rounded-xl overflow-hidden">
          {carregando && !pedido.itens?.length && <p className="p-4 text-sm text-primary"><i className="fas fa-spinner fa-spin mr-2"></i>Carregando itens do Bling…</p>}
          {(pedido.itens ?? []).map((it, i) => (
            <div key={i} className={`flex items-center gap-3 px-3 py-2 text-sm ${i % 2 ? 'bg-gray-50' : ''}`}>
              <span className="flex-1 min-w-0 truncate text-text-dark">{it.nome}</span>
              <span className="text-gray-500 shrink-0">{it.quantidade} × {brl(it.precoUnitario)}</span>
              <span className="font-semibold text-primary shrink-0 w-24 text-right">{brl(it.quantidade * it.precoUnitario)}</span>
            </div>
          ))}
          <div className="flex justify-between px-3 py-2.5 bg-orange-50 font-bold">
            <span className="text-text-dark">Total</span><span className="text-primary">{brl(pedido.total)}</span>
          </div>
        </div>

        {pedido.obs && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2"><strong>Obs:</strong> {pedido.obs}</p>}

        {pedido.nota?.id && (
          <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-3 flex items-center gap-3 flex-wrap">
            <i className="fas fa-receipt text-blue-700"></i>
            <span className="flex-1 text-sm text-blue-900 font-semibold">{rotuloNota(pedido.nota)} · {pedido.nota.situacaoTexto}</span>
            {notaAutorizada(pedido.nota) && (pedido.nota.linkDanfe || pedido.nota.linkPDF) && (
              <>
                <a href={pedido.nota.linkDanfe || pedido.nota.linkPDF} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-700 hover:underline">DANFE</a>
                <button onClick={() => enviarDanfeWhatsApp({ nota: pedido.nota, numeroPedido: pedido.numero, clienteNome: nomeCli, celular: info.celular })}
                        className="text-xs font-semibold text-green-700 hover:underline cursor-pointer bg-transparent border-none">
                  <i className="fab fa-whatsapp mr-1"></i>Enviar ao cliente
                </button>
              </>
            )}
            {!notaAutorizada(pedido.nota) && !notaFalhou(pedido.nota) && (
              <button onClick={() => onNota(pedido, pedido.nota.tipo)} className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer bg-transparent border-none">Revisar / enviar</button>
            )}
            <a href={LINK_BLING[pedido.nota.tipo](pedido.nota.id)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-700 hover:underline">Abrir no Bling</a>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {aberto && (
            <>
              <button onClick={() => onConcluir(pedido)} className={`${btn} bg-green-600 text-white hover:bg-green-700 border-none`}><i className="fas fa-check"></i> Concluir</button>
              <button onClick={() => onEditar(pedido)} className={`${btn} bg-blue-50 text-blue-700 hover:bg-blue-100 border-none`}><i className="fas fa-edit"></i> Editar</button>
            </>
          )}
          {podeNota && (
            <>
              <button onClick={() => onNota(pedido, 'nfe')} className={`${btn} bg-white border-2 border-blue-200 text-blue-700 hover:border-blue-500`}><i className="fas fa-receipt"></i> Emitir NF-e</button>
              <button onClick={() => onNota(pedido, 'nfce')} className={`${btn} bg-white border-2 border-blue-200 text-blue-700 hover:border-blue-500`}><i className="fas fa-receipt"></i> Emitir NFC-e</button>
            </>
          )}
          <button onClick={pdf} disabled={!pedido.itens?.length} className={`${btn} bg-white border-2 border-primary text-primary hover:bg-primary hover:text-white disabled:opacity-50`}><i className="fas fa-file-pdf"></i> PDF</button>
          <button onClick={whatsapp} disabled={!pedido.itens?.length} className={`${btn} bg-white border-2 border-green-600 text-green-700 hover:bg-green-600 hover:text-white disabled:opacity-50`}><i className="fab fa-whatsapp"></i> WhatsApp</button>
          <a href={LINK_BLING.pedido(pedido.id)} target="_blank" rel="noopener noreferrer" className={`${btn} bg-white border-2 border-gray-200 text-text-dark hover:border-primary`}><i className="fas fa-external-link-alt"></i> Bling</a>
          {aberto && (
            <button onClick={() => mudar('cancelado', `Cancelar o pedido nº ${pedido.numero}?\n\nEle fica como "Cancelado" no Bling.${pedido.nota && notaAutorizada(pedido.nota) ? '\n\nATENÇÃO: a nota fiscal autorizada precisa ser cancelada no painel do Bling.' : ''}`)}
                    disabled={!!acao} className={`${btn} bg-red-50 text-red-600 hover:bg-red-100 border-none ml-auto`}>
              <i className="fas fa-ban"></i> Cancelar pedido
            </button>
          )}
          {pedido.situacao === 'concluido' && (
            <button onClick={() => mudar('aberto', `Reabrir o pedido nº ${pedido.numero}? Ele volta para "Em aberto" no Bling.`)}
                    disabled={!!acao} className={`${btn} bg-gray-100 text-gray-600 hover:bg-gray-200 border-none ml-auto`}>
              <i className="fas fa-undo"></i> Reabrir
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ── Filtro de clientes (vários) ── */
function FiltroClientes({ clientes, grupos, valor, onChange }) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    const fora = e => { if (ref.current && !ref.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])
  const sel = new Set(valor)
  const lista = ordenarClientes(filtrarClientes(clientes.filter(c => c.situacao !== 'E'), busca, grupos)).slice(0, 60)
  const gruposFiltrados = grupos.filter(g => !busca.trim() || g.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setAberto(a => !a)}
              className={`flex items-center gap-2 px-3 py-2.5 border-2 rounded-lg text-sm bg-white cursor-pointer whitespace-nowrap ${valor.length ? 'border-primary text-primary font-semibold' : 'border-gray-200 text-text-dark'}`}>
        <i className="fas fa-user-check"></i>
        {valor.length ? `${valor.length} cliente${valor.length > 1 ? 's' : ''}` : 'Filtrar clientes'}
      </button>
      {aberto && (
        <div className="absolute z-30 right-0 mt-1 w-80 max-w-[90vw] bg-white border border-gray-200 rounded-xl shadow-lg">
          <div className="p-2 border-b border-gray-100 flex gap-2">
            <input autoFocus value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente ou grupo"
                   className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
            {valor.length > 0 && <button onClick={() => onChange([])} className="text-xs text-red-500 font-semibold cursor-pointer bg-transparent border-none">Limpar</button>}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {gruposFiltrados.map(g => {
              const ids = clientes.filter(c => c.grupoId === g.id).map(c => c.id)
              const todos = ids.length > 0 && ids.every(id => sel.has(id))
              return (
                <label key={g.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-orange-50 bg-orange-50/40">
                  <input type="checkbox" checked={todos} className="accent-[#d2691e]"
                         onChange={() => onChange(todos ? valor.filter(id => !ids.includes(id)) : [...new Set([...valor, ...ids])])} />
                  <span className="text-sm font-semibold text-primary"><i className="fas fa-object-group mr-1"></i>{g.nome} ({ids.length})</span>
                </label>
              )
            })}
            {lista.map(c => (
              <label key={c.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={sel.has(c.id)} className="accent-[#d2691e]"
                       onChange={() => onChange(sel.has(c.id) ? valor.filter(x => x !== c.id) : [...valor, c.id])} />
                <span className="text-sm text-text-dark truncate">{nomeExibicao(c)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Seção Pedidos ── */
export default function SecaoPedidos({ showToast, irPara, produtos = [] }) {
  const [pedidos,    setPedidos]    = useState([])
  const [orcamentos, setOrcamentos] = useState([])
  const [clientes,   setClientes]   = useState([])
  const [grupos,     setGrupos]     = useState([])
  const [formas,     setFormas]     = useState([])
  const [ultimaSync, setUltimaSync] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [gerandoPDF, setGerandoPDF] = useState('')

  const [aba,      setAba]      = useRascunho('admin:pedidos:aba', 'abertos')
  const [busca,    setBusca]    = useRascunho('admin:pedidos:busca', '')
  const [filtroCli, setFiltroCli] = useRascunho('admin:pedidos:clientes', [])
  const [de,       setDe]       = useRascunho('admin:pedidos:de', hojeISO(-30))
  const [ate,      setAte]      = useRascunho('admin:pedidos:ate', hojeISO())
  const [filtroSit, setFiltroSit] = useRascunho('admin:pedidos:situacao', 'todos')
  const [verConvertidos, setVerConvertidos] = useRascunho('admin:pedidos:convertidos', false)
  const [selecionados, setSelecionados] = useRascunho('admin:pedidos:selecionados', [])
  const [detalheId, setDetalheId] = useRascunho('admin:pedidos:detalhe', null)
  const [concluirId, setConcluirId] = useState(null)
  const [fluxoNota, setFluxoNota]   = useState(null)

  async function carregar() {
    const r = await obterPedidos()
    setPedidos(r.pedidos)
    setOrcamentos(r.orcamentos)
    setUltimaSync(r.ultimaSincronizacao)
    return r
  }

  // Algum pedido foi excluído no Bling: recarrega (ele vem marcado e sai da lista)
  useEffect(() => {
    const recarregar = () => { carregar().catch(() => {}) }
    window.addEventListener('cangaco:pedidosMudaram', recarregar)
    return () => window.removeEventListener('cangaco:pedidosMudaram', recarregar)
  }, [])

  async function sincronizar({ completo = false, silencioso = false } = {}) {
    setSincronizando(true)
    try {
      const r = await api('/pedidos', { method: 'POST', body: { acao: 'sincronizar', completo } })
      await carregar()
      if (!silencioso) showToast(r.total ? `${r.total} pedido(s) atualizado(s) do Bling.` : 'Pedidos já estão em dia.')
    } catch (err) { showToast(err.message, 'error') }
    finally { setSincronizando(false) }
  }

  useEffect(() => {
    (async () => {
      try {
        const [r] = await Promise.all([
          carregar(),
          obterClientes().then(c => { setClientes(c.clientes); setGrupos(c.grupos ?? []) }),
        ])
        setCarregando(false)
        obterFormasPagamento().then(setFormas).catch(() => {})
        if (!r.ultimaSincronizacao) await sincronizar({ completo: true })
        else if (Date.now() - r.ultimaSincronizacao > 30 * 60 * 1000) await sincronizar({ silencioso: true })
      } catch (err) { showToast(err.message, 'error'); setCarregando(false) }
    })()
  }, [])

  // Nome, grupo e destaques do cliente de um pedido (dados do site)
  function infoCliente(p) {
    const c = clientes.find(x => x.id === p.cliente?.id)
    const base = c ?? { nome: p.cliente?.nome ?? '', apelido: p.cliente?.apelido ?? '', grupoId: p.cliente?.grupoId ?? null }
    return {
      nome: nomeExibicao(base) || p.cliente?.nome || '—',
      apelido: base.apelido,
      grupo: base.grupoId ? grupos.find(g => g.id === base.grupoId)?.nome : null,
      destaques: c ? destaquesDoCliente(c, grupos) : [],
      celular: c?.celular || c?.telefone || '',
    }
  }

  const textoBusca = p => {
    const i = infoCliente(p)
    return `${p.numero ?? ''} ${i.nome} ${p.cliente?.nome ?? ''} ${i.grupo ?? ''} ${p.cliente?.numeroDocumento ?? ''}`
      .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  }
  const termo = busca.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const passaFiltros = p =>
    (!termo || textoBusca(p).includes(termo)) &&
    (!filtroCli.length || filtroCli.includes(p.cliente?.id))

  const ordem = (a, b) => String(a.data ?? '').localeCompare(String(b.data ?? '')) || (a.numero ?? 0) - (b.numero ?? 0)
  const abertos = pedidos.filter(p => p.situacao === 'aberto' && passaFiltros(p)).sort(ordem)
  const historico = pedidos
    .filter(p => passaFiltros(p) && (!de || String(p.data ?? '') >= de) && (!ate || String(p.data ?? '') <= ate))
    .filter(p => filtroSit === 'todos' || p.situacao === filtroSit)
    .sort((a, b) => ordem(b, a))
  const orcs = orcamentos
    .filter(o => verConvertidos || !o.convertidoEm)
    .filter(o => (!termo || `${o.cliente?.nome} ${o.cliente?.apelido}`.toLowerCase().includes(termo)) && (!filtroCli.length || filtroCli.includes(o.cliente?.id)))
    .sort((a, b) => (b.atualizadoEm ?? 0) - (a.atualizadoEm ?? 0))
  const qtdAbertos = pedidos.filter(p => p.situacao === 'aberto').length
  const qtdOrcs = orcamentos.filter(o => !o.convertidoEm).length

  const visiveis = aba === 'abertos' ? abertos : historico
  const selSet = new Set(selecionados)
  const todosSel = visiveis.length > 0 && visiveis.every(p => selSet.has(p.id))
  const alternarSel = id => setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  function atualizarPedido(p) { setPedidos(prev => prev.map(x => x.id === p.id ? { ...x, ...p } : x)) }

  // Resumo de produção: soma a quantidade de cada produto em todos os pedidos em aberto
  async function pdfProducao() {
    if (!abertos.length) return
    setGerandoPDF('producao')
    try {
      const { pedidos: todos } = await api('/pedidos', { method: 'POST', body: { acao: 'detalhes', ids: abertos.map(p => p.id) } })
      if (todos.some(p => p.excluido)) window.dispatchEvent(new Event('cangaco:pedidosMudaram'))
      const completos = todos.filter(p => !p.excluido)
      completos.forEach(atualizarPedido)

      const soma = {}
      completos.forEach(p => (p.itens ?? []).forEach(it => {
        const chave = it.blingProdutoId || String(it.nome ?? '').trim().toLowerCase()
        const doCatalogo = produtos.find(x => (it.blingProdutoId && x.blingProdutoId === it.blingProdutoId) || (it.produtoId && x.id === it.produtoId))
        const atual = soma[chave] ?? { nome: doCatalogo?.nome || it.nome, quantidade: 0, valor: 0, qtdFardo: doCatalogo?.qtdFardo ?? 0 }
        atual.quantidade += Number(it.quantidade || 0)
        atual.valor += Number(it.quantidade || 0) * Number(it.precoUnitario || 0)
        soma[chave] = atual
      }))

      gerarResumoProducaoPDF({
        produtos: Object.values(soma).sort((a, b) => String(a.nome).localeCompare(String(b.nome))),
        pedidos: completos
          .sort((a, b) => String(a.dataPrevista ?? a.data ?? '').localeCompare(String(b.dataPrevista ?? b.data ?? '')) || (a.numero ?? 0) - (b.numero ?? 0))
          .map(p => {
            const i = infoCliente(p)
            return { numero: p.numero, entrega: p.dataPrevista || p.data, cliente: i.nome, destaques: i.destaques, total: p.total }
          }),
        descricao: filtroCli.length ? 'Pedidos em aberto (clientes filtrados)' : 'Pedidos em aberto',
      })
    } catch (err) { showToast(err.message, 'error') }
    finally { setGerandoPDF('') }
  }

  async function pdfPedidos(lista, descricao, arquivo) {
    if (!lista.length) { showToast('Nenhum pedido para gerar o PDF.', 'error'); return }
    setGerandoPDF(arquivo)
    try {
      const { pedidos: todos } = await api('/pedidos', { method: 'POST', body: { acao: 'detalhes', ids: lista.map(p => p.id) } })
      // Pedidos que não existem mais no Bling saem da lista e do PDF
      if (todos.some(p => p.excluido)) window.dispatchEvent(new Event('cangaco:pedidosMudaram'))
      const completos = todos.filter(p => !p.excluido)
      lista = lista.filter(p => completos.some(c => c.id === p.id))
      completos.forEach(atualizarPedido)
      const porId = Object.fromEntries(completos.map(p => [p.id, p]))
      gerarPedidosPDF(lista.map(p => {
        const c = porId[p.id] ?? p
        return {
          cliente: infoCliente(c).nome, cnpj: formatarDocumento(c.cliente?.numeroDocumento), itens: c.itens ?? [],
          total: c.total, obs: c.obs, numero: c.numero, data: c.data, situacao: c.situacaoNome, titulo: 'PEDIDO',
        }
      }), { descricao, arquivo })
    } catch (err) { showToast(err.message, 'error') }
    finally { setGerandoPDF('') }
  }

  function pdfOrcamento(o) {
    gerarPedidoPDF({
      cliente: nomeExibicao(o.cliente) || o.cliente?.nome, cnpj: formatarDocumento(o.cliente?.numeroDocumento),
      itens: o.itens, total: o.total, obs: o.obs, titulo: 'ORÇAMENTO',
      data: o.atualizadoEm ? new Date(o.atualizadoEm).toISOString().slice(0, 10) : undefined,
    })
  }

  function editarPedido(p) {
    const c = clientes.find(x => x.id === p.cliente?.id)
    abrirNoCriarPedido({
      cliente: c ? { id: c.id, nome: c.nome, apelido: c.apelido ?? '', numeroDocumento: c.numeroDocumento ?? '', grupoId: c.grupoId ?? null,
                     celular: c.celular || c.telefone || '', destaques: c.destaques ?? [], tabelaPreco: c.tabelaPreco ?? null }
                 : { id: p.cliente?.id, nome: p.cliente?.nome, numeroDocumento: p.cliente?.numeroDocumento ?? '' },
      itens: (p.itens ?? []).map(it => ({ ...it, produtoId: it.produtoId ?? null })),
      obs: p.obs, formaPagamentoId: p.parcelas?.[0]?.formaPagamentoId ?? p.formaPagamentoId,
      prazoDias: p.prazoDias ?? (p.parcelas?.[0]?.dataVencimento && p.data
        ? Math.max(0, Math.round((new Date(p.parcelas[0].dataVencimento) - new Date(p.data)) / 86400000)) : 0),
      dataEntrega: p.dataPrevista, editandoId: p.id, editandoNumero: p.numero,
    })
    setDetalheId(null)
    irPara('pedidos')
  }

  function abrirOrcamento(o) {
    abrirNoCriarPedido({
      cliente: o.cliente?.id ? (() => {
        const c = clientes.find(x => x.id === o.cliente.id) ?? o.cliente
        return { id: c.id, nome: c.nome, apelido: c.apelido ?? '', numeroDocumento: c.numeroDocumento ?? '', grupoId: c.grupoId ?? null,
                 celular: c.celular || c.telefone || '', destaques: c.destaques ?? [], tabelaPreco: c.tabelaPreco ?? null }
      })() : null,
      clienteNome: o.cliente?.nome, itens: o.itens, obs: o.obs, formaPagamentoId: o.formaPagamentoId,
      prazoDias: o.prazoDias, dataEntrega: o.dataEntrega, tabela: o.tabela, orcamentoId: o.id,
    })
    irPara('pedidos')
  }

  async function excluirOrcamento(o) {
    if (!window.confirm(`Excluir o orçamento de "${nomeExibicao(o.cliente) || o.cliente?.nome}"?`)) return
    try {
      await api('/pedidos', { method: 'POST', body: { acao: 'orcamento_excluir', id: o.id } })
      setOrcamentos(prev => prev.filter(x => x.id !== o.id))
      showToast('Orçamento excluído.')
    } catch (err) { showToast(err.message, 'error') }
  }

  const detalhe = pedidos.find(p => p.id === detalheId)
  const fmtData = ms => ms ? new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca'
  const tabCls = sel => `px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer border-none transition-colors whitespace-nowrap ${sel ? 'bg-primary text-white' : 'bg-white text-text-dark hover:bg-gray-100'}`
  const btnSec = 'flex items-center gap-2 bg-white border-2 border-primary text-primary px-3 py-2 rounded-lg font-semibold text-sm hover:bg-primary hover:text-white transition-colors cursor-pointer disabled:opacity-50'
  const spin = nome => gerandoPDF === nome ? 'fa-spinner fa-spin' : 'fa-file-pdf'

  return (
    <>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-text-dark">Pedidos</h2>
          <p className="text-sm text-gray-400 mt-0.5">{qtdAbertos} em aberto · sincronizado com o Bling em {fmtData(ultimaSync)}</p>
        </div>
        <button onClick={() => sincronizar()} disabled={sincronizando} className={btnSec}>
          <i className={`fas fa-sync-alt ${sincronizando ? 'fa-spin' : ''}`}></i>
          <span className="hidden sm:inline">{sincronizando ? 'Sincronizando…' : 'Sincronizar'}</span>
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-4 overflow-x-auto max-w-full">
        <button onClick={() => setAba('abertos')} className={tabCls(aba === 'abertos')}>Em aberto ({qtdAbertos})</button>
        <button onClick={() => setAba('historico')} className={tabCls(aba === 'historico')}>Histórico</button>
        <button onClick={() => setAba('orcamentos')} className={tabCls(aba === 'orcamentos')}>Orçamentos ({qtdOrcs})</button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nº, cliente, grupo ou CNPJ" className={inputCls + ' pl-9'} />
        </div>
        <FiltroClientes clientes={clientes} grupos={grupos} valor={filtroCli} onChange={setFiltroCli} />
      </div>

      {aba === 'historico' && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <label className="text-xs text-gray-500">De</label>
          <input type="date" value={de} onChange={e => setDe(e.target.value)} className="px-2 py-1.5 border-2 border-gray-200 rounded-lg text-sm bg-white" />
          <label className="text-xs text-gray-500">até</label>
          <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="px-2 py-1.5 border-2 border-gray-200 rounded-lg text-sm bg-white" />
          <select value={filtroSit} onChange={e => setFiltroSit(e.target.value)} className="px-2 py-1.5 border-2 border-gray-200 rounded-lg text-sm bg-white">
            <option value="todos">Todas as situações</option>
            <option value="aberto">Em aberto</option>
            <option value="concluido">Concluídos (Atendido)</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </div>
      )}

      {aba !== 'orcamentos' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selecionados.length > 0 && (
            <button onClick={() => pdfPedidos(pedidos.filter(p => selSet.has(p.id)).sort(ordem), 'Pedidos selecionados', 'pedidos-selecionados')}
                    disabled={!!gerandoPDF} className={btnSec}>
              <i className={`fas ${spin('pedidos-selecionados')}`}></i> PDF dos selecionados ({selecionados.length})
            </button>
          )}
          {aba === 'abertos' && (
            <button onClick={pdfProducao} disabled={!!gerandoPDF || !abertos.length} className={btnSec}>
              <i className={`fas ${spin('producao')}`}></i> Resumo de produção (PDF)
            </button>
          )}
          {aba === 'historico' && (
            <button onClick={() => pdfPedidos(historico.filter(p => p.situacao === 'concluido').sort(ordem), `Pedidos finalizados (${dataBR(de)} a ${dataBR(ate)})`, 'pedidos-finalizados')}
                    disabled={!!gerandoPDF || !historico.some(p => p.situacao === 'concluido')} className={btnSec}>
              <i className={`fas ${spin('pedidos-finalizados')}`}></i> PDF dos finalizados
            </button>
          )}
          {filtroCli.length > 0 && (
            <button onClick={() => pdfPedidos([...visiveis].sort(ordem), 'Pedidos dos clientes selecionados', 'pedidos-por-cliente')}
                    disabled={!!gerandoPDF || !visiveis.length} className={btnSec}>
              <i className={`fas ${spin('pedidos-por-cliente')}`}></i> PDF dos clientes selecionados
            </button>
          )}
          {selecionados.length > 0 && (
            <button onClick={() => setSelecionados([])} className="text-sm text-gray-500 hover:text-primary cursor-pointer bg-transparent border-none">Limpar seleção</button>
          )}
        </div>
      )}

      {(carregando || (sincronizando && !pedidos.length)) && (
        <div className="flex flex-col items-center justify-center py-20 text-primary gap-3">
          <i className="fas fa-spinner fa-spin text-4xl"></i>
          <p>{sincronizando ? 'Importando pedidos do Bling…' : 'Carregando pedidos…'}</p>
        </div>
      )}

      {/* Pedidos */}
      {!carregando && aba !== 'orcamentos' && (
        visiveis.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <i className="fas fa-clipboard-list text-5xl"></i>
            <p>{aba === 'abertos' ? 'Nenhum pedido em aberto.' : 'Nenhum pedido neste período.'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
            <label className="flex items-center gap-3 px-4 py-2 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={todosSel} className="accent-[#d2691e]"
                     onChange={() => setSelecionados(todosSel ? selecionados.filter(id => !visiveis.some(p => p.id === id)) : [...new Set([...selecionados, ...visiveis.map(p => p.id)])])} />
              Selecionar todos ({visiveis.length}) · total {brl(visiveis.reduce((a, p) => a + Number(p.total || 0), 0))}
            </label>
            {visiveis.map(p => {
              const i = infoCliente(p)
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-orange-50/40">
                  <input type="checkbox" checked={selSet.has(p.id)} onChange={() => alternarSel(p.id)} className="accent-[#d2691e] w-4 h-4 shrink-0" />
                  <button onClick={() => setDetalheId(p.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer bg-transparent border-none p-0">
                    <div className="w-14 shrink-0">
                      <p className="text-sm font-bold text-text-dark">nº {p.numero ?? '—'}</p>
                      <p className="text-[11px] text-gray-400">{dataBR(p.data)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-dark truncate">
                        {i.nome}{i.grupo && <span className="font-normal text-primary"> · {i.grupo}</span>}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {aba === 'historico' && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${SITUACAO_COR[p.situacao] ?? SITUACAO_COR.outro}`}>{p.situacaoNome || p.situacao}</span>}
                        <BadgeNota nota={p.nota} />
                      </div>
                      <Chips lista={i.destaques} />
                    </div>
                    <p className="text-sm font-bold text-primary shrink-0">{brl(p.total)}</p>
                  </button>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Orçamentos */}
      {!carregando && aba === 'orcamentos' && (
        <>
          <label className="flex items-center gap-2 text-sm text-gray-500 mb-3 cursor-pointer w-fit">
            <input type="checkbox" checked={verConvertidos} onChange={e => setVerConvertidos(e.target.checked)} className="accent-[#d2691e]" />
            Mostrar orçamentos já convertidos em pedido
          </label>
          {orcs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
              <i className="fas fa-file-alt text-5xl"></i>
              <p>Nenhum orçamento.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
              {orcs.map(o => {
                const c = clientes.find(x => x.id === o.cliente?.id)
                const nome = c ? nomeExibicao(c) : (o.cliente?.apelido || o.cliente?.nome)
                return (
                  <div key={o.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-dark truncate">
                        {nome}
                        {!o.cliente?.id && <span className="ml-2 text-[10px] font-semibold text-gray-400">sem cadastro</span>}
                        {o.convertidoEm && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">virou pedido nº {o.convertidoNumero ?? ''}</span>}
                      </p>
                      <p className="text-xs text-gray-400">
                        {o.itens?.length ?? 0} ite{o.itens?.length === 1 ? 'm' : 'ns'} · atualizado em {o.atualizadoEm ? new Date(o.atualizadoEm).toLocaleDateString('pt-BR') : '—'}
                      </p>
                      {c && <Chips lista={destaquesDoCliente(c, grupos)} />}
                    </div>
                    <p className="text-sm font-bold text-primary">{brl(o.total)}</p>
                    <div className="flex gap-1.5">
                      {!o.convertidoEm && (
                        <button onClick={() => abrirOrcamento(o)} title="Abrir / converter em pedido"
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold cursor-pointer border-none">
                          <i className="fas fa-folder-open"></i><span className="hidden sm:inline">Abrir</span>
                        </button>
                      )}
                      <button onClick={() => pdfOrcamento(o)} title="PDF"
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-50 text-primary hover:bg-orange-100 text-xs font-semibold cursor-pointer border-none">
                        <i className="fas fa-file-pdf"></i>
                      </button>
                      <button onClick={() => excluirOrcamento(o)} title="Excluir"
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 text-xs font-semibold cursor-pointer border-none">
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {detalhe && (
        <ModalPedido pedido={detalhe} info={infoCliente(detalhe)} formas={formas}
                     onClose={() => setDetalheId(null)} onAtualizar={atualizarPedido} onEditar={editarPedido}
                     onConcluir={p => setConcluirId(p.id)}
                     onNota={(p, tipo) => setFluxoNota({ id: p.id, tipo })}
                     showToast={showToast} />
      )}

      {concluirId && pedidos.find(p => p.id === concluirId) && (
        <ModalConcluir pedido={pedidos.find(p => p.id === concluirId)} onClose={() => setConcluirId(null)}
                       onConcluido={(r, emitir) => {
                         atualizarPedido(r)
                         setConcluirId(null)
                         showToast('Pedido concluído no Bling.')
                         if (emitir !== 'nenhuma') setFluxoNota({ id: r.id, tipo: emitir })
                       }} />
      )}

      {fluxoNota && pedidos.find(p => p.id === fluxoNota.id) && (() => {
        const p = pedidos.find(x => x.id === fluxoNota.id)
        return (
          <FluxoNota pedido={{ ...p, clienteNome: infoCliente(p).nome, clienteCelular: infoCliente(p).celular }} tipo={fluxoNota.tipo}
                     onClose={() => setFluxoNota(null)}
                     onNota={nota => atualizarPedido({ id: p.id, nota })} />
        )
      })()}
    </>
  )
}
