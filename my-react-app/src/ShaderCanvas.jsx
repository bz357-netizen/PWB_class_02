import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GRID_SIZE, applyNoiseToGrid, noiseFingerprint } from './noise.js'
import { getDaylight } from './daylight.js'
import { createStrategyMaterial } from './shaders.js'

function createGridGeometry(segments) {
  const segs = Math.max(2, Math.round(segments))
  const geometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, segs, segs)
  geometry.rotateX(-Math.PI / 2)
  const colors = new Float32Array(geometry.attributes.position.count * 3)
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

function heightRange(geometry) {
  const pos = geometry.attributes.position
  let low = Infinity
  let high = -Infinity
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    if (y < low) low = y
    if (y > high) high = y
  }
  if (!Number.isFinite(low) || high - low < 0.001) return { low: 0, high: 1 }
  return { low, high }
}

export default function ShaderCanvas({ paramsRef }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0xeef6ec, 0.005)

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200)
    camera.position.set(0, 14, 22)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0xeef6ec, 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.98
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

    const hemi = new THREE.HemisphereLight(0xf4faf2, 0x5e9a58, 0.72)
    scene.add(hemi)
    const ambient = new THREE.AmbientLight(0xdcefd4, 0.4)
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
    sun.shadow.bias = -0.00025
    sun.shadow.normalBias = 0.035
    sun.position.set(18, 28, 10)
    scene.add(sun)
    scene.add(sun.target)
    sun.target.position.set(0, 0, 0)

    let gridGeom = createGridGeometry(paramsRef.current.resolution ?? 300)
    applyNoiseToGrid(gridGeom, paramsRef.current)
    let range = heightRange(gridGeom)
    let lastSegments = Math.max(2, Math.round(paramsRef.current.resolution ?? 300))
    let strategyId = paramsRef.current.shaderStrategy || 'elevation'
    let material = createStrategyMaterial(strategyId)

    const grid = new THREE.Mesh(gridGeom, material)
    grid.castShadow = true
    grid.receiveShadow = true
    scene.add(grid)

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    resize()
    window.addEventListener('resize', resize)

    let noiseKey = ''
    let frameId = 0
    const started = performance.now()

    const animate = () => {
      const params = paramsRef.current
      const nextKey = noiseFingerprint(params)
      const nextRes = Math.max(2, Math.round(params.resolution ?? 300))
      if (nextKey !== noiseKey) {
        if (lastSegments !== nextRes) {
          gridGeom.dispose()
          gridGeom = createGridGeometry(nextRes)
          grid.geometry = gridGeom
          lastSegments = nextRes
        }
        noiseKey = nextKey
        applyNoiseToGrid(gridGeom, params)
        range = heightRange(gridGeom)
      }

      const nextStrategy = params.shaderStrategy || 'elevation'
      if (nextStrategy !== strategyId) {
        material.dispose()
        strategyId = nextStrategy
        material = createStrategyMaterial(strategyId)
        grid.material = material
      }

      const day = getDaylight(params.timeOfDay ?? 12, params.weather ?? 'clear')
      sun.position.copy(day.sunDir).multiplyScalar(36)
      sun.color.copy(day.sunColor)
      sun.intensity = day.sunIntensity
      sun.castShadow = day.shadow && strategyId === 'lit'
      ambient.intensity = day.ambient
      hemi.intensity = day.hemi
      hemi.color.copy(day.sky).lerp(new THREE.Color(0xffffff), 0.45)
      hemi.groundColor.set(0x5e9a58)
      scene.fog.color.copy(day.sky)
      scene.fog.density = day.fogDensity
      renderer.setClearColor(day.sky, 1)

      material.wireframe = params.showMesh === false
      if (material.uniforms) {
        const spacing = strategyId === 'drainage' ? params.shaderFlow : params.shaderBand
        material.uniforms.uTime.value = (performance.now() - started) / 1000
        material.uniforms.uLow.value = range.low
        material.uniforms.uHigh.value = range.high
        material.uniforms.uSpacing.value = spacing ?? 0.45
        material.uniforms.uWater.value = params.shaderWater ?? 0.15
        material.uniforms.uSun.value.copy(day.sunDir)
        material.uniforms.uFog.value = day.fogDensity
        material.uniforms.uSky.value.copy(day.sky)
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
      gridGeom.dispose()
      material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [paramsRef])

  return <div className="galaxy-canvas" ref={mountRef} />
}
