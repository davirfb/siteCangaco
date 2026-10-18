import { getMessaging } from 'firebase-admin/messaging'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './firebaseAdmin.js'

// Aparelhos dos admins que ativaram as notificações (token do Firebase Cloud Messaging)
export const colTokens = () => adminDb.collection('notificacoes_tokens')

// Nome curto para as mensagens: nome da conta Google, ou o começo do e-mail
export function nomeUsuario(usuario) {
  const nome = usuario?.name?.split(' ')[0]
  if (nome) return nome
  const email = usuario?.email ?? ''
  return email ? email.split('@')[0] : 'Alguém'
}

// Envia uma notificação para todos os aparelhos registrados (menos os de quem fez a ação).
// Nunca lança erro: notificação não pode atrapalhar a operação principal.
export async function notificar({ titulo, corpo, url = '/admin/dashboard', excetoEmail, apenasEmail, tag }) {
  try {
    const snap = await colTokens().get()
    const alvos = snap.docs.filter(d => (!excetoEmail || d.data().email !== excetoEmail) && (!apenasEmail || d.data().email === apenasEmail))
    if (!alvos.length) return { enviados: 0 }

    const tokens = alvos.map(d => d.id)
    // Mensagem só de dados: o service worker do site monta e mostra a notificação
    const r = await getMessaging().sendEachForMulticast({
      tokens,
      data: { titulo, corpo, url, tag: tag ?? '' },
      webpush: { headers: { Urgency: 'high', TTL: '86400' } },
    })

    // Remove aparelhos que não existem mais (app desinstalado, permissão revogada)
    const invalidos = r.responses
      .map((resp, i) => (!resp.success && /registration-token-not-registered|invalid-argument|invalid-registration-token/.test(resp.error?.code ?? '') ? tokens[i] : null))
      .filter(Boolean)
    if (invalidos.length) {
      const batch = adminDb.batch()
      invalidos.forEach(t => batch.delete(colTokens().doc(t)))
      await batch.commit()
    }
    return { enviados: r.successCount }
  } catch (err) {
    console.error('notificar', err.message)
    return { enviados: 0, erro: err.message }
  }
}

// Evita avisar duas vezes sobre o mesmo evento (ex.: nota emitida pelo site e o webhook do Bling)
export async function avisarUmaVez(chave, dados) {
  const ref = adminDb.collection('notificacoes_enviadas').doc(chave)
  const criado = await adminDb.runTransaction(async t => {
    if ((await t.get(ref)).exists) return false
    t.set(ref, { em: FieldValue.serverTimestamp() })
    return true
  }).catch(() => false)
  if (criado) await notificar(dados)
  return criado
}
