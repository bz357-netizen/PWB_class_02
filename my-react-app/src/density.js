export const MAX_CSG_SOLIDS = 8

export const CSG_OPS = [
  {
    id: 'union',
    label: 'Union',
    note: 'd = min(a, b) — sequential keep. The new solid is added to everything before it.',
  },
  {
    id: 'subtract',
    label: 'Subtract',
    note: 'd = max(a, −b) — cut this solid out of the running shape.',
  },
  {
    id: 'intersect',
    label: 'Intersect',
    note: 'd = max(a, b) — keep only the overlap with the running shape.',
  },
  {
    id: 'xor',
    label: 'XOR',
    note: 'Symmetric difference — keep volume that is in one side, not both.',
  },
  {
    id: 'smooth-union',
    label: 'Smooth union',
    note: 'Polynomial smooth-min. k blends the join instead of a sharp crease.',
  },
  {
    id: 'smooth-subtract',
    label: 'Smooth subtract',
    note: 'Filleted cut. k rounds the cavity lip.',
  },
  {
    id: 'smooth-intersect',
    label: 'Smooth intersect',
    note: 'Filleted overlap. k rounds the kept intersection.',
  },
]

export const DENSITY_SHAPES = [
  {
    id: 'sphere',
    label: 'Sphere',
    note: 'd = |p| − r',
    sliders: [{ key: 'radius', label: 'Radius r', min: 0.8, max: 16, step: 0.1 }],
  },
  {
    id: 'box',
    label: 'Box',
    note: 'Axis-aligned box. Half-extents (sx, sy, sz) in object space.',
    sliders: [
      { key: 'sx', label: 'Width X', min: 0.4, max: 24, step: 0.1 },
      { key: 'sy', label: 'Height Y', min: 0.4, max: 24, step: 0.1 },
      { key: 'sz', label: 'Depth Z', min: 0.4, max: 24, step: 0.1 },
    ],
  },
  {
    id: 'round-box',
    label: 'Round box',
    note: 'Box with edge fillet. Rounding is subtracted from the extents.',
    sliders: [
      { key: 'sx', label: 'Width X', min: 0.4, max: 24, step: 0.1 },
      { key: 'sy', label: 'Height Y', min: 0.4, max: 24, step: 0.1 },
      { key: 'sz', label: 'Depth Z', min: 0.4, max: 24, step: 0.1 },
      { key: 'round', label: 'Fillet', min: 0, max: 4, step: 0.05 },
    ],
  },
  {
    id: 'ellipsoid',
    label: 'Ellipsoid',
    note: 'Stretched sphere. Radii follow sx, sy, sz.',
    sliders: [
      { key: 'sx', label: 'Radius X', min: 0.6, max: 16, step: 0.1 },
      { key: 'sy', label: 'Radius Y', min: 0.6, max: 16, step: 0.1 },
      { key: 'sz', label: 'Radius Z', min: 0.6, max: 16, step: 0.1 },
    ],
  },
  {
    id: 'torus',
    label: 'Torus',
    note: 'Donut. Major radius r, tube thickness t, in the XZ plane.',
    sliders: [
      { key: 'radius', label: 'Major r', min: 1, max: 14, step: 0.1 },
      { key: 'thickness', label: 'Tube t', min: 0.25, max: 5, step: 0.05 },
    ],
  },
  {
    id: 'cylinder',
    label: 'Cylinder',
    note: 'Capped cylinder along local Y. Rotate to aim a tunnel.',
    sliders: [
      { key: 'radius', label: 'Radius r', min: 0.4, max: 12, step: 0.1 },
      { key: 'sy', label: 'Half-height', min: 0.4, max: 20, step: 0.1 },
    ],
  },
  {
    id: 'capsule',
    label: 'Capsule',
    note: 'Line segment with a sphere at each end, along local Y.',
    sliders: [
      { key: 'radius', label: 'Radius r', min: 0.4, max: 8, step: 0.1 },
      { key: 'sy', label: 'Half-length', min: 0.4, max: 16, step: 0.1 },
    ],
  },
  {
    id: 'cone',
    label: 'Cone',
    note: 'Capped cone along local Y, base radius r, height 2·sy.',
    sliders: [
      { key: 'radius', label: 'Base r', min: 0.4, max: 12, step: 0.1 },
      { key: 'sy', label: 'Half-height', min: 0.6, max: 16, step: 0.1 },
    ],
  },
  {
    id: 'octahedron',
    label: 'Octahedron',
    note: 'd = (|x|+|y|+|z| − s) / √3',
    sliders: [{ key: 'radius', label: 'Size s', min: 1, max: 16, step: 0.1 }],
  },
  {
    id: 'plane',
    label: 'Half-space',
    note: 'Infinite slab below local Y = 0. Rotate to clip at an angle.',
    sliders: [],
  },
  {
    id: 'gyroid',
    label: 'Gyroid',
    note: 'Periodic triply-implicit: |sin x cos y + …| − t. A density foam, not a closed solid.',
    sliders: [
      { key: 'frequency', label: 'Frequency', min: 0.12, max: 1.2, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'thickness', label: 'Thickness', min: 0.04, max: 0.85, step: 0.01, format: (v) => v.toFixed(2) },
    ],
  },
]

