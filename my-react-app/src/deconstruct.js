// Breakable structure for collapse and tree-fall.
// Each joint carries weight, wind, and quake load toward an anchor.
// Tension, shear, or bending above the material limit snaps the joint.
// Loose pieces are rigid bodies: they fall, hit the ground, and can shatter on impact.

const G = 9.8

function v3(x = 0, y = 0, z = 0) {
  return { x, y, z }
}

function copy3(v) {
  return { x: v.x, y: v.y, z: v.z }
}

function copyq(q) {
  return { x: q.x, y: q.y, z: q.z, w: q.w }
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function scale(a, s) {
  return { x: a.x * s, y: a.y * s, z: a.z * s }
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function len(a) {
  return Math.hypot(a.x, a.y, a.z)
}

function norm(a) {
  const l = len(a) || 1
  return { x: a.x / l, y: a.y / l, z: a.z / l }
}

function qid() {
  return { x: 0, y: 0, z: 0, w: 1 }
}

function qMul(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }
}

function qConj(a) {
  return { x: -a.x, y: -a.y, z: -a.z, w: a.w }
}

function qNormalize(q) {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1
  q.x /= l
  q.y /= l
  q.z /= l
  q.w /= l
}

function qAxis(axis, angle) {
  const h = angle * 0.5
  const s = Math.sin(h)
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(h) }
}

function qFromY(dir) {
  const n = norm(dir)
  const d = Math.min(1, Math.max(-1, n.y))
  if (d > 0.9999) return qid()
  if (d < -0.9999) return { x: 1, y: 0, z: 0, w: 0 }
  const axis = norm(cross({ x: 0, y: 1, z: 0 }, n))
  return qAxis(axis, Math.acos(d))
}

function rotate(q, v) {
  const tx = 2 * (q.y * v.z - q.z * v.y)
  const ty = 2 * (q.z * v.x - q.x * v.z)
  const tz = 2 * (q.x * v.y - q.y * v.x)
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  }
}

function applyRot(q, theta) {
  const angle = len(theta)
  if (angle < 1e-10) return
  const dq = qAxis(scale(theta, 1 / angle), angle)
  const next = qMul(dq, q)
  q.x = next.x
  q.y = next.y
  q.z = next.z
  q.w = next.w
  qNormalize(q)
}

function integrateQuat(q, w, h) {
  const ww = { x: w.x * h * 0.5, y: w.y * h * 0.5, z: w.z * h * 0.5, w: 0 }
  const dq = qMul(ww, q)
  q.x += dq.x
  q.y += dq.y
  q.z += dq.z
  q.w += dq.w
  qNormalize(q)
}

function rotVecFromQuat(q) {
  let x = q.x
  let y = q.y
  let z = q.z
  let w = q.w
  if (w < 0) {
    x = -x
    y = -y
    z = -z
    w = -w
  }
  const sinHalf = Math.hypot(x, y, z)
  const angle = 2 * Math.atan2(sinHalf, w)
  if (sinHalf < 1e-8 || angle < 1e-8) return v3()
  const k = angle / sinHalf
  return { x: x * k, y: y * k, z: z * k }
}

function worldPoint(body, local) {
  return add(body.x, rotate(body.q, local))
}

function inertiaOf(mass, half) {
  const ix = (half.y * half.y + half.z * half.z) / 3
  const iy = (half.x * half.x + half.z * half.z) / 3
  const iz = (half.x * half.x + half.y * half.y) / 3
  return Math.max(0.02, mass * ((ix + iy + iz) / 3))
}

function addBody(world, spec) {
  const half = spec.half
  const mass = spec.mass
  const inertia = inertiaOf(mass, half)
  const q = spec.q ? copyq(spec.q) : qid()
  const x = v3(spec.x, spec.y, spec.z)
  const body = {
    id: world.bodies.length,
    x,
    q,
    rest: { x: copy3(x), q: copyq(q) },
    v: v3(),
    w: v3(),
    mass,
    inertia,
    invMass: spec.anchored ? 0 : 1 / mass,
    invI: spec.anchored ? 0 : 1 / inertia,
    half,
    anchored: !!spec.anchored,
    color: spec.color,
    shape: spec.shape || 'box',
    radius: spec.radius || half.x,
    length: spec.length || half.y * 2,
    windArea: spec.windArea || 0,
    role: spec.role || '',
    joints: [],
  }
  world.bodies.push(body)
  return body
}

function rayExit(half, dir) {
  const tx = Math.abs(dir.x) > 1e-8 ? half.x / Math.abs(dir.x) : Infinity
  const ty = Math.abs(dir.y) > 1e-8 ? half.y / Math.abs(dir.y) : Infinity
  const tz = Math.abs(dir.z) > 1e-8 ? half.z / Math.abs(dir.z) : Infinity
  const t = Math.min(tx, ty, tz)
  return { x: dir.x * t, y: dir.y * t, z: dir.z * t }
}

