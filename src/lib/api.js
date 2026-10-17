import { auth } from './firebase.js'

export const MSG_OFFLINE    = 'Sem internet. Esta ação precisa de conexão.'
export const MSG_MANUTENCAO = 'Sistema em manutenção. Tente novamente em alguns minutos.'

// Avisa a interface (faixa no topo) quando o servidor entra/sai de manutenção
export function avisarManutencao(ativa) {
  window.dispatchEvent(new CustomEvent('cangaco:manutencao', { detail: ativa }))
}

function erroOffline() {
  const err = new Error(MSG_OFFLINE)
  err.offline = true
  return err
}

// Chama as funções do servidor (/api/...) enviando o token do admin logado.
export async function api(caminho, { method = 'GET', body } = {}) {
  if (!navigator.onLine) throw erroOffline()

  // Ao recarregar a página o Firebase ainda está restaurando a sessão: espera terminar
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('Faça login novamente.')

  let token, resp
  try {
    token = await user.getIdToken()
    resp = await fetch(`/api${caminho}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    // Falha de rede (sem internet ou conexão caiu no meio)
    if (!navigator.onLine || err instanceof TypeError || err?.code === 'auth/network-request-failed') throw erroOffline()
    throw err
  }

  const dados = await resp.json().catch(() => null)
  if (resp.status === 503 || dados?.manutencao || (resp.status >= 500 && !dados?.erro)) {
    avisarManutencao(true)
    const err = new Error(MSG_MANUTENCAO)
    err.manutencao = true
    throw err
  }
  if (resp.ok) avisarManutencao(false)
  if (!resp.ok) throw new Error(dados?.erro || `Erro ${resp.status} no servidor.`)
  return dados
}
