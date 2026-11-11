function Row({ label, value }) {
  return (
    <p className="inspect-row">
      <span>{label}</span>
      <b>{value}</b>
    </p>
  )
}

function formatVec(value) {
  if (!Array.isArray(value)) return '—'
  return value.map((n) => (Number.isFinite(n) ? n.toFixed(2) : '—')).join(', ')
}

export default function InspectPanel({ pick, onHide }) {
  if (!pick) {
    return (
      <aside className="inspect-panel panel-frame" aria-label="Inspect entity">
        <div className="panel-head">
          <div>
            <h2>Inspect</h2>
            <p className="agent-talk-where">Space · click an entity</p>
          </div>
          <button type="button" className="panel-hide" onClick={onHide}>
            Hide
          </button>
        </div>
        <div className="panel-body">
          <p className="panel-note">Click a walker, saucer, house, tree, lamp, car, or the ground. Space again leaves this mode.</p>
        </div>
      </aside>
    )
  }

  const t = pick.transform ?? {}
  const state = pick.state ?? {}
  const components = pick.components ?? []

  return (
    <aside className="inspect-panel panel-frame" aria-label={`Inspect ${pick.kind}`}>
      <div className="panel-head">
        <div>
          <h2>{pick.kind}</h2>
          <p className="agent-talk-where">{pick.id}</p>
        </div>
        <button type="button" className="panel-hide" onClick={onHide}>
          Hide
        </button>
      </div>
      <div className="panel-body inspect-body">
        <p className="panel-note">Transform</p>
        <Row label="Position" value={formatVec(t.position)} />
        <Row label="Scale" value={formatVec(t.scale)} />
        <Row label="Radius" value={t.radius == null ? '—' : t.radius.toFixed(2)} />
        <Row
          label="Lat / lon"
          value={t.lat == null ? '—' : `${t.lat.toFixed(1)}° / ${t.lon.toFixed(1)}°`}
        />
        <p className="panel-note">State</p>
        {Object.keys(state).length
          ? Object.entries(state).map(([key, value]) => (
              <Row
                key={key}
                label={key}
                value={typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : String(value)}
              />
            ))
          : (
            <p className="debug-line">No extra state.</p>
          )}
        <p className="panel-note">Components</p>
        <p className="inspect-tags">
          {components.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </p>
      </div>
    </aside>
  )
}
