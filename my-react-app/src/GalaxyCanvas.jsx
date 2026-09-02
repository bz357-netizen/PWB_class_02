import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  createMilkyWay,
  createStarfield,
  makeGlowTexture,
} from './createMilkyWay.js'

export default function GalaxyCanvas({ paramsRef }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x07080a, 0.012)

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200)
    camera.position.set(0, 7.5, 16)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x07080a, 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
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

    const glowMap = makeGlowTexture()

    const galaxyGeom = createMilkyWay()
    const galaxyMat = new THREE.PointsMaterial({
      size: 0.085,
      map: glowMap,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    const galaxy = new THREE.Points(galaxyGeom, galaxyMat)
    galaxy.rotation.x = 0.55
    galaxy.rotation.z = 0.18
    scene.add(galaxy)

    const coreMat = new THREE.SpriteMaterial({
      map: glowMap,
      color: 0xffe6b8,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const core = new THREE.Sprite(coreMat)
    core.scale.set(3.2, 3.2, 1)
    galaxy.add(core)

    const fieldGeom = createStarfield()
    const fieldMat = new THREE.PointsMaterial({
      size: 0.12,
      map: glowMap,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    const starfield = new THREE.Points(fieldGeom, fieldMat)
    scene.add(starfield)

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
      galaxy.rotation.y += params.spin * 0.01
      galaxyMat.size = 0.05 + params.starSize * 0.08
      const glow = params.coreGlow ?? 0.85
      core.scale.set(2.2 * glow, 2.2 * glow, 1)
      controls.update()
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      controls.dispose()
      galaxyGeom.dispose()
      fieldGeom.dispose()
      galaxyMat.dispose()
      fieldMat.dispose()
      coreMat.dispose()
      glowMap.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [paramsRef])

  return <div className="galaxy-canvas" ref={mountRef} />
}
