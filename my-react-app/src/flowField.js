import * as THREE from 'three'
import { GRID_SIZE } from './noise.js'
import { meshHeight } from './paths.js'

const CLIFF = 0.32
const MAX_ARROWS = 420
const MAX_FLUID = 11000
const MAX_PARTICLES = 80
const MAX_TRAIL = 24
const TRAIL_SPACING = 0.42

const WIND_COLOR = [0.45, 0.9, 1]
const FISH_COLOR = [0.4, 0.98, 0.92]
const BEAR_COLOR = [0.98, 0.62, 0.22]

function gradient(heightAt, x, z, e = 0.55) {
  const yx1 = heightAt(x + e, z)
  const yx0 = heightAt(x - e, z)
  const yz1 = heightAt(x, z + e)
  const yz0 = heightAt(x, z - e)
  if (yx1 == null || yx0 == null || yz1 == null || yz0 == null) return null
  return { x: (yx1 - yx0) / (2 * e), z: (yz1 - yz0) / (2 * e) }
}

function slopeAt(heightAt, x, z) {
  const y = heightAt(x, z)
  const yx = heightAt(x + 0.5, z)
  const yz = heightAt(x, z + 0.5)
  if (y == null || yx == null || yz == null) return null
  return Math.hypot(yx - y, yz - y) / 0.5
}

function buildField(geometry, resolution, waterY) {
  const heightAt = meshHeight(geometry)
  const res = Math.max(8, Math.round(resolution))
  const half = GRID_SIZE * 0.5 - 0.7
  const step = (half * 2) / (res - 1)
  const raw = []
  let minY = Infinity
  let maxY = -Infinity

  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = -half + i * step
      const z = -half + j * step
      const y = heightAt(x, z)
      const g = gradient(heightAt, x, z)
      if (y == null || !g) continue
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      raw.push({ x, z, y, gx: g.x, gz: g.z, slope: Math.hypot(g.x, g.z) })
    }
  }

  const span = Math.max(0.001, maxY - minY)
  const cells = []
  const river = []
  const wind = []
  const gentle = []
  const open = []

  for (const sample of raw) {
    const rank = (sample.y - minY) / span
    const cliff = sample.slope > CLIFF
    const kind = cliff ? 0 : rank < 0.38 ? 1 : 2
    const index = cells.length
    cells.push({ ...sample, rank, kind })
    if (kind === 1) river.push(index)
    if (kind === 2) wind.push(index)
    if (!cliff) open.push(index)
    if (!cliff && sample.slope < 0.3 && rank > 0.16 && rank < 0.8) gentle.push(index)
  }

  let cx = 0
  let cz = 0
  let best = -Infinity
  const consider = (cell, inset) => {
    if (cell.slope > 0.24 || cell.rank < 0.48) return
    if (inset && (Math.abs(cell.x) > 14 || Math.abs(cell.z) > 14)) return
    const edge = Math.max(Math.abs(cell.x), Math.abs(cell.z))
    const score = cell.rank * 1.6 - cell.slope * 2 - edge * 0.03
    if (score > best) {
      best = score
      cx = cell.x
      cz = cell.z
    }
  }
  for (const index of wind) consider(cells[index], true)
  if (best === -Infinity) {
    for (const index of wind) consider(cells[index], false)
  }

  const windRing = []
  for (const index of wind) {
    const cell = cells[index]
    const dist = Math.hypot(cell.x - cx, cell.z - cz)
    if (dist > 2.2 && dist < 14) windRing.push(index)
  }

  const vortices = placeVortices(cells, waterY)
  const fluid = buildFluid(heightAt, waterY, minY, maxY, vortices, resolution)

  return {
    heightAt,
    minY,
    maxY,
    span,
    cells,
    river,
    wind: windRing.length ? windRing : wind,
    gentle,
    open,
    cx,
    cz,
    res,
    fluid,
    waterY,
    honey: { x: 2, y: 0, z: 2 },
  }
}

