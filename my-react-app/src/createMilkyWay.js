import * as THREE from 'three'

function randn() {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function makeGlowTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.85)')
  gradient.addColorStop(0.42, 'rgba(180,210,255,0.28)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

export function createStarfield(count = 5000, radius = 90) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = radius * (0.72 + Math.random() * 0.28)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)

    const tint = 0.75 + Math.random() * 0.25
    colors[i * 3] = tint
    colors[i * 3 + 1] = tint
    colors[i * 3 + 2] = 0.9 + Math.random() * 0.1
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

export function createMilkyWay(count = 32000) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  const arms = 4
  const maxRadius = 11
  const core = new THREE.Color(0xffe4a8)
  const armBlue = new THREE.Color(0xa8d4ff)
  const armRose = new THREE.Color(0xffb08a)
  const dust = new THREE.Color(0x3a2418)

  for (let i = 0; i < count; i++) {
    const roll = Math.random()
    let x
    let y
    let z
    const color = new THREE.Color()

    if (roll < 0.16) {
      x = randn() * 1.9
      y = randn() * 0.32
      z = randn() * 0.55
      color.copy(core).lerp(new THREE.Color(0xffc56e), Math.random() * 0.5)
    } else if (roll < 0.22) {
      const radius = Math.random() * maxRadius
      const angle = Math.random() * Math.PI * 2
      x = Math.cos(angle) * radius
      z = Math.sin(angle) * radius
      y = randn() * 0.08
      color.copy(dust)
    } else {
      const arm = i % arms
      const radius = Math.pow(Math.random(), 0.52) * maxRadius
      const wind = radius * 0.62
      const spread = (0.22 + radius / maxRadius) * 0.55
      const angle =
        (arm / arms) * Math.PI * 2 + wind + randn() * spread
      x = Math.cos(angle) * radius + randn() * 0.12
      z = Math.sin(angle) * radius + randn() * 0.12
      y = randn() * (0.14 * (1 - (radius / maxRadius) * 0.45))
      const mix = radius / maxRadius
      color.copy(armBlue).lerp(armRose, mix)
      if (radius < 2.8) {
        color.lerp(core, 1 - radius / 2.8)
      }
    }

    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}
