import { useState, useEffect } from 'react'
import {
  suporte, ativadoNesteAparelho, ativarNotificacoes, desativarNotificacoes, testarNotificacao, ehIOS,
} from '../../lib/notificacoes.js'

// Sininho no topo do painel: ativa/desativa as notificações neste aparelho
export default function BotaoNotificacoes({ showToast }) {
  const [estado, setEstado] = useState('carregando')
  const [ativo, setAtivo]   = useState(ativadoNesteAparelho())
  const [aberto, setAberto] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => { suporte().then(setEstado) }, [])

  // Sem chave configurada ou navegador sem suporte (fora do iPhone): não mostra nada
  if (estado === 'carregando' || estado === 'sem-chave' || (estado === 'sem-suporte' && !ehIOS())) return null

  async function alternar() {
    setOcupado(true)
    try {
      if (ativo) {
        await desativarNotificacoes()
        setAtivo(false)
        showToast('Notificações desativadas neste aparelho.')
      } else {
        await ativarNotificacoes()
        setAtivo(true)
        await testarNotificacao().catch(() => {})
        showToast('Notificações ativadas! Você deve receber uma de teste.')
      }
    } catch (err) { showToast(err.message, 'error') }
    finally { setOcupado(false) }
  }

  return (
    <>
      <button onClick={() => setAberto(true)} title="Notificações"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer border-none text-white">
        <i className={`fas ${ativo ? 'fa-bell' : 'fa-bell-slash'} text-sm`}></i>
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={e => { if (e.target === e.currentTarget) setAberto(false) }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md text-text-dark">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold">Notificações</h3>
              <button onClick={() => setAberto(false)} className="text-gray-400 hover:text-primary cursor-pointer bg-transparent border-none p-1"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="p-5 flex flex-col gap-4 text-sm">
              {estado === 'ios-instalar' ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-900">
                  <p className="font-bold mb-2"><i className="fab fa-apple mr-1"></i>No iPhone, instale o painel primeiro</p>
                  <ol className="list-decimal ml-5 flex flex-col gap-1">
                    <li>No Safari, toque em <strong>Compartilhar</strong> <i className="fas fa-share-square"></i>.</li>
                    <li>Escolha <strong>“Adicionar à Tela de Início”</strong>.</li>
                    <li>Abra o painel pelo novo ícone <strong>Cangaço</strong> e toque no sininho de novo.</li>
                  </ol>
                </div>
              ) : estado === 'sem-suporte' ? (
                <p className="text-gray-600">Este navegador não aceita notificações. Use o Chrome (Android/computador) ou o painel instalado no iPhone (iOS 16.4 ou mais novo).</p>
              ) : (
                <>
                  <p className="text-gray-600">Receba neste aparelho, mesmo com o painel fechado:</p>
                  <ul className="flex flex-col gap-1.5 text-gray-700">
                    <li><i className="fas fa-shopping-bag text-primary w-5"></i> Novo pedido criado por outro admin ou direto no Bling</li>
                    <li><i className="fas fa-receipt text-primary w-5"></i> Nota fiscal autorizada ou rejeitada</li>
                    <li><i className="fas fa-cloud-upload-alt text-primary w-5"></i> Pedidos da fila offline enviados ou com erro</li>
                    <li><i className="fas fa-plug text-primary w-5"></i> Conexão com o Bling com problema</li>
                  </ul>
                  <div className={`rounded-xl px-4 py-3 font-semibold ${ativo ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-600'}`}>
                    <i className={`fas ${ativo ? 'fa-check-circle' : 'fa-bell-slash'} mr-2`}></i>
                    {ativo ? 'Ativadas neste aparelho' : 'Desativadas neste aparelho'}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={alternar} disabled={ocupado}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold cursor-pointer border-none disabled:opacity-60 ${ativo ? 'bg-gray-100 text-gray-700' : 'bg-primary text-white'}`}>
                      <i className={`fas ${ocupado ? 'fa-spinner fa-spin' : ativo ? 'fa-bell-slash' : 'fa-bell'}`}></i>
                      {ativo ? 'Desativar' : 'Ativar notificações'}
                    </button>
                    {ativo && (
                      <button onClick={() => testarNotificacao().then(() => showToast('Teste enviado.')).catch(err => showToast(err.message, 'error'))}
                              className="px-4 py-2.5 rounded-xl font-semibold cursor-pointer border-2 border-gray-200 bg-white text-text-dark">
                        Testar
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Cada aparelho precisa ser ativado separadamente.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