/** Flat basins get whirlpools. The deepest pool spins widest. */
function placeVortices(cells, waterY) {
  const pool = cells
    .filter((cell) => cell.y <= waterY + 0.35 && cell.slope < 0.34)
    .sort((a, b) => a.y - b.y)
  const picked = []
  for (const cell of pool) {
    let clear = true
    for (const other of picked) {
      if (Math.hypot(other.x - cell.x, other.z - cell.z) < 5.2) {
        clear = false
        break
      }
    }
    if (!clear) continue
    picked.push(cell)
    if (picked.length >= 6) break
  }
  return picked.map((cell, index) => ({
    x: cell.x,
    z: cell.z,
    radius: index === 0 ? 5.4 : 2.3 + (index % 3) * 0.7,
    reach: index === 0 ? 13 : 8,
    spin: index % 2 === 0 ? 1 : -1,
    strength: index === 0 ? 2.35 : 2.7,
  }))
}

/**
 * A grid of velocities over the water and the valleys that feed it.
 * Valleys drain downhill. On the water, that current curls into vortices.
 */
function buildFluid(heightAt, waterY, minY, maxY, vortices, resolution) {
  const res = Math.max(40, Math.min(64, Math.round((resolution ?? 18) * 2.6)))
  const half = GRID_SIZE * 0.5 - 0.35
  const step = (half * 2) / (res - 1)
  const count = res * res
  const fvx = new Float32Array(count)
  const fvz = new Float32Array(count)
  const fhy = new Float32Array(count)
  const wet = new Uint8Array(count)
  const spawn = []
  const waterSpawn = []
  const span = Math.max(0.001, maxY - minY)

  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = -half + i * step
      const z = -half + j * step
      const y = heightAt(x, z)
      const index = j * res + i
      if (y == null) continue
      fhy[index] = y
      const rank = (y - minY) / span
      const inWater = y <= waterY + 0.05
      const inValley = !inWater && rank < 0.4 && slopeAt(heightAt, x, z) < 0.42
      if (!inWater && !inValley) continue

      const g = gradient(heightAt, x, z, 0.65)
      let vx = 0
      let vz = 0
      if (g) {
        const drop = Math.hypot(g.x, g.z)
        if (drop > 0.012) {
          const drain = inWater ? 0.28 : 1.05
          vx -= (g.x / drop) * drain
          vz -= (g.z / drop) * drain
        }
      }
      for (const vortex of vortices) {
        const dx = x - vortex.x
        const dz = z - vortex.z
        const radius = Math.hypot(dx, dz)
        if (radius > vortex.reach || radius < 0.001) continue
        const fall = Math.exp(-(radius * radius) / (2 * vortex.radius * vortex.radius))
        const core = 0.75
        const spin =
          vortex.spin * (radius < core ? radius / core : core / radius) * vortex.strength * fall
        const weight = inWater ? 1 : fall * 0.35
        vx += (-dz / radius) * spin * weight
        vz += (dx / radius) * spin * weight
        if (inWater) {
          vx += (-dx / radius) * 0.16 * fall
          vz += (-dz / radius) * 0.16 * fall
        }
      }
      fvx[index] = vx
      fvz[index] = vz
      wet[index] = inWater ? 2 : 1
      if (inWater) waterSpawn.push(x, z)
      else if ((i + j) % 2 === 0) spawn.push(x, z)
    }
  }

  return { res, half, fvx, fvz, fhy, wet, spawn, waterSpawn, waterY }
}

function sampleFluid(fluid, x, z) {
  const { res, half, fvx, fvz, fhy, wet } = fluid
  const span = half * 2
  const fx = ((x + half) / span) * (res - 1)
  const fz = ((z + half) / span) * (res - 1)
  if (fx < 0 || fz < 0 || fx > res - 1 || fz > res - 1) return null
  const x0 = Math.min(res - 2, Math.floor(fx))
  const z0 = Math.min(res - 2, Math.floor(fz))
  const tx = fx - x0
  const tz = fz - z0
  const i00 = z0 * res + x0
  const i10 = i00 + 1
  const i01 = i00 + res
  const i11 = i01 + 1
  const mark = wet[i00] || wet[i10] || wet[i01] || wet[i11]
  if (!mark) return null
  const blend = (arr) => {
    const a = arr[i00] * (1 - tx) + arr[i10] * tx
    const b = arr[i01] * (1 - tx) + arr[i11] * tx
    return a * (1 - tz) + b * tz
  }
  const nearest = wet[tz < 0.5 ? (tx < 0.5 ? i00 : i10) : tx < 0.5 ? i01 : i11]
  return { x: blend(fvx), z: blend(fvz), y: blend(fhy), wet: nearest || 1 }
}

