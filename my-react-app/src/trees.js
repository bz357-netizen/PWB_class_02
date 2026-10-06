import * as THREE from 'three'

export const TREE_KINDS = [
  { id: 'tall', label: 'Tall', note: 'Low sheltered ground' },
  { id: 'medium', label: 'Medium', note: 'Middle slopes' },
  { id: 'short', label: 'Short', note: 'High ground' },
]

export function blankParts() {
  return { positions: [], normals: [], colors: [], wind: [], indices: [] }
}

export function consume(target, geometry, color, tip) {
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

export function pack(target) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(target.positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(target.normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(target.colors, 3))
  geometry.setAttribute('wind', new THREE.Float32BufferAttribute(target.wind, 1))
  geometry.setIndex(target.indices)
  geometry.computeBoundingSphere()
  return geometry
}

export function place(geometry, y) {
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
