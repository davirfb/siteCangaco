import { lerConexao, renovar } from '../_lib/bling.js'
import { sincronizarClientes } from '../_lib/clientes.js'
import { sincronizarPedidos } from '../_lib/pedidos.js'

// Rotina diária (vercel.json → crons): renova os tokens para a conexão não expirar
// por falta de uso (o refresh token do Bling vale 30 dias) e sincroniza clientes e pedidos.
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ erro: 'Não autorizado.' })
  }
  try {
    if (!await lerConexao()) return res.json({ ok: true, conectado: false })
    await renovar()
    const clientes = await sincronizarClientes()
    const pedidos  = await sincronizarPedidos()
    res.json({ ok: true, conectado: true, clientes: clientes.total, pedidos: pedidos.total })
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: err.message })
  }
}
