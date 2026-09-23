import { GRID_SIZE } from './noise.js'
import { densityColor, getSolids, sampleDensity } from './density.js'
import { TRI_CASES } from './marchTables.js'

export const CHUNK_CELLS = 8

export const MESH_MODES = [
  {
    id: 'cubes',
    label: 'Cubes',
    note: 'One quad per exposed face. Blocky, and the triangle count follows the surface area.',
  },
  {
    id: 'greedy',
    label: 'Greedy',
    note: 'Merges coplanar cube faces into larger quads. Fewer triangles. Merges stop at chunk borders.',
  },
  {
    id: 'marching',
    label: 'Marching',
    note: 'Marching cubes. Vertices sit on edges where density crosses zero, so the surface is smooth.',
  },
]

const CORNERS = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
]

const EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
]

const FACE_AXES = [
  { axis: 0, u: 1, v: 2 },
  { axis: 1, u: 2, v: 0 },
  { axis: 2, u: 0, v: 1 },
]

export function getMeshMode(id) {
  return MESH_MODES.find((item) => item.id === id) ?? MESH_MODES[2]
}

export function fieldLipschitz(params) {
  let lip = 1.2
  for (const solid of getSolids(params)) {
    if (solid.shape === 'gyroid') lip = Math.max(lip, (solid.frequency ?? 0.35) * 2.4)
  }
  return lip
}

class MeshBag {
  constructor() {
    this.pos = []
    this.nrm = []
    this.col = []
  }

  tri(p0, p1, p2, n0, n1, n2) {
    const points = [p0, p1, p2]
    const norms = [n0, n1, n2]
    for (let i = 0; i < 3; i++) {
      const p = points[i]
      const n = norms[i]
      const [r, g, b] = densityColor(n[0], n[1], n[2], p[1], GRID_SIZE)
      this.pos.push(p[0], p[1], p[2])
      this.nrm.push(n[0], n[1], n[2])
      this.col.push(r, g, b)
    }
  }

  quad(p0, p1, p2, p3, normal) {
    this.tri(p0, p1, p2, normal, normal, normal)
    this.tri(p0, p2, p3, normal, normal, normal)
  }

  finish() {
    return {
      positions: Float32Array.from(this.pos),
      normals: Float32Array.from(this.nrm),
      colors: Float32Array.from(this.col),
      triangles: this.pos.length / 9,
    }
  }
}

function marchChunk(bag, i0, i1, j0, j1, k0, k1, size, half, params) {
  const nx = i1 - i0 + 1
  const ny = j1 - j0 + 1
  const nz = k1 - k0 + 1
  const field = new Float32Array(nx * ny * nz)
  const at = (x, y, z) => x + nx * (y + ny * z)
  let samples = 0

  for (let z = 0; z < nz; z++) {
    const wz = -half + (k0 + z) * size
    for (let y = 0; y < ny; y++) {
      const wy = -half + (j0 + y) * size
      for (let x = 0; x < nx; x++) {
        field[at(x, y, z)] = sampleDensity(-half + (i0 + x) * size, wy, wz, params)
        samples++
      }
    }
  }

  const gradAt = (x, y, z) => {
    const d = field[at(x, y, z)]
    const dx = (x + 1 < nx ? field[at(x + 1, y, z)] : d) - (x > 0 ? field[at(x - 1, y, z)] : d)
    const dy = (y + 1 < ny ? field[at(x, y + 1, z)] : d) - (y > 0 ? field[at(x, y - 1, z)] : d)
    const dz = (z + 1 < nz ? field[at(x, y, z + 1)] : d) - (z > 0 ? field[at(x, y, z - 1)] : d)
    return [dx, dy, dz]
  }

  for (let z = 0; z < nz - 1; z++) {
    for (let y = 0; y < ny - 1; y++) {
      for (let x = 0; x < nx - 1; x++) {
        let cube = 0
        const val = new Array(8)
        const grad = new Array(8)
        for (let i = 0; i < 8; i++) {
          const corner = CORNERS[i]
          const cx = x + corner[0]
          const cy = y + corner[1]
          const cz = z + corner[2]
          const d = field[at(cx, cy, cz)]
          val[i] = d
          grad[i] = gradAt(cx, cy, cz)
          if (d < 0) cube |= 1 << i
        }
        const edges = TRI_CASES[cube]
        if (!edges || edges.length < 3) continue
        const vert = new Array(12)
        const norm = new Array(12)
        const edgePoint = (e) => {
          if (vert[e]) return
          const [a, b] = EDGES[e]
          const da = val[a]
          const db = val[b]
          let t = 0.5
          const den = da - db
          if (Math.abs(den) > 1e-8) t = da / den
          if (t < 0) t = 0
          else if (t > 1) t = 1
          const pa = CORNERS[a]
          const pb = CORNERS[b]
          vert[e] = [
            -half + (i0 + x + pa[0] + t * (pb[0] - pa[0])) * size,
            -half + (j0 + y + pa[1] + t * (pb[1] - pa[1])) * size,
            -half + (k0 + z + pa[2] + t * (pb[2] - pa[2])) * size,
          ]
          const ga = grad[a]
          const gb = grad[b]
          const nxv = ga[0] + t * (gb[0] - ga[0])
          const nyv = ga[1] + t * (gb[1] - ga[1])
          const nzv = ga[2] + t * (gb[2] - ga[2])
          const len = Math.hypot(nxv, nyv, nzv) || 1
          norm[e] = [nxv / len, nyv / len, nzv / len]
        }
        for (let i = 0; i < edges.length; i += 3) {
          const e0 = edges[i]
          const e1 = edges[i + 1]
          const e2 = edges[i + 2]
          edgePoint(e0)
          edgePoint(e1)
          edgePoint(e2)
          bag.tri(vert[e0], vert[e2], vert[e1], norm[e0], norm[e2], norm[e1])
        }
      }
    }
  }
  return samples
}