function windVector(x, z, cx, cz, time) {
  const dx = x - cx
  const dz = z - cz
  const spin = time * 0.65
  const c = Math.cos(spin)
  const s = Math.sin(spin)
  const rx = dx * c + dz * s
  const rz = -dx * s + dz * c
  const radius = Math.hypot(rx, rz) || 0.001
  const tx = -rz / radius
  const tz = rx / radius
  const inward = 0.32
  const lx = tx + (-rx / radius) * inward
  const lz = tz + (-rz / radius) * inward
  return { x: lx * c - lz * s, z: lx * s + lz * c }
}

function drainage(heightAt, x, z) {
  const y = heightAt(x, z)
  const g = gradient(heightAt, x, z, 0.7)
  if (y == null || !g) return null
  const drop = Math.hypot(g.x, g.z)
  if (drop >= 0.02) return { x: -g.x / drop, z: -g.z / drop }
  let best = 0
  let bx = 0
  let bz = 1
  for (let k = 0; k < 8; k++) {
    const angle = (k / 8) * Math.PI * 2
    const nx = Math.cos(angle)
    const nz = Math.sin(angle)
    const ny = heightAt(x + nx * 1.25, z + nz * 1.25)
    if (ny == null) continue
    const fall = y - ny
    if (fall > best) {
      best = fall
      bx = nx
      bz = nz
    }
  }
  return { x: bx, z: bz }
}

function sampleRank(field, x, z) {
  const y = field.heightAt(x, z)
  if (y == null) return null
  const slope = slopeAt(field.heightAt, x, z)
  if (slope == null) return null
  return { y, slope, rank: (y - field.minY) / field.span }
}

function stir(vx, vz, x, z, pointer) {
  if (!pointer.hit) return { x: vx, z: vz, w: 0 }
  const dx = x - pointer.x
  const dz = z - pointer.z
  const dist = Math.hypot(dx, dz)
  const radius = pointer.down ? 7.2 : 4.0
  if (dist >= radius || dist < 0.0001) return { x: vx, z: vz, w: 0 }
  const fall = (1 - dist / radius) ** 2
  const strength = (pointer.down ? 3.5 : 1.2) * fall
  const rx = dx / dist
  const rz = dz / dist
  return {
    x: vx + (rx * 0.72 - rz * 0.95) * strength,
    z: vz + (rz * 0.72 + rx * 0.95) * strength,
    w: fall * (pointer.down ? 1 : 0.34),
  }
}

function pickIndex(list) {
  if (!list.length) return -1
  return list[Math.floor(Math.random() * list.length)]
}

function makeParticle(type) {
  return {
    type,
    x: 0,
    z: 0,
    vx: 0,
    vz: 1,
    trail: new Float32Array(MAX_TRAIL * 3),
    head: 0,
    filled: 0,
    stuck: 0,
  }
}

function clearTrail(particle) {
  particle.head = 0
  particle.filled = 0
  particle.stuck = 0
}

function spawnParticle(particle, field) {
  const pool =
    particle.type === 'fish'
      ? field.river
      : particle.type === 'bear'
        ? field.gentle.length
          ? field.gentle
          : field.open
        : field.wind.length
          ? field.wind
          : field.open
  if (!pool.length) return
  let cell = field.cells[pickIndex(pool)]
  if (particle.type === 'bear') {
    const ranked = pool
      .map((index) => field.cells[index])
      .filter((candidate) => candidate.slope < 0.2)
      .sort((a, b) => {
        const da = Math.hypot(a.x - field.honey.x, a.z - field.honey.z)
        const db = Math.hypot(b.x - field.honey.x, b.z - field.honey.z)
        return db - da
      })
    const choices = ranked.slice(0, Math.max(1, Math.floor(ranked.length * 0.2)))
    if (choices.length) cell = choices[Math.floor(Math.random() * choices.length)]
  } else if (particle.type === 'fish' && field.river.length) {
    const ranked = field.river
      .map((index) => field.cells[index])
      .sort((a, b) => b.rank - a.rank)
    const upper = ranked.slice(0, Math.max(1, Math.floor(ranked.length * 0.45)))
    cell = upper[Math.floor(Math.random() * upper.length)]
  }
  particle.x = cell.x
  particle.z = cell.z
  particle.vx = 0
  particle.vz = 1
  clearTrail(particle)
}

