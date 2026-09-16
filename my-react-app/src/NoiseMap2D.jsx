import { useEffect, useRef } from 'react'
import {
  GRID_SIZE,
  NOISE_EQUATION,
  getLayers,
  getNoiseEquation,
  noiseFingerprint,
  sampleHeight,
  stackedAmplitude,
  landColor,
} from './noise.js'
import { getSimulationMaps, isSimulatedEquation } from './simulate.js'
import { getEventSimulation } from './eventSim.js'

const MAP_PX = 512
const SIM_PX = 120

function paletteColor(t, palette) {
  const u = Math.min(1, Math.max(0, t * 0.5 + 0.5))
  if (palette === 'fire') {
    return [20 + 220 * u, 12 + 90 * u, 8]
  }
  if (palette === 'scar') {
    return [28 + 40 * u, 22 + 18 * u, 18]
  }
  if (palette === 'flood') {
    return [18, 40 + 80 * u, 70 + 140 * u]
  }
  if (palette === 'snow') {
    return [160 + 80 * u, 175 + 70 * u, 190 + 60 * u]
  }
  if (palette === 'gray') {
    const g = 16 + 226 * u
    return [g, g, g]
  }
  if (palette === 'settle') {
    return [18 + 40 * u, 50 + 140 * u, 22 + 50 * u]
  }
  if (palette === 'network') {
    if (u > 0.85) return [232, 196, 72]
    if (u > 0.55) return [200, 208, 214]
    if (u > 0.35) return [92, 70, 52]
    return [22, 28, 24]
  }
  return [26 + (62 - 26) * u, 30 + (224 - 30) * u, 36 + (255 - 36) * u]
}

function paintField(canvas, values, size, palette) {
  if (!canvas || !values) return
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const image = ctx.createImageData(width, height)
  const data = image.data

  for (let py = 0; py < height; py++) {
    const gy = Math.min(size - 1, Math.floor((py / (height - 1)) * (size - 1)))
    for (let px = 0; px < width; px++) {
      const gx = Math.min(size - 1, Math.floor((px / (width - 1)) * (size - 1)))
      const [r, g, b] = paletteColor(values[gy * size + gx], palette)
      const i = (py * width + px) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
}

export default function NoiseMap2D({ params, selected = 0 }) {
  const canvasRef = useRef(null)
  const simARef = useRef(null)
  const simBRef = useRef(null)
  const layers = getLayers(params)
  const active = layers.filter((layer) => layer.enabled !== false && (layer.mix ?? 1) > 0)
    .length
  const fingerprint = noiseFingerprint(params)
  const layer = layers[selected] ?? layers[0]
  const eventOn = (params.simEvent || 'none') !== 'none'
  const sim = !eventOn && isSimulatedEquation(layer?.equation)
  const equation = getNoiseEquation(layer?.equation)
  const eventResult = eventOn ? getEventSimulation(params) : null
  const simResult = sim ? getSimulationMaps(layer) : null
  const pair = eventResult || simResult

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    const image = ctx.createImageData(width, height)
    const data = image.data
    const half = GRID_SIZE / 2
    const amp = stackedAmplitude(params)

    for (let py = 0; py < height; py++) {
      const z = (py / (height - 1)) * GRID_SIZE - half
      for (let px = 0; px < width; px++) {
        const x = (px / (width - 1)) * GRID_SIZE - half
        const y = sampleHeight(x, z, params)
        const t = Math.min(1, Math.max(0, (y / amp) * 0.5 + 0.5))
        const [lr, lg, lb] = landColor(t, 0.12, x, z)
        const i = (py * width + px) * 4
        data[i] = lr * 255
        data[i + 1] = lg * 255
        data[i + 2] = lb * 255
        data[i + 3] = 255
      }
    }

    ctx.putImageData(image, 0, 0)

    if (eventResult?.maps && params.simEvent === 'hydraulic') {
      paintField(
        canvas,
        eventResult.maps[0].grid,
        eventResult.size,
        eventResult.maps[0].palette,
      )
    }

    if (eventResult?.maps) {
      paintField(
        simARef.current,
        eventResult.maps[0].grid,
        eventResult.size,
        eventResult.maps[0].palette,
      )
      paintField(
        simBRef.current,
        eventResult.maps[1].grid,
        eventResult.size,
        eventResult.maps[1].palette,
      )
    } else if (sim) {
      const maps = getSimulationMaps(layer)
      if (maps?.maps?.[0]) paintField(simARef.current, maps.maps[0].grid, maps.size)
      if (maps?.maps?.[1]) paintField(simBRef.current, maps.maps[1].grid, maps.size)
    }
  }, [eventResult, fingerprint, layer, params, sim])

  const title = eventOn
    ? EVENT_NOTE[params.simEvent] ?? 'Simulation maps'
    : sim
      ? equation.note
      : NOISE_EQUATION

  return (
    <aside className="noise-panel panel-frame" aria-label="2D noise field">
      <h2>{eventOn ? 'Sim map' : '2D noise'}</h2>
      <p className="panel-note equation">{title}</p>
      <p className="panel-note">
        {eventOn
          ? `${pair?.maps?.[0]?.label ?? 'Event'} · ${pair?.maps?.[1]?.label ?? ''}`
          : sim
            ? `${layer.name} simulation maps`
            : `${active} stacked ${active === 1 ? 'layer' : 'layers'}`}
      </p>
      {pair ? (
        <div className="sim-maps">
          <figure>
            <canvas
              ref={simARef}
              className="noise-map sim-map"
              width={SIM_PX}
              height={SIM_PX}
              aria-label="Simulation map A"
            />
            <figcaption>{pair.maps[0]?.label ?? 'A'}</figcaption>
          </figure>
          <figure>
            <canvas
              ref={simBRef}
              className="noise-map sim-map"
              width={SIM_PX}
              height={SIM_PX}
              aria-label="Simulation map B"
            />
            <figcaption>{pair.maps[1]?.label ?? 'B'}</figcaption>
          </figure>
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        className="noise-map"
        width={MAP_PX}
        height={MAP_PX}
        aria-label="Height field of stacked noise layers"
      />
      <p className="panel-note">
        {eventOn || sim ? 'maps → terrace · ' : ''}
        xz plane
      </p>
    </aside>
  )
}

const EVENT_NOTE = {
  fire: 'burn front over the height field',
  flood: 'water rises in the valleys',
  snow: 'snowpack grows with elevation',
  hydraulic: 'D8 drainage · stream-power channels',
  living: 'village, road, and highway potential on this land',
}
