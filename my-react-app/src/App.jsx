import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import NoiseMap2D from './NoiseMap2D.jsx'
import DensitySlice from './DensitySlice.jsx'
import AccountMenu from './AccountMenu.jsx'
import SignInScreen from './SignInScreen.jsx'
import { useAuth } from './useAuth.js'
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
import { SHADER_STRATEGIES, getShaderStrategy } from './shaders.js'
import { SCATTER_LAYERS, createScatterParams, describeScatter } from './scatter.js'
import { BREAK_BUILDINGS } from './deconstruct.js'
import {
  MAX_COLOR_STOPS,
  OCEAN_RESOLUTIONS,
  PLANET_DETAILS,
  PLANET_MAPPINGS,
  PLANET_MESHES,
  createColorStops,
  createOceanParams,
  rampCss,
} from './planet.js'
import {
  AGENT_EMOTES,
  AGENT_EXPRESSIONS,
  AGENT_MODES,
  FOLLOW_MODES,
  createAgentParams,
} from './planetAgent.js'
import { MAX_CARS, createTownParams } from './planetTown.js'
import './App.css'

const GalaxyCanvas = lazy(() => import('./GalaxyCanvas.jsx'))
const VoxelCanvas = lazy(() => import('./VoxelCanvas.jsx'))
const CsgCanvas = lazy(() => import('./CsgCanvas.jsx'))
const ShaderCanvas = lazy(() => import('./ShaderCanvas.jsx'))
const DeconstructCanvas = lazy(() => import('./DeconstructCanvas.jsx'))
const PlanetCanvas = lazy(() => import('./PlanetCanvas.jsx'))

const PLANE_RESOLUTIONS = [95, 300, 500, 1000]
const VOXEL_RESOLUTIONS = [24, 32, 48, 64]
const CSG_RESOLUTIONS = [16, 24, 32, 40]

const VIEWS = [
  { id: 'planet', label: 'Planet' },
  { id: 'field', label: 'Field' },
  { id: 'shaders', label: 'Shaders' },
  { id: 'voxel', label: 'Voxel' },
  { id: 'csg', label: 'CSG' },
  { id: 'break', label: 'Break' },
]

