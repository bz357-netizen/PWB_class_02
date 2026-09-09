import { isSimulatedEquation, sampleSimField } from './simulate.js'

/** World size of the 3D grid (matches the old GridHelper). */
export const GRID_SIZE = 48

export const NOISE_EQUATION = 'y = ⊕ᵢ Aᵢ · sᵢ(nᵢ(x, z))'

export const MAX_NOISE_LAYERS = 4

export const BLEND_OPS = [
  { id: 'add', label: 'Add' },
  { id: 'mix', label: 'Mix' },
  { id: 'max', label: 'Max' },
  { id: 'min', label: 'Min' },
  { id: 'multiply', label: 'Multiply' },
]

export const NOISE_EQUATIONS = [
  {
    id: 'perlin-fbm',
    label: 'Perlin FBM',
    note: 'n = Σ Pⁱ perlin(x·f·Lⁱ, z·f·Lⁱ)',
  },
  {
    id: 'value-fbm',
    label: 'Value FBM',
    note: 'n = Σ Pⁱ value(x·f·Lⁱ, z·f·Lⁱ)',
  },
  {
    id: 'simplex-fbm',
    label: 'Simplex FBM',
    note: 'n = Σ Pⁱ simplex(x·f·Lⁱ, z·f·Lⁱ)',
  },
  {
    id: 'worley',
    label: 'Worley',
    note: 'n = Σ Pⁱ (1 − 2 dmin(x·f·Lⁱ, z·f·Lⁱ))',
  },
  {
    id: 'turbulence',
    label: 'Turbulence',
    note: 'n = Σ Pⁱ |perlin(x·f·Lⁱ, z·f·Lⁱ)|',
  },
  {
    id: 'ridged-fbm',
    label: 'Ridged FBM',
    note: 'n = Σ Pⁱ (1 − |perlin|)^2',
  },
  {
    id: 'domain-warp',
    label: 'Domain warp',
    note: 'q = p + w·perlin(p); n = perlinFBM(q)',
  },
  {
    id: 'gray-scott',
    label: 'Gray–Scott',
    simulated: true,
    note: '∂u/∂t = Du∇²u − uv² + F(1−u)',
    sliders: [
      {
        key: 'simSteps',
        label: 'Steps',
        min: 40,
        max: 280,
        step: 10,
        format: (value) => String(Math.round(value)),
      },
      { key: 'simFeed', label: 'Feed F', min: 0.02, max: 0.08, step: 0.001, format: (v) => v.toFixed(3) },
      { key: 'simKill', label: 'Kill K', min: 0.04, max: 0.07, step: 0.001, format: (v) => v.toFixed(3) },
    ],
  },
  {
    id: 'erosion',
    label: 'Erosion',
    simulated: true,
    note: 'droplets erode and deposit on h',
    sliders: [
      {
        key: 'simDroplets',
        label: 'Droplets',
        min: 80,
        max: 900,
        step: 20,
        format: (value) => String(Math.round(value)),
      },
    ],
  },
  {
    id: 'waves',
    label: 'Waves',
    simulated: true,
    note: '∂²u/∂t² = c² ∇²u − d ∂u/∂t',
    sliders: [
      {
        key: 'simSteps',
        label: 'Steps',
        min: 20,
        max: 200,
        step: 5,
        format: (value) => String(Math.round(value)),
      },
      { key: 'simDamp', label: 'Damping', min: 0.002, max: 0.08, step: 0.002, format: (v) => v.toFixed(3) },
    ],
  },
  {
    id: 'diffusion',
    label: 'Diffusion',
    simulated: true,
    note: '∂φ/∂t = ν ∇²φ  on seeded noise',
    sliders: [
      {
        key: 'simSteps',
        label: 'Steps',
        min: 4,
        max: 80,
        step: 2,
        format: (value) => String(Math.round(value)),
      },
    ],
  },
]

export function getNoiseEquation(id) {
  return NOISE_EQUATIONS.find((item) => item.id === id) ?? NOISE_EQUATIONS[0]
}

