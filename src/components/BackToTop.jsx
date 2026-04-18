import { useState, useEffect } from 'react'

export default function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Voltar ao topo"
      className="fixed bottom-7 right-7 z-50 w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-xl shadow-lg hover:bg-dark-brown hover:-translate-y-1 transition-all"
    >
      <i className="fas fa-arrow-up"></i>
    </button>
  )
}