function weld(world, a, b, group, bias, section = 1, vertical, face) {
  const keys = ['x', 'y', 'z']
  let localA
  let localB
  let axis
  if (face === undefined) {
    axis = norm(sub(b.x, a.x))
    localA = rayExit(a.half, axis)
    localB = rayExit(b.half, { x: -axis.x, y: -axis.y, z: -axis.z })
  } else {
    const axisName = keys[face]
    const sign = Math.sign(b.x[axisName] - a.x[axisName]) || 1
    localA = { x: 0, y: 0, z: 0 }
    localB = { x: 0, y: 0, z: 0 }
    localA[axisName] = sign * a.half[axisName]
    localB[axisName] = -sign * b.half[axisName]
    for (let k = 0; k < keys.length; k++) {
      const key = keys[k]
      if (key === axisName) continue
      const clamped = Math.max(-a.half[key], Math.min(a.half[key], b.x[key] - a.x[key]))
      localA[key] = clamped
      localB[key] = Math.max(-b.half[key], Math.min(b.half[key], a.x[key] + clamped - b.x[key]))
    }
    axis = { x: 0, y: 0, z: 0 }
    axis[axisName] = sign
  }
  const pa = worldPoint(a, localA)
  const pb = worldPoint(b, localB)
  const gap = sub(pb, pa)
  const joint = {
    a: a.id,
    b: b.id,
    localA,
    localB,
    restLength: face === undefined ? len(gap) : dot(gap, axis),
    axisLocalA: rotate(qConj(a.q), axis),
    qRelRest: qMul(qConj(a.q), b.q),
    group,
    bias,
    section,
    vertical: vertical !== undefined ? vertical : Math.abs(axis.y) > 0.65,
    broken: false,
    lamDist: 0,
    lamAng: v3(),
    shock: 0,
  }
  world.joints.push(joint)
  a.joints.push(joint)
  b.joints.push(joint)
  return joint
}

export const BREAK_BUILDINGS = [
  { id: 'residential', label: 'Residential' },
  { id: 'office', label: 'Office' },
  { id: 'hotel', label: 'Hotel' },
  { id: 'mall', label: 'Mall' },
]

function frameBox(world, spec) {
  const volume = spec.half.x * spec.half.y * spec.half.z
  return addBody(world, {
    x: spec.x,
    y: spec.y,
    z: spec.z,
    half: spec.half,
    mass: spec.mass ?? Math.max(0.45, volume * 210),
    color: spec.color,
    shape: 'box',
    anchored: !!spec.anchored,
    role: spec.role || 'frame',
  })
}

function contactFace(a, b) {
  const gaps = [
    Math.abs(a.x.x - b.x.x) - a.half.x - b.half.x,
    Math.abs(a.x.y - b.x.y) - a.half.y - b.half.y,
    Math.abs(a.x.z - b.x.z) - a.half.z - b.half.z,
  ]
  let face = 0
  for (let i = 1; i < 3; i++) if (gaps[i] > gaps[face]) face = i
  if (gaps[face] > 0.07 || gaps[face] < -0.08) return -1
  for (let i = 0; i < 3; i++) {
    if (i === face) continue
    if (gaps[i] > -0.02) return -1
  }
  return face
}

function weldFrame(world, parts) {
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const face = contactFace(parts[i], parts[j])
      if (face < 0) continue
      const vertical = face === 1
      weld(world, parts[i], parts[j], 'masonry', vertical ? 1.2 : 0.9, 1, vertical, face)
    }
  }
}

function levelsOf(count, floorH, lobbyH) {
  const levels = []
  let y = 0
  for (let i = 0; i < count; i++) {
    const h = i === 0 ? lobbyH : floorH
    levels.push({ i, y0: y, y1: y + h, h })
    y += h
  }
  return levels
}

function addColumn(world, parts, x, z, y0, y1, size, color, role) {
  parts.push(
    frameBox(world, {
      x,
      y: (y0 + y1) / 2,
      z,
      half: { x: size, y: (y1 - y0) / 2, z: size },
      color,
      role,
      anchored: y0 <= 0.001,
    }),
  )
}

function addPlate(world, parts, spec) {
  parts.push(
    frameBox(world, {
      x: spec.x,
      y: spec.y,
      z: spec.z,
      half: spec.half,
      color: spec.color,
      role: spec.role,
      mass: spec.mass,
    }),
  )
}

function buildResidential(world) {
  const width = 1.52
  const depth = 1.16
  const ox = -0.95
  const oz = 0
  const levels = levelsOf(12, 0.4, 0.58)
  const parts = []
  const xs = [-width / 2 + 0.14, width / 2 - 0.14]
  const zs = [-depth / 2 + 0.14, depth / 2 - 0.14]
  for (let n = 0; n < levels.length; n++) {
    const level = levels[n]
    for (let i = 0; i < xs.length; i++) {
      for (let j = 0; j < zs.length; j++) {
        addColumn(world, parts, ox + xs[i], oz + zs[j], level.y0, level.y1, 0.055, 0xd5ccc0, 'column')
      }
    }
    addColumn(world, parts, ox, oz, level.y0, level.y1, 0.14, 0xb5a898, 'core')
    addPlate(world, parts, {
      x: ox,
      y: level.y1,
      z: oz,
      half: { x: width / 2, y: 0.026, z: depth / 2 },
      color: n % 2 ? 0xcbbdaa : 0xd4c7b6,
      role: 'slab',
    })
    addPlate(world, parts, {
      x: ox,
      y: level.y1,
      z: oz + depth / 2 + 0.14,
      half: { x: width / 2 - 0.12, y: 0.016, z: 0.14 },
      color: 0xe7ddd0,
      role: 'balcony',
      mass: 0.55,
    })
    addPlate(world, parts, {
      x: ox,
      y: level.y1 - 0.026 - level.h * 0.18,
      z: oz + depth / 2 - 0.01,
      half: { x: width / 2 - 0.18, y: level.h * 0.18, z: 0.03 },
      color: 0x6a8292,
      role: 'facade',
      mass: 0.32,
    })
  }
  weldFrame(world, parts)
  const top = levels[levels.length - 1].y1
  return focusFor(ox, oz, top, width, depth)
}