function sampleOccupancy(cells, i0, i1, j0, j1, k0, k1, size, half, params) {
  const x0 = Math.max(0, i0 - 1)
  const y0 = Math.max(0, j0 - 1)
  const z0 = Math.max(0, k0 - 1)
  const x1 = Math.min(cells, i1 + 1)
  const y1 = Math.min(cells, j1 + 1)
  const z1 = Math.min(cells, k1 + 1)
  const nx = x1 - x0
  const ny = y1 - y0
  const nz = z1 - z0
  const solid = new Uint8Array(nx * ny * nz)
  let samples = 0
  const at = (x, y, z) => x + nx * (y + ny * z)

  for (let z = 0; z < nz; z++) {
    const wz = -half + (z0 + z + 0.5) * size
    for (let y = 0; y < ny; y++) {
      const wy = -half + (y0 + y + 0.5) * size
      for (let x = 0; x < nx; x++) {
        const wx = -half + (x0 + x + 0.5) * size
        solid[at(x, y, z)] = sampleDensity(wx, wy, wz, params) < 0 ? 1 : 0
        samples++
      }
    }
  }

  const isSolid = (i, j, k) => {
    if (i < 0 || j < 0 || k < 0 || i >= cells || j >= cells || k >= cells) return 0
    const x = i - x0
    const y = j - y0
    const z = k - z0
    if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) return 0
    return solid[at(x, y, z)]
  }
  return { isSolid, samples }
}

function takeRects(mask, w, h, merge) {
  const used = mask.slice()
  const rects = []
  for (let v = 0; v < h; v++) {
    for (let u = 0; u < w; u++) {
      const val = used[u + v * w]
      if (!val) continue
      let uw = 1
      let vh = 1
      if (merge) {
        while (u + uw < w && used[u + uw + v * w] === val) uw++
        let grew = true
        while (grew && v + vh < h) {
          for (let uu = 0; uu < uw; uu++) {
            if (used[u + uu + (v + vh) * w] !== val) {
              grew = false
              break
            }
          }
          if (grew) vh++
        }
      }
      for (let vv = 0; vv < vh; vv++) {
        for (let uu = 0; uu < uw; uu++) used[u + uu + (v + vv) * w] = 0
      }
      rects.push({ u, v, uw, vh })
    }
  }
  return rects
}

