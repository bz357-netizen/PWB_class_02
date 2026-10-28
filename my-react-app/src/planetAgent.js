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
    model.traverse((object) => {
      if (!object.isMesh) return
      const list = Array.isArray(object.material) ? object.material : [object.material]
      const toon = list.map((source) => {
        const material = new THREE.MeshToonMaterial({
          color: source.color,
          map: source.map ?? null,
          gradientMap,
        })
        source.dispose()
        owned.push(material)
        return material
      })
      object.material = Array.isArray(object.material) ? toon : toon[0]
      meshes.push(object)
    })

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
      inks.push({ material, scale: Math.max(1e-4, meshScale.x) })
    }

    face = model.getObjectByName('Head_4') ?? null
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

  /** Call once per frame with the ground surface sampler. */
  const update = (dt, params, surface, walls) => {
    root.visible = params.planetAgent !== false && Boolean(model)
    if (!model || params.planetAgent === false) return

    const size = params.planetAgentSize ?? 0.5
    if (size !== appliedSize) {
      appliedSize = size
      const scale = size / modelHeight
      model.scale.setScalar(scale)
      model.position.y = -modelFloor * scale
      for (const ink of inks) ink.material.userData.thickness.value = INK_WIDTH / (ink.scale * scale)
    }

    const emote = params.planetAgentEmote
    if (emote && emote.id !== lastEmoteId) {
      lastEmoteId = emote.id
      playEmote(emote.name)
    }

    const mode = AGENT_MODES.find((item) => item.id === params.planetAgentMode) ?? AGENT_MODES[0]
    const moving = mode.id === 'walk' || mode.id === 'run'
    if (params.planetAgentAuto !== false && moving && !emoting) {
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

    const walking = moving && !emoting && autoPause <= 0
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

    const collision = {
      walls,
      capsuleRadius: capsuleRadius(params.planetAgentSize),
    }
    if (walking) {
      const speed = (params.planetAgentSpeed ?? 1) * (mode.id === 'run' ? RUN_FACTOR : 1)
      walker.step(dt, speed * dt, params, 1, collision)
    }
    walker.place(root, dt, params, surface, collision)

    if (face?.morphTargetDictionary) {
      for (const expression of AGENT_EXPRESSIONS) {
        const index = face.morphTargetDictionary[expression.morph]
        if (index !== undefined) face.morphTargetInfluences[index] = params[expression.key] ?? 0
      }
    }

    mixer.update(dt)
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
    dispose,
    reset: () => {
      seated = false
      walker.reset()
    },
  }
}
