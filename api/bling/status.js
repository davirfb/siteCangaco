import { rota, exigirAdmin } from '../_lib/auth.js'
import { lerConexao, blingFetch } from '../_lib/bling.js'

// Informa se o Bling está conectado e testa a conexão lendo os dados da empresa.
export default rota(['GET'], async (req, res) => {
  await exigirAdmin(req)
  const conexao = await lerConexao()
  if (!conexao) return res.json({ conectado: false })

  let empresa = null
  let erro = null
  try {
    const { data } = await blingFetch('/empresas/me/dados-basicos')
    empresa = data?.nome || data?.razaoSocial || null
  } catch (err) {
    erro = err.message
  }

  res.json({
    conectado:       !erro,
    erro,
    empresa,
    conectadoPor:    conexao.conectadoPor ?? null,
    conectadoEm:     conexao.conectadoEm?.toMillis?.() ?? null,
    refreshExpiraEm: conexao.refreshExpiraEm ?? null,
  })
})
