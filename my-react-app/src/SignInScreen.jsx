import { useState } from 'react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from './firebase.js'
import { explainAuthError } from './authErrors.js'

export default function SignInScreen({ session }) {
  const [mode, setMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const creating = mode === 'create'
  const configured = session.missingFirebaseConfig.length === 0

  const submit = async (event) => {
    event.preventDefault()
    if (!configured || !auth) return
    const nextEmail = email.trim()
    if (!nextEmail || !password) {
      setStatus('Enter an email and a password.')
      return
    }
    if (creating && password.length < 6) {
      setStatus('Use at least 6 characters for the password.')
      return
    }
    setBusy(true)
    setStatus(creating ? 'Creating account…' : 'Signing in…')
    try {
      if (creating) await createUserWithEmailAndPassword(auth, nextEmail, password)
      else await signInWithEmailAndPassword(auth, nextEmail, password)
      setPassword('')
    } catch (error) {
      setStatus(explainAuthError(error))
      setBusy(false)
    }
  }

  return (
    <main className="gate">
      <div className="gate-sky" aria-hidden="true" />
      <div className="gate-ridge" aria-hidden="true" />
      <div className="gate-mist" aria-hidden="true" />
      <section className="gate-card" aria-labelledby="gate-title">
        <p className="kicker">
          <span className="tick is-live" aria-hidden="true" />
          PWB Class
        </p>
        <h1 id="gate-title">Procedural World Building</h1>
        <p className="gate-tag">A landscape grown from noise, weather, and the shape of the ground.</p>
        {!session.ready ? (
          <p className="gate-status" role="status">Checking the session…</p>
        ) : !configured ? (
          <p className="gate-status is-error" role="alert">
            Sign-in is not configured. Add {session.missingFirebaseConfig.join(', ')} to the local environment, then reload.
          </p>
        ) : (
          <form onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete={creating ? 'new-password' : 'current-password'}
                value={password}
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button type="submit" className="gate-primary" disabled={busy}>
              {creating ? 'Create account' : 'Sign in'}
            </button>
            <button
              type="button"
              className="gate-switch"
              disabled={busy}
              onClick={() => {
                setMode(creating ? 'sign-in' : 'create')
                setStatus('')
              }}
            >
              {creating ? 'Already have an account? Sign in' : 'Create account'}
            </button>
            <p className={`gate-status${status && !busy ? ' is-error' : ''}`} role="status">
              {status}
            </p>
          </form>
        )}
      </section>
    </main>
  )
}
