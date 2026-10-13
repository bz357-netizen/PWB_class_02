import { useEffect, useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from './firebase.js'
import { explainAuthError } from './authErrors.js'
import { deleteSettings, listSettings, restoreParams, saveSettings } from './userData.js'

export default function AccountMenu({ user, params, baseParams, onRestore }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('My terrain')
  const [saves, setSaves] = useState([])
  const [status, setStatus] = useState('')

  useEffect(() => {
    let cancel = false
    listSettings(user)
      .then((items) => {
        if (!cancel) setSaves(items)
      })
      .catch((error) => {
        if (!cancel) setStatus(explainAuthError(error))
      })
    return () => {
      cancel = true
    }
  }, [user])

  const run = async (label, action) => {
    setStatus(label)
    try {
      await action()
    } catch (error) {
      setStatus(explainAuthError(error))
    }
  }

  const save = () =>
    run('Saving…', async () => {
      await saveSettings(user, name, params)
      const items = await listSettings(user)
      setSaves(items)
      setStatus(`Saved. ${items.length} on this account`)
    })

  const restore = (item) => {
    onRestore(restoreParams(item.params, baseParams))
    setStatus(`Restored ${item.name}`)
  }

  const remove = (item) =>
    run('Removing…', async () => {
      await deleteSettings(item.id)
      const items = await listSettings(user)
      setSaves(items)
      setStatus(`Removed. ${items.length} left`)
    })

  return (
    <div className="account-menu">
      <button
        type="button"
        className="account-chip"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        {user.email}
      </button>
      {open ? (
        <div className="account-pop" role="dialog" aria-label="Account">
          <p className="account-email">{user.email}</p>
          <details>
            <summary>Saved setups</summary>
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
          </details>
          <button
            type="button"
            className="account-signout"
            onClick={() => signOut(auth)}
          >
            Sign out
          </button>
          {status ? <p>{status}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
