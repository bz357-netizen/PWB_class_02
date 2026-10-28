import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { PLANET_RADIUS, seaRadius } from './planet.js'
import { groundRadius, isWater } from './planetWalker.js'

export const MAX_CARS = 12

export function createTownParams() {
  return {
    planetRoads: true,
    planetTowns: 9,
    planetRoadWidth: 0.4,
    planetHouses: 0.6,
    planetLamps: 0.6,
    planetTrees: 0.5,
    planetCars: 5,
    planetTownSeed: 1,
  }
}

/** Everything that changes the layout. Cars only change how many drive. */
export function townFingerprint(params) {
  return [
    params.planetRoads !== false,
    params.planetTowns,
    params.planetRoadWidth,
    params.planetHouses,
    params.planetLamps,
    params.planetTrees,
    params.planetTownSeed,
    params.planetSeaLevel,
    params.planetOcean !== false,
  ].join('|')
}

const MAP_W = 2048
const MAP_H = 1024
const PX_PER_UNIT = MAP_W / (Math.PI * 2 * PLANET_RADIUS)
const STEP = 0.15
const DASH = 0.32
const MAX_LAMPS = 500
const MAX_HOUSES = 200
const MAX_TREES = 700
const INK_WIDTH = 0.018

const ROOF_COLORS = ['#e07a5f', '#d9644a', '#5b8e9d', '#6d9f71', '#e9b44c', '#8c7aa9']
const WALL_COLORS = ['#f7f3e8', '#f3ead3', '#eef1ec', '#f6e5d6']
const LEAF_COLORS = ['#5e9e5a', '#4f8c50', '#79b46a', '#6aa863', '#3f7a4a']
const CAR_COLORS = ['#e8796b', '#f2cf55', '#6fb3d9', '#f7f3e8', '#8fc27a', '#c98bd0']

