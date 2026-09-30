import * as THREE from 'three'
import { GRID_SIZE, perlin2 } from './noise.js'

export const TREE_KINDS = [
  { id: 'tall', label: 'Tall', note: 'Low sheltered ground' },
  { id: 'medium', label: 'Medium', note: 'Middle slopes' },
  { id: 'short', label: 'Short', note: 'High ground' },
]

const MAX_TREES = 4200

function hash01(ix, iz) {
  let n = Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263)
  n = (n ^ (n >>> 13)) >>> 0
  n = Math.imul(n, 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

function blankParts() {
  return { positions: [], normals: [], colors: [], wind: [], indices: [] }
}

function consume(target, geometry, color, tip) {
  const pos = geometry.attributes.position
  const nrm = geometry.attributes.normal
  const index = geometry.index
  const base = target.positions.length / 3
  const tint = new THREE.Color(color)
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    n.fromBufferAttribute(nrm, i)
    const wind = Math.min(1, Math.max(0, p.y / tip) ** 1.35)
    target.positions.push(p.x, p.y, p.z)
    target.normals.push(n.x, n.y, n.z)
    target.colors.push(tint.r, tint.g, tint.b)
    target.wind.push(wind)
  }
  if (index) {
    for (let i = 0; i < index.count; i++) target.indices.push(base + index.getX(i))
  } else {
    for (let i = 0; i < pos.count; i++) target.indices.push(base + i)
  }
  geometry.dispose()
}

function pack(target) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(target.positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(target.normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(target.colors, 3))
  geometry.setAttribute('wind', new THREE.Float32BufferAttribute(target.wind, 1))
  geometry.setIndex(target.indices)
  geometry.computeBoundingSphere()
  return geometry
}

function place(geometry, y) {
  geometry.translate(0, y, 0)
  return geometry
}

