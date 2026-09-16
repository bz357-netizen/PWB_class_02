import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createStarfield, makeGlowTexture } from './createMilkyWay.js'
import {
  GRID_SIZE,
  landColor,
  noiseFingerprint,
  sampleHeight,
} from './noise.js'
import { getDaylight } from './daylight.js'

const MAX_STACK = 24
const RELIEF = 18

function voxelKey(params) {
  return `${noiseFingerprint(params)}|${Math.round(params.voxelCells ?? 48)}`
}

function writeVoxels(mesh, dummy, color, params) {
  const cells = Math.max(8, Math.min(64, Math.round(params.voxelCells ?? 48)))
  const size = GRID_SIZE / cells
  const raw = new Float32Array(cells * cells)
  let hMin = Infinity
  let hMax = -Infinity

  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const x = -GRID_SIZE / 2 + (i + 0.5) * size
      const z = -GRID_SIZE / 2 + (j + 0.5) * size
      const h = sampleHeight(x, z, params)
      raw[j * cells + i] = h
      if (h < hMin) hMin = h
      if (h > hMax) hMax = h
    }
  }

  const smooth = new Float32Array(cells * cells)
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      let sum = 0
      let weight = 0
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = i + di
          const jj = j + dj
          if (ii < 0 || jj < 0 || ii >= cells || jj >= cells) continue
          const w = di === 0 && dj === 0 ? 4 : 1
          sum += raw[jj * cells + ii] * w
          weight += w
        }
      }
      smooth[j * cells + i] = sum / weight
    }
  }

  const range = hMax - hMin || 1
  const heights = new Int16Array(cells * cells)
  for (let k = 0; k < smooth.length; k++) {
    const t = (smooth[k] - hMin) / range
    const ridge = t * t * (3 - 2 * t)
    const land = Math.pow(ridge, 0.68)
    heights[k] = Math.max(1, Math.min(MAX_STACK, 1 + Math.round(land * RELIEF)))
  }

  let n = 0
  const maxCount = mesh.instanceMatrix.count
  const gap = size * 0.98

  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const stacks = heights[j * cells + i]
      const x = -GRID_SIZE / 2 + (i + 0.5) * size
      const z = -GRID_SIZE / 2 + (j + 0.5) * size
      const east = i < cells - 1 ? heights[j * cells + i + 1] : 0
      const west = i > 0 ? heights[j * cells + i - 1] : 0
      const north = j < cells - 1 ? heights[(j + 1) * cells + i] : 0
      const south = j > 0 ? heights[(j - 1) * cells + i] : 0
      const slope = Math.min(1, Math.abs(east - west) * 0.22 + Math.abs(north - south) * 0.22)
      const landT = (stacks - 1) / RELIEF

      for (let y = 0; y < stacks; y++) {
        const buried =
          y < stacks - 1 && east > y + 1 && west > y + 1 && north > y + 1 && south > y + 1
        if (buried) continue
        if (n >= maxCount) break

        dummy.position.set(x, (y + 0.5) * size, z)
        dummy.scale.set(gap, size, gap)
        dummy.updateMatrix()
        mesh.setMatrixAt(n, dummy.matrix)

        const isTop = y >= stacks - 1
        const [r, g, b] = landColor(landT, slope, x, z)
        const cliff = [0.18, 0.36, 0.2]
        const soil = [0.42, 0.36, 0.22]
        let cr = r
        let cg = g
        let cb = b
        if (!isTop) {
          const depth = 1 - y / Math.max(1, stacks - 1)
          cr = r * (1 - depth * 0.55) + cliff[0] * depth * 0.7 + soil[0] * depth * 0.3
          cg = g * (1 - depth * 0.55) + cliff[1] * depth * 0.7 + soil[1] * depth * 0.3
          cb = b * (1 - depth * 0.55) + cliff[2] * depth * 0.7 + soil[2] * depth * 0.3
        }
        const shade = isTop ? 1 : 0.72 + 0.2 * (y / Math.max(1, stacks))
        color.setRGB(cr * shade, cg * shade, cb * shade)
        mesh.setColorAt(n, color)
        n++
      }
    }
  }

  mesh.count = n
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

