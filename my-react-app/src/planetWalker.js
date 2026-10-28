import * as THREE from 'three'
import { PLANET_RADIUS, planetHeight, seaRadius } from './planet.js'

export function isWater(dir, params) {
  if (params.planetOcean === false) return false
  const r = PLANET_RADIUS + planetHeight(dir.x, dir.y, dir.z, params) * (params.planetRelief ?? 0.55)
  return r < seaRadius(params) + 0.04
}

const SAMPLER_LON = 96
const SAMPLER_LAT = 48

function bucketOf(x, y, z) {
  const r = Math.hypot(x, y, z) || 1
  const lon = Math.atan2(z, x)
  const lat = Math.asin(Math.max(-1, Math.min(1, y / r)))
  const i = Math.min(SAMPLER_LON - 1, Math.max(0, Math.floor((lon / (Math.PI * 2) + 0.5) * SAMPLER_LON)))
  const j = Math.min(SAMPLER_LAT - 1, Math.max(0, Math.floor((lat / Math.PI + 0.5) * SAMPLER_LAT)))
  return [i, j]
}

/**
 * Fast "how far out is the ground along this direction" lookup on the displaced planet mesh.
 * Triangles are bucketed by longitude and latitude, so a query only tests a handful of them.
 */
export function createSurfaceSampler(geometry) {
  const pos = geometry.attributes.position.array
  const index = geometry.index ? geometry.index.array : null
  const triangles = index ? index.length / 3 : pos.length / 9
  const buckets = Array.from({ length: SAMPLER_LON * SAMPLER_LAT }, () => [])

  const vertex = (t, k) => (index ? index[t * 3 + k] : t * 3 + k)
  for (let t = 0; t < triangles; t++) {
    const seen = new Set()
    let cx = 0
    let cy = 0
    let cz = 0
    for (let k = 0; k < 3; k++) {
      const v = vertex(t, k) * 3
      cx += pos[v]
      cy += pos[v + 1]
      cz += pos[v + 2]
      const [i, j] = bucketOf(pos[v], pos[v + 1], pos[v + 2])
      seen.add(j * SAMPLER_LON + i)
    }
    const [i, j] = bucketOf(cx, cy, cz)
    seen.add(j * SAMPLER_LON + i)
    for (const id of seen) buckets[id].push(t)
  }

  const hitTriangle = (t, dx, dy, dz) => {
    const a = vertex(t, 0) * 3
    const b = vertex(t, 1) * 3
    const c = vertex(t, 2) * 3
    const ax = pos[a]
    const ay = pos[a + 1]
    const az = pos[a + 2]
    const e1x = pos[b] - ax
    const e1y = pos[b + 1] - ay
    const e1z = pos[b + 2] - az
    const e2x = pos[c] - ax
    const e2y = pos[c + 1] - ay
    const e2z = pos[c + 2] - az
    const px = dy * e2z - dz * e2y
    const py = dz * e2x - dx * e2z
    const pz = dx * e2y - dy * e2x
    const det = e1x * px + e1y * py + e1z * pz
    if (Math.abs(det) < 1e-12) return -1
    const inv = 1 / det
    const sx = -ax
    const sy = -ay
    const sz = -az
    const u = (sx * px + sy * py + sz * pz) * inv
    if (u < -1e-6 || u > 1 + 1e-6) return -1
    const qx = sy * e1z - sz * e1y
    const qy = sz * e1x - sx * e1z
    const qz = sx * e1y - sy * e1x
    const v = (dx * qx + dy * qy + dz * qz) * inv
    if (v < -1e-6 || u + v > 1 + 1e-6) return -1
    return (e2x * qx + e2y * qy + e2z * qz) * inv
  }

  /** Distance from the planet center to the mesh along unit direction `dir`, or null on a miss. */
  const radiusAt = (dir) => {
    const [i, j] = bucketOf(dir.x, dir.y, dir.z)
    const nearPole = j <= 1 || j >= SAMPLER_LAT - 2
    for (let dj = -1; dj <= 1; dj++) {
      const row = j + dj
      if (row < 0 || row >= SAMPLER_LAT) continue
      const span = nearPole ? SAMPLER_LON : 3
      for (let k = 0; k < span; k++) {
        const col = nearPole ? k : (i + k - 1 + SAMPLER_LON) % SAMPLER_LON
        for (const t of buckets[row * SAMPLER_LON + col]) {
          const r = hitTriangle(t, dir.x, dir.y, dir.z)
          if (r > 0) return r
        }
      }
    }
    return null
  }

  return { radiusAt }
}

/** Ground radius along `dir`: the mesh when a sampler is ready, otherwise the noise height. */
export function groundRadius(dir, params, surface) {
  return (
    surface?.radiusAt(dir) ??
    PLANET_RADIUS + planetHeight(dir.x, dir.y, dir.z, params) * (params.planetRelief ?? 0.55)
  )
}

const side = new THREE.Vector3()
const basis = new THREE.Matrix4()
const targetQuat = new THREE.Quaternion()
const wallOffset = new THREE.Vector3()

/** Capsule radius as a fraction of character height, matching Messenger. */
const CAPSULE_RATIO = 0.2

export function capsuleRadius(height) {
  return Math.max(0.07, (height ?? 0.5) * CAPSULE_RATIO)
}

/**
 * Push `dir` out of nearby house boxes. Houses are oriented boxes on the sphere;
 * the character is a capsule, so this is a circle-vs-OBB test on the tangent plane.
 * Returns true if any wall pushed the walker.
 */
