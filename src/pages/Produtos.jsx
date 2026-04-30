import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/firebase.js";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import BackToTop from "../components/BackToTop.jsx";
import { useScrollAnim } from "../hooks/useScrollAnim.js";
import { gerarCatalogoPDF } from "../utils/gerarPDF.js";

function ProdutoCard({ p }) {
  const ref = useScrollAnim();
  const preco = Number(p.preco).toFixed(2).replace(".", ",");
  const img = p.imagem || "/img/logocacto.svg";

  return (
    <Link
      to={`/produtos/${p.id}`}
      ref={ref}
      className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer block"
    >
      <div className="overflow-hidden h-80">
        <img
          src={img}
          alt={p.nome}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            e.target.src = "/img/logocacto.svg";
          }}
        />
      </div>
      <div className="p-6">
        <h3 className="text-primary font-semibold text-xl mb-2">{p.nome}</h3>
        <p className="text-text-light text-sm mb-3 line-clamp-2">
          {p.descricao}
        </p>
        <p className="text-primary font-bold text-2xl mb-4">R$ {preco}</p>
        <span className="inline-block border-2 border-primary text-primary px-6 py-2 rounded-full font-semibold text-sm hover:bg-primary hover:text-white transition-all">
          Comprar
        </span>
      </div>
    </Link>
  );
}

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [gerandoPDF, setGerandoPDF] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(
          query(collection(db, "produtos"), orderBy("criadoEm", "asc")),
        );
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p) => p.ativo !== false);
        setProdutos(list);
      } catch (err) {
        console.error(err);
        setErro(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <>
      <Navbar />

      {/* Page Header */}
      <section
        className="py-16 text-center text-white"
        style={{
          background: "linear-gradient(135deg,#d2691e 0%,#cd853f 100%)",
        }}
      >
        <div className="max-w-6xl mx-auto px-5">
          <h1 className="text-5xl font-bold mb-3">Nossos Produtos</h1>
          <p className="text-xl opacity-90 mb-6">
            Alimentos artesanais de qualidade para você e sua família
          </p>
          <button
            onClick={async () => {
              setGerandoPDF(true);
              try {
                await gerarCatalogoPDF(produtos);
              } finally {
                setGerandoPDF(false);
              }
            }}
            disabled={gerandoPDF || produtos.length === 0}
            className="inline-flex items-center gap-2 bg-red-800 text-amber-50 px-6 py-3 rounded-full font-semibold text-sm shadow hover:bg-red-500 transition-colors disabled:opacity-50 cursor-pointer border-none"
          >
            <i
              className={`fas ${gerandoPDF ? "fa-spinner fa-spin" : "fa-file-pdf"}`}
            ></i>
            {gerandoPDF ? "Gerando PDF…" : "Baixar Catálogo em PDF"}
          </button>
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
            <p className="text-center text-dark-brown py-16">
              Erro ao carregar produtos. Tente novamente.
            </p>
          )}
          {!loading && !erro && produtos.length === 0 && (
            <p className="text-center text-dark-brown py-16">
              Nenhum produto disponível no momento.
            </p>
          )}
          {!loading && !erro && produtos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {produtos.map((p) => (
                <ProdutoCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
      <BackToTop />
    </>
  );
}
