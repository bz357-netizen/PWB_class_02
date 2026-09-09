const SIM_SIZE = 64
const cache = new Map()
const CACHE_LIMIT = 20

export const SIM_IDS = new Set(['gray-scott', 'erosion', 'waves', 'diffusion'])

export function isSimulatedEquation(id) {
  return SIM_IDS.has(id)
}

function layerKey(layer) {
  return JSON.stringify({
    equation: layer.equation,
    frequency: layer.frequency,
    octaves: layer.octaves,
    lacunarity: layer.lacunarity,
    persistence: layer.persistence,
    offsetX: layer.offsetX,
    offsetZ: layer.offsetZ,
    simSteps: layer.simSteps,
    simFeed: layer.simFeed,
    simKill: layer.simKill,
    simDroplets: layer.simDroplets,
    simDamp: layer.simDamp,
  })
}

function hash(ix, iy) {
  let n = (ix * 374761393 + iy * 668265263) | 0
  n = (n ^ (n >>> 13)) * 1274126177
  n = n ^ (n >>> 16)
  return (n >>> 0) / 4294967295
}

function idx(x, y, size) {
  const xx = ((x % size) + size) % size
  const yy = ((y % size) + size) % size
  return yy * size + xx
}

function laplacian(field, i, j, size) {
  const c = field[idx(i, j, size)]
  return (
    field[idx(i - 1, j, size)] +
    field[idx(i + 1, j, size)] +
    field[idx(i, j - 1, size)] +
    field[idx(i, j + 1, size)] -
    4 * c
  )
}

function remap(field) {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < field.length; i++) {
    const v = field[i]
    if (v < min) min = v
    if (v > max) max = v
  }
  const span = max - min || 1
  const out = new Float32Array(field.length)
  for (let i = 0; i < field.length; i++) {
    out[i] = ((field[i] - min) / span) * 2 - 1
  }
  return out
}

function grayScott(layer, size) {
  const steps = Math.max(20, Math.round(layer.simSteps ?? 140))
  const F = layer.simFeed ?? 0.037
  const K = layer.simKill ?? 0.06
  const Du = 0.16
  const Dv = 0.08
  const u = new Float32Array(size * size)
  const v = new Float32Array(size * size)
  u.fill(1)

  const seedX = Math.floor((layer.offsetX ?? 0) * 0.7 + size * 0.5)
  const seedZ = Math.floor((layer.offsetZ ?? 0) * 0.7 + size * 0.5)
  const blob = 6

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const n = hash(i + seedX, j + seedZ)
      if (
        Math.abs(i - size / 2) < blob &&
        Math.abs(j - size / 2) < blob
      ) {
        v[idx(i, j, size)] = 0.8 + n * 0.2
        u[idx(i, j, size)] = 0.35
      } else if (n > 0.97) {
        v[idx(i, j, size)] = 0.8
      }
    }
  }

  const u2 = new Float32Array(size * size)
  const v2 = new Float32Array(size * size)

  for (let step = 0; step < steps; step++) {
    const srcU = step % 2 === 0 ? u : u2
    const srcV = step % 2 === 0 ? v : v2
    const dstU = step % 2 === 0 ? u2 : u
    const dstV = step % 2 === 0 ? v2 : v
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const k = idx(i, j, size)
        const uu = srcU[k]
        const vv = srcV[k]
        const uvv = uu * vv * vv
        dstU[k] = uu + Du * laplacian(srcU, i, j, size) - uvv + F * (1 - uu)
        dstV[k] = vv + Dv * laplacian(srcV, i, j, size) + uvv - (F + K) * vv
      }
    }
  }

  const lastU = steps % 2 === 0 ? u2 : u
  const lastV = steps % 2 === 0 ? v2 : v
  return {
    size,
    maps: [
      { id: 'u', label: 'U field', grid: remap(lastU) },
      { id: 'v', label: 'V field', grid: remap(lastV) },
    ],
    height: remap(lastV),
  }
}

