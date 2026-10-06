import * as THREE from 'three'
import { GRID_SIZE, perlin2 } from './noise.js'
import {
  blankParts,
  consume,
  createTreeGeometries,
  createTreeMaterial,
  pack,
  place,
} from './trees.js'

/** One control layer per asset. Cliffs and water are the placement protocol. */
export const SCATTER_LAYERS = [
  {
    id: 'trees',
    label: 'Trees',
    note: 'Gentle ground, back from the water. Low land grows tall dark trees. High land grows short pale ones.',
    density: 0.64,
    cliffs: 0.5,
    water: 0.45,
    spacing: [2.4, 0.62],
    slopeLo: 0.18,
    slopeHi: 0.9,
    dryLo: 0.48,
    dryHi: 0.04,
    bandLo: 3.2,
    bandHi: 0.62,
    step: 0.45,
    seed: 2,
  },
  {
    id: 'rocks',
    label: 'Rocks',
    note: 'Cliffs and the shoreline. Open flats stay mostly bare. Stones get larger on steeper ground and paler with height.',
    prefersSteep: true,
    density: 0.5,
    cliffs: 0.42,
    water: 0.68,
    spacing: [3.1, 0.9],
    slopeLo: 0.14,
    slopeHi: 0.46,
    shoreLo: 0.3,
    shoreHi: 1.55,
    step: 0.45,
    seed: 5,
  },
  {
    id: 'bushes',
    label: 'Bushes',
    note: 'Soft slopes, thicker near the water. High dry ground grows smaller, yellower shrubs.',
    density: 0.48,
    cliffs: 0.28,
    water: 0.78,
    spacing: [2.05, 0.5],
    slopeLo: 0.12,
    slopeHi: 0.58,
    dryLo: 0.55,
    dryHi: 0.03,
    bandLo: 2.2,
    bandHi: 0.55,
    step: 0.4,
    seed: 9,
  },
  {
    id: 'windmills',
    label: 'Windmills',
    note: 'Only open, nearly flat ground, above the shore. A few mills, larger where the land is most level.',
    density: 0.62,
    cliffs: 0.72,
    water: 0.55,
    spacing: [12, 6.2],
    slopeLo: 0.2,
    slopeHi: 0.55,
    dryLo: 0.42,
    dryHi: 0.08,
    bandLo: 4.2,
    bandHi: 1.15,
    step: 0.55,
    seed: 13,
  },
]

export const SCATTER_MESHES = [
  { id: 'tall', cap: 1600, material: 'foliage' },
  { id: 'medium', cap: 1600, material: 'foliage' },
  { id: 'short', cap: 1600, material: 'foliage' },
  { id: 'bush', cap: 1800, material: 'foliage' },
  { id: 'boulder', cap: 900, material: 'stone' },
  { id: 'shard', cap: 700, material: 'stone' },
  { id: 'mill', cap: 40, material: 'timber' },
  { id: 'blade', cap: 40, material: 'timber', spin: true },
]

const MESH_CAP = Object.fromEntries(SCATTER_MESHES.map((item) => [item.id, item.cap]))
const LOW_LEAF = [0.4, 0.95, 0.46]
const HIGH_LEAF = [1, 0.74, 0.26]
const HUB = new THREE.Vector3(0, 1.68, 0.24)

