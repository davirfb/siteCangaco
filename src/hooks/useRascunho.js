import { useEffect, useState } from 'react'

// useState que fica salvo no navegador: ao fechar e reabrir a página, o valor volta.
// Use uma chave começando com "rascunho:" para poder limpar com limparRascunhos().
export function useRascunho(chave, inicial) {
  const [valor, setValor] = useState(() => {
    try {
      const salvo = localStorage.getItem(chave)
      return salvo !== null ? JSON.parse(salvo) : inicial
    } catch {
      return inicial
    }
  })

  useEffect(() => {
    try { localStorage.setItem(chave, JSON.stringify(valor)) } catch {}
  }, [chave, valor])

  return [valor, setValor]
}

// Apaga todos os rascunhos cujas chaves começam com o prefixo.
export function limparRascunhos(prefixo) {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefixo))
      .forEach(k => localStorage.removeItem(k))
  } catch {}
}
