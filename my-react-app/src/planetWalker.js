import * as THREE from 'three'
import { PLANET_RADIUS, planetHeight, seaRadius } from './planet.js'

export function isWater(dir, params, surface, margin = 0.04) {
  if (params.planetOcean === false) return false
  return groundRadius(dir, params, surface) < seaRadius(params) + margin
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
const bodySide = new THREE.Vector3()
const slideDir = new THREE.Vector3()
const carPrev = new THREE.Vector3()
const lookDir = new THREE.Vector3()
const lookHeading = new THREE.Vector3()
const DETOUR_YAWS = [0.55, -0.55, 1.05, -1.05, 1.6, -1.6, 2.35, -2.35, Math.PI]

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
 * Circle vs circle on the tangent plane. Tree trunks are posts: the capsule
 * cannot walk through them.
 */
export function resolveTrunks(dir, trunks, radius = 0.1) {
  if (!trunks?.length) return false
  const reach = Math.cos(1.4 / PLANET_RADIUS)
  let hit = false
  for (let iter = 0; iter < 3; iter++) {
    let moved = false
    for (const trunk of trunks) {
      if (dir.dot(trunk.dir) < reach) continue
      wallOffset.copy(dir).addScaledVector(trunk.dir, -dir.dot(trunk.dir))
      const dist = wallOffset.length() * PLANET_RADIUS
      const min = trunk.radius + radius
      if (dist >= min) continue
      if (dist < 1e-5) {
        wallOffset.set(0, 1, 0).cross(trunk.dir)
        if (wallOffset.lengthSq() < 1e-8) wallOffset.set(1, 0, 0).cross(trunk.dir)
      }
      wallOffset.normalize()
      dir.addScaledVector(wallOffset, (min - dist) / PLANET_RADIUS)
      dir.normalize()
      moved = true
      hit = true
    }
    if (!moved) break
  }
  return hit
}

function wallOverlaps(dir, wall, radius) {
  if (dir.dot(wall.dir) < Math.cos(2.6 / PLANET_RADIUS)) return false
  wallOffset.copy(dir).addScaledVector(wall.dir, -dir.dot(wall.dir))
  const x = wallOffset.dot(wall.side) * PLANET_RADIUS
  const z = wallOffset.dot(wall.forward) * PLANET_RADIUS
  if (Math.abs(x) > wall.halfX + radius + 0.08 || Math.abs(z) > wall.halfZ + radius + 0.08) return false
  const dx = x - THREE.MathUtils.clamp(x, -wall.halfX, wall.halfX)
  const dz = z - THREE.MathUtils.clamp(z, -wall.halfZ, wall.halfZ)
  return dx * dx + dz * dz < radius * radius
}

function trunkOverlaps(dir, trunk, radius) {
  if (dir.dot(trunk.dir) < Math.cos(1.4 / PLANET_RADIUS)) return false
  wallOffset.copy(dir).addScaledVector(trunk.dir, -dir.dot(trunk.dir))
  const min = trunk.radius + radius
  return wallOffset.length() * PLANET_RADIUS < min
}

function carOverlaps(dir, car, radius) {
  if (!car.dir || dir.dot(car.dir) < Math.cos(1.6 / PLANET_RADIUS)) return false
  const carSide = carAxes(car)
  wallOffset.copy(dir).addScaledVector(car.dir, -dir.dot(car.dir))
  const x = wallOffset.dot(carSide) * PLANET_RADIUS
  const z = wallOffset.dot(car.forward) * PLANET_RADIUS
  const halfX = car.halfX ?? 0.16
  const halfZ = car.halfZ ?? 0.28
  if (Math.abs(x) > halfX + radius + 0.1 || Math.abs(z) > halfZ + radius + 0.1) return false
  const dx = x - THREE.MathUtils.clamp(x, -halfX, halfX)
  const dz = z - THREE.MathUtils.clamp(z, -halfZ, halfZ)
  return dx * dx + dz * dz < radius * radius
}

/** True if this unit direction already sits inside a house, trunk, or car. Does not shove. */
export function blockedAt(dir, collision, radius = 0.1) {
  if (!collision) return false
  if (collision.walls?.length) {
    for (const wall of collision.walls) if (wallOverlaps(dir, wall, radius)) return true
  }
  if (collision.trunks?.length) {
    for (const trunk of collision.trunks) if (trunkOverlaps(dir, trunk, radius)) return true
  }
  if (collision.cars?.length) {
    for (const car of collision.cars) if (carOverlaps(dir, car, radius)) return true
  }
  return false
}

function alongHeading(from, heading, dist) {
  const ang = dist / PLANET_RADIUS
  return lookDir.copy(from).multiplyScalar(Math.cos(ang)).addScaledVector(heading, Math.sin(ang)).normalize()
}

function headingClear(from, heading, collision, cap) {
  lookHeading.copy(heading).addScaledVector(from, -heading.dot(from))
  if (lookHeading.lengthSq() < 1e-8) return false
  lookHeading.normalize()
  const pad = cap * 1.12
  return (
    !blockedAt(alongHeading(from, lookHeading, 0.38), collision, pad) &&
    !blockedAt(alongHeading(from, lookHeading, 0.82), collision, pad)
  )
}

function resolveContacts(at, collision, cap, carSpeed = 0) {
  let hit = false
  if (collision?.walls?.length) hit = resolveWalls(at, collision.walls, cap) || hit
  if (collision?.trunks?.length) hit = resolveTrunks(at, collision.trunks, cap) || hit
  if (collision?.cars?.length) hit = resolveCars(at, collision.cars, cap, { speed: carSpeed }) || hit
  return hit
}

function carAxes(car) {
  if (car.side) {
    car.side.crossVectors(car.dir, car.forward)
    if (car.side.lengthSq() < 1e-10) car.side.set(0, 1, 0).cross(car.dir)
    car.side.normalize()
    return car.side
  }
  bodySide.crossVectors(car.dir, car.forward)
  if (bodySide.lengthSq() < 1e-10) bodySide.set(0, 1, 0).cross(car.dir)
  return bodySide.normalize()
}

/**
 * Capsule vs car box. The robot is pushed out. The car is shoved along the
 * hit and stunned, so it either sits still or slides off the road.
 */
export function resolveCars(dir, cars, radius = 0.1, opts = {}) {
  if (!cars?.length) return false
  const speed = opts.speed ?? 0
  const reach = Math.cos(1.6 / PLANET_RADIUS)
  let hit = false
  for (let iter = 0; iter < 2; iter++) {
    let moved = false
    for (const car of cars) {
      if (!car.dir) continue
      if (dir.dot(car.dir) < reach) continue
      const carSide = carAxes(car)
      wallOffset.copy(dir).addScaledVector(car.dir, -dir.dot(car.dir))
      const x = wallOffset.dot(carSide) * PLANET_RADIUS
      const z = wallOffset.dot(car.forward) * PLANET_RADIUS
      const halfX = car.halfX ?? 0.16
      const halfZ = car.halfZ ?? 0.28
      if (Math.abs(x) > halfX + radius + 0.1 || Math.abs(z) > halfZ + radius + 0.1) continue

      const cx = THREE.MathUtils.clamp(x, -halfX, halfX)
      const cz = THREE.MathUtils.clamp(z, -halfZ, halfZ)
      const dx = x - cx
      const dz = z - cz
      const distSq = dx * dx + dz * dz
      let pushX = 0
      let pushZ = 0
      if (distSq < 1e-12) {
        const roomX = halfX - Math.abs(x)
        const roomZ = halfZ - Math.abs(z)
        if (roomX < roomZ) pushX = Math.sign(x || 1) * (halfX + radius) - x
        else pushZ = Math.sign(z || 1) * (halfZ + radius) - z
      } else {
        const dist = Math.sqrt(distSq)
        if (dist >= radius) continue
        const grow = (radius - dist) / dist
        pushX = dx * grow
        pushZ = dz * grow
      }
      dir.addScaledVector(carSide, pushX / PLANET_RADIUS)
      dir.addScaledVector(car.forward, pushZ / PLANET_RADIUS)
      dir.normalize()

      const incoming = (car.stun ?? 0) <= 0 && !car.offRoad
      const impact = speed > 0.2 || incoming
      const shove = impact ? 1.15 + speed * 0.35 : 0.45
      car.dir.addScaledVector(carSide, (-pushX * shove) / PLANET_RADIUS)
      car.dir.addScaledVector(car.forward, (-pushZ * shove) / PLANET_RADIUS)
      car.dir.normalize()
      if (impact) {
        if (!car.slide) car.slide = new THREE.Vector3()
        const impulse = speed > 0.2 ? Math.max(1.2, speed * 1.7) : Math.max(0.9, car.speed ?? 1.2)
        car.slide.addScaledVector(carSide, -Math.sign(pushX || dx || 1) * impulse * 0.55)
        car.slide.addScaledVector(car.forward, -Math.sign(pushZ || dz || 1) * impulse * 0.7)
        car.stun = Math.max(car.stun ?? 0, speed > 1.6 ? 1.0 : 2.4)
        car.offRoad = true
      }
      moved = true
      hit = true
    }
    if (!moved) break
  }
  return hit
}

/** Slide a car along the sphere. Water bounces it back. */
export function slideOnPlanet(car, dt, params, surface) {
  if (!car.slide || car.slide.lengthSq() < 2e-3) {
    car.slide?.set(0, 0, 0)
    return false
  }
  slideDir.copy(car.slide).addScaledVector(car.dir, -car.slide.dot(car.dir))
  if (slideDir.lengthSq() < 1e-6) {
    car.slide.set(0, 0, 0)
    return false
  }
  slideDir.normalize()
  const step = car.slide.length() * dt
  const angle = step / PLANET_RADIUS
  carPrev.copy(car.dir)
  car.dir.multiplyScalar(Math.cos(angle)).addScaledVector(slideDir, Math.sin(angle)).normalize()
  if (isWater(car.dir, params, surface, 0.08)) {
    car.dir.copy(carPrev)
    car.slide.multiplyScalar(-0.25)
    return true
  }
  car.forward.copy(slideDir)
  car.slide.multiplyScalar(Math.exp(-dt * 2.6))
  car.slide.addScaledVector(car.dir, -car.slide.dot(car.dir))
  return true
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
  let steerHold = 0
  let steerSign = 1
  let stuck = 0

  const pickDetour = (collision, cap) => {
    if (stuck > 10) return steerSign * Math.PI * 0.85
    const prefer = Math.sign(steerSign || turnRate || 1)
    const order = DETOUR_YAWS.slice().sort((a, b) => {
      const as = Math.sign(a) === prefer || a === 0 ? 0 : 1
      const bs = Math.sign(b) === prefer || b === 0 ? 0 : 1
      if (as !== bs) return as - bs
      return Math.abs(a) - Math.abs(b)
    })
    for (const yaw of order) {
      lookHeading.copy(forward).applyAxisAngle(dir, yaw)
      if (headingClear(dir, lookHeading, collision, cap)) return yaw
    }
    return prefer * 1.45
  }

  const takeStep = (distance, collision, cap, carSpeed) => {
    const radius = PLANET_RADIUS + 0.5
    const ang = distance / radius
    prev.copy(dir)
    dir.multiplyScalar(Math.cos(ang)).addScaledVector(forward, Math.sin(ang)).normalize()
    forward.multiplyScalar(Math.cos(ang)).addScaledVector(prev, -Math.sin(ang))
    const hit = resolveContacts(dir, collision, cap, carSpeed)
    if (hit) {
      dir.copy(prev)
      resolveContacts(dir, collision, cap, 0)
    }
    forward.addScaledVector(dir, -forward.dot(dir)).normalize()
    return hit
  }

  const spawn = (params, surface) => {
    let best = null
    let bestHeight = -Infinity
    for (let i = 0; i < 400; i++) {
      probe.randomDirection()
      if (!isWater(probe, params, surface, 0.2)) {
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
   * Moves `distance` world units along the heading. Water is enterable. Houses,
   * tree trunks, and cars push the capsule out. If the way is blocked, the walker
   * picks another heading and keeps going. `collision` is
   * `{ walls, trunks, cars, capsuleRadius, speed }` from the town.
   */
  const step = (dt, distance, params, wander = 1, collision) => {
    if (!placed) spawn(params)
    const cap = collision?.capsuleRadius ?? 0.1
    const carSpeed = collision?.speed ?? 0

    if (steerHold > 0) steerHold -= dt
    if (steerHold > 0) {
      turnRate = THREE.MathUtils.damp(turnRate, steerSign * 0.25, 6, dt)
    } else {
      turnRate += (Math.random() - 0.5) * dt * 3 * wander
      turnRate = THREE.MathUtils.clamp(turnRate * (1 - dt * 0.4), -0.9, 0.9)
    }
    forward.applyAxisAngle(dir, turnRate * dt)
    forward.addScaledVector(dir, -forward.dot(dir)).normalize()

    let detoured = false
    const aheadBlocked = !headingClear(dir, forward, collision, cap)
    if (aheadBlocked && steerHold <= 0) {
      const yaw = pickDetour(collision, cap)
      forward.applyAxisAngle(dir, yaw)
      forward.addScaledVector(dir, -forward.dot(dir)).normalize()
      steerSign = Math.sign(yaw) || steerSign
      turnRate = steerSign * 0.9
      steerHold = 0.7 + Math.random() * 0.45
      detoured = true
    }

    let blocked = takeStep(distance, collision, cap, carSpeed)
    if (blocked) {
      stuck += 1
      if (!detoured) {
        const yaw = pickDetour(collision, cap)
        forward.applyAxisAngle(dir, yaw)
        forward.addScaledVector(dir, -forward.dot(dir)).normalize()
        steerSign = Math.sign(yaw) || steerSign
        turnRate = steerSign * 1.15
        steerHold = 0.85 + Math.random() * 0.4
      }
      takeStep(distance * 0.6, collision, cap, 0)
    } else {
      stuck = Math.max(0, stuck - 2)
    }
    return { blocked, stuck }
  }

  /** Stands `object` on the ground mesh at `dir`, feet down, facing `forward` (+Z of the object). */
  const place = (object, dt, params, surface, collision) => {
    if (!placed) spawn(params, surface)
    const cap = collision?.capsuleRadius ?? 0.1
    let pushed = false
    if (collision?.walls?.length) pushed = resolveWalls(dir, collision.walls, cap) || pushed
    if (collision?.trunks?.length) pushed = resolveTrunks(dir, collision.trunks, cap) || pushed
    if (collision?.cars?.length) pushed = resolveCars(dir, collision.cars, cap, { speed: 0 }) || pushed
    if (pushed) forward.addScaledVector(dir, -forward.dot(dir)).normalize()
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

  return {
    dir,
    forward,
    step,
    place,
    start,
    debugState: () => ({ stuck, steerHold }),
    reset: () => {
      placed = false
      steerHold = 0
      stuck = 0
    },
  }
}
