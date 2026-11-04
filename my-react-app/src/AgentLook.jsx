import { LOOK_SLOTS, cycleAgentLook } from './planetAgent.js'

function pin(point) {
  if (!point) return undefined
  return { left: `${point.x}%`, top: `${point.y}%` }
}

export default function AgentLook({ look, onChange, onHide, anchors }) {
  const current = look ?? { head: 0, body: 0, legs: 0, feet: 0 }
  const turn = (slot, dir) => onChange(cycleAgentLook(current, slot, dir))

  return (
    <div className="agent-look" aria-label="Change walker look">
      <button
        type="button"
        className="agent-look-x"
        style={pin(anchors?.close)}
        onClick={onHide}
        aria-label="Close look"
      >
        ×
      </button>
      {LOOK_SLOTS.map((slot) => {
        const row = anchors?.[slot.id]
        return (
          <div key={slot.id} className={`agent-look-row is-${slot.id}`}>
            <button
              type="button"
              className="agent-look-arrow"
              style={pin(row?.left)}
              onClick={() => turn(slot.id, -1)}
              aria-label={`Previous ${slot.label}`}
            >
              ‹
            </button>
            <button
              type="button"
              className="agent-look-arrow"
              style={pin(row?.right)}
              onClick={() => turn(slot.id, 1)}
              aria-label={`Next ${slot.label}`}
            >
              ›
            </button>
          </div>
        )
      })}
    </div>
  )
}
