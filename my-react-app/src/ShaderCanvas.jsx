import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GRID_SIZE, applyNoiseToGrid, noiseFingerprint } from './noise.js'
import { getDaylight } from './daylight.js'
import { createStrategyMaterial } from './shaders.js'
import {
  TREE_KINDS,
  createTreeGeometries,
  createTreeMaterial,
  emptyScatter,
  scatterTrees,
} from './trees.js'
import { buildEnvironmentPaths, buildFilaments, findCore } from './paths.js'
import { createFlowLayer } from './flowField.js'

function createGridGeometry(segments) {
  const segs = Math.max(2, Math.round(segments))
  const geometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, segs, segs)
  geometry.rotateX(-Math.PI / 2)
  const colors = new Float32Array(geometry.attributes.position.count * 3)
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

function tubeFromPoints(points, radius, material) {
  if (!points || points.length < 4) return null
  const curve = new THREE.CatmullRomCurve3(points)
  const geometry = new THREE.TubeGeometry(curve, Math.min(140, points.length * 2), radius, 5, false)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.castShadow = false
  mesh.receiveShadow = false
  return { mesh, curve }
}

function dropTube(slot) {
  if (!slot.mesh) return
  slot.group.remove(slot.mesh)
  slot.mesh.geometry.dispose()
  slot.mesh = null
  slot.curve = null
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

export default function ShaderCanvas({ paramsRef, onTreeStats }) {
  const mountRef = useRef(null)
  const onTreeStatsRef = useRef(onTreeStats)
  onTreeStatsRef.current = onTreeStats

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

    const treeGeos = createTreeGeometries()
    const treeTime = { value: 0 }
    const treeWater = { value: 0.15 }
    const treeSubmerge = { value: 0 }
    const treeErode = { value: 0.42 }
    const treeUnknown = { value: 0 }
    const treeLow = { value: 0 }
    const treeHigh = { value: 1 }
    const treeMaterial = createTreeMaterial(treeTime, treeWater, treeSubmerge, {
      erode: treeErode,
      unknown: treeUnknown,
      low: treeLow,
      high: treeHigh,
    })
    const treeMeshes = {}
    for (const kind of TREE_KINDS) {
      const mesh = new THREE.InstancedMesh(treeGeos[kind.id], treeMaterial, 4200)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      mesh.count = 0
      scene.add(mesh)
      treeMeshes[kind.id] = mesh
    }
    const treeDummy = new THREE.Object3D()
    const treeTint = new THREE.Color()
    let scatter = emptyScatter()
    let treeKey = ''

    const matHoney = new THREE.MeshBasicMaterial({
      color: 0xf0b84a,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false,
    })
    const filamentColors = [0xff4ad4, 0x3ee0c8, 0xf0b44a]
    const filamentMats = filamentColors.map(
      (color) =>
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
    )
    const matOrb = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const matCore = new THREE.MeshBasicMaterial({ color: 0xfff4d2 })
    const matHalo = new THREE.MeshBasicMaterial({
      color: 0xffe2a8,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const hazeColors = [0x7a4cff, 0x2ec8b0, 0xe09030]
    const hazeMats = hazeColors.map(
      (color) =>
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
    )
    const shardMats = [
      new THREE.MeshBasicMaterial({ color: 0x8b5cff }),
      new THREE.MeshBasicMaterial({ color: 0xff7a3a }),
      new THREE.MeshBasicMaterial({ color: 0x3ee0c0 }),
      new THREE.MeshBasicMaterial({ color: 0xf2c14e }),
    ]

    const pathGroup = new THREE.Group()
    scene.add(pathGroup)
    const strangeGroup = new THREE.Group()
    scene.add(strangeGroup)

    const strandSlots = []
    const flow = createFlowLayer()
    scene.add(flow.group)
    const honeyPoint = { x: 2, y: 0.2, z: 2 }
    const pointer = { hit: false, down: false, x: 0, y: 0, z: 0 }
    const raycaster = new THREE.Raycaster()
    const pointerNdc = new THREE.Vector2()
    let pointerOver = false

    const honey = new THREE.Mesh(new THREE.CircleGeometry(1.15, 18), matHoney)
    honey.rotation.x = -Math.PI / 2
    pathGroup.add(honey)
    const honeyGlow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), matHoney)
    pathGroup.add(honeyGlow)

    const orbGeo = new THREE.SphereGeometry(0.14, 10, 8)
    const orbs = new THREE.InstancedMesh(orbGeo, matOrb, 18)
    orbs.frustumCulled = false
    orbs.count = 0
    orbs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(18 * 3), 3)
    strangeGroup.add(orbs)

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), matCore)
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), matHalo)
    const coreLight = new THREE.PointLight(0xfff1c8, 6, 26, 1.4)
    strangeGroup.add(core, halo, coreLight)

    const hazeGeo = new THREE.SphereGeometry(4.2, 16, 12)
    const hazes = hazeMats.map((material, index) => {
      const mesh = new THREE.Mesh(hazeGeo, material)
      mesh.scale.setScalar(0.85 + index * 0.35)
      strangeGroup.add(mesh)
      return mesh
    })

    const shardGeo = new THREE.TetrahedronGeometry(0.55, 0)
    const shards = shardMats.map((material) => {
      const mesh = new THREE.Mesh(shardGeo, material)
      strangeGroup.add(mesh)
      return mesh
    })

    let pathKey = ''
    let strandKey = ''
    const corePos = new THREE.Vector3(0, 8, 0)

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    resize()
    window.addEventListener('resize', resize)

    const onPointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      pointerOver = true
    }
    const onPointerDown = (event) => {
      if (event.button === 0) pointer.down = true
    }
    const onPointerUp = (event) => {
      if (event.button === 0) pointer.down = false
    }
    const onPointerLeave = () => {
      pointerOver = false
      pointer.hit = false
      pointer.down = false
    }
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointerleave', onPointerLeave)

    let noiseKey = ''
    let frameId = 0
    let lastTick = performance.now()
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
      sun.castShadow = day.shadow
      ambient.intensity = day.ambient
      hemi.intensity = day.hemi
      hemi.color.copy(day.sky).lerp(new THREE.Color(0xffffff), 0.45)
      hemi.groundColor.set(0x5e9a58)
      scene.fog.color.copy(day.sky)
      scene.fog.density = day.fogDensity
      renderer.setClearColor(day.sky, 1)

      const cover = params.treeCover ?? 0.72
      const nextTreeKey = `${noiseKey}|${lastSegments}|${cover.toFixed(3)}`
      if (nextTreeKey !== treeKey) {
        treeKey = nextTreeKey
        scatter = scatterTrees(gridGeom, cover)
        const counts = {
          tall: scatter.tall.length,
          medium: scatter.medium.length,
          short: scatter.short.length,
        }
        onTreeStatsRef.current?.(counts)
        for (const kind of TREE_KINDS) {
          const mesh = treeMeshes[kind.id]
          const items = scatter[kind.id]
          mesh.count = items.length
          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            treeDummy.position.set(item.x, item.y, item.z)
            treeDummy.rotation.set(0, item.rot, 0)
            treeDummy.scale.setScalar(item.scale)
            treeDummy.updateMatrix()
            mesh.setMatrixAt(i, treeDummy.matrix)
            const lift = kind.id === 'short' ? 1.04 : 1
            treeTint.setRGB(item.tint, item.tint * lift, item.tint * 0.9)
            mesh.setColorAt(i, treeTint)
          }
          mesh.instanceMatrix.needsUpdate = true
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        }
      }

      material.wireframe = params.showMesh === false
      if (material.uniforms) {
        const spacing = strategyId === 'drainage' ? params.shaderFlow : params.shaderBand
        material.uniforms.uTime.value = (performance.now() - started) / 1000
        material.uniforms.uLow.value = range.low
        material.uniforms.uHigh.value = range.high
        material.uniforms.uSpacing.value = spacing ?? 0.45
        material.uniforms.uWater.value = params.shaderWater ?? 0.15
        material.uniforms.uErode.value = params.shaderErode ?? 0.42
        material.uniforms.uUnknown.value = strategyId === 'unknown' ? 1 : 0
        material.uniforms.uCore.value.copy(corePos)
        material.uniforms.uSun.value.copy(day.sunDir)
        material.uniforms.uFog.value = day.fogDensity
        material.uniforms.uSky.value.copy(day.sky)
      }

      if (strategyId === 'unknown') {
        const dusk = new THREE.Color(0x2a1840)
        scene.fog.color.copy(dusk)
        scene.fog.density = 0.01
        renderer.setClearColor(dusk, 1)
        hemi.color.set(0x9a78c8)
        hemi.groundColor.set(0x1a3836)
        hemi.intensity = 0.5
        ambient.color.set(0xd0c0ea)
        ambient.intensity = 0.3
        sun.color.set(0xffd2a4)
        sun.intensity = 0.9
        if (material.uniforms) {
          material.uniforms.uSky.value.copy(dusk)
          material.uniforms.uFog.value = 0.007
        }
      }

      const nextPathKey = noiseKey
      if (nextPathKey !== pathKey && noiseKey) {
        pathKey = nextPathKey
        const built = buildEnvironmentPaths(gridGeom, 1)
        honeyPoint.x = built.honey.x
        honeyPoint.y = built.honey.y
        honeyPoint.z = built.honey.z
        honey.position.set(built.honey.x, built.honey.y + 0.04, built.honey.z)
        honeyGlow.position.set(built.honey.x, built.honey.y + 0.45, built.honey.z)
      }

      const nextStrandKey = noiseKey
      if (nextStrandKey !== strandKey && noiseKey) {
        strandKey = nextStrandKey
        for (const slot of strandSlots) dropTube(slot)
        strandSlots.length = 0
        const strands = buildFilaments(gridGeom)
        const tint = new THREE.Color()
        let orbIndex = 0
        strands.forEach((points, index) => {
          const slot = { group: strangeGroup, mesh: null, curve: null }
          const tube = tubeFromPoints(points, 0.035, filamentMats[index % filamentMats.length])
          if (!tube) return
          strangeGroup.add(tube.mesh)
          slot.mesh = tube.mesh
          slot.curve = tube.curve
          strandSlots.push(slot)
          tint.setHex(filamentColors[index % filamentColors.length])
          for (let k = 0; k < 3 && orbIndex < 18; k++) {
            orbs.setColorAt(orbIndex, tint)
            orbIndex += 1
          }
        })
        orbs.count = orbIndex
        if (orbs.instanceColor) orbs.instanceColor.needsUpdate = true
        corePos.copy(findCore(gridGeom))
        core.position.copy(corePos)
        halo.position.copy(corePos)
        coreLight.position.copy(corePos)
        shards.forEach((mesh, index) => {
          const ang = index * 1.5
          const radius = 2.2 + index * 0.7
          mesh.position.set(
            corePos.x + Math.cos(ang) * radius,
            corePos.y + 0.6 + index * 0.45,
            corePos.z + Math.sin(ang) * radius,
          )
        })
        hazes.forEach((mesh, index) => {
          mesh.position.set(corePos.x + index * 1.4, corePos.y - 0.4, corePos.z - index)
        })
      }

      strangeGroup.visible = strategyId === 'unknown'

      const elapsed = (performance.now() - started) / 1000
      treeTime.value = elapsed
      treeWater.value = params.shaderWater ?? 0.15
      treeSubmerge.value = strategyId === 'waterline' ? 1 : 0
      treeErode.value = params.shaderErode ?? 0.42
      treeUnknown.value = strategyId === 'unknown' ? 1 : 0
      treeLow.value = range.low
      treeHigh.value = range.high

      if (pointerOver) {
        raycaster.setFromCamera(pointerNdc, camera)
        const hits = raycaster.intersectObject(grid, false)
        if (hits.length) {
          pointer.hit = true
          pointer.x = hits[0].point.x
          pointer.y = hits[0].point.y
          pointer.z = hits[0].point.z
        } else {
          pointer.hit = false
        }
      }

      const now = performance.now()
      const dt = Math.min(0.05, (now - lastTick) / 1000)
      lastTick = now
      if (noiseKey) {
        flow.update({
          geometry: gridGeom,
          key: `${noiseKey}|${Math.round(params.fieldResolution ?? 18)}`,
          params,
          time: elapsed,
          dt,
          pointer,
          unknown: strategyId === 'unknown',
          honey: honeyPoint,
        })
      }

      controls.update()
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave)
      flow.dispose()
      controls.dispose()
      gridGeom.dispose()
      material.dispose()
      treeMaterial.dispose()
      for (const kind of TREE_KINDS) {
        treeGeos[kind.id].dispose()
        treeMeshes[kind.id].dispose()
      }
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [paramsRef])

  return <div className="galaxy-canvas" ref={mountRef} />
}
