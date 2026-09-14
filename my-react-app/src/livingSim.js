import { GRID_SIZE, noiseFingerprint, sampleHeight } from './noise.js'

export const CLIMATES = [
  { id: 'temperate', label: 'Temperate' },
  { id: 'mediterranean', label: 'Mediterranean' },
  { id: 'arid', label: 'Arid' },
  { id: 'tropical', label: 'Tropical' },
  { id: 'monsoon', label: 'Monsoon' },
  { id: 'alpine', label: 'Alpine' },
  { id: 'coastal', label: 'Coastal' },
]

export const COUNTRIES = [
  {
    id: 'netherlands',
    label: 'Netherlands',
    climate: 'temperate',
    villages: 26,
    minDist: 4,
    slopeK: 16,
    elevTarget: 0.2,
    grid: true,
    highways: 7,
  },
  {
    id: 'japan',
    label: 'Japan',
    climate: 'temperate',
    villages: 16,
    minDist: 5.2,
    slopeK: 7.5,
    elevTarget: 0.3,
    grid: false,
    highways: 5,
  },
  {
    id: 'switzerland',
    label: 'Switzerland',
    climate: 'alpine',
    villages: 11,
    minDist: 6.2,
    slopeK: 5.5,
    elevTarget: 0.44,
    grid: false,
    highways: 4,
  },
  {
    id: 'united-states',
    label: 'United States',
    climate: 'temperate',
    villages: 14,
    minDist: 7.2,
    slopeK: 9,
    elevTarget: 0.36,
    grid: true,
    highways: 6,
  },
  {
    id: 'egypt',
    label: 'Egypt',
    climate: 'arid',
    villages: 13,
    minDist: 5,
    slopeK: 13,
    elevTarget: 0.1,
    grid: false,
    highways: 3,
  },
  {
    id: 'norway',
    label: 'Norway',
    climate: 'coastal',
    villages: 9,
    minDist: 7,
    slopeK: 5,
    elevTarget: 0.26,
    grid: false,
    highways: 3,
  },
  {
    id: 'india',
    label: 'India',
    climate: 'monsoon',
    villages: 30,
    minDist: 3.4,
    slopeK: 8.5,
    elevTarget: 0.3,
    grid: false,
    highways: 7,
  },
  {
    id: 'china',
    label: 'China',
    climate: 'temperate',
    villages: 22,
    minDist: 4.6,
    slopeK: 8.8,
    elevTarget: 0.33,
    grid: false,
    highways: 7,
  },
  {
    id: 'brazil',
    label: 'Brazil',
    climate: 'tropical',
    villages: 14,
    minDist: 6,
    slopeK: 8,
    elevTarget: 0.4,
    grid: false,
    highways: 4,
  },
  {
    id: 'kenya',
    label: 'Kenya',
    climate: 'arid',
    villages: 10,
    minDist: 6.4,
    slopeK: 7,
    elevTarget: 0.42,
    grid: false,
    highways: 3,
  },
]

const CLIMATE_MOD = {
  temperate: { slopeMul: 1, elevShift: 0, flood: 0.12 },
  mediterranean: { slopeMul: 1.05, elevShift: 0.04, flood: 0.1 },
  arid: { slopeMul: 1.15, elevShift: -0.16, flood: 0.02 },
  tropical: { slopeMul: 0.9, elevShift: 0.08, flood: 0.24 },
  monsoon: { slopeMul: 0.92, elevShift: 0.06, flood: 0.3 },
  alpine: { slopeMul: 1.45, elevShift: 0.14, flood: 0.06 },
  coastal: { slopeMul: 1.18, elevShift: -0.06, flood: 0.08 },
}

const SIZE = 72
const cache = new Map()

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

function getCountry(id) {
  return COUNTRIES.find((item) => item.id === id) ?? COUNTRIES[0]
}

function getClimate(id) {
  return CLIMATE_MOD[id] ?? CLIMATE_MOD.temperate
}

