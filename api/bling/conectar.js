import { randomBytes } from 'node:crypto'
import { rota, exigirAdmin } from '../_lib/auth.js'
import { adminDb } from '../_lib/firebaseAdmin.js'
import { urlAutorizacao } from '../_lib/bling.js'

// Gera a URL de autorização do Bling. O "state" liga a volta (callback) ao admin que iniciou.
export default rota(['POST'], async (req, res) => {
  const usuario = await exigirAdmin(req)
  const state = randomBytes(24).toString('hex')
  await adminDb.collection('integracoes_estados').doc(state).set({
    email:  usuario.email,
    expira: Date.now() + 10 * 60 * 1000,
  })
  res.json({ url: urlAutorizacao(state) })
})
