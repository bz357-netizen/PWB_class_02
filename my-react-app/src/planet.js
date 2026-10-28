import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  GRID_SIZE,
  noiseFingerprint,
  sampleHeight,
  sampleHeight3,
  sampleLayerNormalized,
} from './noise.js'

export const PLANET_RADIUS = 10

/** Distance from the center at which the flat noise is sampled, so one hill reads the same size as on the grid. */
const NOISE_REACH = GRID_SIZE / 2

const FACE_SHIFT = GRID_SIZE * 0.37

export const MAX_COLOR_STOPS = 8

export const PLANET_DETAILS = [32, 64, 128, 192]

export const PLANET_MAPPINGS = [
  {
    id: 'noise3d',
    label: '3D noise',
    note: 'Each point reads the noise at its direction n̂ in 3D space. No seam and no pinch. Gray–Scott, Erosion, Waves, and Diffusion only exist on the flat grid, so those layers fall back to Triplanar.',
  },
  {
    id: 'wrap',
    label: 'Triplanar',
    note: 'Three flat samples, one per axis, blended by how the ground faces. No seam and no pinch.',
  },
  {
    id: 'equirect',
    label: '2D map',
    note: 'The flat xz grid is stretched over longitude and latitude. Watch the seam at the date line and the streaks at the poles.',
  },
]

export const PLANET_MESHES = [
  {
    id: 'uv',
    label: 'UV rings',
    note: 'Detail segments around and the same number from pole to pole. Every ring has the same count, so cells crowd into slivers at the poles. The seam column keeps its own vertices so u runs from 0 to 1 for textures.',
  },
  {
    id: 'cube',
    label: 'Cube',
    note: 'Six grids pushed out to a ball. Cells stay close to the same size everywhere.',
  },
]

export function createColorStops() {
  return [
    { at: 0, color: '#3f8187' },
    { at: 0.44, color: '#6db5ad' },
    { at: 0.5, color: '#efe2bb' },
    { at: 0.55, color: '#93c573' },
    { at: 0.68, color: '#4f9158' },
    { at: 0.82, color: '#a89d8c' },
    { at: 0.92, color: '#f7f3e8' },
  ]
}

export function sortedStops(stops) {
  const list = Array.isArray(stops) && stops.length ? stops : createColorStops()
  return [...list].sort((a, b) => a.at - b.at).slice(0, MAX_COLOR_STOPS)
}

function hexToRgb(hex) {
  const value = parseInt(String(hex).replace('#', ''), 16) || 0
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

/** Color for elevation t in [0, 1], in sRGB 0–1. Matches the planet shader. */
export function rampColor(t, stops, stepped) {
  const list = sortedStops(stops)
  if (t <= list[0].at) return hexToRgb(list[0].color)
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1]
    const b = list[i]
    if (t < b.at) {
      if (stepped) return hexToRgb(a.color)
      const k = (t - a.at) / Math.max(b.at - a.at, 1e-5)
      const ca = hexToRgb(a.color)
      const cb = hexToRgb(b.color)
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k]
    }
  }
  return hexToRgb(list[list.length - 1].color)
}

export function rampCss(stops, stepped) {
  const list = sortedStops(stops)
  const parts = []
  list.forEach((stop, i) => {
    const at = `${(stop.at * 100).toFixed(1)}%`
    if (stepped) {
      const end = i + 1 < list.length ? `${(list[i + 1].at * 100).toFixed(1)}%` : '100%'
      parts.push(`${stop.color} ${i === 0 ? '0%' : at} ${end}`)
    } else {
      parts.push(`${stop.color} ${at}`)
    }
  })
  return `linear-gradient(to right, ${parts.join(', ')})`
}

