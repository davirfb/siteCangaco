import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// Credencial vem da variável de ambiente FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço)
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) })
}

export const adminAuth = getAuth()
export const adminDb   = getFirestore()
