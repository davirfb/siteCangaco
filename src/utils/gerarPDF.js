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
