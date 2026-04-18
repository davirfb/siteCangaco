import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home       from './pages/Home.jsx'
import Produtos   from './pages/Produtos.jsx'
import Contato    from './pages/Contato.jsx'
import AdminLogin from './pages/admin/Login.jsx'
import Dashboard  from './pages/admin/Dashboard.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<Home />} />
        <Route path="/produtos"          element={<Produtos />} />
        <Route path="/contato"           element={<Contato />} />
        <Route path="/admin"             element={<AdminLogin />} />
        <Route path="/admin/dashboard"   element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  )
}
