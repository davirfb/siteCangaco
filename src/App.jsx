import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AvisoManutencao from './components/AvisoManutencao.jsx'
import { CartProvider } from './components/context/CartContext.jsx'
import Cart            from './components/Cart.jsx'
import Home            from './pages/Home.jsx'
import Produtos        from './pages/Produtos.jsx'
import ProdutoDetalhe  from './pages/ProdutoDetalhe.jsx'
import Contato         from './pages/Contato.jsx'
import AdminLogin      from './pages/admin/Login.jsx'
import Dashboard       from './pages/admin/Dashboard.jsx'

// Mostra a faixa de manutenção quando qualquer parte do site avisa (evento "cangaco:manutencao")
function FaixaManutencao() {
  const [ativa, setAtiva] = useState(false)
  useEffect(() => {
    const ouvir = e => setAtiva(!!e.detail)
    window.addEventListener('cangaco:manutencao', ouvir)
    return () => window.removeEventListener('cangaco:manutencao', ouvir)
  }, [])
  return ativa ? <AvisoManutencao /> : null
}

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <FaixaManutencao />
        <Cart />
        <Routes>
          <Route path="/"                element={<Home />} />
          <Route path="/produtos"        element={<Produtos />} />
          <Route path="/produtos/:id"    element={<ProdutoDetalhe />} />
          <Route path="/contato"         element={<Contato />} />
          <Route path="/admin"           element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  )
}
