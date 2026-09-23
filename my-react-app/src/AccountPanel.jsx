import { useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth } from './firebase.js'
import { deleteSettings, listSettings, restoreParams, saveSettings } from './userData.js'

function explain(error) {
  if (error.code === 'auth/configuration-not-found' || error.code === 'auth/operation-not-allowed') {
    return 'In Firebase, open Authentication, click Get started, then turn on Email/Password.'
  }
  if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
    return 'Email or password does not match.'
  }
  if (error.code === 'auth/email-already-in-use') {
    return 'That email already has an account. Use Sign in.'
  }
  if (error.code === 'permission-denied' || /insufficient permissions/i.test(error.message)) {
    return 'Blocked by rules. Publish the settings rules, then sign in again.'
  }
  return error.message
}

export default function AccountPanel({ params, baseParams, onRestore }) {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('My terrain')
  const [saves, setSaves] = useState([])
  const [status, setStatus] = useState('Sign in to save this setup')

  const refresh = async (nextUser) => {
    const items = await listSettings(nextUser)
    setSaves(items)
    return items
  }

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next)
      setSaves([])
      if (!next) {
        setStatus('Sign in to save this setup')
        return
      }
      setStatus(next.email)
      refresh(next).catch((error) => setStatus(explain(error)))
    })
  }, [])

  const run = async (label, action) => {
    setStatus(label)
    try {
      await action()
    } catch (error) {
      setStatus(explain(error))
    }
  }

  const createAccount = () =>
    run('Creating account…', async () => {
      await createUserWithEmailAndPassword(auth, email, password)
      setPassword('')
      setStatus('Account created')
    })

  const signIn = () =>
    run('Signing in…', async () => {
      await signInWithEmailAndPassword(auth, email, password)
      setPassword('')
    })

  const save = () =>
    run('Saving…', async () => {
      await saveSettings(user, name, params)
      const items = await refresh(user)
      setStatus(`Saved. ${items.length} on this account`)
    })

  const restore = (item) => {
    onRestore(restoreParams(item.params, baseParams))
    setStatus(`Restored ${item.name}`)
  }

  const remove = (item) =>
    run('Removing…', async () => {
      await deleteSettings(item.id)
      const items = await refresh(user)
      setStatus(`Removed. ${items.length} left`)
    })

  return (
    <div className="account-panel">
      <p className="account-label">Account</p>
      {user ? (
        <>
          <p className="account-email">{user.email}</p>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Setup name"
          />
          <button type="button" onClick={save}>
            Save setup
          </button>
          <ul>
            {saves.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => restore(item)}>
                  {item.name}
                </button>
                <button type="button" onClick={() => remove(item)} aria-label={`Remove ${item.name}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
          <div className="account-actions">
            <button type="button" onClick={createAccount}>
              Create
            </button>
            <button type="button" onClick={signIn}>
              Sign in
            </button>
          </div>
        </>
      )}
      <p>{status}</p>
    </div>
  )
}
