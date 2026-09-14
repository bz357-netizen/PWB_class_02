import { useEffect, useRef, useState } from 'react'
import GalaxyCanvas from './GalaxyCanvas.jsx'
import NoiseMap2D from './NoiseMap2D.jsx'
import {
  BLEND_OPS,
  MAX_NOISE_LAYERS,
  NOISE_EQUATIONS,
  SHAPE_OPS,
  createNoiseLayer,
  getNoiseEquation,
  getShapeOp,
} from './noise.js'
import { getParamHelp } from './paramHelp.js'
import ParamTooltip from './ParamTooltip.jsx'
import { WEATHER_OPS } from './daylight.js'
import { EVENT_SIMS, formatEventTime } from './eventSim.js'
import { CLIMATES, COUNTRIES } from './livingSim.js'
import './App.css'

const PLANE_RESOLUTIONS = [95, 300, 500, 1000]

const initialParams = {
  resolution: 300,
  showMesh: true,
  timeOfDay: 12,
  weather: 'clear',
  simEvent: 'none',
  simPlaying: false,
  simTime: 0,
  climate: 'temperate',
  country: 'japan',
  layers: [
    createNoiseLayer({
      name: 'Base',
      frequency: 0.06,
      amplitude: 2.2,
      octaves: 3,
      mix: 1,
      blend: 'add',
    }),
    createNoiseLayer({
      name: 'Detail',
      equation: 'value-fbm',
      frequency: 0.14,
      amplitude: 0.55,
      octaves: 3,
      persistence: 0.32,
      mix: 0.45,
      blend: 'add',
      offsetX: 8,
      offsetZ: -4,
    }),
    createNoiseLayer({
      name: 'Ridges',
      equation: 'ridged-fbm',
      frequency: 0.11,
      amplitude: 1.05,
      octaves: 2,
      mix: 0.38,
      blend: 'max',
      shape: 'ridged',
      offsetX: -12,
      offsetZ: 6,
    }),
  ],
}