/** Height of the noise stack at unit direction (x, y, z). */
export function planetHeight(x, y, z, params) {
  if (params.planetMapping === 'equirect') {
    const half = GRID_SIZE / 2
    const lon = Math.atan2(z, x)
    const lat = Math.asin(Math.max(-1, Math.min(1, y)))
    return sampleHeight((lon / Math.PI) * half, (-lat / (Math.PI / 2)) * half, params)
  }
  if (params.planetMapping === 'wrap') {
    return triplanar(x, y, z, (a, b) => sampleHeight(a, b, params))
  }
  return sampleHeight3(x * NOISE_REACH, y * NOISE_REACH, z * NOISE_REACH, params, (layer) =>
    triplanar(x, y, z, (a, b) => sampleLayerNormalized(a, b, layer)),
  )
}

function triplanar(x, y, z, sample) {
  const px = x * NOISE_REACH
  const py = y * NOISE_REACH
  const pz = z * NOISE_REACH
  let wx = x * x * x * x
  let wy = y * y * y * y
  let wz = z * z * z * z
  const total = wx + wy + wz
  wx /= total
  wy /= total
  wz /= total

  let h = 0
  let used = 0
  if (wx > 0.01) {
    h += wx * sample(py + (x < 0 ? FACE_SHIFT : 0), pz)
    used += wx
  }
  if (wy > 0.01) {
    h += wy * sample(px, pz + (y < 0 ? FACE_SHIFT : 0))
    used += wy
  }
  if (wz > 0.01) {
    h += wz * sample(px + (z < 0 ? FACE_SHIFT : 0), py)
    used += wz
  }
  return h / (used || 1)
}

export function planetFingerprint(params) {
  return `${noiseFingerprint(params)}|${params.planetMapping}|${params.planetMesh}|${params.planetDetail}|${params.planetRelief}`
}

