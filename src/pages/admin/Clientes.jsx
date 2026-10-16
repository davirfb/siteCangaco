import { useState, useEffect } from 'react'
import { api } from '../../lib/api.js'
import { useRascunho, limparRascunhos } from '../../hooks/useRascunho.js'
import {
  formatarDocumento, nomeExibicao, filtrarClientes, ordenarClientes,
  soDigitos, buscarCep, buscarCnpj,
} from '../../lib/clientes.js'

const inputCls = 'w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors'
const labelCls = 'block mb-1 text-sm font-semibold text-text-dark'

const ativo = c => c.situacao !== 'I' && c.situacao !== 'E'

// Converte a ficha do Bling no formato do formulário
function paraForm(c) {
  const g = c?.endereco?.geral ?? {}
  const tipo = c?.tipo ?? 'J'
  return {
    nome:            c?.nome ?? '',
    apelido:         c?.apelido ?? '',
    fantasia:        c?.fantasia ?? '',
    tipo,
    numeroDocumento: formatarDocumento(c?.numeroDocumento ?? ''),
    indicadorIe:     c?.indicadorIe ?? (tipo === 'J' ? 1 : 9),
    ie:              c?.ie ?? '',
    email:           c?.email ?? '',
    emailNotaFiscal: c?.emailNotaFiscal ?? '',
    telefone:        c?.telefone ?? '',
    celular:         c?.celular ?? '',
    endereco: {
      cep: g.cep ?? '', endereco: g.endereco ?? '', numero: g.numero ?? '', complemento: g.complemento ?? '',
      bairro: g.bairro ?? '', municipio: g.municipio ?? '', uf: g.uf ?? '',
    },
  }
}

// Ficha completa → item da lista
function paraLista(c) {
  return {
    id: String(c.id), nome: c.nome, apelido: c.apelido ?? '', fantasia: c.fantasia ?? '',
    codigo: c.codigo ?? '', situacao: c.situacao ?? 'A', tipo: c.tipo,
    numeroDocumento: soDigitos(c.numeroDocumento), telefone: c.telefone ?? '', celular: c.celular ?? '',
    email: c.email ?? '', municipio: c.endereco?.geral?.municipio ?? '', uf: c.endereco?.geral?.uf ?? '',
  }
}

