import { useEffect, useState } from 'react'
import { db } from '../lib/firebase.js'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import Navbar    from '../components/Navbar.jsx'
import Footer    from '../components/Footer.jsx'
import BackToTop from '../components/BackToTop.jsx'
import { useScrollAnim } from '../hooks/useScrollAnim.js'

const WHATSAPP = '5561993779722'

function FardoModal({ produto, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const img       = produto.imagem || '/img/logocacto.svg'
  const fardoPreco = produto.fardo?.preco
    ? 'R$ ' + Number(produto.fardo.preco).toFixed(2).replace('.', ',')
    : null
  const msg = encodeURIComponent(`Olá! Gostaria de comprar o fardo de ${produto.nome}.`)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fadeIn"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl p-8 max-w-lg w-[90%] max-h-[90vh] overflow-y-auto text-center relative animate-slideUp">
        <button onClick={onClose}
                className="absolute top-4 right-5 text-3xl font-bold text-text-dark hover:text-primary transition-colors leading-none">
          &times;
        </button>
        <img src={img} alt={produto.nome}
             className="w-full max-h-72 object-cover rounded-xl mb-6"
             onError={e => { e.target.src = '/img/logocacto.svg' }} />
        <h2 className="text-primary text-3xl font-bold mb-3">{produto.nome} — Fardo</h2>
        {produto.fardo?.descricao && (
          <p className="text-text-light mb-3">{produto.fardo.descricao}</p>
        )}
        {fardoPreco && (
          <p className="text-primary text-3xl font-bold mb-6">{fardoPreco}</p>
        )}
        <a href={`https://wa.me/${WHATSAPP}?text=${msg}`}
           target="_blank" rel="noopener noreferrer"
           className="inline-block bg-primary text-white px-8 py-3 rounded-full font-semibold hover:bg-dark-brown hover:-translate-y-1 transition-all">
          Comprar via WhatsApp
        </a>
      </div>
    </div>
  )
}

function ProdutoCard({ p }) {
  const ref = useScrollAnim()
  const [modalOpen, setModalOpen] = useState(false)
  const preco = Number(p.preco).toFixed(2).replace('.', ',')
  const img   = p.imagem || '/img/logocacto.svg'

  return (
    <>
      <div ref={ref} className="bg-white rounded-2xl overflow-hidden shadow-md hover:-translate-y-2 hover:shadow-xl transition-all duration-300">
        <img src={img} alt={p.nome} className="w-full h-60 object-cover"
             onError={e => { e.target.src = '/img/logocacto.svg' }} />
        <div className="p-6">
          <h3 className="text-primary font-semibold text-xl mb-2">{p.nome}</h3>
          <p className="text-text-light text-sm mb-3">{p.descricao}</p>
          <p className="text-primary font-bold text-2xl mb-4">R$ {preco}</p>
          {p.fardo && (
            <button onClick={() => setModalOpen(true)}
                    className="border-2 border-primary text-primary px-6 py-2 rounded-full font-semibold text-sm hover:bg-primary hover:text-white transition-all cursor-pointer">
              Ver Fardo
            </button>
          )}
        </div>
      </div>

      {modalOpen && <FardoModal produto={p} onClose={() => setModalOpen(false)} />}
    </>
  )
}

export default function Produtos() {
  const [produtos, setProdutos] = useState([])
  const [loading, setLoading]   = useState(true)
  const [erro, setErro]         = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, 'produtos'), orderBy('criadoEm', 'asc')))
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.ativo !== false)
        setProdutos(list)
      } catch (err) {
        console.error(err)
        setErro(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <>
      <Navbar />

      {/* Page Header */}
      <section className="py-16 text-center text-white"
               style={{ background: 'linear-gradient(135deg,#d2691e 0%,#cd853f 100%)' }}>
        <div className="max-w-6xl mx-auto px-5">
          <h1 className="text-5xl font-bold mb-3">Nossos Produtos</h1>
          <p className="text-xl opacity-90">Alimentos artesanais de qualidade para você e sua família</p>
        </div>
      </section>

      {/* Grid */}
      <section className="py-16 bg-cream">
        <div className="max-w-6xl mx-auto px-5">
          {loading && (
            <div className="text-center py-16 text-dark-brown">
              <i className="fas fa-spinner fa-spin text-4xl block mb-4"></i>
              <p>Carregando produtos...</p>
            </div>
          )}
          {!loading && erro && (
            <p className="text-center text-dark-brown py-16">Erro ao carregar produtos. Tente novamente.</p>
          )}
          {!loading && !erro && produtos.length === 0 && (
            <p className="text-center text-dark-brown py-16">Nenhum produto disponível no momento.</p>
          )}
          {!loading && !erro && produtos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {produtos.map(p => <ProdutoCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </section>

      <Footer />
      <BackToTop />
    </>
  )
}
