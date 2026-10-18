import { useState, useEffect } from 'react'
import { lerFila, processarFila, removerDaFila, liberarParaReenvio } from '../../lib/filaOffline.js'
import { abrirNoCriarPedido } from './CriarPedido.jsx'
import { notificarLocal } from '../../lib/notificacoes.js'

const brl = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`

// Indicador no topo do painel: "Offline" e pedidos guardados aguardando envio.
// Também envia a fila sozinho quando a internet volta.
export default function StatusConexao({ showToast, irPara }) {
  const [online, setOnline] = useState(navigator.onLine)
  const [fila, setFila]     = useState(lerFila)
  const [aberto, setAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    setEnviando(true)
    try { await processarFila() } finally { setEnviando(false) }
  }

  useEffect(() => {
    const on  = () => { setOnline(true); enviar() }
    const off = () => setOnline(false)
    const mudouFila = e => setFila(e.detail)
    const enviados = e => e.detail.forEach(({ item, r }) => {
      const msg = r?.numero ? `${item.resumo?.tipo ?? 'Pedido'} enviado ao Bling: nº ${r.numero} – ${item.resumo?.cliente ?? ''}` : `${item.resumo?.tipo ?? 'Item'} de ${item.resumo?.cliente ?? ''} enviado.`
      showToast(msg)
      notificarLocal('☁️ Fila offline enviada', msg, `fila-${item.id}`)
    })
    const comErro = e => {
      const { item, erro } = e.detail
      notificarLocal('⚠️ Pedido da fila não foi enviado', `${item.resumo?.tipo ?? 'Item'} de ${item.resumo?.cliente ?? ''}: ${erro}`, `fila-${item.id}`)
    }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    window.addEventListener('cangaco:fila', mudouFila)
    window.addEventListener('cangaco:filaEnviada', enviados)
    window.addEventListener('cangaco:filaErro', comErro)
    enviar()
    // Se algo ficou na fila (ex.: servidor em manutenção), tenta de novo a cada minuto
    const t = setInterval(() => { if (lerFila().some(i => !i.erro)) enviar() }, 60000)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      window.removeEventListener('cangaco:fila', mudouFila)
      window.removeEventListener('cangaco:filaEnviada', enviados)
      window.removeEventListener('cangaco:filaErro', comErro)
      clearInterval(t)
    }
  }, [])

  function abrirParaCorrigir(item) {
    const p = item.corpo.pedido ?? item.corpo.orcamento ?? {}
    abrirNoCriarPedido({
      ...p,
      editandoId: item.corpo.acao === 'editar' ? item.corpo.id : undefined,
      orcamentoId: item.corpo.acao === 'orcamento_salvar' ? (p.id ?? undefined) : p.orcamentoId,
    })
    removerDaFila(item.id)
    setAberto(false)
    irPara('pedidos')
  }

  if (online && fila.length === 0) return null
  const comErro = fila.filter(i => i.erro).length

  return (
    <>
      <button onClick={() => setAberto(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border-none cursor-pointer ${
                !online ? 'bg-red-500 text-white' : comErro ? 'bg-red-100 text-red-700' : 'bg-yellow-300 text-yellow-950'}`}>
        <i className={`fas ${!online ? 'fa-wifi' : enviando ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`}></i>
        {!online ? 'Offline' : ''}
        {fila.length > 0 && <span>{!online ? ' · ' : ''}{fila.length} aguardando envio</span>}
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={e => { if (e.target === e.currentTarget) setAberto(false) }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-text-dark">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold">{online ? 'Aguardando envio' : 'Você está offline'}</h3>
              <button onClick={() => setAberto(false)} className="text-gray-400 hover:text-primary cursor-pointer bg-transparent border-none p-1"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <p className="text-sm text-gray-500">
                {online
                  ? 'Estes itens foram salvos no aparelho e estão sendo enviados.'
                  : 'Sem internet: dá para criar pedidos e orçamentos normalmente. Eles ficam salvos neste aparelho e são enviados sozinhos quando a conexão voltar. Emitir nota, concluir e sincronizar precisam de internet.'}
              </p>
              {fila.length === 0 && <p className="text-sm text-gray-400">Nada aguardando envio.</p>}
              {fila.map(item => (
                <div key={item.id} className={`border rounded-xl p-3 ${item.erro ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-sm font-semibold truncate">{item.resumo?.tipo} · {item.resumo?.cliente}</p>
                    <p className="text-sm font-bold text-primary">{brl(item.resumo?.total)}</p>
                  </div>
                  <p className="text-[11px] text-gray-400">salvo em {new Date(item.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  {item.erro && <p className="text-xs text-red-700 mt-1"><i className="fas fa-exclamation-circle mr-1"></i>{item.erro}</p>}
                  <div className="flex gap-3 mt-2">
                    <button onClick={() => abrirParaCorrigir(item)} className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer bg-transparent border-none">Abrir / corrigir</button>
                    {item.erro && <button onClick={() => { liberarParaReenvio(item.id); enviar() }} className="text-xs font-semibold text-primary hover:underline cursor-pointer bg-transparent border-none">Tentar de novo</button>}
                    <button onClick={() => { if (window.confirm('Descartar este item? Ele não será enviado.')) removerDaFila(item.id) }}
                            className="text-xs font-semibold text-red-500 hover:underline cursor-pointer bg-transparent border-none ml-auto">Descartar</button>
                  </div>
                </div>
              ))}
              {online && fila.some(i => !i.erro) && (
                <button onClick={enviar} disabled={enviando}
                        className="flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-xl font-semibold text-sm cursor-pointer border-none disabled:opacity-60">
                  <i className={`fas ${enviando ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`}></i> Enviar agora
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