/* ── Formulário do cliente ── */
function FormCliente({ id, inicial, onClose, onSaved, showToast }) {
  const [form, setForm] = useRascunho(`rascunho:cliente:${id}`, inicial)
  const [erro, setErro]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [buscando, setBuscando] = useState('')

  const set   = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))
  const setEnd = (campo, valor) => setForm(f => ({ ...f, endereco: { ...f.endereco, [campo]: valor } }))

  async function preencherCnpj() {
    setBuscando('cnpj')
    try {
      const r = await buscarCnpj(form.numeroDocumento)
      if (!r) { showToast('CNPJ não encontrado.', 'error'); return }
      setForm(f => ({
        ...f,
        nome:     f.nome     || r.nome,
        fantasia: f.fantasia || r.fantasia,
        email:    f.email    || r.email,
        telefone: f.telefone || r.telefone,
        endereco: Object.fromEntries(Object.entries(f.endereco).map(([k, v]) => [k, v || r.endereco[k] || ''])),
      }))
      showToast('Dados do CNPJ preenchidos. Confira antes de salvar.')
    } catch { showToast('Não foi possível consultar o CNPJ.', 'error') }
    finally { setBuscando('') }
  }

  async function preencherCep() {
    if (soDigitos(form.endereco.cep).length !== 8) return
    setBuscando('cep')
    try {
      const r = await buscarCep(form.endereco.cep)
      if (r) setForm(f => ({ ...f, endereco: { ...f.endereco, ...Object.fromEntries(Object.entries(r).filter(([, v]) => v)) } }))
    } catch {}
    finally { setBuscando('') }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setSaving(true)
    try {
      const { endereco, ...resto } = form
      const salvo = await api('/clientes', {
        method: 'POST',
        body: { acao: 'salvar', cliente: { ...resto, id: id === 'novo' ? undefined : id, endereco: { geral: endereco } } },
      })
      onSaved(salvo, id === 'novo')
      onClose()
    } catch (err) {
      setErro(err.message)
    } finally {
      setSaving(false)
    }
  }

  const pj = form.tipo === 'J'

  return (
    <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Apelido <span className="text-[11px] font-normal text-gray-400">só no site</span></label>
          <input value={form.apelido} onChange={e => set('apelido', e.target.value)}
                 placeholder="Ex: Mercado do João" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Tipo de pessoa</label>
          <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={inputCls}>
            <option value="J">Jurídica (CNPJ)</option>
            <option value="F">Física (CPF)</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>{pj ? 'CNPJ' : 'CPF'}</label>
        <div className="flex gap-2">
          <input value={form.numeroDocumento}
                 onChange={e => set('numeroDocumento', e.target.value)}
                 onBlur={e => set('numeroDocumento', formatarDocumento(e.target.value))}
                 placeholder={pj ? '00.000.000/0000-00' : '000.000.000-00'} className={inputCls} />
          {pj && (
            <button type="button" onClick={preencherCnpj}
                    disabled={buscando === 'cnpj' || soDigitos(form.numeroDocumento).length !== 14}
                    className="shrink-0 flex items-center gap-2 px-3 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm font-semibold cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed">
              <i className={`fas ${buscando === 'cnpj' ? 'fa-spinner fa-spin' : 'fa-search'}`}></i>
              <span className="hidden sm:inline">Buscar CNPJ</span>
            </button>
          )}
        </div>
      </div>

      <div>
        <label className={labelCls}>{pj ? 'Razão social' : 'Nome'} *</label>
        <input value={form.nome} onChange={e => set('nome', e.target.value)} required className={inputCls} />
      </div>

      {pj && (
        <div>
          <label className={labelCls}>Nome fantasia</label>
          <input value={form.fantasia} onChange={e => set('fantasia', e.target.value)} className={inputCls} />
        </div>
      )}

      {pj && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Contribuinte de ICMS</label>
            <select value={form.indicadorIe} onChange={e => set('indicadorIe', Number(e.target.value))} className={inputCls}>
              <option value={1}>Contribuinte (tem IE)</option>
              <option value={2}>Contribuinte isento</option>
              <option value={9}>Não contribuinte</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Inscrição estadual</label>
            <input value={form.ie} onChange={e => set('ie', e.target.value)} className={inputCls} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Telefone</label>
          <input value={form.telefone} onChange={e => set('telefone', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Celular / WhatsApp</label>
          <input value={form.celular} onChange={e => set('celular', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>E-mail</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>E-mail para nota fiscal</label>
          <input type="email" value={form.emailNotaFiscal} onChange={e => set('emailNotaFiscal', e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="relative flex items-center my-1">
        <div className="flex-1 border-t border-gray-200"></div>
        <span className="px-3 text-xs text-gray-400 bg-white">Endereço</span>
        <div className="flex-1 border-t border-gray-200"></div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>CEP</label>
          <div className="relative">
            <input value={form.endereco.cep} onChange={e => setEnd('cep', e.target.value)} onBlur={preencherCep}
                   placeholder="00000-000" className={inputCls} />
            {buscando === 'cep' && <i className="fas fa-spinner fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-primary"></i>}
          </div>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <label className={labelCls}>Endereço</label>
          <input value={form.endereco.endereco} onChange={e => setEnd('endereco', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Número</label>
          <input value={form.endereco.numero} onChange={e => setEnd('numero', e.target.value)} className={inputCls} />
        </div>
        <div className="sm:col-span-3">
          <label className={labelCls}>Complemento</label>
          <input value={form.endereco.complemento} onChange={e => setEnd('complemento', e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Bairro</label>
          <input value={form.endereco.bairro} onChange={e => setEnd('bairro', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Cidade</label>
          <input value={form.endereco.municipio} onChange={e => setEnd('municipio', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>UF</label>
          <input value={form.endereco.uf} maxLength={2} onChange={e => setEnd('uf', e.target.value.toUpperCase())} className={inputCls} />
        </div>
      </div>

      <p className="text-xs text-gray-400">As alterações são salvas no Bling. O apelido fica só no site.</p>

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
          <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
          {saving ? 'Salvando no Bling…' : 'Salvar cliente'}
        </button>
      </div>
    </form>
  )
}

/* ── Modal do cliente (carrega a ficha completa do Bling) ── */
function ModalCliente({ id, onClose, onSaved, showToast }) {
  const [inicial, setInicial] = useState(id === 'novo' ? paraForm(null) : null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  useEffect(() => {
    if (id === 'novo') return
    api(`/clientes?id=${encodeURIComponent(id)}`)
      .then(c => setInicial(paraForm(c)))
      .catch(err => setErro(err.message))
  }, [id])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-text-dark">{id === 'novo' ? 'Novo Cliente' : 'Editar Cliente'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-1">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        {erro && <div className="m-5 bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">{erro}</div>}
        {!erro && !inicial && (
          <div className="flex items-center justify-center gap-3 py-16 text-primary">
            <i className="fas fa-spinner fa-spin"></i> Carregando ficha do Bling...
          </div>
        )}
        {inicial && <FormCliente id={id} inicial={inicial} onClose={onClose} onSaved={onSaved} showToast={showToast} />}
      </div>
    </div>
  )
}

/* ── Seção Clientes ── */
export default function SecaoClientes({ showToast }) {
  const [clientes,     setClientes]     = useState([])
  const [ultimaSync,   setUltimaSync]   = useState(null)
  const [carregando,   setCarregando]   = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [erro,         setErro]         = useState('')
  const [busca,  setBusca]  = useRascunho('admin:clientes:busca', '')
  const [filtro, setFiltro] = useRascunho('admin:clientes:filtro', 'ativos')
  const [modal,  setModal]  = useRascunho('admin:modalCliente', null)

  async function carregarLista() {
    const r = await api('/clientes')
    setClientes(r.clientes)
    setUltimaSync(r.ultimaSincronizacao)
    return r
  }

  async function sincronizar({ completo = false, silencioso = false } = {}) {
    setSincronizando(true)
    try {
      const r = await api('/clientes', { method: 'POST', body: { acao: 'sincronizar', completo } })
      await carregarLista()
      if (!silencioso) showToast(r.total ? `${r.total} cliente(s) atualizado(s) do Bling.` : 'Clientes já estão em dia.')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSincronizando(false)
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const r = await carregarLista()
        setCarregando(false)
        // Primeira vez: importa tudo do Bling. Depois: só o que mudou, se faz mais de 5 min
        if (!r.ultimaSincronizacao) await sincronizar({ completo: true })
        else if (Date.now() - r.ultimaSincronizacao > 5 * 60 * 1000) await sincronizar({ silencioso: true })
      } catch (err) {
        setErro(err.message)
        setCarregando(false)
      }
    })()
  }, [])

  async function alternarSituacao(c) {
    const ativar = !ativo(c)
    if (!ativar && !window.confirm(`Inativar "${nomeExibicao(c)}"?\n\nO cliente fica inativo no Bling e some das listas. O histórico de pedidos e notas é mantido.`)) return
    try {
      const r = await api('/clientes', { method: 'POST', body: { acao: 'situacao', id: c.id, ativo: ativar } })
      setClientes(prev => prev.map(x => x.id === c.id ? { ...x, situacao: r.situacao } : x))
      showToast(ativar ? 'Cliente reativado.' : 'Cliente inativado.')
    } catch (err) { showToast(err.message, 'error') }
  }

  function handleSaved(c, novo) {
    const item = paraLista(c)
    setClientes(prev => novo ? [...prev, item] : prev.map(x => x.id === item.id ? { ...x, ...item } : x))
    showToast(novo ? 'Cliente cadastrado no Bling!' : 'Cliente atualizado no Bling!')
  }

  function fecharModal() {
    limparRascunhos('rascunho:cliente:')
    setModal(null)
  }

  const validos = clientes.filter(c => c.situacao !== 'E')
  const porFiltro = validos.filter(c => filtro === 'todos' || (filtro === 'ativos' ? ativo(c) : !ativo(c)))
  const visiveis = ordenarClientes(filtrarClientes(porFiltro, busca))
  const qtdAtivos = validos.filter(ativo).length

  const fmtData = ms => ms ? new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca'
  const tabCls = sel => `px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer border-none transition-colors ${sel ? 'bg-primary text-white' : 'bg-white text-text-dark hover:bg-gray-100'}`

  return (
    <>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-text-dark">Clientes</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {qtdAtivos} ativo{qtdAtivos !== 1 ? 's' : ''} · sincronizado com o Bling em {fmtData(ultimaSync)}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => sincronizar()} disabled={sincronizando}
                  className="flex items-center gap-2 bg-white border-2 border-primary text-primary px-3 py-2 rounded-lg font-semibold text-sm hover:bg-primary hover:text-white transition-colors cursor-pointer disabled:opacity-50">
            <i className={`fas fa-sync-alt ${sincronizando ? 'fa-spin' : ''}`}></i>
            <span className="hidden sm:inline">{sincronizando ? 'Sincronizando…' : 'Sincronizar'}</span>
          </button>
          <button onClick={() => setModal('novo')}
                  className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-dark-brown transition-colors cursor-pointer border-none">
            <i className="fas fa-plus"></i>
            <span className="hidden sm:inline">Novo Cliente</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input value={busca} onChange={e => setBusca(e.target.value)}
                 placeholder="Buscar por apelido, nome, CNPJ/CPF ou telefone"
                 className={inputCls + ' pl-9 bg-white'} />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[['ativos', 'Ativos'], ['inativos', 'Inativos'], ['todos', 'Todos']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltro(v)} className={tabCls(filtro === v)}>{l}</button>
          ))}
        </div>
      </div>

      {erro && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm mb-4">{erro}</div>}

      {(carregando || (sincronizando && clientes.length === 0)) && (
        <div className="flex flex-col items-center justify-center py-20 text-primary gap-3">
          <i className="fas fa-spinner fa-spin text-4xl"></i>
          <p>{sincronizando ? 'Importando clientes do Bling…' : 'Carregando clientes…'}</p>
        </div>
      )}

      {!carregando && !sincronizando && visiveis.length === 0 && !erro && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <i className="fas fa-users text-5xl"></i>
          <p>{busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente nesta lista.'}</p>
        </div>
      )}

      {visiveis.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {visiveis.map(c => {
            const inativo = !ativo(c)
            const fone = c.celular || c.telefone
            return (
              <div key={c.id} className={`flex items-center gap-3 p-3 sm:p-4 ${inativo ? 'opacity-60' : ''}`}>
                <div className="w-10 h-10 rounded-full bg-orange-50 text-primary flex items-center justify-center shrink-0 font-bold">
                  {nomeExibicao(c).charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-dark text-sm truncate">
                    {nomeExibicao(c)}
                    {inativo && <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 align-middle">Inativo</span>}
                  </p>
                  {c.apelido && <p className="text-xs text-gray-500 truncate">{c.nome}</p>}
                  <p className="text-xs text-gray-400 truncate">
                    {[formatarDocumento(c.numeroDocumento), fone, c.municipio && `${c.municipio}${c.uf ? '/' + c.uf : ''}`].filter(Boolean).join(' · ') || 'Sem documento'}
                  </p>
                </div>
                <button onClick={() => setModal(c.id)} title="Editar"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold transition-colors cursor-pointer border-none">
                  <i className="fas fa-edit"></i><span className="hidden sm:inline">Editar</span>
                </button>
                <button onClick={() => alternarSituacao(c)} title={inativo ? 'Reativar' : 'Inativar'}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer border-none ${inativo ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                  <i className={`fas ${inativo ? 'fa-undo' : 'fa-user-slash'}`}></i>
                  <span className="hidden sm:inline">{inativo ? 'Reativar' : 'Inativar'}</span>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <ModalCliente id={modal} onClose={fecharModal} onSaved={handleSaved} showToast={showToast} />
      )}
    </>
  )
}
