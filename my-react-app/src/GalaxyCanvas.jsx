import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createStarfield, makeGlowTexture } from './createMilkyWay.js'
import { GRID_SIZE, applyNoiseToGrid, noiseFingerprint } from './noise.js'
import { getDaylight } from './daylight.js'
import { applyEventToGrid } from './eventSim.js'
import { getLivingLayout } from './livingSim.js'

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
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.18
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
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

    const hemi = new THREE.HemisphereLight(0xc5d4e4, 0x3d4a32, 0.62)
    scene.add(hemi)
    const ambient = new THREE.AmbientLight(0x9aab9c, 0.28)
    scene.add(ambient)
    const bounce = new THREE.DirectionalLight(0x8fb0c8, 0.28)
    bounce.position.set(-16, 10, -12)
    scene.add(bounce)
    const sun = new THREE.DirectionalLight(0xfff1c2, 1.6)
    sun.castShadow = true
    sun.shadow.mapSize.set(4096, 4096)
    sun.shadow.radius = 5
    sun.shadow.blurSamples = 12
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 90
    sun.shadow.camera.left = -32
    sun.shadow.camera.right = 32
    sun.shadow.camera.top = 32
    sun.shadow.camera.bottom = -32
    sun.shadow.bias = -0.00025
    sun.shadow.normalBias = 0.035
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
      roughness: 0.82,
      metalness: 0,
      side: THREE.FrontSide,
      fog: true,
      dithering: true,
      flatShading: false,
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

    const livingRoot = new THREE.Group()
    scene.add(livingRoot)
    const hutGeom = new THREE.CylinderGeometry(0.22, 0.3, 0.2, 8)
    hutGeom.translate(0, 0.1, 0)
    const roofGeom = new THREE.ConeGeometry(0.34, 0.22, 8)
    roofGeom.translate(0, 0.28, 0)
    const hutMat = new THREE.MeshStandardMaterial({
      color: 0xe2b15a,
      roughness: 0.72,
      metalness: 0.04,
    })
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x8a3b2a,
      roughness: 0.78,
      metalness: 0,
    })
    const roadGeom = new THREE.BoxGeometry(1, 1, 1)
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x5a4638,
      roughness: 0.9,
      metalness: 0,
    })
    const hwMat = new THREE.MeshStandardMaterial({
      color: 0xc5ccd3,
      roughness: 0.55,
      metalness: 0.08,
    })
    const dummy = new THREE.Object3D()
    let roadMesh = null
    let hwMesh = null
    let livingNetKey = ''

    const clearHuts = () => {
      for (let i = livingRoot.children.length - 1; i >= 0; i--) {
        const child = livingRoot.children[i]
        if (child === roadMesh || child === hwMesh) continue
        livingRoot.remove(child)
      }
    }

    const pathSegments = (paths) => {
      const segs = []
      for (const path of paths) {
        for (let i = 1; i < path.length; i++) segs.push(path[i - 1], path[i])
      }
      return segs
    }

    const writePathMesh = (mesh, segs, width, lift) => {
      if (!mesh) return
      const n = (segs.length / 2) | 0
      mesh.count = n
      for (let i = 0; i < n; i++) {
        const a = segs[i * 2]
        const b = segs[i * 2 + 1]
        const dx = b.x - a.x
        const dz = b.z - a.z
        const len = Math.hypot(dx, dz)
        dummy.position.set((a.x + b.x) * 0.5, (a.y + b.y) * 0.5 + lift, (a.z + b.z) * 0.5)
        dummy.rotation.set(0, Math.atan2(dx, dz), 0)
        dummy.scale.set(width, 0.05, Math.max(0.04, len))
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }

    const makePathMesh = (mat, maxCount) => {
      const mesh = new THREE.InstancedMesh(roadGeom, mat, Math.max(1, maxCount))
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.count = 0
      livingRoot.add(mesh)
      return mesh
    }

    const syncLiving = (params) => {
      if (params.simEvent !== 'living') {
        livingRoot.visible = false
        return
      }
      livingRoot.visible = true
      const netKey = `${params.climate}|${params.country}|${noiseKey}`
      if (netKey !== livingNetKey) {
        livingNetKey = netKey
        if (roadMesh) livingRoot.remove(roadMesh)
        if (hwMesh) livingRoot.remove(hwMesh)
        const finished = getLivingLayout({ ...params, simTime: 1 })
        roadMesh = makePathMesh(roadMat, pathSegments(finished.roads).length / 2)
        hwMesh = makePathMesh(hwMat, pathSegments(finished.highways).length / 2)
        clearHuts()
        for (const v of finished.villages) {
          const hut = new THREE.Mesh(hutGeom, hutMat)
          hut.position.set(v.x, v.y, v.z)
          hut.scale.setScalar(0.7 + v.size * 2.2)
          hut.castShadow = true
          hut.receiveShadow = true
          const roof = new THREE.Mesh(roofGeom, roofMat)
          roof.position.copy(hut.position)
          roof.scale.copy(hut.scale)
          roof.castShadow = true
          livingRoot.add(hut)
          livingRoot.add(roof)
        }
      }
      const layout = getLivingLayout(params)
      writePathMesh(roadMesh, pathSegments(layout.roads), 0.22, 0.02)
      writePathMesh(hwMesh, pathSegments(layout.highways), 0.42, 0.035)
    }

    let noiseKey = ''
    let eventKey = ''

    const applyEnvironment = (params, now) => {
      let weather = params.weather ?? 'clear'
      if (params.simEvent === 'flood' || params.simEvent === 'hydraulic') weather = 'rain'
      if (params.simEvent === 'snow') weather = 'overcast'
      if (params.simEvent === 'fire') weather = 'storm'
      if (params.simEvent === 'living') {
        if (params.climate === 'arid') weather = 'clear'
        else if (params.climate === 'tropical' || params.climate === 'monsoon') weather = 'rain'
        else if (params.climate === 'alpine') weather = 'overcast'
        else if (params.climate === 'coastal') weather = 'fog'
      }
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
      hemi.color.copy(day.sky).lerp(new THREE.Color(0xffffff), 0.35)
      hemi.groundColor.set(0x3d4a32)
      bounce.intensity = day.ambient * 0.9
      bounce.color.copy(day.sky).lerp(new THREE.Color(0xffffff), 0.15)
      scene.fog.color.copy(day.sky)
      scene.fog.density = Math.max(0.011, day.fogDensity)
      renderer.setClearColor(day.sky, 1)
      fieldMat.opacity = day.starOpacity
      starfield.visible = day.starOpacity > 0.04
      const snowing = params.simEvent === 'snow' && (params.simTime ?? 0) > 0.02
      rain.visible = day.rain || snowing
      rainMat.color.set(snowing ? 0xeef4f8 : 0xb7c8d8)
      rainMat.size = snowing ? 0.14 : 0.07
      gridMat.roughness = snowing ? 0.5 : 0.82 - day.wetness * 0.28
      gridMat.metalness = day.wetness * 0.06
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
      const nextEvent =
        params.simEvent === 'living'
          ? `living|${params.climate}|${params.country}`
          : `${params.simEvent}|${(params.simTime ?? 0).toFixed(3)}`
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
        livingNetKey = ''
      }
      syncLiving(params)
      const filled = params.showMesh !== false
      grid.visible = filled
      lines.visible = !filled
      gridMat.opacity = 1

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
      hutGeom.dispose()
      roofGeom.dispose()
      hutMat.dispose()
      roofMat.dispose()
      roadGeom.dispose()
      roadMat.dispose()
      hwMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [paramsRef])

  return <div className="galaxy-canvas" ref={mountRef} />
}
