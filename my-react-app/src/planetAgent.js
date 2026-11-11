import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { PLANET_RADIUS } from './planet.js'
import { capsuleRadius, createWalker } from './planetWalker.js'

const MODEL_URL = `${import.meta.env.BASE_URL}models/RobotExpressive.glb`

export const AGENT_MODES = [
  { id: 'walk', label: 'Walk', clip: 'Walking' },
  { id: 'run', label: 'Run', clip: 'Running' },
  { id: 'idle', label: 'Idle', clip: 'Idle' },
  { id: 'dance', label: 'Dance', clip: 'Dance' },
  { id: 'sit', label: 'Sit', clip: 'Sitting' },
]

export const FOLLOW_MODES = [
  { id: 'robot', label: 'Robot' },
  { id: 'free', label: 'Free' },
]

export const AGENT_EMOTES = ['Jump', 'Yes', 'No', 'Wave', 'Punch', 'ThumbsUp']

export const AGENT_EXPRESSIONS = [
  { key: 'planetAgentAngry', morph: 'Angry', label: 'Angry' },
  { key: 'planetAgentSurprised', morph: 'Surprised', label: 'Surprised' },
  { key: 'planetAgentSad', morph: 'Sad', label: 'Sad' },
]

/** Messenger-style clothing slots. Arrows cycle each row around the walker. */
export const LOOK_SLOTS = [
  { id: 'head', label: 'Head' },
  { id: 'body', label: 'Body' },
  { id: 'legs', label: 'Legs' },
  { id: 'feet', label: 'Feet' },
]

/** Toy palettes. Index 0 is the stock RobotExpressive paint. */
export const LOOK_SWATCHES = [
  { id: 'factory', label: 'Factory', main: '#c26a0a', trim: '#5f5e55', ink: '#0c0c0c' },
  { id: 'cream', label: 'Cream', main: '#f3ead3', trim: '#7b8486', ink: '#1e2b2b' },
  { id: 'sun', label: 'Sun', main: '#e9b44c', trim: '#5f5e55', ink: '#1e2b2b' },
  { id: 'roof', label: 'Roof', main: '#e07a5f', trim: '#f7f3e8', ink: '#1e2b2b' },
  { id: 'teal', label: 'Teal', main: '#5b8e9d', trim: '#3a4646', ink: '#1e2b2b' },
  { id: 'leaf', label: 'Leaf', main: '#4f9158', trim: '#8a6a4f', ink: '#1e2b2b' },
  { id: 'ink', label: 'Ink', main: '#1e2b2b', trim: '#d9d3c3', ink: '#0c0c0c' },
  { id: 'paper', label: 'Paper', main: '#f7f3e8', trim: '#c47a1a', ink: '#1e2b2b' },
]

export function defaultAgentLook() {
  return { head: 0, body: 0, legs: 0, feet: 0 }
}

export function cycleAgentLook(look, slot, dir) {
  const n = LOOK_SWATCHES.length
  const next = { ...defaultAgentLook(), ...look }
  const now = ((next[slot] ?? 0) + dir) % n
  next[slot] = now < 0 ? now + n : now
  return next
}

function lookSlot(name) {
  const n = String(name || '')
  if (n.startsWith('Head')) return 'head'
  // Boots are LowerLeg + the Foot cubes. Keep them on one slot so the pair matches.
  if (n.startsWith('Foot') || n.startsWith('LowerLeg')) return 'feet'
  if (n.startsWith('Leg') || n.startsWith('UpperLeg')) return 'legs'
  return 'body'
}

function lookSlotOf(object) {
  for (const node of [object, object.parent, object.parent?.parent]) {
    const slot = lookSlot(node?.name)
    if (slot !== 'body') return slot
  }
  return 'body'
}

export function createAgentParams() {
  return {
    planetAgent: true,
    planetAgentMode: 'walk',
    planetAgentAuto: true,
    planetFollow: 'free',
    planetAgentSize: 0.5,
    planetAgentSpeed: 1,
    planetAgentEmote: null,
    planetAgentAngry: 0,
    planetAgentSurprised: 0,
    planetAgentSad: 0,
    planetAgentLook: defaultAgentLook(),
  }
}

/** World-space ink line width on the robot. */
const INK_WIDTH = 0.012
const RUN_FACTOR = 2.6
const AUTO_EMOTES = ['Wave', 'Yes', 'ThumbsUp', 'Jump']

/**
 * The RobotExpressive character from the three.js skinning + morph example, walking on the planet.
 * `makeInk()` returns an inverted-hull material with `userData.thickness` (a uniform).
 */