export default function VoxelCanvas({ paramsRef }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0xeef6ec, 0.005)

    const camera = new THREE.PerspectiveCamera(48, 1, 0.4, 400)
    camera.position.set(0, 28, 54)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0xeef6ec, 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.98
    renderer.shadowMap.enabled = false
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.target.set(0, 4, 0)
    controls.minDistance = 18
    controls.maxDistance = 120
    controls.maxPolarAngle = Math.PI * 0.92
    controls.rotateSpeed = 0.7
    controls.zoomSpeed = 0.85

    const hemi = new THREE.HemisphereLight(0xf4faf2, 0x5e9a58, 0.72)
    scene.add(hemi)
    const ambient = new THREE.AmbientLight(0xdcefd4, 0.4)
    scene.add(ambient)
    const bounce = new THREE.DirectionalLight(0xcfe8c8, 0.32)
    bounce.position.set(-16, 10, -12)
    scene.add(bounce)
    const sun = new THREE.DirectionalLight(0xfff1c2, 1.6)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.radius = 4
    sun.shadow.blurSamples = 8
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 90
    sun.shadow.camera.left = -32
    sun.shadow.camera.right = 32
    sun.shadow.camera.top = 32
    sun.shadow.camera.bottom = -32
    sun.shadow.bias = -0.0003
    sun.shadow.normalBias = 0.04
    sun.position.set(18, 28, 10)
    scene.add(sun)
    scene.add(sun.target)

    const glowMap = makeGlowTexture()
    const fieldGeom = createStarfield()
    const fieldMat = new THREE.PointsMaterial({
      size: 0.12,
      map: glowMap,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      opacity: 0.2,
    })
    const starfield = new THREE.Points(fieldGeom, fieldMat)
    scene.add(starfield)

    const rainCount = 900
    const rainPos = new Float32Array(rainCount * 3)
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * GRID_SIZE
      rainPos[i * 3 + 1] = Math.random() * 22
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * GRID_SIZE
    }
    const rainGeom = new THREE.BufferGeometry()
    rainGeom.setAttribute('position', new THREE.BufferAttribute(rainPos, 3))
    const rainMat = new THREE.PointsMaterial({
      color: 0xb7c8d8,
      size: 0.07,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
    const rain = new THREE.Points(rainGeom, rainMat)
    rain.visible = false
    scene.add(rain)

    const boxGeom = new THREE.BoxGeometry(1, 1, 1)
    const voxelMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      fog: true,
    })
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0x2f6b38,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
      fog: false,
    })
    const maxCount = 64 * 64 * MAX_STACK
    const voxels = new THREE.InstancedMesh(boxGeom, voxelMat, maxCount)
    voxels.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    voxels.castShadow = false
    voxels.receiveShadow = false
    voxels.frustumCulled = false
    scene.add(voxels)
    const voxelLines = new THREE.InstancedMesh(boxGeom, lineMat, maxCount)
    voxelLines.instanceMatrix = voxels.instanceMatrix
    voxelLines.frustumCulled = false
    voxelLines.visible = false
    scene.add(voxelLines)

    const dummy = new THREE.Object3D()
    const tint = new THREE.Color()
    writeVoxels(voxels, dummy, tint, paramsRef.current)
    voxelLines.count = voxels.count
    let lastKey = voxelKey(paramsRef.current)

    const applyEnvironment = (params, now) => {
      const weather = params.weather ?? 'clear'
      const day = getDaylight(params.timeOfDay ?? 12, weather)
      sun.position.copy(day.sunDir).multiplyScalar(36)
      sun.color.copy(day.sunColor)
      sun.intensity = day.sunIntensity
      sun.castShadow = day.shadow
      ambient.intensity = day.ambient
      hemi.intensity = day.hemi
      hemi.color.copy(day.sky).lerp(new THREE.Color(0xffffff), 0.45)
      hemi.groundColor.set(0x5e9a58)
      bounce.intensity = day.ambient * 0.85
      bounce.color.copy(day.sky).lerp(new THREE.Color(0xe8f4dc), 0.2)
      scene.fog.color.copy(day.sky)
      scene.fog.density = day.fogDensity
      renderer.setClearColor(day.sky, 1)
      fieldMat.opacity = day.starOpacity
      starfield.visible = day.starOpacity > 0.04
      rain.visible = day.rain
      if (day.storm && Math.sin(now * 0.008) > 0.992) {
        ambient.intensity += 1.4
        hemi.intensity += 1.1
      }
    }

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    resize()
    window.addEventListener('resize', resize)

    let frameId = 0
    const animate = () => {
      const params = paramsRef.current
      const nextKey = voxelKey(params)
      if (nextKey !== lastKey) {
        lastKey = nextKey
        writeVoxels(voxels, dummy, tint, params)
        voxelLines.count = voxels.count
      }
      const filled = params.showMesh !== false
      voxels.visible = filled
      voxelLines.visible = !filled

      applyEnvironment(params, performance.now())

      if (rain.visible) {
        const pos = rainGeom.attributes.position
        const storm = params.weather === 'storm'
        const fall = storm ? 0.42 : 0.28
        for (let i = 0; i < pos.count; i++) {
          let y = pos.getY(i) - fall
          if (y < 0) y = 18 + Math.random() * 6
          pos.setY(i, y)
          pos.setX(i, pos.getX(i) + (storm ? -0.04 : -0.015))
          if (pos.getX(i) < -GRID_SIZE / 2) pos.setX(i, GRID_SIZE / 2)
        }
        pos.needsUpdate = true
      }

      controls.update()
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      controls.dispose()
      fieldGeom.dispose()
      fieldMat.dispose()
      glowMap.dispose()
      rainGeom.dispose()
      rainMat.dispose()
      boxGeom.dispose()
      voxelMat.dispose()
      lineMat.dispose()
      voxels.dispose()
      voxelLines.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [paramsRef])

  return <div className="galaxy-canvas" ref={mountRef} />
}
