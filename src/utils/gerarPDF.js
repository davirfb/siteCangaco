import { jsPDF } from "jspdf";

const COR_PRIMARY = [210, 105, 30];
const COR_CREAM = [253, 248, 220];
const COR_DARK = [62, 39, 35];
const COR_LIGHT = [109, 76, 65];
const COR_GRAY = [160, 160, 160];
const COR_GREEN = [22, 163, 74];
const COR_BORDER = [235, 215, 190];
const W = 210;
const H = 297;
const MARGIN = 14;

async function imgParaBase64(url, formato = "jpeg") {
  if (!url || url.includes("logocacto.svg")) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const max = 400;
        const ratio = Math.min(max / img.naturalWidth, max / img.naturalHeight);
        canvas.width = img.naturalWidth * ratio;
        canvas.height = img.naturalHeight * ratio;
        canvas
          .getContext("2d")
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(
          canvas.toDataURL(
            formato === "png" ? "image/png" : "image/jpeg",
            0.85,
          ),
        );
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function formatarData(ts) {
  if (!ts) return null;
  const d = ts?.toDate
    ? ts.toDate()
    : new Date(ts.seconds ? ts.seconds * 1000 : ts);
  return d.toLocaleDateString("pt-BR");
}

function rodape(doc) {
  doc.setFillColor(245, 235, 220);
  doc.rect(0, H - 12, W, 12, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COR_LIGHT);
  doc.text(
    "Cangaço Alimentos  ·  empresacangaco@gmail.com  ·  @cangaco.br",
    W / 2,
    H - 4.5,
    { align: "center" },
  );
}

function cabecalho(doc, pageNum) {
  doc.setFillColor(...COR_PRIMARY);
  doc.rect(0, 0, W, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Cangaço Alimentos — Catálogo de Produtos", MARGIN, 10.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Página ${pageNum}`, W - MARGIN, 10.5, { align: "right" });
  rodape(doc);
}

export async function gerarCatalogoPDF(produtos) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const hoje = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  let pagina = 1;

  // ── Capa ──────────────────────────────────────────────────────────────────

  // Fundo cream
  doc.setFillColor(...COR_CREAM);
  doc.rect(0, 0, W, H, "F");

  // Logo
  const logoData = await imgParaBase64("/img/logocangaco.svg", "png");
  if (logoData) {
    doc.addImage(logoData, "PNG", W / 2 - 50, 20, 100, 80);
  }

  // Título catálogo
  doc.setTextColor(...COR_PRIMARY);
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.text("Catálogo de Produtos", MARGIN, 107);

  // Linha decorativa
  doc.setDrawColor(...COR_PRIMARY);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 111, MARGIN + 90, 111);

  // Data e contagem
  doc.setTextColor(...COR_LIGHT);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em ${hoje}`, MARGIN, 121);
  doc.text(
    `${produtos.length} produto${produtos.length !== 1 ? "s" : ""} disponíve${produtos.length !== 1 ? "is" : "l"}`,
    MARGIN,
    130,
  );

  // Miniaturas de destaque (até 4 produtos)
  const destaques = produtos.slice(0, 4);
  if (destaques.length > 0) {
    const boxW = (W - MARGIN * 2 - (destaques.length - 1) * 4) / destaques.length;
    destaques.forEach((p, i) => {
      const bx = MARGIN + i * (boxW + 4);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...COR_BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(bx, 142, boxW, 34, 2, 2, "FD");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COR_DARK);
      const nomeFit = doc.splitTextToSize(p.nome, boxW - 4);
      doc.text(nomeFit[0], bx + boxW / 2, 153, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COR_PRIMARY);
      doc.text("R$ " + Number(p.preco).toFixed(2).replace(".", ","), bx + boxW / 2, 166, { align: "center" });
    });
  }

  // Caixa de contato
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COR_BORDER);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, 196, W - MARGIN * 2, 56, 3, 3, "FD");

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COR_PRIMARY);
  doc.text("Entre em Contato", W / 2, 211, { align: "center" });

  doc.setDrawColor(...COR_BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 12, 215, W - MARGIN - 12, 215);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COR_LIGHT);
  doc.text("empresacangaco@gmail.com", W / 2, 225, { align: "center" });
  doc.text("WhatsApp: (61) 98427-4420  ·  (61) 99377-9722", W / 2, 234, {
    align: "center",
  });
  doc.text("Instagram: @cangaco.br", W / 2, 243, { align: "center" });

  rodape(doc);

  // ── Páginas de produtos ───────────────────────────────────────────────────
  const CARD_H = 80;
  const IMG_SZ = 60;
  const PAD = 5;
  const IMG_X = MARGIN;
  const INFO_X = IMG_X + IMG_SZ + PAD * 2;
  const INFO_W = W - INFO_X - MARGIN - 2;

  let y = 25;

  for (let i = 0; i < produtos.length; i++) {
    const p = produtos[i];

    if (i === 0 || y + CARD_H > H - 18) {
      doc.addPage();
      pagina++;
      cabecalho(doc, pagina);
      y = 22;
    }

    // Card
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...COR_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, CARD_H, 3, 3, "FD");

    // Imagem com padding interno
    const imgData = await imgParaBase64(p.imagem);
    const imgY = y + (CARD_H - IMG_SZ) / 2;
    if (imgData) {
      doc.addImage(
        imgData,
        "JPEG",
        IMG_X + PAD,
        imgY,
        IMG_SZ - PAD,
        IMG_SZ - PAD,
      );
    } else {
      doc.setFillColor(245, 240, 235);
      doc.roundedRect(IMG_X + PAD, imgY, IMG_SZ - PAD, IMG_SZ - PAD, 2, 2, "F");
      doc.setTextColor(...COR_GRAY);
      doc.setFontSize(7);
      doc.text(
        "Sem imagem",
        IMG_X + PAD + (IMG_SZ - PAD) / 2,
        imgY + (IMG_SZ - PAD) / 2,
        { align: "center" },
      );
    }

    let iy = y + 11;

    // Nome
    doc.setTextColor(...COR_DARK);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(p.nome, INFO_X, iy, { maxWidth: INFO_W });
    iy += 7;

    // Descrição
    if (p.descricao) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COR_LIGHT);
      const linhas = doc.splitTextToSize(p.descricao, INFO_W);
      doc.text(linhas.slice(0, 2), INFO_X, iy);
      iy += linhas.slice(0, 2).length * 4.5 + 2;
    }

    // Preço
    doc.setFontSize(17);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COR_PRIMARY);
    doc.text(
      "R$ " + Number(p.preco).toFixed(2).replace(".", ","),
      INFO_X,
      iy + 5,
    );
    iy += 13;

    // Data de atualização
    const dataPreco = formatarData(p.precoAtualizadoEm);
    if (dataPreco) {
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...COR_GRAY);
      doc.text(`Preço atualizado em: ${dataPreco}`, INFO_X, iy);
      iy += 5;
    }

    // Divisória + atacado
    if (p.atacado?.length > 0) {
      doc.setDrawColor(...COR_BORDER);
      doc.setLineWidth(0.3);
      doc.line(INFO_X, iy, W - MARGIN - 2, iy);
      iy += 4.5;

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COR_DARK);
      doc.text("Atacado:", INFO_X, iy);
      let ax = INFO_X + 21;
      p.atacado.forEach((tier) => {
        const desc = Math.round((1 - tier.preco / Number(p.preco)) * 100);
        const txt = `${tier.qtdMinima}+ un.: R$ ${Number(tier.preco).toFixed(2).replace(".", ",")} (-${desc}%)`;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COR_GREEN);
        if (ax + doc.getTextWidth(txt) > W - MARGIN - 2) {
          iy += 5;
          ax = INFO_X + 21;
        }
        doc.text(txt, ax, iy);
        ax += doc.getTextWidth(txt) + 6;
      });
    }

    y += CARD_H + 5;
  }

  const nome = `catalogo-cangaco-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(nome);
}

