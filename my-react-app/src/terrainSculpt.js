import * as THREE from 'three'
import { GRID_SIZE } from './noise.js'
import { meshHeight } from './paths.js'
import { handSession } from './handSession.js'

const MAX_LIFT = 12
const groundHit = new THREE.Vector3()
const corner = new THREE.Vector3()

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function handUnit(unit, reach) {
  return clamp((unit - 0.5) * reach + 0.5, 0, 1)
}

function aimOnTerrain(raycaster, grid, targetX, targetZ) {
  const hits = raycaster.intersectObject(grid, false)
  if (hits.length) {
    const hit = hits[0].point
    if (Math.hypot(hit.x - targetX, hit.z - targetZ) < 8) return hit
  }
  groundHit.set(targetX, 0, targetZ)
  return groundHit
}

const CURSOR_TINT = {
  left: { rest: 0xd7f0c8, fist: 0xffe1a8 },
  right: { rest: 0xc9e4ff, fist: 0xf3c9a4 },
}
const HANDS = ['left', 'right']

export function createHandCursor(side = 'left') {
  const tint = CURSOR_TINT[side] || CURSOR_TINT.left
  const cursor = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.22, 48),
    new THREE.MeshBasicMaterial({
      color: tint.rest,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  cursor.rotation.x = -Math.PI / 2
  cursor.visible = false
  cursor.renderOrder = 4
  cursor.frustumCulled = false
  cursor.userData.rest = tint.rest
  cursor.userData.fist = tint.fist
  return cursor
}

export function createTerrainSculpt() {
  let geometry = null
  let base = null
  let disp = null
  let cols = 0
  let seenReset = handSession.resetToken
  let normalWait = 0
  const points = {
    left: { x: 0, z: 0, ready: false },
    right: { x: 0, z: 0, ready: false },
  }

  const bind = (geom) => {
    const pos = geom.attributes.position
    if (geometry === geom && base && base.length === pos.count) return
    geometry = geom
    cols = Math.round(Math.sqrt(pos.count))
    base = new Float32Array(pos.count)
    disp = new Float32Array(pos.count)
    for (let i = 0; i < pos.count; i++) base[i] = pos.getY(i)
    points.left.ready = false
    points.right.ready = false
  }

  const write = (i0, i1, j0, j1, normals) => {
    const pos = geometry.attributes.position
    const segs = cols - 1
    const a = Math.max(0, i0)
    const b = Math.min(segs, i1)
    const c = Math.max(0, j0)
    const d = Math.min(segs, j1)
    for (let j = c; j <= d; j++) {
      for (let i = a; i <= b; i++) {
        const k = j * cols + i
        pos.setY(k, base[k] + disp[k])
      }
    }
    pos.needsUpdate = true
    if (normals) geometry.computeVertexNormals()
  }

  const restore = () => {
    if (!disp) return
    disp.fill(0)
    write(0, cols - 1, 0, cols - 1, true)
  }

  const stroke = (x, z, lift, rate) => {
    if (!disp || rate <= 0 || Math.abs(lift) < 0.02) return false
    const segs = cols - 1
    const half = GRID_SIZE / 2
    const radius = 4.1
    const radius2 = radius * radius
    const cell = GRID_SIZE / segs
    const cx = ((x + half) / GRID_SIZE) * segs
    const cz = ((z + half) / GRID_SIZE) * segs
    const reach = Math.ceil(radius / cell) + 1
    const i0 = Math.max(0, Math.floor(cx - reach))
    const i1 = Math.min(segs, Math.ceil(cx + reach))
    const j0 = Math.max(0, Math.floor(cz - reach))
    const j1 = Math.min(segs, Math.ceil(cz + reach))
    if (i1 < i0 || j1 < j0) return false

    let changed = false
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const vx = (i / segs) * GRID_SIZE - half
        const vz = (j / segs) * GRID_SIZE - half
        const dx = vx - x
        const dz = vz - z
        const d2 = dx * dx + dz * dz
        if (d2 > radius2) continue
        const t = 1 - d2 / radius2
        const fall = t * t * (3 - 2 * t)
        const k = j * cols + i
        const next = Math.max(-MAX_LIFT, Math.min(MAX_LIFT, disp[k] + lift * rate * fall))
        if (next !== disp[k]) {
          disp[k] = next
          changed = true
        }
      }
    }
    if (!changed) return false

    const relax = (keep) => {
      const blended = []
      const at = (ii, jj) => disp[Math.max(0, Math.min(segs, jj)) * cols + Math.max(0, Math.min(segs, ii))]
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const avg = (at(i, j) * 2 + at(i - 1, j) + at(i + 1, j) + at(i, j - 1) + at(i, j + 1)) / 6
          blended.push(Math.max(-MAX_LIFT, Math.min(MAX_LIFT, at(i, j) * keep + avg * (1 - keep))))
        }
      }
      let n = 0
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) disp[j * cols + i] = blended[n++]
      }
    }
    relax(0.72)
    relax(0.6)

    normalWait += 1
    const normals = segs > 500 ? normalWait % 3 === 0 : normalWait % 2 === 0
    write(i0 - 1, i1 + 1, j0 - 1, j1 + 1, normals)
    return true
  }

  const placeHand = (side, cursor, grid, camera, raycaster, ndc, dt, reach, heightAt) => {
    const slot = handSession.hands[side]
    const point = points[side]
    if (!cursor) return
    if (!slot.active) {
      cursor.visible = false
      return
    }
    if (slot.hold) {
      if (!point.ready) {
        cursor.visible = false
        return
      }
      const frozen = heightAt(point.x, point.z)
      if (frozen == null) {
        cursor.visible = false
        return
      }
      cursor.visible = true
      cursor.position.set(point.x, frozen + 0.08, point.z)
      cursor.material.color.setHex(cursor.userData.rest)
      cursor.material.opacity = 0.35
      return
    }

    const u = handUnit(slot.x, reach)
    const sculpting = slot.fist && point.ready
    const v = sculpting ? null : handUnit(1 - slot.y, reach)
    const targetX = (u - 0.5) * GRID_SIZE
    const targetZ = sculpting ? point.z : (0.5 - v) * GRID_SIZE
    const surfaceY = heightAt(targetX, targetZ)
    corner.set(targetX, surfaceY ?? 0, targetZ)
    corner.project(camera)
    const inView = corner.z >= -1 && corner.z <= 1 && Math.abs(corner.x) <= 1 && Math.abs(corner.y) <= 1
    ndc.set(clamp(corner.x, -1, 1), clamp(corner.y, -1, 1))
    let hitX = targetX
    let hitZ = targetZ
    if (inView) {
      raycaster.setFromCamera(ndc, camera)
      const hit = aimOnTerrain(raycaster, grid, targetX, targetZ)
      hitX = hit.x
      hitZ = hit.z
    }
    const atEdge = u < 0.04 || u > 0.96 || (!sculpting && (v < 0.04 || v > 0.96))
    const follow = atEdge ? 1 : 1 - Math.exp(-Math.max(dt, 0.001) * 14)
    if (!point.ready) {
      point.x = hitX
      point.z = hitZ
      point.ready = true
    } else if (sculpting) {
      point.x += (hitX - point.x) * follow
    } else {
      point.x += (hitX - point.x) * follow
      point.z += (hitZ - point.z) * follow
    }

    const y = heightAt(point.x, point.z)
    if (y == null) {
      cursor.visible = false
      return
    }

    const strength = slot.strength
    cursor.visible = true
    cursor.position.set(point.x, y + 0.08, point.z)
    cursor.scale.setScalar(0.82 + strength * 0.5)
    cursor.material.color.setHex(slot.fist ? cursor.userData.fist : cursor.userData.rest)
    cursor.material.opacity = slot.fist ? 0.92 : 0.42 + strength * 0.28

    if (slot.fist && Math.abs(slot.lift) > 0.04) {
      const rate = strength * handSession.sensitivity * Math.min(dt, 0.05) * 2.4
      stroke(point.x, point.z, slot.lift, rate)
    }
  }

  const step = ({ grid, camera, raycaster, ndc, dt, cursors, cursor }) => {
    const rings = cursors || { left: cursor }
    bind(grid.geometry)
    if (handSession.resetToken !== seenReset) {
      seenReset = handSession.resetToken
      restore()
      normalWait = 0
    }
    if (!handSession.sculptable) {
      for (const side of HANDS) {
        if (rings[side]) rings[side].visible = false
      }
      return
    }

    if (rings.left) rings.left.visible = false
    const reach = handSession.reach > 0 ? handSession.reach : 1
    const heightAt = meshHeight(grid.geometry)
    placeHand('right', rings.right, grid, camera, raycaster, ndc, dt, reach, heightAt)
  }

  return {
    rebase(geom) {
      geometry = null
      base = null
      disp = null
      points.left.ready = false
      points.right.ready = false
      bind(geom)
    },
    step,
  }
}
