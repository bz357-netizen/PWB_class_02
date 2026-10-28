import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  createBreakWorld,
  pulseBreak,
  readBreakStats,
  stepBreakWorld,
  strikeBody,
} from './deconstruct.js'

function pieceGeometry(body) {
  if (body.shape === 'cylinder') {
    return new THREE.CylinderGeometry(body.radius, body.radius * 0.84, body.length, 6)
  }
  if (body.shape === 'leaf') {
    const geometry = new THREE.IcosahedronGeometry(1, 0)
    geometry.scale(body.half.x, body.half.y, body.half.z)
    return geometry
  }
  return new THREE.BoxGeometry(body.half.x * 2, body.half.y * 2, body.half.z * 2)
}

export default function DeconstructCanvas({ paramsRef, onStats }) {
  const mountRef = useRef(null)
  const onStatsRef = useRef(onStats)

  useEffect(() => {
    onStatsRef.current = onStats
  }, [onStats])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x141613)
    scene.fog = new THREE.Fog(0x141613, 22, 48)

    const camera = new THREE.PerspectiveCamera(48, 1, 0.08, 80)
    camera.position.set(0.4, 2.7, 7.4)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(-0.15, 1.05, 0)
    controls.maxPolarAngle = Math.PI * 0.49
    controls.minDistance = 2.8
    controls.maxDistance = 24

    scene.add(new THREE.HemisphereLight(0xf2efe4, 0x3d4a38, 0.72))
    scene.add(new THREE.AmbientLight(0xd7d2c6, 0.28))
    const sun = new THREE.DirectionalLight(0xfff1d2, 1.85)
    sun.position.set(6, 9, 4)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 40
    sun.shadow.camera.left = -14
    sun.shadow.camera.right = 14
    sun.shadow.camera.top = 14
    sun.shadow.camera.bottom = -14
    scene.add(sun)

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(16, 64),
      new THREE.MeshStandardMaterial({ color: 0x2a3128, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    const frameWorld = () => {
      const focus = world.focus || { x: -0.2, y: 2, z: 0, distance: 8 }
      controls.target.set(focus.x, focus.y, focus.z)
      camera.position.set(
        focus.x + focus.distance * 0.22,
        focus.y * 0.62 + 1.5,
        focus.z + focus.distance,
      )
      controls.update()
    }

    let world = createBreakWorld(paramsRef.current.breakBuilding || 'residential')
    let meshes = []

    const clearMeshes = () => {
      for (let i = 0; i < meshes.length; i++) {
        const mesh = meshes[i]
        scene.remove(mesh)
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      meshes = []
    }

    const buildMeshes = () => {
      clearMeshes()
      meshes = world.bodies.map((body) => {
        const mesh = new THREE.Mesh(
          pieceGeometry(body),
          new THREE.MeshStandardMaterial({
            color: body.color,
            roughness: body.shape === 'leaf' ? 0.72 : 0.9,
            metalness: 0,
          }),
        )
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.id = body.id
        scene.add(mesh)
        return mesh
      })
    }

    const rebuild = () => {
      world = createBreakWorld(paramsRef.current.breakBuilding || 'residential')
      buildMeshes()
      frameWorld()
    }

    rebuild()

    let epoch = paramsRef.current.breakEpoch ?? 0
    let kind = paramsRef.current.breakBuilding || 'residential'
    let pulseId = paramsRef.current.breakPulse?.id ?? -1
    let statsAt = 0
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let down = null

    const onPointerDown = (event) => {
      down = { x: event.clientX, y: event.clientY }
    }

    const onPointerUp = (event) => {
      if (!down) return
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)
      down = null
      if (moved > 6) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(meshes, false)[0]
      if (!hit) return
      const dir = hit.point.clone().sub(camera.position)
      dir.y *= 0.25
      if (dir.lengthSq() < 1e-6) return
      dir.normalize()
      strikeBody(world, hit.object.userData.id, {
        x: dir.x * 1.8,
        y: 0.65,
        z: dir.z * 1.8,
      })
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    const resize = () => {
      const width = mount.clientWidth || 1
      const height = mount.clientHeight || 1
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(mount)

    let frame = 0
    let last = performance.now()
    const animate = (now) => {
      frame = requestAnimationFrame(animate)
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const params = paramsRef.current
      const nextEpoch = params.breakEpoch ?? 0
      const nextKind = params.breakBuilding || 'residential'
      if (nextEpoch !== epoch || nextKind !== kind) {
        epoch = nextEpoch
        kind = nextKind
        rebuild()
      }
      const pulse = params.breakPulse
      if (pulse && pulse.id !== pulseId) {
        pulseId = pulse.id
        pulseBreak(world, pulse.action)
      }
      stepBreakWorld(world, dt, {
        wind: params.breakWind ?? 0.22,
        masonry: params.breakMasonry ?? 0.62,
        wood: params.breakWood ?? 0.48,
        gravity: params.breakGravity ?? 1,
      })
      for (let i = 0; i < world.bodies.length; i++) {
        const body = world.bodies[i]
        const mesh = meshes[i]
        mesh.position.set(body.x.x, body.x.y, body.x.z)
        mesh.quaternion.set(body.q.x, body.q.y, body.q.z, body.q.w)
      }
      if (now - statsAt > 200) {
        statsAt = now
        onStatsRef.current?.(readBreakStats(world))
      }
      controls.update()
      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      controls.dispose()
      clearMeshes()
      ground.geometry.dispose()
      ground.material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [paramsRef])

  return <div className="galaxy-canvas" ref={mountRef} />
}
