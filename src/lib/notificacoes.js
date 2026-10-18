import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging'
import { app } from './firebase.js'
import { api } from './api.js'

// Chave pública "Web Push" do Firebase (Configurações do projeto → Cloud Messaging → Certificados push da Web).
// É pública por natureza: pode ficar no código.
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY || ''
const CHAVE_TOKEN = 'notificacoes:token'

export const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
export const instalado = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

// 'ok' | 'sem-suporte' | 'ios-instalar' | 'sem-chave'
export async function suporte() {
  if (!VAPID_KEY) return 'sem-chave'
  if (ehIOS() && !instalado()) return 'ios-instalar'
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !(await isSupported().catch(() => false))) return 'sem-suporte'
  return 'ok'
}

export const ativadoNesteAparelho = () => {
  try { return !!localStorage.getItem(CHAVE_TOKEN) && Notification.permission === 'granted' } catch { return false }
}

function nomeAparelho() {
  const ua = navigator.userAgent
  const sistema = /android/i.test(ua) ? 'Android' : ehIOS() ? 'iPhone/iPad' : /windows/i.test(ua) ? 'Windows' : /mac/i.test(ua) ? 'Mac' : 'Outro'
  const nav = /edg/i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : ''
  return `${sistema}${nav ? ' · ' + nav : ''}`
}

export async function ativarNotificacoes() {
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('Permissão negada. Libere as notificações nas configurações do navegador para este site.')
  const registro = await navigator.serviceWorker.ready
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registro })
  if (!token) throw new Error('Não foi possível ativar as notificações neste aparelho.')
  await api('/notificacoes', { method: 'POST', body: { acao: 'registrar', token, aparelho: nomeAparelho() } })
  try { localStorage.setItem(CHAVE_TOKEN, token) } catch {}
  return token
}

export async function desativarNotificacoes() {
  const token = localStorage.getItem(CHAVE_TOKEN)
  if (token) {
    try { await api('/notificacoes', { method: 'POST', body: { acao: 'remover', token } }) } catch {}
    try { await deleteToken(getMessaging(app)) } catch {}
  }
  try { localStorage.removeItem(CHAVE_TOKEN) } catch {}
}

export async function testarNotificacao() {
  const token = localStorage.getItem(CHAVE_TOKEN)
  return api('/notificacoes', { method: 'POST', body: { acao: 'testar', token } })
}

// Notificação gerada no próprio aparelho (ex.: fila offline enviada)
export async function notificarLocal(titulo, corpo, tag) {
  try {
    if (Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return
    const registro = await navigator.serviceWorker.ready
    await registro.showNotification(titulo, {
      body: corpo, tag, icon: '/img/favicon_io/android-chrome-192x192.png', data: { url: '/admin/dashboard' },
    })
  } catch {}
}