function buildOffice(world) {
  const width = 2.05
  const depth = 1.35
  const ox = -0.7
  const oz = 0
  const levels = levelsOf(9, 0.46, 0.7)
  const parts = []
  const xs = [-width / 2 + 0.16, -width / 6, width / 6, width / 2 - 0.16]
  const zs = [-depth / 2 + 0.16, depth / 2 - 0.16]
  for (let n = 0; n < levels.length; n++) {
    const level = levels[n]
    for (let i = 0; i < xs.length; i++) {
      for (let j = 0; j < zs.length; j++) {
        addColumn(world, parts, ox + xs[i], oz + zs[j], level.y0, level.y1, 0.05, 0x556068, 'column')
      }
    }
    addColumn(world, parts, ox + 0.15, oz, level.y0, level.y1, 0.16, 0x6a7580, 'core')
    addPlate(world, parts, {
      x: ox,
      y: level.y1,
      z: oz,
      half: { x: width / 2, y: 0.028, z: depth / 2 },
      color: 0x9aafbf,
      role: 'slab',
    })
    addPlate(world, parts, {
      x: ox,
      y: level.y1 - 0.028 - level.h * 0.26,
      z: oz + depth / 2 - 0.008,
      half: { x: width / 2 - 0.12, y: level.h * 0.26, z: 0.03 },
      color: n % 2 ? 0x7f96a6 : 0x6e8798,
      role: 'facade',
      mass: 0.4,
    })
  }
  const top = levels[levels.length - 1].y1
  addPlate(world, parts, {
    x: ox + 0.15,
    y: top + 0.22,
    z: oz,
    half: { x: 0.38, y: 0.2, z: 0.28 },
    color: 0x4a545c,
    role: 'slab',
  })
  weldFrame(world, parts)
  return focusFor(ox, oz, top + 0.4, width, depth)
}

function buildHotel(world) {
  const ox = -0.85
  const oz = 0
  const parts = []
  const podiumW = 2.35
  const podiumD = 1.7
  const podium = levelsOf(2, 0.5, 0.62)
  const podiumXs = [-podiumW / 2 + 0.16, -podiumW / 6, podiumW / 6, podiumW / 2 - 0.16]
  const podiumZs = [-podiumD / 2 + 0.16, 0, podiumD / 2 - 0.16]
  for (const level of podium) {
    for (const x of podiumXs) {
      for (const z of podiumZs) {
        addColumn(world, parts, ox + x, oz + z, level.y0, level.y1, 0.06, 0x8d7b66, 'column')
      }
    }
    addPlate(world, parts, {
      x: ox,
      y: level.y1,
      z: oz,
      half: { x: podiumW / 2, y: 0.03, z: podiumD / 2 },
      color: level.i === 0 ? 0xb7a48c : 0xcbb89a,
      role: 'slab',
    })
  }
  const base = podium[podium.length - 1].y1
  const towerW = 1.28
  const towerD = 1.05
  const tower = []
  let y = base
  for (let i = 0; i < 10; i++) {
    const h = 0.38
    tower.push({ y0: y, y1: y + h, h, i })
    y += h
  }
  const txs = [-towerW / 2 + 0.12, towerW / 2 - 0.12]
  const tzs = [-towerD / 2 + 0.12, towerD / 2 - 0.12]
  for (const level of tower) {
    for (const x of txs) {
      for (const z of tzs) {
        addColumn(world, parts, ox + x, oz + z, level.y0, level.y1, 0.05, 0xe6d9c8, 'column')
      }
    }
    addColumn(world, parts, ox, oz, level.y0, level.y1, 0.12, 0xd9cbb8, 'core')
    addPlate(world, parts, {
      x: ox,
      y: level.y1,
      z: oz,
      half: { x: towerW / 2, y: 0.024, z: towerD / 2 },
      color: 0xf0e4d4,
      role: 'slab',
    })
    addPlate(world, parts, {
      x: ox,
      y: level.y1 - 0.024 - level.h * 0.18,
      z: oz + towerD / 2 - 0.008,
      half: { x: towerW / 2 - 0.12, y: level.h * 0.18, z: 0.028 },
      color: 0x7d6e62,
      role: 'facade',
      mass: 0.28,
    })
  }
  weldFrame(world, parts)
  return focusFor(ox, oz, y, podiumW, podiumD)
}

