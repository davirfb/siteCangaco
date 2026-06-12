import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { gerarCatalogoPDF, gerarPedidoPDF } from '../../utils/gerarPDF.js'
import { auth, db } from '../../lib/firebase.js'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp,
} from 'firebase/firestore'

const CLOUD      = 'dykq5hssj'
const PRESET     = 'cangaco_produtos'
const WA_NUMERO  = '5561984274420'

function formatCNPJ(v) {
  return v.replace(/\D/g, '').substring(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

async function uploadToCloudinary(file, onProgress) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', PRESET)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`)
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100))
    }
    xhr.onload = () => {
      if (xhr.status === 200) resolve(JSON.parse(xhr.responseText).secure_url)
      else reject(new Error('Erro no upload: ' + xhr.responseText))
    }
    xhr.onerror = () => reject(new Error('Falha na conexão com Cloudinary.'))
    xhr.send(fd)
  })
}

/* ── Toast ── */
function Toast({ msg, tipo, visible }) {
  if (!visible) return null
  return (
    <div role="status" aria-live="polite"
         className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 rounded-xl shadow-xl text-white text-sm font-medium whitespace-nowrap ${tipo === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
      <i className={`fas ${tipo === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}`}></i>
      {msg}
    </div>
  )
}

/* ── Modal Produto ── */
function ModalProduto({ produto, onClose, onSaved }) {
  const [nome,         setNome]        = useState(produto?.nome         ?? '')
  const [preco,        setPreco]       = useState(produto?.preco        ?? '')
  const [precoAtacado, setPrecoAtacado]= useState(produto?.precoAtacado ?? '')
  const [descricao,    setDescricao]   = useState(produto?.descricao    ?? '')
  const [destaque,     setDestaque]    = useState(produto?.destaque     ?? false)
  const [ativo,        setAtivo]       = useState(produto?.ativo !== false)
  const [atacado,      setAtacado]     = useState(
    produto?.atacado?.length ? produto.atacado : []
  )
  const [previewSrc, setPreviewSrc] = useState(produto?.imagem || null)
  const [dragOver,   setDragOver]   = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [uploadPct,  setUploadPct]  = useState(0)
  const [erro,       setErro]       = useState('')
  const [saving,     setSaving]     = useState(false)
  const fileRef      = useRef(null)
  const selectedFile = useRef(null)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  function pickFile(file) {
    if (!file) return
    selectedFile.current = file
    const reader = new FileReader()
    reader.onload = e => setPreviewSrc(e.target.result)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setSaving(true)
    try {
      let imagemUrl = produto?.imagem || '/img/logocacto.svg'
      if (selectedFile.current) {
        setUploading(true)
        imagemUrl = await uploadToCloudinary(selectedFile.current, pct => setUploadPct(pct))
        setUploading(false)
      }

      const dados = {
        nome:         nome.trim(),
        descricao:    descricao.trim(),
        preco:        parseFloat(preco),
        precoAtacado: precoAtacado !== '' ? parseFloat(precoAtacado) : null,
        imagem:       imagemUrl,
        destaque,
        ativo,
        atacado: atacado
          .filter(t => t.qtdMinima && t.preco)
          .map(t => ({ qtdMinima: parseInt(t.qtdMinima), preco: parseFloat(t.preco) }))
          .sort((a, b) => a.qtdMinima - b.qtdMinima),
        atualizadoEm: serverTimestamp(),
        ...((!produto?.id || parseFloat(preco) !== Number(produto?.preco)) && {
          precoAtualizadoEm: serverTimestamp(),
        }),
      }

      if (produto?.id) {
        await updateDoc(doc(db, 'produtos', produto.id), dados)
        onSaved({ ...produto, ...dados })
      } else {
        dados.criadoEm = serverTimestamp()
        const ref = await addDoc(collection(db, 'produtos'), dados)
        onSaved({ id: ref.id, ...dados, criadoEm: new Date() })
      }
      onClose()
    } catch (err) {
      console.error(err)
      setErro('Erro ao salvar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-text-dark">{produto ? 'Editar Produto' : 'Novo Produto'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-1">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className="block mb-1 text-sm font-semibold text-text-dark">Nome do Produto *</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)}
                   required placeholder="Ex: Castanha de Caju — 250g" className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-sm font-semibold text-text-dark">Preço Varejo (R$) *</label>
              <input type="number" value={preco} onChange={e => setPreco(e.target.value)}
                     required step="0.01" min="0" placeholder="25.90" className={inputCls} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-text-dark">
                Preço Atacado (R$)
                <span className="ml-1 text-[11px] font-normal text-gray-400">só ADM</span>
              </label>
              <input type="number" value={precoAtacado} onChange={e => setPrecoAtacado(e.target.value)}
                     step="0.01" min="0" placeholder="18.00" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold text-text-dark">Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
                      rows={3} placeholder="Descrição do produto..."
                      className={inputCls + ' resize-y'} />
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold text-text-dark">Imagem do Produto</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0]) }}
              className={`border-2 border-dashed rounded-xl cursor-pointer overflow-hidden transition-colors ${dragOver ? 'drag-over border-primary' : 'border-gray-300 hover:border-primary'}`}
              style={{ minHeight: 110 }}
            >
              {previewSrc
                ? <img src={previewSrc} alt="Preview" className="w-full max-h-48 object-cover" />
                : (
                  <div className="flex flex-col items-center justify-center gap-1 py-7 text-gray-400">
                    <i className="fas fa-cloud-upload-alt text-3xl"></i>
                    <p className="text-sm">Clique ou arraste uma imagem aqui</p>
                    <span className="text-xs">JPG, PNG, WebP — máx. 10 MB</span>
                  </div>
                )
              }
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
                   onChange={e => pickFile(e.target.files[0])} />
            {uploading && (
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="progress-fill h-full" style={{ width: uploadPct + '%' }} />
                </div>
                <span className="text-xs text-text-light">{uploadPct}%</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={destaque} onChange={e => setDestaque(e.target.checked)} className="sr-only" />
              <span className="toggle-switch"></span>
              <span className="text-sm text-text-dark">Destaque na página inicial</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="sr-only" />
              <span className="toggle-switch"></span>
              <span className="text-sm text-text-dark">Produto ativo</span>
            </label>
          </div>

          <div className="relative flex items-center my-1">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-3 text-xs text-gray-400 bg-white">Faixas de Atacado no Site (opcional)</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          <div className="flex flex-col gap-2">
            {atacado.map((tier, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  {i === 0 && <label className="block mb-1 text-xs font-semibold text-gray-500">Qtd. mínima</label>}
                  <input type="number" min="1" step="1" placeholder="Ex: 150"
                    value={tier.qtdMinima}
                    onChange={e => setAtacado(prev => prev.map((t, j) => j === i ? { ...t, qtdMinima: e.target.value } : t))}
                    className={inputCls} />
                </div>
                <div className="flex-1">
                  {i === 0 && <label className="block mb-1 text-xs font-semibold text-gray-500">Preço unit. (R$)</label>}
                  <input type="number" min="0" step="0.01" placeholder="Ex: 2.90"
                    value={tier.preco}
                    onChange={e => setAtacado(prev => prev.map((t, j) => j === i ? { ...t, preco: e.target.value } : t))}
                    className={inputCls} />
                </div>
                {preco && tier.preco && (
                  <div className="pb-2.5 text-xs font-semibold text-green-600 whitespace-nowrap">
                    {Math.round((1 - tier.preco / preco) * 100)}% off
                  </div>
                )}
                <button type="button"
                        onClick={() => setAtacado(prev => prev.filter((_, j) => j !== i))}
                        className="pb-2.5 text-red-400 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-none">
                  <i className="fas fa-trash text-sm"></i>
                </button>
              </div>
            ))}
            <button type="button"
                    onClick={() => setAtacado(prev => [...prev, { qtdMinima: '', preco: '' }])}
                    className="flex items-center gap-2 text-sm text-primary hover:text-dark-brown font-semibold cursor-pointer bg-transparent border-none w-fit">
              <i className="fas fa-plus"></i> Adicionar faixa
            </button>
          </div>

          {erro && (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm" role="alert">{erro}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
                    className="px-5 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-semibold text-text-dark hover:border-primary hover:text-primary transition-colors cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={saving || uploading}
                    className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-dark-brown transition-colors disabled:opacity-60 cursor-pointer flex items-center gap-2">
              <i className="fas fa-save"></i>
              {saving ? 'Salvando…' : 'Salvar Produto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Modal Slide ── */
function ModalSlide({ slide, onClose, onSaved }) {
  const [titulo,     setTitulo]    = useState(slide?.titulo  ?? '')
  const [ordem,      setOrdem]     = useState(slide?.ordem   ?? 0)
  const [ativo,      setAtivo]     = useState(slide?.ativo !== false)
  const [previewSrc, setPreviewSrc]= useState(slide?.imagem || null)
  const [dragOver,   setDragOver]  = useState(false)
  const [uploading,  setUploading] = useState(false)
  const [uploadPct,  setUploadPct] = useState(0)
  const [erro,       setErro]      = useState('')
  const [saving,     setSaving]    = useState(false)
  const fileRef      = useRef(null)
  const selectedFile = useRef(null)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  function pickFile(file) {
    if (!file) return
    selectedFile.current = file
    const reader = new FileReader()
    reader.onload = e => setPreviewSrc(e.target.result)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (!slide?.imagem && !selectedFile.current) { setErro('Selecione uma imagem.'); return }
    setSaving(true)
    try {
      let imagemUrl = slide?.imagem || ''
      if (selectedFile.current) {
        setUploading(true)
        imagemUrl = await uploadToCloudinary(selectedFile.current, pct => setUploadPct(pct))
        setUploading(false)
      }
      const dados = {
        imagem: imagemUrl, titulo: titulo.trim(),
        ordem: Number(ordem), ativo,
        atualizadoEm: serverTimestamp(),
      }
      if (slide?.id) {
        await updateDoc(doc(db, 'slider', slide.id), dados)
        onSaved({ ...slide, ...dados })
      } else {
        dados.criadoEm = serverTimestamp()
        const ref = await addDoc(collection(db, 'slider'), dados)
        onSaved({ id: ref.id, ...dados, criadoEm: new Date() })
      }
      onClose()
    } catch (err) {
      setErro('Erro ao salvar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-text-dark">{slide?.id ? 'Editar Imagem' : 'Nova Imagem do Slider'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-1">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className="block mb-1 text-sm font-semibold text-text-dark">Imagem *</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0]) }}
              className={`border-2 border-dashed rounded-xl cursor-pointer overflow-hidden transition-colors ${dragOver ? 'drag-over border-primary' : 'border-gray-300 hover:border-primary'}`}
              style={{ minHeight: 140 }}
            >
              {previewSrc
                ? <img src={previewSrc} alt="Preview" className="w-full max-h-56 object-cover" />
                : (
                  <div className="flex flex-col items-center justify-center gap-1 py-10 text-gray-400">
                    <i className="fas fa-image text-4xl"></i>
                    <p className="text-sm">Clique ou arraste uma imagem aqui</p>
                    <span className="text-xs">JPG, PNG, WebP — máx. 10 MB</span>
                  </div>
                )
              }
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
                   onChange={e => pickFile(e.target.files[0])} />
            {uploading && (
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="progress-fill h-full" style={{ width: uploadPct + '%' }} />
                </div>
                <span className="text-xs text-text-light">{uploadPct}%</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-sm font-semibold text-text-dark">Título (opcional)</label>
              <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
                     placeholder="Ex: Castanha de Caju" className={inputCls} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-text-dark">Ordem</label>
              <input type="number" value={ordem} onChange={e => setOrdem(e.target.value)}
                     min="0" step="1" placeholder="0" className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="sr-only" />
            <span className="toggle-switch"></span>
            <span className="text-sm text-text-dark">Imagem ativa no slider</span>
          </label>
          {erro && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm" role="alert">{erro}</div>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
                    className="px-5 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-semibold text-text-dark hover:border-primary hover:text-primary transition-colors cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={saving || uploading}
                    className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-dark-brown transition-colors disabled:opacity-60 cursor-pointer flex items-center gap-2">
              <i className="fas fa-save"></i>
              {saving ? 'Salvando…' : 'Salvar Imagem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Modal Confirmar Exclusão ── */
function ModalConfirmar({ titulo, onConfirm, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-text-dark">Confirmar Exclusão</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-1">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        <div className="px-5 py-5 text-center">
          <i className="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-3 block"></i>
          <p className="text-text-dark mb-1">Tem certeza que deseja excluir <strong>{titulo}</strong>?</p>
          <p className="text-sm text-gray-400">Esta ação não pode ser desfeita.</p>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose}
                  className="flex-1 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-semibold text-text-dark hover:border-primary hover:text-primary transition-colors cursor-pointer">
            Cancelar
          </button>
          <button onClick={onConfirm}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors cursor-pointer flex items-center justify-center gap-2">
            <i className="fas fa-trash"></i> Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Seção Criar Pedido (sem banco de dados) ── */
function SecaoPedido({ produtos }) {
  const [cliente,    setCliente]    = useState('')
  const [cnpj,       setCnpj]       = useState('')
  const [obs,        setObs]        = useState('')
  const [itens,      setItens]      = useState([])
  const [prodSel,    setProdSel]    = useState('')
  const [qtdSel,     setQtdSel]     = useState(1)
  const [precoSel,   setPrecoSel]   = useState('')
  const [gerando,    setGerando]    = useState(false)
  const [concluido,  setConcluido]  = useState(false)
  const [perguntaPDF, setPerguntaPDF] = useState(false)

  const ativos = produtos.filter(p => p.ativo !== false)
  const total  = itens.reduce((acc, it) => acc + it.quantidade * it.precoUnitario, 0)

  function handleSelectProduto(id) {
    setProdSel(id)
    const p = ativos.find(p => p.id === id)
    if (p) setPrecoSel(p.precoAtacado != null ? p.precoAtacado : p.preco ?? '')
    else   setPrecoSel('')
  }

  function adicionarItem() {
    if (!prodSel || !qtdSel || precoSel === '') return
    const p = ativos.find(p => p.id === prodSel)
    if (!p) return
    const idx = itens.findIndex(i => i.produtoId === prodSel)
    if (idx !== -1) {
      setItens(prev => prev.map((it, i) =>
        i === idx ? { ...it, quantidade: it.quantidade + Number(qtdSel), precoUnitario: Number(precoSel) } : it
      ))
    } else {
      setItens(prev => [...prev, {
        produtoId: prodSel, nome: p.nome, imagem: p.imagem,
        quantidade: Number(qtdSel), precoUnitario: Number(precoSel),
      }])
    }
    setProdSel(''); setQtdSel(1); setPrecoSel('')
  }

  function removerItem(idx) { setItens(prev => prev.filter((_, i) => i !== idx)) }

  function atualizarItem(idx, campo, valor) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: Number(valor) } : it))
  }

  function limparFormulario() {
    setCliente(''); setCnpj(''); setObs(''); setItens([])
    setProdSel(''); setQtdSel(1); setPrecoSel('')
    setConcluido(false); setPerguntaPDF(false)
  }

  function enviarWhatsApp() {
    if (!cliente.trim() || itens.length === 0) return

    const linhas = itens.map(it =>
      `• ${it.nome} ×${it.quantidade} — R$ ${(it.quantidade * it.precoUnitario).toFixed(2).replace('.', ',')}`
    ).join('\n')

    const partes = [
      '🛍️ *NOVO PEDIDO*',
      '',
      `👤 *Cliente:* ${cliente.trim()}`,
      cnpj ? `📋 *CNPJ:* ${cnpj}` : null,
      '',
      '*Produtos:*',
      linhas,
      '',
      `💰 *Total: R$ ${total.toFixed(2).replace('.', ',')}*`,
      obs.trim() ? `\n📝 *Obs:* ${obs.trim()}` : null,
    ]

    const msg = partes.filter(l => l !== null).join('\n')
    window.open(`https://wa.me/${WA_NUMERO}?text=${encodeURIComponent(msg)}`, '_blank')
    setPerguntaPDF(true)
  }

  const inputCls = 'w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors bg-white'

  /* ── Tela de conclusão ── */
  if (concluido) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <i className="fas fa-check text-4xl text-green-600"></i>
        </div>
        <div>
          <p className="text-xl font-bold text-text-dark mb-1">Pedido enviado!</p>
          <p className="text-gray-400 text-sm">O WhatsApp foi aberto com o pedido formatado.</p>
        </div>
        <button onClick={limparFormulario}
                className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-dark-brown transition-colors cursor-pointer border-none">
          <i className="fas fa-plus"></i> Criar novo pedido
        </button>
      </div>
    )
  }

  /* ── Badge: imprimir pedido? ── */
  if (perguntaPDF) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 max-w-sm w-full text-center flex flex-col gap-5">
          <div className="w-16 h-16 rounded-full bg-whatsapp/10 flex items-center justify-center mx-auto">
            <i className="fab fa-whatsapp text-3xl text-whatsapp"></i>
          </div>
          <div>
            <p className="text-lg font-bold text-text-dark mb-1">Pedido enviado pelo WhatsApp!</p>
            <p className="text-sm text-gray-400">Deseja também imprimir o pedido em PDF?</p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={async () => {
                setGerando(true)
                try { gerarPedidoPDF({ cliente, cnpj, itens, total, obs }) }
                finally { setGerando(false) }
                setConcluido(true); setPerguntaPDF(false)
              }}
              disabled={gerando}
              className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-dark-brown transition-colors cursor-pointer border-none disabled:opacity-60"
            >
              <i className={`fas ${gerando ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`}></i>
              {gerando ? 'Gerando PDF…' : 'Sim, imprimir PDF'}
            </button>
            <button
              onClick={() => { setConcluido(true); setPerguntaPDF(false) }}
              className="px-6 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:border-primary hover:text-primary transition-colors cursor-pointer bg-transparent"
            >
              Não, obrigado
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl flex flex-col gap-5">

      {/* Cliente + CNPJ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
        <h3 className="font-bold text-text-dark flex items-center gap-2">
          <i className="fas fa-user text-primary"></i> Dados do Cliente
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-sm font-semibold text-text-dark">Cliente *</label>
            <input type="text" value={cliente} onChange={e => setCliente(e.target.value)}
                   placeholder="Nome ou empresa" className={inputCls} />
          </div>
          <div>
            <label className="block mb-1 text-sm font-semibold text-text-dark">CNPJ</label>
            <input type="text" value={cnpj}
                   onChange={e => setCnpj(formatCNPJ(e.target.value))}
                   placeholder="00.000.000/0000-00" maxLength={18} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Adicionar produto */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
        <h3 className="font-bold text-text-dark flex items-center gap-2">
          <i className="fas fa-box text-primary"></i> Produtos
        </h3>

        <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-600">Adicionar produto ao pedido</p>
          <select value={prodSel} onChange={e => handleSelectProduto(e.target.value)}
                  className={inputCls}>
            <option value="">Selecione um produto…</option>
            {ativos.map(p => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.precoAtacado != null
                  ? ` — Atacado: R$ ${Number(p.precoAtacado).toFixed(2).replace('.', ',')}`
                  : ` — Varejo: R$ ${Number(p.preco).toFixed(2).replace('.', ',')}`}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block mb-1 text-xs text-gray-500">Quantidade</label>
              <input type="number" value={qtdSel} onChange={e => setQtdSel(e.target.value)}
                     min="1" step="1" className={inputCls} />
            </div>
            <div>
              <label className="block mb-1 text-xs text-gray-500">Preço unit. (R$)</label>
              <input type="number" value={precoSel} onChange={e => setPrecoSel(e.target.value)}
                     min="0" step="0.01" placeholder="0.00" className={inputCls} />
            </div>
            <div className="flex items-end col-span-2 sm:col-span-1">
              <button type="button" onClick={adicionarItem}
                      disabled={!prodSel || !qtdSel || precoSel === ''}
                      className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-dark-brown transition-colors cursor-pointer border-none disabled:opacity-50 flex items-center justify-center gap-2">
                <i className="fas fa-plus"></i> Adicionar
              </button>
            </div>
          </div>
        </div>

        {/* Lista de itens */}
        {itens.length > 0 && (
          <div className="flex flex-col gap-2">
            {itens.map((it, idx) => (
              <div key={idx} className="flex items-center gap-3 border border-gray-100 rounded-xl p-3">
                {it.imagem && (
                  <img src={it.imagem} alt={it.nome}
                       className="w-10 h-10 object-cover rounded-lg shrink-0"
                       onError={e => { e.target.src = '/img/logocacto.svg' }} />
                )}
                <p className="flex-1 text-sm font-semibold text-text-dark min-w-0 truncate">{it.nome}</p>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 mb-1">Qtd</p>
                    <input type="number" value={it.quantidade} min="1"
                           onChange={e => atualizarItem(idx, 'quantidade', e.target.value)}
                           className="w-14 px-1 py-1 border-2 border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 mb-1">R$ unit.</p>
                    <input type="number" value={it.precoUnitario} min="0" step="0.01"
                           onChange={e => atualizarItem(idx, 'precoUnitario', e.target.value)}
                           className="w-20 px-1 py-1 border-2 border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 mb-1">Subtotal</p>
                    <p className="text-sm font-bold text-primary">
                      R$ {(it.quantidade * it.precoUnitario).toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <button type="button" onClick={() => removerItem(idx)}
                          className="text-red-400 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-none ml-1">
                    <i className="fas fa-trash text-sm"></i>
                  </button>
                </div>
              </div>
            ))}

            {/* Total */}
            <div className="flex justify-end mt-1">
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-5 py-3 flex items-center gap-4">
                <span className="text-text-light font-medium text-sm">Total</span>
                <span className="text-primary font-bold text-xl">
                  R$ {total.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Observações */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <label className="flex mb-2 text-sm font-semibold text-text-dark items-center gap-2">
          <i className="fas fa-comment-alt text-primary"></i> Observações
        </label>
        <textarea value={obs} onChange={e => setObs(e.target.value)}
                  rows={2} placeholder="Condições de entrega, prazo, etc."
                  className={'w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors resize-y'} />
      </div>

      {/* Ações */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={enviarWhatsApp}
          disabled={!cliente.trim() || itens.length === 0}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-whatsapp text-white px-6 py-3.5 rounded-xl font-semibold text-base hover:bg-whatsapp-dark transition-colors cursor-pointer border-none disabled:opacity-50 shadow"
        >
          <i className="fab fa-whatsapp text-xl"></i> Enviar via WhatsApp
        </button>
        <button
          onClick={async () => {
            if (!cliente.trim() || itens.length === 0) return
            setGerando(true)
            try { gerarPedidoPDF({ cliente, cnpj, itens, total, obs }) }
            finally { setGerando(false) }
          }}
          disabled={gerando || !cliente.trim() || itens.length === 0}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary text-white px-6 py-3.5 rounded-xl font-semibold text-base hover:bg-dark-brown transition-colors cursor-pointer border-none disabled:opacity-50 shadow"
        >
          <i className={`fas ${gerando ? 'fa-spinner fa-spin' : 'fa-file-pdf'} text-xl`}></i>
          {gerando ? 'Gerando…' : 'Imprimir PDF'}
        </button>
        <button
          onClick={limparFormulario}
          className="flex items-center justify-center gap-2 px-5 py-3.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:border-primary hover:text-primary transition-colors cursor-pointer bg-transparent"
        >
          <i className="fas fa-trash-alt"></i> Limpar
        </button>
      </div>

      {!cliente.trim() && itens.length > 0 && (
        <p className="text-xs text-red-500 -mt-2">Preencha o nome do cliente para enviar ou imprimir.</p>
      )}
    </div>
  )
}

/* ── Dashboard ── */
export default function Dashboard() {
  const [activeSection, setActiveSection] = useState('produtos')
  const [produtos,   setProdutos]   = useState([])
  const [slides,     setSlides]     = useState([])
  const [gerandoPDF, setGerandoPDF] = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [userEmail,  setUserEmail]  = useState('')

  const [modalProduto,   setModalProduto]   = useState(null)
  const [modalSlide,     setModalSlide]     = useState(null)
  const [modalConfirmar, setModalConfirmar] = useState(null)

  const [toast, setToast] = useState({ visible: false, msg: '', tipo: 'success' })
  const navigate = useNavigate()

  function showToast(msg, tipo = 'success') {
    setToast({ visible: true, msg, tipo })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500)
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { navigate('/admin', { replace: true }); return }
      setUserEmail(user.email)
      loadProdutos()
      loadSlides()
    })
    return unsub
  }, [navigate])

  async function loadProdutos() {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'produtos'), orderBy('criadoEm', 'desc')))
      setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch {
      try {
        const snap = await getDocs(collection(db, 'produtos'))
        setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch { showToast('Erro ao carregar produtos.', 'error') }
    } finally { setLoading(false) }
  }

  async function loadSlides() {
    try {
      const snap = await getDocs(query(collection(db, 'slider'), orderBy('ordem', 'asc')))
      setSlides(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch {
      try {
        const snap = await getDocs(collection(db, 'slider'))
        setSlides(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch { showToast('Erro ao carregar slider.', 'error') }
    }
  }

  function handleSavedProduto(produto) {
    setProdutos(prev => {
      const idx = prev.findIndex(p => p.id === produto.id)
      if (idx !== -1) { const next = [...prev]; next[idx] = produto; return next }
      return [produto, ...prev]
    })
    showToast(produto.criadoEm instanceof Date ? 'Produto adicionado!' : 'Produto atualizado!')
  }

  function handleSavedSlide(slide) {
    setSlides(prev => {
      const idx = prev.findIndex(s => s.id === slide.id)
      if (idx !== -1) { const next = [...prev]; next[idx] = slide; return next }
      return [...prev, slide].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    })
    showToast(slide.criadoEm instanceof Date ? 'Imagem adicionada!' : 'Imagem atualizada!')
  }

  async function handleExcluir() {
    const { id, titulo, colecao } = modalConfirmar
    setModalConfirmar(null)
    try {
      await deleteDoc(doc(db, colecao, id))
      if      (colecao === 'produtos') setProdutos(prev => prev.filter(p => p.id !== id))
      else if (colecao === 'slider')   setSlides(prev => prev.filter(s => s.id !== id))
      showToast('Item excluído.')
    } catch { showToast('Erro ao excluir.', 'error') }
  }

  const badgeGold  = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800'
  const badgeGreen = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800'
  const badgeRed   = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700'

  const navItems = [
    { id: 'produtos', icon: 'fa-box',      label: 'Produtos' },
    { id: 'pedidos',  icon: 'fa-file-alt', label: 'Pedidos'  },
    { id: 'slider',   icon: 'fa-images',   label: 'Slider'   },
  ]

  function sair() { signOut(auth).then(() => navigate('/admin', { replace: true })) }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-dark-brown text-white px-4 py-3 flex items-center justify-between shadow-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <img src="/img/logocangaco.svg" alt="Cangaço" className="h-8" />
          <span className="font-semibold text-sm hidden sm:block">Painel Administrativo</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60 hidden lg:block truncate max-w-50">{userEmail}</span>
          <Link to="/" target="_blank" rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs transition-colors text-white">
            <i className="fas fa-external-link-alt text-xs"></i> Ver Site
          </Link>
          <button onClick={sair}
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer border-none text-white">
            <i className="fas fa-sign-out-alt text-xs"></i>
            <span className="hidden sm:inline text-xs">Sair</span>
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar — desktop */}
        <aside className="hidden md:flex flex-col w-52 bg-white shadow-md min-h-[calc(100vh-56px)] shrink-0">
          <nav className="py-4">
            {navItems.map(item => (
              <button key={item.id} onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center gap-3 px-5 py-3 transition-colors cursor-pointer border-none bg-transparent text-left ${activeSection === item.id ? 'text-primary font-semibold bg-orange-50 border-r-4 border-primary' : 'text-text-dark hover:text-primary hover:bg-gray-50'}`}>
                <i className={`fas ${item.icon} w-5 text-center`}></i>
                <span>{item.label}</span>
              </button>
            ))}
            <Link to="/" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 px-5 py-3 text-text-dark hover:text-primary hover:bg-gray-50 transition-colors">
              <i className="fas fa-external-link-alt w-5 text-center"></i>
              <span>Ver Site</span>
            </Link>
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 p-4 md:p-6 min-w-0 pb-24 md:pb-6">

          {/* ── Produtos ── */}
          {activeSection === 'produtos' && (
            <>
              <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-text-dark">Produtos</h2>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setGerandoPDF(true)
                      try { await gerarCatalogoPDF(produtos.filter(p => p.ativo !== false)) }
                      finally { setGerandoPDF(false) }
                    }}
                    disabled={gerandoPDF || produtos.length === 0}
                    className="flex items-center gap-2 bg-white border-2 border-primary text-primary px-3 py-2 rounded-lg font-semibold text-sm hover:bg-primary hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <i className={`fas ${gerandoPDF ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`}></i>
                    <span className="hidden sm:inline">{gerandoPDF ? 'Gerando…' : 'Catálogo PDF'}</span>
                  </button>
                  <button onClick={() => setModalProduto({})}
                          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-dark-brown transition-colors cursor-pointer border-none">
                    <i className="fas fa-plus"></i>
                    <span className="hidden sm:inline">Novo Produto</span>
                    <span className="sm:hidden">Novo</span>
                  </button>
                </div>
              </div>

              {loading && (
                <div className="flex flex-col items-center justify-center py-20 text-primary gap-3">
                  <i className="fas fa-spinner fa-spin text-4xl"></i>
                  <p>Carregando produtos...</p>
                </div>
              )}

              {!loading && produtos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                  <i className="fas fa-box-open text-5xl"></i>
                  <p>Nenhum produto cadastrado.</p>
                  <button onClick={() => setModalProduto({})}
                          className="bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-dark-brown transition-colors cursor-pointer border-none">
                    Adicionar primeiro produto
                  </button>
                </div>
              )}

              {!loading && produtos.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {produtos.map(p => {
                    const precoVar = Number(p.preco).toFixed(2).replace('.', ',')
                    const precoAt  = p.precoAtacado != null ? Number(p.precoAtacado).toFixed(2).replace('.', ',') : null
                    const img      = p.imagem || '/img/logocacto.svg'
                    return (
                      <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                        <div className="relative h-36 bg-gray-50 shrink-0">
                          <img src={img} alt={p.nome}
                               className="w-full h-full object-cover"
                               onError={e => { e.target.src = '/img/logocacto.svg' }} />
                          <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                            {p.destaque && <span className={badgeGold}><i className="fas fa-star text-[10px]"></i>Destaque</span>}
                            {p.ativo !== false
                              ? <span className={badgeGreen}>Ativo</span>
                              : <span className={badgeRed}>Inativo</span>}
                          </div>
                        </div>
                        <div className="p-4 flex flex-col gap-3 flex-1">
                          <div>
                            <p className="font-bold text-text-dark text-sm leading-snug">{p.nome}</p>
                            {p.descricao && (
                              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.descricao}</p>
                            )}
                          </div>
                          <div className="flex gap-4 flex-wrap">
                            <div>
                              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Varejo</p>
                              <p className="text-primary font-bold text-sm">R$ {precoVar}</p>
                            </div>
                            {precoAt && (
                              <div>
                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Atacado (ADM)</p>
                                <p className="text-green-700 font-bold text-sm">R$ {precoAt}</p>
                              </div>
                            )}
                          </div>
                          {p.atacado?.length > 0 && (
                            <p className="text-xs text-gray-400">
                              {p.atacado.length} faixa{p.atacado.length > 1 ? 's' : ''} de atacado no site
                            </p>
                          )}
                          <div className="flex gap-2 mt-auto pt-3 border-t border-gray-50">
                            <button onClick={() => setModalProduto(p)}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm font-semibold transition-colors cursor-pointer border-none">
                              <i className="fas fa-edit"></i> Editar
                            </button>
                            <button onClick={() => setModalConfirmar({ id: p.id, titulo: p.nome, colecao: 'produtos' })}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 text-sm font-semibold transition-colors cursor-pointer border-none">
                              <i className="fas fa-trash"></i> Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Criar Pedido ── */}
          {activeSection === 'pedidos' && (
            <>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-text-dark">Criar Pedido</h2>
                <p className="text-sm text-gray-400 mt-0.5">Monte o pedido e envie direto pelo WhatsApp</p>
              </div>
              {produtos.length === 0 && !loading
                ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                    <i className="fas fa-box-open text-5xl"></i>
                    <p>Cadastre produtos antes de criar um pedido.</p>
                    <button onClick={() => setActiveSection('produtos')}
                            className="bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-dark-brown transition-colors cursor-pointer border-none">
                      Ir para Produtos
                    </button>
                  </div>
                )
                : <SecaoPedido produtos={produtos} />
              }
            </>
          )}

          {/* ── Slider ── */}
          {activeSection === 'slider' && (
            <>
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-bold text-text-dark">Slider</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Imagens exibidas na seção "Sobre Nós" da página inicial</p>
                </div>
                <button onClick={() => setModalSlide({})}
                        className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-dark-brown transition-colors cursor-pointer border-none">
                  <i className="fas fa-plus"></i> Nova Imagem
                </button>
              </div>

              {slides.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                  <i className="fas fa-images text-5xl"></i>
                  <p>Nenhuma imagem no slider.</p>
                  <button onClick={() => setModalSlide({})}
                          className="bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-dark-brown transition-colors cursor-pointer border-none">
                    Adicionar primeira imagem
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {slides.map(s => (
                    <div key={s.id} className="bg-white rounded-2xl shadow overflow-hidden">
                      <div className="relative">
                        <img src={s.imagem} alt={s.titulo || 'Slide'}
                             className="w-full h-44 object-cover"
                             onError={e => { e.target.src = '/img/logocacto.svg' }} />
                        <div className="absolute top-2 right-2">
                          {s.ativo !== false
                            ? <span className={badgeGreen + ' shadow'}>Ativo</span>
                            : <span className={badgeRed   + ' shadow'}>Inativo</span>}
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-text-dark font-semibold text-sm truncate mb-0.5">
                          {s.titulo || <span className="text-gray-400 italic">Sem título</span>}
                        </p>
                        <p className="text-xs text-gray-400 mb-3">Ordem: {s.ordem ?? 0}</p>
                        <div className="flex gap-2">
                          <button onClick={() => setModalSlide(s)}
                                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm font-semibold transition-colors cursor-pointer border-none">
                            <i className="fas fa-edit text-xs"></i> Editar
                          </button>
                          <button onClick={() => setModalConfirmar({ id: s.id, titulo: s.titulo || 'esta imagem', colecao: 'slider' })}
                                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 text-sm font-semibold transition-colors cursor-pointer border-none">
                            <i className="fas fa-trash text-xs"></i> Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Bottom nav — mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex md:hidden z-40 shadow-lg">
        {navItems.map(item => (
          <button key={item.id} onClick={() => setActiveSection(item.id)}
                  className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors cursor-pointer border-none ${activeSection === item.id ? 'text-primary bg-orange-50/60' : 'text-gray-500 bg-transparent'}`}>
            <i className={`fas ${item.icon} text-xl`}></i>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
        <button onClick={sair}
                className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-500 bg-transparent border-none cursor-pointer">
          <i className="fas fa-sign-out-alt text-xl"></i>
          <span className="text-[10px] font-medium">Sair</span>
        </button>
      </nav>

      {/* Modais */}
      {modalProduto !== null && (
        <ModalProduto
          produto={modalProduto?.id ? modalProduto : null}
          onClose={() => setModalProduto(null)}
          onSaved={handleSavedProduto}
        />
      )}
      {modalSlide !== null && (
        <ModalSlide
          slide={modalSlide?.id ? modalSlide : null}
          onClose={() => setModalSlide(null)}
          onSaved={handleSavedSlide}
        />
      )}
      {modalConfirmar && (
        <ModalConfirmar
          titulo={modalConfirmar.titulo}
          onConfirm={handleExcluir}
          onClose={() => setModalConfirmar(null)}
        />
      )}

      <Toast msg={toast.msg} tipo={toast.tipo} visible={toast.visible} />
    </div>
  )
}
