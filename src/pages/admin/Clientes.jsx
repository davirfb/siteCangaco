import { useState, useEffect } from 'react'
import { api } from '../../lib/api.js'
import { obterClientes } from '../../lib/dados.js'
import { useRascunho, limparRascunhos } from '../../hooks/useRascunho.js'
import {
  formatarDocumento, nomeExibicao, filtrarClientes, ordenarClientes,
  soDigitos, buscarCep, buscarCnpj, destaquesDoCliente,
} from '../../lib/clientes.js'
import { gerarListaClientesPDF } from '../../utils/gerarPDF.js'

const inputCls = 'w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors'
const labelCls = 'block mb-1 text-sm font-semibold text-text-dark'

const ativo = c => c.situacao !== 'I' && c.situacao !== 'E'

/* ── Campo de destaques (lista de etiquetas) ── */
function InputDestaques({ valor, onChange, placeholder }) {
  const [texto, setTexto] = useState('')
  function adicionar() {
    const t = texto.trim()
    if (t && !valor.includes(t)) onChange([...valor, t])
    setTexto('')
  }
  return (
    <div>
      {valor.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {valor.map(d => (
            <span key={d} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
              <i className="fas fa-star text-[10px]"></i>{d}
              <button type="button" onClick={() => onChange(valor.filter(x => x !== d))}
                      className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-yellow-200 cursor-pointer border-none bg-transparent text-yellow-800">
                <i className="fas fa-times text-[9px]"></i>
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={texto} onChange={e => setTexto(e.target.value)}
               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionar() } }}
               placeholder={placeholder} className={inputCls} />
        <button type="button" onClick={adicionar} disabled={!texto.trim()}
                className="shrink-0 px-3 rounded-lg bg-yellow-50 text-yellow-800 hover:bg-yellow-100 text-sm font-semibold cursor-pointer border-none disabled:opacity-50">
          <i className="fas fa-plus"></i>
        </button>
      </div>
    </div>
  )
}

const ChipsDestaques = ({ lista }) => lista.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-1">
    {lista.map(d => (
      <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-800">
        <i className="fas fa-star text-[8px]"></i>{d}
      </span>
    ))}
  </div>
)

// Converte a ficha do Bling no formato do formulário
function paraForm(c) {
  const g = c?.endereco?.geral ?? {}
  const tipo = c?.tipo ?? 'J'
  return {
    nome:            c?.nome ?? '',
    apelido:         c?.apelido ?? '',
    grupoId:         c?.grupoId ?? '',
    tabelaPreco:     c?.tabelaPreco ?? '',
    destaques:       c?.destaques ?? [],
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
    grupoId: c.grupoId ?? null, destaques: c.destaques ?? [], tabelaPreco: c.tabelaPreco ?? null,
    codigo: c.codigo ?? '', situacao: c.situacao ?? 'A', tipo: c.tipo,
    numeroDocumento: soDigitos(c.numeroDocumento), telefone: c.telefone ?? '', celular: c.celular ?? '',
    email: c.email ?? '', municipio: c.endereco?.geral?.municipio ?? '', uf: c.endereco?.geral?.uf ?? '',
  }
}

/* ── Formulário do cliente ── */
function FormCliente({ id, inicial, grupos, onClose, onSaved, showToast }) {
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
    const pf = form.tipo !== 'J'
    if (!pf && Number(form.indicadorIe) === 1 && !form.ie.trim()) {
      setErro('Para contribuinte de ICMS, informe a Inscrição Estadual ou escolha "Contribuinte isento" / "Não contribuinte".')
      return
    }
    setSaving(true)
    try {
      const { endereco, ...dados } = form
      // Pessoa física nunca é contribuinte de ICMS
      const resto = pf ? { ...dados, indicadorIe: 9, ie: '', fantasia: '' } : dados
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
          <label className={labelCls}>Tabela de preço <span className="text-[11px] font-normal text-gray-400">padrão nos pedidos</span></label>
          <select value={form.tabelaPreco || ''} onChange={e => set('tabelaPreco', e.target.value)} className={inputCls}>
            <option value="">Não definida</option>
            <option value="varejo">Varejo</option>
            <option value="atacado">Atacado</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Tipo de pessoa</label>
          <select value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value, indicadorIe: e.target.value === 'J' ? 1 : 9 }))}
                  className={inputCls}>
            <option value="J">Jurídica (CNPJ)</option>
            <option value="F">Física (CPF)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Grupo / rede <span className="text-[11px] font-normal text-gray-400">só no site</span></label>
          <select value={form.grupoId || ''} onChange={e => set('grupoId', e.target.value)} className={inputCls}>
            <option value="">Sem grupo</option>
            {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Destaques <span className="text-[11px] font-normal text-gray-400">aparecem nos pedidos</span></label>
          <InputDestaques valor={form.destaques || []} onChange={v => set('destaques', v)} placeholder="Ex: Comprador: Sr. José" />
        </div>
      </div>
      {(() => {
        const g = grupos.find(x => x.id === form.grupoId)
        return g?.destaques?.length > 0 && (
          <div className="text-xs text-gray-500 -mt-2">
            Destaques do grupo <strong>{g.nome}</strong> (valem para todas as filiais): <ChipsDestaques lista={g.destaques} />
          </div>
        )
      })()}

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
export function ModalCliente({ id, grupos, onClose, onSaved, showToast }) {
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
        {inicial && <FormCliente id={id} inicial={inicial} grupos={grupos} onClose={onClose} onSaved={onSaved} showToast={showToast} />}
      </div>
    </div>
  )
}

