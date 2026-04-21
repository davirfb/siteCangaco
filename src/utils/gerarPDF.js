import { jsPDF } from 'jspdf'

const COR_PRIMARY  = [210, 105, 30]
const COR_CREAM    = [253, 248, 220]
const COR_DARK     = [62,  39,  35]
const COR_LIGHT    = [109, 76,  65]
const COR_GRAY     = [160, 160, 160]
const COR_GREEN    = [22,  163, 74]
const W = 210
const H = 297
const MARGIN = 14

async function imgParaBase64(url) {
  if (!url || url.includes('logocacto.svg')) return null
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const max = 400
        const ratio = Math.min(max / img.naturalWidth, max / img.naturalHeight)
        canvas.width  = img.naturalWidth  * ratio
        canvas.height = img.naturalHeight * ratio
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function formatarData(ts) {
  if (!ts) return null
  const d = ts?.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts)
  return d.toLocaleDateString('pt-BR')
}

function cabecalho(doc, pageNum) {
  doc.setFillColor(...COR_PRIMARY)
  doc.rect(0, 0, W, 16, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Cangaço Alimentos — Catálogo de Produtos', MARGIN, 10.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Página ${pageNum}`, W - MARGIN, 10.5, { align: 'right' })
}

export async function gerarCatalogoPDF(produtos) {
  const doc   = new jsPDF({ unit: 'mm', format: 'a4' })
  const hoje  = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  let pagina  = 1

  // ── Capa ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...COR_PRIMARY)
  doc.rect(0, 0, W, 70, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(32)
  doc.setFont('helvetica', 'bold')
  doc.text('Cangaço', MARGIN, 35)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text('Alimentos Artesanais', MARGIN, 46)

  doc.setFillColor(...COR_CREAM)
  doc.rect(0, 70, W, H - 70, 'F')

  doc.setTextColor(...COR_PRIMARY)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Catálogo de Produtos', MARGIN, 90)

  doc.setTextColor(...COR_LIGHT)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Gerado em ${hoje}`, MARGIN, 100)
  doc.text(`${produtos.length} produto${produtos.length !== 1 ? 's' : ''} disponíve${produtos.length !== 1 ? 'is' : 'l'}`, MARGIN, 108)

  // ── Produtos ──────────────────────────────────────────────────────────────
  const CARD_H   = 72
  const IMG_SIZE = 56
  const IMG_X    = MARGIN
  const INFO_X   = IMG_X + IMG_SIZE + 8
  const INFO_W   = W - INFO_X - MARGIN

  let y = 25

  for (let i = 0; i < produtos.length; i++) {
    const p = produtos[i]

    if (i === 0 || y + CARD_H > H - 18) {
      doc.addPage()
      pagina++
      cabecalho(doc, pagina)
      y = 22
    }

    // Card bg
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(235, 215, 190)
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, CARD_H, 3, 3, 'FD')

    // Imagem
    const imgData = await imgParaBase64(p.imagem)
    if (imgData) {
      doc.addImage(imgData, 'JPEG', IMG_X + 2, y + (CARD_H - IMG_SIZE) / 2, IMG_SIZE, IMG_SIZE)
    } else {
      doc.setFillColor(240, 240, 240)
      doc.roundedRect(IMG_X + 2, y + (CARD_H - IMG_SIZE) / 2, IMG_SIZE, IMG_SIZE, 2, 2, 'F')
      doc.setTextColor(...COR_GRAY)
      doc.setFontSize(7)
      doc.text('Sem imagem', IMG_X + 2 + IMG_SIZE / 2, y + CARD_H / 2, { align: 'center' })
    }

    let iy = y + 10

    // Nome
    doc.setTextColor(...COR_DARK)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(p.nome, INFO_X, iy, { maxWidth: INFO_W })
    iy += 6

    // Descrição
    if (p.descricao) {
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COR_LIGHT)
      const linhas = doc.splitTextToSize(p.descricao, INFO_W)
      doc.text(linhas.slice(0, 2), INFO_X, iy)
      iy += linhas.slice(0, 2).length * 4 + 2
    }

    // Preço
    const precoFmt = 'R$ ' + Number(p.preco).toFixed(2).replace('.', ',')
    doc.setFontSize(15)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COR_PRIMARY)
    doc.text(precoFmt, INFO_X, iy + 4)
    iy += 10

    // Data de atualização do preço
    const dataPreco = formatarData(p.precoAtualizadoEm)
    if (dataPreco) {
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...COR_GRAY)
      doc.text(`Preço atualizado em: ${dataPreco}`, INFO_X, iy)
      iy += 5
    }

    // Atacado
    if (p.atacado?.length > 0) {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...COR_DARK)
      doc.text('Atacado:', INFO_X, iy)
      let ax = INFO_X + 18
      p.atacado.forEach(tier => {
        const desc = Math.round((1 - tier.preco / Number(p.preco)) * 100)
        const txt  = `${tier.qtdMinima}+ un.: R$ ${Number(tier.preco).toFixed(2).replace('.', ',')} (-${desc}%)`
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...COR_GREEN)
        if (ax + doc.getTextWidth(txt) > W - MARGIN - 2) { iy += 4; ax = INFO_X + 18 }
        doc.text(txt, ax, iy)
        ax += doc.getTextWidth(txt) + 6
      })
    }

    y += CARD_H + 5
  }

  // Rodapé última página
  doc.setFontSize(7.5)
  doc.setTextColor(...COR_GRAY)
  doc.setFont('helvetica', 'normal')
  doc.text(`Cangaço Alimentos · empresacangaco@gmail.com`, W / 2, H - 8, { align: 'center' })

  const nome = `catalogo-cangaco-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(nome)
}