export function createScatterParams() {
  return Object.fromEntries(
    SCATTER_LAYERS.map((layer) => [
      layer.id,
      { density: layer.density, cliffs: layer.cliffs, water: layer.water },
    ]),
  )
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function mix3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

function clamp3(color) {
  return [clamp01(color[0]), clamp01(color[1]), clamp01(color[2])]
}

function hash01(ix, iz, seed = 0) {
  let n = Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + Math.imul(seed | 0, 144269503)
  n = (n ^ (n >>> 13)) >>> 0
  n = Math.imul(n, 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

export function readScatter(params) {
  const raw = params?.scatter && typeof params.scatter === 'object' ? params.scatter : {}
  const out = {}
  for (const layer of SCATTER_LAYERS) {
    const item = raw[layer.id] && typeof raw[layer.id] === 'object' ? raw[layer.id] : {}
    let density = item.density
    if (density == null && layer.id === 'trees' && params?.treeCover != null) density = params.treeCover
    out[layer.id] = {
      density: clamp01(density ?? layer.density),
      cliffs: clamp01(item.cliffs ?? layer.cliffs),
      water: clamp01(item.water ?? layer.water),
    }
  }
  return out
}

/** Slope and shore limits for the current slider values. */
export function rulesFor(layer, settings) {
  const cliffs = clamp01(settings?.cliffs ?? layer.cliffs)
  const water = clamp01(settings?.water ?? layer.water)
  if (layer.prefersSteep) {
    return {
      minSlope: lerp(layer.slopeLo, layer.slopeHi, cliffs),
      shoreReach: lerp(layer.shoreLo, layer.shoreHi, water),
    }
  }
  const hug = water >= 0.5
  return {
    maxSlope: lerp(layer.slopeLo, layer.slopeHi, cliffs),
    minDry: lerp(layer.dryLo, layer.dryHi, water),
    maxDry: hug ? lerp(layer.bandLo, layer.bandHi, (water - 0.5) / 0.5) : Infinity,
  }
}

export function describeScatter(layer, settings) {
  const rules = rulesFor(layer, settings ?? layer)
  if (layer.prefersSteep) {
    return `Steep ground from grade ${rules.minSlope.toFixed(2)} up, or within ${rules.shoreReach.toFixed(1)} of the water. Larger on cliffs, paler up high, darker at the shore.`
  }
  const shore =
    rules.maxDry < 20
      ? ` Sits ${rules.minDry.toFixed(2)} to ${rules.maxDry.toFixed(2)} above the water.`
      : ` Stays at least ${rules.minDry.toFixed(2)} above the water.`
  if (layer.id === 'trees') {
    return `Avoids grades over ${rules.maxSlope.toFixed(2)}.${shore} Tall deep-green trees in the low land, short yellow-green trees up high. Steeper spots grow smaller trees.`
  }
  if (layer.id === 'bushes') {
    return `Avoids grades over ${rules.maxSlope.toFixed(2)}.${shore} Wetter ground grows larger green shrubs. Dry high ground grows smaller yellow ones.`
  }
  return `Only grades under ${rules.maxSlope.toFixed(2)}.${shore} Larger mills on the flattest ground. This layer stays sparse.`
}

function meshSampler(geometry) {
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

function meshRange(geometry) {
  const pos = geometry.attributes.position
  let low = Infinity
  let high = -Infinity
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    if (y < low) low = y
    if (y > high) high = y
  }
  if (!Number.isFinite(low) || high - low < 0.001) return { low: 0, high: 1 }
  return { low, high }
}

function gradeAt(heightAt, x, z, step) {
  const y = heightAt(x, z)
  const yx = heightAt(x + step, z)
  const yz = heightAt(x, z + step)
  const yx2 = heightAt(x - step, z)
  const yz2 = heightAt(x, z - step)
  if (y == null || yx == null || yz == null || yx2 == null || yz2 == null) return null
  const slope = Math.max(Math.hypot(yx - y, yz - y) / step, Math.hypot(y - yx2, y - yz2) / step)
  return { y, slope }
}

function walk(heightAt, spacing, seed, step, visit) {
  const half = GRID_SIZE * 0.5 - 0.85
  const shift = (seed % 5) * spacing * 0.13
  let row = 0
  for (let z = -half + shift; z <= half; z += spacing) {
    const stagger = (row % 2) * spacing * 0.5
    let col = 0
    for (let x = -half + stagger; x <= half; x += spacing) {
      const jx = (hash01(row + seed, col, seed) - 0.5) * spacing * 0.75
      const jz = (hash01(col + 17, row + seed, seed + 3) - 0.5) * spacing * 0.75
      const sample = gradeAt(heightAt, x + jx, z + jz, step)
      col += 1
      if (!sample) continue
      visit({ x: x + jx, z: z + jz, y: sample.y, slope: sample.slope, row, col })
    }
    row += 1
  }
}

function clump(x, z, seed, density) {
  const n =
    perlin2(x * 0.07 + seed, z * 0.07 - seed) * 0.68 +
    perlin2(x * 0.2 + 2.4, z * 0.2 - 1.7) * 0.32
  return n >= lerp(0.42, -0.48, density)
}

function trim(list, cap) {
  if (list.length <= cap) return list
  const step = list.length / cap
  const out = new Array(cap)
  for (let i = 0; i < cap; i++) out[i] = list[Math.floor(i * step)]
  return out
}

function emptyPlacement() {
  return { tall: [], medium: [], short: [], bush: [], boulder: [], shard: [], mill: [] }
}

function placeTrees(out, heightAt, range, waterY, layer, settings) {
  const amount = settings.density
  if (amount <= 0.001) return
  const rules = rulesFor(layer, settings)
  walk(heightAt, lerp(layer.spacing[0], layer.spacing[1], amount), layer.seed, layer.step, (spot) => {
    const depth = spot.y - waterY
    if (depth < rules.minDry || depth > rules.maxDry) return
    const jitter = (hash01(spot.row, spot.col, 21) - 0.5) * 0.05
    if (spot.slope > rules.maxSlope + jitter) return
    if (!clump(spot.x, spot.z, layer.seed, amount)) return
    const floorY = waterY + rules.minDry
    const elev = clamp01((spot.y - floorY) / Math.max(0.35, range.high - floorY))
    const thin = lerp(1, 0.72, elev)
    if (hash01(spot.row, spot.col, 11) > thin) return
    const wobble = perlin2(spot.x * 0.17 + 6.5, spot.z * 0.17) * 0.06
    const band = clamp01(elev + wobble)
    const kind = band < 0.34 ? 'tall' : band < 0.67 ? 'medium' : 'short'
    const h = hash01(Math.round(spot.x * 17), Math.round(spot.z * 17), 4)
    const moisture = clamp01(1 - Math.max(0, depth - rules.minDry) / 1.8)
    const leaf = mix3(mix3(LOW_LEAF, HIGH_LEAF, elev), LOW_LEAF, moisture * 0.7)
    const tint = (h - 0.5) * 0.1
    const base = kind === 'tall' ? 0.94 : kind === 'medium' ? 0.88 : 0.8
    const slopeScale = 1 - clamp01(spot.slope / Math.max(0.2, rules.maxSlope)) * 0.28
    out[kind].push({
      x: spot.x,
      y: spot.y,
      z: spot.z,
      rot: h * Math.PI * 2,
      scale: base * (0.82 + h * 0.42) * slopeScale * lerp(1.16, 0.74, elev),
      color: clamp3([leaf[0] + tint, leaf[1] + tint * 0.4, leaf[2] - tint * 0.35]),
    })
  })
}

function placeRocks(out, heightAt, range, waterY, layer, settings) {
  const amount = settings.density
  if (amount <= 0.001) return
  const rules = rulesFor(layer, settings)
  const span = range.high - range.low || 1
  walk(heightAt, lerp(layer.spacing[0], layer.spacing[1], amount), layer.seed, layer.step, (spot) => {
    const depth = spot.y - waterY
    if (depth < 0.16) return
    if (!clump(spot.x, spot.z, layer.seed, amount)) return
    const jitter = (hash01(spot.row, spot.col, 8) - 0.5) * 0.06
    const onCliff = spot.slope + jitter >= rules.minSlope
    const onShore = depth < rules.shoreReach && spot.slope < 0.9
    if (!onCliff && !onShore) return
    const elev = clamp01((spot.y - range.low) / span)
    const wet = clamp01(1 - depth / 0.85)
    const h = hash01(Math.round(spot.x * 13), Math.round(spot.z * 19), 6)
    const kind = spot.slope > 0.22 ? 'shard' : 'boulder'
    const shade = lerp(0.5, 1, elev) * (1 - wet * 0.32) * (0.88 + h * 0.18)
    const scale = (kind === 'shard' ? 0.95 : 0.8) * (0.75 + h * 0.6) * (0.7 + Math.min(spot.slope, 1.1) * 0.85)
    out[kind].push({
      x: spot.x,
      y: spot.y,
      z: spot.z,
      rot: h * Math.PI * 2,
      rx: (hash01(spot.row, spot.col, 15) - 0.5) * 0.55,
      rz: (hash01(spot.col, spot.row, 16) - 0.5) * 0.55,
      sink: scale * 0.08,
      scale,
      color: clamp3([
        shade * lerp(1, 0.82, wet) + (kind === 'shard' ? 0.05 : 0),
        shade * lerp(0.98, 0.9, wet),
        shade * lerp(0.92, 1, wet),
      ]),
    })
  })
}

function placeBushes(out, heightAt, range, waterY, layer, settings) {
  const amount = settings.density
  if (amount <= 0.001) return
  const rules = rulesFor(layer, settings)
  walk(heightAt, lerp(layer.spacing[0], layer.spacing[1], amount), layer.seed, layer.step, (spot) => {
    const depth = spot.y - waterY
    if (depth < rules.minDry || depth > rules.maxDry) return
    const jitter = (hash01(spot.row, spot.col, 19) - 0.5) * 0.04
    if (spot.slope > rules.maxSlope + jitter) return
    if (!clump(spot.x, spot.z, layer.seed, amount)) return
    const floorY = waterY + rules.minDry
    const bandTop = Number.isFinite(rules.maxDry) ? waterY + rules.maxDry : range.high
    const elev = clamp01((spot.y - floorY) / Math.max(0.35, bandTop - floorY))
    const moisture = clamp01(1 - Math.max(0, depth - rules.minDry) / 1.4)
    if (hash01(spot.row, spot.col, 12) > lerp(0.42, 1, moisture)) return
    const h = hash01(Math.round(spot.x * 11), Math.round(spot.z * 23), 7)
    const dry = clamp01(elev * (1 - moisture * 0.65))
    const leaf = mix3([0.32, 0.95, 0.42], [0.95, 0.78, 0.28], dry)
    out.bush.push({
      x: spot.x,
      y: spot.y,
      z: spot.z,
      rot: h * Math.PI * 2,
      scale: (0.78 + h * 0.5) * lerp(1.25, 0.62, dry) * lerp(0.9, 1.12, moisture),
      color: clamp3([leaf[0] + (h - 0.5) * 0.08, leaf[1], leaf[2]]),
    })
  })
}

function placeMills(out, heightAt, range, waterY, layer, settings) {
  const amount = settings.density
  if (amount <= 0.001) return
  const rules = rulesFor(layer, settings)
  walk(heightAt, lerp(layer.spacing[0], layer.spacing[1], amount), layer.seed, layer.step, (spot) => {
    const depth = spot.y - waterY
    if (depth < rules.minDry || depth > rules.maxDry) return
    const jitter = (hash01(spot.row, spot.col, 4) - 0.5) * 0.03
    if (spot.slope > rules.maxSlope + jitter) return
    if (!clump(spot.x, spot.z, layer.seed, Math.max(amount, 0.8))) return
    const h = hash01(Math.round(spot.x * 9), Math.round(spot.z * 9), 3)
    const open = 1 - clamp01(spot.slope / Math.max(0.08, rules.maxSlope))
    const shade = lerp(0.82, 1, open) * (0.9 + h * 0.16)
    out.mill.push({
      x: spot.x,
      y: spot.y,
      z: spot.z,
      rot: hash01(spot.row, spot.col, 28) * Math.PI * 2,
      spin: h * Math.PI * 2,
      scale: (0.86 + h * 0.32) * lerp(0.92, 1.22, open),
      color: [shade, shade * 0.98, shade * 0.94],
    })
  })
}

export function scatterAssets(geometry, params) {
  const settings = readScatter(params)
  const waterY = Number.isFinite(params?.shaderWater) ? params.shaderWater : 0.15
  const out = emptyPlacement()
  if (!geometry?.attributes?.position) return out
  const heightAt = meshSampler(geometry)
  const range = meshRange(geometry)
  const byId = Object.fromEntries(SCATTER_LAYERS.map((layer) => [layer.id, layer]))
  placeTrees(out, heightAt, range, waterY, byId.trees, settings.trees)
  placeRocks(out, heightAt, range, waterY, byId.rocks, settings.rocks)
  placeBushes(out, heightAt, range, waterY, byId.bushes, settings.bushes)
  placeMills(out, heightAt, range, waterY, byId.windmills, settings.windmills)
  for (const id of ['tall', 'medium', 'short', 'bush', 'boulder', 'shard', 'mill']) {
    out[id] = trim(out[id], MESH_CAP[id])
  }
  const treeTotal = out.tall.length + out.medium.length + out.short.length
  if (treeTotal > 4200) {
    const scale = 4200 / treeTotal
    for (const id of ['tall', 'medium', 'short']) {
      out[id] = trim(out[id], Math.floor(out[id].length * scale))
    }
  }
  return out
}

function scatterKey(params, terrainKey) {
  const settings = readScatter(params)
  const water = (Number.isFinite(params?.shaderWater) ? params.shaderWater : 0.15).toFixed(3)
  const body = SCATTER_LAYERS.map((layer) => {
    const item = settings[layer.id]
    return `${item.density.toFixed(3)},${item.cliffs.toFixed(3)},${item.water.toFixed(3)}`
  }).join('|')
  return `${terrainKey}|${water}|${body}`
}

function createPropGeometries() {
  const boulder = blankParts()
  const body = new THREE.IcosahedronGeometry(0.52, 0)
  body.scale(1.2, 0.72, 1.05)
  consume(boulder, place(body, 0.34), 0xc8c2b8, 0.8)
  const side = new THREE.IcosahedronGeometry(0.28, 0)
  side.scale(1.15, 0.8, 0.95)
  consume(boulder, place(side, 0.2).translate(0.38, 0, 0.12), 0xb7b0a6, 0.8)

  const shard = blankParts()
  const spike = new THREE.OctahedronGeometry(0.48, 0)
  spike.scale(0.62, 1.55, 0.5)
  consume(shard, place(spike, 0.72), 0xb7b3ae, 1.5)
  const chip = new THREE.OctahedronGeometry(0.22, 0)
  chip.scale(0.8, 1.2, 0.7)
  consume(shard, place(chip, 0.28).translate(0.36, 0, 0.08), 0xa8a49e, 1.2)

  const bush = blankParts()
  const clumps = [
    [0.36, 0, 0.3, 0, 0x3d7a34],
    [0.28, 0.24, 0.24, 0.08, 0x4c8c3a],
    [0.24, -0.2, 0.22, 0.1, 0x6a9844],
    [0.18, 0.06, 0.42, -0.14, 0x2f6830],
  ]
  for (const [radius, x, y, z, color] of clumps) {
    const blob = new THREE.IcosahedronGeometry(radius, 0)
    blob.scale(1.05, 0.82, 1)
    consume(bush, place(blob, y).translate(x, 0, z), color, 0.7)
  }

  const mill = blankParts()
  consume(mill, place(new THREE.CylinderGeometry(0.16, 0.3, 1.7, 7, 1), 0.85), 0x8a8178, 2.2)
  consume(mill, place(new THREE.CylinderGeometry(0.22, 0.22, 0.28, 7, 1), 1.72), 0x6a4e38, 2.2)
  consume(mill, place(new THREE.ConeGeometry(0.36, 0.42, 7, 1), 2.02), 0x8d3b32, 2.2)
  const door = new THREE.BoxGeometry(0.14, 0.32, 0.05)
  door.translate(0, 0.24, 0.28)
  consume(mill, door, 0x3a2a22, 2.2)

  const blade = blankParts()
  for (let i = 0; i < 4; i++) {
    const sail = new THREE.BoxGeometry(0.1, 1.12, 0.04)
    sail.translate(0, 0.64, 0)
    sail.rotateZ((i * Math.PI) / 2)
    consume(blade, sail, 0xd9d0c1, 1)
  }
  const hub = new THREE.CylinderGeometry(0.09, 0.09, 0.12, 8)
  hub.rotateX(Math.PI / 2)
  consume(blade, hub, 0x3c342e, 1)

  return {
    boulder: pack(boulder),
    shard: pack(shard),
    bush: pack(bush),
    mill: pack(mill),
    blade: pack(blade),
  }
}

function paint(mesh, items, dummy, tint) {
  mesh.count = items.length
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    dummy.position.set(item.x, item.y - (item.sink || 0), item.z)
    dummy.rotation.set(item.rx || 0, item.rot || 0, item.rz || 0)
    dummy.scale.setScalar(item.scale)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
    tint.setRGB(item.color[0], item.color[1], item.color[2])
    mesh.setColorAt(i, tint)
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

export function createScatterView(scene) {
  const group = new THREE.Group()
  scene.add(group)

  const geos = { ...createTreeGeometries(), ...createPropGeometries() }
  const time = { value: 0 }
  const water = { value: 0.15 }
  const submerge = { value: 0 }
  const erode = { value: 0.42 }
  const unknown = { value: 0 }
  const low = { value: 0 }
  const high = { value: 1 }
  const foliage = createTreeMaterial(time, water, submerge, { erode, unknown, low, high })
  const stone = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.02,
    fog: true,
  })
  const timber = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.76,
    metalness: 0,
    fog: true,
  })
  const materials = { foliage, stone, timber }
  const meshes = {}
  for (const spec of SCATTER_MESHES) {
    const mesh = new THREE.InstancedMesh(geos[spec.id], materials[spec.material], spec.cap)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.castShadow = spec.id !== 'bush'
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.count = 0
    group.add(mesh)
    meshes[spec.id] = mesh
  }

  const waterGeom = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE)
  waterGeom.rotateX(-Math.PI / 2)
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1a568f,
    transparent: true,
    opacity: 0.58,
    roughness: 0.18,
    metalness: 0.04,
    depthWrite: false,
  })
  const waterMesh = new THREE.Mesh(waterGeom, waterMat)
  waterMesh.receiveShadow = true
  waterMesh.renderOrder = 2
  group.add(waterMesh)

  const dummy = new THREE.Object3D()
  const tint = new THREE.Color()
  const qYaw = new THREE.Quaternion()
  const qSpin = new THREE.Quaternion()
  const hub = new THREE.Vector3()
  const axis = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  let mills = []
  let key = ''

  const sync = (geometry, params, terrainKey) => {
    const next = scatterKey(params, terrainKey)
    if (!terrainKey || next === key) return null
    key = next
    const placed = scatterAssets(geometry, params)
    for (const spec of SCATTER_MESHES) {
      if (spec.spin) continue
      paint(meshes[spec.id], placed[spec.id] || [], dummy, tint)
    }
    mills = placed.mill
    paint(meshes.blade, mills, dummy, tint)
    return {
      tall: placed.tall.length,
      medium: placed.medium.length,
      short: placed.short.length,
      bush: placed.bush.length,
      boulder: placed.boulder.length,
      shard: placed.shard.length,
      mill: placed.mill.length,
    }
  }

  const tick = ({ elapsed, waterY, submerge: under, erode: eat, unknown: glitch, low: y0, high: y1, showWater }) => {
    time.value = elapsed
    water.value = waterY ?? 0.15
    submerge.value = under ? 1 : 0
    erode.value = eat ?? 0.42
    unknown.value = glitch ? 1 : 0
    low.value = y0 ?? 0
    high.value = y1 ?? 1
    waterMesh.position.y = (waterY ?? 0.15) + 0.03
    waterMesh.visible = showWater !== false
    const blades = meshes.blade
    blades.count = mills.length
    for (let i = 0; i < mills.length; i++) {
      const item = mills[i]
      qYaw.setFromAxisAngle(up, item.rot)
      axis.set(0, 0, 1)
      qSpin.setFromAxisAngle(axis, elapsed * 1.15 + item.spin)
      dummy.quaternion.copy(qYaw).multiply(qSpin)
      hub.copy(HUB).applyQuaternion(qYaw).multiplyScalar(item.scale)
      dummy.position.set(item.x + hub.x, item.y + hub.y, item.z + hub.z)
      dummy.scale.setScalar(item.scale)
      dummy.updateMatrix()
      blades.setMatrixAt(i, dummy.matrix)
    }
    blades.instanceMatrix.needsUpdate = true
  }

  const dispose = () => {
    scene.remove(group)
    foliage.dispose()
    stone.dispose()
    timber.dispose()
    waterGeom.dispose()
    waterMat.dispose()
    for (const spec of SCATTER_MESHES) {
      geos[spec.id].dispose()
      meshes[spec.id].dispose()
    }
  }

  return { group, sync, tick, dispose }
}