function erosion(layer, size) {
  const steps = Math.max(40, Math.round(layer.simDroplets ?? 420))
  const freq = layer.frequency ?? 0.12
  const h = new Float32Array(size * size)
  const sediment = new Float32Array(size * size)

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const n =
        hash(i + Math.floor(layer.offsetX ?? 0), j) * 0.6 +
        hash(i, j + 19) * 0.4
      const xf = i * freq
      const zf = j * freq
      h[idx(i, j, size)] =
        Math.sin(xf * 6.2 + zf * 1.3) * 0.35 + (n * 2 - 1) * 0.65
    }
  }

  const inertia = 0.15
  const capacity = 4
  const erode = 0.18
  const deposit = 0.12

  for (let d = 0; d < steps; d++) {
    let x = hash(d, 3) * (size - 1)
    let y = hash(d, 9) * (size - 1)
    let vx = 0
    let vy = 0
    let sat = 0
    for (let life = 0; life < 28; life++) {
      const ix = Math.floor(x)
      const iy = Math.floor(y)
      const gx =
        h[idx(ix + 1, iy, size)] - h[idx(ix - 1, iy, size)]
      const gy =
        h[idx(ix, iy + 1, size)] - h[idx(ix, iy - 1, size)]
      vx = vx * inertia - gx * (1 - inertia)
      vy = vy * inertia - gy * (1 - inertia)
      const len = Math.hypot(vx, vy) || 1
      vx /= len
      vy /= len
      x += vx
      y += vy
      if (x < 1 || y < 1 || x >= size - 1 || y >= size - 1) break
      const ni = Math.floor(x)
      const nj = Math.floor(y)
      const k = idx(ni, nj, size)
      const dh = h[idx(ix, iy, size)] - h[k]
      const cap = Math.max(dh, 0.01) * capacity
      if (sat > cap) {
        const left = (sat - cap) * deposit
        h[k] += left
        sediment[k] += left
        sat -= left
      } else {
        const take = Math.min((cap - sat) * erode, h[k] + 2)
        h[k] -= take
        sat += take
      }
    }
  }

  return {
    size,
    maps: [
      { id: 'height', label: 'Height', grid: remap(h) },
      { id: 'sediment', label: 'Sediment', grid: remap(sediment) },
    ],
    height: remap(h),
  }
}

function waves(layer, size) {
  const steps = Math.max(20, Math.round(layer.simSteps ?? 80))
  const damp = layer.simDamp ?? 0.018
  const u = new Float32Array(size * size)
  const prev = new Float32Array(size * size)
  const vel = new Float32Array(size * size)

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const n = hash(i * 3 + (layer.offsetX ?? 0), j * 5 + (layer.offsetZ ?? 0))
      const pulse = n > 0.92 ? (n - 0.92) * 8 - 0.4 : 0
      u[idx(i, j, size)] = pulse
      prev[idx(i, j, size)] = pulse * 0.85
    }
  }

  const c2 = 0.18
  for (let step = 0; step < steps; step++) {
    const next = new Float32Array(size * size)
    for (let j = 1; j < size - 1; j++) {
      for (let i = 1; i < size - 1; i++) {
        const k = idx(i, j, size)
        const lap = laplacian(u, i, j, size)
        next[k] = (2 * u[k] - prev[k] + c2 * lap) * (1 - damp)
        vel[k] = next[k] - u[k]
      }
    }
    prev.set(u)
    u.set(next)
  }

  return {
    size,
    maps: [
      { id: 'disp', label: 'Displacement', grid: remap(u) },
      { id: 'vel', label: 'Velocity', grid: remap(vel) },
    ],
    height: remap(u),
  }
}

function diffusion(layer, size) {
  const steps = Math.max(8, Math.round(layer.simSteps ?? 40))
  const field = new Float32Array(size * size)
  const seed = new Float32Array(size * size)

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const v = hash(i + Math.floor((layer.offsetX ?? 0) * 3), j + 17) * 2 - 1
      field[idx(i, j, size)] = v
      seed[idx(i, j, size)] = v
    }
  }

  for (let step = 0; step < steps; step++) {
    const next = new Float32Array(size * size)
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const k = idx(i, j, size)
        next[k] = field[k] * 0.6 + laplacian(field, i, j, size) * 0.1
      }
    }
    field.set(next)
  }

  const residual = new Float32Array(size * size)
  for (let i = 0; i < field.length; i++) residual[i] = seed[i] - field[i]

  return {
    size,
    maps: [
      { id: 'diffused', label: 'Diffused', grid: remap(field) },
      { id: 'residual', label: 'Residual', grid: remap(residual) },
    ],
    height: remap(field),
  }
}

function runSimulation(layer) {
  const size = SIM_SIZE
  const id = layer.equation
  if (id === 'erosion') return erosion(layer, size)
  if (id === 'waves') return waves(layer, size)
  if (id === 'diffusion') return diffusion(layer, size)
  return grayScott(layer, size)
}

export function getSimulationMaps(layer) {
  if (!isSimulatedEquation(layer?.equation)) return null
  const key = layerKey(layer)
  const hit = cache.get(key)
  if (hit) return hit
  const result = runSimulation(layer)
  cache.set(key, result)
  if (cache.size > CACHE_LIMIT) {
    const first = cache.keys().next().value
    cache.delete(first)
  }
  return result
}

export function sampleSimField(x, z, layer, worldSize = 48) {
  const result = getSimulationMaps(layer)
  if (!result) return 0
  const { size, height } = result
  const u = ((x / worldSize) + 0.5) * (size - 1)
  const v = ((z / worldSize) + 0.5) * (size - 1)
  const x0 = Math.max(0, Math.min(size - 2, Math.floor(u)))
  const y0 = Math.max(0, Math.min(size - 2, Math.floor(v)))
  const tx = u - x0
  const ty = v - y0
  const i00 = height[y0 * size + x0]
  const i10 = height[y0 * size + x0 + 1]
  const i01 = height[(y0 + 1) * size + x0]
  const i11 = height[(y0 + 1) * size + x0 + 1]
  return i00 * (1 - tx) * (1 - ty) + i10 * tx * (1 - ty) + i01 * (1 - tx) * ty + i11 * tx * ty
}
