import { useState } from 'react'
import emailjs from '@emailjs/browser'
import Navbar    from '../components/Navbar.jsx'
import Footer    from '../components/Footer.jsx'
import BackToTop from '../components/BackToTop.jsx'
import { useScrollAnim } from '../hooks/useScrollAnim.js'

const EMAILJS_SERVICE  = 'empresacangaco@gmail.com'
const EMAILJS_TEMPLATE = 'template_r9hcfeg'
const EMAILJS_KEY      = 'bqtTkQKAXWbwIMpZI'

const WA_URL = 'https://wa.me/5561993779722?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20seus%20produtos.'

export default function Contato() {
  const [form, setForm]       = useState({ nome: '', email: '', assunto: '', mensagem: '' })
  const [status, setStatus]   = useState(null) // null | 'sending' | 'ok' | 'error'
  const refWa   = useScrollAnim()
  const refForm = useScrollAnim()

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email)) {
      alert('Por favor, insira um email válido.')
      return
    }
    setStatus('sending')
    try {
      await emailjs.send(
        EMAILJS_SERVICE,
        EMAILJS_TEMPLATE,
        { from_name: form.nome, from_email: form.email, subject: form.assunto, message: form.mensagem },
        EMAILJS_KEY
      )
      setStatus('ok')
      setForm({ nome: '', email: '', assunto: '', mensagem: '' })
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  const inputClass = 'w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-primary transition-colors font-[inherit]'
  const labelClass = 'block mb-1.5 text-text-dark font-semibold'

  return (
    <>
      <Navbar />

      {/* Header */}
      <section className="py-16 text-center text-white"
               style={{ background: 'linear-gradient(135deg,#d2691e 0%,#cd853f 100%)' }}>
        <div className="max-w-6xl mx-auto px-5">
          <h1 className="text-5xl font-bold mb-3">Entre em Contato</h1>
          <p className="text-xl opacity-90">Estamos prontos para atender você da melhor forma</p>
        </div>
      </section>

      <section className="py-16 bg-cream">
        <div className="max-w-6xl mx-auto px-5">

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">

            {/* WhatsApp card */}
            <div ref={refWa} className="bg-white rounded-2xl p-10 shadow-md text-center">
              <div className="text-6xl text-whatsapp mb-6">
                <i className="fab fa-whatsapp"></i>
              </div>
              <h2 className="text-primary text-3xl font-bold mb-4">Atendimento Rápido</h2>
              <p className="text-text-light leading-7 mb-6">
                Fale conosco diretamente pelo WhatsApp. Resposta rápida e atendimento personalizado!
              </p>
              <a href={WA_URL} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2.5 bg-whatsapp text-white px-10 py-4 rounded-full font-semibold text-lg shadow hover:bg-whatsapp-dark hover:-translate-y-1 transition-all">
                <i className="fab fa-whatsapp"></i> Falar no WhatsApp
              </a>
            </div>

            {/* Form card */}
            <div ref={refForm} className="bg-white rounded-2xl p-10 shadow-md">
              <h2 className="text-primary text-3xl font-bold mb-2">Envie uma Mensagem</h2>
              <p className="text-text-light mb-6">Preencha o formulário abaixo e retornaremos em breve</p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label className={labelClass}>Nome *</label>
                  <input type="text" name="nome" value={form.nome} onChange={handleChange}
                         required placeholder="Seu nome completo" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Email *</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange}
                         required placeholder="seu@email.com" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Assunto *</label>
                  <input type="text" name="assunto" value={form.assunto} onChange={handleChange}
                         required placeholder="Assunto da mensagem" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Mensagem *</label>
                  <textarea name="mensagem" value={form.mensagem} onChange={handleChange}
                            required rows={5} placeholder="Sua mensagem..."
                            className={inputClass + ' resize-y min-h-[120px]'} />
                </div>

                {status === 'ok' && (
                  <p className="text-green-600 font-medium">Mensagem enviada com sucesso! Entraremos em contato em breve.</p>
                )}
                {status === 'error' && (
                  <p className="text-red-600 font-medium">Erro ao enviar. Tente novamente ou entre em contato pelo WhatsApp.</p>
                )}

                <button type="submit" disabled={status === 'sending'}
                        className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-full font-semibold text-base shadow hover:bg-dark-brown hover:-translate-y-0.5 transition-all disabled:opacity-60 cursor-pointer">
                  <i className="fas fa-paper-plane"></i>
                  {status === 'sending' ? 'Enviando...' : 'Enviar Mensagem'}
                </button>
              </form>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: 'fas fa-envelope', title: 'Email',     lines: ['empresacangaco@gmail.com'] },
              { icon: 'fas fa-phone',    title: 'Telefones', lines: ['(61) 99377-9722', '(61) 98427-4420'] },
              { icon: 'fab fa-instagram',title: 'Instagram', lines: ['cangaco.br'] },
            ].map(item => (
              <div key={item.title} className="bg-white rounded-2xl p-8 shadow text-center">
                <i className={`${item.icon} text-primary text-4xl mb-4 block`}></i>
                <h3 className="text-primary font-semibold text-lg mb-2">{item.title}</h3>
                {item.lines.map(l => <p key={l} className="text-text-light text-sm">{l}</p>)}
              </div>
            ))}
          </div>

        </div>
      </section>

      <Footer />
      <BackToTop />
    </>
  )
}
