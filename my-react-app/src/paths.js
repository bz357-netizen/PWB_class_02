import * as THREE from 'three'
import { GRID_SIZE, perlin2 } from './noise.js'

export function meshHeight(geometry) {
  const pos = geometry.attributes.position
  const cols = Math.round(Math.sqrt(pos.count))
  const segs = Math.max(1, cols - 1)
  const half = GRID_SIZE / 2

  return (x, z) => {
    const fx = ((x + half) / GRID_SIZE) * segs
    const fz = ((z + half) / GRID_SIZE) * segs
    if (fx < 0 || fz < 0 || fx > segs || fz > segs) return null
    const x0 = Math.min(segs - 1, Math.floor(fx))
    const z0 = Math.min(segs - 1, Math.floor(fz))
    const tx = fx - x0
    const tz = fz - z0
    const h = (ix, iz) => pos.getY(iz * cols + ix)
    const y00 = h(x0, z0)
    const y10 = h(x0 + 1, z0)
    const y01 = h(x0, z0 + 1)
    const y11 = h(x0 + 1, z0 + 1)
    return y00 * (1 - tx) * (1 - tz) + y10 * tx * (1 - tz) + y01 * (1 - tx) * tz + y11 * tx * tz
  }
}

function slopeAt(heightAt, x, z) {
  const y = heightAt(x, z)
  const yx = heightAt(x + 0.55, z)
  const yz = heightAt(x, z + 0.55)
  if (y == null || yx == null || yz == null) return null
  return Math.hypot(yx - y, yz - y) / 0.55
}

function gradient(heightAt, x, z) {
  const e = 0.5
  const yx1 = heightAt(x + e, z)
  const yx0 = heightAt(x - e, z)
  const yz1 = heightAt(x, z + e)
  const yz0 = heightAt(x, z - e)
  if (yx1 == null || yx0 == null || yz1 == null || yz0 == null) return null
  return { x: (yx1 - yx0) / (2 * e), z: (yz1 - yz0) / (2 * e) }
}

function steer(heightAt, start, goal, steps, stepLen) {
  const pts = []
  let x = start.x
  let z = start.z
  for (let i = 0; i < steps; i++) {
    const y = heightAt(x, z)
    if (y == null) break
    pts.push(new THREE.Vector3(x, y + 0.32, z))
    const dx = goal.x - x
    const dz = goal.z - z
    const dist = Math.hypot(dx, dz)
    if (dist < 1.1) break
    const wander = Math.sin(i * 0.65 + x * 0.15) * 0.7
    let dirx = dx / dist
    let dirz = dz / dist
    const sideX = -dirz
    const sideZ = dirx
    dirx += sideX * wander
    dirz += sideZ * wander
    const len = Math.hypot(dirx, dirz) || 1
    const tryStep = (sx, sz) => {
      const slope = slopeAt(heightAt, x + sx, z + sz)
      const ny = heightAt(x + sx, z + sz)
      return slope != null && ny != null && slope < 0.4
    }
    let sx = (dirx / len) * stepLen
    let sz = (dirz / len) * stepLen
    if (!tryStep(sx, sz)) {
      sx = -dirz * stepLen
      sz = dirx * stepLen
      if (!tryStep(sx, sz)) {
        sx = dirz * stepLen
        sz = -dirx * stepLen
        if (!tryStep(sx, sz)) break
      }
    }
    x += sx
    z += sz
  }
  const hy = heightAt(goal.x, goal.z)
  if (hy != null) pts.push(new THREE.Vector3(goal.x, hy + 0.32, goal.z))
  return pts
}

function flowDown(heightAt, start, steps, stepLen) {
  const pts = []
  let x = start.x
  let z = start.z
  for (let i = 0; i < steps; i++) {
    const y = heightAt(x, z)
    if (y == null) break
    pts.push(new THREE.Vector3(x, y + 0.22, z))
    const g = gradient(heightAt, x, z)
    if (!g) break
    const drop = Math.hypot(g.x, g.z)
    if (drop < 0.012 && i > 8) break
    const len = drop || 1
    const nx = x - (g.x / len) * stepLen
    const nz = z - (g.z / len) * stepLen
    if (heightAt(nx, nz) == null) break
    const slope = slopeAt(heightAt, nx, nz)
    if (slope != null && slope > 0.72) break
    x = nx
    z = nz
  }
  return pts
}

