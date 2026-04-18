import { initializeApp }  from 'firebase/app'
import { getAuth }         from 'firebase/auth'
import { getFirestore }    from 'firebase/firestore'
import { getStorage }      from 'firebase/storage'

const firebaseConfig = {
  apiKey:            'AIzaSyAS6Oo0IK0m0FepGQuw5GlNZ-GYuEcJLxE',
  authDomain:        'admcangaco-dc5f9.firebaseapp.com',
  projectId:         'admcangaco-dc5f9',
  storageBucket:     'admcangaco-dc5f9.firebasestorage.app',
  messagingSenderId: '256119129002',
  appId:             '1:256119129002:web:c7e2324c01efe43ce4e1d3',
  measurementId:     'G-WE0RGZFQFL',
}

const app = initializeApp(firebaseConfig)

export const auth    = getAuth(app)
export const db      = getFirestore(app)
export const storage = getStorage(app)
