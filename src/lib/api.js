import { auth } from './firebase.js'

// Chama as funções do servidor (/api/...) enviando o token do admin logado.
export async function api(caminho, { method = 'GET', body } = {}) {
  // Ao recarregar a página o Firebase ainda está restaurando a sessão: espera terminar
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('Faça login novamente.')
  const token = await user.getIdToken()

  const resp = await fetch(`/api${caminho}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const dados = await resp.json().catch(() => null)
  if (!resp.ok) throw new Error(dados?.erro || `Erro ${resp.status} no servidor.`)
  return dados
}