function Slider({ label, min, max, step, value, onChange, format, helpKey }) {
  const fill = ((value - min) / (max - min)) * 100
  const readout = format ? format(value) : value.toFixed(2)
  const help = getParamHelp(label, helpKey)

  return (
    <label className="slider-row">
      <span className="slider-meta">
        <ParamTooltip label={label} help={help} />
        <span className="slider-value">{readout}</span>
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

function Select({ label, value, onChange, options, helpKey }) {
  const help = getParamHelp(label, helpKey)

  return (
    <label className="select-row">
      <span className="slider-meta">
        <ParamTooltip label={label} help={help} />
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function App() {
  const paramsRef = useRef({
    ...initialParams,
    layers: initialParams.layers.map((layer) => ({ ...layer })),
  })
  const [params, setParams] = useState(initialParams)
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!params.simPlaying || params.simEvent === 'none') return undefined
    let frame = 0
    let last = performance.now()
    const tick = (now) => {
      if (!paramsRef.current.simPlaying) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      let next = paramsRef.current.simTime + dt * 0.045
      let playing = true
      if (next >= 1) {
        next = 1
        playing = false
      }
      paramsRef.current.simTime = next
      paramsRef.current.simPlaying = playing
      setParams((prev) => ({ ...prev, simTime: next, simPlaying: playing }))
      if (playing) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [params.simPlaying, params.simEvent])

  const commit = (next) => {
    paramsRef.current = next
    setParams(next)
  }

  const bind = (key) => (next) => {
    commit({ ...params, [key]: next })
  }

  const updateLayer = (key) => (next) => {
    const layers = params.layers.map((layer, index) =>
      index === selected ? { ...layer, [key]: next } : layer,
    )
    commit({ ...params, layers })
  }

  const addLayer = () => {
    if (params.layers.length >= MAX_NOISE_LAYERS) return
    const index = params.layers.length
    const layers = [
      ...params.layers,
      createNoiseLayer({
        name: `Layer ${index + 1}`,
        frequency: 0.1 + index * 0.06,
        amplitude: 1.2,
        mix: 0.5,
        blend: 'add',
        offsetX: index * 5,
        offsetZ: -index * 3,
      }),
    ]
    commit({ ...params, layers })
    setSelected(index)
  }

  const removeLayer = () => {
    if (params.layers.length <= 1) return
    const layers = params.layers.filter((_, index) => index !== selected)
    const nextIndex = Math.min(selected, layers.length - 1)
    commit({ ...params, layers })
    setSelected(nextIndex)
  }

  const layer = params.layers[selected] ?? params.layers[0]
  const shapeOp = getShapeOp(layer.shape)
  const noiseEq = getNoiseEquation(layer.equation)
  const layerOptions = params.layers.map((item, index) => ({
    id: String(index),
    label: `${index + 1} · ${item.name}`,
  }))

  return (
    <div className="app">
      <GalaxyCanvas paramsRef={paramsRef} />

      <div className="hud">
        <header className="title-block">
          <p className="kicker">
            <span className="tick" aria-hidden="true" />
            PWB Class
          </p>
          <h1>Noise field</h1>
          <p className="hint">Drag to orbit · Mesh shows sun and shadow</p>
        </header>

        <NoiseMap2D params={params} selected={selected} />

        <aside className="side-panel" aria-label="Scene controls">
          <h2>Controls</h2>
          <p className="panel-note">Hover a label for help.</p>

          <h2 className="panel-sub">Daylight</h2>
          <p className="panel-note">Time and weather on the terrace</p>
          <Slider
            label="Time of day"
            min={0}
            max={24}
            step={0.05}
            value={params.timeOfDay}
            onChange={bind('timeOfDay')}
            format={(value) => {
              const wrapped = ((value % 24) + 24) % 24
              const hours = Math.floor(wrapped)
              const mins = Math.round((wrapped - hours) * 60) % 60
              return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
            }}
          />
          <Select
            label="Weather"
            value={params.weather}
            onChange={bind('weather')}
            options={WEATHER_OPS}
          />

          <h2 className="panel-sub">Simulation map</h2>
          <p className="panel-note">Seasonal event, erosion, or living settlement</p>
          <div className="layer-actions">
            <button
              type="button"
              className={params.simEvent === 'living' ? 'is-on' : ''}
              onClick={() => {
                const on = params.simEvent !== 'living'
                commit({
                  ...params,
                  simEvent: on ? 'living' : 'none',
                  simPlaying: false,
                  simTime: 0,
                })
              }}
            >
              Living
            </button>
          </div>
          <Select
            label="Scenario"
            value={params.simEvent}
            onChange={(value) => {
              commit({
                ...params,
                simEvent: value,
                simPlaying: false,
                simTime: value === 'none' ? 0 : params.simTime,
              })
            }}
            options={EVENT_SIMS}
          />
          {params.simEvent === 'living' ? (
            <>
              <Select
                label="Climate"
                value={params.climate}
                onChange={bind('climate')}
                options={CLIMATES}
              />
              <Select
                label="Country"
                value={params.country}
                onChange={(value) => {
                  const match = COUNTRIES.find((item) => item.id === value)
                  commit({
                    ...params,
                    country: value,
                    climate: match?.climate ?? params.climate,
                  })
                }}
                options={COUNTRIES}
              />
            </>
          ) : null}
          {params.simEvent !== 'none' ? (
            <>
              <div className="layer-actions">
                <button
                  type="button"
                  className={params.simPlaying ? 'is-on' : ''}
                  onClick={() => {
                    const playing = !params.simPlaying
                    commit({
                      ...params,
                      simPlaying: playing,
                      simTime: params.simTime >= 1 && playing ? 0 : params.simTime,
                    })
                  }}
                >
                  {params.simPlaying ? 'Stop' : 'Start'}
                </button>
                <button
                  type="button"
                  onClick={() => commit({ ...params, simPlaying: false, simTime: 0 })}
                >
                  Reset
                </button>
              </div>
              <Slider
                label="Timeline"
                min={0}
                max={1}
                step={0.01}
                value={params.simTime}
                onChange={(value) => commit({ ...params, simTime: value, simPlaying: false })}
                format={() => formatEventTime(params.simEvent, params.simTime)}
              />
            </>
          ) : null}

          <h2 className="panel-sub">Layers</h2>
          <p className="panel-note">Each layer has its own equation</p>
          <Select
            label="Edit layer"
            value={String(selected)}
            onChange={(value) => setSelected(Number(value))}
            options={layerOptions}
          />
          <div className="layer-actions">
            <button
              type="button"
              onClick={addLayer}
              disabled={params.layers.length >= MAX_NOISE_LAYERS}
            >
              Add
            </button>
            <button
              type="button"
              onClick={removeLayer}
              disabled={params.layers.length <= 1}
            >
              Remove
            </button>
          </div>
          <Slider
            label="Mix"
            min={0}
            max={1}
            step={0.01}
            value={layer.mix}
            onChange={updateLayer('mix')}
          />
          <Select
            label="Blend"
            value={layer.blend}
            onChange={updateLayer('blend')}
            options={BLEND_OPS}
          />

          <h2 className="panel-sub">Noise</h2>
          <p className="panel-note">{layer.name} equation</p>
          <Select
            label="Equation"
            value={layer.equation || 'perlin-fbm'}
            onChange={updateLayer('equation')}
            options={NOISE_EQUATIONS}
          />
          <p className="panel-note equation">{noiseEq.note}</p>
          {(noiseEq.sliders ?? []).map((slider) => (
            <Slider
              key={slider.key}
              label={slider.label}
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={layer[slider.key]}
              onChange={updateLayer(slider.key)}
              format={slider.format}
              helpKey={slider.key}
            />
          ))}
          <Slider
            label="Frequency f"
            min={0.01}
            max={0.4}
            step={0.005}
            value={layer.frequency}
            onChange={updateLayer('frequency')}
            format={(value) => value.toFixed(3)}
          />
          <Slider
            label="Amplitude A"
            min={0}
            max={8}
            step={0.05}
            value={layer.amplitude}
            onChange={updateLayer('amplitude')}
          />
          <Slider
            label="Octaves"
            min={1}
            max={8}
            step={1}
            value={layer.octaves}
            onChange={updateLayer('octaves')}
            format={(value) => String(Math.round(value))}
          />
          <Slider
            label="Lacunarity L"
            min={1.1}
            max={3.5}
            step={0.05}
            value={layer.lacunarity}
            onChange={updateLayer('lacunarity')}
          />
          <Slider
            label="Persistence P"
            min={0.15}
            max={0.95}
            step={0.01}
            value={layer.persistence}
            onChange={updateLayer('persistence')}
          />
          <Slider
            label="Offset ox"
            min={-24}
            max={24}
            step={0.1}
            value={layer.offsetX}
            onChange={updateLayer('offsetX')}
            format={(value) => value.toFixed(1)}
          />
          <Slider
            label="Offset oz"
            min={-24}
            max={24}
            step={0.1}
            value={layer.offsetZ}
            onChange={updateLayer('offsetZ')}
            format={(value) => value.toFixed(1)}
          />

          <h2 className="panel-sub">Shape</h2>
          <p className="panel-note">Remap n before × A</p>
          <Select
            label="Operation"
            value={layer.shape}
            onChange={updateLayer('shape')}
            options={SHAPE_OPS}
          />
          <p className="panel-note equation">{shapeOp.note}</p>
          {shapeOp.sliders.map((slider) => (
            <Slider
              key={slider.key}
              label={slider.label}
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={layer[slider.key]}
              onChange={updateLayer(slider.key)}
              format={slider.format}
              helpKey={slider.key}
            />
          ))}

          <h2 className="panel-sub">Grid</h2>
          <p className="panel-note">Mesh density on the xz plane</p>
          <Slider
            label="Resolution"
            min={95}
            max={1000}
            step={1}
            value={params.resolution}
            onChange={bind('resolution')}
            format={(value) => String(Math.round(value))}
          />
          <div className="layer-actions">
            {PLANE_RESOLUTIONS.map((cells) => (
              <button
                key={cells}
                type="button"
                className={Math.round(params.resolution) === cells ? 'is-on' : ''}
                onClick={() => bind('resolution')(cells)}
              >
                {cells}
              </button>
            ))}
          </div>
          <p className="panel-note">Surface display</p>
          <div className="layer-actions">
            <button
              type="button"
              className={!params.showMesh ? 'is-on' : ''}
              onClick={() => bind('showMesh')(false)}
            >
              Lines
            </button>
            <button
              type="button"
              className={params.showMesh ? 'is-on' : ''}
              onClick={() => bind('showMesh')(true)}
            >
              Mesh
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default App