export function getDensityShape(id) {
  return DENSITY_SHAPES.find((item) => item.id === id) ?? DENSITY_SHAPES[0]
}

export function getCsgOp(id) {
  return CSG_OPS.find((item) => item.id === id) ?? CSG_OPS[0]
}

export function createSolid(overrides = {}) {
  return {
    name: 'Solid',
    shape: 'sphere',
    op: 'union',
    x: 0,
    y: 0,
    z: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    sx: 8,
    sy: 8,
    sz: 8,
    radius: 6,
    thickness: 1.4,
    round: 0.8,
    frequency: 0.35,
    smooth: 1.2,
    ...overrides,
  }
}

export function createDefaultSolids() {
  return [
    createSolid({
      name: 'Plinth',
      shape: 'box',
      op: 'union',
      y: -8,
      sx: 18,
      sy: 2,
      sz: 18,
    }),
    createSolid({
      name: 'Hill',
      shape: 'sphere',
      op: 'union',
      y: -1,
      radius: 8.5,
    }),
    createSolid({
      name: 'Crater',
      shape: 'sphere',
      op: 'subtract',
      x: 3.2,
      y: 4.5,
      z: -1.2,
      radius: 4.4,
    }),
    createSolid({
      name: 'Tunnel',
      shape: 'cylinder',
      op: 'subtract',
      y: -1.4,
      rz: 90,
      radius: 2.15,
      sy: 18,
    }),
    createSolid({
      name: 'Ring',
      shape: 'torus',
      op: 'smooth-union',
      y: 1.6,
      radius: 6.4,
      thickness: 1.25,
      smooth: 0.9,
    }),
  ]
}

function smin(a, b, k) {
  if (k <= 1e-6) return Math.min(a, b)
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

function smax(a, b, k) {
  return -smin(-a, -b, k)
}

function combineDensity(a, b, op, k) {
  switch (op) {
    case 'subtract':
      return Math.max(a, -b)
    case 'intersect':
      return Math.max(a, b)
    case 'xor': {
      const un = Math.min(a, b)
      const inn = Math.max(a, b)
      return Math.max(un, -inn)
    }
    case 'smooth-union':
      return smin(a, b, k)
    case 'smooth-subtract':
      return smax(a, -b, k)
    case 'smooth-intersect':
      return smax(a, b, k)
    case 'union':
    default:
      return Math.min(a, b)
  }
}

function toLocal(px, py, pz, solid) {
  let x = px - (solid.x ?? 0)
  let y = py - (solid.y ?? 0)
  let z = pz - (solid.z ?? 0)
  const ax = ((-(solid.rx ?? 0)) * Math.PI) / 180
  const ay = ((-(solid.ry ?? 0)) * Math.PI) / 180
  const az = ((-(solid.rz ?? 0)) * Math.PI) / 180
  if (ay) {
    const c = Math.cos(ay)
    const s = Math.sin(ay)
    const nx = x * c - z * s
    z = x * s + z * c
    x = nx
  }
  if (ax) {
    const c = Math.cos(ax)
    const s = Math.sin(ax)
    const ny = y * c - z * s
    z = y * s + z * c
    y = ny
  }
  if (az) {
    const c = Math.cos(az)
    const s = Math.sin(az)
    const nx = x * c - y * s
    y = x * s + y * c
    x = nx
  }
  return [x, y, z]
}

function sdBox(x, y, z, hx, hy, hz) {
  const qx = Math.abs(x) - hx
  const qy = Math.abs(y) - hy
  const qz = Math.abs(z) - hz
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  const oz = Math.max(qz, 0)
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, qy, qz), 0)
}

function sdCappedCylinder(x, y, z, h, r) {
  const dx = Math.hypot(x, z) - r
  const dy = Math.abs(y) - h
  const ox = Math.max(dx, 0)
  const oy = Math.max(dy, 0)
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(ox, oy)
}

