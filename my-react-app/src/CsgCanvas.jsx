import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createStarfield, makeGlowTexture } from './createMilkyWay.js'
import { GRID_SIZE } from './noise.js'
import { getDaylight } from './daylight.js'
import { csgFingerprint } from './density.js'
import { buildVolume } from './meshing.js'

function csgKey(params) {
  return `${csgFingerprint(params)}|${Math.round(params.csgCells ?? 28)}|${params.meshMode ?? 'marching'}`
}

function applyBuilt(geom, built) {
  const positions = built.positions.length ? built.positions : new Float32Array(3)
  const normals = built.normals.length ? built.normals : new Float32Array([0, 1, 0])
  const colors = built.colors.length ? built.colors : new Float32Array([1, 1, 1])
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geom.computeBoundingSphere()
}

export default function CsgCanvas({ paramsRef, onStats }) {
  const mountRef = useRef(null)
  const onStatsRef = useRef(onStats)
  onStatsRef.current = onStats

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0xeef6ec, 0.008)

    const camera = new THREE.PerspectiveCamera(48, 1, 0.4, 400)
    camera.position.set(18, 16, 36)

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
    controls.target.set(0, -1, 0)
    controls.minDistance = 12
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
    sun.position.set(18, 28, 10)
    scene.add(sun)

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

    const rainCount = 700
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

    const geom = new THREE.BufferGeometry()
    const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: true })
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0x2f6b38,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
      fog: false,
    })
    const solidMesh = new THREE.Mesh(geom, solidMat)
    const wireMesh = new THREE.Mesh(geom, lineMat)
    solidMesh.frustumCulled = false
    wireMesh.frustumCulled = false
    scene.add(solidMesh)
    scene.add(wireMesh)

    const publish = (params) => {
      const built = buildVolume(params)
      applyBuilt(geom, built)
      onStatsRef.current?.({
        mode: built.mode,
        cells: built.cells,
        chunkCells: built.chunkCells,
        chunksTotal: built.chunksTotal,
        chunksLive: built.chunksLive,
        samples: built.samples,
        fullSamples: built.fullSamples,
        triangles: built.triangles,
        ms: built.ms,
      })
      return built.triangles
    }
    publish(paramsRef.current)
    let lastKey = csgKey(paramsRef.current)

    const applyEnvironment = (params, now) => {
      const weather = params.weather ?? 'clear'
      const day = getDaylight(params.timeOfDay ?? 12, weather)
      sun.position.copy(day.sunDir).multiplyScalar(36)
      sun.color.copy(day.sunColor)
      sun.intensity = day.sunIntensity
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
      const nextKey = csgKey(params)
      if (nextKey !== lastKey) {
        lastKey = nextKey
        publish(params)
      }
      const filled = params.showMesh !== false
      const hasSurface = (geom.getAttribute('position')?.count ?? 0) > 1
      solidMesh.visible = filled && hasSurface
      wireMesh.visible = !filled && hasSurface
      applyEnvironment(params, performance.now())

      if (rain.visible) {
        const pos = rainGeom.attributes.position
        const storm = params.weather === 'storm'
        const fall = storm ? 0.42 : 0.28
        for (let i = 0; i < pos.count; i++) {
          let y = pos.getY(i) - fall
          if (y < -8) y = 18 + Math.random() * 6
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
      geom.dispose()
      solidMat.dispose()
      lineMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [paramsRef])

  return <div className="galaxy-canvas" ref={mountRef} />
}
