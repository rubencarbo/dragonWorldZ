// Capa de datos: Firestore si está configurado, localStorage en otro caso.
// Colecciones:
//   missions/{id}      → misiones publicadas desde Admin (DLC)
//   sprites/{charId}   → sprites personalizados de personajes
//   progress/{uid}     → progreso de cada jugador
import { db, firebaseEnabled, ensureUser } from '../firebase/index.js'
import { collection, doc, getDocs, setDoc, deleteDoc, getDoc } from 'firebase/firestore'

const LS = {
  get (k, def) {
    try { return JSON.parse(localStorage.getItem('dwz:' + k)) ?? def } catch { return def }
  },
  set (k, v) {
    try { localStorage.setItem('dwz:' + k, JSON.stringify(v)) } catch {}
  }
}

async function listCollection (name) {
  if (firebaseEnabled) {
    try {
      const snap = await getDocs(collection(db, name))
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    } catch (e) {
      console.warn('[repo] Firestore no disponible, uso local:', e.message)
    }
  }
  return Object.values(LS.get(name, {}))
}

async function saveDoc (name, id, data) {
  if (firebaseEnabled) await setDoc(doc(db, name, id), data)
  const all = LS.get(name, {})
  all[id] = { ...data, id }
  LS.set(name, all)
}

async function removeDoc (name, id) {
  if (firebaseEnabled) await deleteDoc(doc(db, name, id))
  const all = LS.get(name, {})
  delete all[id]
  LS.set(name, all)
}

export const missionsRepo = {
  list: () => listCollection('missions'),
  save: m => saveDoc('missions', m.id, m),
  remove: id => removeDoc('missions', id)
}

export const spritesRepo = {
  list: () => listCollection('sprites'),
  save: (id, s) => saveDoc('sprites', id, s),
  remove: id => removeDoc('sprites', id)
}

export const progressRepo = {
  async load () {
    const local = LS.get('progress', null)
    const user = await ensureUser()
    if (user) {
      try {
        const snap = await getDoc(doc(db, 'progress', user.uid))
        if (snap.exists()) return snap.data()
      } catch (e) { console.warn('[repo] progreso remoto no disponible:', e.message) }
    }
    return local
  },
  async save (data) {
    LS.set('progress', data)
    const user = await ensureUser()
    if (user) setDoc(doc(db, 'progress', user.uid), data).catch(() => {})
  },
  local: LS
}