function buildMall(world) {
  const width = 3.05
  const depth = 2.15
  const hole = 0.85
  const ox = -0.35
  const oz = 0
  const levels = levelsOf(3, 0.55, 0.7)
  const parts = []
  const xs = [-width / 2 + 0.18, -hole / 2 - 0.12, hole / 2 + 0.12, width / 2 - 0.18]
  const zs = [-depth / 2 + 0.18, -hole / 2 - 0.12, hole / 2 + 0.12, depth / 2 - 0.18]
  for (const level of levels) {
    for (const x of xs) {
      for (const z of zs) {
        const aroundCourt =
          Math.abs(x) < hole / 2 + 0.2 && Math.abs(z) < hole / 2 + 0.2
        if (aroundCourt) continue
        addColumn(world, parts, ox + x, oz + z, level.y0, level.y1, 0.055, 0xf3f0ea, 'column')
      }
    }
    const hx = width / 2
    const hz = depth / 2
    const ix = hole / 2
    const iz = hole / 2
    const bands = [
      { x: ox - (hx + ix) / 2, z: oz, hx: (hx - ix) / 2, hz },
      { x: ox + (hx + ix) / 2, z: oz, hx: (hx - ix) / 2, hz },
      { x: ox, z: oz - (hz + iz) / 2, hx: ix, hz: (hz - iz) / 2 },
      { x: ox, z: oz + (hz + iz) / 2, hx: ix, hz: (hz - iz) / 2 },
    ]
    for (const band of bands) {
      addPlate(world, parts, {
        x: band.x,
        y: level.y1,
        z: band.z,
        half: { x: band.hx, y: 0.03, z: band.hz },
        color: level.i === 0 ? 0xc8c2b8 : 0xd9d4cc,
        role: 'slab',
      })
    }
    if (level.i === levels.length - 1) {
      addPlate(world, parts, {
        x: ox,
        y: level.y1,
        z: oz,
        half: { x: ix + 0.08, y: 0.015, z: iz + 0.08 },
        color: 0x9ec4d4,
        role: 'facade',
        mass: 0.4,
      })
    }
  }
  addPlate(world, parts, {
    x: ox,
    y: levels[0].y1,
    z: oz + depth / 2 + 0.12,
    half: { x: 0.55, y: 0.02, z: 0.28 },
    color: 0xc45c3c,
    role: 'balcony',
    mass: 0.35,
  })
  weldFrame(world, parts)
  return focusFor(ox, oz, levels[levels.length - 1].y1 + 0.2, width, depth)
}

function focusFor(x, z, height, width, depth) {
  const span = Math.max(width, depth, height * 0.9)
  return {
    focus: {
      x,
      y: height * 0.48,
      z,
      distance: Math.max(9.6, span * 2.55),
    },
    treeX: x + width / 2 + 1.55,
  }
}

function buildArchitecture(world, kind) {
  if (kind === 'office') return buildOffice(world)
  if (kind === 'hotel') return buildHotel(world)
  if (kind === 'mall') return buildMall(world)
  return buildResidential(world)
}

function addLimb(world, parent, dir, length, radius, windArea, bias, color, shape) {
  const n = norm(dir)
  const q = qFromY(n)
  const parentLocalOnAxis = rotate(qConj(parent.q), n)
  const surface = {
    x: parentLocalOnAxis.x * parent.half.x,
    y: parentLocalOnAxis.y * parent.half.y,
    z: parentLocalOnAxis.z * parent.half.z,
  }
  const origin = add(parent.x, rotate(parent.q, surface))
  const halfY = shape === 'leaf' ? length * 0.42 : length / 2
  const center = add(origin, scale(n, halfY))
  const half =
    shape === 'leaf'
      ? { x: radius * 1.7, y: radius * 0.85, z: radius * 1.45 }
      : { x: radius, y: halfY, z: radius }
  const body = addBody(world, {
    x: center.x,
    y: center.y,
    z: center.z,
    q,
    half,
    mass: shape === 'leaf' ? 0.22 : 0.28 + radius * 3.2,
    color,
    shape,
    radius,
    length,
    anchored: false,
    windArea,
  })
  const joint = weld(world, parent, body, 'wood', bias, Math.max(0.28, radius / 0.09))
  joint.localA = surface
  const childAnchor = rotate(qConj(q), scale(n, -halfY))
  joint.localB = childAnchor
  const pa = worldPoint(parent, joint.localA)
  const pb = worldPoint(body, joint.localB)
  const gap = sub(pb, pa)
  joint.restLength = len(gap)
  joint.axisLocalA = rotate(qConj(parent.q), norm(len(gap) > 1e-5 ? gap : n))
  joint.qRelRest = qMul(qConj(parent.q), body.q)
  joint.vertical = Math.abs(n.y) > 0.65
  return body
}

function buildTree(world, rootX = 2.4) {
  const rootZ = 0.15
  const radii = [0.11, 0.098, 0.086, 0.072, 0.058, 0.046]
  const lens = [0.58, 0.52, 0.46, 0.4, 0.34, 0.28]
  const trunk = []
  let y = 0
  let parent = null
  for (let i = 0; i < lens.length; i++) {
    const len = lens[i]
    const r = radii[i]
    const body = addBody(world, {
      x: rootX,
      y: y + len / 2,
      z: rootZ,
      half: { x: r, y: len / 2, z: r },
      mass: 0.45 + r * 5,
      color: 0x5c4634,
      shape: 'cylinder',
      radius: r,
      length: len,
      anchored: i === 0,
      windArea: 0.12 + i * 0.04,
    })
    y += len
    if (parent) weld(world, parent, body, 'wood', 0.7 + (lens.length - i) * 0.12, r / 0.09)
    parent = body
    trunk.push(body)
  }

  const sprouts = [
    { at: 2, dir: { x: 0.86, y: 0.5, z: 0.22 }, n: 3, leaf: 0x1f6a34 },
    { at: 3, dir: { x: -0.62, y: 0.58, z: 0.62 }, n: 3, leaf: 0x2f7a38 },
    { at: 4, dir: { x: 0.18, y: 0.48, z: -0.9 }, n: 2, leaf: 0x46883c },
    { at: 5, dir: { x: -0.35, y: 0.86, z: 0.2 }, n: 2, leaf: 0x3d8a40 },
  ]

  for (const sprout of sprouts) {
    let prev = trunk[sprout.at]
    let dir = norm(sprout.dir)
    let radius = prev.radius * 0.62
    let length = 0.4
    for (let k = 0; k < sprout.n; k++) {
      const tip = k === sprout.n - 1
      prev = addLimb(
        world,
        prev,
        dir,
        length,
        radius,
        0.2 + k * 0.18,
        0.42 + k * 0.08,
        0x6a5340,
        'cylinder',
      )
      if (tip) {
        addLimb(world, prev, dir, radius * 2.4, radius * 2.1, 2.4, 0.34, sprout.leaf, 'leaf')
      }
      radius *= 0.72
      length *= 0.84
      dir = norm({ x: dir.x * 0.72, y: dir.y + 0.28, z: dir.z * 0.72 })
    }
  }
}

