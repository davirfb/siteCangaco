import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { gerarCatalogoPDF } from '../../utils/gerarPDF.js'
import { visivelNoSite } from '../../utils/produtos.js'
import { useRascunho, limparRascunhos } from '../../hooks/useRascunho.js'
import { api, avisarManutencao } from '../../lib/api.js'
import { limparCacheDados } from '../../lib/dados.js'
import SecaoClientes from './Clientes.jsx'
import SecaoCriarPedido from './CriarPedido.jsx'
import SecaoPedidos from './Pedidos.jsx'
import SecaoInicio from './Inicio.jsx'
import StatusConexao from './StatusConexao.jsx'
import BotaoNotificacoes from './BotaoNotificacoes.jsx'
import VinculoBling from './VinculoBling.jsx'
import { auth, db } from '../../lib/firebase.js'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp,
} from 'firebase/firestore'

const CLOUD      = 'dykq5hssj'
const PRESET     = 'cangaco_produtos'

function compressImage(file, maxPx = 1920, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx }
        else                 { width  = Math.round(width  * maxPx / height); height = maxPx }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', quality)
    }
    img.src = url
  })
}

async function uploadToCloudinary(file, onProgress) {
  const compressed = await compressImage(file)
  const fd = new FormData()
  fd.append('file', compressed)
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
/* ── Editor de faixas de atacado ── */
function FaixasEditor({ atacado, setAtacado, preco, inputCls }) {
  return (
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
  )
}

function normalizarFaixas(atacado) {
  return atacado
    .filter(t => t.qtdMinima && t.preco)
    .map(t => ({ qtdMinima: parseInt(t.qtdMinima), preco: parseFloat(t.preco) }))
    .sort((a, b) => a.qtdMinima - b.qtdMinima)
}

/* ── Modal Produto no Site (preço varejo + faixas) ── */
function ModalProdutoSite({ produto, onClose, onSaved }) {
  const r = campo => `rascunho:site:${produto.id}:${campo}`
  const [preco,   setPreco]   = useRascunho(r('preco'), produto.preco ?? '')
  const [atacado, setAtacado] = useRascunho(r('atacado'), produto.atacado?.length ? produto.atacado : [])
  const [erro,    setErro]    = useState('')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setSaving(true)
    try {
      const dados = {
        preco:   parseFloat(preco),
        atacado: normalizarFaixas(atacado),
        atualizadoEm: serverTimestamp(),
        ...(parseFloat(preco) !== Number(produto.preco) && { precoAtualizadoEm: serverTimestamp() }),
      }
      await updateDoc(doc(db, 'produtos', produto.id), dados)
      onSaved({ ...produto, ...dados })
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
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-text-dark">Produto no Site</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-1">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <img src={produto.imagem || '/img/logocacto.svg'} alt={produto.nome}
                 className="w-16 h-16 rounded-lg object-cover shrink-0"
                 onError={e => { e.target.src = '/img/logocacto.svg' }} />
            <p className="font-bold text-text-dark text-sm">{produto.nome}</p>
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold text-text-dark">Preço Varejo (R$) *</label>
            <input type="number" value={preco} onChange={e => setPreco(e.target.value)}
                   required step="0.01" min="0" placeholder="25.90" className={inputCls} />
          </div>

          <div className="relative flex items-center my-1">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-3 text-xs text-gray-400 bg-white">Faixas de Atacado (opcional)</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          <FaixasEditor atacado={atacado} setAtacado={setAtacado} preco={preco} inputCls={inputCls} />

          <p className="text-xs text-gray-400">Essas alterações também valem no Catálogo.</p>

          {erro && (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm" role="alert">{erro}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
                    className="px-5 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-semibold text-text-dark hover:border-primary hover:text-primary transition-colors cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
                    className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-dark-brown transition-colors disabled:opacity-60 cursor-pointer flex items-center gap-2">
              <i className="fas fa-save"></i>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Modal Produto (Catálogo) ── */
function ModalProduto({ produto, onClose, onSaved }) {
  const r = campo => `rascunho:produto:${produto?.id ?? 'novo'}:${campo}`
  const [nome,         setNome]        = useRascunho(r('nome'),         produto?.nome         ?? '')
  const [preco,        setPreco]       = useRascunho(r('preco'),        produto?.preco        ?? '')
  const [precoAtacado, setPrecoAtacado]= useRascunho(r('precoAtacado'), produto?.precoAtacado ?? '')
  const [qtdFardo,     setQtdFardo]    = useRascunho(r('qtdFardo'),     produto?.qtdFardo     ?? '')
  const [descricao,    setDescricao]   = useRascunho(r('descricao'),    produto?.descricao    ?? '')
  const [destaque,     setDestaque]    = useRascunho(r('destaque'),     produto?.destaque     ?? false)
  const [ativo,        setAtivo]       = useRascunho(r('ativo'),        produto?.ativo !== false)
  const [atacado,      setAtacado]     = useRascunho(r('atacado'),
    produto?.atacado?.length ? produto.atacado : []
  )
  const [blingProduto, setBlingProduto] = useRascunho(r('blingProduto'),
    produto?.blingProdutoId ? { id: produto.blingProdutoId, nome: produto.blingProdutoNome ?? '' } : null
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
        qtdFardo:     parseInt(qtdFardo) > 1 ? parseInt(qtdFardo) : null,
        imagem:       imagemUrl,
        destaque,
        ativo,
        blingProdutoId:   blingProduto?.id ?? null,
        blingProdutoNome: blingProduto?.nome ?? null,
        atacado: normalizarFaixas(atacado),
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
        dados.exibirNoSite = false
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
            <label className="block mb-1 text-sm font-semibold text-text-dark">
              Unidades por fardo
              <span className="ml-1 text-[11px] font-normal text-gray-400">opcional — vira atalho de quantidade nos pedidos</span>
            </label>
            <input type="number" value={qtdFardo} onChange={e => setQtdFardo(e.target.value)}
                   step="1" min="2" placeholder="Ex: 12" className={inputCls} />
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold text-text-dark">Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
                      rows={3} placeholder="Descrição do produto..."
                      className={inputCls + ' resize-y'} />
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold text-text-dark">
              Produto no Bling
              <span className="ml-1 text-[11px] font-normal text-gray-400">necessário para criar pedidos e notas</span>
            </label>
            <VinculoBling valor={blingProduto} onChange={setBlingProduto} inputCls={inputCls} />
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
                    <span className="text-xs">JPG, PNG, WebP — comprimido automaticamente</span>
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
            <span className="px-3 text-xs text-gray-400 bg-white">Faixas de Atacado (opcional)</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          <FaixasEditor atacado={atacado} setAtacado={setAtacado} preco={preco} inputCls={inputCls} />

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
  const r = campo => `rascunho:slide:${slide?.id ?? 'novo'}:${campo}`
  const [titulo,     setTitulo]    = useRascunho(r('titulo'), slide?.titulo  ?? '')
  const [ordem,      setOrdem]     = useRascunho(r('ordem'),  slide?.ordem   ?? 0)
  const [ativo,      setAtivo]     = useRascunho(r('ativo'),  slide?.ativo !== false)
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
                    <span className="text-xs">JPG, PNG, WebP — comprimido automaticamente</span>
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

/* ── Seção Bling (conexão com a API) ── */
function SecaoBling({ showToast }) {
  const [status,   setStatus]   = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [acao,     setAcao]     = useState(false)

  async function carregar() {
    setCarregando(true)
    try { setStatus(await api('/bling/status')) }
    catch (err) { setStatus({ conectado: false, erro: err.message }) }
    finally { setCarregando(false) }
  }

  useEffect(() => { carregar() }, [])

  async function conectar() {
    setAcao(true)
    try {
      const { url } = await api('/bling/conectar', { method: 'POST' })
      window.location.href = url
    } catch (err) {
      showToast(err.message, 'error')
      setAcao(false)
    }
  }

  async function desconectar() {
    if (!window.confirm('Desconectar o Bling? O sistema deixa de acessar pedidos, clientes e notas até conectar de novo.')) return
    setAcao(true)
    try {
      await api('/bling/desconectar', { method: 'POST' })
      showToast('Bling desconectado.')
      await carregar()
    } catch (err) { showToast(err.message, 'error') }
    finally { setAcao(false) }
  }

  const fmtData = ms => ms ? new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
  const temConexao = status?.conectadoPor || status?.conectado

  return (
    <>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-text-dark">Bling</h2>
        <p className="text-sm text-gray-400 mt-0.5">Conexão com o Bling para pedidos, clientes e notas fiscais</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 max-w-xl">
        {carregando ? (
          <div className="flex items-center gap-3 text-primary">
            <i className="fas fa-spinner fa-spin"></i> Verificando conexão...
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className={`w-3 h-3 rounded-full ${status?.conectado ? 'bg-green-500' : temConexao ? 'bg-yellow-500' : 'bg-gray-300'}`}></span>
              <p className="font-semibold text-text-dark">
                {status?.conectado ? 'Conectado' : temConexao ? 'Conexão com problema' : 'Não conectado'}
              </p>
            </div>

            {status?.conectado && (
              <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 mb-5">
                <dt className="text-gray-400">Empresa</dt>          <dd className="text-text-dark">{status.empresa || '—'}</dd>
                <dt className="text-gray-400">Conectado por</dt>    <dd className="text-text-dark break-all">{status.conectadoPor || '—'}</dd>
                <dt className="text-gray-400">Conectado em</dt>     <dd className="text-text-dark">{fmtData(status.conectadoEm)}</dd>
                <dt className="text-gray-400">Renovação válida até</dt><dd className="text-text-dark">{fmtData(status.refreshExpiraEm)}</dd>
              </dl>
            )}

            {status?.erro && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm mb-5" role="alert">
                {status.erro}
              </div>
            )}

            {!status?.conectado && (
              <p className="text-sm text-gray-500 mb-5">
                Clique em conectar, entre com a conta do Bling da Cangaço e autorize o aplicativo <strong>Site Cangaço</strong>.
                Isso só precisa ser feito uma vez.
              </p>
            )}

            <div className="flex gap-2 flex-wrap">
              <button onClick={conectar} disabled={acao}
                      className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-dark-brown transition-colors cursor-pointer border-none disabled:opacity-60">
                <i className="fas fa-plug"></i> {temConexao ? 'Reconectar' : 'Conectar ao Bling'}
              </button>
              {temConexao && (
                <>
                  <button onClick={carregar} disabled={acao}
                          className="flex items-center gap-2 bg-white border-2 border-gray-200 text-text-dark px-4 py-2 rounded-lg font-semibold text-sm hover:border-primary hover:text-primary transition-colors cursor-pointer disabled:opacity-60">
                    <i className="fas fa-sync-alt"></i> Testar conexão
                  </button>
                  <button onClick={desconectar} disabled={acao}
                          className="flex items-center gap-2 bg-red-50 text-red-500 px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-red-100 transition-colors cursor-pointer border-none disabled:opacity-60">
                    <i className="fas fa-unlink"></i> Desconectar
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

/* ── Dashboard ── */
export default function Dashboard() {
  const [activeSection, setActiveSection] = useRascunho('admin:secao', 'inicio')
  const [produtos,   setProdutos]   = useState([])
  const [slides,     setSlides]     = useState([])
  const [gerandoPDF, setGerandoPDF] = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [userEmail,  setUserEmail]  = useState('')

  const [modalProduto,   setModalProduto]   = useRascunho('admin:modalProduto', null)
  const [modalSlide,     setModalSlide]     = useRascunho('admin:modalSlide', null)
  const [modalProdSite,  setModalProdSite]  = useRascunho('admin:modalProdSite', null)
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

  // Manifesto próprio do painel: ao "instalar" no celular, o app abre direto no painel
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]')
    if (!link) return
    const anterior = link.getAttribute('href')
    link.setAttribute('href', '/admin.webmanifest')
    return () => link.setAttribute('href', anterior)
  }, [])

  // Volta da autorização do Bling (/api/bling/callback → ?bling=conectado|erro)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const resultado = params.get('bling')
    if (!resultado) return
    setActiveSection('bling')
    if (resultado === 'conectado') showToast('Bling conectado com sucesso!')
    else showToast(params.get('msg') || 'Erro ao conectar com o Bling.', 'error')
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  // Cota do Firestore esgotada → faixa de manutenção; demais erros → aviso comum
  function avisoFalha(err, msg) {
    if (err?.code === 'resource-exhausted' || err?.code === 'unavailable') {
      if (navigator.onLine) avisarManutencao(true)
    } else showToast(msg, 'error')
  }

  async function loadProdutos() {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'produtos'), orderBy('criadoEm', 'desc')))
      setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch {
      try {
        const snap = await getDocs(collection(db, 'produtos'))
        setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) { avisoFalha(err, 'Erro ao carregar produtos.') }
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
      } catch (err) { avisoFalha(err, 'Erro ao carregar slider.') }
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
  const badgeBlue  = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700'

  // Modais guardam só o id (ou 'novo'), para reabrirem ao recarregar a página
  const produtoEditando = produtos.find(p => p.id === modalProduto)
  const produtoNoSite   = produtos.find(p => p.id === modalProdSite)
  const slideEditando   = slides.find(s => s.id === modalSlide)

  async function toggleNoSite(p) {
    const exibirNoSite = !visivelNoSite(p)
    try {
      await updateDoc(doc(db, 'produtos', p.id), { exibirNoSite })
      setProdutos(prev => prev.map(x => x.id === p.id ? { ...x, exibirNoSite } : x))
      showToast(exibirNoSite ? 'Produto exibido no site.' : 'Produto removido do site.')
    } catch { showToast('Erro ao atualizar o site.', 'error') }
  }

  const navItems = [
    { id: 'inicio',   icon: 'fa-home',     label: 'Início' },
    { id: 'listaPedidos', icon: 'fa-clipboard-list', label: 'Pedidos' },
    { id: 'pedidos',  icon: 'fa-cart-plus', label: 'Criar Pedido' },
    { id: 'catalogo', icon: 'fa-box',      label: 'Catálogo' },
    { id: 'clientes', icon: 'fa-users',    label: 'Clientes' },
    { id: 'site',     icon: 'fa-globe',    label: 'Site'     },
    { id: 'bling',    icon: 'fa-plug',     label: 'Bling'    },
  ]
  // No celular: estes ficam na barra de baixo; o resto vai para o menu ☰
  const navPrincipais = ['inicio', 'listaPedidos', 'pedidos']
  const [menuAberto, setMenuAberto] = useState(false)

  function sair() { limparCacheDados(); signOut(auth).then(() => navigate('/admin', { replace: true })) }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-dark-brown text-white px-4 py-3 flex items-center justify-between shadow-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <img src="/img/logocangaco.svg" alt="Cangaço" className="h-8" />
          <span className="font-semibold text-sm hidden sm:block">Painel Administrativo</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusConexao showToast={showToast} irPara={setActiveSection} />
          <BotaoNotificacoes showToast={showToast} />
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

          {/* ── Catálogo ── */}
          {activeSection === 'catalogo' && (
            <>
              <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-text-dark">Catálogo</h2>
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
                  <button onClick={() => setModalProduto('novo')}
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
                  <button onClick={() => setModalProduto('novo')}
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
                            {visivelNoSite(p) && <span className={badgeBlue}><i className="fas fa-globe text-[10px]"></i>No site</span>}
                            {p.blingProdutoId
                              ? <span className={badgeGreen}><i className="fas fa-link text-[10px] mr-1"></i>Bling</span>
                              : <span className={badgeRed}><i className="fas fa-unlink text-[10px] mr-1"></i>Sem Bling</span>}
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
                            {p.qtdFardo > 1 && (
                              <div>
                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Fardo</p>
                                <p className="text-text-dark font-bold text-sm">{p.qtdFardo} un</p>
                              </div>
                            )}
                          </div>
                          {p.atacado?.length > 0 && (
                            <p className="text-xs text-gray-400">
                              {p.atacado.length} faixa{p.atacado.length > 1 ? 's' : ''} de atacado no site
                            </p>
                          )}
                          <div className="flex gap-2 mt-auto pt-3 border-t border-gray-50">
                            <button onClick={() => setModalProduto(p.id)}
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
                <p className="text-sm text-gray-400 mt-0.5">Monte o pedido: salve como orçamento ou crie direto no Bling</p>
              </div>
              {produtos.length === 0 && !loading
                ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                    <i className="fas fa-box-open text-5xl"></i>
                    <p>Cadastre produtos antes de criar um pedido.</p>
                    <button onClick={() => setActiveSection('catalogo')}
                            className="bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-dark-brown transition-colors cursor-pointer border-none">
                      Ir para Catálogo
                    </button>
                  </div>
                )
                : <SecaoCriarPedido produtos={produtos} showToast={showToast} />
              }
            </>
          )}

          {/* ── Início ── */}
          {activeSection === 'inicio' && <SecaoInicio showToast={showToast} irPara={setActiveSection} />}

          {/* ── Pedidos (lista) ── */}
          {activeSection === 'listaPedidos' && <SecaoPedidos showToast={showToast} irPara={setActiveSection} produtos={produtos} />}

          {/* ── Clientes ── */}
          {activeSection === 'clientes' && <SecaoClientes showToast={showToast} />}

          {/* ── Bling ── */}
          {activeSection === 'bling' && <SecaoBling showToast={showToast} />}

          {/* ── Site ── */}
          {activeSection === 'site' && (
            <>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-text-dark">Site</h2>
                <p className="text-sm text-gray-400 mt-0.5">Configurações do site público</p>
              </div>

              {/* Produtos no site */}
              <div className="mb-4">
                <h3 className="text-lg font-bold text-text-dark">Produtos no Site</h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  Escolha quais produtos do Catálogo aparecem no site ({produtos.filter(visivelNoSite).length} de {produtos.length})
                </p>
              </div>

              {!loading && produtos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
                  <i className="fas fa-box-open text-4xl"></i>
                  <p>Cadastre produtos no Catálogo primeiro.</p>
                </div>
              )}

              {produtos.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100 mb-10">
                  {produtos.map(p => {
                    const inativo  = p.ativo === false
                    const noSite   = visivelNoSite(p)
                    const precoVar = Number(p.preco).toFixed(2).replace('.', ',')
                    return (
                      <div key={p.id} className={`flex items-center gap-3 p-3 sm:p-4 ${inativo ? 'opacity-50' : ''}`}>
                        <img src={p.imagem || '/img/logocacto.svg'} alt={p.nome}
                             className="w-14 h-14 rounded-lg object-cover shrink-0"
                             onError={e => { e.target.src = '/img/logocacto.svg' }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-text-dark text-sm truncate">{p.nome}</p>
                          <p className="text-primary font-bold text-sm">R$ {precoVar}</p>
                          <p className="text-xs text-gray-400">
                            {inativo
                              ? 'Inativo no Catálogo'
                              : p.atacado?.length > 0
                                ? `${p.atacado.length} faixa${p.atacado.length > 1 ? 's' : ''} de atacado`
                                : 'Sem faixas de atacado'}
                          </p>
                        </div>
                        <button onClick={() => setModalProdSite(p.id)} disabled={inativo}
                                title="Editar preço e faixas"
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold transition-colors cursor-pointer border-none disabled:cursor-not-allowed">
                          <i className="fas fa-edit"></i>
                          <span className="hidden sm:inline">Preço e faixas</span>
                        </button>
                        <label className={`flex items-center gap-2 select-none ${inativo ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                               title={inativo ? 'Ative o produto no Catálogo para exibir no site' : ''}>
                          <input type="checkbox" checked={noSite} disabled={inativo}
                                 onChange={() => toggleNoSite(p)} className="sr-only" />
                          <span className="toggle-switch"></span>
                          <span className="text-xs text-text-dark hidden sm:inline w-14">{noSite ? 'No site' : 'Oculto'}</span>
                        </label>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Slider */}
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-bold text-text-dark">Slider</h3>
                  <p className="text-sm text-gray-400 mt-0.5">Imagens exibidas na seção "Sobre Nós" da página inicial</p>
                </div>
                <button onClick={() => setModalSlide('novo')}
                        className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-dark-brown transition-colors cursor-pointer border-none">
                  <i className="fas fa-plus"></i> Nova Imagem
                </button>
              </div>

              {slides.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                  <i className="fas fa-images text-5xl"></i>
                  <p>Nenhuma imagem no slider.</p>
                  <button onClick={() => setModalSlide('novo')}
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
                          <button onClick={() => setModalSlide(s.id)}
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
        {navItems.filter(item => navPrincipais.includes(item.id)).map(item => (
          <button key={item.id} onClick={() => { setActiveSection(item.id); setMenuAberto(false) }}
                  className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors cursor-pointer border-none ${activeSection === item.id ? 'text-primary bg-orange-50/60' : 'text-gray-500 bg-transparent'}`}>
            <i className={`fas ${item.icon} text-xl`}></i>
            <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
          </button>
        ))}
        <button onClick={() => setMenuAberto(a => !a)}
                className={`flex-1 flex flex-col items-center py-3 gap-1 transition-colors cursor-pointer border-none ${menuAberto || !navPrincipais.includes(activeSection) ? 'text-primary bg-orange-50/60' : 'text-gray-500 bg-transparent'}`}>
          <i className={`fas ${menuAberto ? 'fa-times' : 'fa-bars'} text-xl`}></i>
          <span className="text-[10px] font-medium">Menu</span>
        </button>
      </nav>

      {/* Menu ☰ — mobile */}
      {menuAberto && (
        <div className="fixed inset-0 z-30 md:hidden bg-black/40" onClick={() => setMenuAberto(false)}>
          <div className="absolute right-2 bottom-[72px] w-56 bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {navItems.filter(item => !navPrincipais.includes(item.id)).map(item => (
              <button key={item.id} onClick={() => { setActiveSection(item.id); setMenuAberto(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer border-none border-b border-gray-100 ${activeSection === item.id ? 'text-primary bg-orange-50 font-semibold' : 'text-text-dark bg-white'}`}>
                <i className={`fas ${item.icon} w-5 text-center`}></i>{item.label}
              </button>
            ))}
            <button onClick={sair} className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer border-none bg-white text-red-500">
              <i className="fas fa-sign-out-alt w-5 text-center"></i>Sair
            </button>
          </div>
        </div>
      )}

      {/* Modais */}
      {(modalProduto === 'novo' || produtoEditando) && (
        <ModalProduto
          produto={produtoEditando ?? null}
          onClose={() => { limparRascunhos('rascunho:produto:'); setModalProduto(null) }}
          onSaved={handleSavedProduto}
        />
      )}
      {produtoNoSite && (
        <ModalProdutoSite
          produto={produtoNoSite}
          onClose={() => { limparRascunhos('rascunho:site:'); setModalProdSite(null) }}
          onSaved={p => {
            setProdutos(prev => prev.map(x => x.id === p.id ? p : x))
            showToast('Produto atualizado!')
          }}
        />
      )}
      {(modalSlide === 'novo' || slideEditando) && (
        <ModalSlide
          slide={slideEditando ?? null}
          onClose={() => { limparRascunhos('rascunho:slide:'); setModalSlide(null) }}
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
