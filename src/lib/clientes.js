// Utilidades de clientes compartilhadas entre as páginas do admin (Clientes, Criar Pedido...)

export function soDigitos(v) {
  return String(v ?? '').replace(/\D/g, '')
}

export function formatarDocumento(doc) {
  const d = soDigitos(doc)
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return doc || ''
}

const semAcento = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// Nome principal para exibir: apelido, se houver; senão o nome do Bling
export function nomeExibicao(c) {
  return c.apelido?.trim() || c.nome || ''
}

// Destaques que aparecem sempre com o cliente: os do grupo (rede) + os da filial
export function destaquesDoCliente(c, grupos = []) {
  const grupo = c.grupoId ? grupos.find(g => g.id === c.grupoId) : null
  return [...new Set([...(grupo?.destaques ?? []), ...(c.destaques ?? [])])]
}

// Busca por apelido, nome, fantasia, código, grupo, destaques, CPF/CNPJ ou telefone
export function filtrarClientes(lista, termo, grupos = []) {
  const t = semAcento(termo).trim()
  if (!t) return lista
  const dig = soDigitos(termo)
  const nomeGrupo = id => grupos.find(g => g.id === id)?.nome ?? ''
  return lista.filter(c => {
    const texto = semAcento(`${c.apelido} ${c.nome} ${c.fantasia} ${c.codigo} ${nomeGrupo(c.grupoId)} ${(c.destaques ?? []).join(' ')}`)
    if (texto.includes(t)) return true
    if (dig.length >= 3) {
      return [c.numeroDocumento, c.telefone, c.celular].some(v => soDigitos(v).includes(dig))
    }
    return false
  })
}

export function ordenarClientes(lista) {
  return [...lista].sort((a, b) => semAcento(nomeExibicao(a)).localeCompare(semAcento(nomeExibicao(b))))
}

// Consultas públicas (sem login) para preencher o formulário
export async function buscarCep(cep) {
  const d = soDigitos(cep)
  if (d.length !== 8) return null
  const r = await fetch(`https://viacep.com.br/ws/${d}/json/`)
  const j = await r.json()
  if (j.erro) return null
  return { endereco: j.logradouro, bairro: j.bairro, municipio: j.localidade, uf: j.uf, complemento: j.complemento }
}

export async function buscarCnpj(cnpj) {
  const d = soDigitos(cnpj)
  if (d.length !== 14) return null
  const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`)
  if (!r.ok) return null
  const j = await r.json()
  return {
    nome:     j.razao_social || '',
    fantasia: j.nome_fantasia || '',
    email:    (j.email || '').toLowerCase(),
    telefone: j.ddd_telefone_1 || '',
    endereco: {
      cep:         soDigitos(j.cep),
      endereco:    [j.descricao_tipo_de_logradouro, j.logradouro].filter(Boolean).join(' '),
      numero:      j.numero || '',
      complemento: j.complemento || '',
      bairro:      j.bairro || '',
      municipio:   j.municipio || '',
      uf:          j.uf || '',
    },
  }
}