export function createPlanetAgent({ gradientMap, makeInk }) {
  const root = new THREE.Group()
  root.visible = false

  const walker = createWalker()

  let model = null
  let mixer = null
  let face = null
  let modelHeight = 1
  let modelFloor = 0
  const actions = {}
  const inks = []
  const owned = []
  let active = null
  let baseClip = 'Walking'
  let emoting = false
  let lastEmoteId = null
  let autoTimer = 6 + Math.random() * 6
  let autoPause = 0
  let disposed = false
  let appliedSize = -1
  let seated = false
  let walkingNow = false
  let talking = false
  let lastLookKey = ''
  const plantedFeet = []

  const fadeTo = (name, duration = 0.35) => {
    const next = actions[name]
    if (!next || next === active) return
    const prev = active
    active = next
    if (prev) prev.fadeOut(duration)
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play()
  }

  const playEmote = (name) => {
    if (!actions[name]) return
    emoting = true
    if (actions[name] === active) active.reset().play()
    else fadeTo(name, 0.2)
  }

  new GLTFLoader().load(MODEL_URL, (gltf) => {
    if (disposed) return
    model = gltf.scene

    const meshes = []
    const sourceMaterials = new Set()
    const toonByKey = new Map()
    model.traverse((object) => {
      if (!object.isMesh) return
      const list = Array.isArray(object.material) ? object.material : [object.material]
      list.forEach((source) => source && sourceMaterials.add(source))
      const toon = list.map((source) => {
        const kind = source.name || 'Main'
        const slot = lookSlotOf(object)
        const key = `${slot}|${kind}`
        if (toonByKey.has(key)) return toonByKey.get(key)
        const material = new THREE.MeshToonMaterial({
          color: source.color?.clone?.() ?? source.color,
          map: source.map ?? null,
          gradientMap,
        })
        material.userData.lookKind = kind
        owned.push(material)
        toonByKey.set(key, material)
        return material
      })
      object.material = Array.isArray(object.material) ? toon : toon[0]
      meshes.push(object)
    })
    for (const source of sourceMaterials) source.dispose()

    model.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(model)
    modelHeight = Math.max(0.01, box.max.y - box.min.y)
    modelFloor = box.min.y

    const meshScale = new THREE.Vector3()
    for (const mesh of meshes) {
      const material = makeInk()
      owned.push(material)
      const ink = mesh.isSkinnedMesh
        ? new THREE.SkinnedMesh(mesh.geometry, material)
        : new THREE.Mesh(mesh.geometry, material)
      if (mesh.isSkinnedMesh) ink.bind(mesh.skeleton, mesh.bindMatrix)
      if (mesh.morphTargetInfluences) {
        ink.morphTargetInfluences = mesh.morphTargetInfluences
        ink.morphTargetDictionary = mesh.morphTargetDictionary
      }
      ink.position.copy(mesh.position)
      ink.quaternion.copy(mesh.quaternion)
      ink.scale.copy(mesh.scale)
      ink.frustumCulled = false
      mesh.frustumCulled = false
      mesh.parent.add(ink)
      mesh.getWorldScale(meshScale)
      const lookKind = [].concat(mesh.material)[0]?.userData?.lookKind
      inks.push({
        material,
        scale: Math.max(1e-4, meshScale.x),
        ink,
        lookKind,
      })
    }

    face = model.getObjectByName('Head_4') ?? null
    model.traverse((object) => {
      if (object.isBone && /^Foot\.[LR]$/.test(object.name)) {
        plantedFeet.push({
          bone: object,
          position: object.position.clone(),
          quaternion: object.quaternion.clone(),
        })
      }
    })
    root.add(model)

    mixer = new THREE.AnimationMixer(model)
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip)
      actions[clip.name] = action
      if (AGENT_EMOTES.includes(clip.name) || clip.name === 'Death') {
        action.clampWhenFinished = true
        action.loop = THREE.LoopOnce
      }
    }
    mixer.addEventListener('finished', () => {
      emoting = false
      fadeTo(baseClip, 0.25)
    })
    fadeTo(baseClip, 0)
  })

  const paintLook = (look) => {
    if (!model) return
    const slots = { ...defaultAgentLook(), ...look }
    model.traverse((object) => {
      if (!object.isMesh || object.material?.userData?.thickness) return
      const swatch = LOOK_SWATCHES[slots[lookSlotOf(object)] ?? 0] ?? LOOK_SWATCHES[0]
      const list = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of list) {
        const kind = material.userData.lookKind
        if (kind === 'Main') material.color.set(swatch.main)
        else if (kind === 'Grey') material.color.set(swatch.trim)
      }
    })
  }

  /** Call once per frame with the ground surface sampler. */
  const update = (dt, params, surface, town) => {
    root.visible = params.planetAgent !== false && Boolean(model)
    if (!model || params.planetAgent === false) {
      walkingNow = false
      return
    }
    const hideTown = params.debug?.hideTown === true
    const walls = hideTown ? [] : town?.walls
    const trunks = hideTown ? [] : town?.trunks
    const cars = hideTown ? [] : town?.cars

    const size = params.planetAgentSize ?? 0.5
    if (size !== appliedSize) {
      appliedSize = size
      const scale = size / modelHeight
      model.scale.setScalar(scale)
      model.position.y = -modelFloor * scale
      for (const ink of inks) ink.material.userData.thickness.value = INK_WIDTH / (ink.scale * scale)
    }

    const look = params.planetAgentLook ?? defaultAgentLook()
    const lookKey = `${look.head}|${look.body}|${look.legs}|${look.feet}`
    if (lookKey !== lastLookKey) {
      lastLookKey = lookKey
      paintLook(look)
    }

    const emote = params.planetAgentEmote
    if (emote && emote.id !== lastEmoteId) {
      lastEmoteId = emote.id
      playEmote(emote.name)
    }

    const mode = AGENT_MODES.find((item) => item.id === params.planetAgentMode) ?? AGENT_MODES[0]
    const moving = mode.id === 'walk' || mode.id === 'run'
    if (params.planetAgentAuto !== false && moving && !emoting && !talking) {
      if (autoPause > 0) {
        autoPause -= dt
        if (autoPause <= 0) autoTimer = 7 + Math.random() * 9
      } else {
        autoTimer -= dt
        if (autoTimer <= 0) {
          if (Math.random() < 0.6) {
            playEmote(AUTO_EMOTES[Math.floor(Math.random() * AUTO_EMOTES.length)])
            autoTimer = 7 + Math.random() * 9
          } else {
            autoPause = 1.5 + Math.random() * 2
          }
        }
      }
    }

    const walking = moving && !emoting && autoPause <= 0 && !talking
    walkingNow = walking
    const wantClip = walking ? mode.clip : moving ? 'Idle' : mode.clip
    if (wantClip !== baseClip) {
      baseClip = wantClip
      if (!emoting) fadeTo(baseClip)
    }

    if (!seated && walls?.length) {
      const wall = walls[0]
      const at = wall.dir
        .clone()
        .addScaledVector(wall.forward, -(wall.halfZ + 0.55) / PLANET_RADIUS)
        .normalize()
      walker.start(at, wall.forward)
      seated = true
    }

    const speed = (params.planetAgentSpeed ?? 1) * (mode.id === 'run' ? RUN_FACTOR : 1)
    const collision = {
      walls,
      trunks,
      cars,
      capsuleRadius: capsuleRadius(params.planetAgentSize),
      speed,
    }
    if (walking) walker.step(dt, speed * dt, params, 1, collision)
    walker.place(root, dt, params, surface, collision)

    if (face?.morphTargetDictionary) {
      for (const expression of AGENT_EXPRESSIONS) {
        const index = face.morphTargetDictionary[expression.morph]
        if (index !== undefined) face.morphTargetInfluences[index] = params[expression.key] ?? 0
      }
    }

    mixer.update(dt)
    if (talking) {
      for (const foot of plantedFeet) {
        foot.bone.position.copy(foot.position)
        foot.bone.quaternion.copy(foot.quaternion)
      }
    }
  }

  const dispose = () => {
    disposed = true
    mixer?.stopAllAction()
    model?.traverse((object) => {
      if (object.isMesh && !object.material?.userData?.thickness) object.geometry.dispose()
    })
    for (const material of owned) material.dispose()
  }

  return {
    root,
    update,
    setTalking: (value) => {
      talking = value === true
    },
    dispose,
    getCollision: () => {
      const size = appliedSize > 0 ? appliedSize : 0.5
      const debug = walker.debugState?.() ?? {}
      return {
        dir: walker.dir,
        forward: walker.forward,
        radius: capsuleRadius(size),
        size,
        moving: walkingNow,
        stuck: debug.stuck ?? 0,
        steerHold: debug.steerHold ?? 0,
      }
    },
    reset: () => {
      seated = false
      walker.reset()
    },
  }
}
