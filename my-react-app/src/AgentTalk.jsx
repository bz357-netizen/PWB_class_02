import { useEffect, useRef, useState } from 'react'
import { agentGreeting, agentReply, placeLabel, talkChips } from './agentTalk.js'

export default function AgentTalk({ ctx, onEmote, onHide, onLook }) {
  const hereRef = useRef(ctx)
  const [log, setLog] = useState(() => [{ from: 'walker', text: agentGreeting(hereRef.current).text }])
  const [draft, setDraft] = useState('')
  const scroller = useRef(null)
  const greeted = useRef(false)

  useEffect(() => {
    if (greeted.current) return
    greeted.current = true
    onEmote?.(agentGreeting(hereRef.current).emote)
  }, [onEmote])

  useEffect(() => {
    const node = scroller.current
    if (node) node.scrollTop = node.scrollHeight
  }, [log])

  const say = (line) => {
    const text = String(line ?? '').trim()
    if (!text) return
    const reply = agentReply(text, hereRef.current)
    if (!reply) return
    setLog((current) => [...current.slice(-8), { from: 'you', text }, { from: 'walker', text: reply.text }])
    setDraft('')
    onEmote?.(reply.emote)
  }

  const here = hereRef.current
  const chips = talkChips(here)

  return (
    <aside className="agent-talk panel-frame" aria-label="Talk with the walker">
      <div className="panel-head">
        <div>
          <h2>Walker</h2>
          <p className="agent-talk-where">{placeLabel(here.place)}</p>
        </div>
        <div className="agent-talk-tools">
          {onLook ? (
            <button type="button" className="agent-talk-look" onClick={onLook} aria-label="Change look">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.2 5.2 4 7.4V12h3.1v8.2h9.8V12H20V7.4l-4.2-2.2-2.1 2.1h-3.4L8.2 5.2z" />
              </svg>
            </button>
          ) : null}
          <button type="button" className="panel-hide" onClick={onHide}>
            Hide
          </button>
        </div>
      </div>
      <div className="agent-talk-log" ref={scroller}>
        {log.map((line, index) => (
          <p key={`${index}-${line.from}`} className={`agent-talk-line is-${line.from}`}>
            <span>{line.from === 'you' ? 'You' : 'Walker'}</span>
            {line.text}
          </p>
        ))}
      </div>
      <div className="agent-talk-chips">
        {chips.map((chip) => (
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
          placeholder="Say something…"
          aria-label="Message to the walker"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit">Say</button>
      </form>
    </aside>
  )
}