export function resolveWalls(dir, walls, radius = 0.1) {
  if (!walls?.length) return false
  const reach = Math.cos(2.6 / PLANET_RADIUS)
  let hit = false
  for (let iter = 0; iter < 3; iter++) {
    let moved = false
    for (const wall of walls) {
      if (dir.dot(wall.dir) < reach) continue
      wallOffset.copy(dir).addScaledVector(wall.dir, -dir.dot(wall.dir))
      const x = wallOffset.dot(wall.side) * PLANET_RADIUS
      const z = wallOffset.dot(wall.forward) * PLANET_RADIUS
      if (Math.abs(x) > wall.halfX + radius + 0.08 || Math.abs(z) > wall.halfZ + radius + 0.08) continue

      const cx = THREE.MathUtils.clamp(x, -wall.halfX, wall.halfX)
      const cz = THREE.MathUtils.clamp(z, -wall.halfZ, wall.halfZ)
      const dx = x - cx
      const dz = z - cz
      const distSq = dx * dx + dz * dz
      let pushX = 0
      let pushZ = 0
      if (distSq < 1e-12) {
        const roomX = wall.halfX - Math.abs(x)
        const roomZ = wall.halfZ - Math.abs(z)
        if (roomX < roomZ) pushX = Math.sign(x || 1) * (wall.halfX + radius) - x
        else pushZ = Math.sign(z || 1) * (wall.halfZ + radius) - z
      } else {
        const dist = Math.sqrt(distSq)
        if (dist >= radius) continue
        const grow = (radius - dist) / dist
        pushX = dx * grow
        pushZ = dz * grow
      }
      dir.addScaledVector(wall.side, pushX / PLANET_RADIUS)
      dir.addScaledVector(wall.forward, pushZ / PLANET_RADIUS)
      dir.normalize()
      moved = true
      hit = true
    }
    if (!moved) break
  }
  return hit
}

/**
 * A point that wanders over the planet: unit direction `dir`, tangent heading `forward`.
 * Positions are in the planet group's local space. Feet follow the ground mesh, including
 * the seabed, so walking into the ocean wades rather than floating.
 */
export function createWalker() {
  const dir = new THREE.Vector3(0, 1, 0)
  const forward = new THREE.Vector3(0, 0, 1)
  const prev = new THREE.Vector3()
  const probe = new THREE.Vector3()
  let turnRate = 0
  let placed = false

  const spawn = (params) => {
    let best = null
    let bestHeight = -Infinity
    for (let i = 0; i < 400; i++) {
      probe.randomDirection()
      if (!isWater(probe, params)) {
        best = probe.clone()
        break
      }
      const h = planetHeight(probe.x, probe.y, probe.z, params)
      if (h > bestHeight) {
        bestHeight = h
        best = probe.clone()
      }
    }
    dir.copy(best)
    forward.set(0, 1, 0).cross(dir)
    if (forward.lengthSq() < 1e-4) forward.set(1, 0, 0)
    forward.normalize().applyAxisAngle(dir, Math.random() * Math.PI * 2)
    placed = true
  }

  /**
   * Moves `distance` world units along the heading. Water is enterable; house walls
   * push the capsule out. `collision` is `{ walls, capsuleRadius }` from the town.
   */
  const step = (dt, distance, params, wander = 1, collision) => {
    if (!placed) spawn(params)
    const radius = PLANET_RADIUS + 0.5

    turnRate += (Math.random() - 0.5) * dt * 3 * wander
    turnRate = THREE.MathUtils.clamp(turnRate * (1 - dt * 0.4), -0.9, 0.9)
    forward.applyAxisAngle(dir, turnRate * dt)

    const angle = distance / radius
    prev.copy(dir)
    dir.multiplyScalar(Math.cos(angle)).addScaledVector(forward, Math.sin(angle)).normalize()
    forward.multiplyScalar(Math.cos(angle)).addScaledVector(prev, -Math.sin(angle))

    const walls = collision?.walls
    const blocked = walls?.length
      ? resolveWalls(dir, walls, collision.capsuleRadius ?? 0.1)
      : false
    if (blocked && dir.angleTo(prev) * radius < distance * 0.4) {
      const sign = Math.sign(turnRate || 1)
      forward.applyAxisAngle(dir, sign * 3 * dt)
      turnRate = sign * 0.9
    }
    forward.addScaledVector(dir, -forward.dot(dir)).normalize()
  }

  /** Stands `object` on the ground mesh at `dir`, feet down, facing `forward` (+Z of the object). */
  const place = (object, dt, params, surface, collision) => {
    if (!placed) spawn(params)
    if (collision?.walls?.length) {
      resolveWalls(dir, collision.walls, collision.capsuleRadius ?? 0.1)
      forward.addScaledVector(dir, -forward.dot(dir)).normalize()
    }
    object.position.copy(dir).multiplyScalar(groundRadius(dir, params, surface))
    side.crossVectors(dir, forward)
    basis.makeBasis(side, dir, forward)
    targetQuat.setFromRotationMatrix(basis)
    object.quaternion.slerp(targetQuat, Math.min(1, dt * 10))
  }

  /** Starts at a given direction and heading instead of a random spot. */
  const start = (at, heading) => {
    dir.copy(at).normalize()
    forward.copy(heading).addScaledVector(dir, -heading.dot(dir)).normalize()
    placed = true
  }

  return { dir, forward, step, place, start, reset: () => (placed = false) }
}
