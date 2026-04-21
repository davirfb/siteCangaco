import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { db } from '../lib/firebase.js'
import { doc, getDoc } from 'firebase/firestore'
import Navbar    from '../components/Navbar.jsx'
import Footer    from '../components/Footer.jsx'
import BackToTop from '../components/BackToTop.jsx'
import { useCart } from '../context/CartContext.jsx'

const WHATSAPP = '5561993779722'

export default function ProdutoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { adicionar } = useCart()

  const [produto,    setProduto]   = useState(null)
  const [loading,    setLoading]   = useState(true)
  const [quantidade, setQtd]       = useState(1)
  const [adicionado, setAdicionado] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'produtos', id))
        if (!snap.exists()) { navigate('/produtos', { replace: true }); return }
        setProduto({ id: snap.id, ...snap.data() })
      } catch {
        navigate('/produtos', { replace: true })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, navigate])

  function handleAdicionar() {
    adicionar(produto, quantidade)
    setAdicionado(true)
    setTimeout(() => setAdicionado(false), 2000)
  }

  if (loading) return (
    <>
      <Navbar />
      <div className="min-h-[60vh] flex items-center justify-center text-dark-brown">
        <i className="fas fa-spinner fa-spin text-4xl"></i>
      </div>
      <Footer />
    </>
  )

  if (!produto) return null

  const preco    = Number(produto.preco).toFixed(2).replace('.', ',')
  const img      = produto.imagem || '/img/logocacto.svg'
  const atacadoMsg = encodeURIComponent(`Olá! Gostaria de saber mais sobre os preços de atacado de ${produto.nome}.`)

  return (
    <>
      <Navbar />

      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-5 pt-6 pb-2">
        <nav className="text-sm text-gray-400 flex items-center gap-2">
          <Link to="/" className="hover:text-primary transition-colors">Início</Link>
          <i className="fas fa-chevron-right text-xs"></i>
          <Link to="/produtos" className="hover:text-primary transition-colors">Produtos</Link>
          <i className="fas fa-chevron-right text-xs"></i>
          <span className="text-text-dark font-medium">{produto.nome}</span>
        </nav>
      </div>

      {/* Conteúdo */}
      <section className="py-10 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">

            {/* Imagem */}
            <div className="rounded-2xl overflow-hidden shadow-xl">
              <img
                src={img}
                alt={produto.nome}
                className="w-full h-[420px] object-cover"
                onError={e => { e.target.src = '/img/logocacto.svg' }}
              />
            </div>

            {/* Detalhes */}
            <div className="flex flex-col gap-5">
              <div>
                <h1 className="text-3xl font-bold text-text-dark mb-2">{produto.nome}</h1>
                {produto.descricao && (
                  <p className="text-text-light text-lg leading-7">{produto.descricao}</p>
                )}
              </div>

              <div>
                <p className="text-primary font-bold text-4xl">R$ {preco}</p>
                {produto.precoAtualizadoEm && (
                  <p className="text-xs text-gray-400 mt-1">
                    <i className="fas fa-clock mr-1"></i>
                    Preço atualizado em{' '}
                    {(produto.precoAtualizadoEm?.toDate
                      ? produto.precoAtualizadoEm.toDate()
                      : new Date(produto.precoAtualizadoEm.seconds * 1000)
                    ).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>

              {/* Quantidade */}
              <div>
                <label className="block text-sm font-semibold text-text-dark mb-2">Quantidade</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQtd(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-full border-2 border-gray-200 text-text-dark hover:border-primary hover:text-primary transition-colors flex items-center justify-center cursor-pointer bg-white text-lg font-bold"
                  >−</button>
                  <span className="w-10 text-center text-xl font-semibold">{quantidade}</span>
                  <button
                    onClick={() => setQtd(q => q + 1)}
                    className="w-10 h-10 rounded-full border-2 border-gray-200 text-text-dark hover:border-primary hover:text-primary transition-colors flex items-center justify-center cursor-pointer bg-white text-lg font-bold"
                  >+</button>
                </div>
              </div>

              {/* Adicionar ao carrinho */}
              <button
                onClick={handleAdicionar}
                className={`flex items-center justify-center gap-3 w-full py-4 rounded-full font-semibold text-lg transition-all cursor-pointer border-none
                  ${adicionado
                    ? 'bg-green-500 text-white'
                    : 'bg-primary text-white hover:bg-dark-brown hover:-translate-y-0.5 shadow-lg'
                  }`}
              >
                <i className={`fas ${adicionado ? 'fa-check' : 'fa-shopping-cart'}`}></i>
                {adicionado ? 'Adicionado!' : 'Adicionar ao Carrinho'}
              </button>

              {/* Atacado */}
              {produto.atacado?.length > 0 && (
                <div className="bg-cream rounded-2xl p-5 border border-orange-100">
                  <h3 className="font-bold text-text-dark mb-3">
                    <i className="fas fa-tags text-primary mr-2"></i>Preços de Atacado
                  </h3>
                  <div className="flex flex-col gap-2 mb-4">
                    {produto.atacado.map((tier, i) => {
                      const desconto  = Math.round((1 - tier.preco / Number(produto.preco)) * 100)
                      const precoFmt  = Number(tier.preco).toFixed(2).replace('.', ',')
                      const totalFmt  = (Number(tier.preco) * tier.qtdMinima).toFixed(2).replace('.', ',')
                      return (
                        <div key={i} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm gap-3 flex-wrap">
                          <div>
                            <span className="text-text-dark font-semibold text-sm block">
                              A partir de {tier.qtdMinima} un.
                            </span>
                            <span className="text-gray-400 text-xs">
                              Total mín.: R$ {totalFmt}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-primary font-bold text-lg">R$ {precoFmt}/un.</span>
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                              -{desconto}%
                            </span>
                            <button
                              onClick={() => adicionar(
                                { ...produto, id: `${produto.id}_atacado_${i}`, nome: `${produto.nome} (Atacado)`, preco: tier.preco },
                                tier.qtdMinima
                              )}
                              className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-dark-brown transition-colors cursor-pointer border-none"
                            >
                              <i className="fas fa-shopping-cart text-[10px]"></i> Adicionar
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <a
                    href={`https://wa.me/${WHATSAPP}?text=${atacadoMsg}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-whatsapp text-white px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-whatsapp-dark transition-colors"
                  >
                    <i className="fab fa-whatsapp"></i> Consultar Atacado via WhatsApp
                  </a>
                </div>
              )}

              <Link to="/produtos"
                    className="text-center text-primary font-medium hover:underline text-sm">
                ← Voltar para Produtos
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <BackToTop />
    </>
  )
}