export function createBreakWorld(kind) {
  const world = {
    bodies: [],
    joints: [],
    time: 0,
    gust: 0,
    quake: 0,
    failing: [],
  }
  const built = buildArchitecture(world, kind)
  buildTree(world, built.treeX)
  world.focus = built.focus
  return world
}

function capacity(joint, settings) {
  const masonry = 0.4 + (settings.masonry ?? 0.62) * 1.35
  const wood = 0.35 + (settings.wood ?? 0.48) * 1.45
  if (joint.group === 'wood') {
    const section = joint.section
    return {
      tension: 70 * wood * section,
      compression: 110 * wood * section,
      shear: 120 * wood * section,
      bend: 90 * wood * section * joint.bias,
    }
  }
  const vertical = joint.vertical ? 1 : 0.42
  return {
    tension: 14 * masonry * vertical * joint.bias,
    compression: 520 * masonry,
    shear: 36 * masonry * joint.bias,
      bend: (joint.vertical ? 46 : 6.5) * masonry * joint.bias,
  }
}

function supportExtents(body) {
  const ux = rotate(body.q, { x: 1, y: 0, z: 0 })
  const uy = rotate(body.q, { x: 0, y: 1, z: 0 })
  const uz = rotate(body.q, { x: 0, y: 0, z: 1 })
  return {
    x: Math.abs(ux.x) * body.half.x + Math.abs(uy.x) * body.half.y + Math.abs(uz.x) * body.half.z,
    y: Math.abs(ux.y) * body.half.x + Math.abs(uy.y) * body.half.y + Math.abs(uz.y) * body.half.z,
    z: Math.abs(ux.z) * body.half.x + Math.abs(uy.z) * body.half.y + Math.abs(uz.z) * body.half.z,
  }
}

function capSpeed(body) {
  const s = len(body.v)
  if (s > 16) {
    const k = 16 / s
    body.v.x *= k
    body.v.y *= k
    body.v.z *= k
  }
  const aw = len(body.w)
  if (aw > 14) {
    const k = 14 / aw
    body.w.x *= k
    body.w.y *= k
    body.w.z *= k
  }
}

function release(body) {
  body.anchored = false
  body.invMass = 1 / body.mass
  body.invI = 1 / body.inertia
}

function shockJoints(body, amount) {
  for (let i = 0; i < body.joints.length; i++) {
    const joint = body.joints[i]
    if (!joint.broken) joint.shock = Math.max(joint.shock, amount)
  }
}

function predict(world, h, settings) {
  const gravity = G * (settings.gravity ?? 1)
  const wind = (settings.wind ?? 0) + world.gust
  const pulse = 0.72 + 0.28 * Math.sin(world.time * 1.65)
  const shaking = world.quake > 0
  const amp = shaking ? Math.sin(world.time * 36) * 0.1 * Math.min(1, world.quake * 1.4) : 0
  const ampZ = shaking ? Math.sin(world.time * 23) * 0.04 * Math.min(1, world.quake * 1.4) : 0

  for (let i = 0; i < world.bodies.length; i++) {
    const body = world.bodies[i]
    body.hitGround = false
    if (body.anchored) {
      body.v.x = 0
      body.v.y = 0
      body.v.z = 0
      body.w.x = 0
      body.w.y = 0
      body.w.z = 0
      body.x.x = body.rest.x.x + amp
      body.x.y = body.rest.x.y
      body.x.z = body.rest.x.z + ampZ
      body.q.x = body.rest.q.x
      body.q.y = body.rest.q.y
      body.q.z = body.rest.q.z
      body.q.w = body.rest.q.w
      continue
    }
    body.v.y -= gravity * h
    if (body.windArea && !body.loose) {
      const accel = (wind * pulse * body.windArea * 7) / body.mass
      body.v.x += Math.max(-1.6, Math.min(1.6, accel)) * h
    }
    capSpeed(body)
    body.px = body.x.x
    body.py = body.x.y
    body.pz = body.x.z
    body.pqx = body.q.x
    body.pqy = body.q.y
    body.pqz = body.q.z
    body.pqw = body.q.w
    body.x.x += body.v.x * h
    body.x.y += body.v.y * h
    body.x.z += body.v.z * h
    integrateQuat(body.q, body.w, h)
  }
}

