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
import { LOOK_SWATCHES, createPlanetAgent } from './planetAgent.js'
import { SHORE_CLEAR, createPlanetTown, townFingerprint } from './planetTown.js'
import { createPlanetUfo } from './planetUfo.js'
import { blockedAt, createSurfaceSampler, groundRadius } from './planetWalker.js'
import { inspectFingerprint, latLonFromDir, round2, vec3 } from './inspectEntity.js'
import { formatProcessTime, processAt, processCaption } from './worldProcess.js'

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

export default function PlanetCanvas({
  paramsRef,
  debugOpenRef,
  talkOpenRef,
  ufoOpenRef,
  inspectOnRef,
  onTalk,
  onUfo,
  onInspectMode,
  onStats,
  onProcess,
}) {
  const mountRef = useRef(null)
  const onStatsRef = useRef(onStats)
  const onTalkRef = useRef(onTalk)
  const onUfoRef = useRef(onUfo)
  const onInspectModeRef = useRef(onInspectMode)
  const onProcessRef = useRef(onProcess)
  onStatsRef.current = onStats
  onTalkRef.current = onTalk
  onUfoRef.current = onUfo
  onInspectModeRef.current = onInspectMode
  onProcessRef.current = onProcess

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
    const talkLook = new THREE.Vector3()
    const talkUp = new THREE.Vector3()
    const talkFwd = new THREE.Vector3()
    const lookRight = new THREE.Vector3()
    const lookPoint = new THREE.Vector3()
    const LOOK_PARTS = [
      ['close', 1.1],
      ['head', 0.86],
      ['body', 0.54],
      ['legs', 0.3],
      ['feet', 0.07],
    ]
    const talkCam = {
      on: false,
      kind: null,
      pos: new THREE.Vector3(),
      up: new THREE.Vector3(),
      target: new THREE.Vector3(),
    }

    const saveTalkCamera = () => {
      if (talkCam.on) return
      talkCam.pos.copy(camera.position)
      talkCam.up.copy(camera.up)
      talkCam.target.copy(controls.target)
    }

    const lockTalkCamera = () => {
      saveTalkCamera()
      const info = agent.getCollision()
      agent.root.getWorldPosition(talkLook)
      talkUp.copy(info.dir).transformDirection(planet.matrixWorld).normalize()
      talkFwd.copy(info.forward).transformDirection(planet.matrixWorld).normalize()
      const size = Math.max(0.28, info.size ?? 0.5)
      talkLook.addScaledVector(talkUp, size * 0.7)
      camera.up.copy(talkUp)
      camera.position
        .copy(talkLook)
        .addScaledVector(talkFwd, Math.max(1.45, size * 2.8))
        .addScaledVector(talkUp, size * 0.12)
      camera.lookAt(talkLook)
      controls.target.copy(talkLook)
      controls.enabled = false
      talkCam.on = true
      talkCam.kind = 'agent'
    }

    const lockUfoCamera = () => {
      saveTalkCamera()
      ufo.root.getWorldPosition(talkLook)
      talkUp.copy(ufo.dir).transformDirection(planet.matrixWorld)
      if (talkUp.lengthSq() < 1e-6) talkUp.copy(talkLook)
      talkUp.normalize()
      talkFwd.copy(camera.position).sub(talkLook)
      talkFwd.addScaledVector(talkUp, -talkFwd.dot(talkUp))
      if (talkFwd.lengthSq() < 1e-6) {
        talkFwd.set(0, 1, 0).cross(talkUp)
        if (talkFwd.lengthSq() < 1e-6) talkFwd.set(1, 0, 0)
      }
      talkFwd.normalize()
      const size = 1.4
      camera.up.copy(talkUp)
      camera.position
        .copy(talkLook)
        .addScaledVector(talkFwd, Math.max(2.8, size * 2.2))
        .addScaledVector(talkUp, size * 0.18)
      camera.lookAt(talkLook)
      controls.target.copy(talkLook)
      controls.enabled = false
      talkCam.on = true
      talkCam.kind = 'ufo'
      ufo.ping?.()
    }

    const unlockTalkCamera = () => {
      camera.position.copy(talkCam.pos)
      camera.up.copy(talkCam.up)
      controls.target.copy(talkCam.target)
      controls.enabled = true
      talkCam.on = false
      talkCam.kind = null
      heldUntil = performance.now() + 1600
    }

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
    const ufo = createPlanetUfo({
      gradientMap: toonRamp,
      makeInk: () => makeOutlineMaterial(0),
    })
    planet.add(ufo.root)

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
    wire.renderOrder = 1
    planet.add(wire)

    const debugGeom = new THREE.BufferGeometry()
    const debugLandMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
    const debugLand = new THREE.Mesh(debugGeom, debugLandMat)
    debugLand.visible = false
    planet.add(debugLand)

    const siteGeom = new THREE.BufferGeometry()
    const siteMat = new THREE.PointsMaterial({
      size: 8,
      sizeAttenuation: false,
      vertexColors: true,
      depthTest: true,
    })
    const sitePoints = new THREE.Points(siteGeom, siteMat)
    sitePoints.visible = false
    sitePoints.renderOrder = 2
    planet.add(sitePoints)

    const axes = new THREE.AxesHelper(PLANET_RADIUS * 1.25)
    axes.visible = false
    scene.add(axes)

    const grid = new THREE.PolarGridHelper(PLANET_RADIUS * 1.4, 8, 7, 40, INK, 0x7a908c)
    grid.visible = false
    scene.add(grid)

    const graphGeom = new THREE.BufferGeometry()
    const graphMat = new THREE.LineBasicMaterial({ color: 0x3ec4c8, transparent: true, opacity: 0.9 })
    const graphLines = new THREE.LineSegments(graphGeom, graphMat)
    graphLines.visible = false
    graphLines.renderOrder = 5
    planet.add(graphLines)
    const nodeGeom = new THREE.BufferGeometry()
    const nodeMat = new THREE.PointsMaterial({ color: 0xf7f3e8, size: 10, sizeAttenuation: false })
    const graphNodes = new THREE.Points(nodeGeom, nodeMat)
    graphNodes.visible = false
    graphNodes.renderOrder = 6
    planet.add(graphNodes)
    const unusedGeom = new THREE.BufferGeometry()
    const unusedMat = new THREE.PointsMaterial({ color: 0xe07a5f, size: 9, sizeAttenuation: false })
    const unusedNodes = new THREE.Points(unusedGeom, unusedMat)
    unusedNodes.visible = false
    unusedNodes.renderOrder = 6
    planet.add(unusedNodes)
    const refuseGeom = new THREE.BufferGeometry()
    const refuseMat = new THREE.PointsMaterial({ vertexColors: true, size: 6, sizeAttenuation: false })
    const refusePoints = new THREE.Points(refuseGeom, refuseMat)
    refusePoints.visible = false
    refusePoints.renderOrder = 6
    planet.add(refusePoints)

    const probe = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff04a }),
    )
    probe.visible = false
    probe.renderOrder = 3
    planet.add(probe)

    const agentGizmo = new THREE.Group()
    agentGizmo.visible = false
    agentGizmo.renderOrder = 4
    const agentCapMat = new THREE.MeshBasicMaterial({
      color: 0xffc43a,
      wireframe: true,
      transparent: true,
      opacity: 0.9,
    })
    const agentCap = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12), agentCapMat)
    const agentLookMat = new THREE.LineBasicMaterial({ color: 0x4ec4ff })
    const agentLook = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.06, 0),
        new THREE.Vector3(0, 0.06, 1),
      ]),
      agentLookMat,
    )
    const agentTipMat = new THREE.MeshBasicMaterial({ color: 0x38b861 })
    const agentTip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), agentTipMat)
    agentGizmo.add(agentCap, agentLook, agentTip)
    planet.add(agentGizmo)
    const gizmoSide = new THREE.Vector3()
    const gizmoBasis = new THREE.Matrix4()
    const gizmoAhead = new THREE.Vector3()

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

    const inspectMat = new THREE.Matrix4()
    const inspectBox = new THREE.Box3()
    const inspectSize = new THREE.Vector3()
    const inspectCenter = new THREE.Vector3()
    const inspectMark = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffc43a,
        wireframe: true,
        depthTest: false,
        transparent: true,
        opacity: 0.92,
      }),
    )
    inspectMark.renderOrder = 24
    inspectMark.frustumCulled = false
    inspectMark.visible = false
    scene.add(inspectMark)

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
    let hover = null
    let lastHoverKey = ''
    let agentInfo = null
    let lastAgentKey = ''
    let inspectTarget = null
    let inspectPick = null
    let lastInspectKey = ''
    const pointer = new THREE.Vector2(2, 2)
    const raycaster = new THREE.Raycaster()
    const localHit = new THREE.Vector3()

    let townMs = 0
    let processTime = 0
    let processOn = false
    let processSeekId = null
    let processTick = -1
    let lastProcessStage = ''
    let processInfo = null
    let film = null
    let filmCtx = null
    let recorder = null
    let chunks = []
    const filmSize = new THREE.Vector2()
    const filmCam = new THREE.Vector3(0.72, 0.42, 0.55).normalize()

    const publishStats = () => {
      onStatsRef.current?.({
        ...(stats ?? {}),
        ...town.counts,
        hover,
        agent: agentInfo,
        townMs,
        ufo: ufo.root.visible,
        inspect: inspectOnRef?.current === true ? inspectPick : null,
        process: processInfo,
      })
    }

    const pickFilmMime = () => {
      if (typeof MediaRecorder === 'undefined') return ''
      const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
      return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
    }

    const wrapFilmText = (ctx, text, x, y, maxWidth, lineHeight, maxLines) => {
      const words = String(text).split(/\s+/).filter(Boolean)
      let line = ''
      let used = 0
      for (const word of words) {
        const next = line ? `${line} ${word}` : word
        if (ctx.measureText(next).width > maxWidth && line) {
          ctx.fillText(line, x, y)
          y += lineHeight
          line = word
          used += 1
          if (used >= maxLines) return
        } else {
          line = next
        }
      }
      if (line && used < maxLines) ctx.fillText(line, x, y)
    }

    const ensureFilm = (lockSize) => {
      renderer.getDrawingBufferSize(filmSize)
      if (!film) {
        film = document.createElement('canvas')
        filmCtx = film.getContext('2d')
      }
      if (lockSize && recorder) return
      if (film.width !== filmSize.x || film.height !== filmSize.y) {
        film.width = filmSize.x
        film.height = filmSize.y
      }
    }

    const stopFilm = (download) => {
      const rec = recorder
      recorder = null
      const dump = () => {
        if (download && chunks.length) {
          const blob = new Blob(chunks, { type: rec?.mimeType || 'video/webm' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'this-world-process.webm'
          a.click()
          URL.revokeObjectURL(url)
        }
        chunks = []
      }
      if (!rec) {
        chunks = []
        return
      }
      rec.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data)
      }
      rec.onstop = dump
      if (rec.state === 'inactive') dump()
      else rec.stop()
    }

    const startFilm = () => {
      if (recorder || typeof MediaRecorder === 'undefined') return
      ensureFilm(false)
      const mime = pickFilmMime()
      let stream
      try {
        stream = film.captureStream(30)
        recorder = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 }) : new MediaRecorder(stream)
      } catch {
        recorder = null
        return
      }
      chunks = []
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data)
      }
      recorder.start(400)
    }

    const drawFilmCard = (caption, at) => {
      if (!filmCtx || !caption) return
      const w = film.width
      const h = film.height
      const pad = Math.round(h * 0.035)
      const boxH = Math.round(h * 0.2)
      filmCtx.fillStyle = 'rgba(12, 18, 18, 0.78)'
      filmCtx.fillRect(0, h - boxH, w, boxH)
      filmCtx.fillStyle = '#f4efe4'
      filmCtx.font = `600 ${Math.round(h * 0.042)}px "IBM Plex Sans", sans-serif`
      filmCtx.fillText(caption.title, pad, h - boxH + Math.round(h * 0.07))
      filmCtx.fillStyle = '#c9d6d2'
      filmCtx.font = `${Math.round(h * 0.024)}px "IBM Plex Sans", sans-serif`
      wrapFilmText(filmCtx, caption.detail, pad, h - boxH + Math.round(h * 0.11), w - pad * 2, Math.round(h * 0.032), 2)
      filmCtx.fillStyle = '#9eb0ab'
      filmCtx.font = `${Math.round(h * 0.02)}px "IBM Plex Sans", sans-serif`
      filmCtx.fillText(
        `${caption.step}/${caption.steps} · ${formatProcessTime(at.time)} / ${formatProcessTime(at.total)}`,
        pad,
        h - pad * 0.7,
      )
    }

    const blitFilm = (caption, at) => {
      ensureFilm(true)
      if (!filmCtx) return
      filmCtx.drawImage(renderer.domElement, 0, 0, film.width, film.height)
      drawFilmCard(caption, at)
    }

    const applyProcess = (params, dt) => {
      if (params.processOn !== true) {
        if (processOn) {
          town.setProcess(null)
          if (params.debug?.hideTown) town.root.visible = false
          if (recorder) {
            stopFilm(true)
            onProcessRef.current?.({ processRecord: false })
          }
          processOn = false
          processInfo = null
          publishStats()
        }
        processOn = false
        processInfo = null
        return
      }
      if (!processOn) {
        processTime = 0
        lastProcessStage = ''
      }
      processOn = true
      const seek = params.processSeek
      if (seek?.id != null && seek.id !== processSeekId) {
        processSeekId = seek.id
        processTime = Number(seek.time) || 0
        processTick = -1
      }
      if (params.processPaused !== true) processTime += dt * (params.processRate ?? 1)
      const at = processAt(processTime)
      processTime = at.time
      const flags = at.stage.flags
      if (flags.land) {
        ground.visible = false
        debugLand.visible = true
        groundInk.visible = false
        if (lastProcessStage !== at.stage.id) paintDebugLand(params)
      } else if (!flags.filled) {
        ground.visible = false
        debugLand.visible = false
        groundInk.visible = false
      } else {
        ground.visible = params.showMesh !== false
        debugLand.visible = false
        groundInk.visible = params.debug?.hideInk !== true
      }
      wire.visible = flags.wire === true || (!flags.filled && flags.wire !== false)
      if (!flags.filled) wireMat.opacity = 0.7
      ocean.visible = flags.ocean === true && params.planetOcean !== false && flags.filled
      seaInk.visible = ocean.visible && params.debug?.hideInk !== true
      uniforms.uRoadOn.value = flags.roads === true && params.planetRoads !== false ? 1 : 0
      town.setProcess(flags)
      if (params.debug?.hideTown === true && !flags.houses && !flags.trees && !flags.lamps && !flags.cars) {
        town.root.visible = false
      }
      ufo.root.visible = flags.ufo === true && ufo.root.visible
      agent.root.visible = flags.agent === true && params.planetAgent !== false && agent.root.visible
      sitePoints.visible = params.debug?.sites === true && (flags.houses || flags.trees || flags.lamps)
      axes.visible = false
      grid.visible = false
      graphLines.visible = false
      graphNodes.visible = false
      unusedNodes.visible = false
      refusePoints.visible = false
      const caption = processCaption(at.stage, params, {
        ...stats,
        ...town.counts,
        hover,
        agent: agentInfo,
        townMs,
        ufo: ufo.root.visible,
      })
      processInfo = {
        time: at.time,
        total: at.total,
        index: at.index,
        title: caption.title,
        detail: caption.detail,
        step: caption.step,
        steps: caption.steps,
        done: at.done,
        recording: Boolean(recorder) || params.processRecord === true,
      }
      if (at.done && params.processPaused !== true) {
        paramsRef.current.processPaused = true
        const patch = { processPaused: true }
        if (recorder || params.processRecord === true) {
          stopFilm(true)
          paramsRef.current.processRecord = false
          patch.processRecord = false
        }
        onProcessRef.current?.(patch)
      } else if (params.processRecord === true) {
        if (!recorder) {
          startFilm()
          if (!recorder) onProcessRef.current?.({ processRecord: false })
        }
      } else if (recorder) {
        stopFilm(true)
      }
      lastProcessStage = at.stage.id
      const tick = Math.floor(at.time * 8)
      if (tick !== processTick) {
        processTick = tick
        publishStats()
      }
    }

    const markInspectBox = (box) => {
      if (box.isEmpty()) {
        inspectMark.visible = false
        return
      }
      box.getCenter(inspectCenter)
      box.getSize(inspectSize)
      inspectSize.multiplyScalar(1.08)
      inspectMark.position.copy(inspectCenter)
      inspectMark.scale.copy(inspectSize)
      inspectMark.quaternion.identity()
      inspectMark.visible = true
    }

    const instanceWorldBox = (mesh, index) => {
      if (!mesh || index == null || index < 0 || index >= mesh.count) return inspectBox.makeEmpty()
      mesh.updateMatrixWorld(true)
      mesh.getMatrixAt(index, inspectMat)
      inspectMat.premultiply(mesh.matrixWorld)
      inspectBox.setFromBufferAttribute(mesh.geometry.attributes.position)
      inspectBox.applyMatrix4(inspectMat)
      return inspectBox
    }

    const dirFromWorld = (world) => {
      localHit.copy(world)
      planet.worldToLocal(localHit)
      return localHit.lengthSq() > 1e-8 ? localHit.normalize() : localHit.set(0, 1, 0)
    }

    const liveInspect = (params) => {
      const on = inspectOnRef?.current === true
      if (!on) {
        inspectMark.visible = false
        inspectPick = null
        if (renderer.domElement.style.cursor === 'crosshair' || renderer.domElement.style.cursor === 'pointer') {
          renderer.domElement.style.cursor = ''
        }
        return
      }
      if (inspectTarget?.type === 'house' && inspectTarget.index >= (town.walls?.length ?? 0)) inspectTarget = null
      if (inspectTarget?.type === 'tree' && inspectTarget.index >= (town.trunks?.length ?? 0)) inspectTarget = null
      if (inspectTarget?.type === 'car' && inspectTarget.index >= (town.cars?.length ?? 0)) inspectTarget = null
      if (inspectTarget?.type === 'lamp' && inspectTarget.index >= (town.sites?.lamps?.length ?? 0)) inspectTarget = null
      if (!inspectTarget) {
        inspectMark.visible = false
        inspectPick = null
        return
      }

      const look = params.planetAgentLook ?? {}
      const sea = seaRadius(params)
      if (inspectTarget.type === 'walker') {
        agent.root.updateMatrixWorld(true)
        inspectBox.setFromObject(agent.root)
        markInspectBox(inspectBox)
        const pose = agent.getCollision()
        const world = inspectCenter
        const dir = dirFromWorld(world)
        const r = groundRadius(dir, params, surface)
        const at = latLonFromDir(dir)
        inspectPick = {
          kind: 'Walker',
          id: 'walker',
          transform: {
            position: vec3(world),
            scale: [round2(pose.size ?? 0.5), round2(pose.size ?? 0.5), round2(pose.size ?? 0.5)],
            radius: round2(pose.radius ?? 0),
            lat: at.lat,
            lon: at.lon,
          },
          state: {
            moving: pose.moving ? 'walk' : 'idle',
            stuck: pose.stuck ?? 0,
            place: agentInfo?.place ?? '—',
            zone: r < sea ? 'water' : r < sea + SHORE_CLEAR ? 'shore' : 'land',
            delta: round2(r - sea),
            talking: talkOpenRef?.current === true,
            look: ['head', 'body', 'legs', 'feet']
              .map((slot) => LOOK_SWATCHES[look[slot] ?? 0]?.label ?? 'Factory')
              .join(' / '),
          },
          components: ['SkinnedMesh', 'Toon', 'Ink', 'Capsule', 'Mixer', 'Look'],
        }
        return
      }
      if (inspectTarget.type === 'ufo') {
        ufo.root.updateMatrixWorld(true)
        inspectBox.setFromObject(ufo.root)
        markInspectBox(inspectBox)
        const world = inspectCenter
        const dir = ufo.dir?.lengthSq?.() > 0 ? ufo.dir : dirFromWorld(world)
        const at = latLonFromDir(dir)
        inspectPick = {
          kind: 'Saucer',
          id: 'ufo',
          transform: {
            position: vec3(world),
            scale: vec3(ufo.root.scale),
            radius: round2(inspectSize.length() * 0.5),
            lat: at.lat,
            lon: at.lon,
          },
          state: {
            visible: ufo.root.visible,
            ocean: params.planetOcean !== false,
            hover: 'tree-top',
          },
          components: ['Toon saucer', 'Ink', 'Beam', 'Rim lights'],
        }
        return
      }
      if (inspectTarget.type === 'ground' || inspectTarget.type === 'ocean') {
        const world = inspectTarget.point
        if (world) {
          inspectBox.setFromCenterAndSize(world, inspectSize.set(0.35, 0.35, 0.35))
          markInspectBox(inspectBox)
        } else inspectMark.visible = false
        const dir = world ? dirFromWorld(world) : localHit.set(0, 1, 0)
        const r = groundRadius(dir, params, surface)
        const at = latLonFromDir(dir)
        const water = inspectTarget.type === 'ocean'
        inspectPick = {
          kind: water ? 'Ocean' : 'Ground',
          id: water ? 'ocean' : 'ground',
          transform: {
            position: vec3(world),
            scale: [1, 1, 1],
            radius: round2(r),
            lat: at.lat,
            lon: at.lon,
          },
          state: {
            zone: r < sea ? 'water' : r < sea + SHORE_CLEAR ? 'shore' : 'land',
            delta: round2(r - sea),
            mapping: params.planetMapping,
            mesh: params.planetMesh === 'cube' ? 'cube' : 'uv',
          },
          components: water
            ? ['Water sphere', 'Foam', 'Ripples']
            : ['Displaced sphere', 'aElev', 'Toon shader', 'Road mask'],
        }
        return
      }

      const { type, index, mesh } = inspectTarget
      instanceWorldBox(mesh, index)
      markInspectBox(inspectBox)
      const world = inspectCenter.clone()
      const dir = dirFromWorld(world)
      const at = latLonFromDir(dir)
      const r = groundRadius(dir, params, surface)
      if (type === 'house') {
        const wall = town.walls[index]
        inspectPick = {
          kind: 'House',
          id: `house-${index}`,
          transform: {
            position: vec3(world),
            scale: wall ? [round2(wall.halfX * 2), round2(1), round2(wall.halfZ * 2)] : vec3(inspectSize),
            radius: round2(r),
            lat: at.lat,
            lon: at.lon,
          },
          state: {
            index,
            zone: r < sea ? 'water' : r < sea + SHORE_CLEAR ? 'shore' : 'land',
            delta: round2(r - sea),
            collider: 'OBB',
            planted: 'dry footprint',
          },
          components: ['InstancedMesh walls', 'Roof', 'Door', 'Toon', 'Ink', 'OBB'],
        }
        return
      }
      if (type === 'tree') {
        const trunk = town.trunks[index]
        inspectPick = {
          kind: 'Tree',
          id: `tree-${index}`,
          transform: {
            position: vec3(world),
            scale: vec3(inspectSize),
            radius: round2(trunk?.radius ?? r),
            lat: at.lat,
            lon: at.lon,
          },
          state: {
            index,
            zone: r < sea ? 'water' : 'land',
            delta: round2(r - sea),
            trunk: round2(trunk?.radius ?? 0),
            collider: 'circle',
          },
          components: ['InstancedMesh trunk', 'Canopy', 'Toon', 'Ink', 'Trunk circle'],
        }
        return
      }
      if (type === 'lamp') {
        inspectPick = {
          kind: 'Lamp',
          id: `lamp-${index}`,
          transform: {
            position: vec3(world),
            scale: vec3(inspectSize),
            radius: round2(r),
            lat: at.lat,
            lon: at.lon,
          },
          state: {
            index,
            zone: r < sea ? 'water' : 'land',
            delta: round2(r - sea),
            along: 'road',
          },
          components: ['InstancedMesh', 'Toon', 'Emissive', 'Ink'],
        }
        return
      }
      if (type === 'car') {
        const car = town.cars[index]
        inspectPick = {
          kind: 'Car',
          id: `car-${index}`,
          transform: {
            position: vec3(world),
            scale: car ? [round2(car.halfX * 2), round2(1), round2(car.halfZ * 2)] : vec3(inspectSize),
            radius: round2(r),
            lat: at.lat,
            lon: at.lon,
          },
          state: {
            index,
            speed: round2(car?.speed ?? 0),
            stun: round2(car?.stun ?? 0),
            offRoad: Boolean(car?.offRoad),
            edge: car?.edge ?? '—',
            color: car?.color ?? '—',
            collider: 'OBB',
          },
          components: ['InstancedMesh', 'Toon', 'Ink', 'Road driver', 'OBB'],
        }
      }
    }

    const pickInspect = () => {
      const hideTown = paramsRef.current.debug?.hideTown === true
      const list = []
      if (agent.root.visible) list.push(agent.root)
      if (ufo.root.visible) list.push(ufo.root)
      if (!hideTown && town.root.visible) list.push(...town.inspectMeshes())
      if (ground.visible) list.push(ground)
      if (ocean.visible) list.push(ocean)
      const hits = raycaster.intersectObjects(list, true)
      const hit = hits[0]
      if (!hit) return
      if (hit.object === ocean || hit.object.parent === ocean) {
        inspectTarget = { type: 'ocean', point: hit.point.clone() }
        return
      }
      if (hit.object === ground || hit.object.parent === ground) {
        inspectTarget = { type: 'ground', point: hit.point.clone() }
        return
      }
      let node = hit.object
      while (node) {
        if (node === agent.root) {
          inspectTarget = { type: 'walker' }
          return
        }
        if (node === ufo.root) {
          inspectTarget = { type: 'ufo' }
          return
        }
        node = node.parent
      }
      const found = town.identifyPick(hit.object, hit.instanceId)
      inspectTarget = found ?? { type: 'ground', point: hit.point.clone() }
    }

    const inspectCursor = () => {
      if (inspectOnRef?.current !== true) return null
      const hideTown = paramsRef.current.debug?.hideTown === true
      const list = []
      if (agent.root.visible) list.push(agent.root)
      if (ufo.root.visible) list.push(ufo.root)
      if (!hideTown && town.root.visible) list.push(...town.inspectMeshes())
      const hits = raycaster.intersectObjects(list, true)
      return hits.length ? 'pointer' : 'crosshair'
    }

    const syncAgentDebug = (params) => {
      const pose = agent.getCollision()
      const show = params.debug?.agent === true && params.planetAgent !== false
      agentGizmo.visible = show
      if (params.planetAgent === false || !pose?.dir) {
        agentInfo = null
        return
      }
      const r = groundRadius(pose.dir, params, surface)
      const sea = seaRadius(params)
      const delta = r - sea
      agent.root.getWorldPosition(talkLook)
      talkUp.copy(pose.dir).transformDirection(planet.matrixWorld).normalize()
      lookRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
      const height = pose.size ?? 0.5
      const spread = Math.max(0.42, height * 0.78)
      const toScreen = (world) => {
        lookPoint.copy(world).project(camera)
        return {
          x: THREE.MathUtils.clamp(Math.round((lookPoint.x * 0.5 + 0.5) * 1000) / 10, 6, 94),
          y: THREE.MathUtils.clamp(Math.round((-lookPoint.y * 0.5 + 0.5) * 1000) / 10, 6, 94),
        }
      }
      const lookAnchors = {}
      for (const [id, along] of LOOK_PARTS) {
        lookPoint.copy(talkLook).addScaledVector(talkUp, height * along)
        if (id === 'close') {
          lookAnchors.close = toScreen(lookPoint)
          continue
        }
        lookAnchors[id] = {
          left: toScreen(lookPoint.addScaledVector(lookRight, -spread)),
          right: toScreen(lookPoint.copy(talkLook).addScaledVector(talkUp, height * along).addScaledVector(lookRight, spread)),
        }
      }
      agentInfo = {
        lat: Math.asin(THREE.MathUtils.clamp(pose.dir.y, -1, 1)) * (180 / Math.PI),
        lon: Math.atan2(pose.dir.z, pose.dir.x) * (180 / Math.PI),
        radius: r,
        sea,
        delta,
        zone: delta < 0 ? 'water' : delta < SHORE_CLEAR ? 'shore' : 'land',
        moving: pose.moving,
        stuck: pose.stuck ?? 0,
        place: town.placeAt(pose.dir, {
          delta,
          stuck: pose.stuck ?? 0,
          radius: pose.radius,
          hideTown: params.debug?.hideTown === true,
        }),
        lookAnchors,
      }
      if (!show) return
      agentGizmo.position.copy(pose.dir).multiplyScalar(r)
      gizmoSide.crossVectors(pose.dir, pose.forward)
      if (gizmoSide.lengthSq() < 1e-8) gizmoSide.set(0, 1, 0).cross(pose.dir)
      gizmoSide.normalize()
      gizmoBasis.makeBasis(gizmoSide, pose.dir, pose.forward)
      agentGizmo.quaternion.setFromRotationMatrix(gizmoBasis)
      agentCap.scale.set(pose.radius, height, pose.radius)
      agentCap.position.y = height * 0.5
      agentLook.scale.set(1, 1, 0.9)
      agentTip.position.set(0, height * 0.18, 0.82)
      const ang = 0.82 / PLANET_RADIUS
      gizmoAhead
        .copy(pose.dir)
        .multiplyScalar(Math.cos(ang))
        .addScaledVector(pose.forward, Math.sin(ang))
        .normalize()
      const hideTown = params.debug?.hideTown === true
      agentTipMat.color.setHex(
        blockedAt(
          gizmoAhead,
          {
            walls: hideTown ? [] : town.walls,
            trunks: hideTown ? [] : town.trunks,
            cars: hideTown ? [] : town.cars,
          },
          pose.radius * 1.12,
        )
          ? 0xe05a47
          : 0x38b861,
      )
    }

    const paintDebugLand = (params) => {
      const pos = groundGeom.attributes.position
      if (!pos) return
      debugGeom.setAttribute('position', pos)
      debugGeom.setIndex(groundGeom.index)
      const count = pos.count
      let colors = debugGeom.attributes.color
      if (!colors || colors.count !== count) {
        colors = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
        debugGeom.setAttribute('color', colors)
      }
      const sea = seaRadius(params)
      const shore = sea + SHORE_CLEAR
      const arr = colors.array
      for (let i = 0; i < count; i++) {
        const r = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i))
        if (r < sea) {
          arr[i * 3] = 0.16
          arr[i * 3 + 1] = 0.44
          arr[i * 3 + 2] = 0.62
        } else if (r < shore) {
          arr[i * 3] = 0.93
          arr[i * 3 + 1] = 0.72
          arr[i * 3 + 2] = 0.28
        } else {
          arr[i * 3] = 0.42
          arr[i * 3 + 1] = 0.7
          arr[i * 3 + 2] = 0.4
        }
      }
      colors.needsUpdate = true
      debugGeom.computeBoundingSphere()
    }

    const paintDebugElev = () => {
      const pos = groundGeom.attributes.position
      const elev = groundGeom.attributes.aElev
      if (!pos || !elev) return
      debugGeom.setAttribute('position', pos)
      debugGeom.setIndex(groundGeom.index)
      const count = pos.count
      let colors = debugGeom.attributes.color
      if (!colors || colors.count !== count) {
        colors = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
        debugGeom.setAttribute('color', colors)
      }
      const arr = colors.array
      const stops = [
        [0, 0.07, 0.1, 0.28],
        [0.28, 0.16, 0.52, 0.58],
        [0.5, 0.93, 0.78, 0.4],
        [0.72, 0.38, 0.64, 0.32],
        [1, 0.95, 0.94, 0.88],
      ]
      for (let i = 0; i < count; i++) {
        const t = THREE.MathUtils.clamp(elev.getX(i), 0, 1)
        let r = stops[0][1]
        let g = stops[0][2]
        let b = stops[0][3]
        for (let s = 1; s < stops.length; s++) {
          const a = stops[s - 1]
          const c = stops[s]
          if (t <= c[0] || s === stops.length - 1) {
            const u = (t - a[0]) / Math.max(1e-6, c[0] - a[0])
            r = a[1] + (c[1] - a[1]) * u
            g = a[2] + (c[2] - a[2]) * u
            b = a[3] + (c[3] - a[3]) * u
            break
          }
        }
        arr[i * 3] = r
        arr[i * 3 + 1] = g
        arr[i * 3 + 2] = b
      }
      colors.needsUpdate = true
      debugGeom.computeBoundingSphere()
    }

    const paintDebugOverlay = (params) => {
      if (params.debug?.elev === true) paintDebugElev()
      else paintDebugLand(params)
    }

    const syncSitePoints = () => {
      const { houses, trees, lamps } = town.sites
      const n = houses.length + trees.length + lamps.length
      const pos = new Float32Array(n * 3)
      const col = new Float32Array(n * 3)
      let i = 0
      const write = (list, r, g, b) => {
        for (const p of list) {
          pos[i * 3] = p.x
          pos[i * 3 + 1] = p.y
          pos[i * 3 + 2] = p.z
          col[i * 3] = r
          col[i * 3 + 1] = g
          col[i * 3 + 2] = b
          i++
        }
      }
      write(houses, 0.88, 0.35, 0.28)
      write(trees, 0.22, 0.72, 0.38)
      write(lamps, 1, 0.86, 0.32)
      siteGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      siteGeom.setAttribute('color', new THREE.BufferAttribute(col, 3))
      siteGeom.computeBoundingSphere()
    }

    const syncNetwork = () => {
      const net = town.network
      graphGeom.setAttribute('position', new THREE.BufferAttribute(net.lines, 3))
      nodeGeom.setAttribute('position', new THREE.BufferAttribute(net.nodes, 3))
      unusedGeom.setAttribute('position', new THREE.BufferAttribute(net.unused, 3))
      graphGeom.computeBoundingSphere()
      nodeGeom.computeBoundingSphere()
      unusedGeom.computeBoundingSphere()
      const refused = town.sites.refused
      const pos = new Float32Array(refused.length * 3)
      const col = new Float32Array(refused.length * 3)
      const tint = {
        water: [0.86, 0.28, 0.3],
        road: [0.28, 0.62, 0.78],
        crowd: [0.92, 0.62, 0.22],
        far: [0.62, 0.42, 0.78],
      }
      for (let i = 0; i < refused.length; i++) {
        const p = refused[i]
        pos[i * 3] = p.x
        pos[i * 3 + 1] = p.y
        pos[i * 3 + 2] = p.z
        const c = tint[p.reason] ?? tint.water
        col[i * 3] = c[0]
        col[i * 3 + 1] = c[1]
        col[i * 3 + 2] = c[2]
      }
      refuseGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      refuseGeom.setAttribute('color', new THREE.BufferAttribute(col, 3))
      refuseGeom.computeBoundingSphere()
    }

    const countLand = (params) => {
      const elev = groundGeom.attributes.aElev?.array
      if (!elev || !stats) return
      const seaT = seaElevation(span, params)
      let land = 0
      for (let i = 0; i < elev.length; i++) if (elev[i] > seaT) land++
      countedSea = params.planetSeaLevel ?? 0
      stats = {
        ...stats,
        seaT,
        land: land / Math.max(1, elev.length),
        sea: seaRadius(params),
      }
      publishStats()
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
        heightMin: result.min,
        heightMax: result.max,
        mesh: params.planetMesh,
        detail: detail,
      }
      paintDebugOverlay(params)
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

      const debug = params.debug ?? {}
      const filled = params.showMesh !== false
      const landOn = debug.land === true
      const elevOn = debug.elev === true
      const overlayOn = landOn || elevOn
      ground.visible = filled && !overlayOn
      debugLand.visible = overlayOn
      groundInk.visible = filled && debug.hideInk !== true
      wire.visible = !filled || debug.wire === true
      wireMat.opacity = filled && debug.wire === true ? 0.32 : 0.45
      sitePoints.visible = debug.sites === true
      axes.visible = debug.axes === true
      grid.visible = debug.grid === true
      graphLines.visible = debug.graph === true
      graphNodes.visible = debug.graph === true
      unusedNodes.visible = debug.graph === true
      refusePoints.visible = debug.refuse === true
      if (overlayOn) paintDebugOverlay(params)

      ocean.visible = params.planetOcean !== false && filled && debug.hideOcean !== true
      setOceanRes(params.planetOceanRes ?? 128)
      const radius = seaRadius(params)
      ocean.scale.setScalar(radius)
      seaInk.visible = ocean.visible && debug.hideInk !== true
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
      const keep = [
        ocean.visible,
        groundInk.visible,
        seaInk.visible,
        wire.visible,
        debugLand.visible,
        sitePoints.visible,
        probe.visible,
        agentGizmo.visible,
        axes.visible,
        grid.visible,
        graphLines.visible,
        graphNodes.visible,
        unusedNodes.visible,
        refusePoints.visible,
      ]
      ocean.visible = false
      groundInk.visible = false
      seaInk.visible = false
      wire.visible = false
      debugLand.visible = false
      sitePoints.visible = false
      probe.visible = false
      agentGizmo.visible = false
      axes.visible = false
      grid.visible = false
      graphLines.visible = false
      graphNodes.visible = false
      unusedNodes.visible = false
      refusePoints.visible = false
      scene.overrideMaterial = depthOnly
      renderer.setRenderTarget(depthTarget)
      renderer.clear()
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      scene.overrideMaterial = null
      ;[
        ocean.visible,
        groundInk.visible,
        seaInk.visible,
        wire.visible,
        debugLand.visible,
        sitePoints.visible,
        probe.visible,
        agentGizmo.visible,
        axes.visible,
        grid.visible,
        graphLines.visible,
        graphNodes.visible,
        unusedNodes.visible,
        refusePoints.visible,
      ] = keep
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
        const townStarted = performance.now()
        town.build(params, surface)
        ufo.place(params, surface, town.sites.trees)
        townMs = Math.round(performance.now() - townStarted)
        syncSitePoints()
        syncNetwork()
        lastTown = performance.now()
        publishStats()
      }
      const talking = talkOpenRef?.current === true
      const ufoFocus = ufoOpenRef?.current === true
      const freezeCam = talking || ufoFocus
      syncLook(params)
      uniforms.uRoadOn.value = params.planetRoads !== false ? 1 : 0
      if (!freezeCam) planet.rotation.y += dt * (params.planetSpin ?? 0.2) * 0.35
      planet.updateMatrixWorld()
      agent.setTalking?.(talking)
      town.update(dt, params, surface)
      if (params.debug?.hideTown) town.root.visible = false
      ufo.update(dt, params)
      agent.update(dt, params, surface, town)
      town.syncCars(params, surface)
      if (params.debug?.hideAgent) agent.root.visible = false
      applyProcess(params, dt)
      liveInspect(params)
      if (freezeCam) {
        const want = ufoFocus ? 'ufo' : 'agent'
        if (!talkCam.on || talkCam.kind !== want) {
          if (want === 'ufo' && ufo.root.visible) lockUfoCamera()
          else if (want === 'agent' && agent.root.visible) lockTalkCamera()
        }
      } else if (params.processOn === true) {
        if (talkCam.on) unlockTalkCamera()
        controls.enabled = false
        const fit = (PLANET_RADIUS * 1.7) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.max(camera.aspect, 0.2))
        const want = THREE.MathUtils.clamp(Math.max(PLANET_RADIUS * 3.8, fit), controls.minDistance, controls.maxDistance)
        camera.position.copy(filmCam).multiplyScalar(want)
        camera.up.set(0, 1, 0)
        camera.lookAt(0, 0, 0)
        controls.target.set(0, 0, 0)
      } else {
        if (talkCam.on) unlockTalkCamera()
        const follow = params.planetFollow ?? 'robot'
        const target =
          follow === 'robot' && params.planetAgent !== false
            ? agent.root.getWorldPosition(followDir)
            : null
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
      }
      camera.updateMatrixWorld()
      syncAgentDebug(params)
      oceanUniforms.uPhase.value += dt * (params.planetWaveSpeed ?? 1)

      if (!freezeCam && params.processOn !== true) {
        controls.enabled = true
        controls.update()
      }
      const needDepth =
        ocean.visible && (params.planetFoamOn !== false || params.planetRipplesOn !== false)
      oceanUniforms.uUseDepth.value = needDepth ? 1 : 0
      if (needDepth) renderDepth()

      const debugOpen = debugOpenRef?.current === true
      if (debugOpen && pointer.x <= 1) {
        raycaster.setFromCamera(pointer, camera)
        const target = ground.visible ? ground : debugLand.visible ? debugLand : wire
        const hit = raycaster.intersectObject(target, false)[0]
        if (hit) {
          planet.worldToLocal(localHit.copy(hit.point))
          const radius = localHit.length()
          const sea = seaRadius(params)
          const dirY = localHit.y / Math.max(radius, 1e-6)
          const lat = Math.asin(THREE.MathUtils.clamp(dirY, -1, 1)) * (180 / Math.PI)
          const lon = Math.atan2(localHit.z, localHit.x) * (180 / Math.PI)
          let elev = null
          const aElev = groundGeom.attributes.aElev
          if (aElev && hit.face) {
            const bc = hit.barycoord
            const ea = aElev.getX(hit.face.a)
            const eb = aElev.getX(hit.face.b)
            const ec = aElev.getX(hit.face.c)
            elev = bc ? ea * bc.x + eb * bc.y + ec * bc.z : (ea + eb + ec) / 3
          }
          const delta = radius - sea
          hover = {
            lat,
            lon,
            radius,
            sea,
            delta,
            elev,
            zone: delta < 0 ? 'water' : delta < SHORE_CLEAR ? 'shore' : 'land',
          }
          probe.position.copy(localHit)
          probe.visible = true
        } else {
          hover = null
          probe.visible = false
        }
      } else {
        hover = null
        probe.visible = false
      }
      const hoverKey = hover
        ? `${hover.zone}|${hover.lat.toFixed(1)}|${hover.lon.toFixed(1)}|${hover.delta.toFixed(2)}`
        : debugOpen
          ? 'none'
          : ''
      const agentKey = agentInfo
        ? `${agentInfo.moving ? 1 : 0}|${agentInfo.stuck}|${agentInfo.place}|${agentInfo.zone}|${agentInfo.lat.toFixed(1)}|${agentInfo.lon.toFixed(1)}|${agentInfo.lookAnchors?.head?.left?.y ?? 0}|${agentInfo.lookAnchors?.feet?.left?.y ?? 0}`
        : ''
      const inspectKey = inspectOnRef?.current === true ? inspectFingerprint(inspectPick) || 'on' : ''
      if (hoverKey !== lastHoverKey || agentKey !== lastAgentKey || inspectKey !== lastInspectKey) {
        lastHoverKey = hoverKey
        lastAgentKey = agentKey
        lastInspectKey = inspectKey
        publishStats()
      }

      renderer.render(scene, camera)
      if (recorder && processInfo) blitFilm(processInfo, processAt(processTime))
      frameId = requestAnimationFrame(animate)
    }
    animate()

    const onPointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const inspectCursorNow = inspectCursor()
      if (inspectCursorNow) {
        renderer.domElement.style.cursor = inspectCursorNow
      } else {
        const overAgent = agent.root.visible && raycaster.intersectObject(agent.root, true).length > 0
        const overUfo = ufo.root.visible && raycaster.intersectObject(ufo.root, true).length > 0
        renderer.domElement.style.cursor = overAgent || overUfo ? 'pointer' : ''
      }
    }
    const onPointerLeave = () => {
      pointer.set(2, 2)
      renderer.domElement.style.cursor = ''
    }
    let press = null
    const onPointerDown = (event) => {
      if (event.button !== 0) return
      press = { x: event.clientX, y: event.clientY, t: performance.now() }
    }
    const onPointerUp = (event) => {
      if (!press || event.button !== 0) return
      const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y)
      const held = performance.now() - press.t
      press = null
      if (moved > 8 || held > 450) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      if (inspectOnRef?.current === true) {
        pickInspect()
        liveInspect(paramsRef.current)
        publishStats()
        return
      }
      const overAgent = agent.root.visible && raycaster.intersectObject(agent.root, true).length > 0
      const overUfo = ufo.root.visible && raycaster.intersectObject(ufo.root, true).length > 0
      if (overAgent) onTalkRef.current?.(true)
      else if (overUfo) onUfoRef.current?.(true)
      else {
        if (talkOpenRef?.current) onTalkRef.current?.(false)
        if (ufoOpenRef?.current) onUfoRef.current?.(false)
      }
    }
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerleave', onPointerLeave)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    const onKeyDown = (event) => {
      if (event.code !== 'Space' && event.key !== ' ') return
      const tag = String(event.target?.tagName ?? '')
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return
      event.preventDefault()
      if (event.repeat) return
      const next = inspectOnRef?.current !== true
      if (!next) {
        inspectTarget = null
        inspectPick = null
        inspectMark.visible = false
        renderer.domElement.style.cursor = ''
        publishStats()
      } else {
        renderer.domElement.style.cursor = 'crosshair'
      }
      onInspectModeRef.current?.(next)
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      cancelAnimationFrame(frameId)
      stopFilm(false)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.style.cursor = ''
      controls.dispose()
      unit?.dispose()
      groundGeom.dispose()
      groundMat.dispose()
      wireMat.dispose()
      debugGeom.dispose()
      debugLandMat.dispose()
      siteGeom.dispose()
      siteMat.dispose()
      graphGeom.dispose()
      graphMat.dispose()
      nodeGeom.dispose()
      nodeMat.dispose()
      unusedGeom.dispose()
      unusedMat.dispose()
      refuseGeom.dispose()
      refuseMat.dispose()
      axes.geometry.dispose()
      axes.material.dispose()
      grid.geometry.dispose()
      grid.material.dispose()
      probe.geometry.dispose()
      probe.material.dispose()
      agentCap.geometry.dispose()
      agentCapMat.dispose()
      agentLook.geometry.dispose()
      agentLookMat.dispose()
      agentTip.geometry.dispose()
      agentTipMat.dispose()
      oceanGeom?.dispose()
      oceanMat.dispose()
      depthTarget.depthTexture.dispose()
      depthTarget.dispose()
      depthOnly.dispose()
      inspectMark.geometry.dispose()
      inspectMark.material.dispose()
      agent.dispose()
      ufo.dispose()
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
  }, [paramsRef, debugOpenRef, talkOpenRef, ufoOpenRef, inspectOnRef])

  return <div className="galaxy-canvas" ref={mountRef} />
}
