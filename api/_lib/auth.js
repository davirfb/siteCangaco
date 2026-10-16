import { adminAuth } from './firebaseAdmin.js'

// Mesma lista das Regras do Firestore (função isAdmin). Ao mudar uma, mude a outra.
export const ADMINS = [
  'lilifortes@gmail.com',
  'empresacangaco@gmail.com',
  'luizcarlosribeirobezerra24@gmail.com',
  'lilirochafortesbezerra@gmail.com',
  'rochatiago2000@gmail.com',
  'davirochafortesbezerra@gmail.com',
]

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

// Confere o token do Firebase enviado em "Authorization: Bearer <idToken>" e se o e-mail é admin.
export async function exigirAdmin(req) {
  const header = req.headers.authorization || ''
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!idToken) throw new HttpError(401, 'Login necessário.')

  let usuario
  try { usuario = await adminAuth.verifyIdToken(idToken) }
  catch { throw new HttpError(401, 'Sessão inválida. Entre novamente.') }

  if (!usuario.email || !ADMINS.includes(usuario.email.toLowerCase())) {
    throw new HttpError(403, 'Acesso restrito aos administradores.')
  }
  return usuario
}

// Envolve um handler: trata métodos permitidos e erros de forma padronizada.
export function rota(metodos, handler) {
  return async (req, res) => {
    if (!metodos.includes(req.method)) {
      res.setHeader('Allow', metodos.join(', '))
      return res.status(405).json({ erro: 'Método não permitido.' })
    }
    try {
      await handler(req, res)
    } catch (err) {
      const status = err.status || 500
      if (status >= 500) console.error(err)
      res.status(status).json({ erro: err.message || 'Erro interno.' })
    }
  }
}
