import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { db } from '../lib/firebase.js'
import {
  collection, getDocs, query, where, limit,
} from 'firebase/firestore'
import Navbar    from '../components/Navbar.jsx'
import Footer    from '../components/Footer.jsx'
import BackToTop from '../components/BackToTop.jsx'
import { useScrollAnim } from '../hooks/useScrollAnim.js'

const WA_URL = 'https://wa.me/5561993779722?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20seus%20produtos.'

function ProdutoCard({ p }) {
  const ref = useScrollAnim()
  const preco = Number(p.preco).toFixed(2).replace('.', ',')
  const img   = p.imagem || '/img/logocacto.svg'
  return (
    <div ref={ref} className="bg-white rounded-2xl overflow-hidden shadow-md hover:-translate-y-2 hover:shadow-xl transition-all duration-300">
      <img src={img} alt={p.nome} className="w-full h-60 object-cover"
           onError={e => { e.target.src = '/img/logocacto.svg' }} />
      <div className="p-6">
        <h3 className="text-primary font-semibold text-xl mb-2">{p.nome}</h3>
        <p className="text-text-light text-sm mb-3 line-clamp-2">{p.descricao}</p>
        <p className="text-primary font-bold text-2xl mb-4">R$ {preco}</p>
        <Link to="/produtos"
              className="inline-block border-2 border-primary text-primary px-6 py-2 rounded-full font-semibold text-sm hover:bg-primary hover:text-white transition-all">
          Ver Detalhes
        </Link>
      </div>
    </div>
  )
}

function SobreSection() {
  const ref = useScrollAnim()
  return (
    <section id="sobre" className="py-20 bg-cream">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center mb-12">
          <h2 className="text-primary text-4xl font-bold mb-2">Sobre Nós</h2>
          <p className="text-text-light text-lg">Nossa história e valores</p>
        </div>
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="flex justify-center">
            <img src="/img/logocacto.svg" alt="Cangaço" className="w-full max-w-xs rounded-2xl shadow-lg" />
          </div>
          <div className="text-text-light text-lg leading-8 space-y-5">
            <p>A <strong className="text-primary">Cangaço</strong> nasceu da paixão por alimentos
              artesanais de alta qualidade. Com anos de experiência e dedicação,
              selecionamos os melhores ingredientes para criar produtos que
              trazem sabor autêntico e tradição para sua mesa.</p>
            <p>Nossos valores são baseados em
              <strong className="text-primary"> qualidade e tradição </strong> aos nossos clientes. Cada
              produto é cuidadosamente preparado, garantindo o melhor sabor.
              Acreditamos que comida artesanal é uma forma de conectar pessoas e
              compartilhar momentos especiais.</p>
            <p>Trabalhamos com processos artesanais que preservam o sabor natural
              dos alimentos, sem aditivos desnecessários. Nossa missão é
              oferecer produtos que você pode confiar e saborear com toda a família.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  const [produtos, setProdutos] = useState([])
  const [loading, setLoading]   = useState(true)
  const location = useLocation()

  useEffect(() => {
    if (location.hash === '#sobre') {
      setTimeout(() => {
        document.getElementById('sobre')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [location.hash])

  useEffect(() => {
    async function load() {
      try {
        let snap = await getDocs(
          query(collection(db, 'produtos'), where('destaque', '==', true), where('ativo', '!=', false), limit(3))
        )
        let list = snap.docs.map(d => ({ id: d.id, ...d.data() }))

        if (list.length === 0) {
          snap = await getDocs(query(collection(db, 'produtos'), limit(3)))
          list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.ativo !== false).slice(0, 3)
        }
        setProdutos(list)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section
        className="relative min-h-[80vh] flex items-center justify-center text-center text-white py-16"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1606312619070-d48b4e0016d3?w=1920&h=1080&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0"
             style={{ background: 'linear-gradient(135deg,rgba(210,105,30,.8) 0%,rgba(205,133,63,.8) 100%)' }} />
        <div className="relative z-10 max-w-2xl px-8">
          <img src="/img/logocangaco.svg" alt="Cangaço"
               className="w-36 mx-auto mb-8 drop-shadow-xl" />
          <h1 className="text-5xl md:text-6xl font-bold mb-4 drop-shadow-md">Bem-vindo à Cangaço!</h1>
          <p className="text-xl md:text-2xl mb-8 opacity-95">
            Alimentos artesanais de qualidade, feitos com a tradição do nordeste!
          </p>
          <Link to="/contato"
                className="inline-block bg-primary text-white px-10 py-4 rounded-full font-semibold text-lg shadow-lg hover:bg-dark-brown hover:-translate-y-1 transition-all">
            Entre em Contato
          </Link>
        </div>
      </section>

      <SobreSection />

      {/* Vitrine */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-12">
            <h2 className="text-primary text-4xl font-bold mb-2">Nossos Produtos</h2>
            <p className="text-text-light text-lg">Conheça nossos destaques</p>
          </div>

          {loading ? (
            <div className="text-center py-10 text-dark-brown">
              <i className="fas fa-spinner fa-spin text-3xl block mb-3"></i>
              <p>Carregando produtos...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {produtos.map(p => <ProdutoCard key={p.id} p={p} />)}
            </div>
          )}

          <div className="text-center">
            <Link to="/produtos"
                  className="inline-block bg-primary text-white px-10 py-4 rounded-full font-semibold text-lg shadow hover:bg-dark-brown hover:-translate-y-1 transition-all">
              Ver Todos os Produtos
            </Link>
          </div>
        </div>
      </section>

      <Footer />
      <BackToTop />
    </>
  )
}