function sampleLand(params) {
  const height = new Float32Array(SIZE * SIZE)
  let min = Infinity
  let max = -Infinity
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
      const { x, z } = worldXZ(i, j, SIZE)
      const h = sampleHeight(x, z, params)
      height[idx(i, j, SIZE)] = h
      if (h < min) min = h
      if (h > max) max = h
    }
  }
  const span = max - min || 1
  const slope = new Float32Array(SIZE * SIZE)
  for (let j = 1; j < SIZE - 1; j++) {
    for (let i = 1; i < SIZE - 1; i++) {
      const dx = height[idx(i + 1, j, SIZE)] - height[idx(i - 1, j, SIZE)]
      const dz = height[idx(i, j + 1, SIZE)] - height[idx(i, j - 1, SIZE)]
      slope[idx(i, j, SIZE)] = Math.hypot(dx, dz) / (2 * (GRID_SIZE / (SIZE - 1)))
    }
  }
  return { height, slope, min, max, span }
}

function suitability(land, country, climate) {
  const suit = new Float32Array(SIZE * SIZE)
  const target = Math.min(0.85, Math.max(0.06, country.elevTarget + climate.elevShift))
  for (let j = 1; j < SIZE - 1; j++) {
    for (let i = 1; i < SIZE - 1; i++) {
      const k = idx(i, j, SIZE)
      const elev = (land.height[k] - land.min) / land.span
      const sl = land.slope[k]
      let s = Math.exp(-sl * sl * country.slopeK * climate.slopeMul)
      s *= Math.exp(-((elev - target) * (elev - target)) / 0.085)
      if (elev > 0.88) s *= 0.04
      if (elev < climate.flood) s *= 0.15 + elev * 2
      const edge =
        Math.min(i, j, SIZE - 1 - i, SIZE - 1 - j) / (SIZE * 0.12)
      s *= Math.min(1, Math.max(0.15, edge))
      suit[k] = s
    }
  }
  return suit
}

function pickVillages(suit, land, country) {
  const picked = []
  const used = new Uint8Array(SIZE * SIZE)
  const minDist = country.minDist
  for (let n = 0; n < country.villages; n++) {
    let best = -1
    let bestK = -1
    for (let k = 0; k < suit.length; k++) {
      if (used[k] || suit[k] <= best) continue
      best = suit[k]
      bestK = k
    }
    if (bestK < 0 || best < 0.04) break
    const j = (bestK / SIZE) | 0
    const i = bestK - j * SIZE
    const { x, z } = worldXZ(i, j, SIZE)
    picked.push({
      i,
      j,
      x,
      z,
      y: land.height[bestK] + 0.04,
      score: best,
      size: 0.16 + Math.min(0.28, best * 0.45),
    })
    const r = Math.max(2, Math.round(minDist))
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (di * di + dj * dj > r * r) continue
        const ni = i + di
        const nj = j + dj
        if (ni < 0 || nj < 0 || ni >= SIZE || nj >= SIZE) continue
        used[idx(ni, nj, SIZE)] = 1
      }
    }
  }
  return picked
}

function pathCost(land, climate, highway) {
  const cost = new Float32Array(SIZE * SIZE)
  const slopeW = highway ? 3.2 : 7.5
  for (let k = 0; k < cost.length; k++) {
    const elev = (land.height[k] - land.min) / land.span
    const sl = land.slope[k]
    let c = 0.2 + sl * sl * slopeW * climate.slopeMul
    if (elev > 0.82) c += (elev - 0.82) * 8
    if (elev < climate.flood) c += 2.4
    cost[k] = c
  }
  return cost
}

