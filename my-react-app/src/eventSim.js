import { GRID_SIZE, noiseFingerprint, sampleHeight } from './noise.js'

export const EVENT_SIMS = [
  { id: 'none', label: 'Off' },
  { id: 'fire', label: 'Forest fire' },
  { id: 'flood', label: 'Flood season' },
  { id: 'snow', label: 'Heavy snow' },
  { id: 'hydraulic', label: 'Hydraulic erosion' },
]

const SIZE = 64
const HYDRO_SIZE = 256
const MAX_HYDRO = 40
const SQRT2 = Math.SQRT2
const D8 = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
]
const heightCache = new Map()
const fireCache = new Map()
let hydroState = null

function hash(ix, iy) {
  let n = (ix * 374761393 + iy * 668265263) | 0
  n = (n ^ (n >>> 13)) * 1274126177
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

function idx(i, j, size) {
  return j * size + i
}

function worldXZ(i, j, size) {
  const half = GRID_SIZE / 2
  return {
    x: (i / (size - 1)) * GRID_SIZE - half,
    z: (j / (size - 1)) * GRID_SIZE - half,
  }
}

function getHeightGrid(params, size = SIZE) {
  const key = `${noiseFingerprint(params)}|${size}`
  const hit = heightCache.get(key)
  if (hit) return hit
  const grid = new Float32Array(size * size)
  let min = Infinity
  let max = -Infinity
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const { x, z } = worldXZ(i, j, size)
      const h = sampleHeight(x, z, params)
      grid[idx(i, j, size)] = h
      if (h < min) min = h
      if (h > max) max = h
    }
  }
  const packed = { grid, min, max, size }
  heightCache.set(key, packed)
  if (heightCache.size > 12) heightCache.delete(heightCache.keys().next().value)
  return packed
}

function getFireArrival(params) {
  const key = noiseFingerprint(params)
  const hit = fireCache.get(key)
  if (hit) return hit
  const { grid, min, max, size } = getHeightGrid(params)
  const span = max - min || 1
  const arrival = new Float32Array(size * size)
  arrival.fill(9)
  const heap = []

  const push = (i, j, t) => {
    const k = idx(i, j, size)
    if (t >= arrival[k]) return
    arrival[k] = t
    heap.push({ i, j, t })
  }

  for (let j = 1; j < size - 1; j++) {
    for (let i = 1; i < size - 1; i++) {
      const dry = (grid[idx(i, j, size)] - min) / span
      if (hash(i, j) > 0.992 && dry > 0.35) push(i, j, 0)
    }
  }
  if (heap.length === 0) push(Math.floor(size * 0.5), Math.floor(size * 0.62), 0)

  while (heap.length) {
    heap.sort((a, b) => a.t - b.t)
    const cur = heap.shift()
    if (cur.t !== arrival[idx(cur.i, cur.j, size)]) continue
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ni = cur.i + di
      const nj = cur.j + dj
      if (ni < 1 || nj < 1 || ni >= size - 1 || nj >= size - 1) continue
      const elev = (grid[idx(ni, nj, size)] - min) / span
      const uphill = Math.max(0, grid[idx(ni, nj, size)] - grid[idx(cur.i, cur.j, size)])
      const step = 0.018 + (1 - elev) * 0.03 + uphill * 0.012
      push(ni, nj, cur.t + step)
    }
  }

  let aMax = 0.001
  for (let i = 0; i < arrival.length; i++) if (arrival[i] < 8) aMax = Math.max(aMax, arrival[i])
  for (let i = 0; i < arrival.length; i++) {
    arrival[i] = arrival[i] >= 8 ? 1.2 : arrival[i] / aMax
  }
  fireCache.set(key, arrival)
  if (fireCache.size > 12) fireCache.delete(fireCache.keys().next().value)
  return arrival
}

function remapSigned(field) {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < field.length; i++) {
    const v = field[i]
    if (v < min) min = v
    if (v > max) max = v
  }
  const span = max - min || 1
  const out = new Float32Array(field.length)
  for (let i = 0; i < field.length; i++) out[i] = ((field[i] - min) / span) * 2 - 1
  return out
}

function logFlowSigned(acc) {
  let max = 1
  for (let i = 0; i < acc.length; i++) if (acc[i] > max) max = acc[i]
  const logm = Math.log(1 + max)
  const out = new Float32Array(acc.length)
  for (let i = 0; i < acc.length; i++) {
    const u = Math.pow(Math.log(1 + acc[i]) / logm, 0.72)
    out[i] = u * 2 - 1
  }
  return out
}

function fillPits(h, size) {
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 1; j < size - 1; j++) {
      for (let i = 1; i < size - 1; i++) {
        const k = idx(i, j, size)
        let minN = Infinity
        for (const [di, dj] of D8) {
          const v = h[idx(i + di, j + dj, size)]
          if (v < minN) minN = v
        }
        if (h[k] + 1e-5 < minN) h[k] = minN
      }
    }
  }
}

