import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './firebaseAdmin.js'
import { HttpError } from './auth.js'

const API_URL       = 'https://api.bling.com.br/Api/v3'
const AUTHORIZE_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize'
const TOKEN_URL     = `${API_URL}/oauth/token`

// Tokens ficam só no servidor: as Regras do Firestore bloqueiam esta coleção para o navegador.
const tokenDoc = () => adminDb.collection('integracoes').doc('bling')

// Renova o access token quando faltar menos que isso para expirar
const MARGEM_MS = 5 * 60 * 1000

export function urlAutorizacao(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.BLING_CLIENT_ID,
    state,
  })
  return `${AUTHORIZE_URL}?${params}`
}

async function pedirToken(corpo) {
  const basic = Buffer.from(`${process.env.BLING_CLIENT_ID}:${process.env.BLING_CLIENT_SECRET}`).toString('base64')
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: '1.0',
      Authorization: `Basic ${basic}`,
      'enable-jwt': '1',
    },
    body: new URLSearchParams(corpo),
  })
  const dados = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const msg = dados?.error?.description || dados?.error_description || dados?.error?.message || `HTTP ${resp.status}`
    const err = new HttpError(resp.status === 400 || resp.status === 401 ? 401 : 502, `Bling recusou o token: ${msg}`)
    err.tokenInvalido = resp.status === 400 || resp.status === 401
    throw err
  }
  return dados
}

async function salvarTokens(dados, extra = {}) {
  const agora = Date.now()
  const registro = {
    accessToken:  dados.access_token,
    refreshToken: dados.refresh_token,
    expiraEm:     agora + (Number(dados.expires_in) || 21600) * 1000,
    // Refresh token do Bling vale 30 dias e é renovado a cada uso
    refreshExpiraEm: agora + 30 * 24 * 60 * 60 * 1000,
    renovadoEm:   FieldValue.serverTimestamp(),
    ...extra,
  }
  await tokenDoc().set(registro, { merge: true })
  return registro
}

export async function trocarCodigo(code, conectadoPor) {
  const dados = await pedirToken({ grant_type: 'authorization_code', code })
  return salvarTokens(dados, { conectadoPor, conectadoEm: FieldValue.serverTimestamp() })
}

export async function lerConexao() {
  const snap = await tokenDoc().get()
  return snap.exists && snap.data().refreshToken ? snap.data() : null
}

export async function desconectar() {
  await tokenDoc().delete()
}

// Usa o refresh token para obter um novo par de tokens.
export async function renovar(conexaoAtual) {
  const conexao = conexaoAtual ?? await lerConexao()
  if (!conexao) throw new HttpError(409, 'Bling não conectado.')
  try {
    const dados = await pedirToken({ grant_type: 'refresh_token', refresh_token: conexao.refreshToken })
    return await salvarTokens(dados)
  } catch (err) {
    // Outra execução pode ter renovado ao mesmo tempo (o refresh token muda a cada uso)
    if (err.tokenInvalido) {
      const recente = await lerConexao()
      if (recente && recente.refreshToken !== conexao.refreshToken) return recente
      throw new HttpError(409, 'A conexão com o Bling expirou. Conecte novamente.')
    }
    throw err
  }
}

async function accessTokenValido() {
  const conexao = await lerConexao()
  if (!conexao) throw new HttpError(409, 'Bling não conectado.')
  if (conexao.expiraEm - Date.now() > MARGEM_MS) return conexao.accessToken
  return (await renovar(conexao)).accessToken
}

const esperar = ms => new Promise(r => setTimeout(r, ms))

// Chamada autenticada à API v3. Renova o token se necessário e repete em caso de limite (429).
export async function blingFetch(caminho, { method = 'GET', body, query } = {}) {
  const url = new URL(API_URL + caminho)
  if (query) Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    if (Array.isArray(v)) v.forEach(x => url.searchParams.append(k, x))
    else url.searchParams.set(k, v)
  })

  let token = await accessTokenValido()
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const resp = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (resp.status === 401 && tentativa === 0) { token = (await renovar()).accessToken; continue }
    if (resp.status === 429) { await esperar(400 * (tentativa + 1)); continue }

    const texto = await resp.text()
    const dados = texto ? JSON.parse(texto) : null
    if (!resp.ok) {
      const e = dados?.error
      const detalhes = e?.fields?.map(f => f.msg).filter(Boolean).join(' ')
      throw new HttpError(resp.status >= 500 ? 502 : resp.status, `Bling: ${e?.description || e?.message || `HTTP ${resp.status}`}${detalhes ? ` — ${detalhes}` : ''}`)
    }
    return dados
  }
  throw new HttpError(503, 'Bling ocupado no momento. Tente novamente em instantes.')
}