export function createTreeGeometries() {
  const trunk = 0x5c4634

  const tall = blankParts()
  consume(tall, place(new THREE.CylinderGeometry(0.045, 0.09, 1.55, 5, 1), 0.775), trunk, 3.85)
  consume(tall, place(new THREE.ConeGeometry(0.92, 1.65, 7, 1), 1.72), 0x1d6432, 3.85)
  consume(tall, place(new THREE.ConeGeometry(0.68, 1.4, 7, 1), 2.5), 0x24743a, 3.85)
  consume(tall, place(new THREE.ConeGeometry(0.38, 1.0, 6, 1), 3.22), 0x2e8444, 3.85)

  const medium = blankParts()
  consume(medium, place(new THREE.CylinderGeometry(0.05, 0.08, 0.78, 5, 1), 0.39), trunk, 2.15)
  const crown = new THREE.IcosahedronGeometry(0.62, 0)
  crown.scale(1, 0.82, 1)
  consume(medium, place(crown, 1.28), 0x3c7c34, 2.15)
  const crownB = new THREE.IcosahedronGeometry(0.4, 0)
  crownB.scale(1.05, 0.75, 0.95)
  consume(medium, place(crownB, 1.55), 0x4d8c3c, 2.15)
  const crownC = new THREE.IcosahedronGeometry(0.34, 0)
  consume(medium, place(crownC, 1.12).translate(0.34, 0, 0.12), 0x356e30, 2.15)

  const short = blankParts()
  consume(short, place(new THREE.CylinderGeometry(0.035, 0.05, 0.28, 5, 1), 0.14), trunk, 1.05)
  consume(short, place(new THREE.ConeGeometry(0.46, 0.62, 6, 1), 0.48), 0x6c8f3c, 1.05)
  consume(short, place(new THREE.ConeGeometry(0.28, 0.42, 5, 1), 0.78), 0x86a64a, 1.05)

  return {
    tall: pack(tall),
    medium: pack(medium),
    short: pack(short),
  }
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

export function emptyScatter() {
  return { tall: [], medium: [], short: [] }
}

/** Place three heights on gentle ground. Low land grows tall trees, high land grows short ones. */
export function scatterTrees(geometry, cover) {
  const amount = THREE.MathUtils.clamp(cover ?? 0, 0, 1)
  if (amount <= 0.001) return emptyScatter()

  const heightAt = meshSampler(geometry)
  const spacing = THREE.MathUtils.lerp(2.15, 0.58, amount)
  const clear = THREE.MathUtils.lerp(0.22, -0.35, amount)
  const half = GRID_SIZE * 0.5 - 0.7
  const candidates = []
  let row = 0

  for (let z = -half; z <= half; z += spacing) {
    const stagger = (row % 2) * spacing * 0.5
    let col = 0
    for (let x = -half + stagger; x <= half; x += spacing) {
      const jx = (hash01(row + 3, col) - 0.5) * spacing * 0.78
      const jz = (hash01(col + 11, row) - 0.5) * spacing * 0.78
      const px = x + jx
      const pz = z + jz
      const y = heightAt(px, pz)
      const yx = heightAt(px + 0.5, pz)
      const yz = heightAt(px, pz + 0.5)
      col += 1
      if (y == null || yx == null || yz == null) continue
      const slope = Math.hypot(yx - y, yz - y) / 0.5
      if (slope > 0.46) continue
      const mask = perlin2(px * 0.075, pz * 0.075) * 0.72 + perlin2(px * 0.21 + 2.4, pz * 0.21 - 1.7) * 0.28
      if (mask < clear) continue
      candidates.push({ x: px, y, z: pz, slope })
    }
    row += 1
  }

  if (!candidates.length) return emptyScatter()

  let list = candidates
  if (list.length > MAX_TREES) {
    const step = list.length / MAX_TREES
    const trimmed = []
    for (let i = 0; i < MAX_TREES; i++) trimmed.push(list[Math.floor(i * step)])
    list = trimmed
  }

  const ranked = [...list].sort((a, b) => a.y - b.y)
  const out = emptyScatter()
  for (let i = 0; i < ranked.length; i++) {
    const item = ranked[i]
    const rank = i / ranked.length
    const wobble = perlin2(item.x * 0.17 + 6.5, item.z * 0.17) * 0.07
    const band = THREE.MathUtils.clamp(rank + wobble, 0, 0.999)
    const kind = band < 1 / 3 ? 'tall' : band < 2 / 3 ? 'medium' : 'short'
    const h = hash01(Math.round(item.x * 17), Math.round(item.z * 17))
    const base = kind === 'tall' ? 0.88 : kind === 'medium' ? 0.86 : 0.78
    const slopeScale = 1 - THREE.MathUtils.clamp(item.slope / 0.46, 0, 1) * 0.22
    out[kind].push({
      x: item.x,
      y: item.y,
      z: item.z,
      rot: h * Math.PI * 2,
      scale: (base + h * (kind === 'short' ? 0.42 : 0.48)) * slopeScale,
      tint: 0.84 + h * 0.28,
    })
  }
  return out
}

export function createTreeMaterial(timeUniform, waterUniform, submergeUniform, extra) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0,
    fog: true,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform
    shader.uniforms.uWater = waterUniform
    shader.uniforms.uSubmerge = submergeUniform
    shader.uniforms.uErode = extra.erode
    shader.uniforms.uUnknown = extra.unknown
    shader.uniforms.uLow = extra.low
    shader.uniforms.uHigh = extra.high
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float wind;
         uniform float uTime;
         varying float vTreeY;
         varying vec2 vTreeXZ;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float phase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;
         float sway = sin(uTime * 1.15 + phase) * 0.055;
         sway += sin(uTime * 2.35 + phase * 1.7) * 0.02;
         transformed.x += sway * wind;
         transformed.z += cos(uTime * 0.85 + phase) * 0.045 * wind;
         vec4 treeWorld = instanceMatrix * vec4(transformed, 1.0);
         vTreeY = treeWorld.y;
         vTreeXZ = treeWorld.xz;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uWater;
         uniform float uSubmerge;
         uniform float uErode;
         uniform float uUnknown;
         uniform float uLow;
         uniform float uHigh;
         uniform float uTime;
         varying float vTreeY;
         varying vec2 vTreeXZ;
         float unkHash(vec2 p) {
           return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
         }
         float unkNoise(vec2 p) {
           vec2 i = floor(p);
           vec2 f = fract(p);
           f = f * f * (3.0 - 2.0 * f);
           float a = unkHash(i);
           float b = unkHash(i + vec2(1.0, 0.0));
           float c = unkHash(i + vec2(0.0, 1.0));
           float d = unkHash(i + vec2(1.0, 1.0));
           return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
         }`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
         if (uSubmerge > 0.5 && vTreeY < uWater) discard;
         if (uUnknown > 0.5) {
           float h = clamp((vTreeY - uLow) / max(0.001, uHigh - uLow), 0.0, 1.0);
           float field = unkNoise(vTreeXZ * 0.065 + uTime * 0.025);
           field += 0.45 * unkNoise(vTreeXZ * 0.15 - uTime * 0.02);
           float climb = h * 0.7 + (1.0 - field) * 0.3;
           float eaten = 1.0 - smoothstep(uErode - 0.1, uErode + 0.14, climb);
           float bits = unkHash(floor(gl_FragCoord.xy * 0.35) + floor(uTime * 10.0));
           if (eaten > 0.4 && bits < eaten) discard;
         }`,
      )
  }
  material.customProgramCacheKey = () => 'tree-wind-v2'
  return material
}