function astar(cost, start, goal) {
  const n = SIZE * SIZE
  const gj = (goal / SIZE) | 0
  const gi = goal - gj * SIZE
  const heur = (k) => {
    const j = (k / SIZE) | 0
    const i = k - j * SIZE
    return Math.hypot(i - gi, j - gj) * 0.18
  }
  const gScore = new Float32Array(n)
  gScore.fill(1e12)
  const prev = new Int32Array(n)
  prev.fill(-1)
  const heap = []
  const push = (k, f) => {
    heap.push(k, f)
    let i = heap.length - 2
    while (i > 0) {
      const p = ((i / 2) | 0) * 2 - 2
      if (p < 0 || heap[i + 1] >= heap[p + 1]) break
      const tk = heap[i]
      const tf = heap[i + 1]
      heap[i] = heap[p]
      heap[i + 1] = heap[p + 1]
      heap[p] = tk
      heap[p + 1] = tf
      i = p
    }
  }
  const pop = () => {
    const k = heap[0]
    const lastK = heap[heap.length - 2]
    const lastF = heap[heap.length - 1]
    heap.length -= 2
    if (!heap.length) return k
    heap[0] = lastK
    heap[1] = lastF
    let i = 0
    while (true) {
      const l = i * 2 + 2
      const r = l + 2
      if (l >= heap.length) break
      let m = l
      if (r < heap.length && heap[r + 1] < heap[l + 1]) m = r
      if (heap[m + 1] >= heap[i + 1]) break
      const tk = heap[i]
      const tf = heap[i + 1]
      heap[i] = heap[m]
      heap[i + 1] = heap[m + 1]
      heap[m] = tk
      heap[m + 1] = tf
      i = m
    }
    return k
  }
  gScore[start] = 0
  push(start, heur(start))
  const seen = new Uint8Array(n)
  while (heap.length) {
    const u = pop()
    if (seen[u]) continue
    seen[u] = 1
    if (u === goal) break
    const j = (u / SIZE) | 0
    const i = u - j * SIZE
    for (const [di, dj, w] of [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 1],
      [0, -1, 1],
      [1, 1, 1.41],
      [1, -1, 1.41],
      [-1, 1, 1.41],
      [-1, -1, 1.41],
    ]) {
      const ni = i + di
      const nj = j + dj
      if (ni < 1 || nj < 1 || ni >= SIZE - 1 || nj >= SIZE - 1) continue
      const v = idx(ni, nj, SIZE)
      const next = gScore[u] + ((cost[u] + cost[v]) * 0.5 + 0.04) * w
      if (next < gScore[v]) {
        gScore[v] = next
        prev[v] = u
        push(v, next + heur(v))
      }
    }
  }
  if (prev[goal] < 0 && start !== goal) return null
  const cells = []
  for (let v = goal; v >= 0; v = prev[v]) cells.push(v)
  cells.reverse()
  return cells
}

function cellsToPoints(cells, land) {
  return cells.map((k) => {
    const j = (k / SIZE) | 0
    const i = k - j * SIZE
    const { x, z } = worldXZ(i, j, SIZE)
    return { x, y: land.height[k] + 0.03, z }
  })
}

function connect(villages, cost, land, count) {
  if (villages.length < 2) return []
  const linked = new Set([0])
  const routes = []
  const limit = Math.min(count, villages.length - 1)
  for (let n = 0; n < limit; n++) {
    let bestA = -1
    let bestB = -1
    let bestD = 1e12
    for (const a of linked) {
      for (let b = 0; b < villages.length; b++) {
        if (linked.has(b)) continue
        const va = villages[a]
        const vb = villages[b]
        const d =
          Math.hypot(va.x - vb.x, va.z - vb.z) / (0.35 + va.score + vb.score)
        if (d < bestD) {
          bestD = d
          bestA = a
          bestB = b
        }
      }
    }
    if (bestB < 0) break
    const sa = idx(villages[bestA].i, villages[bestA].j, SIZE)
    const sb = idx(villages[bestB].i, villages[bestB].j, SIZE)
    const cells = astar(cost, sa, sb)
    if (cells && cells.length > 1) routes.push(cellsToPoints(cells, land))
    linked.add(bestB)
  }
  return routes
}

function gridSpurs(villages, land, climate) {
  const routes = []
  const maxStep = 10
  for (const v of villages.slice(0, Math.min(villages.length, 12))) {
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const cells = [idx(v.i, v.j, SIZE)]
      let i = v.i
      let j = v.j
      for (let s = 0; s < maxStep; s++) {
        i += di
        j += dj
        if (i < 2 || j < 2 || i >= SIZE - 2 || j >= SIZE - 2) break
        const k = idx(i, j, SIZE)
        if (land.slope[k] > 0.55 * (1 / Math.max(0.6, climate.slopeMul))) break
        cells.push(k)
      }
      if (cells.length > 3) routes.push(cellsToPoints(cells, land))
    }
  }
  return routes
}