function mulberry(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomDir(rng, out = new THREE.Vector3()) {
  const y = rng() * 2 - 1
  const t = rng() * Math.PI * 2
  const s = Math.sqrt(1 - y * y)
  return out.set(s * Math.cos(t), y, s * Math.sin(t))
}

/** Tangent at `dir` pointing toward `to`. */
function towardTangent(dir, to, out) {
  out.copy(to).addScaledVector(dir, -to.dot(dir))
  if (out.lengthSq() < 1e-10) out.set(0, 1, 0).cross(dir)
  return out.normalize()
}

const SHORE_CLEAR = 0.12
const HOUSE_SINK = 0.03
const TREE_SINK = 0.03
const HOUSE_HALF_X = 0.525
const HOUSE_HALF_Z = 0.475
const siteProbe = new THREE.Vector3()
const siteSide = new THREE.Vector3()

function aboveShore(dir, params, surface, extra = 0) {
  return groundRadius(dir, params, surface) >= seaRadius(params) + SHORE_CLEAR + extra
}

function houseFootprintClear(dir, forward, scale, params, surface) {
  if (!aboveShore(dir, params, surface)) return false
  siteSide.crossVectors(dir, forward).normalize()
  const hx = (HOUSE_HALF_X * scale + 0.2) / PLANET_RADIUS
  const hz = (HOUSE_HALF_Z * scale + 0.2) / PLANET_RADIUS
  const corners = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  for (const [sx, sz] of corners) {
    siteProbe
      .copy(dir)
      .addScaledVector(siteSide, sx * hx)
      .addScaledVector(forward, sz * hz)
      .normalize()
    if (!aboveShore(siteProbe, params, surface)) return false
  }
  return true
}

function vertexColored(geometry, color) {
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

function makeGeometries() {
  const lamp = mergeGeometries([
    vertexColored(new THREE.CylinderGeometry(0.04, 0.055, 1.15, 6).translate(0, 0.575, 0), '#3a4646'),
    vertexColored(new THREE.BoxGeometry(0.22, 0.045, 0.055).translate(0, 1.14, 0.08), '#3a4646'),
    vertexColored(new THREE.SphereGeometry(0.1, 8, 6).translate(0, 1.08, 0.18), '#ffe9a8'),
  ])
  const walls = new THREE.BoxGeometry(1.05, 0.88, 0.95).translate(0, 0.44, 0)
  const roof = new THREE.ConeGeometry(0.86, 0.58, 4).rotateY(Math.PI / 4).scale(1, 1, 0.95).translate(0, 1.16, 0)
  const door = mergeGeometries([
    vertexColored(new THREE.BoxGeometry(0.22, 0.42, 0.05).translate(0, 0.21, 0.49), '#3f5f66'),
    vertexColored(new THREE.BoxGeometry(0.2, 0.18, 0.05).translate(-0.32, 0.52, 0.49), '#9fd0dc'),
    vertexColored(new THREE.BoxGeometry(0.2, 0.18, 0.05).translate(0.32, 0.52, 0.49), '#9fd0dc'),
  ])
  const trunk = new THREE.CylinderGeometry(0.055, 0.09, 0.7, 5).translate(0, 0.35, 0)
  const canopy = mergeGeometries([
    new THREE.IcosahedronGeometry(0.48, 0).translate(0, 1.15, 0),
    new THREE.IcosahedronGeometry(0.32, 0).translate(0.18, 1.45, 0.06),
  ])
  const car = mergeGeometries([
    vertexColored(new THREE.BoxGeometry(0.26, 0.11, 0.5).translate(0, 0.1, 0), '#ffffff'),
    vertexColored(new THREE.BoxGeometry(0.22, 0.1, 0.24).translate(0, 0.2, -0.03), '#dfeef2'),
    vertexColored(new THREE.BoxGeometry(0.28, 0.055, 0.09).translate(0, 0.055, 0.16), '#2d3838'),
    vertexColored(new THREE.BoxGeometry(0.28, 0.055, 0.09).translate(0, 0.055, -0.16), '#2d3838'),
  ])
  return { lamp, walls, roof, door, trunk, canopy, car }
}

/**
 * Roads, houses, street lamps, trees, and little cars. The look starts from
 * Messenger (messenger.abeto.co): toon ink, roads as a texture, a walker on a
 * ball. The transformation is the class noise stack — houses and trees may only
 * stand on dry land. Roads are an equirectangular mask the ground shader reads,
 * so they hug the land.
 */
export function createPlanetTown({ gradientMap, makeInk }) {
  const root = new THREE.Group()
  const owned = []
  const geometries = makeGeometries()

  const canvases = ['asphalt', 'dash', 'paving'].map(() => {
    const canvas = document.createElement('canvas')
    canvas.width = MAP_W
    canvas.height = MAP_H
    return canvas
  })
  const mapCanvas = document.createElement('canvas')
  mapCanvas.width = MAP_W
  mapCanvas.height = MAP_H
  const mapCtx = mapCanvas.getContext('2d')
  const roadTexture = new THREE.CanvasTexture(mapCanvas)
  roadTexture.generateMipmaps = false
  roadTexture.minFilter = THREE.LinearFilter
  roadTexture.magFilter = THREE.LinearFilter

  const makeKind = (geometry, capacity, { vertexColors = false, emissive = null } = {}) => {
    const material = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap, vertexColors })
    if (emissive) {
      material.emissive.set(emissive)
      material.emissiveIntensity = 0.35
    }
    const mesh = new THREE.InstancedMesh(geometry, material, capacity)
    const inkMaterial = makeInk()
    inkMaterial.userData.thickness.value = INK_WIDTH
    const ink = new THREE.InstancedMesh(geometry, inkMaterial, capacity)
    ink.instanceMatrix = mesh.instanceMatrix
    mesh.count = 0
    ink.count = 0
    mesh.frustumCulled = false
    ink.frustumCulled = false
    root.add(mesh, ink)
    owned.push(material, inkMaterial)
    return { mesh, ink, n: 0 }
  }

  const kinds = {
    lamps: makeKind(geometries.lamp, MAX_LAMPS, { vertexColors: true, emissive: '#3a2a00' }),
    walls: makeKind(geometries.walls, MAX_HOUSES),
    roofs: makeKind(geometries.roof, MAX_HOUSES),
    doors: makeKind(geometries.door, MAX_HOUSES, { vertexColors: true }),
    trunks: makeKind(geometries.trunk, MAX_TREES),
    canopies: makeKind(geometries.canopy, MAX_TREES),
    cars: makeKind(geometries.car, MAX_CARS, { vertexColors: true }),
  }
  kinds.trunks.mesh.material.color.set('#8a6a4f')

  const matrix = new THREE.Matrix4()
  const basis = new THREE.Matrix4()
  const quat = new THREE.Quaternion()
  const scaleVec = new THREE.Vector3()
  const posVec = new THREE.Vector3()
  const sideVec = new THREE.Vector3()
  const color = new THREE.Color()

  const writeInstance = (kind, index, dir, forward, scale, radius) => {
    sideVec.crossVectors(dir, forward)
    basis.makeBasis(sideVec, dir, forward)
    quat.setFromRotationMatrix(basis)
    posVec.copy(dir).multiplyScalar(radius)
    scaleVec.setScalar(scale)
    matrix.compose(posVec, quat, scaleVec)
    kind.mesh.setMatrixAt(index, matrix)
  }

  const push = (kind, dir, forward, scale, radius, tint) => {
    if (kind.n >= kind.mesh.instanceMatrix.count) return -1
    const index = kind.n++
    writeInstance(kind, index, dir, forward, scale, radius)
    if (tint) kind.mesh.setColorAt(index, color.set(tint))
    return index
  }

  const finish = (kind) => {
    kind.mesh.count = kind.n
    kind.ink.count = kind.n
    kind.mesh.instanceMatrix.needsUpdate = true
    if (kind.mesh.instanceColor) kind.mesh.instanceColor.needsUpdate = true
  }

  let edges = []
  let adjacency = []
  const cars = []
  const walls = []

  const paintMask = (nodes, width) => {
    const [asphalt, dash, paving] = canvases.map((canvas) => {
      const ctx = canvas.getContext('2d')
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, MAP_W, MAP_H)
      ctx.strokeStyle = '#fff'
      ctx.fillStyle = '#fff'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      return ctx
    })

    const toPx = (d) => {
      const lon = Math.atan2(d.z, d.x)
      const lat = Math.asin(Math.max(-1, Math.min(1, d.y)))
      return [(lon / (Math.PI * 2) + 0.5) * MAP_W, (0.5 - lat / Math.PI) * MAP_H, lat]
    }

    const segment = (ctx, a, b, units) => {
      const [ax, ay, lat] = toPx(a)
      let [bx, by] = toPx(b)
      if (bx - ax > MAP_W / 2) bx -= MAP_W
      else if (ax - bx > MAP_W / 2) bx += MAP_W
      const sx = 1 / Math.max(0.06, Math.cos(lat))
      ctx.lineWidth = units * PX_PER_UNIT
      for (const shift of [-MAP_W, 0, MAP_W]) {
        const cx = (ax + bx) / 2 + shift
        if (cx < -MAP_W * 0.1 || cx > MAP_W * 1.1) continue
        const cy = (ay + by) / 2
        ctx.setTransform(sx, 0, 0, 1, cx, cy)
        ctx.beginPath()
        ctx.moveTo((ax + shift - cx) / sx, ay - cy)
        ctx.lineTo((bx + shift - cx) / sx, by - cy)
        ctx.stroke()
      }
    }

    const disc = (ctx, d, units) => {
      const [x, y, lat] = toPx(d)
      const sx = 1 / Math.max(0.06, Math.cos(lat))
      for (const shift of [-MAP_W, 0, MAP_W]) {
        ctx.setTransform(sx, 0, 0, 1, x + shift, y)
        ctx.beginPath()
        ctx.arc(0, 0, units * PX_PER_UNIT, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    for (const edge of edges) {
      const pts = edge.pts
      let travelled = 0
      for (let k = 1; k < pts.length; k++) {
        segment(paving, pts[k - 1], pts[k], width + 0.28)
        segment(asphalt, pts[k - 1], pts[k], width)
        const mid = travelled + STEP / 2
        if (Math.floor(mid / DASH) % 2 === 0) segment(dash, pts[k - 1], pts[k], Math.max(0.035, width * 0.08))
        travelled += pts[k - 1].distanceTo(pts[k]) * PLANET_RADIUS
      }
    }
    for (const node of nodes) {
      if (!node.used) continue
      disc(paving, node.dir, width * 1.9)
      disc(asphalt, node.dir, width * 1.25)
    }

    const [a, d, p] = canvases.map((canvas) =>
      canvas.getContext('2d').getImageData(0, 0, MAP_W, MAP_H).data,
    )
    const out = mapCtx.createImageData(MAP_W, MAP_H)
    const data = out.data
    for (let i = 0; i < data.length; i += 4) {
      data[i] = a[i + 3]
      data[i + 1] = d[i + 3]
      data[i + 2] = p[i + 3]
      data[i + 3] = 255
    }
    mapCtx.putImageData(out, 0, 0)
    roadTexture.needsUpdate = true
  }

  const clearMask = () => {
    mapCtx.fillStyle = '#000'
    mapCtx.fillRect(0, 0, MAP_W, MAP_H)
    roadTexture.needsUpdate = true
  }
  clearMask()

  /** Lays out the whole town for the current terrain. `surface` gives ground radius along a direction. */
  const build = (params, surface) => {
    for (const kind of Object.values(kinds)) kind.n = 0
    edges = []
    adjacency = []
    cars.length = 0
    walls.length = 0

    if (params.planetRoads === false) {
      clearMask()
      for (const kind of Object.values(kinds)) finish(kind)
      return
    }

    const rng = mulberry(Math.round(params.planetTownSeed ?? 1) * 9973 + 17)
    const width = params.planetRoadWidth ?? 0.4
    const wanted = Math.round(params.planetTowns ?? 9)
    const minGap = 3.2 / PLANET_RADIUS

    const nodes = []
    const probe = new THREE.Vector3()
    for (let tries = 0; tries < 3000 && nodes.length < wanted; tries++) {
      randomDir(rng, probe)
      if (!aboveShore(probe, params, surface)) continue
      if (nodes.some((node) => node.dir.angleTo(probe) < minGap)) continue
      nodes.push({ dir: probe.clone(), used: false })
    }

    const parent = nodes.map((_, i) => i)
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))

    const buildPath = (a, b) => {
      const angle = a.angleTo(b)
      const mid = a.clone().add(b).normalize()
      const perp = a.clone().cross(b).normalize()
      const bend = (rng() - 0.5) * 0.5 * angle
      const ctrl = mid.addScaledVector(perp, bend).normalize()
      const samples = Math.max(2, Math.ceil((angle * PLANET_RADIUS) / STEP))
      const pts = []
      for (let s = 0; s <= samples; s++) {
        const t = s / samples
        const p = new THREE.Vector3()
          .addScaledVector(a, (1 - t) * (1 - t))
          .addScaledVector(ctrl, 2 * (1 - t) * t)
          .addScaledVector(b, t * t)
          .normalize()
        if (isWater(p, params, surface)) return null
        pts.push(p)
      }
      return pts
    }

    const candidates = []
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const angle = nodes[i].dir.angleTo(nodes[j].dir)
        if (angle < 1.0) candidates.push({ i, j, angle })
      }
    }
    candidates.sort((x, y) => x.angle - y.angle)

    const addEdge = (i, j, pts) => {
      const cum = [0]
      for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + pts[k - 1].distanceTo(pts[k]) * PLANET_RADIUS)
      const radii = pts.map((p) => groundRadius(p, params, surface))
      edges.push({ a: i, b: j, pts, cum, radii, total: cum[cum.length - 1] })
      nodes[i].used = true
      nodes[j].used = true
    }

    const extra = []
    for (const c of candidates) {
      const joined = find(c.i) === find(c.j)
      if (joined && (c.angle > 0.6 || rng() > 0.2)) continue
      const pts = buildPath(nodes[c.i].dir, nodes[c.j].dir)
      if (!pts) continue
      if (joined) extra.push([c.i, c.j, pts])
      else {
        parent[find(c.i)] = find(c.j)
        addEdge(c.i, c.j, pts)
      }
    }
    for (const [i, j, pts] of extra) addEdge(i, j, pts)

    adjacency = nodes.map(() => [])
    edges.forEach((edge, index) => {
      adjacency[edge.a].push(index)
      adjacency[edge.b].push(index)
    })

    paintMask(nodes, width)

    const roadPoints = edges.flatMap((edge) => edge.pts)
    for (const node of nodes) if (node.used) roadPoints.push(node.dir)
    const clearOfRoads = (dir, gap) => {
      const limit = Math.cos(gap / PLANET_RADIUS)
      for (const p of roadPoints) if (p.dot(dir) > limit) return false
      return true
    }
    const nearestRoad = (dir) => {
      let best = null
      let bestDot = -2
      for (const p of roadPoints) {
        const d = p.dot(dir)
        if (d > bestDot) {
          bestDot = d
          best = p
        }
      }
      return best
    }

    const forward = new THREE.Vector3()
    const right = new THREE.Vector3()
    const spot = new THREE.Vector3()

    const lampGap = THREE.MathUtils.lerp(5, 1.5, params.planetLamps ?? 0.6)
    if ((params.planetLamps ?? 0.6) > 0) {
      for (const edge of edges) {
        let side = rng() < 0.5 ? 1 : -1
        for (let s = lampGap * 0.5; s < edge.total - 0.6; s += lampGap) {
          const k = edge.cum.findIndex((c) => c >= s)
          if (k <= 0) continue
          const p = edge.pts[k]
          towardTangent(p, edge.pts[Math.min(k + 1, edge.pts.length - 1)], forward)
          right.crossVectors(forward, p)
          spot.copy(p).addScaledVector(right, (side * (width / 2 + 0.16)) / PLANET_RADIUS).normalize()
          side = -side
          if (!aboveShore(spot, params, surface, -0.06)) continue
          towardTangent(spot, p, forward)
          push(kinds.lamps, spot, forward, 1, groundRadius(spot, params, surface) - 0.02)
        }
      }
    }

    const houses = []
    const houseAmount = params.planetHouses ?? 0.6
    const tryHouse = (dir) => {
      if (!clearOfRoads(dir, width / 2 + 0.7)) return
      if (houses.some((h) => h.angleTo(dir) * PLANET_RADIUS < 1.45)) return
      const road = nearestRoad(dir)
      if (!road || road.angleTo(dir) * PLANET_RADIUS > width / 2 + 2.2) return
      towardTangent(dir, road, forward)
      const scale = 0.9 + rng() * 0.28
      if (!houseFootprintClear(dir, forward, scale, params, surface)) return
      const r = groundRadius(dir, params, surface) - HOUSE_SINK
      const wall = WALL_COLORS[Math.floor(rng() * WALL_COLORS.length)]
      const roofColor = ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)]
      if (push(kinds.walls, dir, forward, scale, r, wall) < 0) return
      push(kinds.roofs, dir, forward, scale, r, roofColor)
      push(kinds.doors, dir, forward, scale, r)
      houses.push(dir.clone())
      sideVec.crossVectors(dir, forward).normalize()
      walls.push({
        dir: dir.clone(),
        forward: forward.clone(),
        side: sideVec.clone(),
        halfX: 0.525 * scale + 0.05,
        halfZ: 0.475 * scale + 0.05,
      })
    }
    if (houseAmount > 0) {
      for (const node of nodes) {
        if (!node.used) continue
        const count = Math.round(THREE.MathUtils.lerp(1, 7, houseAmount))
        for (let h = 0; h < count * 8 && houses.length < MAX_HOUSES; h++) {
          const angle = rng() * Math.PI * 2
          const dist = (width + 1.2 + rng() * 2.2) / PLANET_RADIUS
          towardTangent(node.dir, randomDir(rng, spot), forward).applyAxisAngle(node.dir, angle)
          tryHouse(spot.copy(node.dir).multiplyScalar(Math.cos(dist)).addScaledVector(forward, Math.sin(dist)).normalize())
        }
      }
      for (const edge of edges) {
        for (let k = 4; k < edge.pts.length - 4; k += 6) {
          if (rng() > houseAmount * 0.45) continue
          const p = edge.pts[k]
          towardTangent(p, edge.pts[k + 1], forward)
          right.crossVectors(forward, p)
          const side = rng() < 0.5 ? 1 : -1
          tryHouse(spot.copy(p).addScaledVector(right, (side * (width / 2 + 0.95)) / PLANET_RADIUS).normalize())
        }
      }
    }

    const treeCount = Math.round((params.planetTrees ?? 0.5) * MAX_TREES)
    for (let t = 0, tries = 0; t < treeCount && tries < treeCount * 14; tries++) {
      randomDir(rng, spot)
      if (!aboveShore(spot, params, surface)) continue
      if (!clearOfRoads(spot, width / 2 + 0.45)) continue
      if (houses.some((h) => h.angleTo(spot) * PLANET_RADIUS < 1.05)) continue
      towardTangent(spot, randomDir(rng, posVec), forward)
      const scale = 0.85 + rng() * 0.4
      const r = groundRadius(spot, params, surface) - TREE_SINK
      if (push(kinds.trunks, spot, forward, scale, r) < 0) break
      push(kinds.canopies, spot, forward, scale, r, LEAF_COLORS[Math.floor(rng() * LEAF_COLORS.length)])
      t++
    }

    for (const kind of Object.values(kinds)) if (kind !== kinds.cars) finish(kind)
  }

  const carDir = new THREE.Vector3()
  const carForward = new THREE.Vector3()
  const carRight = new THREE.Vector3()

  const spawnCar = (index) => {
    const edge = Math.floor(Math.random() * edges.length)
    const sign = Math.random() < 0.5 ? 1 : -1
    cars[index] = {
      edge,
      sign,
      s: Math.random() * edges[edge].total,
      speed: 1.2 + Math.random() * 0.8,
      color: CAR_COLORS[index % CAR_COLORS.length],
    }
    kinds.cars.mesh.setColorAt(index, color.set(cars[index].color))
    kinds.cars.mesh.instanceColor.needsUpdate = true
  }

  /** Drives the cars. Call every frame after `build`. */
  const update = (dt, params, surface) => {
    root.visible = params.planetRoads !== false
    const kind = kinds.cars
    const count = edges.length ? Math.min(MAX_CARS, Math.round(params.planetCars ?? 5)) : 0
    const width = params.planetRoadWidth ?? 0.4
    for (let i = 0; i < count; i++) {
      if (!cars[i]) spawnCar(i)
      const car = cars[i]
      let edge = edges[car.edge]
      car.s += car.speed * dt * car.sign
      if (car.s > edge.total || car.s < 0) {
        const node = car.s > edge.total ? edge.b : edge.a
        const options = adjacency[node].filter((e) => e !== car.edge)
        const next = options.length ? options[Math.floor(Math.random() * options.length)] : car.edge
        car.edge = next
        edge = edges[next]
        car.sign = edge.a === node ? 1 : -1
        car.s = car.sign > 0 ? 0 : edge.total
      }

      const s = THREE.MathUtils.clamp(car.s, 0, edge.total)
      let k = 1
      while (k < edge.cum.length - 1 && edge.cum[k] < s) k++
      const t = (s - edge.cum[k - 1]) / Math.max(1e-6, edge.cum[k] - edge.cum[k - 1])
      carDir.copy(edge.pts[k - 1]).lerp(edge.pts[k], t).normalize()
      towardTangent(carDir, car.sign > 0 ? edge.pts[k] : edge.pts[k - 1], carForward)
      carRight.crossVectors(carForward, carDir)
      carDir.addScaledVector(carRight, (width * 0.24) / PLANET_RADIUS).normalize()
      writeInstance(kind, i, carDir, carForward, 1, groundRadius(carDir, params, surface))
    }
    kind.n = count
    finish(kind)
  }

  const dispose = () => {
    for (const material of owned) material.dispose()
    for (const geometry of Object.values(geometries)) geometry.dispose()
    for (const kind of Object.values(kinds)) {
      kind.mesh.dispose()
      kind.ink.dispose()
    }
    roadTexture.dispose()
  }

  return { root, roadTexture, walls, build, update, dispose }
}
