import { useState } from 'react'
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { useCart } from './context/CartContext.jsx'

const WA_URL = 'https://wa.me/5561993779722?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20seus%20produtos.'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { count, setAberto } = useCart()

  function closeMenu() { setOpen(false) }

  function handleSobre(e) {
    e.preventDefault()
    closeMenu()
    if (location.pathname === '/') {
      document.getElementById('sobre')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      navigate('/')
      setTimeout(() => {
        document.getElementById('sobre')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }

  const linkClass = ({ isActive }) =>
    `font-medium transition-colors relative pb-1 ${isActive ? 'nav-active text-primary' : 'text-text-dark hover:text-primary'}`

  const mobileLinkClass = ({ isActive }) =>
    `block px-2 py-3 rounded-lg font-medium transition-colors text-base ${isActive ? 'text-primary bg-orange-50' : 'text-text-dark hover:text-primary hover:bg-gray-50'}`

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50 py-3">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between">

          {/* Logo */}
          <Link to="/" onClick={closeMenu} className="w-32 shrink-0">
            <img src="/img/logocangaco.svg" alt="Cangaço" />
          </Link>

          {/* Mobile: carrinho + hamburger */}
          <div className="flex items-center gap-1 md:hidden">
            <button
              onClick={() => setAberto(true)}
              className="relative flex items-center justify-center w-11 h-11 rounded-full hover:bg-gray-100 transition-colors cursor-pointer bg-transparent border-none"
              aria-label="Carrinho"
            >
              <i className="fas fa-shopping-cart text-text-dark text-xl"></i>
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
            <button
              className="flex flex-col gap-1.25 p-2 bg-transparent border-none cursor-pointer"
              aria-label="Menu"
              onClick={() => setOpen(o => !o)}
            >
              <span className="block w-6 h-0.75 bg-text-dark rounded transition-all duration-300"
                    style={{ transform: open ? 'rotate(45deg) translate(5px,5px)' : 'none' }} />
              <span className="block w-6 h-0.75 bg-text-dark rounded transition-all duration-300"
                    style={{ opacity: open ? 0 : 1 }} />
              <span className="block w-6 h-0.75 bg-text-dark rounded transition-all duration-300"
                    style={{ transform: open ? 'rotate(-45deg) translate(7px,-6px)' : 'none' }} />
            </button>
          </div>

          {/* Desktop: links + carrinho + WhatsApp */}
          <div className="hidden md:flex items-center gap-8">
            <ul className="flex items-center gap-8">
              <li><NavLink to="/" className={linkClass} end>Início</NavLink></li>
              <li>
                <a href="/#sobre" onClick={handleSobre}
                   className="font-medium text-text-dark hover:text-primary transition-colors pb-1">Sobre</a>
              </li>
              <li><NavLink to="/produtos" className={linkClass}>Produtos</NavLink></li>
              <li><NavLink to="/contato"  className={linkClass}>Contato</NavLink></li>
            </ul>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAberto(true)}
                className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors cursor-pointer bg-transparent border-none"
                aria-label="Carrinho"
              >
                <i className="fas fa-shopping-cart text-text-dark text-lg"></i>
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {count}
                  </span>
                )}
              </button>
              <a href={WA_URL} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-2 bg-whatsapp text-white px-6 py-2.5 rounded-full font-semibold text-sm shadow hover:bg-whatsapp-dark hover:-translate-y-0.5 transition-all">
                <i className="fab fa-whatsapp"></i> WhatsApp
              </a>
            </div>
          </div>

        </div>

        {/* Mobile menu dropdown */}
        {open && (
          <div className="md:hidden border-t border-gray-100 mt-3 pt-2 pb-3">
            <ul className="flex flex-col gap-0.5">
              <li><NavLink to="/" className={mobileLinkClass} onClick={closeMenu} end>Início</NavLink></li>
              <li>
                <a href="/#sobre" onClick={handleSobre}
                   className="block px-2 py-3 rounded-lg font-medium text-text-dark hover:text-primary hover:bg-gray-50 transition-colors text-base">
                  Sobre
                </a>
              </li>
              <li><NavLink to="/produtos" className={mobileLinkClass} onClick={closeMenu}>Produtos</NavLink></li>
              <li><NavLink to="/contato"  className={mobileLinkClass} onClick={closeMenu}>Contato</NavLink></li>
            </ul>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <a href={WA_URL} target="_blank" rel="noopener noreferrer"
                 className="flex items-center justify-center gap-2 bg-whatsapp text-white px-5 py-3.5 rounded-2xl font-semibold text-base shadow w-full">
                <i className="fab fa-whatsapp text-xl"></i> Chamar no WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