/* ── Modal do grupo (rede de filiais) ── */
function ModalGrupo({ grupo, clientes, grupos, onClose, onSaved, onExcluido, showToast }) {
  const chave = `rascunho:grupo:${grupo?.id ?? 'novo'}`
  const [form, setForm] = useRascunho(chave, {
    nome:       grupo?.nome ?? '',
    destaques:  grupo?.destaques ?? [],
    clienteIds: clientes.filter(c => grupo && c.grupoId === grupo.id).map(c => c.id),
  })
  const [busca, setBusca]   = useState('')
  const [erro, setErro]     = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  const selecionados = new Set(form.clienteIds)
  const alternar = id => setForm(f => ({
    ...f, clienteIds: selecionados.has(id) ? f.clienteIds.filter(x => x !== id) : [...f.clienteIds, id],
  }))
  // Selecionados primeiro, depois os demais clientes ativos
  const candidatos = ordenarClientes(filtrarClientes(clientes.filter(c => ativo(c) || selecionados.has(c.id)), busca, grupos))
    .sort((a, b) => Number(selecionados.has(b.id)) - Number(selecionados.has(a.id)))
  const nomeGrupo = id => grupos.find(g => g.id === id)?.nome

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    setSaving(true)
    try {
      const salvo = await api('/clientes', { method: 'POST', body: { acao: 'grupo_salvar', grupo: { ...form, id: grupo?.id } } })
      onSaved(salvo, !grupo)
      onClose()
    } catch (err) { setErro(err.message) }
    finally { setSaving(false) }
  }

  async function excluir() {
    if (!window.confirm(`Excluir o grupo "${grupo.nome}"?\n\nAs filiais continuam cadastradas, só deixam de estar agrupadas.`)) return
    try {
      await api('/clientes', { method: 'POST', body: { acao: 'grupo_excluir', id: grupo.id } })
      onExcluido(grupo.id)
      onClose()
    } catch (err) { showToast(err.message, 'error') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-text-dark">{grupo ? 'Editar Grupo' : 'Novo Grupo'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-1">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={salvar} className="p-5 flex flex-col gap-4">
          <div>
            <label className={labelCls}>Nome do grupo *</label>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required
                   placeholder="Ex: Supermercado Mais Econômico" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Destaques do grupo <span className="text-[11px] font-normal text-gray-400">valem para todas as filiais</span></label>
            <InputDestaques valor={form.destaques} onChange={v => setForm(f => ({ ...f, destaques: v }))}
                            placeholder="Ex: Pagamento só com boleto 28 dias" />
          </div>

          <div>
            <label className={labelCls}>Filiais <span className="text-[11px] font-normal text-gray-400">{form.clienteIds.length} selecionada{form.clienteIds.length !== 1 ? 's' : ''}</span></label>
            <div className="relative mb-2">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente para adicionar"
                     className={inputCls + ' pl-9'} />
            </div>
            <div className="border-2 border-gray-100 rounded-lg max-h-72 overflow-y-auto divide-y divide-gray-100">
              {candidatos.length === 0 && <p className="text-sm text-gray-400 p-4 text-center">Nenhum cliente encontrado.</p>}
              {candidatos.map(c => {
                const outro = c.grupoId && c.grupoId !== grupo?.id ? nomeGrupo(c.grupoId) : null
                return (
                  <label key={c.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={selecionados.has(c.id)} onChange={() => alternar(c.id)}
                           className="w-4 h-4 accent-[#d2691e]" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-text-dark truncate">{nomeExibicao(c)}</span>
                      <span className="block text-xs text-gray-400 truncate">
                        {[formatarDocumento(c.numeroDocumento), c.municipio].filter(Boolean).join(' · ')}
                        {outro && <span className="text-orange-600"> · hoje no grupo {outro}</span>}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {erro && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm" role="alert">{erro}</div>}

          <div className="flex justify-between gap-3 pt-2 flex-wrap">
            {grupo ? (
              <button type="button" onClick={excluir}
                      className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer border-none">
                <i className="fas fa-trash mr-1.5"></i>Excluir grupo
              </button>
            ) : <span />}
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                      className="px-5 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-semibold text-text-dark hover:border-primary hover:text-primary transition-colors cursor-pointer">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                      className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-dark-brown transition-colors disabled:opacity-60 cursor-pointer flex items-center gap-2">
                <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
                {saving ? 'Salvando…' : 'Salvar grupo'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Linha de cliente na lista ── */
function LinhaCliente({ c, grupos, emGrupo, onEditar, onSituacao }) {
  const inativo = !ativo(c)
  const fone = c.celular || c.telefone
  return (
    <div className={`flex items-center gap-3 p-3 sm:p-4 ${emGrupo ? 'sm:pl-8' : ''} ${inativo ? 'opacity-60' : ''}`}>
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
        <ChipsDestaques lista={emGrupo ? (c.destaques ?? []) : destaquesDoCliente(c, grupos)} />
      </div>
      <button onClick={() => onEditar(c.id)} title="Editar"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold transition-colors cursor-pointer border-none">
        <i className="fas fa-edit"></i><span className="hidden sm:inline">Editar</span>
      </button>
      <button onClick={() => onSituacao(c)} title={inativo ? 'Reativar' : 'Inativar'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer border-none ${inativo ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
        <i className={`fas ${inativo ? 'fa-undo' : 'fa-user-slash'}`}></i>
        <span className="hidden sm:inline">{inativo ? 'Reativar' : 'Inativar'}</span>
      </button>
    </div>
  )
}

/* ── Seção Clientes ── */
export default function SecaoClientes({ showToast }) {
  const [clientes,     setClientes]     = useState([])
  const [grupos,       setGrupos]       = useState([])
  const [ultimaSync,   setUltimaSync]   = useState(null)
  const [carregando,   setCarregando]   = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [erro,         setErro]         = useState('')
  const [busca,  setBusca]  = useRascunho('admin:clientes:busca', '')
  const [filtro, setFiltro] = useRascunho('admin:clientes:filtro', 'ativos')
  const [modal,  setModal]  = useRascunho('admin:modalCliente', null)
  const [modalGrupo, setModalGrupo] = useRascunho('admin:modalGrupo', null)

  async function carregarLista() {
    const r = await obterClientes()
    setClientes(r.clientes)
    setGrupos(r.grupos ?? [])
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
        // Primeira vez: importa tudo do Bling. Depois: só o que mudou, se faz mais de 30 min
        if (!r.ultimaSincronizacao) await sincronizar({ completo: true })
        else if (Date.now() - r.ultimaSincronizacao > 30 * 60 * 1000) await sincronizar({ silencioso: true })
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

  function handleGrupoSalvo(g, novo) {
    const membros = new Set(g.clienteIds)
    setGrupos(prev => novo ? [...prev, { id: g.id, nome: g.nome, destaques: g.destaques }]
                           : prev.map(x => x.id === g.id ? { ...x, nome: g.nome, destaques: g.destaques } : x))
    setClientes(prev => prev.map(c => membros.has(c.id) ? { ...c, grupoId: g.id }
                                      : c.grupoId === g.id ? { ...c, grupoId: null } : c))
    showToast(novo ? 'Grupo criado!' : 'Grupo atualizado!')
  }

  function handleGrupoExcluido(id) {
    setGrupos(prev => prev.filter(g => g.id !== id))
    setClientes(prev => prev.map(c => c.grupoId === id ? { ...c, grupoId: null } : c))
    showToast('Grupo excluído.')
  }

  function fecharModal() {
    limparRascunhos('rascunho:cliente:')
    setModal(null)
  }

  function fecharModalGrupo() {
    limparRascunhos('rascunho:grupo:')
    setModalGrupo(null)
  }

  const validos = clientes.filter(c => c.situacao !== 'E')
  const porFiltro = validos.filter(c => filtro === 'todos' || (filtro === 'ativos' ? ativo(c) : !ativo(c)))
  const visiveis = ordenarClientes(filtrarClientes(porFiltro, busca, grupos))
  const qtdAtivos = validos.filter(ativo).length

  // Agrupa a lista: grupos (por nome) com suas filiais, depois clientes sem grupo
  const idsGrupos = new Set(grupos.map(g => g.id))
  const secoes = ordenarClientes(grupos.map(g => ({ ...g, apelido: g.nome })))
    .map(g => ({ grupo: g, clientes: visiveis.filter(c => c.grupoId === g.id) }))
    .filter(s => s.clientes.length > 0)
  const semGrupo = visiveis.filter(c => !c.grupoId || !idsGrupos.has(c.grupoId))

  function imprimir() {
    const linha = c => ({
      nome:      nomeExibicao(c),
      razao:     c.apelido ? c.nome : (c.fantasia && c.fantasia !== c.nome ? c.fantasia : ''),
      documento: formatarDocumento(c.numeroDocumento),
      telefone:  [c.celular, c.telefone].filter(Boolean).join(' / '),
      cidade:    c.municipio ? `${c.municipio}${c.uf ? '/' + c.uf : ''}` : '',
      destaques: c.destaques ?? [],
    })
    const rotulo = { ativos: 'Ativos', inativos: 'Inativos', todos: 'Todos' }[filtro]
    gerarListaClientesPDF({
      subtitulo: busca ? `${rotulo} · busca "${busca}"` : rotulo,
      secoes: [
        ...secoes.map(s => ({ titulo: s.grupo.nome, destaques: s.grupo.destaques, clientes: s.clientes.map(linha) })),
        ...(semGrupo.length ? [{ titulo: secoes.length ? 'Sem grupo' : '', clientes: semGrupo.map(linha) }] : []),
      ],
    })
  }

  const fmtData = ms => ms ? new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca'
  const tabCls = sel => `px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer border-none transition-colors ${sel ? 'bg-primary text-white' : 'bg-white text-text-dark hover:bg-gray-100'}`
  const btnSec = 'flex items-center gap-2 bg-white border-2 border-primary text-primary px-3 py-2 rounded-lg font-semibold text-sm hover:bg-primary hover:text-white transition-colors cursor-pointer disabled:opacity-50'

  return (
    <>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-text-dark">Clientes</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {qtdAtivos} ativo{qtdAtivos !== 1 ? 's' : ''} · {grupos.length} grupo{grupos.length !== 1 ? 's' : ''} · sincronizado com o Bling em {fmtData(ultimaSync)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => sincronizar()} disabled={sincronizando} className={btnSec} title="Sincronizar com o Bling">
            <i className={`fas fa-sync-alt ${sincronizando ? 'fa-spin' : ''}`}></i>
            <span className="hidden sm:inline">{sincronizando ? 'Sincronizando…' : 'Sincronizar'}</span>
          </button>
          <button onClick={imprimir} disabled={visiveis.length === 0} className={btnSec} title="Imprimir lista">
            <i className="fas fa-print"></i>
            <span className="hidden sm:inline">Imprimir</span>
          </button>
          <button onClick={() => setModalGrupo('novo')} className={btnSec} title="Novo grupo">
            <i className="fas fa-object-group"></i>
            <span className="hidden sm:inline">Novo Grupo</span>
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
                 placeholder="Buscar por apelido, nome, grupo, CNPJ/CPF ou telefone"
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

      <div className="flex flex-col gap-4">
        {secoes.map(({ grupo, clientes: membros }) => (
          <div key={grupo.id} className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-orange-50/60 border-b border-orange-100">
              <i className="fas fa-object-group text-primary"></i>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-text-dark text-sm truncate">
                  {grupo.nome} <span className="font-normal text-gray-400">· {membros.length} filia{membros.length !== 1 ? 'is' : 'l'}</span>
                </p>
                <ChipsDestaques lista={grupo.destaques ?? []} />
              </div>
              <button onClick={() => setModalGrupo(grupo.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-primary hover:bg-orange-100 text-xs font-semibold transition-colors cursor-pointer border border-orange-200">
                <i className="fas fa-edit"></i><span className="hidden sm:inline">Editar grupo</span>
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {membros.map(c => (
                <LinhaCliente key={c.id} c={c} grupos={grupos} emGrupo onEditar={setModal} onSituacao={alternarSituacao} />
              ))}
            </div>
          </div>
        ))}

        {semGrupo.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
            {semGrupo.map(c => (
              <LinhaCliente key={c.id} c={c} grupos={grupos} onEditar={setModal} onSituacao={alternarSituacao} />
            ))}
          </div>
        )}
      </div>

      {modal && (
        <ModalCliente id={modal} grupos={grupos} onClose={fecharModal} onSaved={handleSaved} showToast={showToast} />
      )}
      {(modalGrupo === 'novo' || grupos.some(g => g.id === modalGrupo)) && (
        <ModalGrupo grupo={grupos.find(g => g.id === modalGrupo) ?? null} clientes={validos} grupos={grupos}
                    onClose={fecharModalGrupo} onSaved={handleGrupoSalvo} onExcluido={handleGrupoExcluido} showToast={showToast} />
      )}
    </>
  )
}
