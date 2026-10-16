import { adminDb } from '../_lib/firebaseAdmin.js'
import { trocarCodigo } from '../_lib/bling.js'

// O Bling redireciona para cá depois que o usuário autoriza o aplicativo.
export default async function handler(req, res) {
  const voltar = (params) => {
    res.writeHead(302, { Location: `/admin/dashboard?${new URLSearchParams(params)}` })
    res.end()
  }

  const { code, state, error } = req.query
  if (error)            return voltar({ bling: 'erro', msg: 'Autorização negada no Bling.' })
  if (!code || !state)  return voltar({ bling: 'erro', msg: 'Resposta do Bling incompleta.' })

  try {
    const ref  = adminDb.collection('integracoes_estados').doc(String(state))
    const snap = await ref.get()
    await ref.delete().catch(() => {})
    if (!snap.exists || snap.data().expira < Date.now()) {
      return voltar({ bling: 'erro', msg: 'Pedido de conexão expirado. Tente conectar de novo.' })
    }

    await trocarCodigo(String(code), snap.data().email)
    voltar({ bling: 'conectado' })
  } catch (err) {
    console.error(err)
    voltar({ bling: 'erro', msg: err.message || 'Erro ao conectar com o Bling.' })
  }
}