function faceChunk(bag, merge, cells, i0, i1, j0, j1, k0, k1, size, half, params) {
  const { isSolid, samples } = sampleOccupancy(cells, i0, i1, j0, j1, k0, k1, size, half, params)
  const origin = [i0, j0, k0]
  const span = [i1 - i0, j1 - j0, k1 - k0]

  for (const face of FACE_AXES) {
    const { axis, u, v } = face
    const q0 = origin[axis]
    const q1 = q0 + span[axis]
    const u0 = origin[u]
    const v0 = origin[v]
    const un = span[u]
    const vn = span[v]

    for (const sign of [1, -1]) {
      for (let q = q0; q < q1; q++) {
        const mask = new Int8Array(un * vn)
        for (let iu = 0; iu < un; iu++) {
          for (let iv = 0; iv < vn; iv++) {
            const idx = [0, 0, 0]
            idx[axis] = q
            idx[u] = u0 + iu
            idx[v] = v0 + iv
            const neighbor = [idx[0], idx[1], idx[2]]
            neighbor[axis] = q + sign
            if (isSolid(idx[0], idx[1], idx[2]) && !isSolid(neighbor[0], neighbor[1], neighbor[2])) {
              mask[iu + iv * un] = 1
            }
          }
        }
        const rects = takeRects(mask, un, vn, merge)
        const plane = sign > 0 ? q + 1 : q
        const w = -half + plane * size
        for (const rect of rects) {
          const corner = (iu, iv) => {
            const p = [0, 0, 0]
            p[axis] = w
            p[u] = -half + (u0 + rect.u + iu) * size
            p[v] = -half + (v0 + rect.v + iv) * size
            return p
          }
          const p0 = corner(0, 0)
          const p1 = sign > 0 ? corner(rect.uw, 0) : corner(0, rect.vh)
          const p2 = corner(rect.uw, rect.vh)
          const p3 = sign > 0 ? corner(0, rect.vh) : corner(rect.uw, 0)
          const normal = [0, 0, 0]
          normal[axis] = sign
          bag.quad(p0, p1, p2, p3, normal)
        }
      }
    }
  }
  return samples
}

export function buildVolume(params) {
  const t0 = performance.now()
  const mode = getMeshMode(params?.meshMode).id
  const cells = Math.max(12, Math.min(40, Math.round(params?.csgCells ?? 28)))
  const size = GRID_SIZE / cells
  const half = GRID_SIZE / 2
  const lip = fieldLipschitz(params)
  const bag = new MeshBag()
  let chunksTotal = 0
  let chunksLive = 0
  let samples = 0
  const chunks = Math.ceil(cells / CHUNK_CELLS)

  for (let cz = 0; cz < chunks; cz++) {
    for (let cy = 0; cy < chunks; cy++) {
      for (let cx = 0; cx < chunks; cx++) {
        chunksTotal++
        const i0 = cx * CHUNK_CELLS
        const j0 = cy * CHUNK_CELLS
        const k0 = cz * CHUNK_CELLS
        const i1 = Math.min(cells, i0 + CHUNK_CELLS)
        const j1 = Math.min(cells, j0 + CHUNK_CELLS)
        const k1 = Math.min(cells, k0 + CHUNK_CELLS)
        const x0 = -half + i0 * size
        const y0 = -half + j0 * size
        const z0 = -half + k0 * size
        const x1 = -half + i1 * size
        const y1 = -half + j1 * size
        const z1 = -half + k1 * size
        const halfDiag = 0.5 * Math.hypot(x1 - x0, y1 - y0, z1 - z0)
        samples++
        const d = sampleDensity((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, params)
        if (Math.abs(d) > halfDiag * lip + size * 0.5) continue
        chunksLive++
        if (mode === 'marching') {
          samples += marchChunk(bag, i0, i1, j0, j1, k0, k1, size, half, params)
        } else {
          samples += faceChunk(bag, mode === 'greedy', cells, i0, i1, j0, j1, k0, k1, size, half, params)
        }
      }
    }
  }

  const mesh = bag.finish()
  return {
    mode,
    cells,
    chunkCells: CHUNK_CELLS,
    chunksTotal,
    chunksLive,
    samples,
    fullSamples: mode === 'marching' ? (cells + 1) ** 3 : cells ** 3,
    triangles: mesh.triangles,
    positions: mesh.positions,
    normals: mesh.normals,
    colors: mesh.colors,
    ms: Math.max(1, Math.round(performance.now() - t0)),
  }
}