function routeFlow(st) {
  const { h, recv, donors, acc, stack } = st
  const size = st.size
  const n = size * size
  fillPits(h, size)
  recv.fill(-1)
  donors.fill(0)
  acc.fill(1)

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = idx(i, j, size)
      let best = 0
      let dest = -1
      for (const [di, dj, dist] of D8) {
        const ni = i + di
        const nj = j + dj
        if (ni < 0 || nj < 0 || ni >= size || nj >= size) continue
        const slope = (h[k] - h[idx(ni, nj, size)]) / dist
        if (slope > best) {
          best = slope
          dest = idx(ni, nj, size)
        }
      }
      recv[k] = dest
      if (dest >= 0) donors[dest]++
    }
  }

  let top = 0
  for (let k = 0; k < n; k++) if (donors[k] === 0) stack[top++] = k
  let cursor = 0
  while (cursor < top) {
    const k = stack[cursor++]
    const r = recv[k]
    if (r < 0) continue
    acc[r] += acc[k]
    donors[r]--
    if (donors[r] === 0 && top < n) stack[top++] = r
  }
}

function hydraulicStep(st) {
  const { h, recv, acc, dH } = st
  const size = st.size
  const n = size * size
  const K = 0.055
  const mExp = 0.5
  const kappa = 0.012
  const dt = 0.55
  const accNorm = size * 0.35

  routeFlow(st)
  dH.fill(0)
  for (let j = 1; j < size - 1; j++) {
    for (let i = 1; i < size - 1; i++) {
      const k = idx(i, j, size)
      const r = recv[k]
      let slope = 0
      if (r >= 0) {
        const rj = (r / size) | 0
        const ri = r - rj * size
        const dist = ri !== i && rj !== j ? SQRT2 : 1
        slope = Math.max(0, (h[k] - h[r]) / dist)
      }
      const area = acc[k] / accNorm
      const incision = K * Math.pow(area, mExp) * slope
      const lap =
        h[idx(i - 1, j, size)] +
        h[idx(i + 1, j, size)] +
        h[idx(i, j - 1, size)] +
        h[idx(i, j + 1, size)] -
        4 * h[k]
      dH[k] = (-incision + kappa * lap) * dt
    }
  }

  for (let i = 0; i < n; i++) h[i] += dH[i]
}

function getHydroState(params) {
  const target = Math.max(0, Math.round(Math.min(1, Math.max(0, params.simTime ?? 0)) * MAX_HYDRO))
  const fp = noiseFingerprint(params)
  const size = HYDRO_SIZE
  const n = size * size
  const base = getHeightGrid(params, size)
  if (!hydroState || hydroState.fp !== fp || hydroState.steps > target) {
    hydroState = {
      fp,
      steps: 0,
      size,
      h: base.grid.slice(),
      recv: new Int32Array(n),
      donors: new Int32Array(n),
      acc: new Float32Array(n),
      dH: new Float32Array(n),
      stack: new Int32Array(n),
      flowMax: 1,
    }
    routeFlow(hydroState)
  }
  while (hydroState.steps < target) {
    hydraulicStep(hydroState)
    hydroState.steps++
  }
  let flowMax = 1
  for (let i = 0; i < n; i++) if (hydroState.acc[i] > flowMax) flowMax = hydroState.acc[i]
  hydroState.flowMax = flowMax
  return hydroState
}

function sampleGrid(grid, size, x, z) {
  const u = ((x / GRID_SIZE) + 0.5) * (size - 1)
  const v = ((z / GRID_SIZE) + 0.5) * (size - 1)
  const x0 = Math.max(0, Math.min(size - 2, Math.floor(u)))
  const y0 = Math.max(0, Math.min(size - 2, Math.floor(v)))
  const tx = u - x0
  const ty = v - y0
  const i00 = grid[y0 * size + x0]
  const i10 = grid[y0 * size + x0 + 1]
  const i01 = grid[(y0 + 1) * size + x0]
  const i11 = grid[(y0 + 1) * size + x0 + 1]
  return i00 * (1 - tx) * (1 - ty) + i10 * tx * (1 - ty) + i01 * (1 - tx) * ty + i11 * tx * ty
}

export function formatEventTime(event, t) {
  const u = Math.min(1, Math.max(0, t))
  if (event === 'fire') return `Day ${Math.round(u * 14)} / 14`
  if (event === 'flood') return `Week ${Math.round(u * 12)} / 12`
  if (event === 'snow') return `Hour ${Math.round(u * 48)} / 48`
  if (event === 'hydraulic') return `Pass ${Math.round(u * MAX_HYDRO)} / ${MAX_HYDRO}`
  return `${Math.round(u * 100)}%`
}

