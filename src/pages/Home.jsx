import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { db } from "../lib/firebase.js";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import BackToTop from "../components/BackToTop.jsx";
import { useScrollAnim } from "../hooks/useScrollAnim.js";

const WA_URL =
  "https://wa.me/5561993779722?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20seus%20produtos.";

function ProdutoCard({ p }) {
  const ref = useScrollAnim();
  const preco = Number(p.preco).toFixed(2).replace(".", ",");
  const img = p.imagem || "/img/logocacto.svg";
  return (
    <div
      ref={ref}
      className="bg-white rounded-2xl overflow-hidden shadow-md hover:-translate-y-2 hover:shadow-xl transition-all duration-300"
    >
      <img
        src={img}
        alt={p.nome}
        className="w-full h-60 object-cover"
        onError={(e) => {
          e.target.src = "/img/logocacto.svg";
        }}
      />
      <div className="p-6">
        <h3 className="text-primary font-semibold text-xl mb-2">{p.nome}</h3>
        <p className="text-text-light text-sm mb-3 line-clamp-2">
          {p.descricao}
        </p>
        <p className="text-primary font-bold text-2xl mb-4">R$ {preco}</p>
        <Link
          to="/produtos"
          className="inline-block border-2 border-primary text-primary px-6 py-2 rounded-full font-semibold text-sm hover:bg-primary hover:text-white transition-all"
        >
          Ver Detalhes
        </Link>
      </div>
    </div>
  );
}

function SobreSlider({ slides }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 4000);
    return () => clearInterval(t);
  }, [slides.length, paused]);

  if (!slides.length)
    return (
      <img
        src="/img/logocacto.svg"
        alt="Cangaço"
        className="w-full rounded-2xl shadow-xl"
      />
    );

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden shadow-xl select-none h-70 md:h-140"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === idx ? 1 : 0 }}
        >
          <img
            src={s.imagem}
            alt={s.titulo || "Cangaço"}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = "/img/logocacto.svg";
            }}
          />
          {s.titulo && (
            <div className="absolute bottom-10 left-0 right-0 flex justify-center">
              <span className="bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                {s.titulo}
              </span>
            </div>
          )}
        </div>
      ))}

      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === idx ? "bg-white w-5" : "bg-white/50 w-2"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SobreSection() {
  const ref = useScrollAnim();
  const [slides, setSlides] = useState([]);

  useEffect(() => {
    getDocs(query(collection(db, "slider"), orderBy("ordem", "asc")))
      .then((snap) =>
        setSlides(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((s) => s.ativo !== false),
        ),
      )
      .catch(() => {});
  }, []);

  return (
    <section id="sobre" className="py-20 bg-cream">
      <div className="max-w-6xl mx-auto px-5">
        <div
          ref={ref}
          className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-12 items-center"
        >
          <div className="flex justify-center">
            <SobreSlider slides={slides} />
          </div>
          <div className="text-text-light text-lg leading-6 space-y-2">
            <h2 className="text-primary text-4xl font-bold mb-2">
              Sobre a Cangaço
            </h2>
            <p>
              A <strong className="text-primary">Cangaço</strong> nasceu da
              paixão por alimentos artesanais de alta qualidade. Com anos de
              experiência e dedicação, selecionamos os melhores ingredientes
              para criar produtos que trazem sabor autêntico e tradição para sua
              mesa.
            </p>
            <p>
              Nossos valores são baseados em
              <strong className="text-primary">
                {" "}
                qualidade e tradição{" "}
              </strong>{" "}
              aos nossos clientes. Cada produto é cuidadosamente preparado,
              garantindo o melhor sabor. Acreditamos que comida artesanal é uma
              forma de conectar pessoas e compartilhar momentos especiais.
            </p>
            <p>
              Trabalhamos com processos artesanais que preservam o sabor natural
              dos alimentos, sem aditivos desnecessários. Nossa missão é
              oferecer produtos que você pode confiar e saborear com toda a
              família.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    if (location.hash === "#sobre") {
      setTimeout(() => {
        document
          .getElementById("sobre")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [location.hash]);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(
          query(collection(db, "produtos"), where("destaque", "==", true)),
        );
        let list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p) => p.ativo !== false)
          .slice(0, 3);

        if (list.length === 0) {
          const snap2 = await getDocs(query(collection(db, "produtos")));
          list = snap2.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((p) => p.ativo !== false)
            .slice(0, 3);
        }
        setProdutos(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-[80vh] flex items-center justify-center text-center text-white py-16 overflow-hidden">
        {/* Background borrado isolado */}
        <div
          className="absolute inset-0 scale-110"
          style={{
            backgroundImage: `url('/img/background1.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg,rgba(210,105,30,.5) 0%,rgba(205,133,63,.5) 100%)",
          }}
        />
        <div className="relative z-10 max-w-2xl px-8">
          <img
            src="/img/logocangaco.svg"
            alt="Cangaço"
            className="w-auto mx-auto mb-8 drop-shadow-xl"
          />

          <p className="text-xl text-bold md:text-2xl mb-8 opacity-95">
            Alimentos artesanais de qualidade, feitos com a tradição do
            nordeste!
          </p>
          <Link
            to="/contato"
            className="inline-block bg-primary text-white px-10 py-4 rounded-full font-semibold text-lg shadow-lg hover:bg-dark-brown hover:-translate-y-1 transition-all"
          >
            Entre em Contato
          </Link>
        </div>
      </section>

      {/* Vitrine */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-12">
            <h2 className="text-primary text-4xl font-bold mb-2">
              Nossos Produtos
            </h2>
            <p className="text-text-light text-lg">Conheça nossos destaques</p>
          </div>

          {loading ? (
            <div className="text-center py-10 text-dark-brown">
              <i className="fas fa-spinner fa-spin text-3xl block mb-3"></i>
              <p>Carregando produtos...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {produtos.map((p) => (
                <ProdutoCard key={p.id} p={p} />
              ))}
            </div>
          )}

          <div className="text-center">
            <Link
              to="/produtos"
              className="inline-block bg-primary text-white px-10 py-4 rounded-full font-semibold text-lg shadow hover:bg-dark-brown hover:-translate-y-1 transition-all"
            >
              Ver Todos os Produtos
            </Link>
          </div>
        </div>
      </section>

      <SobreSection />

      <Footer />
      <BackToTop />
    </>
  );
}