/* ── PDF de Pedido ── */
const brlPDF = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`

function dataExtenso(iso) {
  const d = iso ? new Date(`${iso}T12:00:00`) : new Date()
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Desenha um pedido/orçamento a partir da página atual (quebra página se tiver muitos itens)
function desenharPedido(doc, { cliente, cnpj, itens, total, obs, titulo = 'PEDIDO', numero, data, situacao }) {
  // ── Cabeçalho ──
  doc.setFillColor(...COR_PRIMARY)
  doc.rect(0, 0, W, 32, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text(numero ? `${titulo} Nº ${numero}` : titulo, MARGIN, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Cangaço Alimentos', W - MARGIN, 13, { align: 'right' })
  doc.text(dataExtenso(data), W - MARGIN, 24, { align: 'right' })

  // ── Dados do cliente ──
  let y = 44

  doc.setFillColor(...COR_CREAM)
  doc.setDrawColor(...COR_BORDER)
  doc.setLineWidth(0.3)
  doc.roundedRect(MARGIN, y, W - MARGIN * 2, 30, 3, 3, 'FD')

  doc.setTextColor(...COR_PRIMARY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('CLIENTE', MARGIN + 5, y + 8)
  if (situacao) doc.text(situacao.toUpperCase(), W - MARGIN - 5, y + 8, { align: 'right' })

  doc.setTextColor(...COR_DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(cliente && cliente.length > 34 ? 14 : 18)
  doc.text(doc.splitTextToSize(cliente || '—', cnpj ? 115 : 170)[0], MARGIN + 5, y + 21)

  if (cnpj) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.setTextColor(...COR_LIGHT)
    doc.text(`CNPJ: ${cnpj}`, W - MARGIN - 5, y + 21, { align: 'right' })
  }

  y += 42

  const cabecalhoTabela = () => {
    doc.setFillColor(...COR_DARK)
    doc.rect(MARGIN, y, W - MARGIN * 2, 12, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('PRODUTO', MARGIN + 4, y + 8)
    doc.text('QTD', 138, y + 8, { align: 'center' })
    doc.text('UNIT.', 160, y + 8, { align: 'center' })
    doc.text('SUBTOTAL', W - MARGIN - 4, y + 8, { align: 'right' })
    y += 12
  }
  cabecalhoTabela()

  // ── Linhas de produto ──
  itens.forEach((it, i) => {
    const ROW_H = 16
    if (y + ROW_H > H - 20) { rodape(doc); doc.addPage(); y = 16; cabecalhoTabela() }
    doc.setFillColor(i % 2 === 0 ? 252 : 245, i % 2 === 0 ? 252 : 245, i % 2 === 0 ? 252 : 248)
    doc.rect(MARGIN, y, W - MARGIN * 2, ROW_H, 'F')

    const nomeMax = doc.splitTextToSize(it.nome || '—', 108)
    doc.setTextColor(...COR_DARK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(nomeMax[0], MARGIN + 4, y + 10.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(15)
    doc.text(String(it.quantidade), 138, y + 10.5, { align: 'center' })

    doc.setFontSize(14)
    doc.setTextColor(...COR_LIGHT)
    doc.text(brlPDF(it.precoUnitario), 160, y + 10.5, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...COR_PRIMARY)
    doc.text(brlPDF(it.quantidade * it.precoUnitario), W - MARGIN - 4, y + 10.5, { align: 'right' })

    y += ROW_H
  })

  doc.setDrawColor(...COR_BORDER)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, W - MARGIN, y)
  y += 10

  // ── Total ──
  if (y + 22 > H - 16) { rodape(doc); doc.addPage(); y = 16 }
  doc.setFillColor(...COR_PRIMARY)
  doc.roundedRect(MARGIN, y, W - MARGIN * 2, 22, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(titulo === 'ORÇAMENTO' ? 'TOTAL DO ORÇAMENTO' : 'TOTAL DO PEDIDO', MARGIN + 8, y + 9)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text(brlPDF(total), W - MARGIN - 8, y + 16, { align: 'right' })
  y += 32

  // ── Observações ──
  if (obs && obs.trim()) {
    const obsLines = doc.splitTextToSize(obs.trim(), W - MARGIN * 2 - 10)
    const obsH = 14 + obsLines.length * 7
    if (y + obsH > H - 16) { rodape(doc); doc.addPage(); y = 16 }
    doc.setFillColor(245, 245, 245)
    doc.setDrawColor(...COR_BORDER)
    doc.setLineWidth(0.3)
    doc.roundedRect(MARGIN, y, W - MARGIN * 2, obsH, 3, 3, 'FD')
    doc.setTextColor(...COR_PRIMARY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('OBSERVAÇÕES', MARGIN + 5, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(13)
    doc.setTextColor(...COR_DARK)
    doc.text(obsLines, MARGIN + 5, y + 17)
  }

  rodape(doc)
}

export function gerarPedidoPDF(pedido) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const titulo = pedido.titulo ?? 'PEDIDO'
  desenharPedido(doc, { ...pedido, titulo })
  const tituloArq = titulo === 'ORÇAMENTO' ? 'orcamento' : titulo.toLowerCase()
  const nomeArq = `${tituloArq}${pedido.numero ? '-' + pedido.numero : ''}-${(pedido.cliente || 'cliente').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(nomeArq)
}