export function createNoiseLayer(overrides = {}) {
  return {
    name: 'Layer',
    enabled: true,
    mix: 1,
    blend: 'add',
    equation: 'perlin-fbm',
    frequency: 0.12,
    amplitude: 2.4,
    octaves: 4,
    lacunarity: 2,
    persistence: 0.5,
    offsetX: 0,
    offsetZ: 0,
    shape: 'identity',
    shapeMix: 1,
    shapeRidgeSharp: 1.2,
    shapeRidgeOffset: 0,
    shapePower: 2,
    shapeSteps: 5,
    shapeTerraceSharp: 1,
    shapeLow: -0.4,
    shapeHigh: 0.4,
    shapeGain: 1,
    simSteps: 140,
    simFeed: 0.037,
    simKill: 0.06,
    simDroplets: 420,
    simDamp: 0.018,
    ...overrides,
  }
}

export function getLayers(params) {
  if (Array.isArray(params?.layers) && params.layers.length > 0) {
    return params.layers
  }
  return [createNoiseLayer(params)]
}

export function stackedAmplitude(params) {
  let sum = 0
  for (const layer of getLayers(params)) {
    if (layer.enabled === false) continue
    sum += Math.abs(layer.amplitude ?? 0) * (layer.mix ?? 1)
  }
  return Math.max(sum, 0.0001)
}

export function noiseFingerprint(params) {
  return JSON.stringify({
    resolution: params.resolution,
    layers: getLayers(params),
  })
}

export const SHAPE_OPS = [
  {
    id: 'identity',
    label: 'Identity',
    note: 's(n) = n',
    sliders: [],
  },
  {
    id: 'billow',
    label: 'Billow',
    note: 's(n) = mix(n, 2|n|−1, mix)',
    sliders: [
      { key: 'shapeMix', label: 'Mix', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    id: 'ridged',
    label: 'Ridged',
    note: 's(n) = 1 − |n + off|^k',
    sliders: [
      { key: 'shapeRidgeSharp', label: 'Sharpness k', min: 0.4, max: 4, step: 0.05 },
      { key: 'shapeRidgeOffset', label: 'Ridge offset', min: -1, max: 1, step: 0.01 },
    ],
  },
  {
    id: 'power',
    label: 'Power',
    note: 's(n) = sign(n) |n|^e',
    sliders: [
      { key: 'shapePower', label: 'Exponent e', min: 0.2, max: 4, step: 0.05 },
    ],
  },
  {
    id: 'terrace',
    label: 'Terrace',
    note: 's(n) = quantize(n, steps)',
    sliders: [
      {
        key: 'shapeSteps',
        label: 'Steps',
        min: 2,
        max: 12,
        step: 1,
        format: (value) => String(Math.round(value)),
      },
      { key: 'shapeTerraceSharp', label: 'Sharpness', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    id: 'clamp',
    label: 'Clamp',
    note: 's(n) = clamp(n, lo, hi)',
    sliders: [
      { key: 'shapeLow', label: 'Low', min: -1, max: 1, step: 0.01 },
      { key: 'shapeHigh', label: 'High', min: -1, max: 1, step: 0.01 },
    ],
  },
  {
    id: 'gain',
    label: 'Gain',
    note: 's(n) = contrast(n, g)',
    sliders: [
      { key: 'shapeGain', label: 'Gain g', min: 0.15, max: 2.5, step: 0.05 },
    ],
  },
]

export function getShapeOp(id) {
  return SHAPE_OPS.find((op) => op.id === id) ?? SHAPE_OPS[0]
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a, b, t) {
  return a + t * (b - a)
}

function grad(hash, x, y) {
  const h = hash & 3
  const u = h < 2 ? x : y
  const v = h < 2 ? y : x
  return (h & 1 ? -u : u) + (h & 2 ? -v : v)
}

const P = new Uint8Array(512)
;(() => {
  const perm = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140,
    36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120,
    234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
    88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71,
    134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133,
    230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161,
    1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130,
    116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250,
    124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227,
    47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44,
    154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98,
    108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34,
    242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14,
    239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121,
    50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243,
    141, 128, 195, 78, 66, 215, 61, 156, 180,
  ]
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255]
})()

/** Gradient noise in roughly [-1, 1]. */
export function perlin2(x, y) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const X = xi & 255
  const Y = yi & 255
  const xf = x - xi
  const yf = y - yi
  const u = fade(xf)
  const v = fade(yf)

  const aa = P[P[X] + Y]
  const ab = P[P[X] + Y + 1]
  const ba = P[P[X + 1] + Y]
  const bb = P[P[X + 1] + Y + 1]

  const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u)
  const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u)
  return lerp(x1, x2, v) * 0.70710678
}

