import { useState, useEffect } from 'react'
import { api } from '../../lib/api.js'
import { obterClientes, obterPedidos } from '../../lib/dados.js'
import { useRascunho } from '../../hooks/useRascunho.js'
import { nomeExibicao, destaquesDoCliente } from '../../lib/clientes.js'

const brl = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
const DIAS  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

// Datas como texto "AAAA-MM-DD" no horário local (evita erro de fuso)
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const deIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const somaDias = (s, n) => { const d = deIso(s); d.setDate(d.getDate() + n); return iso(d) }
const hoje = () => iso(new Date())
const inicioSemana = s => { const d = deIso(s); d.setDate(d.getDate() - d.getDay()); return iso(d) }
const dataCurta = s => { const d = deIso(s); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}` }

const COR = {
  aberto:    'bg-orange-100 text-orange-900 border-orange-200',
  concluido: 'bg-green-100 text-green-900 border-green-200',
  outro:     'bg-gray-100 text-gray-700 border-gray-200',
}

export default function SecaoInicio({ showToast, irPara }) {
  const [pedidos,  setPedidos]  = useState([])
  const [clientes, setClientes] = useState([])
  const [grupos,   setGrupos]   = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modo, setModo] = useRascunho('admin:inicio:modo', 'semana')
  const [ref,  setRef]  = useRascunho('admin:inicio:ref', hoje())
  const [diaSel, setDiaSel] = useState(null)

  async function carregar() {
    const r = await obterPedidos()
    setPedidos(r.pedidos)
    return r
  }

  useEffect(() => {
    (async () => {
      try {
        const [r] = await Promise.all([
          carregar(),
          obterClientes().then(c => { setClientes(c.clientes); setGrupos(c.grupos ?? []) }),
        ])
        setCarregando(false)
        // Atualiza com o Bling em segundo plano se faz mais de 30 minutos
        if (r.ultimaSincronizacao && Date.now() - r.ultimaSincronizacao > 30 * 60 * 1000) {
          await api('/pedidos', { method: 'POST', body: { acao: 'sincronizar' } })
          await carregar()
        }
      } catch (err) { showToast(err.message, 'error'); setCarregando(false) }
    })()
  }, [])

  function info(p) {
    const c = clientes.find(x => x.id === p.cliente?.id)
    const base = c ?? { nome: p.cliente?.nome ?? '', apelido: p.cliente?.apelido ?? '' }
    return { nome: nomeExibicao(base) || p.cliente?.nome || '—', destaques: c ? destaquesDoCliente(c, grupos) : [] }
  }

  function abrir(p) {
    try { localStorage.setItem('admin:pedidos:detalhe', JSON.stringify(p.id)) } catch {}
    irPara('listaPedidos')
  }

  const hj = hoje()
  const ativos = pedidos.filter(p => p.situacao !== 'cancelado')
  const entrega = p => String(p.dataPrevista || p.data || '').slice(0, 10)
  const porDia = {}
  ativos.forEach(p => { const d = entrega(p); if (d) (porDia[d] ??= []).push(p) })
  Object.values(porDia).forEach(l => l.sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0)))

  const abertos   = ativos.filter(p => p.situacao === 'aberto')
  const atrasados = abertos.filter(p => entrega(p) && entrega(p) < hj).sort((a, b) => entrega(a).localeCompare(entrega(b)))
  const deHoje    = abertos.filter(p => entrega(p) === hj)
  const amanha    = abertos.filter(p => entrega(p) === somaDias(hj, 1))
  const totalAberto = abertos.reduce((a, p) => a + Number(p.total || 0), 0)

  // Dias exibidos na agenda
  let dias, titulo
  if (modo === 'semana') {
    const ini = inicioSemana(ref)
    dias = Array.from({ length: 7 }, (_, i) => somaDias(ini, i))
    titulo = `${dataCurta(dias[0])} – ${dataCurta(dias[6])} ${deIso(dias[6]).getFullYear()}`
  } else {
    const r = deIso(ref)
    const primeiro = iso(new Date(r.getFullYear(), r.getMonth(), 1))
    const ini = inicioSemana(primeiro)
    const ultimo = new Date(r.getFullYear(), r.getMonth() + 1, 0)
    const fim = somaDias(iso(ultimo), 6 - ultimo.getDay())
    dias = []
    for (let d = ini; d <= fim; d = somaDias(d, 1)) dias.push(d)
    titulo = `${MESES[r.getMonth()]} ${r.getFullYear()}`
  }
  const mesRef = deIso(ref).getMonth()

  function navegar(n) {
    if (modo === 'semana') setRef(somaDias(ref, 7 * n))
    else { const d = deIso(ref); setRef(iso(new Date(d.getFullYear(), d.getMonth() + n, 1))) }
    setDiaSel(null)
  }

  const Card = ({ icone, cor, rotulo, valor, sub }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cor}`}><i className={`fas ${icone}`}></i></div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400 uppercase tracking-wide">{rotulo}</p>
        <p className="text-xl font-bold text-text-dark leading-tight">{valor}</p>
        {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
      </div>
    </div>
  )

  const LinhaPedido = ({ p, mostrarData }) => {
    const i = info(p)
    return (
      <button onClick={() => abrir(p)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer bg-transparent border-none hover:bg-orange-50/60">
        <span className={`w-2 h-2 rounded-full shrink-0 ${p.situacao === 'concluido' ? 'bg-green-500' : 'bg-orange-500'}`}></span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-text-dark truncate">nº {p.numero ?? '—'} · {i.nome}</span>
          {i.destaques.length > 0 && <span className="block text-[11px] text-yellow-700 truncate"><i className="fas fa-star mr-1"></i>{i.destaques.join(' · ')}</span>}
        </span>
        {mostrarData && <span className="text-xs text-gray-400 shrink-0">{dataCurta(entrega(p))}</span>}
        <span className="text-sm font-bold text-primary shrink-0">{brl(p.total)}</span>
      </button>
    )
  }

  const Chip = ({ p }) => (
    <button onClick={() => abrir(p)} title={`nº ${p.numero} · ${info(p).nome} · ${brl(p.total)}`}
            className={`w-full text-left text-[11px] leading-tight px-1.5 py-1 rounded-md border truncate cursor-pointer ${COR[p.situacao] ?? COR.outro}`}>
      <strong>{p.numero}</strong> {info(p).nome}
    </button>
  )

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-primary gap-3">
        <i className="fas fa-spinner fa-spin text-4xl"></i><p>Carregando agenda…</p>
      </div>
    )
  }

  const listaDia = diaSel ? (porDia[diaSel] ?? []) : []

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-text-dark">Início</h2>
          <p className="text-sm text-gray-400 mt-0.5">Entregas pela data prevista dos pedidos</p>
        </div>
        <button onClick={() => irPara('pedidos')}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-dark-brown transition-colors cursor-pointer border-none">
          <i className="fas fa-cart-plus"></i> Criar pedido
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icone="fa-exclamation-triangle" cor="bg-red-100 text-red-600" rotulo="Atrasados" valor={atrasados.length}
              sub={atrasados.length ? brl(atrasados.reduce((a, p) => a + Number(p.total || 0), 0)) : 'nenhum'} />
        <Card icone="fa-truck" cor="bg-orange-100 text-primary" rotulo="Entregas hoje" valor={deHoje.length}
              sub={deHoje.length ? brl(deHoje.reduce((a, p) => a + Number(p.total || 0), 0)) : 'nenhuma'} />
        <Card icone="fa-calendar-day" cor="bg-blue-100 text-blue-600" rotulo="Amanhã" valor={amanha.length}
              sub={amanha.length ? brl(amanha.reduce((a, p) => a + Number(p.total || 0), 0)) : 'nenhuma'} />
        <Card icone="fa-clipboard-list" cor="bg-green-100 text-green-700" rotulo="Em aberto" valor={abertos.length} sub={brl(totalAberto)} />
      </div>

      {atrasados.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border-2 border-red-100 overflow-hidden">
          <p className="px-4 py-2.5 bg-red-50 text-sm font-bold text-red-700"><i className="fas fa-exclamation-triangle mr-2"></i>Entregas atrasadas (ainda em aberto)</p>
          <div className="divide-y divide-gray-100">{atrasados.map(p => <LinhaPedido key={p.id} p={p} mostrarData />)}</div>
        </div>
      )}

      {/* Agenda */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
          <div className="flex items-center gap-1">
            <button onClick={() => navegar(-1)} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer border-none text-text-dark"><i className="fas fa-chevron-left"></i></button>
            <button onClick={() => navegar(1)} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer border-none text-text-dark"><i className="fas fa-chevron-right"></i></button>
            <button onClick={() => { setRef(hj); setDiaSel(null) }} className="px-3 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer border-none text-sm font-semibold text-text-dark">Hoje</button>
            <p className="ml-2 font-bold text-text-dark capitalize">{titulo}</p>
          </div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {[['semana', 'Semana'], ['mes', 'Mês']].map(([v, l]) => (
              <button key={v} onClick={() => { setModo(v); setDiaSel(null) }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer border-none ${modo === v ? 'bg-primary text-white' : 'bg-transparent text-text-dark hover:bg-white'}`}>{l}</button>
            ))}
          </div>
        </div>

        {modo === 'semana' ? (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {dias.map(d => {
              const lista = porDia[d] ?? []
              const total = lista.reduce((a, p) => a + Number(p.total || 0), 0)
              return (
                <div key={d} className={`rounded-xl border p-2 min-h-[90px] ${d === hj ? 'border-primary bg-orange-50/40' : 'border-gray-100'}`}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <p className={`text-xs font-bold ${d === hj ? 'text-primary' : 'text-gray-500'}`}>{DIAS[deIso(d).getDay()]} {deIso(d).getDate()}</p>
                    {lista.length > 0 && <p className="text-[10px] text-gray-400">{brl(total)}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    {lista.map(p => <Chip key={p.id} p={p} />)}
                    {lista.length === 0 && <p className="text-[11px] text-gray-300">—</p>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DIAS.map(d => <p key={d} className="text-center text-[11px] font-semibold text-gray-400">{d}</p>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {dias.map(d => {
                const lista = porDia[d] ?? []
                const foraDoMes = deIso(d).getMonth() !== mesRef
                const abertosDia = lista.filter(p => p.situacao === 'aberto').length
                return (
                  <button key={d} onClick={() => setDiaSel(diaSel === d ? null : d)}
                          className={`rounded-lg border p-1 min-h-[64px] sm:min-h-[84px] text-left align-top cursor-pointer flex flex-col gap-0.5
                            ${d === diaSel ? 'border-primary ring-2 ring-primary/30' : d === hj ? 'border-primary' : 'border-gray-100'}
                            ${foraDoMes ? 'bg-gray-50 opacity-50' : 'bg-white hover:bg-orange-50/40'}`}>
                    <span className={`text-xs font-bold ${d === hj ? 'text-primary' : 'text-gray-500'}`}>{deIso(d).getDate()}</span>
                    {lista.length > 0 && (
                      <>
                        <span className="hidden sm:flex flex-col gap-0.5 w-full">
                          {lista.slice(0, 2).map(p => (
                            <span key={p.id} className={`block text-[10px] leading-tight px-1 py-0.5 rounded border truncate ${COR[p.situacao] ?? COR.outro}`}>
                              {p.numero} {info(p).nome}
                            </span>
                          ))}
                          {lista.length > 2 && <span className="text-[10px] text-gray-500">+{lista.length - 2}</span>}
                        </span>
                        <span className="sm:hidden flex gap-0.5 flex-wrap">
                          {abertosDia > 0 && <span className="text-[10px] font-bold px-1 rounded bg-orange-100 text-orange-800">{abertosDia}</span>}
                          {lista.length - abertosDia > 0 && <span className="text-[10px] font-bold px-1 rounded bg-green-100 text-green-800">{lista.length - abertosDia}</span>}
                        </span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
            {diaSel && (
              <div className="mt-4 border border-gray-100 rounded-xl overflow-hidden">
                <p className="px-3 py-2 bg-gray-50 text-sm font-bold text-text-dark">
                  {DIAS[deIso(diaSel).getDay()]}, {dataCurta(diaSel)} · {listaDia.length} pedido{listaDia.length !== 1 ? 's' : ''}
                </p>
                {listaDia.length === 0
                  ? <p className="px-3 py-3 text-sm text-gray-400">Nenhuma entrega neste dia.</p>
                  : <div className="divide-y divide-gray-100">{listaDia.map(p => <LinhaPedido key={p.id} p={p} />)}</div>}
              </div>
            )}
          </>
        )}

        <div className="flex gap-4 mt-3 text-[11px] text-gray-500">
          <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-200 mr-1 align-middle"></span>Em aberto</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-200 mr-1 align-middle"></span>Concluído</span>
        </div>
      </div>
    </div>
  )
}
