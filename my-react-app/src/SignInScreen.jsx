import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { auth } from './firebase.js'
import { explainAuthError } from './authErrors.js'

export default function SignInScreen({ session, onGuest }) {
  const [mode, setMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [tone, setTone] = useState('')
  const [busy, setBusy] = useState(false)
  const creating = mode === 'create'
  const configured = session.missingFirebaseConfig.length === 0

  const say = (message, nextTone = 'error') => {
    setStatus(message)
    setTone(nextTone)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!configured || !auth) return
    const nextEmail = email.trim()
    if (!nextEmail || !password) {
      say('Enter an email and a password.')
      return
    }
    if (creating && password.length < 6) {
      say('Use at least 6 characters for the password.')
      return
    }
    setBusy(true)
    say(creating ? 'Creating account…' : 'Signing in…', '')
    try {
      if (creating) await createUserWithEmailAndPassword(auth, nextEmail, password)
      else await signInWithEmailAndPassword(auth, nextEmail, password)
      setPassword('')
    } catch (error) {
      say(explainAuthError(error))
      setBusy(false)
    }
  }

  const resetPassword = async () => {
    if (!configured || !auth) return
    const nextEmail = email.trim()
    if (!nextEmail) {
      say('Enter your email above, then press Forgot password again.')
      return
    }
    setBusy(true)
    say('Sending the reset email…', '')
    try {
      await sendPasswordResetEmail(auth, nextEmail)
      say(`If ${nextEmail} has an account, a reset link is on its way. Check the inbox and spam folder.`, 'ok')
    } catch (error) {
      say(explainAuthError(error))
    }
    setBusy(false)
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
        ) : (
          <>
            {!configured ? (
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
                {!creating ? (
                  <button type="button" className="gate-link" disabled={busy} onClick={resetPassword}>
                    Forgot password?
                  </button>
                ) : null}
                <button type="submit" className="gate-primary" disabled={busy}>
                  {creating ? 'Create account' : 'Sign in'}
                </button>
                <button
                  type="button"
                  className="gate-switch"
                  disabled={busy}
                  onClick={() => {
                    setMode(creating ? 'sign-in' : 'create')
                    say('', '')
                  }}
                >
                  {creating ? 'Already have an account? Sign in' : 'Create account'}
                </button>
                <p className={`gate-status${tone ? ` is-${tone}` : ''}`} role="status">
                  {status}
                </p>
              </form>
            )}
            <div className="gate-guest">
              <button type="button" className="gate-switch" disabled={busy} onClick={onGuest}>
                Look around as a guest
              </button>
              <p className="gate-note">Guests can explore and sculpt. Sign in to save setups.</p>
              <p className="gate-note gate-small">
                Best on a laptop with a webcam. On a phone the terrain runs slower and hand control is limited.
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