function hash01(ix, iy) {
  return P[(P[ix & 255] + iy) & 255] / 255
}

function value2(x, y) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = fade(x - xi)
  const yf = fade(y - yi)
  const v00 = hash01(xi, yi) * 2 - 1
  const v10 = hash01(xi + 1, yi) * 2 - 1
  const v01 = hash01(xi, yi + 1) * 2 - 1
  const v11 = hash01(xi + 1, yi + 1) * 2 - 1
  return lerp(lerp(v00, v10, xf), lerp(v01, v11, xf), yf)
}

const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6

function simplex2(xin, yin) {
  const s = (xin + yin) * F2
  const i = Math.floor(xin + s)
  const j = Math.floor(yin + s)
  const t = (i + j) * G2
  const x0 = xin - (i - t)
  const y0 = yin - (j - t)
  const i1 = x0 > y0 ? 1 : 0
  const j1 = x0 > y0 ? 0 : 1
  const x1 = x0 - i1 + G2
  const y1 = y0 - j1 + G2
  const x2 = x0 - 1 + 2 * G2
  const y2 = y0 - 1 + 2 * G2

  const contrib = (hash, x, y) => {
    const tC = 0.5 - x * x - y * y
    if (tC < 0) return 0
    const tt = tC * tC
    return tt * tt * grad(hash, x, y)
  }

  const n0 = contrib(P[(P[i & 255] + j) & 255], x0, y0)
  const n1 = contrib(P[(P[(i + i1) & 255] + j + j1) & 255], x1, y1)
  const n2 = contrib(P[(P[(i + 1) & 255] + j + 1) & 255], x2, y2)
  return clamp(70 * (n0 + n1 + n2), -1, 1)
}

function worley2(x, y) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  let minD = 8
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = xi + ox
      const cy = yi + oy
      const px = cx + hash01(cx, cy)
      const py = cy + hash01(cx + 37, cy + 91)
      const dx = x - px
      const dy = y - py
      minD = Math.min(minD, dx * dx + dy * dy)
    }
  }
  return clamp(1 - 2 * Math.sqrt(minD), -1, 1)
}

function fbm2(x, z, layer, kernel, mapSample = (value) => value) {
  const octaves = Math.max(1, Math.round(layer.octaves ?? 1))
  const persistence = layer.persistence ?? 0.5
  const lacunarity = layer.lacunarity ?? 2
  let sum = 0
  let amp = 1
  let freq = layer.frequency
  let norm = 0

  for (let i = 0; i < octaves; i++) {
    sum += mapSample(kernel(x * freq, z * freq)) * amp
    norm += amp
    amp *= persistence
    freq *= lacunarity
  }

  return sum / (norm || 1)
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value))
}

/** Remap normalized noise n in [-1, 1]. */
export function shapeValue(n, params) {
  const op = params.shape || 'identity'

  if (op === 'billow') {
    const billow = Math.abs(n) * 2 - 1
    return lerp(n, billow, params.shapeMix ?? 1)
  }

  if (op === 'ridged') {
    const sharp = params.shapeRidgeSharp ?? 1
    const off = params.shapeRidgeOffset ?? 0
    const ridge = 1 - Math.pow(Math.abs(clamp(n + off, -1, 1)), sharp)
    return ridge * 2 - 1
  }

  if (op === 'power') {
    const exp = params.shapePower ?? 2
    const sign = n < 0 ? -1 : 1
    return sign * Math.pow(Math.abs(n), exp)
  }

  if (op === 'terrace') {
    const steps = Math.max(2, Math.round(params.shapeSteps ?? 5))
    const sharp = params.shapeTerraceSharp ?? 1
    const t = n * 0.5 + 0.5
    const quantized = Math.round(t * (steps - 1)) / (steps - 1)
    return lerp(t, quantized, sharp) * 2 - 1
  }

  if (op === 'clamp') {
    let lo = params.shapeLow ?? -0.4
    let hi = params.shapeHigh ?? 0.4
    if (lo > hi) {
      const swap = lo
      lo = hi
      hi = swap
    }
    return clamp(n, lo, hi)
  }

  if (op === 'gain') {
    const k = Math.max(0.05, params.shapeGain ?? 1)
    const t = n * 0.5 + 0.5
    const a = 0.5 * Math.pow(2 * (t < 0.5 ? t : 1 - t), k)
    return (t < 0.5 ? a : 1 - a) * 2 - 1
  }

  return n
}