export function getEventSimulation(params) {
  const event = params.simEvent || 'none'
  if (event === 'none') return null
  const t = Math.min(1, Math.max(0, params.simTime ?? 0))
  const { grid, min, max, size } = getHeightGrid(params)
  const span = max - min || 1
  const a = new Float32Array(size * size)
  const b = new Float32Array(size * size)

  if (event === 'fire') {
    const arrival = getFireArrival(params)
    for (let i = 0; i < a.length; i++) {
      const age = t - arrival[i]
      const burning = age >= 0 && age < 0.12 ? 1 - age / 0.12 : 0
      const scar = age >= 0 ? Math.min(1, 0.25 + age) : 0
      a[i] = burning * 2 - 1
      b[i] = scar * 2 - 1
    }
    return {
      size,
      maps: [
        { id: 'front', label: 'Fire front', grid: a, palette: 'fire' },
        { id: 'scar', label: 'Burn scar', grid: b, palette: 'scar' },
      ],
    }
  }

  if (event === 'flood') {
    const water = min + span * (0.12 + t * 0.62)
    for (let i = 0; i < a.length; i++) {
      const depth = Math.max(0, water - grid[i])
      a[i] = Math.min(1, depth / (span * 0.35 + 0.001)) * 2 - 1
      b[i] = depth > 0.04 ? 1 : -1
    }
    return {
      size,
      maps: [
        { id: 'depth', label: 'Inundation', grid: a, palette: 'flood' },
        { id: 'mask', label: 'Water / land', grid: b, palette: 'flood' },
      ],
    }
  }

  if (event === 'snow') {
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const k = idx(i, j, size)
        const elev = (grid[k] - min) / span
        const wind = 1 - Math.abs(i / (size - 1) - 0.35)
        const depth = t * (0.25 + elev * 0.9) * (0.55 + wind * 0.45)
        a[k] = Math.min(1, depth) * 2 - 1
        b[k] = elev * t * 2 - 1
      }
    }
    return {
      size,
      maps: [
        { id: 'pack', label: 'Snow pack', grid: a, palette: 'snow' },
        { id: 'cover', label: 'Cover', grid: b, palette: 'snow' },
      ],
    }
  }

  if (event !== 'hydraulic') return null

  const hydro = getHydroState(params)
  return {
    size: hydro.size,
    maps: [
      { id: 'carved', label: 'Eroded height', grid: remapSigned(hydro.h), palette: 'gray' },
      { id: 'flow', label: 'Drainage', grid: logFlowSigned(hydro.acc), palette: 'drain' },
    ],
  }
}

export function applyEventToGrid(geometry, params) {
  const event = params.simEvent || 'none'
  if (event === 'none') return
  const t = Math.min(1, Math.max(0, params.simTime ?? 0))
  const { grid, min, max, size } = getHeightGrid(params)
  const span = max - min || 1
  const positions = geometry.attributes.position
  const colors = geometry.attributes.color
  const arrival = event === 'fire' ? getFireArrival(params) : null
  const water = min + span * (0.12 + t * 0.62)
  const hydro = event === 'hydraulic' ? getHydroState(params) : null

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    let y = positions.getY(i)
    const z = positions.getZ(i)
    let r = colors.getX(i)
    let g = colors.getY(i)
    let b = colors.getZ(i)

    if (event === 'fire' && arrival) {
      const age = t - sampleGrid(arrival, size, x, z)
      if (age >= 0) {
        const burning = age < 0.12 ? 1 - age / 0.12 : 0
        const scar = Math.min(1, 0.35 + age)
        y -= scar * 0.18
        r = r * (1 - scar) + (0.12 + burning * 0.85)
        g = g * (1 - scar) + (0.05 + burning * 0.28)
        b = b * (1 - scar) + (0.04 + burning * 0.02)
      }
    } else if (event === 'flood') {
      const depth = water - y
      if (depth > 0) {
        y = water
        const w = Math.min(1, 0.35 + depth / (span * 0.4 + 0.2))
        r = r * (1 - w) + 0.12 * w
        g = g * (1 - w) + 0.28 * w
        b = b * (1 - w) + 0.48 * w
      }
    } else if (event === 'snow') {
      const elev = (y - min) / span
      const pack = t * (0.2 + elev * 1.1)
      y += pack * 0.85
      const c = Math.min(1, pack)
      r = r * (1 - c) + (0.86 + c * 0.12)
      g = g * (1 - c) + (0.9 + c * 0.08)
      b = b * (1 - c) + 0.98
    } else if (event === 'hydraulic' && hydro) {
      y = sampleGrid(hydro.h, hydro.size, x, z)
      const acc = sampleGrid(hydro.acc, hydro.size, x, z)
      const drain = Math.pow(Math.log(1 + acc) / Math.log(1 + hydro.flowMax), 1.15)
      const vein = Math.min(1, drain)
      r = r * (1 - vein * 0.82) + 0.08 * vein
      g = g * (1 - vein * 0.82) + 0.09 * vein
      b = b * (1 - vein * 0.82) + 0.1 * vein
    }

    positions.setY(i, y)
    colors.setXYZ(i, r, g, b)
  }

  positions.needsUpdate = true
  colors.needsUpdate = true
  geometry.computeVertexNormals()
}