function viewFromHash(hash = '') {
  const id = String(hash).replace(/^#/, '').split(/[/?]/)[0]
  return VIEWS.some((item) => item.id === id) ? id : 'planet'
}

function shaderFromSearch() {
  if (typeof window === 'undefined') return 'elevation'
  const id = new URLSearchParams(window.location.search).get('shader')
  return SHADER_STRATEGIES.some((item) => item.id === id) ? id : 'elevation'
}

const initialParams = {
  resolution: 300,
  voxelCells: 48,
  csgCells: 28,
  meshMode: 'marching',
  csgSolids: createDefaultSolids(),
  showMesh: true,
  shaderStrategy: shaderFromSearch(),
  shaderBand: 0.45,
  shaderFlow: 6,
  shaderWater: 0.15,
  shaderErode: 0.42,
  treeCover: 0.64,
  scatter: createScatterParams(),
  vectorCount: 140,
  particleCount: 28,
  trailLength: 8,
  fieldResolution: 18,
  timeOfDay: 12,
  weather: 'clear',
  simEvent: 'none',
  simPlaying: false,
  simTime: 0,
  climate: 'temperate',
  country: 'japan',
  breakWind: 0.22,
  breakMasonry: 0.62,
  breakWood: 0.48,
  breakGravity: 1,
  breakBuilding: 'residential',
  breakEpoch: 0,
  breakPulse: null,
  planetMapping: 'noise3d',
  planetMesh: 'uv',
  planetDetail: 64,
  planetRelief: 0.55,
  ...createOceanParams(),
  ...createAgentParams(),
  ...createTownParams(),
  planetSpin: 0.2,
  planetStepped: true,
  planetStops: createColorStops(),
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

function scatterCount(id, stats) {
  if (!stats) return 'Placing…'
  if (id === 'trees') {
    return `Tall ${stats.tall ?? 0} · Medium ${stats.medium ?? 0} · Short ${stats.short ?? 0}`
  }
  if (id === 'rocks') return `Boulders ${stats.boulder ?? 0} · Shards ${stats.shard ?? 0}`
  if (id === 'bushes') return `${stats.bush ?? 0} bushes`
  const mills = stats.mill ?? 0
  return `${mills} windmill${mills === 1 ? '' : 's'}`
}

function ScatterControls({ params, stats, onScatter, onWater, fieldNote }) {
  return (
    <>
      <PanelSection
        title="Scatter"
        note="Each layer places one asset. Density sets how many. Cliffs and water set where they are allowed. Size and color follow the ground."
      >
        <Slider
          label="Water line"
          min={-2}
          max={6}
          step={0.01}
          value={params.shaderWater ?? 0.15}
          onChange={onWater}
          helpKey="shaderWater"
        />
        {fieldNote ? (
          <p className="panel-note">
            Fire, flood, snow, and erosion hide the scatter while the ground is moving.
          </p>
        ) : null}
      </PanelSection>
      {SCATTER_LAYERS.map((layer) => {
        const settings = params.scatter?.[layer.id] ?? layer
        return (
          <PanelSection
            key={layer.id}
            title={layer.label}
            note={layer.note}
            defaultOpen={layer.id === 'trees'}
          >
            <Slider
              label="Density"
              min={0}
              max={1}
              step={0.01}
              value={settings.density}
              onChange={onScatter(layer.id, 'density')}
              format={(value) => `${Math.round(value * 100)}%`}
              helpKey={`${layer.id}Density`}
            />
            <Slider
              label="Cliffs"
              min={0}
              max={1}
              step={0.01}
              value={settings.cliffs}
              onChange={onScatter(layer.id, 'cliffs')}
              format={(value) => `${Math.round(value * 100)}%`}
              helpKey={layer.prefersSteep ? 'rockCliffs' : 'cliffAvoid'}
            />
            <Slider
              label="Water"
              min={0}
              max={1}
              step={0.01}
              value={settings.water}
              onChange={onScatter(layer.id, 'water')}
              format={(value) => `${Math.round(value * 100)}%`}
              helpKey="scatterWater"
            />
            <p className="panel-note">{describeScatter(layer, settings)}</p>
            <p className="panel-note">{scatterCount(layer.id, stats)}</p>
          </PanelSection>
        )
      })}
    </>
  )
}

function formatClock(value) {
  const wrapped = ((value % 24) + 24) % 24
  const hours = Math.floor(wrapped)
  const mins = Math.round((wrapped - hours) * 60) % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function BreakControls({ params, stats, onChange, onPulse, onReset }) {
  const building = params.breakBuilding || 'residential'
  return (
    <PanelSection
      title="Structure"
      note="Joints carry the floor loads down the columns. A gust used to open several limbs at once while the wind was still pushing, so the crown flew apart. Now one joint hinges and that limb falls together. Click a column to drop the floors on it."
    >
      <div className="layer-actions">
        {BREAK_BUILDINGS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={building === item.id ? 'is-on' : undefined}
            onClick={() => onChange('breakBuilding')(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <Slider
        label="Wind"
        min={0}
        max={1}
        step={0.01}
        value={params.breakWind ?? 0.22}
        onChange={onChange('breakWind')}
        helpKey="breakWind"
      />
      <Slider
        label="Masonry"
        min={0}
        max={1}
        step={0.01}
        value={params.breakMasonry ?? 0.62}
        onChange={onChange('breakMasonry')}
        helpKey="breakMasonry"
      />
      <Slider
        label="Wood"
        min={0}
        max={1}
        step={0.01}
        value={params.breakWood ?? 0.48}
        onChange={onChange('breakWood')}
        helpKey="breakWood"
      />
      <Slider
        label="Gravity"
        min={0.2}
        max={2}
        step={0.05}
        value={params.breakGravity ?? 1}
        onChange={onChange('breakGravity')}
        helpKey="breakGravity"
      />
      <div className="layer-actions">
        <button type="button" onClick={() => onPulse('gust')}>
          Gust
        </button>
        <button type="button" onClick={() => onPulse('quake')}>
          Quake
        </button>
        <button type="button" onClick={onReset}>
          Reset
        </button>
      </div>
      {stats ? (
        <p className="panel-note">
          {stats.intact} joints holding · {stats.broken} broken
          {stats.moving ? ` · ${stats.moving} moving` : ''}
        </p>
      ) : (
        <p className="panel-note">Click a column or a limb.</p>
      )}
    </PanelSection>
  )
}

function OnOff({ value, onChange, on = 'On', off = 'Off' }) {
  return (
    <div className="btn-row">
      <button type="button" className={value ? 'is-on' : ''} onClick={() => onChange(true)}>
        {on}
      </button>
      <button type="button" className={!value ? 'is-on' : ''} onClick={() => onChange(false)}>
        {off}
      </button>
    </div>
  )
}

function ColorRow({ label, helpKey, value, onChange }) {
  return (
    <label className="color-row">
      <ParamTooltip label={label} help={getParamHelp(label, helpKey)} />
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function PlanetControls({ params, stats, onChange }) {
  const stops = params.planetStops ?? []
  const mapping =
    PLANET_MAPPINGS.find((item) => item.id === params.planetMapping) ?? PLANET_MAPPINGS[0]
  const mesh = PLANET_MESHES.find((item) => item.id === params.planetMesh) ?? PLANET_MESHES[0]
  const seaT = stats?.seaT
  const oceanOn = params.planetOcean !== false
  const foamOn = params.planetFoamOn !== false
  const ripplesOn = params.planetRipplesOn !== false

  const setStop = (index, key) => (value) => {
    onChange('planetStops')(
      stops.map((stop, i) => (i === index ? { ...stop, [key]: value } : stop)),
    )
  }

  const addStop = () => {
    if (stops.length >= MAX_COLOR_STOPS) return
    const sorted = [...stops].sort((a, b) => a.at - b.at)
    let gapAt = 0.5
    let gapColor = sorted[0]?.color ?? '#808080'
    let widest = -1
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].at - sorted[i - 1].at
      if (gap > widest) {
        widest = gap
        gapAt = (sorted[i].at + sorted[i - 1].at) / 2
        gapColor = sorted[i - 1].color
      }
    }
    onChange('planetStops')([...stops, { at: Number(gapAt.toFixed(2)), color: gapColor }])
  }

  const removeStop = (index) => {
    if (stops.length <= 2) return
    onChange('planetStops')(stops.filter((_, i) => i !== index))
  }

  return (
    <>
      <PanelSection
        title="Planet"
        note="The same noise stack becomes height on this ball. Stepped only changes the color bands. The ground stays a smooth hill. Houses and trees plant on dry land."
      >
        <p className="panel-note">Mapping</p>
        <div className="btn-row">
          {PLANET_MAPPINGS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={mapping.id === item.id ? 'is-on' : ''}
              onClick={() => onChange('planetMapping')(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="panel-note">{mapping.note}</p>
        <p className="panel-note">Sphere mesh</p>
        <div className="btn-row">
          {PLANET_MESHES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={mesh.id === item.id ? 'is-on' : ''}
              onClick={() => onChange('planetMesh')(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="panel-note">{mesh.note} Switch to Lines to see the cells.</p>
        <Slider
          label="Relief"
          min={0}
          max={1.5}
          step={0.01}
          value={params.planetRelief ?? 0.55}
          onChange={onChange('planetRelief')}
          helpKey="planetRelief"
        />
        <Slider
          label="Spin"
          min={0}
          max={1}
          step={0.01}
          value={params.planetSpin ?? 0.2}
          onChange={onChange('planetSpin')}
          format={(value) => `${Math.round(value * 100)}%`}
          helpKey="planetSpin"
        />
        <Slider
          label="Detail"
          min={32}
          max={192}
          step={1}
          value={params.planetDetail ?? 64}
          onChange={onChange('planetDetail')}
          format={(value) => String(Math.round(value))}
          helpKey="planetDetail"
        />
        <div className="btn-row btn-row-4">
          {PLANET_DETAILS.map((cells) => (
            <button
              key={cells}
              type="button"
              className={Math.round(params.planetDetail ?? 64) === cells ? 'is-on' : ''}
              onClick={() => onChange('planetDetail')(cells)}
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
            onClick={() => onChange('showMesh')(false)}
          >
            Lines
          </button>
          <button
            type="button"
            className={params.showMesh ? 'is-on' : ''}
            onClick={() => onChange('showMesh')(true)}
          >
            Solid
          </button>
        </div>
        {stats ? (
          <p className="panel-note">
            {stats.vertices.toLocaleString()} vertices · {stats.triangles.toLocaleString()} tris ·{' '}
            {stats.ms} ms
          </p>
        ) : null}
      </PanelSection>

      <PanelSection
        title="Color stops"
        note="Elevation runs from this planet’s lowest point (0) to its highest (1). Each stop paints one height. The line marks the sea."
      >
        <div className="ramp-preview" style={{ background: rampCss(stops, params.planetStepped) }}>
          {oceanOn && seaT != null && seaT >= 0 && seaT <= 1 ? (
            <span className="ramp-sea" style={{ left: `${seaT * 100}%` }} />
          ) : null}
        </div>
        <div className="btn-row">
          <button
            type="button"
            className={!params.planetStepped ? 'is-on' : ''}
            onClick={() => onChange('planetStepped')(false)}
          >
            Gradient
          </button>
          <button
            type="button"
            className={params.planetStepped ? 'is-on' : ''}
            onClick={() => onChange('planetStepped')(true)}
          >
            Stepped
          </button>
        </div>
        {stops.map((stop, index) => (
          <div className="stop-row" key={index}>
            <input
              type="color"
              value={stop.color}
              aria-label={`Stop ${index + 1} color`}
              onChange={(event) => setStop(index, 'color')(event.target.value)}
            />
            <Slider
              label={`Stop ${index + 1}`}
              min={0}
              max={1}
              step={0.01}
              value={stop.at}
              onChange={setStop(index, 'at')}
              helpKey="planetStop"
            />
            <button
              type="button"
              className="stop-remove"
              aria-label={`Remove stop ${index + 1}`}
              disabled={stops.length <= 2}
              onClick={() => removeStop(index)}
            >
              ×
            </button>
          </div>
        ))}
        <div className="layer-actions">
          <button type="button" onClick={addStop} disabled={stops.length >= MAX_COLOR_STOPS}>
            Add stop
          </button>
          <button type="button" onClick={() => onChange('planetStops')(createColorStops())}>
            Reset
          </button>
        </div>
      </PanelSection>

      <PanelSection
        title="Ocean"
        note="A water sphere at the base radius plus the sea level. The ground is pushed in and out around that same radius."
      >
        <OnOff
          value={oceanOn}
          on="Water"
          off="Dry"
          onChange={onChange('planetOcean')}
        />
        <Slider
          label="Sea level"
          min={-3}
          max={3}
          step={0.01}
          value={params.planetSeaLevel ?? 0}
          onChange={onChange('planetSeaLevel')}
          helpKey="planetSeaLevel"
        />
        <Slider
          label="Resolution"
          min={8}
          max={512}
          step={1}
          value={params.planetOceanRes ?? 128}
          onChange={onChange('planetOceanRes')}
          format={(value) => String(Math.round(value))}
          helpKey="planetOceanRes"
        />
        <div className="btn-row btn-row-4">
          {OCEAN_RESOLUTIONS.map((res) => (
            <button
              key={res}
              type="button"
              className={Math.round(params.planetOceanRes ?? 128) === res ? 'is-on' : ''}
              onClick={() => onChange('planetOceanRes')(res)}
            >
              {res}
            </button>
          ))}
        </div>
        <Slider
          label="Clarity"
          min={0}
          max={1}
          step={0.01}
          value={params.planetClarity ?? 0.16}
          onChange={onChange('planetClarity')}
          format={(value) => `${Math.round(value * 100)}%`}
          helpKey="planetClarity"
        />
        {stats?.land != null ? (
          <p className="panel-note">
            {oceanOn
              ? `${Math.round(stats.land * 100)}% land · ${100 - Math.round(stats.land * 100)}% sea`
              : 'No water'}
          </p>
        ) : null}
      </PanelSection>

      <PanelSection
        title="Ocean colors"
        note="Blended by how far the ground is behind the water. Foam is also the ripple color, so a near-white reads best."
      >
        <ColorRow label="Deep" helpKey="planetDeep" value={params.planetDeep} onChange={onChange('planetDeep')} />
        <ColorRow
          label="Shallow"
          helpKey="planetShallow"
          value={params.planetShallow}
          onChange={onChange('planetShallow')}
        />
        <ColorRow label="Foam" helpKey="planetFoam" value={params.planetFoam} onChange={onChange('planetFoam')} />
      </PanelSection>

      <PanelSection title="Surface" note="A gentle radial bob of the water mesh." defaultOpen={false}>
        <Slider
          label="Speed"
          min={0}
          max={3}
          step={0.01}
          value={params.planetWaveSpeed ?? 1}
          onChange={onChange('planetWaveSpeed')}
          helpKey="planetWaveSpeed"
        />
        <Slider
          label="Scale"
          min={2}
          max={80}
          step={0.5}
          value={params.planetWaveScale ?? 24}
          onChange={onChange('planetWaveScale')}
          format={(value) => value.toFixed(1)}
          helpKey="planetWaveScale"
        />
        <Slider
          label="Height"
          min={0}
          max={0.3}
          step={0.001}
          value={params.planetWaveHeight ?? 0.03}
          onChange={onChange('planetWaveHeight')}
          format={(value) => value.toFixed(3)}
          helpKey="planetWaveHeight"
        />
      </PanelSection>

      <PanelSection title="Coastline" note="Shallow tint and the foam line at the shore." defaultOpen={false}>
        <OnOff value={foamOn} onChange={onChange('planetFoamOn')} />
        <Slider
          label="Depth"
          min={0.01}
          max={1}
          step={0.005}
          value={params.planetFoamDepth ?? 0.035}
          onChange={onChange('planetFoamDepth')}
          format={(value) => value.toFixed(3)}
          helpKey="planetFoamDepth"
        />
        <Slider
          label="Softness"
          min={0}
          max={1}
          step={0.01}
          value={params.planetFoamSoft ?? 0.35}
          onChange={onChange('planetFoamSoft')}
          helpKey="planetFoamSoft"
        />
      </PanelSection>

      <PanelSection
        title="Ripples"
        note="Bright lines parallel to the shore that scroll in toward land. Surface speed drives them too."
        defaultOpen={false}
      >
        <OnOff value={ripplesOn} onChange={onChange('planetRipplesOn')} />
        <Slider
          label="Width"
          min={0.02}
          max={0.6}
          step={0.005}
          value={params.planetRippleWidth ?? 0.05}
          onChange={onChange('planetRippleWidth')}
          format={(value) => value.toFixed(3)}
          helpKey="planetRippleWidth"
        />
        <Slider
          label="Distance"
          min={0.05}
          max={3}
          step={0.01}
          value={params.planetRippleDistance ?? 0.3}
          onChange={onChange('planetRippleDistance')}
          helpKey="planetRippleDistance"
        />
      </PanelSection>

      <PanelSection
        title="Agent"
        note="The robot from the three.js skinning and morph example. House walls block it. Water is entered by standing on the seabed, so it wades instead of floating."
      >
        <OnOff
          value={params.planetAgent !== false}
          onChange={onChange('planetAgent')}
          on="Show"
          off="Hide"
        />
        <p className="panel-note">State</p>
        <div className="btn-row">
          {AGENT_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={(params.planetAgentMode ?? 'walk') === item.id ? 'is-on' : ''}
              onClick={() => onChange('planetAgentMode')(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="panel-note">Emotes</p>
        <div className="btn-row">
          {AGENT_EMOTES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange('planetAgentEmote')({ name, id: Date.now() })}
            >
              {name === 'ThumbsUp' ? 'Thumbs up' : name}
            </button>
          ))}
        </div>
        <p className="panel-note">Camera follows</p>
        <div className="btn-row">
          {FOLLOW_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={(params.planetFollow ?? 'robot') === item.id ? 'is-on' : ''}
              onClick={() => onChange('planetFollow')(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="panel-note">Wander on its own (random stops and emotes)</p>
        <OnOff value={params.planetAgentAuto !== false} onChange={onChange('planetAgentAuto')} />
        <Slider
          label="Size"
          min={0.2}
          max={2}
          step={0.05}
          value={params.planetAgentSize ?? 0.5}
          onChange={onChange('planetAgentSize')}
          helpKey="planetAgentSize"
        />
        <Slider
          label="Speed"
          min={0.2}
          max={3}
          step={0.05}
          value={params.planetAgentSpeed ?? 1}
          onChange={onChange('planetAgentSpeed')}
          helpKey="planetAgentSpeed"
        />
        <p className="panel-note">Expressions</p>
        {AGENT_EXPRESSIONS.map((item) => (
          <Slider
            key={item.key}
            label={item.label}
            min={0}
            max={1}
            step={0.01}
            value={params[item.key] ?? 0}
            onChange={onChange(item.key)}
          />
        ))}
      </PanelSection>

      <PanelSection
        title="Town"
        note="Messenger is the look. The rule is ours: houses and trees only stand on dry land. Roads stay out of the water."
      >
        <OnOff value={params.planetRoads !== false} onChange={onChange('planetRoads')} />
        <Slider
          label="Towns"
          min={2}
          max={16}
          step={1}
          value={params.planetTowns ?? 9}
          onChange={onChange('planetTowns')}
          format={(value) => String(Math.round(value))}
          helpKey="planetTowns"
        />
        <Slider
          label="Road width"
          min={0.2}
          max={1}
          step={0.05}
          value={params.planetRoadWidth ?? 0.4}
          onChange={onChange('planetRoadWidth')}
          helpKey="planetRoadWidth"
        />
        <Slider
          label="Houses"
          min={0}
          max={1}
          step={0.05}
          value={params.planetHouses ?? 0.6}
          onChange={onChange('planetHouses')}
          helpKey="planetHouses"
        />
        <Slider
          label="Lamps"
          min={0}
          max={1}
          step={0.05}
          value={params.planetLamps ?? 0.6}
          onChange={onChange('planetLamps')}
          helpKey="planetLamps"
        />
        <Slider
          label="Trees"
          min={0}
          max={1}
          step={0.05}
          value={params.planetTrees ?? 0.5}
          onChange={onChange('planetTrees')}
          helpKey="planetTrees"
        />
        <Slider
          label="Cars"
          min={0}
          max={MAX_CARS}
          step={1}
          value={params.planetCars ?? 5}
          onChange={onChange('planetCars')}
          format={(value) => String(Math.round(value))}
          helpKey="planetCars"
        />
        <div className="btn-row">
          <button
            type="button"
            onClick={() => onChange('planetTownSeed')(((params.planetTownSeed ?? 1) % 9999) + 1)}
          >
            Reroll town
          </button>
        </div>
      </PanelSection>
    </>
  )
}

function World({ user, onLeaveGuest }) {
  const paramsRef = useRef({
    ...initialParams,
    layers: initialParams.layers.map((layer) => ({ ...layer })),
    csgSolids: initialParams.csgSolids.map((solid) => ({ ...solid })),
    scatter: Object.fromEntries(
      Object.entries(initialParams.scatter).map(([id, value]) => [id, { ...value }]),
    ),
  })
  const [params, setParams] = useState(initialParams)
  const [selected, setSelected] = useState(0)
  const [volumeStats, setVolumeStats] = useState(null)
  const [scatterStats, setScatterStats] = useState(null)
  const [breakStats, setBreakStats] = useState(null)
  const [planetStats, setPlanetStats] = useState(null)
  const [view, setView] = useState(() =>
    typeof window !== 'undefined' ? viewFromHash(window.location.hash) : 'planet',
  )
  const [panels, setPanels] = useState({ controls: false, noise: false })
  const togglePanel = (key) => setPanels((current) => ({ ...current, [key]: !current[key] }))
  const goView = (id) => {
    if (typeof window === 'undefined') return
    if (window.location.hash.replace(/^#/, '') === id) {
      setView(id)
      return
    }
    window.location.hash = id
  }

  useEffect(() => {
    const onHash = () => setView(viewFromHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (view === 'break') setPanels((current) => ({ ...current, controls: true }))
  }, [view])

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

  const setScatter = (id, key) => (value) => {
    const current = params.scatter?.[id] ?? {}
    commit({
      ...params,
      scatter: {
        ...params.scatter,
        [id]: { ...current, [key]: value },
      },
    })
  }

  const resetBreak = () => {
    commit({ ...params, breakEpoch: (params.breakEpoch ?? 0) + 1 })
  }

  const pulseBreakAction = (action) => {
    commit({
      ...params,
      breakPulse: { action, id: (params.breakPulse?.id ?? 0) + 1 },
    })
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
  const shader = getShaderStrategy(params.shaderStrategy)
  const title =
    view === 'planet'
      ? 'Planet'
      : view === 'break'
      ? 'Deconstruction'
      : view === 'voxel'
      ? 'Voxel terrain'
      : view === 'csg'
        ? 'Density CSG'
        : view === 'shaders'
          ? 'Shader studies'
          : 'Noise field'
  const hint =
    view === 'planet'
      ? 'Drag to turn · Settlement stays on dry land. Field, shaders, voxel, and CSG are the studies behind this.'
      : view === 'break'
      ? 'Click a column or a limb · Gust and quake load the joints until they snap'
      : view === 'voxel'
      ? 'Drag to orbit · Cubes stack to the noise height'
      : view === 'csg'
        ? 'Drag to orbit · Each solid combines with the shape so far'
        : view === 'shaders'
          ? 'Drag to orbit · Hover the ground to stir the flow'
          : 'Drag to orbit · Plants and mills follow the slope and the shore'

  return (
    <div className="app">
      <Suspense fallback={<p className="scene-loading">Loading the terrain…</p>}>
        {view === 'planet' ? (
          <PlanetCanvas paramsRef={paramsRef} onStats={setPlanetStats} />
        ) : view === 'break' ? (
          <DeconstructCanvas paramsRef={paramsRef} onStats={setBreakStats} />
        ) : view === 'csg' ? (
          <CsgCanvas paramsRef={paramsRef} onStats={setVolumeStats} />
        ) : view === 'voxel' ? (
          <VoxelCanvas paramsRef={paramsRef} />
        ) : view === 'shaders' ? (
          <ShaderCanvas paramsRef={paramsRef} onScatterStats={setScatterStats} />
        ) : (
          <GalaxyCanvas paramsRef={paramsRef} onScatterStats={setScatterStats} />
        )}
      </Suspense>

      <div className="hud">
        <div className="topbar">
        <header className="title-block">
          <div className="title-row">
            <p className="kicker">
              <span className="tick is-live" aria-hidden="true" />
              PWB Class
            </p>
            <nav className="view-tabs" aria-label="Studies">
              {VIEWS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={view === item.id ? 'is-on' : undefined}
                  onClick={() => goView(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <h1>{title}</h1>
          <p className="hint">{hint}</p>
          <p className="telemetry">
            <span>
              T <b>{formatClock(params.timeOfDay)}</b>
            </span>
            <span>
              WX <b>{weatherLabel}</b>
            </span>
            <span>
              {view === 'break' ? 'JNT' : view === 'csg' ? 'SOL' : view === 'shaders' ? 'SHD' : 'LYR'}{' '}
              <b>
                {view === 'break'
                  ? breakStats
                    ? `${breakStats.intact}/${breakStats.broken}`
                    : '…'
                  : view === 'csg'
                  ? solids.length
                  : view === 'shaders'
                    ? shader.label
                    : params.layers.length}
              </b>
            </span>
            <span>
              RES{' '}
              <b>
                {view === 'csg'
                  ? Math.round(params.csgCells)
                  : view === 'voxel'
                    ? Math.round(params.voxelCells)
                    : view === 'planet'
                      ? Math.round(params.planetDetail ?? 64)
                      : Math.round(params.resolution)}
              </b>
            </span>
          </p>
        </header>
        <AccountMenu
          user={user}
          onSignIn={onLeaveGuest}
          params={params}
          baseParams={initialParams}
          onRestore={(next) => {
            commit(next)
            setSelected(0)
          }}
        />
        </div>

        {view !== 'break' && panels.noise ? (
          view === 'csg' ? (
            <DensitySlice
              params={params}
              selected={Math.min(selected, Math.max(0, solids.length - 1))}
              onHide={() => togglePanel('noise')}
            />
          ) : (
            <NoiseMap2D
              params={params}
              selected={selected}
              planet={view === 'planet'}
              onHide={() => togglePanel('noise')}
            />
          )
        ) : view !== 'break' ? (
          <button type="button" className="dock-tab is-noise" onClick={() => togglePanel('noise')}>
            {view === 'csg' ? 'Density' : view === 'planet' ? '2D Map' : '2D Noise'}
          </button>
        ) : null}

        {panels.controls ? (
        <aside className="side-panel panel-frame" aria-label="Scene controls">
          <div className="panel-head">
            <h2>Controls</h2>
            <button type="button" className="panel-hide" onClick={() => togglePanel('controls')}>
              Hide
            </button>
          </div>
          <div className="panel-body">
          <p className="panel-note">Hover a label for help.</p>

          {view === 'break' ? (
            <BreakControls
              params={params}
              stats={breakStats}
              onChange={bind}
              onPulse={pulseBreakAction}
              onReset={resetBreak}
            />
          ) : (
          <>

          {view === 'field' ? (
            <ScatterControls
              params={params}
              stats={scatterStats}
              onScatter={setScatter}
              onWater={bind('shaderWater')}
              fieldNote
            />
          ) : null}

          {view === 'planet' ? (
            <PlanetControls params={params} stats={planetStats} onChange={bind} />
          ) : null}

          {view === 'shaders' ? (
          <>
          <PanelSection title="Shaders" note="One mesh. The strategy only changes the draw.">
          <div className="btn-row">
            {SHADER_STRATEGIES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={params.shaderStrategy === item.id ? 'is-on' : ''}
                onClick={() => bind('shaderStrategy')(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="panel-note">{shader.why}</p>
          {params.shaderStrategy === 'contours' ? (
            <Slider
              label="Band"
              min={0.15}
              max={1.4}
              step={0.01}
              value={params.shaderBand}
              onChange={bind('shaderBand')}
              helpKey="shaderBand"
            />
          ) : null}
          {params.shaderStrategy === 'drainage' ? (
            <Slider
              label="Streaks"
              min={2}
              max={14}
              step={0.1}
              value={params.shaderFlow}
              onChange={bind('shaderFlow')}
              helpKey="shaderFlow"
            />
          ) : null}
          {params.shaderStrategy === 'unknown' ? (
            <Slider
              label="Reach"
              min={0}
              max={1}
              step={0.01}
              value={params.shaderErode ?? 0.42}
              onChange={bind('shaderErode')}
              helpKey="shaderErode"
            />
          ) : null}
          {params.shaderStrategy === 'waterline' ? (
            <Slider
              label="Water y"
              min={-2}
              max={6}
              step={0.01}
              value={params.shaderWater}
              onChange={bind('shaderWater')}
              helpKey="shaderWater"
            />
          ) : null}
          </PanelSection>
          <ScatterControls
            params={params}
            stats={scatterStats}
            onScatter={setScatter}
            onWater={bind('shaderWater')}
          />
          <PanelSection
            title="Flow"
            note="Water is a field of streaks. They run downhill into the lakes and curl into vortices. Brighter streaks are faster. Drag pushes the water. Wind arrows stay on the high ground."
          >
            <Slider
              label="Vectors"
              min={40}
              max={400}
              step={10}
              value={params.vectorCount ?? 140}
              onChange={bind('vectorCount')}
              format={(value) => String(Math.round(value))}
              helpKey="vectorCount"
            />
            <Slider
              label="Particles"
              min={8}
              max={80}
              step={1}
              value={params.particleCount ?? 28}
              onChange={bind('particleCount')}
              format={(value) => String(Math.round(value))}
              helpKey="particleCount"
            />
            <Slider
              label="Trail"
              min={2}
              max={24}
              step={1}
              value={params.trailLength ?? 8}
              onChange={bind('trailLength')}
              format={(value) => String(Math.round(value))}
              helpKey="trailLength"
            />
            <Slider
              label="Field grid"
              min={8}
              max={36}
              step={1}
              value={params.fieldResolution ?? 18}
              onChange={bind('fieldResolution')}
              format={(value) => String(Math.round(value))}
              helpKey="fieldResolution"
            />
          </PanelSection>
          </>
          ) : null}

          <PanelSection
            title="Daylight"
            note={
              view === 'planet'
                ? 'The sun stays still while the planet turns. Time of day swings it around, so one side is always night.'
                : 'Time and weather on the terrace'
            }
          >
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
          ) : view === 'planet' ? null : (
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
          </>
          )}
          </div>
        </aside>
        ) : (
          <button
            type="button"
            className="dock-tab is-controls"
            onClick={() => togglePanel('controls')}
          >
            Controls
          </button>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const session = useAuth()
  const [guest, setGuest] = useState(false)
  if (session.ready && session.user) return <World user={session.user} />
  if (session.ready && guest) return <World user={null} onLeaveGuest={() => setGuest(false)} />
  return <SignInScreen session={session} onGuest={() => setGuest(true)} />
}
