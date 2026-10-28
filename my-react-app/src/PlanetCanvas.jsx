import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  MAX_COLOR_STOPS,
  PLANET_RADIUS,
  applyPlanetHeights,
  buildUnitSphere,
  planetFingerprint,
  seaElevation,
  seaRadius,
  sortedStops,
} from './planet.js'
import { createPlanetAgent } from './planetAgent.js'
import { createPlanetTown, townFingerprint } from './planetTown.js'
import { createSurfaceSampler } from './planetWalker.js'

const INK = 0x1e2b2b
/** Ink outline thickness in world units (planet radius is 10). */
const OUTLINE = 0.14
const POLAR_LIMITS = { min: 0.05, max: Math.PI - 0.05 }
const REBUILD_GAP_MS = 90
const TOWN_GAP_MS = 250
/** Noon light comes from the camera's upper left, so the relief casts readable shading. */
const SUN_LEAD = -0.75

const WEATHER_LIGHT = {
  clear: { sun: 2.2, ambient: 1.5 },
  overcast: { sun: 1.4, ambient: 1.6 },
  fog: { sun: 1.2, ambient: 1.8 },
  rain: { sun: 1.1, ambient: 1.4 },
  storm: { sun: 0.7, ambient: 1.1 },
}

/** Three flat light bands: shadow, mid, lit. */
function makeToonRamp() {
  const texture = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

/** Inverted hull: back faces pushed out along the normal and drawn in flat ink. */
function makeOutlineMaterial(thickness) {
  const material = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })
  const uThickness = { value: thickness }
  material.userData.thickness = uThickness
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uThickness = uThickness
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uThickness;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed += normalize(normal) * uThickness;',
      )
  }
  return material
}

function makeGroundMaterial(uniforms, gradientMap) {
  const material = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aElev;\nvarying float vElev;\nvarying vec3 vRoadDir;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvElev = aElev;\nvRoadDir = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uRoadMap;
uniform float uRoadOn;
uniform vec3 uAsphalt;
uniform vec3 uPaving;
uniform vec3 uLine;
varying vec3 vRoadDir;
vec3 paintRoads(vec3 base) {
  if (uRoadOn < 0.5) return base;
  vec3 d = normalize(vRoadDir);
  vec2 uv = vec2(atan(d.z, d.x) / 6.28318530718 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.14159265359 + 0.5);
  vec3 m = texture2D(uRoadMap, uv).rgb;
  vec3 c = mix(base, uPaving, smoothstep(0.3, 0.6, m.b));
  float road = smoothstep(0.3, 0.6, m.r);
  c = mix(c, uAsphalt, road);
  return mix(c, uLine, smoothstep(0.3, 0.6, m.g) * road);
}
uniform float uStopAt[${MAX_COLOR_STOPS}];
uniform vec3 uStopColor[${MAX_COLOR_STOPS}];
uniform int uStopCount;
uniform float uStepped;
varying float vElev;
vec3 planetRamp(float t) {
  if (t <= uStopAt[0]) return uStopColor[0];
  vec3 c = uStopColor[0];
  for (int i = 1; i < ${MAX_COLOR_STOPS}; i++) {
    if (i >= uStopCount) break;
    float a = uStopAt[i - 1];
    float b = uStopAt[i];
    if (t < b) {
      if (uStepped > 0.5) return uStopColor[i - 1];
      return mix(uStopColor[i - 1], uStopColor[i], clamp((t - a) / max(b - a, 1e-5), 0.0, 1.0));
    }
    c = uStopColor[i];
  }
  return c;
}`,
      )
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = paintRoads(diffuseColor.rgb * planetRamp(vElev));')
  }
  return material
}

function makeOceanMaterial(uniforms, gradientMap) {
  const material = new THREE.MeshToonMaterial({
    color: 0xffffff,
    gradientMap,
    transparent: true,
    depthWrite: false,
  })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uPhase;
uniform float uWaveScale;
uniform float uWaveHeight;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec3 wp = normalize(position) * uWaveScale;
float bob = (sin(wp.x + uPhase) + sin(wp.y * 1.27 + uPhase * 1.13) + sin(wp.z * 0.91 - uPhase * 0.87)) / 3.0;
transformed += normal * bob * uWaveHeight;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uDepth;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform float uUseDepth;
uniform float uPhase;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoamColor;
uniform float uFoamOn;
uniform float uFoamDepth;
uniform float uFoamSoft;
uniform float uRippleOn;
uniform float uRippleWidth;
uniform float uRippleDist;
uniform float uOpacity;
float oceanViewZ(float depth, float near, float far) {
  return (near * far) / ((far - near) * depth - far);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float depthDiff = 1e4;
if (uUseDepth > 0.5) {
  float sceneDepth = texture2D(uDepth, gl_FragCoord.xy / uResolution).x;
  float sceneZ = oceanViewZ(sceneDepth, uNear, uFar);
  float fragZ = oceanViewZ(gl_FragCoord.z, uNear, uFar);
  depthDiff = max(0.0, fragZ - sceneZ);
}
vec3 water = uDeep;
float foamMask = 0.0;
if (uFoamOn > 0.5) {
  water = mix(uShallow, uDeep, smoothstep(0.0, uFoamDepth * 4.0, depthDiff));
  float edge = mix(uFoamDepth * 0.04, uFoamDepth, uFoamSoft);
  foamMask = 1.0 - smoothstep(max(0.0, uFoamDepth - edge), uFoamDepth, depthDiff);
}
if (uRippleOn > 0.5) {
  float ringPhase = fract(depthDiff / max(uRippleWidth, 1e-3) + uPhase * 0.6);
  float ring = smoothstep(0.0, 0.12, ringPhase) * (1.0 - smoothstep(0.12, 0.3, ringPhase));
  float reach = 1.0 - smoothstep(uRippleDist * 0.4, uRippleDist, depthDiff);
  foamMask = max(foamMask, ring * reach * 0.85);
}
diffuseColor.rgb = mix(water, uFoamColor, foamMask);
diffuseColor.a = mix(uOpacity, 1.0, foamMask);`,
      )
  }
  return material
}