function finalize(world, h) {
  for (let i = 0; i < world.bodies.length; i++) {
    const body = world.bodies[i]
    if (body.anchored) continue
    const vx = (body.x.x - body.px) / h
    const vy = (body.x.y - body.py) / h
    const vz = (body.x.z - body.pz) / h
    body.v.x = vx
    body.v.y = vy
    body.v.z = vz
    const dq = qMul(body.q, qConj({ x: body.pqx, y: body.pqy, z: body.pqz, w: body.pqw }))
    const rot = rotVecFromQuat(dq)
    body.w.x = rot.x / h
    body.w.y = rot.y / h
    body.w.z = rot.z / h
    if (body.hitGround && body.v.y < 0) {
      const impact = -body.v.y
      body.v.y *= -0.05
      body.v.x *= 0.55
      body.v.z *= 0.55
      body.w.x *= 0.45
      body.w.y *= 0.6
      body.w.z *= 0.45
      if (impact > 1.6) shockJoints(body, impact * 0.2)
    }
    body.w.x *= 0.97
    body.w.y *= 0.97
    body.w.z *= 0.97
    capSpeed(body)
  }
}

function solveJoint(world, joint, h) {
  if (joint.broken) return
  const a = world.bodies[joint.a]
  const b = world.bodies[joint.b]
  if (a.invMass + b.invMass + a.invI + b.invI === 0) return

  const pa = worldPoint(a, joint.localA)
  const pb = worldPoint(b, joint.localB)
  const delta = sub(pb, pa)
  const desired = scale(rotate(a.q, joint.axisLocalA), joint.restLength)
  const cVec = sub(delta, desired)
  const cLen = len(cVec)
  if (cLen > 1e-8) {
    const n = scale(cVec, 1 / cLen)
    const ra = sub(pa, a.x)
    const rb = sub(pb, b.x)
    const raN = cross(ra, n)
    const rbN = cross(rb, n)
    const wSum =
      a.invMass + b.invMass + a.invI * dot(raN, raN) + b.invI * dot(rbN, rbN) + 1e-6
    const dLam = -cLen / wSum
    joint.lamDist += dLam

    a.x.x -= n.x * dLam * a.invMass
    a.x.y -= n.y * dLam * a.invMass
    a.x.z -= n.z * dLam * a.invMass
    b.x.x += n.x * dLam * b.invMass
    b.x.y += n.y * dLam * b.invMass
    b.x.z += n.z * dLam * b.invMass
    applyRot(a.q, scale(cross(ra, n), -dLam * a.invI))
    applyRot(b.q, scale(cross(rb, n), dLam * b.invI))
  }

  const qRel = qMul(qConj(a.q), b.q)
  const qErr = qMul(qRel, qConj(joint.qRelRest))
  const localErr = rotVecFromQuat(qErr)
  const e = rotate(a.q, localErr)
  const wAng = a.invI + b.invI + 1e-6
  const alphaAng = (joint.group === 'wood' ? 2.5e-7 : 0) / (h * h)
  const dAx = -(e.x + alphaAng * joint.lamAng.x) / (wAng + alphaAng)
  const dAy = -(e.y + alphaAng * joint.lamAng.y) / (wAng + alphaAng)
  const dAz = -(e.z + alphaAng * joint.lamAng.z) / (wAng + alphaAng)
  joint.lamAng.x += dAx
  joint.lamAng.y += dAy
  joint.lamAng.z += dAz
  const rotA = { x: -dAx * a.invI, y: -dAy * a.invI, z: -dAz * a.invI }
  const rotB = { x: dAx * b.invI, y: dAy * b.invI, z: dAz * b.invI }
  applyRot(a.q, rotA)
  applyRot(b.q, rotB)
}

function collide(world) {
  const linked = (a, b) => {
    const joints = a.joints
    for (let i = 0; i < joints.length; i++) {
      const joint = joints[i]
      if (joint.broken) continue
      if (joint.a === b.id || joint.b === b.id) return true
    }
    return false
  }

  for (let i = 0; i < world.bodies.length; i++) {
    const body = world.bodies[i]
    if (body.anchored) continue
    const ext = supportExtents(body)
    const bottom = body.x.y - ext.y
    if (bottom < 0) {
      body.x.y -= bottom
      body.hitGround = true
    }
  }

  for (let i = 0; i < world.bodies.length; i++) {
    const a = world.bodies[i]
    const ea = supportExtents(a)
    for (let j = i + 1; j < world.bodies.length; j++) {
      const b = world.bodies[j]
      if (a.invMass + b.invMass === 0) continue
      if (linked(a, b)) continue
      if (!a.loose && !b.loose) continue
      const eb = supportExtents(b)
      const dx = b.x.x - a.x.x
      const dy = b.x.y - a.x.y
      const dz = b.x.z - a.x.z
      const px = ea.x + eb.x - Math.abs(dx)
      const py = ea.y + eb.y - Math.abs(dy)
      const pz = ea.z + eb.z - Math.abs(dz)
      if (px <= 0 || py <= 0 || pz <= 0) continue
      let axis = 'x'
      let pen = px
      let sign = dx >= 0 ? 1 : -1
      if (py < pen) {
        axis = 'y'
        pen = py
        sign = dy >= 0 ? 1 : -1
      }
      if (pz < pen) {
        axis = 'z'
        pen = pz
        sign = dz >= 0 ? 1 : -1
      }
      const wa = a.invMass
      const wb = b.invMass
      const w = wa + wb || 1
      const pushA = pen * (wa / w)
      const pushB = pen * (wb / w)
      a.x[axis] -= sign * pushA
      b.x[axis] += sign * pushB
      const rel = (b.v[axis] - a.v[axis]) * sign
      if (rel < -2.4) {
        if (wa > 0) shockJoints(a, -rel * 0.14)
        if (wb > 0) shockJoints(b, -rel * 0.14)
      }
    }
  }
}

