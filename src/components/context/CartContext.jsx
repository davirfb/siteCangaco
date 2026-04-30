import { createContext, useContext, useState } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [itens, setItens]     = useState([])
  const [aberto, setAberto]   = useState(false)

  function adicionar(produto, quantidade = 1) {
    setItens(prev => {
      const idx = prev.findIndex(i => i.id === produto.id)
      if (idx !== -1) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantidade: next[idx].quantidade + quantidade }
        return next
      }
      return [...prev, { ...produto, quantidade }]
    })
    setAberto(true)
  }

  function remover(id) {
    setItens(prev => prev.filter(i => i.id !== id))
  }

  function alterarQtd(id, quantidade) {
    setItens(prev => {
      const item = prev.find(i => i.id === id)
      if (!item) return prev
      const min = item.qtdMinima ?? 1
      if (quantidade < min) return prev.filter(i => i.id !== id)
      return prev.map(i => i.id === id ? { ...i, quantidade } : i)
    })
  }

  function limpar() { setItens([]) }

  const total = itens.reduce((acc, i) => acc + Number(i.preco) * i.quantidade, 0)
  const count = itens.reduce((acc, i) => acc + i.quantidade, 0)

  return (
    <CartContext.Provider value={{ itens, total, count, aberto, setAberto, adicionar, remover, alterarQtd, limpar }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
