import { adminDb } from './_lib/firebaseAdmin.js'

// Catálogo público (produtos visíveis + slider) servido com cache na Vercel:
// o Firestore é lido no máximo uma vez a cada poucos minutos, não importa quantos visitantes.
const CACHE = 'public, s-maxage=300, stale-while-revalidate=3600'

const ms = ts => ts?.toMillis?.() ?? null

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' })
  try {
    const [produtosSnap, sliderSnap] = await Promise.all([
      adminDb.collection('produtos').get(),
      adminDb.collection('slider').get(),
    ])

    // Só o que o site mostra (mesma regra de src/utils/produtos.js) e só campos públicos
    const produtos = produtosSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.ativo !== false && p.exibirNoSite !== false)
      .map(p => ({
        id:                p.id,
        nome:              p.nome ?? '',
        descricao:         p.descricao ?? '',
        preco:             p.preco ?? 0,
        imagem:            p.imagem ?? null,
        destaque:          !!p.destaque,
        atacado:           p.atacado ?? [],
        criadoEm:          ms(p.criadoEm),
        precoAtualizadoEm: ms(p.precoAtualizadoEm),
      }))
      .sort((a, b) => (a.criadoEm ?? 0) - (b.criadoEm ?? 0))

    const slider = sliderSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => s.ativo !== false)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map(s => ({ id: s.id, imagem: s.imagem, titulo: s.titulo ?? '' }))

    res.setHeader('Cache-Control', CACHE)
    res.json({ produtos, slider })
  } catch (err) {
    console.error(err)
    // Não guarda erro em cache
    res.setHeader('Cache-Control', 'no-store')
    res.status(500).json({ erro: 'Não foi possível carregar o catálogo.' })
  }
}
