import { useEffect, useRef, useState } from 'react'
import GalaxyCanvas from './GalaxyCanvas.jsx'
import VoxelCanvas from './VoxelCanvas.jsx'
import CsgCanvas from './CsgCanvas.jsx'
import NoiseMap2D from './NoiseMap2D.jsx'
import DensitySlice from './DensitySlice.jsx'
import AccountPanel from './AccountPanel.jsx'
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
import {
  CSG_OPS,
  DENSITY_SHAPES,
  MAX_CSG_SOLIDS,
  createDefaultSolids,
  createSolid,
  getCsgOp,
  getDensityShape,
} from './density.js'
import { MESH_MODES, getMeshMode } from './meshing.js'
import './App.css'

const PLANE_RESOLUTIONS = [95, 300, 500, 1000]
const VOXEL_RESOLUTIONS = [24, 32, 48, 64]
const CSG_RESOLUTIONS = [16, 24, 32, 40]

function viewFromHash(hash) {
  if (hash === '#voxel') return 'voxel'
  if (hash === '#csg') return 'csg'
  return 'field'
}

const initialParams = {
  resolution: 300,
  voxelCells: 48,
  csgCells: 28,
  meshMode: 'marching',
  csgSolids: createDefaultSolids(),
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

function PanelSection({ title, note, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <details
      className="panel-section"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{title}</summary>
      {note ? <p className="panel-note">{note}</p> : null}
      {children}
    </details>
  )
}

function formatClock(value) {
  const wrapped = ((value % 24) + 24) % 24
  const hours = Math.floor(wrapped)
  const mins = Math.round((wrapped - hours) * 60) % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function App() {
  const paramsRef = useRef({
    ...initialParams,
    layers: initialParams.layers.map((layer) => ({ ...layer })),
    csgSolids: initialParams.csgSolids.map((solid) => ({ ...solid })),
  })
  const [params, setParams] = useState(initialParams)
  const [selected, setSelected] = useState(0)
  const [volumeStats, setVolumeStats] = useState(null)
  const [view, setView] = useState(() =>
    typeof window !== 'undefined' ? viewFromHash(window.location.hash) : 'field',
  )

  useEffect(() => {
    const onHash = () => setView(viewFromHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const openView = (next) => {
    setView(next)
    const hash = next === 'field' ? '#field' : `#${next}`
    if (window.location.hash !== hash) window.location.hash = hash
  }

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

  const updateSolid = (key) => (next) => {
    const csgSolids = params.csgSolids.map((solid, index) =>
      index === selected ? { ...solid, [key]: next } : solid,
    )
    commit({ ...params, csgSolids })
  }

  const addSolid = () => {
    if (params.csgSolids.length >= MAX_CSG_SOLIDS) return
    const index = params.csgSolids.length
    const csgSolids = [
      ...params.csgSolids,
      createSolid({
        name: `Solid ${index + 1}`,
        shape: 'sphere',
        op: 'subtract',
        x: (index - 2) * 3,
        y: 2,
        radius: 3.2,
      }),
    ]
    commit({ ...params, csgSolids })
    setSelected(index)
  }

  const removeSolid = () => {
    if (params.csgSolids.length <= 1) return
    const csgSolids = params.csgSolids.filter((_, index) => index !== selected)
    const nextIndex = Math.min(selected, csgSolids.length - 1)
    commit({ ...params, csgSolids })
    setSelected(nextIndex)
  }

  const layer = params.layers[selected] ?? params.layers[0]
  const shapeOp = getShapeOp(layer.shape)
  const noiseEq = getNoiseEquation(layer.equation)
  const solids = params.csgSolids ?? []
  const solid = solids[selected] ?? solids[0]
  const densityShape = getDensityShape(solid?.shape)
  const csgOp = getCsgOp(solid?.op)
  const weatherLabel =
    WEATHER_OPS.find((item) => item.id === params.weather)?.label ?? params.weather
  const layerOptions = params.layers.map((item, index) => ({
    id: String(index),
    label: `${index + 1} · ${item.name}`,
  }))
  const solidOptions = solids.map((item, index) => ({
    id: String(index),
    label: `${index + 1} · ${item.name}`,
  }))
  const title =
    view === 'voxel' ? 'Voxel terrain' : view === 'csg' ? 'Density CSG' : 'Noise field'
  const hint =
    view === 'voxel'
      ? 'Drag to orbit · Cubes stack to the noise height'
      : view === 'csg'
        ? 'Drag to orbit · Each solid combines with the shape so far'
        : 'Drag to orbit · Mesh shows sun and shadow'

  return (
    <div className="app">
      <AccountPanel
        params={params}
        baseParams={initialParams}
        onRestore={(next) => {
          commit(next)
          setSelected(0)
        }}
      />
      {view === 'csg' ? (
        <CsgCanvas paramsRef={paramsRef} onStats={setVolumeStats} />
      ) : view === 'voxel' ? (
        <VoxelCanvas paramsRef={paramsRef} />
      ) : (
        <GalaxyCanvas paramsRef={paramsRef} />
      )}

      <div className="hud">
        <header className="title-block">
          <p className="kicker">
            <span className="tick is-live" aria-hidden="true" />
            PWB Class
          </p>
          <h1>{title}</h1>
          <p className="hint">{hint}</p>
          <nav className="view-tabs" aria-label="Scene">
            <button
              type="button"
              className={view === 'field' ? 'is-on' : ''}
              onClick={() => openView('field')}
            >
              Field
            </button>
            <button
              type="button"
              className={view === 'voxel' ? 'is-on' : ''}
              onClick={() => openView('voxel')}
            >
              Voxel
            </button>
            <button
              type="button"
              className={view === 'csg' ? 'is-on' : ''}
              onClick={() => openView('csg')}
            >
              CSG
            </button>
          </nav>
          <p className="telemetry">
            <span>
              T <b>{formatClock(params.timeOfDay)}</b>
            </span>
            <span>
              WX <b>{weatherLabel}</b>
            </span>
            <span>
              {view === 'csg' ? 'SOL' : 'LYR'}{' '}
              <b>{view === 'csg' ? solids.length : params.layers.length}</b>
            </span>
            <span>
              RES{' '}
              <b>
                {view === 'csg'
                  ? Math.round(params.csgCells)
                  : view === 'voxel'
                    ? Math.round(params.voxelCells)
                    : Math.round(params.resolution)}
              </b>
            </span>
          </p>
        </header>

        {view === 'csg' ? (
          <DensitySlice params={params} selected={Math.min(selected, Math.max(0, solids.length - 1))} />
        ) : (
          <NoiseMap2D params={params} selected={selected} />
        )}

        <aside className="side-panel panel-frame" aria-label="Scene controls">
          <h2>Controls</h2>
          <p className="panel-note">Hover a label for help.</p>

          <PanelSection title="Daylight" note="Time and weather on the terrace">
          <Slider
            label="Time of day"
            min={0}
            max={24}
            step={0.05}
            value={params.timeOfDay}
            onChange={bind('timeOfDay')}
            format={formatClock}
          />
          <Select
            label="Weather"
            value={params.weather}
            onChange={bind('weather')}
            options={WEATHER_OPS}
          />
          </PanelSection>

          {view === 'field' ? (
          <PanelSection
            title="Simulation"
            note="Seasonal event, erosion, or living settlement"
            defaultOpen={params.simEvent !== 'none'}
          >
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
          </PanelSection>
          ) : null}

          {view === 'csg' && solid ? (
          <>
          <PanelSection title="Solids" note="Each op combines that solid with the shape so far">
          <div className="btn-row layer-index">
            {solidOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={String(selected) === option.id ? 'is-on' : ''}
                onClick={() => setSelected(Number(option.id))}
              >
                {Number(option.id) + 1}
              </button>
            ))}
          </div>
          <p className="panel-note">{solid.name}</p>
          <div className="layer-actions">
            <button
              type="button"
              onClick={addSolid}
              disabled={solids.length >= MAX_CSG_SOLIDS}
            >
              Add
            </button>
            <button
              type="button"
              onClick={removeSolid}
              disabled={solids.length <= 1}
            >
              Remove
            </button>
          </div>
          <Select
            label="CSG op"
            value={solid.op}
            onChange={updateSolid('op')}
            options={CSG_OPS}
            helpKey="csg-op"
          />
          <p className="panel-note equation">
            {selected === 0 ? 'First solid is the base. Later ops use this shape.' : csgOp.note}
          </p>
          <Select
            label="Shape"
            value={solid.shape}
            onChange={updateSolid('shape')}
            options={DENSITY_SHAPES}
          />
          <p className="panel-note equation">{densityShape.note}</p>
          {(densityShape.sliders ?? []).map((slider) => (
            <Slider
              key={slider.key}
              label={slider.label}
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={solid[slider.key]}
              onChange={updateSolid(slider.key)}
              format={slider.format}
              helpKey={slider.key}
            />
          ))}
          {String(solid.op).startsWith('smooth') && selected > 0 ? (
            <Slider
              label="Smooth k"
              min={0}
              max={4}
              step={0.05}
              value={solid.smooth ?? 1.2}
              onChange={updateSolid('smooth')}
            />
          ) : null}
          </PanelSection>

          <PanelSection title="Transform" note="Move and aim the selected solid" defaultOpen={false}>
          <Slider
            label="Position x"
            min={-20}
            max={20}
            step={0.1}
            value={solid.x}
            onChange={updateSolid('x')}
            format={(value) => value.toFixed(1)}
          />
          <Slider
            label="Position y"
            min={-16}
            max={16}
            step={0.1}
            value={solid.y}
            onChange={updateSolid('y')}
            format={(value) => value.toFixed(1)}
          />
          <Slider
            label="Position z"
            min={-20}
            max={20}
            step={0.1}
            value={solid.z}
            onChange={updateSolid('z')}
            format={(value) => value.toFixed(1)}
          />
          <Slider
            label="Rotate rx"
            min={-180}
            max={180}
            step={1}
            value={solid.rx}
            onChange={updateSolid('rx')}
            format={(value) => String(Math.round(value))}
          />
          <Slider
            label="Rotate ry"
            min={-180}
            max={180}
            step={1}
            value={solid.ry}
            onChange={updateSolid('ry')}
            format={(value) => String(Math.round(value))}
          />
          <Slider
            label="Rotate rz"
            min={-180}
            max={180}
            step={1}
            value={solid.rz}
            onChange={updateSolid('rz')}
            format={(value) => String(Math.round(value))}
          />
          </PanelSection>
          </>
          ) : (
          <>
          <PanelSection title="Layers" note="Each layer has its own equation">
          <div className="btn-row layer-index">
            {layerOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={String(selected) === option.id ? 'is-on' : ''}
                onClick={() => setSelected(Number(option.id))}
              >
                {Number(option.id) + 1}
              </button>
            ))}
          </div>
          <p className="panel-note">{layer.name}</p>
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
          </PanelSection>

          <PanelSection title="Noise" note={`${layer.name} equation`}>
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
          </PanelSection>

          <PanelSection title="Shape" note="Remap n before × A" defaultOpen={false}>
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
          </PanelSection>
          </>
          )}

          {view === 'csg' ? (
          <PanelSection title="Volume" note="Chunks of 8. Empty chunks are not sampled.">
          <Select
            label="Mesh"
            value={params.meshMode ?? 'marching'}
            onChange={bind('meshMode')}
            options={MESH_MODES}
          />
          <p className="panel-note equation">{getMeshMode(params.meshMode).note}</p>
          {volumeStats ? (
            <p className="panel-note">
              {volumeStats.chunksLive}/{volumeStats.chunksTotal} chunks · {volumeStats.samples} samples
              / {volumeStats.fullSamples} · {volumeStats.triangles} tris · {volumeStats.ms} ms
            </p>
          ) : null}
          <Slider
            label="CSG cells"
            min={12}
            max={40}
            step={1}
            value={params.csgCells}
            onChange={bind('csgCells')}
            format={(value) => String(Math.round(value))}
          />
          <div className="btn-row btn-row-4">
            {CSG_RESOLUTIONS.map((cells) => (
              <button
                key={cells}
                type="button"
                className={Math.round(params.csgCells) === cells ? 'is-on' : ''}
                onClick={() => bind('csgCells')(cells)}
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
              Solid
            </button>
          </div>
          </PanelSection>
          ) : view === 'voxel' ? (
          <PanelSection title="Voxels" note="Cube grid from the same noise height">
          <Slider
            label="Voxel cells"
            min={16}
            max={64}
            step={1}
            value={params.voxelCells}
            onChange={bind('voxelCells')}
            format={(value) => String(Math.round(value))}
          />
          <div className="btn-row btn-row-4">
            {VOXEL_RESOLUTIONS.map((cells) => (
              <button
                key={cells}
                type="button"
                className={Math.round(params.voxelCells) === cells ? 'is-on' : ''}
                onClick={() => bind('voxelCells')(cells)}
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
              Solid
            </button>
          </div>
          </PanelSection>
          ) : (
          <PanelSection title="Grid" note="Mesh density on the xz plane" defaultOpen={false}>
          <Slider
            label="Resolution"
            min={95}
            max={1000}
            step={1}
            value={params.resolution}
            onChange={bind('resolution')}
            format={(value) => String(Math.round(value))}
          />
          <div className="btn-row btn-row-4">
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
          </PanelSection>
          )}
        </aside>
      </div>
    </div>
  )
}

export default App