function solveStructure(world, settings) {
  const count = world.bodies.length
  const dist = new Array(count).fill(Infinity)
  const queue = []
  for (let i = 0; i < count; i++) {
    if (!world.bodies[i].anchored) continue
    dist[i] = 0
    queue.push(i)
  }
  let head = 0
  while (head < queue.length) {
    const id = queue[head++]
    const body = world.bodies[id]
    for (let k = 0; k < body.joints.length; k++) {
      const joint = body.joints[k]
      if (joint.broken) continue
      const other = joint.a === id ? joint.b : joint.a
      if (dist[other] <= dist[id] + 1) continue
      dist[other] = dist[id] + 1
      queue.push(other)
    }
  }

  const order = []
  for (let i = 0; i < count; i++) if (dist[i] > 0 && dist[i] < Infinity) order.push(i)
  order.sort((p, q) => dist[q] - dist[p])

  const carriedF = Array.from({ length: count }, () => v3())
  const carriedM = Array.from({ length: count }, () => v3())
  const gravity = G * (settings.gravity ?? 1)
  const wind = (settings.wind ?? 0) + world.gust
  const pulse = 0.72 + 0.28 * Math.sin(world.time * 1.65)
  const qAcc = world.quake > 0 ? Math.sin(world.time * 36) * 26 * Math.min(1, world.quake * 1.4) : 0

  for (let i = 0; i < count; i++) {
    const body = world.bodies[i]
    if (body.anchored || dist[i] === Infinity) continue
    carriedF[i].y -= body.mass * gravity
    carriedF[i].x += wind * pulse * body.windArea * 7
    carriedF[i].x += body.mass * qAcc
  }

  const ranked = []
  for (let n = 0; n < order.length; n++) {
    const id = order[n]
    const body = world.bodies[id]
    const closer = []
    for (let k = 0; k < body.joints.length; k++) {
      const joint = body.joints[k]
      if (joint.broken) continue
      const other = joint.a === id ? joint.b : joint.a
      if (dist[other] < dist[id]) closer.push({ joint, other })
    }
    const lower = closer.filter((link) => world.bodies[link.other].rest.x.y < body.rest.x.y - 0.02)
    const downs = lower.length ? lower : closer
    if (!downs.length) continue
    const share = 1 / downs.length
    const f = scale(carriedF[id], share)
    const m = scale(carriedM[id], share)
    for (let d = 0; d < downs.length; d++) {
      const { joint, other } = downs[d]
      const near = world.bodies[other]
      const broad = body.role === 'slab' || body.role === 'balcony' || body.role === 'facade'
      const local = joint.a === id ? joint.localA : joint.localB
      const r = broad ? v3() : rotate(body.rest.q, local)
      const momentAtJoint = add(m, cross(r, f))
      const sign = near.rest.x.y >= body.rest.x.y ? 1 : -1
      const axis = joint.vertical
        ? { x: 0, y: sign, z: 0 }
        : norm(sub(near.rest.x, body.rest.x))
      const axial = dot(f, axis)
      const lateral = sub(f, scale(axis, axial))
      const cap = capacity(joint, settings)
      const tension = Math.max(0, -axial)
      const compression = Math.max(0, axial)
      const shear = len(lateral)
      const momentMag = len(momentAtJoint)
      const ratio = Math.max(
        tension / cap.tension,
        compression / cap.compression,
        shear / cap.shear,
        momentMag / cap.bend,
        joint.shock,
      )
      ranked.push({ joint, ratio })
      const parentF = carriedF[other]
      const parentM = carriedM[other]
      parentF.x += f.x
      parentF.y += f.y
      parentF.z += f.z
      const lever = broad ? v3() : sub(near.rest.x, body.rest.x)
      const passed = add(m, cross(lever, f))
      parentM.x += passed.x
      parentM.y += passed.y
      parentM.z += passed.z
    }
  }

  ranked.sort((p, q) => q.ratio - p.ratio)
  let woodBreaks = 0
  let frameBreaks = 0
  for (let i = 0; i < ranked.length && frameBreaks < 3; i++) {
    if (ranked[i].ratio <= 1) break
    const joint = ranked[i].joint
    if (joint.broken) continue
    if (joint.group === 'wood') {
      if (woodBreaks >= 1) continue
      woodBreaks += 1
      calmBody(world.bodies[joint.a])
      calmBody(world.bodies[joint.b])
    }
    joint.broken = true
    joint.shock = 0
    frameBreaks += 1
  }

  for (let i = 0; i < world.joints.length; i++) {
    const joint = world.joints[i]
    if (joint.shock > 0) joint.shock *= 0.72
  }
  releaseDetached(world)
}

function releaseDetached(world) {
  const count = world.bodies.length
  const seen = new Array(count).fill(false)
  const queue = []
  for (let i = 0; i < count; i++) {
    if (!world.bodies[i].anchored) continue
    seen[i] = true
    queue.push(i)
  }
  let head = 0
  while (head < queue.length) {
    const id = queue[head++]
    const body = world.bodies[id]
    for (let k = 0; k < body.joints.length; k++) {
      const joint = body.joints[k]
      if (joint.broken) continue
      const other = joint.a === id ? joint.b : joint.a
      if (seen[other]) continue
      seen[other] = true
      queue.push(other)
    }
  }
  for (let i = 0; i < count; i++) {
    const body = world.bodies[i]
    if (body.anchored || seen[i]) continue
    body.loose = true
  }
}

