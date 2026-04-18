import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { auth } from '../../lib/firebase.js'
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'

const ERROS = {
  'auth/user-not-found':         'E-mail não cadastrado.',
  'auth/wrong-password':         'Senha incorreta.',
  'auth/invalid-credential':     'E-mail ou senha incorretos.',
  'auth/invalid-email':          'E-mail inválido.',
  'auth/too-many-requests':      'Muitas tentativas. Aguarde e tente novamente.',
  'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
}

export default function AdminLogin() {
  const [email, setEmail]     = useState('')
  const [senha, setSenha]     = useState('')
  const [erro, setErro]       = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) navigate('/admin/dashboard', { replace: true })
    })
    return unsub
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, senha)
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      setErro(ERROS[err.code] || 'Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-primary transition-colors'

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/img/logocangaco.svg" alt="Cangaço" className="w-36 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-primary">Painel Administrativo</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block mb-1.5 font-semibold text-text-dark">E-mail</label>
            <div className="relative">
              <i className="fas fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-text-light"></i>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                     placeholder="seu@email.com" required autoComplete="email"
                     className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block mb-1.5 font-semibold text-text-dark">Senha</label>
            <div className="relative">
              <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-text-light"></i>
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                     placeholder="••••••••" required autoComplete="current-password"
                     className={inputClass} />
            </div>
          </div>

          {erro && (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm" role="alert">
              {erro}
            </div>
          )}

          <button type="submit" disabled={loading}
                  className="bg-primary text-white py-3 rounded-lg font-semibold text-base hover:bg-dark-brown transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2 mt-1">
            {loading ? <><i className="fas fa-spinner fa-spin"></i> Entrando...</> : 'Entrar'}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link to="/" className="text-text-light text-sm hover:text-primary transition-colors">
            <i className="fas fa-arrow-left mr-1"></i> Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  )
}
