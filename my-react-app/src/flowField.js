import * as THREE from 'three'
import { GRID_SIZE } from './noise.js'
import { meshHeight } from './paths.js'

const CLIFF = 0.32
const MAX_ARROWS = 420
const MAX_PARTICLES = 80
const MAX_TRAIL = 24
const TRAIL_SPACING = 0.42

const WIND_COLOR = [0.45, 0.9, 1]
const RIVER_COLOR = [0.2, 0.86, 0.78]
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

function buildField(geometry, resolution) {
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
    honey: { x: 2, y: 0, z: 2 },
  }
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
  group.add(arrows)

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
    const drawable = []
    for (let i = 0; i < field.cells.length; i++) {
      if (field.cells[i].kind !== 0) drawable.push(i)
    }
    const shown = Math.min(MAX_ARROWS, drawable.length, Math.max(0, Math.round(vectorCount)))
    if (!shown) {
      arrowGeometry.setDrawRange(0, 0)
      return
    }
    const stride = drawable.length / shown
    const spacing = (GRID_SIZE - 1.4) / Math.max(1, field.res - 1)
    const baseLen = Math.min(1.55, spacing * 0.82)
    const lift = unknown ? 0.42 : 0.18

    for (let i = 0; i < shown; i++) {
      const cell = field.cells[drawable[Math.floor(i * stride)]]
      let vx
      let vz
      if (cell.kind === 1) {
        const flow = drainage(field.heightAt, cell.x, cell.z)
        vx = flow ? flow.x : -cell.gx
        vz = flow ? flow.z : -cell.gz
      } else {
        const flow = windVector(cell.x, cell.z, field.cx, field.cz, time)
        vx = flow.x
        vz = flow.z
      }
      const stirred = stir(vx, vz, cell.x, cell.z, pointer)
      const mag = Math.hypot(stirred.x, stirred.z) || 1
      const dx = stirred.x / mag
      const dz = stirred.z / mag
      const arrowLen = baseLen * (0.85 + Math.min(0.85, stirred.w))
      const y = cell.y + lift
      const x1 = cell.x + dx * arrowLen
      const z1 = cell.z + dz * arrowLen
      const rgb = tint(cell.kind === 1 ? RIVER_COLOR : WIND_COLOR, unknown, stirred.w)
      const tail = [rgb[0] * 0.4, rgb[1] * 0.4, rgb[2] * 0.4]
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
    if (!field || key !== fieldKey) {
      fieldKey = key
      field = buildField(geometry, params.fieldResolution ?? 18)
      lastParticleCount = -1
    }
    if (honey) field.honey = honey
    ensureParticles(params.particleCount ?? 28, field)
    const step = Math.min(0.05, Math.max(0.001, dt))
    for (const particle of particles) stepParticle(particle, step, time, pointer)
    drawArrows(params.vectorCount ?? 140, time, pointer, unknown)
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
