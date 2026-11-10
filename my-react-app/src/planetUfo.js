import * as THREE from 'three'
import { PLANET_RADIUS, seaRadius } from './planet.js'
import { TREE_CANOPY_TOP, TREE_SCALE_MAX } from './planetTown.js'
import { groundRadius } from './planetWalker.js'

const LON = 72
const LAT = 36
const INK_WIDTH = 0.02
const SIZE = 1.4
/** Underside of the saucer dish, in local units before `SIZE`. */
const HULL_BOTTOM = 0.26
const BEAM_HEIGHT = 0.45

function tint(geometry, color) {
  const c = new THREE.Color(color)
  const count = geometry.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

function makeSaucer() {
  const dish = new THREE.SphereGeometry(1, 18, 12)
  dish.scale(1, 0.26, 1)
  tint(dish, '#dfe8ea')
  const rim = new THREE.TorusGeometry(0.9, 0.09, 8, 24)
  rim.rotateX(Math.PI / 2)
  tint(rim, '#5b8e9d')
  const collar = new THREE.CylinderGeometry(0.46, 0.62, 0.16, 14)
  collar.translate(0, 0.1, 0)
  tint(collar, '#c5d0d4')
  const dome = new THREE.SphereGeometry(0.4, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52)
  dome.translate(0, 0.2, 0)
  tint(dome, '#7ec8c4')
  const belly = new THREE.SphereGeometry(0.28, 12, 8)
  belly.scale(1, 0.45, 1)
  belly.translate(0, -0.12, 0)
  tint(belly, '#f3ead3')
  return { dish, rim, collar, dome, belly }
}

/**
 * Water cell farthest from land on a lon/lat grid — the middle of the ocean
 * basin. Falls back to the deepest sample if the planet is all water.
 */
export function findOceanCenter(params, surface) {
  if (params.planetOcean === false) return null
  const sea = seaRadius(params)
  const dirs = []
  const wet = new Uint8Array(LON * LAT)
  const depth = new Float32Array(LON * LAT)
  let waterN = 0
  let landN = 0
  for (let j = 0; j < LAT; j++) {
    const lat = ((j + 0.5) / LAT - 0.5) * Math.PI
    const cy = Math.sin(lat)
    const cr = Math.cos(lat)
    for (let i = 0; i < LON; i++) {
      const lon = ((i + 0.5) / LON - 0.5) * Math.PI * 2
      const dir = new THREE.Vector3(cr * Math.cos(lon), cy, cr * Math.sin(lon)).normalize()
      const index = j * LON + i
      const radius = groundRadius(dir, params, surface)
      const delta = radius - sea
      dirs.push(dir)
      depth[index] = delta
      const isWet = delta < -0.05
      wet[index] = isWet ? 1 : 0
      if (isWet) waterN += 1
      else landN += 1
    }
  }
  if (!waterN) return null

  const dist = new Int16Array(LON * LAT)
  dist.fill(-1)
  const queue = []
  for (let i = 0; i < wet.length; i++) {
    if (wet[i]) continue
    dist[i] = 0
    queue.push(i)
  }

  let head = 0
  while (head < queue.length) {
    const index = queue[head++]
    const x = index % LON
    const y = Math.floor(index / LON)
    const next = dist[index] + 1
    const neighbors = [
      y * LON + ((x + 1) % LON),
      y * LON + ((x + LON - 1) % LON),
      y > 0 ? (y - 1) * LON + x : -1,
      y < LAT - 1 ? (y + 1) * LON + x : -1,
    ]
    for (const n of neighbors) {
      if (n < 0 || dist[n] !== -1) continue
      dist[n] = next
      queue.push(n)
    }
  }

  let best = -1
  let bestDist = -1
  let bestDepth = 1
  for (let i = 0; i < wet.length; i++) {
    if (!wet[i]) continue
    const inland = landN ? dist[i] : 1
    if (inland > bestDist || (inland === bestDist && depth[i] < bestDepth)) {
      bestDist = inland
      bestDepth = depth[i]
      best = i
    }
  }
  return best < 0 ? null : dirs[best]
}

/**
 * Toon saucer hovering over the middle of the ocean. Same ink/toon language as
 * the town: Messenger look, class land underneath.
 */
export function createPlanetUfo({ gradientMap, makeInk }) {
  const root = new THREE.Group()
  const hover = new THREE.Group()
  const spin = new THREE.Group()
  root.add(hover)
  hover.add(spin)
  root.visible = false

  const owned = []
  const geometries = []
  const inks = []
  const lights = []
  const side = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const basis = new THREE.Matrix4()
  const dir = new THREE.Vector3()
  let phase = 0
  let placed = false
  let ping = 0
  let beam = null

  const addPart = (geometry, { emissive, opacity } = {}) => {
    geometries.push(geometry)
    const material = new THREE.MeshToonMaterial({
      color: 0xffffff,
      gradientMap,
      vertexColors: true,
      transparent: opacity != null,
      opacity: opacity ?? 1,
      depthWrite: opacity == null,
    })
    if (emissive) {
      material.emissive.set(emissive)
      material.emissiveIntensity = 0.55
    }
    owned.push(material)
    const mesh = new THREE.Mesh(geometry, material)
    spin.add(mesh)
    if (opacity == null) {
      const inkMat = makeInk()
      inkMat.userData.thickness.value = INK_WIDTH
      owned.push(inkMat)
      const inkMesh = new THREE.Mesh(geometry, inkMat)
      spin.add(inkMesh)
      inks.push(inkMesh)
    }
    return mesh
  }

  const parts = makeSaucer()
  addPart(parts.dish)
  addPart(parts.rim)
  addPart(parts.collar)
  addPart(parts.dome, { emissive: '#3a8a86' })
  addPart(parts.belly, { emissive: '#c9a227' })

  const beamGeom = new THREE.ConeGeometry(0.95, BEAM_HEIGHT, 16, 1, true)
  beamGeom.translate(0, -(0.22 + BEAM_HEIGHT / 2), 0)
  const beamColors = new Float32Array(beamGeom.attributes.position.count * 3)
  beamColors.fill(0.72)
  for (let i = 1; i < beamColors.length; i += 3) beamColors[i] = 0.94
  for (let i = 2; i < beamColors.length; i += 3) beamColors[i] = 0.82
  beamGeom.setAttribute('color', new THREE.BufferAttribute(beamColors, 3))
  beam = addPart(beamGeom, { opacity: 0.22, emissive: '#7dffb0' })

  for (let i = 0; i < 8; i++) {
    const bulb = new THREE.SphereGeometry(0.07, 8, 6)
    bulb.translate(Math.cos((i / 8) * Math.PI * 2) * 0.82, -0.02, Math.sin((i / 8) * Math.PI * 2) * 0.82)
    const mesh = addPart(tint(bulb, '#ffe9a8'), { emissive: '#ffd36a' })
    lights.push(mesh)
  }

  const treeTopRadius = (params, trees) => {
    const canopy = TREE_CANOPY_TOP * TREE_SCALE_MAX
    let base = seaRadius(params)
    if (trees?.length) {
      for (const p of trees) {
        const r = p.length()
        if (r > base) base = r
      }
    }
    return base + canopy
  }

  const place = (params, surface, trees) => {
    const at = findOceanCenter(params, surface)
    if (!at || params.planetOcean === false) {
      placed = false
      root.visible = false
      return
    }
    dir.copy(at).normalize()
    forward.set(0, 1, 0).cross(dir)
    if (forward.lengthSq() < 1e-6) forward.set(1, 0, 0)
    forward.normalize()
    side.crossVectors(dir, forward)
    basis.makeBasis(side, dir, forward)
    root.quaternion.setFromRotationMatrix(basis)
    const top = treeTopRadius(params, trees)
    root.position.copy(dir).multiplyScalar(top + HULL_BOTTOM * SIZE)
    root.scale.setScalar(SIZE)
    placed = true
    root.visible = true
  }

  const update = (dt, params) => {
    const hideInk = params.debug?.hideInk === true
    for (const ink of inks) ink.visible = !hideInk
    root.visible = placed && params.planetOcean !== false
    if (!root.visible) return
    phase += dt
    hover.position.y = Math.sin(phase * 0.7) * 0.06
    spin.rotation.y += dt * 0.28
    const pulse = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(phase * 6))
    for (const light of lights) {
      const mat = light.material
      if (mat.emissiveIntensity != null) mat.emissiveIntensity = pulse + ping * 0.8
    }
    if (beam?.material) {
      beam.material.opacity = 0.22 + ping * 0.5
      beam.material.emissiveIntensity = 0.55 + ping * 1.4
    }
    if (ping > 0) ping = Math.max(0, ping - dt * 1.25)
  }

  const dispose = () => {
    for (const material of owned) material.dispose()
    for (const geometry of geometries) geometry.dispose()
  }

  return {
    root,
    place,
    update,
    dispose,
    dir,
    ping: () => {
      ping = 1
    },
  }
}