function windSpiral(heightAt, strength) {
  const s = THREE.MathUtils.clamp(strength ?? 1, 0.3, 2)
  const cx = -7
  const cz = 6
  const pts = []
  const turns = 2.35
  const steps = 100
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const ang = t * Math.PI * 2 * turns
    const radius = (1.5 + t * 12) * (0.5 + s * 0.5)
    const x = cx + Math.cos(ang) * radius
    const z = cz + Math.sin(ang) * radius
    const y = heightAt(x, z)
    if (y == null) continue
    pts.push(new THREE.Vector3(x, y + 0.6 + t * 2.6 * s, z))
  }
  return pts
}

export function buildEnvironmentPaths(geometry, windStrength) {
  const heightAt = meshHeight(geometry)
  const half = GRID_SIZE * 0.5 - 1.4
  const gentle = []
  let minY = Infinity
  let maxY = -Infinity

  for (let z = -half; z <= half; z += 1.7) {
    for (let x = -half; x <= half; x += 1.7) {
      const y = heightAt(x, z)
      const slope = slopeAt(heightAt, x, z)
      if (y == null || slope == null) continue
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (slope < 0.34) gentle.push({ x, y, z, slope })
    }
  }

  const span = Math.max(0.001, maxY - minY)
  let honey = gentle[0] ?? { x: 2, y: heightAt(2, 2) ?? 0, z: 2 }
  let bestGrove = -Infinity
  for (const point of gentle) {
    const rank = (point.y - minY) / span
    if (rank < 0.22 || rank > 0.72 || point.slope > 0.22) continue
    const grove = perlin2(point.x * 0.09, point.z * 0.09)
    if (grove > bestGrove) {
      bestGrove = grove
      honey = point
    }
  }

  let start = honey
  let far = 0
  for (const point of gentle) {
    const rank = (point.y - minY) / span
    if (rank < 0.18 || rank > 0.78 || point.slope > 0.28) continue
    const dist = Math.hypot(point.x - honey.x, point.z - honey.z)
    if (dist > far) {
      far = dist
      start = point
    }
  }

  let riverStart = null
  let bestDrop = -1
  for (const point of gentle) {
    const rank = (point.y - minY) / span
    if (rank < 0.4 || rank > 0.88) continue
    const g = gradient(heightAt, point.x, point.z)
    if (!g) continue
    const drop = Math.hypot(g.x, g.z)
    if (drop > bestDrop && drop < 0.9) {
      bestDrop = drop
      riverStart = point
    }
  }

  const honeyY = heightAt(honey.x, honey.z) ?? honey.y
  return {
    wind: windSpiral(heightAt, windStrength),
    bear: steer(heightAt, start, honey, 64, 0.9),
    honey: new THREE.Vector3(honey.x, honeyY + 0.12, honey.z),
    river: riverStart ? flowDown(heightAt, riverStart, 80, 0.72) : [],
  }
}

const STRAND_SEEDS = [
  [-9, -3, 3.4],
  [1, 7, 4.6],
  [8, -6, 2.8],
  [-4, 9, 5.2],
  [11, 3, 3.8],
  [-13, -9, 4.4],
]

export function buildFilaments(geometry) {
  const heightAt = meshHeight(geometry)
  const strands = []
  STRAND_SEEDS.forEach(([sx, sz, lift], index) => {
    const pts = []
    const steps = 20
    for (let k = 0; k <= steps; k++) {
      const t = k / steps
      const x = sx + Math.cos(index * 1.3) * (t - 0.1) * 10 + Math.sin(t * 5.5 + index) * 0.7
      const z = sz + Math.sin(index * 0.85) * t * 9
      const y = heightAt(x, z)
      if (y == null) continue
      const arc = Math.sin(t * Math.PI) * lift
      pts.push(new THREE.Vector3(x, y + 0.45 + arc, z))
    }
    if (pts.length > 5) strands.push(pts)
  })
  return strands
}

export function findCore(geometry) {
  const heightAt = meshHeight(geometry)
  let best = null
  for (let z = -8; z <= 8; z += 1.2) {
    for (let x = -8; x <= 8; x += 1.2) {
      const y = heightAt(x, z)
      if (y == null) continue
      if (!best || y < best.y) best = { x, y, z }
    }
  }
  if (!best) return new THREE.Vector3(0, 8, 0)
  return new THREE.Vector3(best.x, best.y + 5.5, best.z)
}
