import { createHmac, timingSafeEqual } from 'node:crypto'
import { colPedidos, detalharPedido, lerNota, avisarNota, marcarExcluido } from '../_lib/pedidos.js'
import { avisarUmaVez } from '../_lib/notificar.js'

// Webhooks do Bling (configurados na aba "Webhooks" do aplicativo Site Cangaço):
// - order.created            → avisa "novo pedido no Bling" (pedidos criados pelo site são ignorados)
// - order.deleted            → tira o pedido das listas do site
// - invoice / consumer_invoice → avisa NF-e / NFC-e autorizada ou rejeitada
// O Bling exige resposta 2xx em até 5 segundos e reenvia em caso de falha.

const brl = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`

async function corpoBruto(req) {
  const partes = []
  for await (const parte of req) partes.push(typeof parte === 'string' ? Buffer.from(parte) : parte)
  return Buffer.concat(partes)
}

// Assinatura: HMAC-SHA256 do corpo com o client secret, no header X-Bling-Signature-256 ("sha256=<hex>")
function assinaturaValida(bruto, header) {
  if (!header?.startsWith('sha256=')) return false
  const esperado = createHmac('sha256', process.env.BLING_CLIENT_SECRET).update(bruto).digest('hex')
  const recebido = header.slice(7)
  return recebido.length === esperado.length && timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))
}

async function pedidoCriado(id) {
  const p = await detalharPedido(id) // também atualiza a cópia local do pedido
  if (p.criadoPeloSite) return
  const cliente = p.cliente?.apelido || p.cliente?.nome || 'cliente'
  await avisarUmaVez(`pedido-${id}`, {
    titulo: '🛍️ Novo pedido no Bling',
    corpo: `Pedido nº ${p.numero ?? ''} – ${cliente} (${brl(p.total)})`,
    tag: `pedido-${id}`,
  })
}

async function notaAlterada(tipo, id) {
  const nota = await lerNota(tipo, id)
  const snap = await colPedidos().where('nota.id', '==', String(id)).limit(1).get()
  const pedidoDoc = snap.empty ? null : snap.docs[0].data()
  if (!snap.empty) await snap.docs[0].ref.set({ nota }, { merge: true })
  await avisarNota(nota, pedidoDoc)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const bruto = await corpoBruto(req)
  if (!assinaturaValida(bruto, req.headers['x-bling-signature-256'])) {
    return res.status(401).json({ erro: 'Assinatura inválida.' })
  }

  let evento
  try { evento = JSON.parse(bruto.toString('utf8')) } catch { return res.status(400).end() }

  const [recurso, acao] = String(evento.event ?? '').split('.')
  const id = evento.data?.id
  try {
    if (id && recurso === 'order' && acao === 'created') await pedidoCriado(id)
    if (id && recurso === 'order' && acao === 'deleted') await marcarExcluido(id)
    if (id && recurso === 'invoice' && acao !== 'deleted') await notaAlterada('nfe', id)
    if (id && recurso === 'consumer_invoice' && acao !== 'deleted') await notaAlterada('nfce', id)
  } catch (err) {
    // Responde 200 mesmo assim: reenviar não resolveria (ex.: pedido já excluído)
    console.error('webhook', evento.event, id, err.message)
  }
  res.status(200).json({ ok: true })
}
