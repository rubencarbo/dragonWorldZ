// Inicialización opcional de Firebase. Si no hay variables VITE_FIREBASE_*,
// el juego funciona en modo local (localStorage) sin romper nada.
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

const env = import.meta.env
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
}

export const firebaseEnabled = Boolean(config.apiKey && config.projectId)

export const app = firebaseEnabled ? initializeApp(config) : null
export const db = app ? getFirestore(app) : null
export const auth = app ? getAuth(app) : null

// Resuelve con el usuario (anónimo si hace falta) o null en modo local
export function ensureUser () {
  if (!auth) return Promise.resolve(null)
  return new Promise(resolve => {
    const off = onAuthStateChanged(auth, user => {
      off()
      if (user) resolve(user)
      else signInAnonymously(auth).then(c => resolve(c.user)).catch(() => resolve(null))
    })
  })
}
