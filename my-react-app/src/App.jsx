import { useRef, useState } from 'react'
import GalaxyCanvas from './GalaxyCanvas.jsx'
import './App.css'

const initialParams = {
  spin: 0.35,
  starSize: 0.7,
  coreGlow: 0.85,
}

function Slider({ label, min, max, step, value, onChange }) {
  const fill = ((value - min) / (max - min)) * 100

  return (
    <label className="slider-row">
      <span className="slider-meta">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': `${fill}%` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function App() {
  const paramsRef = useRef({ ...initialParams })
  const [spin, setSpin] = useState(initialParams.spin)
  const [starSize, setStarSize] = useState(initialParams.starSize)
  const [coreGlow, setCoreGlow] = useState(initialParams.coreGlow)

  const updateSpin = (next) => {
    paramsRef.current.spin = next
    setSpin(next)
  }

  const updateStarSize = (next) => {
    paramsRef.current.starSize = next
    setStarSize(next)
  }

  const updateCoreGlow = (next) => {
    paramsRef.current.coreGlow = next
    setCoreGlow(next)
  }

  return (
    <div className="app">
      <GalaxyCanvas paramsRef={paramsRef} />

      <div className="hud">
        <header className="title-block">
          <p className="kicker">
            <span className="tick" aria-hidden="true" />
            PWB Class
          </p>
          <h1>Milky Way</h1>
          <p className="hint">Drag to orbit · Scroll to zoom</p>
        </header>

        <aside className="side-panel" aria-label="Scene controls">
          <h2>Controls</h2>
          <p className="panel-note">Scene parameters</p>

          <Slider
            label="Galaxy spin"
            min={0}
            max={1}
            step={0.01}
            value={spin}
            onChange={updateSpin}
          />
          <Slider
            label="Star size"
            min={0.2}
            max={1.5}
            step={0.01}
            value={starSize}
            onChange={updateStarSize}
          />
          <Slider
            label="Core glow"
            min={0.2}
            max={1.5}
            step={0.01}
            value={coreGlow}
            onChange={updateCoreGlow}
          />
        </aside>
      </div>
    </div>
  )
}

export default App