const CUBE_FACES = [
  [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
  [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
  [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
  [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
]

function buildCubeSphere(detail) {
  const n = Math.max(4, Math.round(detail))
  const positions = []
  const indices = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()

  for (const [normal, right, up] of CUBE_FACES) {
    const base = positions.length / 3
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const u = (i / n) * 2 - 1
        const v = (j / n) * 2 - 1
        const x = normal[0] + right[0] * u + up[0] * v
        const y = normal[1] + right[1] * u + up[1] * v
        const z = normal[2] + right[2] * u + up[2] * v
        const x2 = x * x
        const y2 = y * y
        const z2 = z * z
        positions.push(
          x * Math.sqrt(1 - y2 / 2 - z2 / 2 + (y2 * z2) / 3),
          y * Math.sqrt(1 - z2 / 2 - x2 / 2 + (z2 * x2) / 3),
          z * Math.sqrt(1 - x2 / 2 - y2 / 2 + (x2 * y2) / 3),
        )
      }
    }
    const row = n + 1
    const push = (i0, i1, i2) => {
      a.fromArray(positions, i0 * 3)
      b.fromArray(positions, i1 * 3)
      c.fromArray(positions, i2 * 3)
      b.sub(a)
      c.sub(a)
      if (b.cross(c).dot(a) < 0) indices.push(i0, i2, i1)
      else indices.push(i0, i1, i2)
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = base + j * row + i
        push(k, k + 1, k + row)
        push(k + 1, k + row + 1, k + row)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  return mergeVertices(geometry, 1e-5)
}

function buildUvSphere(detail) {
  const res = Math.max(4, Math.round(detail))
  const sphere = new THREE.SphereGeometry(1, res, res)
  sphere.deleteAttribute('normal')
  sphere.userData.uvRes = res
  return sphere
}

/**
 * The UV sphere keeps its seam column and pole rows as separate vertices, so after
 * computeVertexNormals each copy only sees its own side. Average them back together.
 */
function sealUvNormals(normals, res) {
  const row = res + 1
  const sum = [0, 0, 0]
  const write = (k) => {
    const len = Math.hypot(sum[0], sum[1], sum[2]) || 1
    normals[k * 3] = sum[0] / len
    normals[k * 3 + 1] = sum[1] / len
    normals[k * 3 + 2] = sum[2] / len
  }
  const add = (k) => {
    sum[0] += normals[k * 3]
    sum[1] += normals[k * 3 + 1]
    sum[2] += normals[k * 3 + 2]
  }

  for (const j of [0, res]) {
    sum.fill(0)
    for (let i = 0; i <= res; i++) add(j * row + i)
    for (let i = 0; i <= res; i++) write(j * row + i)
  }
  for (let j = 1; j < res; j++) {
    sum.fill(0)
    add(j * row)
    add(j * row + res)
    write(j * row)
    write(j * row + res)
  }
}

/** Unit sphere with positions and an index. The UV sphere also keeps its uv attribute. */
export function buildUnitSphere(kind, detail) {
  return kind === 'uv' ? buildUvSphere(detail) : buildCubeSphere(detail)
}

/**
 * Pushes every vertex of `unit` out by the noise height and writes the result into `target`.
 * aElev holds elevation in [0, 1] across this planet's lowest and highest point.
 */
export function applyPlanetHeights(target, unit, params) {
  const source = unit.attributes.position
  const count = source.count
  const heights = new Float32Array(count)
  let min = Infinity
  let max = -Infinity

  for (let i = 0; i < count; i++) {
    const h = planetHeight(source.getX(i), source.getY(i), source.getZ(i), params)
    heights[i] = h
    if (h < min) min = h
    if (h > max) max = h
  }

  const range = max - min || 1
  const relief = params.planetRelief ?? 0.55
  const reuse = target.attributes.position?.count === count && target.index === unit.index
  const positions = reuse ? target.attributes.position.array : new Float32Array(count * 3)
  const elev = reuse ? target.attributes.aElev.array : new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const r = PLANET_RADIUS + heights[i] * relief
    positions[i * 3] = source.getX(i) * r
    positions[i * 3 + 1] = source.getY(i) * r
    positions[i * 3 + 2] = source.getZ(i) * r
    elev[i] = (heights[i] - min) / range
  }

  if (reuse) {
    target.attributes.position.needsUpdate = true
    target.attributes.aElev.needsUpdate = true
  } else {
    target.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    target.setAttribute('aElev', new THREE.BufferAttribute(elev, 1))
    if (unit.attributes.uv) target.setAttribute('uv', unit.attributes.uv)
    else target.deleteAttribute('uv')
    target.setIndex(unit.index)
  }
  target.computeVertexNormals()
  if (unit.userData.uvRes) {
    sealUvNormals(target.attributes.normal.array, unit.userData.uvRes)
    target.attributes.normal.needsUpdate = true
  }
  target.computeBoundingSphere()

  return { min, max, vertices: count, triangles: unit.index.count / 3 }
}

export function seaRadius(params) {
  return Math.max(0.01, PLANET_RADIUS + (params.planetSeaLevel ?? 0))
}

/** Sea level on the 0–1 elevation scale of the color stops. Can fall outside [0, 1]. */
export function seaElevation(span, params) {
  const relief = params.planetRelief ?? 0.55
  const level = params.planetSeaLevel ?? 0
  if (relief <= 0) return level < 0 ? -1 : 2
  return (level / relief - span.min) / (span.max - span.min || 1)
}

export function createOceanParams() {
  return {
    planetOcean: true,
    planetSeaLevel: 0,
    planetOceanRes: 128,
    planetClarity: 0.1,
    planetDeep: '#4d9fa2',
    planetShallow: '#93d6cc',
    planetFoam: '#f7f3e8',
    planetWaveSpeed: 1,
    planetWaveScale: 24,
    planetWaveHeight: 0.03,
    planetFoamOn: true,
    planetFoamDepth: 0.035,
    planetFoamSoft: 0.35,
    planetRipplesOn: false,
    planetRippleWidth: 0.05,
    planetRippleDistance: 0.3,
  }
}

export const OCEAN_RESOLUTIONS = [32, 64, 128, 256]
