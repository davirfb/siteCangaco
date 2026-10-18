import { FieldValue } from 'firebase-admin/firestore'
import { rota, exigirAdmin, HttpError } from './_lib/auth.js'
import { colTokens, notificar } from './_lib/notificar.js'

// Registro dos aparelhos que recebem notificações
export default rota(['POST'], async (req, res) => {
  const usuario = await exigirAdmin(req)
  const { acao, token, aparelho } = req.body ?? {}
  if (!token || typeof token !== 'string' || token.length > 4096) throw new HttpError(400, 'Token inválido.')

  if (acao === 'registrar') {
    await colTokens().doc(token).set({
      email: usuario.email,
      aparelho: String(aparelho ?? '').slice(0, 200),
      atualizadoEm: FieldValue.serverTimestamp(),
    }, { merge: true })
    return res.json({ ok: true })
  }

  if (acao === 'remover') {
    await colTokens().doc(token).delete()
    return res.json({ ok: true })
  }

  if (acao === 'testar') {
    // Teste vai só para os aparelhos do próprio usuário
    const r = await notificar({ titulo: 'Notificações ativadas ✅', corpo: 'Este aparelho vai receber os avisos do painel Cangaço.', tag: 'teste', apenasEmail: usuario.email })
    return res.json(r)
  }

  throw new HttpError(400, 'Ação inválida.')
})
