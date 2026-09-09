import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createStarfield, makeGlowTexture } from './createMilkyWay.js'
import { GRID_SIZE, applyNoiseToGrid, noiseFingerprint } from './noise.js'
import { getDaylight } from './daylight.js'
import { applyEventToGrid } from './eventSim.js'

export default function GalaxyCanvas({ paramsRef }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x6f8496, 0.01)

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200)
    camera.position.set(0, 14, 22)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x6f8496, 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.target.set(0, 0, 0)
    controls.minDistance = 4
    controls.maxDistance = 48
    controls.maxPolarAngle = Math.PI * 0.92
    controls.rotateSpeed = 0.7
    controls.zoomSpeed = 0.85

    const hemi = new THREE.HemisphereLight(0xb8c8d8, 0x2a241c, 0.5)
    scene.add(hemi)
    const ambient = new THREE.AmbientLight(0x8899aa, 0.22)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xfff1c2, 1.6)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 90
    sun.shadow.camera.left = -32
    sun.shadow.camera.right = 32
    sun.shadow.camera.top = 32
    sun.shadow.camera.bottom = -32
    sun.shadow.bias = -0.0008
    sun.position.set(18, 28, 10)
    scene.add(sun)
    scene.add(sun.target)
    sun.target.position.set(0, 0, 0)

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

    const rainCount = 1200
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

    const createGridGeometry = (segments) => {
      const segs = Math.max(2, Math.round(segments))
      const geometry = new THREE.PlaneGeometry(
        GRID_SIZE,
        GRID_SIZE,
        segs,
        segs,
      )
      geometry.rotateX(-Math.PI / 2)
      const colors = new Float32Array(geometry.attributes.position.count * 3)
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      return geometry
    }

    let gridGeom = createGridGeometry(paramsRef.current.resolution ?? 300)
    applyNoiseToGrid(gridGeom, paramsRef.current)
    let lastSegments = Math.max(2, Math.round(paramsRef.current.resolution ?? 300))

    const gridMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.96,
      fog: true,
    })
    const grid = new THREE.Mesh(gridGeom, gridMat)
    grid.castShadow = true
    grid.receiveShadow = true
    scene.add(grid)

    const lineMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
      fog: false,
    })
    const lines = new THREE.Mesh(gridGeom, lineMat)
    lines.visible = false
    scene.add(lines)
    let noiseKey = ''
    let eventKey = ''

    const applyEnvironment = (params, now) => {
      let weather = params.weather ?? 'clear'
      if (params.simEvent === 'flood' || params.simEvent === 'hydraulic') weather = 'rain'
      if (params.simEvent === 'snow') weather = 'overcast'
      if (params.simEvent === 'fire') weather = 'storm'
      const day = getDaylight(params.timeOfDay ?? 12, weather)
      if (params.simEvent === 'fire') {
        day.sky.lerp(new THREE.Color(0x2a140c), 0.45 * (params.simTime ?? 0))
        day.sunColor.lerp(new THREE.Color(0xff6a2a), 0.35)
      }
      if (params.simEvent === 'snow') {
        day.sky.lerp(new THREE.Color(0xc5d2dc), 0.4)
      }
      sun.position.copy(day.sunDir).multiplyScalar(36)
      sun.color.copy(day.sunColor)
      sun.intensity = day.sunIntensity
      sun.castShadow = day.shadow
      ambient.intensity = day.ambient
      hemi.intensity = day.hemi
      hemi.color.copy(day.sky).lerp(new THREE.Color(0xffffff), 0.25)
      scene.fog.color.copy(day.sky)
      scene.fog.density = day.fogDensity
      renderer.setClearColor(day.sky, 1)
      fieldMat.opacity = day.starOpacity
      starfield.visible = day.starOpacity > 0.04
      const snowing = params.simEvent === 'snow' && (params.simTime ?? 0) > 0.02
      rain.visible = day.rain || snowing
      rainMat.color.set(snowing ? 0xeef4f8 : 0xb7c8d8)
      rainMat.size = snowing ? 0.14 : 0.07
      gridMat.roughness = snowing ? 0.45 : 0.88 - day.wetness * 0.55
      gridMat.metalness = 0.02 + day.wetness * 0.12
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
      const nextKey = noiseFingerprint(params)
      const nextEvent = `${params.simEvent}|${(params.simTime ?? 0).toFixed(3)}`
      if (nextKey !== noiseKey || nextEvent !== eventKey) {
        const nextRes = Math.max(2, Math.round(params.resolution ?? 300))
        if (lastSegments !== nextRes) {
          gridGeom.dispose()
          gridGeom = createGridGeometry(nextRes)
          grid.geometry = gridGeom
          lines.geometry = gridGeom
          lastSegments = nextRes
        }
        noiseKey = nextKey
        eventKey = nextEvent
        applyNoiseToGrid(gridGeom, params)
        applyEventToGrid(gridGeom, params)
      }
      const filled = params.showMesh !== false
      grid.visible = filled
      lines.visible = !filled
      gridMat.opacity = filled ? 0.96 : 0.7

      applyEnvironment(params, performance.now())

      if (rain.visible) {
        const pos = rainGeom.attributes.position
        const storm = params.weather === 'storm' || params.simEvent === 'fire'
        const snowing = params.simEvent === 'snow'
        const fall = snowing ? 0.12 : storm ? 0.42 : 0.28
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
      gridGeom.dispose()
      gridMat.dispose()
      lineMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [paramsRef])

  return <div className="galaxy-canvas" ref={mountRef} />
}