function primitiveDensity(solid, px, py, pz) {
  const [x, y, z] = toLocal(px, py, pz, solid)
  const shape = solid.shape ?? 'sphere'
  const r = Math.max(0.05, solid.radius ?? 6)
  const sx = Math.max(0.05, solid.sx ?? 8)
  const sy = Math.max(0.05, solid.sy ?? 8)
  const sz = Math.max(0.05, solid.sz ?? 8)

  if (shape === 'box') return sdBox(x, y, z, sx * 0.5, sy * 0.5, sz * 0.5)
  if (shape === 'round-box') {
    const rnd = Math.min(solid.round ?? 0.8, sx * 0.45, sy * 0.45, sz * 0.45)
    return sdBox(x, y, z, sx * 0.5 - rnd, sy * 0.5 - rnd, sz * 0.5 - rnd) - rnd
  }
  if (shape === 'ellipsoid') {
    const nx = x / sx
    const ny = y / sy
    const nz = z / sz
    const len = Math.hypot(nx, ny, nz)
    if (len < 1e-8) return Math.min(sx, sy, sz) * -1
    const gx = nx / sx
    const gy = ny / sy
    const gz = nz / sz
    return (len - 1) * len / Math.hypot(gx, gy, gz)
  }
  if (shape === 'torus') {
    const tube = Math.max(0.05, solid.thickness ?? 1.4)
    const q = Math.hypot(x, z) - r
    return Math.hypot(q, y) - tube
  }
  if (shape === 'cylinder') return sdCappedCylinder(x, y, z, sy, r)
  if (shape === 'capsule') {
    const h = sy
    const yy = y < -h ? y + h : y > h ? y - h : 0
    return Math.hypot(x, yy, z) - r
  }
  if (shape === 'cone') {
    const h = sy
    const q = Math.hypot(x, z)
    const t = Math.min(Math.max((h - y) / (2 * h), 0), 1)
    return Math.max(q - r * t, Math.abs(y) - h)
  }
  if (shape === 'octahedron') {
    return (Math.abs(x) + Math.abs(y) + Math.abs(z) - r) * 0.57735027
  }
  if (shape === 'plane') return y
  if (shape === 'gyroid') {
    const f = solid.frequency ?? 0.35
    const t = solid.thickness ?? 0.2
    const g =
      Math.sin(x * f) * Math.cos(y * f) +
      Math.sin(y * f) * Math.cos(z * f) +
      Math.sin(z * f) * Math.cos(x * f)
    return Math.abs(g) - t
  }
  return Math.hypot(x, y, z) - r
}

export function getSolids(params) {
  const list = params?.csgSolids
  if (Array.isArray(list) && list.length) return list
  return createDefaultSolids()
}

export function sampleDensity(x, y, z, params) {
  const solids = getSolids(params)
  let d = 1e6
  for (let i = 0; i < solids.length; i++) {
    const solid = solids[i]
    const b = primitiveDensity(solid, x, y, z)
    const op = i === 0 ? 'union' : solid.op
    d = combineDensity(d, b, op, solid.smooth ?? 1.2)
  }
  return d
}

export function sampleDensityNormal(x, y, z, params, eps = 0.35) {
  const dx = sampleDensity(x + eps, y, z, params) - sampleDensity(x - eps, y, z, params)
  const dy = sampleDensity(x, y + eps, z, params) - sampleDensity(x, y - eps, z, params)
  const dz = sampleDensity(x, y, z + eps, params) - sampleDensity(x, y, z - eps, params)
  const len = Math.hypot(dx, dy, dz) || 1
  return [dx / len, dy / len, dz / len]
}

export function csgFingerprint(params) {
  const solids = getSolids(params)
  return solids
    .map((s) =>
      [
        s.shape,
        s.op,
        s.x,
        s.y,
        s.z,
        s.rx,
        s.ry,
        s.rz,
        s.sx,
        s.sy,
        s.sz,
        s.radius,
        s.thickness,
        s.round,
        s.frequency,
        s.smooth,
      ].join(','),
    )
    .join('|')
}

export function densityColor(nx, ny, nz, y, GRID) {
  const up = Math.max(0, ny)
  const cave = Math.max(0, -ny)
  const rock = 0.22 + 0.18 * cave
  const grass = 0.42 + 0.38 * up
  const elev = (y / GRID + 0.5) * 0.35
  return [
    Math.min(1, 0.22 + rock * 0.8 + 0.12 * (1 - up) + elev * 0.15),
    Math.min(1, 0.34 + grass * 0.55 + 0.08 * cave),
    Math.min(1, 0.18 + 0.16 * cave + 0.22 * (1 - up) + 0.12 * elev),
  ]
}
