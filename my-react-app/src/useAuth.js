import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, missingFirebaseConfig } from './firebase.js'

export function useAuth() {
  const [user, setUser] = useState(() => (auth ? undefined : null))

  useEffect(() => {
    if (!auth) return undefined
    return onAuthStateChanged(auth, (next) => setUser(next))
  }, [])

  return {
    user: user || null,
    ready: user !== undefined,
    missingFirebaseConfig,
  }
}