/**
 * One layer. Kernel comes from layer.equation, then shaping s(n).
 */
export function sampleLayerNormalized(x, z, layer) {
  const px = x + (layer.offsetX ?? 0)
  const pz = z + (layer.offsetZ ?? 0)
  const equation = layer.equation || 'perlin-fbm'
  let raw = 0

  if (isSimulatedEquation(equation)) {
    raw = sampleSimField(px, pz, layer, GRID_SIZE)
  } else if (equation === 'value-fbm') {
    raw = fbm2(px, pz, layer, value2)
  } else if (equation === 'simplex-fbm') {
    raw = fbm2(px, pz, layer, simplex2)
  } else if (equation === 'worley') {
    raw = fbm2(px, pz, layer, worley2)
  } else if (equation === 'turbulence') {
    raw = fbm2(px, pz, layer, perlin2, (value) => Math.abs(value) * 2 - 1)
  } else if (equation === 'ridged-fbm') {
    raw = fbm2(px, pz, layer, perlin2, (value) => {
      const ridge = 1 - Math.abs(value)
      return ridge * ridge * 2 - 1
    })
  } else if (equation === 'domain-warp') {
    const freq = layer.frequency
    const warp = 4.5
    const qx = px + perlin2(px * freq, pz * freq) * warp
    const qz = pz + perlin2(px * freq + 19.1, pz * freq + 5.4) * warp
    raw = fbm2(qx, qz, layer, perlin2)
  } else {
    raw = fbm2(px, pz, layer, perlin2)
  }

  return shapeValue(raw, layer)
}

function blendLayer(prev, next, blend, mix) {
  const amount = mix ?? 1
  if (blend === 'mix') return lerp(prev, next, amount)
  if (blend === 'max') return lerp(prev, Math.max(prev, next), amount)
  if (blend === 'min') return lerp(prev, Math.min(prev, next), amount)
  if (blend === 'multiply') return lerp(prev, (prev * next) / 3, amount)
  return prev + next * amount
}

/** Stacked height used by the 2D map and the 3D grid. */
export function sampleHeight(x, z, params) {
  const layers = getLayers(params)
  let height = 0
  let started = false

  for (const layer of layers) {
    if (layer.enabled === false) continue
    const mix = layer.mix ?? 1
    if (mix <= 0) continue
    const value = sampleLayerNormalized(x, z, layer) * (layer.amplitude ?? 0)
    if (!started) {
      height = value * mix
      started = true
      continue
    }
    height = blendLayer(height, value, layer.blend, mix)
  }

  return height
}

/** Stacked field mapped back to roughly [-1, 1]. */
export function sampleNormalized(x, z, params) {
  return clamp(sampleHeight(x, z, params) / stackedAmplitude(params), -1, 1)
}

export function applyNoiseToGrid(geometry, params) {
  const positions = geometry.attributes.position
  const colors = geometry.attributes.color

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const z = positions.getZ(i)
    const y = sampleHeight(x, z, params)
    positions.setY(i, y)

    const t = Math.min(
      1,
      Math.max(0, (y / stackedAmplitude(params)) * 0.5 + 0.5),
    )
    colors.setXYZ(
      i,
      (26 + (62 - 26) * t) / 255,
      (30 + (224 - 30) * t) / 255,
      (36 + (255 - 36) * t) / 255,
    )
  }

  positions.needsUpdate = true
  colors.needsUpdate = true
  geometry.computeVertexNormals()
}
