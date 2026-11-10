import { useEffect, useRef, useState } from 'react'
import { ufoChips, ufoGreeting, ufoReply } from './ufoTalk.js'

export default function UfoTalk({ onHide }) {
  const [log, setLog] = useState(() => [{ from: 'ufo', text: ufoGreeting() }])
  const [draft, setDraft] = useState('')
  const scroller = useRef(null)

  useEffect(() => {
    const node = scroller.current
    if (node) node.scrollTop = node.scrollHeight
  }, [log])

  const say = (line) => {
    const text = String(line ?? '').trim()
    if (!text) return
    const reply = ufoReply(text)
    if (!reply) return
    setLog((current) => [...current.slice(-8), { from: 'you', text }, { from: 'ufo', text: reply }])
    setDraft('')
  }

  return (
    <aside className="agent-talk ufo-talk panel-frame" aria-label="Talk with the saucer">
      <div className="panel-head">
        <div>
          <h2>Saucer</h2>
          <p className="agent-talk-where">middle of the ocean</p>
        </div>
        <button type="button" className="panel-hide" onClick={onHide}>
          Hide
        </button>
      </div>
      <div className="agent-talk-log" ref={scroller}>
        {log.map((line, index) => (
          <p key={`${index}-${line.from}`} className={`agent-talk-line is-${line.from}`}>
            <span>{line.from === 'you' ? 'You' : 'Saucer'}</span>
            {line.text}
          </p>
        ))}
      </div>
      <div className="agent-talk-chips">
        {ufoChips().map((chip) => (
          <button key={chip.id} type="button" onClick={() => say(chip.label)}>
            {chip.label}
          </button>
        ))}
      </div>
      <form
        className="agent-talk-form"
        onSubmit={(event) => {
          event.preventDefault()
          say(draft)
        }}
      >
        <input
          type="text"
          value={draft}
          maxLength={120}
          placeholder="Ask the saucer…"
          aria-label="Message to the saucer"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit">Say</button>
      </form>
    </aside>
  )
}