function detach(body, impulse) {
  if (!body || body.loose) return
  body.loose = true
  release(body)
  if (impulse) {
    body.v.x += impulse.x
    body.v.y += impulse.y
    body.v.z += impulse.z
  }
  for (let i = 0; i < body.joints.length; i++) body.joints[i].broken = true
}

function calmBody(body) {
  if (!body || body.anchored) return
  body.v.x *= 0.18
  body.v.y = Math.min(body.v.y, 0.25)
  body.v.z *= 0.18
  body.w.x *= 0.22
  body.w.y *= 0.22
  body.w.z *= 0.22
}

function severWood(world, body, impulse) {
  let joint = null
  let lowest = Infinity
  for (let i = 0; i < body.joints.length; i++) {
    const candidate = body.joints[i]
    if (candidate.broken) continue
    const other = world.bodies[candidate.a === body.id ? candidate.b : candidate.a]
    if (other.rest.x.y < lowest) {
      lowest = other.rest.x.y
      joint = candidate
    }
  }
  if (!joint || lowest >= body.rest.x.y - 0.02) {
    detach(body, impulse)
    return
  }
  joint.broken = true
  calmBody(body)
  calmBody(world.bodies[joint.a === body.id ? joint.b : joint.a])
  body.v.x += impulse.x * 0.25
  body.v.y += Math.min(0.35, Math.max(0, impulse.y))
  body.v.z += impulse.z * 0.25
}

function shockBay(world, column) {
  for (let i = 0; i < world.bodies.length; i++) {
    const body = world.bodies[i]
    if (body.role !== 'slab' && body.role !== 'balcony' && body.role !== 'facade') continue
    const dy = body.rest.x.y - column.rest.x.y
    if (dy < -0.08 || dy > 0.85) continue
    const dx = Math.abs(body.rest.x.x - column.rest.x.x)
    const dz = Math.abs(body.rest.x.z - column.rest.x.z)
    if (dx > body.half.x + 0.15 || dz > body.half.z + 0.15) continue
    for (let k = 0; k < body.joints.length; k++) body.joints[k].broken = true
  }
}

export function strikeBody(world, id, impulse) {
  const body = world.bodies[id]
  if (!body) return
  if (body.shape === 'cylinder' || body.shape === 'leaf') {
    severWood(world, body, impulse)
    return
  }
  detach(body, impulse)
  if (body.role === 'column' || body.role === 'core') shockBay(world, body)
  const above = []
  for (let i = 0; i < world.bodies.length; i++) {
    const other = world.bodies[i]
    if (other.id === body.id) continue
    if (other.role !== body.role) continue
    const dx = Math.abs(other.rest.x.x - body.rest.x.x)
    const dz = Math.abs(other.rest.x.z - body.rest.x.z)
    if (dx > 0.08 || dz > 0.08 || other.rest.x.y <= body.rest.x.y) continue
    above.push(other)
  }
  above.sort((a, b) => a.rest.x.y - b.rest.x.y)
  if (!world.failing) world.failing = []
  for (let i = 0; i < above.length; i++) {
    world.failing.push({ id: above[i].id, at: world.time + 0.16 * (i + 1) })
  }
}

export function pulseBreak(world, action) {
  if (action === 'gust') world.gust = Math.max(world.gust, 1.25)
  if (action === 'quake') world.quake = Math.max(world.quake, 1)
}

export function stepBreakWorld(world, dt, settings) {
  const frame = Math.min(0.033, Math.max(0, dt || 0))
  world.time += frame
  const input = settings || {}
  const substeps = 4
  const h = frame / substeps
  for (let s = 0; s < substeps; s++) {
    predict(world, h, input)
    world.joints.sort((p, q) => {
      const py = Math.min(world.bodies[p.a].rest.x.y, world.bodies[p.b].rest.x.y)
      const qy = Math.min(world.bodies[q.a].rest.x.y, world.bodies[q.b].rest.x.y)
      return py - qy
    })
    for (let iter = 0; iter < 12; iter++) {
      for (let j = 0; j < world.joints.length; j++) solveJoint(world, world.joints[j], h)
    }
    collide(world)
    finalize(world, h)
  }
  solveStructure(world, input)
  if (world.failing && world.failing.length) {
    const pending = []
    for (let i = 0; i < world.failing.length; i++) {
      const item = world.failing[i]
      if (world.time < item.at) {
        pending.push(item)
        continue
      }
      const piece = world.bodies[item.id]
      const kick = ((item.id * 13) % 5) - 2
      detach(piece, { x: kick * 0.18, y: 0.2, z: 0.45 })
      if (piece && (piece.role === 'column' || piece.role === 'core')) shockBay(world, piece)
    }
    world.failing = pending
  }
  world.gust = Math.max(0, world.gust - frame * 0.5)
  world.quake = Math.max(0, world.quake - frame * 0.42)
}

export function readBreakStats(world) {
  let intact = 0
  let broken = 0
  let moving = 0
  for (let i = 0; i < world.joints.length; i++) {
    if (world.joints[i].broken) broken += 1
    else intact += 1
  }
  for (let i = 0; i < world.bodies.length; i++) {
    const body = world.bodies[i]
    if (body.anchored) continue
    if (len(body.v) > 0.45) moving += 1
  }
  return { intact, broken, moving, bodies: world.bodies.length }
}