function buildNetwork(params) {
  const country = getCountry(params.country)
  const climate = getClimate(params.climate)
  const land = sampleLand(params)
  const suit = suitability(land, country, climate)
  const villages = pickVillages(suit, land, country)
  const roadCost = pathCost(land, climate, false)
  const hwCost = pathCost(land, climate, true)
  const roads = connect(villages, roadCost, land, villages.length - 1)
  if (country.grid) roads.push(...gridSpurs(villages, land, climate))
  const hubs = [...villages].sort((a, b) => b.score - a.score).slice(0, country.highways)
  const highways = connect(hubs, hwCost, land, Math.max(1, hubs.length - 1))
  return { suit, villages, roads, highways, size: SIZE }
}

function livingKey(params) {
  return `${noiseFingerprint(params)}|${params.climate}|${params.country}`
}

export function getLivingState(params) {
  const key = livingKey(params)
  const hit = cache.get(key)
  if (hit) return hit
  const built = buildNetwork(params)
  cache.set(key, built)
  if (cache.size > 10) cache.delete(cache.keys().next().value)
  return built
}

function remapSigned(field) {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < field.length; i++) {
    if (field[i] < min) min = field[i]
    if (field[i] > max) max = field[i]
  }
  const span = max - min || 1
  const out = new Float32Array(field.length)
  for (let i = 0; i < field.length; i++) out[i] = ((field[i] - min) / span) * 2 - 1
  return out
}

function stampPath(field, points, value) {
  for (const p of points) {
    const u = ((p.x / GRID_SIZE) + 0.5) * (SIZE - 1)
    const v = ((p.z / GRID_SIZE) + 0.5) * (SIZE - 1)
    const i = Math.round(u)
    const j = Math.round(v)
    if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) continue
    field[idx(i, j, SIZE)] = Math.max(field[idx(i, j, SIZE)], value)
  }
}

function lerpPt(a, b, u) {
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    z: a.z + (b.z - a.z) * u,
  }
}

function pathLength(path) {
  let length = 0
  for (let i = 1; i < path.length; i++) {
    length += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z)
  }
  return length
}

function cutPath(path, dist) {
  if (!path.length) return []
  if (dist <= 0) return [path[0]]
  const out = [path[0]]
  let left = dist
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const seg = Math.hypot(b.x - a.x, b.z - a.z) || 1e-6
    if (left >= seg) {
      out.push(b)
      left -= seg
    } else {
      out.push(lerpPt(a, b, left / seg))
      break
    }
  }
  return out
}

function growPaths(paths, progress) {
  const u = Math.min(1, Math.max(0, progress))
  if (u <= 0 || !paths.length) return []
  const lengths = paths.map(pathLength)
  const total = lengths.reduce((sum, value) => sum + value, 0) || 1
  let budget = u * u * (3 - 2 * u) * total
  const out = []
  for (let i = 0; i < paths.length; i++) {
    if (budget <= 0) break
    if (budget >= lengths[i] - 1e-5) {
      out.push(paths[i])
      budget -= lengths[i]
    } else {
      const piece = cutPath(paths[i], budget)
      if (piece.length >= 2) out.push(piece)
      break
    }
  }
  return out
}

function windowProgress(t, start, end) {
  return Math.min(1, Math.max(0, (t - start) / (end - start)))
}

export function getLivingMaps(params) {
  const t = Math.min(1, Math.max(0, params.simTime ?? 0))
  const state = getLivingState(params)
  const a = remapSigned(state.suit)
  const b = new Float32Array(state.size * state.size)
  b.fill(-1)
  const roads = growPaths(state.roads, windowProgress(t, 0.06, 0.6))
  const highways = growPaths(state.highways, windowProgress(t, 0.48, 1))
  for (const road of roads) stampPath(b, road, -0.05)
  for (const road of highways) stampPath(b, road, 0.45)
  for (const v of state.villages) {
    b[idx(v.i, v.j, SIZE)] = 1
  }
  return {
    size: state.size,
    maps: [
      { id: 'suit', label: 'Build suit', grid: a, palette: 'settle' },
      { id: 'net', label: 'Roads / towns', grid: b, palette: 'network' },
    ],
  }
}

export function getLivingLayout(params) {
  const t = Math.min(1, Math.max(0, params.simTime ?? 0))
  const state = getLivingState(params)
  return {
    villages: state.villages,
    roads: growPaths(state.roads, windowProgress(t, 0.06, 0.6)),
    highways: growPaths(state.highways, windowProgress(t, 0.48, 1)),
  }
}
