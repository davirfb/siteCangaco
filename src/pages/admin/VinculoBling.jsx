import { useState } from 'react'
import { api } from '../../lib/api.js'

// Produtos do Bling ficam em memória durante a sessão (mudam pouco)
let cacheProdutos = null
export async function carregarProdutosBling(forcar = false) {
  if (!cacheProdutos || forcar) cacheProdutos = (await api('/pedidos?recurso=produtosBling')).produtos
  return cacheProdutos
}

const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Escolhe o produto do Bling correspondente a um produto do Catálogo
export default function VinculoBling({ valor, onChange, inputCls }) {
  const [aberto, setAberto]     = useState(false)
  const [lista, setLista]       = useState(null)
  const [busca, setBusca]       = useState('')
  const [erro, setErro]         = useState('')

  async function abrir() {
    setAberto(true)
    setErro('')
    try { setLista(await carregarProdutosBling()) }
    catch (err) { setErro(err.message) }
  }

  const t = semAcento(busca).trim()
  const filtrados = (lista ?? []).filter(p => !t || semAcento(`${p.nome} ${p.codigo}`).includes(t)).slice(0, 50)

  return (
    <div>
      {valor?.id ? (
        <div className="flex items-center gap-2 border-2 border-green-200 bg-green-50 rounded-lg px-3 py-2">
          <i className="fas fa-link text-green-600 text-sm"></i>
          <span className="flex-1 text-sm text-green-800 truncate">{valor.nome}</span>
          <button type="button" onClick={abrir} className="text-xs font-semibold text-green-700 hover:underline cursor-pointer bg-transparent border-none">Trocar</button>
          <button type="button" onClick={() => onChange(null)} title="Remover vínculo"
                  className="text-red-400 hover:text-red-600 cursor-pointer bg-transparent border-none">
            <i className="fas fa-times text-sm"></i>
          </button>
        </div>
      ) : !aberto && (
        <button type="button" onClick={abrir}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-2.5 text-sm text-gray-500 hover:border-primary hover:text-primary cursor-pointer bg-transparent">
          <i className="fas fa-link"></i> Vincular a um produto do Bling
        </button>
      )}

      {aberto && (
        <div className="mt-2 border-2 border-gray-100 rounded-lg p-2">
          <div className="flex gap-2 mb-2">
            <input autoFocus value={busca} onChange={e => setBusca(e.target.value)}
                   placeholder="Buscar produto no Bling" className={inputCls} />
            <button type="button" onClick={() => setAberto(false)}
                    className="shrink-0 px-3 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 text-sm cursor-pointer border-none">
              Fechar
            </button>
          </div>
          {erro && <p className="text-sm text-red-600 p-2">{erro}</p>}
          {!erro && !lista && <p className="text-sm text-primary p-2"><i className="fas fa-spinner fa-spin mr-2"></i>Carregando produtos do Bling…</p>}
          {lista && (
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
              {filtrados.length === 0 && <p className="text-sm text-gray-400 p-2">Nenhum produto encontrado.</p>}
              {filtrados.map(p => (
                <button type="button" key={p.id}
                        onClick={() => { onChange({ id: p.id, nome: p.nome }); setAberto(false); setBusca('') }}
                        className={`w-full text-left px-2 py-2 hover:bg-orange-50 cursor-pointer bg-transparent border-none flex justify-between gap-3 ${valor?.id === p.id ? 'bg-green-50' : ''}`}>
                  <span className="text-sm text-text-dark">{p.nome}{p.codigo && <span className="text-gray-400"> · {p.codigo}</span>}</span>
                  <span className="text-xs text-gray-400 shrink-0">R$ {Number(p.preco).toFixed(2).replace('.', ',')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
