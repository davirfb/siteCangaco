import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { auth, db } from '../../lib/firebase.js'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp,
} from 'firebase/firestore'

const CLOUD  = 'dykq5hssj'
const PRESET = 'cangaco_produtos'

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
         className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 rounded-xl shadow-xl text-white text-sm font-medium transition-all ${tipo === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
      <i className={`fas ${tipo === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}`}></i>
      {msg}
    </div>
  )
}

/* ── Modal Produto ── */
function ModalProduto({ produto, onClose, onSaved }) {
  const [nome,        setNome]       = useState(produto?.nome        ?? '')
  const [preco,       setPreco]      = useState(produto?.preco       ?? '')
  const [descricao,   setDescricao]  = useState(produto?.descricao   ?? '')
  const [destaque,    setDestaque]   = useState(produto?.destaque    ?? false)
  const [ativo,       setAtivo]      = useState(produto?.ativo !== false)
  const [fardoPreco,  setFardoPreco] = useState(produto?.fardo?.preco       ?? '')
  const [fardoDesc,   setFardoDesc]  = useState(produto?.fardo?.descricao   ?? '')
  const [previewSrc,  setPreviewSrc] = useState(produto?.imagem || null)
  const [dragOver,    setDragOver]   = useState(false)
  const [uploading,   setUploading]  = useState(false)
  const [uploadPct,   setUploadPct]  = useState(0)
  const [erro,        setErro]       = useState('')
  const [saving,      setSaving]     = useState(false)
  const fileRef = useRef(null)
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
        nome:      nome.trim(),
        descricao: descricao.trim(),
        preco:     parseFloat(preco),
        imagem:    imagemUrl,
        destaque,
        ativo,
        fardo:     (fardoPreco || fardoDesc)
          ? { preco: fardoPreco ? parseFloat(fardoPreco) : null, descricao: fardoDesc || null }
          : null,
        atualizadoEm: serverTimestamp(),
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

  const inputClass = 'w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-xl font-bold text-text-dark">{produto ? 'Editar Produto' : 'Novo Produto'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-primary transition-colors cursor-pointer">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-sm font-semibold text-text-dark">Nome do Produto *</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)}
                     required placeholder="Ex: Castanha de Caju — 250g" className={inputClass} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-text-dark">Preço unitário (R$) *</label>
              <input type="number" value={preco} onChange={e => setPreco(e.target.value)}
                     required step="0.01" min="0" placeholder="25.90" className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold text-text-dark">Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
                      rows={3} placeholder="Descrição do produto..."
                      className={inputClass + ' resize-y'} />
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold text-text-dark">Imagem do Produto</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0]) }}
              className={`border-2 border-dashed rounded-xl cursor-pointer overflow-hidden transition-colors ${dragOver ? 'drag-over border-primary' : 'border-gray-300 hover:border-primary'}`}
              style={{ minHeight: 120 }}
            >
              {previewSrc
                ? <img src={previewSrc} alt="Preview" className="w-full max-h-52 object-cover" />
                : (
                  <div className="flex flex-col items-center justify-center gap-1 py-8 text-gray-400">
                    <i className="fas fa-cloud-upload-alt text-4xl"></i>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <span className="px-3 text-xs text-gray-400 bg-white">Informações do Fardo (opcional)</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-sm font-semibold text-text-dark">Preço do Fardo (R$)</label>
              <input type="number" value={fardoPreco} onChange={e => setFardoPreco(e.target.value)}
                     step="0.01" min="0" placeholder="280.00" className={inputClass} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-text-dark">Descrição do Fardo</label>
              <input type="text" value={fardoDesc} onChange={e => setFardoDesc(e.target.value)}
                     placeholder="Ex: Fardo com 12 unidades de 200g" className={inputClass} />
            </div>
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
  const [previewSrc, setPreviewSrc] = useState(slide?.imagem || null)
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
    if (!slide?.imagem && !selectedFile.current) {
      setErro('Selecione uma imagem.')
      return
    }
    setSaving(true)
    try {
      let imagemUrl = slide?.imagem || ''
      if (selectedFile.current) {
        setUploading(true)
        imagemUrl = await uploadToCloudinary(selectedFile.current, pct => setUploadPct(pct))
        setUploading(false)
      }

      const dados = {
        imagem:       imagemUrl,
        titulo:       titulo.trim(),
        ordem:        Number(ordem),
        ativo,
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
      console.error(err)
      setErro('Erro ao salvar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-xl font-bold text-text-dark">{slide?.id ? 'Editar Imagem' : 'Nova Imagem do Slider'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-primary transition-colors cursor-pointer">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {/* Imagem */}
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

          {/* Título + Ordem */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-sm font-semibold text-text-dark">Título (opcional)</label>
              <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
                     placeholder="Ex: Castanha de Caju" className={inputClass} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-text-dark">Ordem</label>
              <input type="number" value={ordem} onChange={e => setOrdem(e.target.value)}
                     min="0" step="1" placeholder="0" className={inputClass} />
            </div>
          </div>

          {/* Toggle ativo */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="sr-only" />
            <span className="toggle-switch"></span>
            <span className="text-sm text-text-dark">Imagem ativa no slider</span>
          </label>

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm m-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-xl font-bold text-text-dark">Confirmar Exclusão</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-primary transition-colors cursor-pointer">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        <div className="px-6 py-5 text-center">
          <i className="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-3 block"></i>
          <p className="text-text-dark mb-1">Tem certeza que deseja excluir <strong>{titulo}</strong>?</p>
          <p className="text-sm text-gray-400">Esta ação não pode ser desfeita.</p>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose}
                  className="px-5 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-semibold text-text-dark hover:border-primary hover:text-primary transition-colors cursor-pointer">
            Cancelar
          </button>
          <button onClick={onConfirm}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors cursor-pointer flex items-center gap-2">
            <i className="fas fa-trash"></i> Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Dashboard ── */
export default function Dashboard() {
  const [activeSection, setActiveSection] = useState('produtos')
  const [produtos, setProdutos]   = useState([])
  const [slides,   setSlides]     = useState([])
  const [loading,  setLoading]    = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [modalProduto,    setModalProduto]    = useState(null)
  const [modalSlide,      setModalSlide]      = useState(null)
  const [modalConfirmar,  setModalConfirmar]  = useState(null) // { id, titulo, colecao }

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
      } catch {
        showToast('Erro ao carregar produtos.', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadSlides() {
    try {
      const snap = await getDocs(query(collection(db, 'slider'), orderBy('ordem', 'asc')))
      setSlides(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch {
      try {
        const snap = await getDocs(collection(db, 'slider'))
        setSlides(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch {
        showToast('Erro ao carregar slider.', 'error')
      }
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
      if (colecao === 'produtos') setProdutos(prev => prev.filter(p => p.id !== id))
      else setSlides(prev => prev.filter(s => s.id !== id))
      showToast('Item excluído.')
    } catch {
      showToast('Erro ao excluir.', 'error')
    }
  }

  const badgeGold  = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800'
  const badgeGreen = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800'
  const badgeRed   = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700'
  const badgeGray  = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500'

  const navItemClass = active =>
    `flex items-center gap-3 px-5 py-3 transition-colors cursor-pointer ${
      active
        ? 'text-primary font-semibold bg-orange-50 border-r-4 border-primary'
        : 'text-text-dark hover:text-primary hover:bg-gray-50'
    }`

  return (
    <div className="min-h-screen bg-gray-50 font-[inherit]">

      {/* Header */}
      <header className="bg-dark-brown text-white px-5 py-3 flex items-center justify-between shadow-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(o => !o)}
                  className="text-white text-lg p-1 hover:text-accent transition-colors cursor-pointer bg-transparent border-none">
            <i className="fas fa-bars"></i>
          </button>
          <img src="/img/logocangaco.svg" alt="Cangaço" className="h-8" />
          <span className="font-semibold hidden sm:block">Painel Administrativo</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/70 hidden md:block">{userEmail}</span>
          <button onClick={() => signOut(auth).then(() => navigate('/admin', { replace: true }))}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer border-none text-white">
            <i className="fas fa-sign-out-alt"></i> <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-52' : 'w-0 overflow-hidden'} transition-all duration-300 bg-white shadow-md min-h-[calc(100vh-56px)] flex-shrink-0`}>
          <nav className="py-4">
            <button onClick={() => setActiveSection('produtos')} className={navItemClass(activeSection === 'produtos') + ' w-full text-left border-none bg-transparent'}>
              <i className="fas fa-box w-5 text-center"></i>
              <span>Produtos</span>
            </button>
            <button onClick={() => setActiveSection('slider')} className={navItemClass(activeSection === 'slider') + ' w-full text-left border-none bg-transparent'}>
              <i className="fas fa-images w-5 text-center"></i>
              <span>Slider</span>
            </button>
            <Link to="/" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 px-5 py-3 text-text-dark hover:text-primary hover:bg-gray-50 transition-colors">
              <i className="fas fa-external-link-alt w-5 text-center"></i>
              <span>Ver Site</span>
            </Link>
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 p-6 min-w-0">

          {/* ── Seção Produtos ── */}
          {activeSection === 'produtos' && (
            <>
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h2 className="text-2xl font-bold text-text-dark">Produtos</h2>
                <button onClick={() => setModalProduto({})}
                        className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-dark-brown transition-colors cursor-pointer border-none">
                  <i className="fas fa-plus"></i> Novo Produto
                </button>
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
                <div className="bg-white rounded-2xl shadow overflow-hidden overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {['Imagem','Nome','Preço','Destaque','Status','Ações'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {produtos.map(p => {
                        const preco = Number(p.preco).toFixed(2).replace('.', ',')
                        const img   = p.imagem || '/img/logocacto.svg'
                        const desc  = (p.descricao || '').substring(0, 60) + (p.descricao?.length > 60 ? '…' : '')
                        return (
                          <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <img src={img} alt={p.nome}
                                   className="w-12 h-12 object-cover rounded-lg"
                                   onError={e => { e.target.src = '/img/logocacto.svg' }} />
                            </td>
                            <td className="px-4 py-3">
                              <strong className="text-text-dark text-sm">{p.nome}</strong>
                              {desc && <><br /><small className="text-gray-400 text-xs">{desc}</small></>}
                            </td>
                            <td className="px-4 py-3 text-primary font-semibold text-sm">R$ {preco}</td>
                            <td className="px-4 py-3">
                              {p.destaque
                                ? <span className={badgeGold}><i className="fas fa-star text-[10px]"></i>Destaque</span>
                                : <span className={badgeGray}>—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {p.ativo !== false
                                ? <span className={badgeGreen}>Ativo</span>
                                : <span className={badgeRed}>Inativo</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => setModalProduto(p)} title="Editar"
                                        className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center justify-center cursor-pointer border-none">
                                  <i className="fas fa-edit text-xs"></i>
                                </button>
                                <button onClick={() => setModalConfirmar({ id: p.id, titulo: p.nome, colecao: 'produtos' })} title="Excluir"
                                        className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors flex items-center justify-center cursor-pointer border-none">
                                  <i className="fas fa-trash text-xs"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── Seção Slider ── */}
          {activeSection === 'slider' && (
            <>
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-text-dark">Slider</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Imagens exibidas na seção "Sobre Nós" da página inicial</p>
                </div>
                <button onClick={() => setModalSlide({})}
                        className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-dark-brown transition-colors cursor-pointer border-none">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {slides.map(s => (
                    <div key={s.id} className="bg-white rounded-2xl shadow overflow-hidden">
                      <div className="relative">
                        <img src={s.imagem} alt={s.titulo || 'Slide'}
                             className="w-full h-44 object-cover"
                             onError={e => { e.target.src = '/img/logocacto.svg' }} />
                        <div className="absolute top-2 right-2 flex gap-1.5">
                          {s.ativo !== false
                            ? <span className={badgeGreen + ' shadow'}>Ativo</span>
                            : <span className={badgeRed   + ' shadow'}>Inativo</span>}
                        </div>
                      </div>
                      <div className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-text-dark font-semibold text-sm truncate">
                            {s.titulo || <span className="text-gray-400 italic">Sem título</span>}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">Ordem: {s.ordem ?? 0}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => setModalSlide(s)} title="Editar"
                                  className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center justify-center cursor-pointer border-none">
                            <i className="fas fa-edit text-xs"></i>
                          </button>
                          <button onClick={() => setModalConfirmar({ id: s.id, titulo: s.titulo || 'esta imagem', colecao: 'slider' })} title="Excluir"
                                  className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors flex items-center justify-center cursor-pointer border-none">
                            <i className="fas fa-trash text-xs"></i>
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

      {/* Modals */}
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
