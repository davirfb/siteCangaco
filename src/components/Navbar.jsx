import { useState } from 'react'
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom'

const WA_URL = 'https://wa.me/5561993779722?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20seus%20produtos.'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

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

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50 py-4">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center justify-between flex-wrap gap-y-3">

          {/* Logo */}
          <Link to="/" onClick={closeMenu} className="w-36">
            <img src="/img/logocangaco.svg" alt="Cangaço" />
          </Link>

          {/* Hamburger */}
          <button
            className="md:hidden flex flex-col gap-[5px] p-1 bg-transparent border-none cursor-pointer"
            aria-label="Menu"
            onClick={() => setOpen(o => !o)}
          >
            <span
              className="block w-6 h-[3px] bg-text-dark rounded transition-all duration-300"
              style={{ transform: open ? 'rotate(45deg) translate(5px,5px)' : 'none' }}
            />
            <span
              className="block w-6 h-[3px] bg-text-dark rounded transition-all duration-300"
              style={{ opacity: open ? 0 : 1 }}
            />
            <span
              className="block w-6 h-[3px] bg-text-dark rounded transition-all duration-300"
              style={{ transform: open ? 'rotate(-45deg) translate(7px,-6px)' : 'none' }}
            />
          </button>

          {/* Links */}
          <ul className={`${open ? 'flex' : 'hidden'} md:flex flex-col md:flex-row w-full md:w-auto gap-4 md:gap-8 items-start md:items-center pt-3 md:pt-0 border-t md:border-none border-gray-200`}>
            <li><NavLink to="/"        className={linkClass} onClick={closeMenu} end>Início</NavLink></li>
            <li>
              <a href="/#sobre"
                 onClick={handleSobre}
                 className="font-medium text-text-dark hover:text-primary transition-colors pb-1">
                Sobre
              </a>
            </li>
            <li><NavLink to="/produtos"  className={linkClass} onClick={closeMenu}>Produtos</NavLink></li>
            <li><NavLink to="/contato"   className={linkClass} onClick={closeMenu}>Contato</NavLink></li>
          </ul>

          {/* WhatsApp button */}
          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-2 bg-whatsapp text-white px-6 py-2.5 rounded-full font-semibold text-sm shadow hover:bg-whatsapp-dark hover:-translate-y-0.5 transition-all"
          >
            <i className="fab fa-whatsapp"></i> WhatsApp
          </a>

        </div>
      </div>
    </nav>
  )
}