// Vários pedidos num único PDF (um por página) + página de resumo no final
export function gerarPedidosPDF(pedidos, { descricao = 'Pedidos', arquivo = 'pedidos' } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  pedidos.forEach((p, i) => {
    if (i > 0) doc.addPage()
    desenharPedido(doc, p)
  })

  // ── Resumo ──
  doc.addPage()
  doc.setFillColor(...COR_PRIMARY)
  doc.rect(0, 0, W, 26, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('RESUMO', MARGIN, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`${descricao} · ${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''} · ${new Date().toLocaleDateString('pt-BR')}`, W - MARGIN, 16, { align: 'right' })

  let y = 36
  const cab = () => {
    doc.setFillColor(...COR_DARK)
    doc.rect(MARGIN, y, W - MARGIN * 2, 9, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Nº', MARGIN + 3, y + 6)
    doc.text('DATA', MARGIN + 22, y + 6)
    doc.text('CLIENTE', MARGIN + 46, y + 6)
    doc.text('SITUAÇÃO', 150, y + 6)
    doc.text('TOTAL', W - MARGIN - 3, y + 6, { align: 'right' })
    y += 9
  }
  cab()
  pedidos.forEach((p, i) => {
    if (y + 8 > H - 26) { rodape(doc); doc.addPage(); y = 16; cab() }
    if (i % 2 === 1) { doc.setFillColor(250, 247, 240); doc.rect(MARGIN, y, W - MARGIN * 2, 8, 'F') }
    doc.setTextColor(...COR_DARK)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(p.numero ? String(p.numero) : (p.titulo === 'ORÇAMENTO' ? 'Orç.' : '—'), MARGIN + 3, y + 5.5)
    doc.text(p.data ? new Date(`${p.data}T12:00:00`).toLocaleDateString('pt-BR') : '—', MARGIN + 22, y + 5.5)
    doc.text(doc.splitTextToSize(p.cliente || '—', 98)[0], MARGIN + 46, y + 5.5)
    doc.text(doc.splitTextToSize(p.situacao || '', 28)[0] || '', 150, y + 5.5)
    doc.setFont('helvetica', 'bold')
    doc.text(brlPDF(p.total), W - MARGIN - 3, y + 5.5, { align: 'right' })
    y += 8
  })
  const soma = pedidos.reduce((acc, p) => acc + Number(p.total || 0), 0)
  y += 4
  doc.setFillColor(...COR_PRIMARY)
  doc.roundedRect(MARGIN, y, W - MARGIN * 2, 14, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('TOTAL GERAL', MARGIN + 5, y + 9)
  doc.setFontSize(14)
  doc.text(brlPDF(soma), W - MARGIN - 5, y + 9.5, { align: 'right' })
  rodape(doc)

  doc.save(`${arquivo}-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// Lista de clientes (A4 deitado), agrupada por rede/grupo
// secoes: [{ titulo, destaques: [], clientes: [{ nome, razao, documento, telefone, cidade, destaques: [] }] }]
export function gerarListaClientesPDF({ secoes, subtitulo }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const LW = 297
  const LH = 210
  const hoje = new Date().toLocaleDateString('pt-BR')
  const total = secoes.reduce((acc, s) => acc + s.clientes.length, 0)
  const COLS = [
    { titulo: 'CLIENTE',   x: MARGIN + 3, w: 92 },
    { titulo: 'CNPJ / CPF', x: 112, w: 38 },
    { titulo: 'TELEFONE',  x: 152, w: 34 },
    { titulo: 'CIDADE',    x: 188, w: 36 },
    { titulo: 'DESTAQUES', x: 226, w: LW - MARGIN - 226 },
  ]
  let pagina = 0
  let y = 0

  function rodapeLista() {
    doc.setFillColor(245, 235, 220)
    doc.rect(0, LH - 10, LW, 10, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COR_LIGHT)
    doc.text(`Cangaço Alimentos  ·  Lista de clientes  ·  ${hoje}`, MARGIN, LH - 4)
    doc.text(`Página ${pagina}`, LW - MARGIN, LH - 4, { align: 'right' })
  }

  function cabecalhoTabela() {
    doc.setFillColor(...COR_DARK)
    doc.rect(MARGIN, y, LW - MARGIN * 2, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    COLS.forEach(c => doc.text(c.titulo, c.x, y + 5.5))
    y += 8
  }

  function novaPagina() {
    if (pagina > 0) doc.addPage()
    pagina++
    doc.setFillColor(...COR_PRIMARY)
    doc.rect(0, 0, LW, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('LISTA DE CLIENTES', MARGIN, 11.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`${subtitulo ? subtitulo + '  ·  ' : ''}${total} cliente${total !== 1 ? 's' : ''}  ·  ${hoje}`, LW - MARGIN, 11.5, { align: 'right' })
    rodapeLista()
    y = 26
    cabecalhoTabela()
  }

  const garantir = h => { if (y + h > LH - 14) novaPagina() }

  novaPagina()
  secoes.forEach(secao => {
    if (secao.titulo) {
      const dest = secao.destaques?.length ? `  —  ${secao.destaques.join(' · ')}` : ''
      garantir(16)
      doc.setFillColor(...COR_CREAM)
      doc.setDrawColor(...COR_BORDER)
      doc.rect(MARGIN, y, LW - MARGIN * 2, 8, 'FD')
      doc.setTextColor(...COR_PRIMARY)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      const linha = doc.splitTextToSize(`${secao.titulo} (${secao.clientes.length})${dest}`, LW - MARGIN * 2 - 6)[0]
      doc.text(linha, MARGIN + 3, y + 5.5)
      y += 8
    }

    secao.clientes.forEach((c, i) => {
      const nomeLinhas = doc.splitTextToSize(c.nome || '—', COLS[0].w).slice(0, 1)
      const razao      = c.razao ? doc.splitTextToSize(c.razao, COLS[0].w).slice(0, 1) : []
      const destLinhas = c.destaques?.length ? doc.splitTextToSize(c.destaques.join(' · '), COLS[4].w).slice(0, 2) : []
      const h = Math.max(8, 4 + (nomeLinhas.length + razao.length) * 4, 4 + destLinhas.length * 4)
      garantir(h)

      if (i % 2 === 1) { doc.setFillColor(250, 247, 240); doc.rect(MARGIN, y, LW - MARGIN * 2, h, 'F') }

      doc.setTextColor(...COR_DARK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.text(nomeLinhas, COLS[0].x, y + 5)
      if (razao.length) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...COR_LIGHT)
        doc.text(razao, COLS[0].x, y + 9)
      }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...COR_DARK)
      doc.text(c.documento || '—', COLS[1].x, y + 5)
      doc.text(doc.splitTextToSize(c.telefone || '—', COLS[2].w)[0], COLS[2].x, y + 5)
      doc.text(doc.splitTextToSize(c.cidade || '—', COLS[3].w)[0], COLS[3].x, y + 5)
      if (destLinhas.length) {
        doc.setTextColor(...COR_PRIMARY)
        doc.setFont('helvetica', 'bold')
        doc.text(destLinhas, COLS[4].x, y + 5)
      }
      y += h
    })
    y += 3
  })

  doc.save(`clientes-cangaco-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// Resumo de produção dos pedidos em aberto: quanto fazer de cada produto + lista de pedidos
// produtos: [{ nome, quantidade, valor, qtdFardo }]
// pedidos:  [{ numero, entrega, cliente, destaques: [], total }]
export function gerarResumoProducaoPDF({ produtos, pedidos, descricao = 'Pedidos em aberto' }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const hoje = new Date().toLocaleDateString('pt-BR')
  const dataBR = iso => iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—'
  let y = 0

  const topo = (continua = false) => {
    doc.setFillColor(...COR_PRIMARY)
    doc.rect(0, 0, W, 24, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(17)
    doc.text(continua ? 'RESUMO DE PRODUÇÃO (cont.)' : 'RESUMO DE PRODUÇÃO', MARGIN, 15)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.text(`${descricao} · ${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''} · ${hoje}`, W - MARGIN, 15, { align: 'right' })
    rodape(doc)
    y = 32
  }
  const garantir = h => { if (y + h > H - 16) { doc.addPage(); topo(true) } }

  const titulo = texto => {
    garantir(14)
    doc.setTextColor(...COR_PRIMARY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(texto, MARGIN, y + 4)
    y += 7
  }

  const cabecalho = colunas => {
    doc.setFillColor(...COR_DARK)
    doc.rect(MARGIN, y, W - MARGIN * 2, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    colunas.forEach(([t, x, al]) => doc.text(t, x, y + 5.5, al ? { align: al } : undefined))
    y += 8
  }

  topo()

  // ── Produtos a produzir ──
  titulo('O QUE PRODUZIR')
  const colsProd = [['PRODUTO', MARGIN + 3], ['QUANTIDADE', 128, 'right'], ['FARDOS', 160, 'right'], ['VALOR', W - MARGIN - 3, 'right']]
  cabecalho(colsProd)
  produtos.forEach((p, i) => {
    garantir(9)
    if (y === 32) cabecalho(colsProd)
    if (i % 2 === 1) { doc.setFillColor(250, 247, 240); doc.rect(MARGIN, y, W - MARGIN * 2, 9, 'F') }
    doc.setTextColor(...COR_DARK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(doc.splitTextToSize(p.nome || '—', 90)[0], MARGIN + 3, y + 6)
    doc.setFontSize(11)
    doc.text(String(p.quantidade), 128, y + 6, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    if (p.qtdFardo > 1) {
      const f = Math.floor(p.quantidade / p.qtdFardo)
      const resto = p.quantidade % p.qtdFardo
      doc.text(`${f} × ${p.qtdFardo}${resto ? ` + ${resto} un` : ''}`, 160, y + 6, { align: 'right' })
    } else doc.text('—', 160, y + 6, { align: 'right' })
    doc.setTextColor(...COR_LIGHT)
    doc.text(brlPDF(p.valor), W - MARGIN - 3, y + 6, { align: 'right' })
    y += 9
  })
  const totalUn = produtos.reduce((a, p) => a + p.quantidade, 0)
  const totalValor = pedidos.reduce((a, p) => a + Number(p.total || 0), 0)
  garantir(12)
  doc.setFillColor(...COR_PRIMARY)
  doc.roundedRect(MARGIN, y + 1, W - MARGIN * 2, 10, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('TOTAL', MARGIN + 3, y + 7.5)
  doc.text(`${totalUn} un`, 128, y + 7.5, { align: 'right' })
  doc.text(brlPDF(totalValor), W - MARGIN - 3, y + 7.5, { align: 'right' })
  y += 18

  // ── Pedidos (com destaques dos clientes) ──
  titulo('PEDIDOS')
  const colsPed = [['Nº', MARGIN + 3], ['ENTREGA', MARGIN + 18], ['CLIENTE / DESTAQUES', MARGIN + 42], ['VALOR', W - MARGIN - 3, 'right']]
  cabecalho(colsPed)
  pedidos.forEach((p, i) => {
    const dest = p.destaques?.length ? doc.splitTextToSize(`» ${p.destaques.join(' · ')}`, 118).slice(0, 2) : []
    const h = 8 + dest.length * 4
    garantir(h)
    if (y === 32) cabecalho(colsPed)
    if (i % 2 === 1) { doc.setFillColor(250, 247, 240); doc.rect(MARGIN, y, W - MARGIN * 2, h, 'F') }
    doc.setTextColor(...COR_DARK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.text(String(p.numero ?? '—'), MARGIN + 3, y + 5.5)
    doc.setFont('helvetica', 'normal')
    doc.text(dataBR(p.entrega), MARGIN + 18, y + 5.5)
    doc.setFont('helvetica', 'bold')
    doc.text(doc.splitTextToSize(p.cliente || '—', 118)[0], MARGIN + 42, y + 5.5)
    doc.text(brlPDF(p.total), W - MARGIN - 3, y + 5.5, { align: 'right' })
    if (dest.length) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(180, 120, 0)
      doc.text(dest, MARGIN + 42, y + 9.5)
    }
    y += h
  })

  doc.save(`resumo-producao-${new Date().toISOString().slice(0, 10)}.pdf`)
}