function pushTrail(particle, x, y, z) {
  const cursor = particle.head * 3
  if (particle.filled > 0) {
    const prev = ((particle.head - 1 + MAX_TRAIL) % MAX_TRAIL) * 3
    const dx = x - particle.trail[prev]
    const dz = z - particle.trail[prev + 2]
    if (dx * dx + dz * dz < TRAIL_SPACING * TRAIL_SPACING) return
  }
  particle.trail[cursor] = x
  particle.trail[cursor + 1] = y
  particle.trail[cursor + 2] = z
  particle.head = (particle.head + 1) % MAX_TRAIL
  if (particle.filled < MAX_TRAIL) particle.filled += 1
}

function trailPoint(particle, age) {
  const index = (particle.head - 1 - age + MAX_TRAIL * 2) % MAX_TRAIL
  const cursor = index * 3
  return [particle.trail[cursor], particle.trail[cursor + 1], particle.trail[cursor + 2]]
}

function tint(rgb, unknown, stirWeight) {
  const lift = unknown ? 0.28 : 0
  const hot = stirWeight * 0.45
  return [
    Math.min(1, rgb[0] + lift + hot),
    Math.min(1, rgb[1] + lift * 0.6 + hot * 0.7),
    Math.min(1, rgb[2] + lift * 0.4),
  ]
}

function writeVertex(positions, colors, vertex, x, y, z, rgb) {
  const p = vertex * 3
  positions[p] = x
  positions[p + 1] = y
  positions[p + 2] = z
  colors[p] = rgb[0]
  colors[p + 1] = rgb[1]
  colors[p + 2] = rgb[2]
}

