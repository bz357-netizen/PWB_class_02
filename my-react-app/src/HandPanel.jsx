import { useEffect, useRef, useState } from 'react'
import { handSession, requestTerrainReset, subscribeHand } from './handSession.js'
import { disableHandTracking, enableHandTracking } from './handTracker.js'

function poseLabel(side, pose) {
  if (pose === 'off') return '—'
  if (pose === 'none') return 'None'
  if (side === 'left') return pose === 'aiming' ? 'Orbiting' : 'Paused'
  if (pose === 'aiming') return 'Aiming'
  if (pose === 'raising') return 'Raising'
  if (pose === 'digging') return 'Digging'
  if (pose === 'closed') return 'Holding'
  return '—'
}

const HINT_KEY = 'pwb-hand-hint-seen'

function readHintSeen() {
  try {
    return localStorage.getItem(HINT_KEY) === '1'
  } catch {
    return false
  }
}

export default function HandPanel({ sculptable, onHide, flush = false }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [status, setStatus] = useState(handSession.status)
  const [detail, setDetail] = useState(handSession.detail)
  const [leftPose, setLeftPose] = useState(handSession.hands.left.pose)
  const [rightPose, setRightPose] = useState(handSession.hands.right.pose)
  const [sensitivity, setSensitivity] = useState(handSession.sensitivity)
  const [orbit, setOrbit] = useState(handSession.orbit)
  const [reach, setReach] = useState(handSession.reach)
  const [hintSeen, setHintSeen] = useState(() => readHintSeen())
  const busy = status === 'loading' || status === 'requesting'
  const showHint =
    cameraOn && !hintSeen && (status === 'searching' || status === 'tracking')

  const dismissHint = () => {
    setHintSeen(true)
    try {
      localStorage.setItem(HINT_KEY, '1')
    } catch {
      // Private browsing can block storage; the hint just shows again next visit.
    }
  }

  useEffect(() => subscribeHand(() => {
    setStatus(handSession.status)
    setDetail(handSession.detail)
    setLeftPose(handSession.hands.left.pose)
    setRightPose(handSession.hands.right.pose)
  }), [])

  useEffect(() => {
    handSession.sculptable = sculptable
  }, [sculptable])

  useEffect(() => {
    if (!cameraOn) {
      disableHandTracking()
      return undefined
    }
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return undefined
    enableHandTracking(video, canvas)
    return () => disableHandTracking()
  }, [cameraOn])

  useEffect(() => () => disableHandTracking(), [])

  const fill = ((sensitivity - 0.25) / (1.4 - 0.25)) * 100
  const reachFill = ((reach - 1) / (2.4 - 1)) * 100
  const orbitFill = ((orbit - 0.25) / (2.2 - 0.25)) * 100

  return (
    <>
    {showHint ? (
      <div className="hand-hint" role="status">
        <span>
          <b>Left open palm:</b> turn the view. <b>Right open palm:</b> aim the ring.{' '}
          <b>Right fist:</b> move up to raise, down to dig.
        </span>
        <button type="button" onClick={dismissHint}>
          Got it
        </button>
      </div>
    ) : null}
    <aside className={`hand-panel${flush ? ' is-flush' : ''}`} aria-label="Hand tracking">
      <div className="hand-head">
        <h2>Hand</h2>
        <span className={`hand-status is-${status}`}>{detail}</span>
        {onHide ? (
          <button type="button" className="panel-hide" onClick={onHide}>
            Hide
          </button>
        ) : null}
      </div>
      <div className="hand-lines" aria-live="polite">
        <p className={`hand-status is-${leftPose}`}>
          <i className="hand-swatch is-left" />
          Left: {poseLabel('left', leftPose)}
        </p>
        <p className={`hand-status is-${rightPose}`}>
          <i className="hand-swatch is-right" />
          Right: {poseLabel('right', rightPose)}
        </p>
      </div>
      <div className="btn-row">
        <button
          type="button"
          className={cameraOn ? 'is-on' : ''}
          disabled={busy}
          onClick={() => setCameraOn((value) => !value)}
        >
          {cameraOn ? 'Camera off' : 'Camera on'}
        </button>
        <button type="button" onClick={requestTerrainReset} disabled={!sculptable}>
          Reset terrain
        </button>
      </div>
      {cameraOn ? (
        <div className="hand-preview">
          <video ref={videoRef} playsInline muted autoPlay />
          <canvas ref={canvasRef} />
        </div>
      ) : null}
      <label className="slider-row">
        <span className="slider-meta">
          <span className="slider-label">Reach</span>
          <span className="slider-value">{reach.toFixed(2)}</span>
        </span>
        <input
          type="range"
          min={1}
          max={2.4}
          step={0.05}
          value={reach}
          style={{ '--fill': `${reachFill}%` }}
          onChange={(event) => {
            const next = Number(event.target.value)
            setReach(next)
            handSession.reach = next
          }}
        />
      </label>
      <label className="slider-row">
        <span className="slider-meta">
          <span className="slider-label">Orbit</span>
          <span className="slider-value">{orbit.toFixed(2)}</span>
        </span>
        <input
          type="range"
          min={0.25}
          max={2.2}
          step={0.05}
          value={orbit}
          style={{ '--fill': `${orbitFill}%` }}
          onChange={(event) => {
            const next = Number(event.target.value)
            setOrbit(next)
            handSession.orbit = next
          }}
        />
      </label>
      <label className="slider-row">
        <span className="slider-meta">
          <span className="slider-label">Sensitivity</span>
          <span className="slider-value">{Math.round(sensitivity * 100)}%</span>
        </span>
        <input
          type="range"
          min={0.25}
          max={1.4}
          step={0.05}
          value={sensitivity}
          style={{ '--fill': `${fill}%` }}
          onChange={(event) => {
            const next = Number(event.target.value)
            setSensitivity(next)
            handSession.sensitivity = next
          }}
        />
      </label>
      <p className="panel-note">
        {sculptable
          ? 'Your left hand orbits the view. Move the open palm sideways to turn and up or down to tilt. Close that fist, or take the hand away, and the camera stops. Your right hand sculpts: an open palm places the blue ring, a fist held up keeps raising the ground, and a fist held down keeps digging. Bring that fist closer to sculpt faster. The mouse can still orbit.'
          : 'The left hand can still orbit the view. Open Field or Shaders to sculpt the terrain.'}
      </p>
    </aside>
    </>
  )
}
