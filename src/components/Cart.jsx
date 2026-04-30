import { useEffect } from 'react'
import { useCart } from './context/CartContext.jsx'

const EMPRESA_EMAIL = 'empresacangaco@gmail.com'
const WHATSAPP      = '5561993779722'

function montarMensagem(itens, total) {
  const lista = itens
    .map(i => `• ${i.nome} x${i.quantidade} — R$ ${(Number(i.preco) * i.quantidade).toFixed(2).replace('.', ',')}`)
    .join('\n')
  return `Olá! Gostaria de fazer um pedido:\n\n${lista}\n\nTotal: R$ ${total.toFixed(2).replace('.', ',')}`
}

export default function Cart() {
  const { itens, total, aberto, setAberto, remover, alterarQtd, limpar } = useCart()

  useEffect(() => {
    document.body.style.overflow = aberto ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [aberto])

  function enviarWhatsApp() {
    const msg = encodeURIComponent(montarMensagem(itens, total))
    window.open(`https://wa.me/${WHATSAPP}?text=${msg}`, '_blank')
  }

  function enviarEmail() {
    const msg   = montarMensagem(itens, total)
    const assunto = encodeURIComponent('Pedido — Cangaço Alimentos')
    const corpo   = encodeURIComponent(msg)
    window.open(`mailto:${EMPRESA_EMAIL}?subject=${assunto}&body=${corpo}`)
  }

  if (!aberto) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-[60] animate-fadeIn"
        onClick={() => setAberto(false)}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col animate-slideUp"
           style={{ animation: 'slideRight 0.3s ease forwards' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <i className="fas fa-shopping-cart text-primary text-xl"></i>
            <h2 className="text-xl font-bold text-text-dark">Carrinho</h2>
            {itens.length > 0 && (
              <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {itens.reduce((a, i) => a + i.quantidade, 0)}
              </span>
            )}
          </div>
          <button onClick={() => setAberto(false)}
                  className="text-gray-400 hover:text-primary transition-colors cursor-pointer bg-transparent border-none text-xl">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Itens */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4 py-20">
              <i className="fas fa-shopping-cart text-5xl"></i>
              <p className="text-lg">Seu carrinho está vazio</p>
              <button onClick={() => setAberto(false)}
                      className="text-primary font-semibold hover:underline bg-transparent border-none cursor-pointer">
                Continuar comprando
              </button>
            </div>
          ) : (
            itens.map(item => {
              const subtotal = (Number(item.preco) * item.quantidade).toFixed(2).replace('.', ',')
              return (
                <div key={item.id} className="flex gap-4 bg-gray-50 rounded-2xl p-4">
                  <img
                    src={item.imagem || '/img/logocacto.svg'}
                    alt={item.nome}
                    className="w-20 h-20 object-cover rounded-xl flex-shrink-0"
                    onError={e => { e.target.src = '/img/logocacto.svg' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-dark text-sm leading-snug mb-1">{item.nome}</p>
                    <p className="text-primary font-bold text-sm mb-3">R$ {subtotal}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => alterarQtd(item.id, item.quantidade - 1)}
                        className="w-7 h-7 rounded-full bg-white border border-gray-200 text-text-dark hover:border-primary hover:text-primary transition-colors flex items-center justify-center cursor-pointer text-sm font-bold"
                      >−</button>
                      <span className="w-6 text-center text-sm font-semibold">{item.quantidade}</span>
                      <button
                        onClick={() => alterarQtd(item.id, item.quantidade + 1)}
                        className="w-7 h-7 rounded-full bg-white border border-gray-200 text-text-dark hover:border-primary hover:text-primary transition-colors flex items-center justify-center cursor-pointer text-sm font-bold"
                      >+</button>
                    </div>
                  </div>
                  <button
                    onClick={() => remover(item.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors cursor-pointer bg-transparent border-none self-start"
                  >
                    <i className="fas fa-trash text-sm"></i>
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        {itens.length > 0 && (
          <div className="px-6 py-5 border-t border-gray-100 bg-white space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-text-light font-medium">Total</span>
              <span className="text-primary font-bold text-2xl">
                R$ {total.toFixed(2).replace('.', ',')}
              </span>
            </div>

            <p className="text-xs text-gray-400 text-center">Escolha como enviar seu pedido:</p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={enviarWhatsApp}
                className="flex items-center justify-center gap-2 bg-whatsapp text-white px-4 py-3 rounded-xl font-semibold text-sm hover:bg-whatsapp-dark transition-colors cursor-pointer border-none"
              >
                <i className="fab fa-whatsapp text-lg"></i> WhatsApp
              </button>
              <button
                onClick={enviarEmail}
                className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-3 rounded-xl font-semibold text-sm hover:bg-dark-brown transition-colors cursor-pointer border-none"
              >
                <i className="fas fa-envelope text-lg"></i> E-mail
              </button>
            </div>

            <button
              onClick={limpar}
              className="w-full text-center text-xs text-gray-400 hover:text-red-400 transition-colors cursor-pointer bg-transparent border-none"
            >
              Limpar carrinho
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