export function createFlowLayer() {
  const group = new THREE.Group()
  const arrowPositions = new Float32Array(MAX_ARROWS * 6 * 3)
  const arrowColors = new Float32Array(MAX_ARROWS * 6 * 3)
  const arrowGeometry = new THREE.BufferGeometry()
  arrowGeometry.setAttribute('position', new THREE.BufferAttribute(arrowPositions, 3).setUsage(THREE.DynamicDrawUsage))
  arrowGeometry.setAttribute('color', new THREE.BufferAttribute(arrowColors, 3).setUsage(THREE.DynamicDrawUsage))
  arrowGeometry.setDrawRange(0, 0)
  const arrowMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    fog: false,
    toneMapped: false,
    depthWrite: false,
  })
  const arrows = new THREE.LineSegments(arrowGeometry, arrowMaterial)
  arrows.frustumCulled = false
  arrows.renderOrder = 3
  group.add(arrows)

  const fluidPositions = new Float32Array(MAX_FLUID * 2 * 3)
  const fluidColors = new Float32Array(MAX_FLUID * 2 * 3)
  const fluidGeometry = new THREE.BufferGeometry()
  fluidGeometry.setAttribute('position', new THREE.BufferAttribute(fluidPositions, 3).setUsage(THREE.DynamicDrawUsage))
  fluidGeometry.setAttribute('color', new THREE.BufferAttribute(fluidColors, 3).setUsage(THREE.DynamicDrawUsage))
  fluidGeometry.setDrawRange(0, 0)
  const fluidMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    fog: false,
    toneMapped: false,
    depthWrite: false,
  })
  const fluidLines = new THREE.LineSegments(fluidGeometry, fluidMaterial)
  fluidLines.frustumCulled = false
  fluidLines.renderOrder = 5
  group.add(fluidLines)
  const fluidX = new Float32Array(MAX_FLUID)
  const fluidZ = new Float32Array(MAX_FLUID)
  const fluidLife = new Float32Array(MAX_FLUID)
  let fluidBorn = 0

  const trailPositions = new Float32Array(MAX_PARTICLES * (MAX_TRAIL - 1) * 2 * 3)
  const trailColors = new Float32Array(MAX_PARTICLES * (MAX_TRAIL - 1) * 2 * 3)
  const trailGeometry = new THREE.BufferGeometry()
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
  trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3))
  trailGeometry.setDrawRange(0, 0)
  const trailMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    fog: false,
    toneMapped: false,
    depthWrite: false,
  })
  const trails = new THREE.LineSegments(trailGeometry, trailMaterial)
  trails.frustumCulled = false
  group.add(trails)

  const headGeometry = new THREE.SphereGeometry(0.22, 8, 6)
  const headMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    fog: false,
    toneMapped: false,
    depthWrite: false,
  })
  const heads = new THREE.InstancedMesh(headGeometry, headMaterial, MAX_PARTICLES)
  heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  heads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3)
  heads.frustumCulled = false
  heads.count = 0
  group.add(heads)

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1.08, 32),
    new THREE.MeshBasicMaterial({
      color: 0xfff4c8,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false,
      depthWrite: false,
    }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.visible = false
  ring.renderOrder = 3
  group.add(ring)

  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  let field = null
  let fieldKey = ''
  const particles = []
  let lastParticleCount = -1

  function ensureParticles(count, nextField) {
    const total = THREE.MathUtils.clamp(Math.round(count), 8, MAX_PARTICLES)
    const fishCount = THREE.MathUtils.clamp(Math.round(total * 0.14), 3, 7)
    const bearCount = 1
    const windCount = total - fishCount - bearCount
    const types = [
      ...Array(windCount).fill('wind'),
      ...Array(fishCount).fill('fish'),
      ...Array(bearCount).fill('bear'),
    ]
    if (types.length === particles.length && lastParticleCount === total) return
    lastParticleCount = total
    particles.length = 0
    for (const type of types) {
      const particle = makeParticle(type)
      if (nextField) spawnParticle(particle, nextField)
      particles.push(particle)
    }
  }

  function stepParticle(particle, dt, time, pointer) {
    if (!field) return
    const here = sampleRank(field, particle.x, particle.z)
    if (!here) {
      spawnParticle(particle, field)
      return
    }
    let vx = 0
    let vz = 0
    if (particle.type === 'wind') {
      const flow = windVector(particle.x, particle.z, field.cx, field.cz, time)
      vx = flow.x
      vz = flow.z
    } else if (particle.type === 'fish') {
      const flow = drainage(field.heightAt, particle.x, particle.z)
      if (!flow) {
        spawnParticle(particle, field)
        return
      }
      vx = flow.x
      vz = flow.z
      if (here.rank > 0.34) {
        vx = vx * 0.35 + flow.x * 0.65
        vz = vz * 0.35 + flow.z * 0.65
      }
    } else {
      const dx = field.honey.x - particle.x
      const dz = field.honey.z - particle.z
      const dist = Math.hypot(dx, dz)
      if (dist < 1.2) {
        spawnParticle(particle, field)
        return
      }
      const wander = Math.sin(time * 1.15 + particle.x * 0.35) * 0.42
      vx = dx / dist - (dz / dist) * wander
      vz = dz / dist + (dx / dist) * wander
    }

    const stirred = stir(vx, vz, particle.x, particle.z, pointer)
    vx = stirred.x
    vz = stirred.z
    const len = Math.hypot(vx, vz) || 1
    const rate = particle.type === 'bear' ? 1.05 : particle.type === 'fish' ? 1.55 : 2.15
    const step = Math.min(0.85, rate * dt)
    const dirx = vx / len
    const dirz = vz / len

    if (particle.type === 'bear') {
      const options = [
        [dirx, dirz],
        [-dirz, dirx],
        [dirz, -dirx],
        [-dirx, -dirz],
      ]
      let moved = false
      for (const [sx, sz] of options) {
        const nx = particle.x + sx * step
        const nz = particle.z + sz * step
        const slope = slopeAt(field.heightAt, nx, nz)
        const ny = field.heightAt(nx, nz)
        if (ny == null || slope == null || slope > 0.36) continue
        particle.x = nx
        particle.z = nz
        particle.vx = sx
        particle.vz = sz
        moved = true
        break
      }
      particle.stuck = moved ? 0 : particle.stuck + 1
      if (particle.stuck > 36) spawnParticle(particle, field)
    } else {
      const nx = particle.x + dirx * step
      const nz = particle.z + dirz * step
      const next = sampleRank(field, nx, nz)
      const leavesValley = particle.type === 'fish' && next && next.rank > 0.5 && stirred.w < 0.45
      const blocked = !next || next.slope > CLIFF || leavesValley
      if (blocked) {
        if (particle.type === 'wind' || (particle.type === 'fish' && here.rank > 0.46)) {
          spawnParticle(particle, field)
        } else if (particle.type === 'fish') {
          const flow = drainage(field.heightAt, particle.x, particle.z)
          const nx2 = particle.x + (flow?.x ?? 0) * step
          const nz2 = particle.z + (flow?.z ?? 0) * step
          const retry = sampleRank(field, nx2, nz2)
          if (flow && retry && retry.slope <= CLIFF && retry.rank <= 0.48) {
            particle.x = nx2
            particle.z = nz2
            particle.vx = flow.x
            particle.vz = flow.z
            particle.stuck = 0
          } else {
            particle.stuck += 1
            if (particle.stuck > 18) spawnParticle(particle, field)
          }
        }
      } else {
        particle.x = nx
        particle.z = nz
        particle.vx = dirx
        particle.vz = dirz
        particle.stuck = 0
        if (particle.type === 'wind') {
          const radius = Math.hypot(particle.x - field.cx, particle.z - field.cz)
          if (radius < 1.5 || radius > 15.5 || here.rank < 0.36) spawnParticle(particle, field)
        }
      }
    }

    const y = field.heightAt(particle.x, particle.z)
    if (y == null) {
      spawnParticle(particle, field)
      return
    }
    const lift = particle.type === 'wind' ? 0.55 : particle.type === 'bear' ? 0.34 : 0.2
    const bob = particle.type === 'wind' ? Math.sin(time * 2.2 + particle.x) * 0.12 : 0
    pushTrail(particle, particle.x, y + lift + bob, particle.z)
  }

  function drawArrows(vectorCount, time, pointer, unknown) {
    if (!field) {
      arrowGeometry.setDrawRange(0, 0)
      return
    }
    const drawable = field.wind.filter((index) => field.cells[index].rank >= 0.62)
    const shown = Math.min(MAX_ARROWS, drawable.length, Math.max(0, Math.round(vectorCount * 0.12)))
    if (!shown) {
      arrowGeometry.setDrawRange(0, 0)
      return
    }
    const stride = drawable.length / shown
    const spacing = (GRID_SIZE - 1.4) / Math.max(1, field.res - 1)
    const baseLen = Math.min(1.35, spacing * 0.72)
    const lift = unknown ? 0.42 : 0.18

    for (let i = 0; i < shown; i++) {
      const cell = field.cells[drawable[Math.floor(i * stride)]]
      const flow = windVector(cell.x, cell.z, field.cx, field.cz, time)
      const stirred = stir(flow.x, flow.z, cell.x, cell.z, pointer)
      const mag = Math.hypot(stirred.x, stirred.z) || 1
      const dx = stirred.x / mag
      const dz = stirred.z / mag
      const arrowLen = baseLen * (0.85 + Math.min(0.85, stirred.w))
      const y = cell.y + lift
      const x1 = cell.x + dx * arrowLen
      const z1 = cell.z + dz * arrowLen
      const rgb = tint(WIND_COLOR, unknown, stirred.w)
      const tail = [rgb[0] * 0.35, rgb[1] * 0.35, rgb[2] * 0.35]
      const back = arrowLen * 0.28
      const wing = arrowLen * 0.18
      const base = i * 6
      writeVertex(arrowPositions, arrowColors, base, cell.x, y, cell.z, tail)
      writeVertex(arrowPositions, arrowColors, base + 1, x1, y, z1, rgb)
      writeVertex(arrowPositions, arrowColors, base + 2, x1, y, z1, rgb)
      writeVertex(arrowPositions, arrowColors, base + 3, x1 - dx * back - dz * wing, y, z1 - dz * back + dx * wing, rgb)
      writeVertex(arrowPositions, arrowColors, base + 4, x1, y, z1, rgb)
      writeVertex(arrowPositions, arrowColors, base + 5, x1 - dx * back + dz * wing, y, z1 - dz * back - dx * wing, rgb)
    }
    arrowGeometry.setDrawRange(0, shown * 6)
    arrowGeometry.attributes.position.needsUpdate = true
    arrowGeometry.attributes.color.needsUpdate = true
  }

  function respawnFluid(index) {
    const fluid = field?.fluid
    const pool = fluid?.waterSpawn?.length && Math.random() < 0.82 ? fluid.waterSpawn : fluid?.spawn
    if (!pool?.length) return false
    const slot = (Math.random() * (pool.length / 2)) | 0
    fluidX[index] = pool[slot * 2] + (Math.random() - 0.5) * 0.45
    fluidZ[index] = pool[slot * 2 + 1] + (Math.random() - 0.5) * 0.45
    fluidLife[index] = 2.2 + Math.random() * 4.2
    return true
  }

  function drawFluid(vectorCount, dt, pointer, unknown, trailLength) {
    const fluid = field?.fluid
    const shown = Math.min(MAX_FLUID, Math.max(2800, Math.round(vectorCount * 48)))
    if (!fluid?.spawn.length && !fluid?.waterSpawn.length) {
      fluidGeometry.setDrawRange(0, 0)
      return
    }
    if (fluidBorn !== shown) {
      for (let i = fluidBorn; i < shown; i++) respawnFluid(i)
      fluidBorn = shown
    }
    const step = Math.min(0.05, Math.max(0.001, dt))
    const dash = 0.72 + (Math.max(2, trailLength) / 24) * 0.85
    let vertex = 0
    for (let i = 0; i < shown; i++) {
      let sample = sampleFluid(fluid, fluidX[i], fluidZ[i])
      fluidLife[i] -= step
      if (!sample || fluidLife[i] <= 0) {
        respawnFluid(i)
        sample = sampleFluid(fluid, fluidX[i], fluidZ[i])
        if (!sample) continue
      }
      const stirred = stir(sample.x, sample.z, fluidX[i], fluidZ[i], pointer)
      const vx = stirred.x
      const vz = stirred.z
      const speed = Math.hypot(vx, vz) || 0.05
      fluidX[i] += vx * step * 3.1
      fluidZ[i] += vz * step * 3.1
      const next = sampleFluid(fluid, fluidX[i], fluidZ[i])
      if (!next) {
        respawnFluid(i)
        continue
      }
      const inv = 1 / speed
      const dx = vx * inv
      const dz = vz * inv
      const length = Math.min(0.72, (0.12 + Math.min(0.38, speed * 0.2)) * dash)
      const y = (next.wet === 2 ? fluid.waterY + 0.11 : next.y + 0.16) + (unknown ? 0.18 : 0)
      const hot = Math.min(1, speed / 2.15)
      const head = tint(
        [
          0.05 + hot * 0.62 + stirred.w * 0.35,
          0.28 + hot * 0.66,
          0.78 + hot * 0.22,
        ],
        unknown,
        stirred.w,
      )
      const tail = [head[0] * 0.28, head[1] * 0.34, head[2] * 0.45]
      writeVertex(fluidPositions, fluidColors, vertex, fluidX[i] - dx * length, y, fluidZ[i] - dz * length, tail)
      writeVertex(fluidPositions, fluidColors, vertex + 1, fluidX[i] + dx * length * 0.25, y, fluidZ[i] + dz * length * 0.25, head)
      vertex += 2
    }
    fluidGeometry.setDrawRange(0, vertex)
    fluidGeometry.attributes.position.needsUpdate = true
    fluidGeometry.attributes.color.needsUpdate = true
  }

  function drawParticles(trailLength, unknown) {
    const limit = Math.max(2, Math.min(MAX_TRAIL, Math.round(trailLength)))
    let vertex = 0
    heads.count = particles.length
    particles.forEach((particle, index) => {
      const points = Math.min(limit, particle.filled)
      const rgb = tint(
        particle.type === 'fish' ? FISH_COLOR : particle.type === 'bear' ? BEAR_COLOR : WIND_COLOR,
        unknown,
        0,
      )
      for (let age = points - 1; age > 0; age--) {
        const a = trailPoint(particle, age)
        const b = trailPoint(particle, age - 1)
        const fade = (points - age) / points
        const dull = [rgb[0] * fade * 0.55, rgb[1] * fade * 0.55, rgb[2] * fade * 0.55]
        const bright = [rgb[0] * fade, rgb[1] * fade, rgb[2] * fade]
        writeVertex(trailPositions, trailColors, vertex, a[0], a[1], a[2], dull)
        writeVertex(trailPositions, trailColors, vertex + 1, b[0], b[1], b[2], bright)
        vertex += 2
      }
      const head = particle.filled ? trailPoint(particle, 0) : [particle.x, 0.2, particle.z]
      dummy.position.set(head[0], head[1], head[2])
      dummy.rotation.set(0, 0, 0)
      const aimX = head[0] + particle.vx
      const aimZ = head[2] + particle.vz
      dummy.lookAt(aimX, head[1], aimZ)
      if (particle.type === 'fish') dummy.scale.set(0.7, 0.55, 1.45)
      else if (particle.type === 'bear') dummy.scale.set(1.45, 1.05, 1.25)
      else dummy.scale.setScalar(0.62)
      dummy.updateMatrix()
      heads.setMatrixAt(index, dummy.matrix)
      color.setRGB(rgb[0], rgb[1], rgb[2])
      heads.setColorAt(index, color)
    })
    trailGeometry.setDrawRange(0, vertex)
    trailGeometry.attributes.position.needsUpdate = true
    trailGeometry.attributes.color.needsUpdate = true
    heads.instanceMatrix.needsUpdate = true
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true
  }

  function update({ geometry, key, params, time, dt, pointer, unknown, honey }) {
    const waterY = params.shaderWater ?? 0.15
    const nextKey = `${key}|${waterY.toFixed(3)}`
    if (!field || nextKey !== fieldKey) {
      fieldKey = nextKey
      field = buildField(geometry, params.fieldResolution ?? 18, waterY)
      lastParticleCount = -1
      fluidBorn = 0
    }
    if (honey) field.honey = honey
    ensureParticles(params.particleCount ?? 28, field)
    const step = Math.min(0.05, Math.max(0.001, dt))
    for (const particle of particles) stepParticle(particle, step, time, pointer)
    const vectors = params.vectorCount ?? 140
    drawFluid(vectors, step, pointer, unknown, params.trailLength ?? 8)
    drawArrows(vectors, time, pointer, unknown)
    drawParticles(params.trailLength ?? 8, unknown)

    if (pointer.hit) {
      ring.visible = true
      ring.position.set(pointer.x, pointer.y + (unknown ? 0.45 : 0.18), pointer.z)
      const radius = pointer.down ? 6.6 : 3.5
      ring.scale.set(radius, radius, radius)
      ring.material.opacity = pointer.down ? 0.72 : 0.48
      ring.material.color.set(unknown ? 0xffe7b0 : pointer.down ? 0xfff1c4 : 0xe7fff8)
    } else {
      ring.visible = false
    }
  }

  function dispose() {
    arrowGeometry.dispose()
    arrowMaterial.dispose()
    fluidGeometry.dispose()
    fluidMaterial.dispose()
    trailGeometry.dispose()
    trailMaterial.dispose()
    headGeometry.dispose()
    headMaterial.dispose()
    heads.dispose()
    ring.geometry.dispose()
    ring.material.dispose()
  }

  return { group, update, dispose }
}