export default function PlanetCanvas({ paramsRef, onStats }) {
  const mountRef = useRef(null)
  const onStatsRef = useRef(onStats)
  onStatsRef.current = onStats

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 400)
    camera.position.set(0, 0, PLANET_RADIUS * 3.5)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.enablePan = false
    controls.minDistance = PLANET_RADIUS * 1.2
    controls.maxDistance = 90
    controls.rotateSpeed = 0.6
    controls.zoomSpeed = 0.85
    controls.minPolarAngle = POLAR_LIMITS.min
    controls.maxPolarAngle = POLAR_LIMITS.max
    let heldUntil = 0
    controls.addEventListener('start', () => (heldUntil = Infinity))
    controls.addEventListener('end', () => (heldUntil = performance.now() + 2000))
    const followDir = new THREE.Vector3()
    const camDir = new THREE.Vector3()

    const ambient = new THREE.AmbientLight(0xeaf4f0, 1.5)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xfff6e4, 2.2)
    scene.add(sun)
    const toonRamp = makeToonRamp()

    const uniforms = {
      uStopAt: { value: new Array(MAX_COLOR_STOPS).fill(1) },
      uStopColor: { value: Array.from({ length: MAX_COLOR_STOPS }, () => new THREE.Color()) },
      uStopCount: { value: 1 },
      uStepped: { value: 0 },
      uRoadMap: { value: null },
      uRoadOn: { value: 0 },
      uAsphalt: { value: new THREE.Color('#7b8486') },
      uPaving: { value: new THREE.Color('#d9d3c3') },
      uLine: { value: new THREE.Color('#f7f3e8') },
    }

    const planet = new THREE.Group()
    scene.add(planet)
    const town = createPlanetTown({
      gradientMap: toonRamp,
      makeInk: () => makeOutlineMaterial(0),
    })
    planet.add(town.root)
    uniforms.uRoadMap.value = town.roadTexture
    let surface = null
    let townKey = ''
    let lastTown = 0

    let unit = null
    let unitKey = ''
    const groundGeom = new THREE.BufferGeometry()
    const groundMat = makeGroundMaterial(uniforms, toonRamp)
    const ground = new THREE.Mesh(groundGeom, groundMat)
    planet.add(ground)

    const groundInkMat = makeOutlineMaterial(OUTLINE)
    const groundInk = new THREE.Mesh(groundGeom, groundInkMat)
    planet.add(groundInk)
    const agent = createPlanetAgent({
      gradientMap: toonRamp,
      makeInk: () => makeOutlineMaterial(0),
    })
    planet.add(agent.root)

    const seaInkGeom = new THREE.SphereGeometry(1, 96, 64)
    const seaInkMat = makeOutlineMaterial(0)
    const seaInk = new THREE.Mesh(seaInkGeom, seaInkMat)
    planet.add(seaInk)

    const wireMat = new THREE.MeshBasicMaterial({
      color: INK,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    })
    const wire = new THREE.Mesh(groundGeom, wireMat)
    wire.visible = false
    planet.add(wire)

    const depthTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true })
    depthTarget.depthTexture = new THREE.DepthTexture(1, 1)
    const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false })
    const bufferSize = new THREE.Vector2()

    const oceanUniforms = {
      uDepth: { value: depthTarget.depthTexture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uUseDepth: { value: 1 },
      uPhase: { value: 0 },
      uWaveScale: { value: 24 },
      uWaveHeight: { value: 0 },
      uDeep: { value: new THREE.Color() },
      uShallow: { value: new THREE.Color() },
      uFoamColor: { value: new THREE.Color() },
      uFoamOn: { value: 1 },
      uFoamDepth: { value: 0.12 },
      uFoamSoft: { value: 0.35 },
      uRippleOn: { value: 1 },
      uRippleWidth: { value: 0.12 },
      uRippleDist: { value: 0.8 },
      uOpacity: { value: 0.88 },
    }

    let oceanRes = 0
    let oceanGeom = null
    const oceanMat = makeOceanMaterial(oceanUniforms, toonRamp)
    const ocean = new THREE.Mesh(undefined, oceanMat)
    ocean.renderOrder = 1
    planet.add(ocean)

    const setOceanRes = (value) => {
      const res = Math.max(8, Math.min(512, Math.round(value)))
      if (res === oceanRes) return
      oceanGeom?.dispose()
      oceanGeom = new THREE.SphereGeometry(1, res, res)
      ocean.geometry = oceanGeom
      oceanRes = res
    }
    setOceanRes(paramsRef.current.planetOceanRes ?? 128)

    let span = { min: -1, max: 1 }
    let buildKey = ''
    let lastBuild = 0
    let stats = null
    let countedSea = NaN

    const countLand = (params) => {
      const elev = groundGeom.attributes.aElev?.array
      if (!elev || !stats) return
      const seaT = seaElevation(span, params)
      let land = 0
      for (let i = 0; i < elev.length; i++) if (elev[i] > seaT) land++
      countedSea = params.planetSeaLevel ?? 0
      stats = { ...stats, seaT, land: land / Math.max(1, elev.length) }
      onStatsRef.current?.(stats)
    }

    const rebuild = (params) => {
      const started = performance.now()
      const detail = Math.round(params.planetDetail ?? 64)
      const nextUnitKey = `${params.planetMesh}|${detail}`
      if (nextUnitKey !== unitKey) {
        unit?.dispose()
        unit = buildUnitSphere(params.planetMesh, detail)
        unitKey = nextUnitKey
        groundGeom.deleteAttribute('position')
        groundGeom.deleteAttribute('aElev')
        groundGeom.deleteAttribute('normal')
        groundGeom.setIndex(null)
        groundGeom.dispose()
      }
      const result = applyPlanetHeights(groundGeom, unit, params)
      surface = createSurfaceSampler(groundGeom)
      span = result
      stats = {
        vertices: result.vertices,
        triangles: result.triangles,
        ms: Math.round(performance.now() - started),
      }
      countLand(params)
    }

    const syncLook = (params) => {
      const stops = sortedStops(params.planetStops)
      uniforms.uStopCount.value = stops.length
      for (let i = 0; i < MAX_COLOR_STOPS; i++) {
        const stop = stops[Math.min(i, stops.length - 1)]
        uniforms.uStopAt.value[i] = i < stops.length ? stop.at : 2
        uniforms.uStopColor.value[i].set(stop.color)
      }
      uniforms.uStepped.value = params.planetStepped ? 1 : 0

      const filled = params.showMesh !== false
      ground.visible = filled
      groundInk.visible = filled
      wire.visible = !filled

      ocean.visible = params.planetOcean !== false && filled
      setOceanRes(params.planetOceanRes ?? 128)
      const radius = seaRadius(params)
      ocean.scale.setScalar(radius)
      seaInk.visible = ocean.visible
      seaInk.scale.setScalar(radius + OUTLINE)
      const o = oceanUniforms
      o.uWaveScale.value = params.planetWaveScale ?? 24
      o.uWaveHeight.value = (params.planetWaveHeight ?? 0.03) / radius
      o.uDeep.value.set(params.planetDeep ?? '#0b3a5c')
      o.uShallow.value.set(params.planetShallow ?? '#2a9db5')
      o.uFoamColor.value.set(params.planetFoam ?? '#e8f6f8')
      o.uFoamOn.value = params.planetFoamOn !== false ? 1 : 0
      o.uFoamDepth.value = params.planetFoamDepth ?? 0.035
      o.uFoamSoft.value = params.planetFoamSoft ?? 0.35
      o.uRippleOn.value = params.planetRipplesOn !== false ? 1 : 0
      o.uRippleWidth.value = params.planetRippleWidth ?? 0.05
      o.uRippleDist.value = params.planetRippleDistance ?? 0.3
      o.uOpacity.value = 1 - (params.planetClarity ?? 0.16) * 0.75

      const hour = params.timeOfDay ?? 12
      const azimuth = ((hour - 12) / 24) * Math.PI * 2 + SUN_LEAD
      sun.position.set(Math.sin(azimuth) * 60, 26, Math.cos(azimuth) * 60)
      const light = WEATHER_LIGHT[params.weather] ?? WEATHER_LIGHT.clear
      sun.intensity = light.sun
      ambient.intensity = light.ambient
    }

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      renderer.getDrawingBufferSize(bufferSize)
      depthTarget.setSize(bufferSize.x, bufferSize.y)
      oceanUniforms.uResolution.value.copy(bufferSize)
    }

    const renderDepth = () => {
      const keep = [ocean.visible, groundInk.visible, seaInk.visible, wire.visible]
      ocean.visible = false
      groundInk.visible = false
      seaInk.visible = false
      wire.visible = false
      scene.overrideMaterial = depthOnly
      renderer.setRenderTarget(depthTarget)
      renderer.clear()
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      scene.overrideMaterial = null
      ;[ocean.visible, groundInk.visible, seaInk.visible, wire.visible] = keep
    }
    resize()
    window.addEventListener('resize', resize)
    const fitWidth = (PLANET_RADIUS * 1.5) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect)
    camera.position.setLength(Math.min(controls.maxDistance, Math.max(PLANET_RADIUS * 3.5, fitWidth)))
    let frameId = 0
    let last = performance.now()
    const animate = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const params = paramsRef.current
      const nextKey = planetFingerprint(params)
      if (nextKey !== buildKey && now - lastBuild > REBUILD_GAP_MS) {
        buildKey = nextKey
        rebuild(params)
        lastBuild = performance.now()
      }
      if ((params.planetSeaLevel ?? 0) !== countedSea) countLand(params)
      const nextTownKey = `${buildKey}|${townFingerprint(params)}`
      if (nextTownKey !== townKey && now - lastTown > TOWN_GAP_MS) {
        townKey = nextTownKey
        town.build(params, surface)
        lastTown = performance.now()
      }
      syncLook(params)
      uniforms.uRoadOn.value = params.planetRoads !== false ? 1 : 0
      planet.rotation.y += dt * (params.planetSpin ?? 0.2) * 0.35
      planet.updateMatrixWorld()
      town.update(dt, params, surface)
      agent.update(dt, params, surface, town.walls)
      const follow = params.planetFollow ?? 'robot'
      const target =
        follow === 'robot' && agent.root.visible ? agent.root.getWorldPosition(followDir) : null
      if (target && now > heldUntil) {
        followDir.normalize()
        camDir.copy(camera.position).normalize()
        const side = camDir.addScaledVector(followDir, -camDir.dot(followDir))
        const wantDir = followDir.clone()
        if (side.lengthSq() > 1e-8) {
          wantDir.multiplyScalar(Math.cos(0.38)).addScaledVector(side.normalize(), Math.sin(0.38))
        }
        const want = THREE.MathUtils.clamp(PLANET_RADIUS + 6.5, controls.minDistance, controls.maxDistance)
        const distance = THREE.MathUtils.damp(camera.position.length(), want, 1.4, dt)
        camDir.copy(camera.position).normalize()
        camDir.lerp(wantDir, 1 - Math.exp(-dt * 1.5)).normalize()
        camera.position.copy(camDir).multiplyScalar(distance)
      }
      oceanUniforms.uPhase.value += dt * (params.planetWaveSpeed ?? 1)

      controls.update()
      const needDepth =
        ocean.visible && (params.planetFoamOn !== false || params.planetRipplesOn !== false)
      oceanUniforms.uUseDepth.value = needDepth ? 1 : 0
      if (needDepth) renderDepth()
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      controls.dispose()
      unit?.dispose()
      groundGeom.dispose()
      groundMat.dispose()
      wireMat.dispose()
      oceanGeom?.dispose()
      oceanMat.dispose()
      depthTarget.depthTexture.dispose()
      depthTarget.dispose()
      depthOnly.dispose()
      agent.dispose()
      town.dispose()
      groundInkMat.dispose()
      seaInkGeom.dispose()
      seaInkMat.dispose()
      toonRamp.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [paramsRef])

  return <div className="galaxy-canvas" ref={mountRef} />
}
