import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-dark-brown text-white pt-12 pb-4">
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="text-accent text-xl font-semibold mb-4">Produtos</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/produtos"
                  className="hover:text-accent transition-colors"
                >
                  Castanha de Caju
                </Link>
              </li>
              <li>
                <Link
                  to="/produtos"
                  className="hover:text-accent transition-colors"
                >
                  Torresmo
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-accent text-xl font-semibold mb-4">Contatos</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="mailto:empresacangaco@gmail.com" className="hover:text-accent transition-colors">
                  <i className="fas fa-envelope text-accent mr-2"></i>
                  empresacangaco@gmail.com
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/cangaco.br/" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">
                  <i className="fab fa-instagram text-accent mr-2"></i>cangaco.br
                </a>
              </li>
              <li>
                <i className="fab fa-whatsapp text-accent mr-2"></i>(61)
                98427-4420
              </li>
              <li>
                <i className="fab fa-whatsapp text-accent mr-2"></i>(61)
                99377-9722
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-accent text-xl font-semibold mb-4">
              Redes Sociais
            </h3>
            <div className="flex gap-4">
              <a
                href="mailto:empresacangaco@gmail.com"
                className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-accent hover:-translate-y-1 transition-all"
                aria-label="Email"
              >
                <i className="fas fa-envelope"></i>
              </a>
              <a
                href="https://wa.me/5561993779722"
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-accent hover:-translate-y-1 transition-all"
                aria-label="WhatsApp"
              >
                <i className="fab fa-whatsapp"></i>
              </a>
              <a
                href="https://www.instagram.com/cangaco.br/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-accent hover:-translate-y-1 transition-all"
                aria-label="Instagram"
              >
                <i className="fab fa-instagram"></i>
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/20 pt-4 text-center text-white/80 text-sm">
          <p>&copy; 2026 Cangaço. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
