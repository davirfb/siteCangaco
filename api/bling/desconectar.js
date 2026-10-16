import { rota, exigirAdmin } from '../_lib/auth.js'
import { desconectar } from '../_lib/bling.js'

export default rota(['POST'], async (req, res) => {
  await exigirAdmin(req)
  await desconectar()
  res.json({ ok: true })
})
