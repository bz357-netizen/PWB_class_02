import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  SKIN_EMOTES,
  SKIN_EXPRESSIONS,
  SKIN_HOLD,
  SKIN_PARTS,
  SKIN_TAPE_MAX,
  SKIN_TICK,
  copyPose,
  findPartBone,
  partPose,
} from './skinStudio.js'

const MODEL_URL = `${import.meta.env.BASE_URL}models/RobotExpressive.glb`
const INK = 0x1e2b2b

function makeToonRamp() {
  const texture = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

function fadeTo(actions, from, name, duration) {
  const next = actions[name]
  if (!next) return from
  if (next === from) {
    next.reset().play()
    return next
  }
  from?.fadeOut(duration)
  next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play()
  return next
}

function hardCut(actions, from, name, time) {
  const next = actions[name]
  if (!next) return from
  if (from && from !== next) {
    from.stop()
    from.enabled = false
  }
  next.enabled = true
  next.paused = false
  next.setEffectiveWeight(1)
  next.setEffectiveTimeScale(1)
  next.time = Math.max(0, time)
  next.play()
  return next
}

export default function SkinCanvas({ paramsRef, onStats }) {
  const mountRef = useRef(null)
  const onStatsRef = useRef(onStats)
  onStatsRef.current = onStats

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x8ec4c0)
    scene.fog = new THREE.Fog(0x8ec4c0, 12, 28)

    const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 80)
    camera.position.set(2.6, 1.7, 4.4)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.02
    renderer.setClearColor(0x8ec4c0, 1)
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, 1.05, 0)
    controls.minDistance = 1.6
    controls.maxDistance = 12
    controls.maxPolarAngle = Math.PI * 0.49

    scene.add(new THREE.HemisphereLight(0xf7f3ea, 0x4a6a68, 0.9))
    scene.add(new THREE.AmbientLight(0xeaf4f0, 0.55))
    const sun = new THREE.DirectionalLight(0xfff6e4, 1.7)
    sun.position.set(4, 8, 5)
    scene.add(sun)

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(8, 64),
      new THREE.MeshToonMaterial({ color: 0xf4efe6 }),
    )
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)
    const grid = new THREE.GridHelper(10, 20, INK, 0xb7c4c2)
    grid.position.y = 0.002
    grid.material.transparent = true
    grid.material.opacity = 0.35
    scene.add(grid)

    const toonRamp = makeToonRamp()
    const extraEuler = new THREE.Euler()
    const extraQuat = new THREE.Quaternion()
    const boneWorld = new THREE.Vector3()
    const owned = []
    const bones = []
    const meshes = []
    const actions = {}
    let model = null
    let mixer = null
    let face = null
    let skeleton = null
    let axes = null
    let active = null
    let baseClip = 'Walking'
    let emoting = false
    let lastEmoteId = null
    let lastStepId = null
    let lastSeekId = null
    let lastClearId = null
    let lastHeadId = null
    let wasRecording = false
    let leftover = 0
    const tape = []
    let playhead = 0
    let appliedSnap = null
    let disposed = false

    const clipName = () => active?.getClip?.()?.name ?? baseClip

    const takeSnap = (params) => ({
      clip: clipName(),
      emoting: emoting ? 1 : 0,
      mixerTime: mixer?.time ?? 0,
      actionTime: active?.time ?? 0,
      angry: params.skinAngry ?? 0,
      surprised: params.skinSurprised ?? 0,
      sad: params.skinSad ?? 0,
      pose: copyPose(params.skinPose),
    })

    const applySnap = (snap) => {
      if (!mixer || !snap) return
      appliedSnap = snap
      emoting = snap.emoting === 1
      baseClip = snap.clip
      active = hardCut(actions, active, snap.clip, snap.actionTime)
      mixer.time = snap.mixerTime
      mixer.update(0)
    }

    const pushSnap = (params) => {
      if (tape.length >= SKIN_TAPE_MAX) tape.shift()
      tape.push(takeSnap(params))
      playhead = tape.length - 1
    }

    const publish = (params) => {
      const duration = active?.getClip?.()?.duration ?? 0
      onStatsRef.current?.({
        clip: clipName(),
        bones: bones.length,
        part: params.skinPart,
        paused: params.skinPaused === true,
        rate: params.skinRate ?? 1,
        time: active?.time ?? 0,
        duration,
        tape: tape.length,
        playhead,
        recording: params.skinRecord === true,
        replaying: params.skinReplay === true,
        seed: params.skinSeed ?? 1,
        townSeed: params.planetTownSeed ?? 1,
        seedLock: params.seedLock !== false,
      })
    }

    new GLTFLoader().load(MODEL_URL, (gltf) => {
      if (disposed) return
      model = gltf.scene
      const sourceMaterials = new Set()
      model.traverse((object) => {
        if (object.isBone) bones.push(object)
        if (!object.isMesh) return
        const list = Array.isArray(object.material) ? object.material : [object.material]
        list.forEach((source) => source && sourceMaterials.add(source))
        const toon = list.map((source) => {
          const material = new THREE.MeshToonMaterial({
            color: source.color?.clone?.() ?? source.color,
            map: source.map ?? null,
            gradientMap: toonRamp,
          })
          owned.push(material)
          return material
        })
        object.material = Array.isArray(object.material) ? toon : toon[0]
        object.frustumCulled = false
        meshes.push(object)
      })
      for (const source of sourceMaterials) source.dispose()

      model.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(model)
      const height = Math.max(0.01, box.max.y - box.min.y)
      model.scale.setScalar(2.15 / height)
      model.updateMatrixWorld(true)
      box.setFromObject(model)
      model.position.y -= box.min.y
      scene.add(model)

      skeleton = new THREE.SkeletonHelper(model)
      skeleton.frustumCulled = false
      skeleton.material.depthTest = false
      scene.add(skeleton)

      axes = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.07, 0),
        new THREE.MeshBasicMaterial({ color: 0xffc43a, depthTest: false }),
      )
      axes.frustumCulled = false
      axes.renderOrder = 20
      axes.visible = false
      scene.add(axes)

      face = model.getObjectByName('Head_4') ?? null
      mixer = new THREE.AnimationMixer(model)
      for (const clip of gltf.animations) {
        const action = mixer.clipAction(clip)
        actions[clip.name] = action
        if (SKIN_EMOTES.includes(clip.name) || SKIN_HOLD.has(clip.name)) {
          action.clampWhenFinished = true
          action.loop = THREE.LoopOnce
        }
      }
      mixer.addEventListener('finished', () => {
        if (!emoting) return
        emoting = false
        if (!SKIN_HOLD.has(baseClip)) active = fadeTo(actions, active, baseClip, 0.25)
      })
      active = fadeTo(actions, null, 'Walking', 0)
      publish(paramsRef.current)
    })

    const resize = () => {
      const width = Math.max(1, mount.clientWidth)
      const height = Math.max(1, mount.clientHeight)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(mount)

    const applyOverlay = (params, snap) => {
      const morphs = snap ?? params
      if (face?.morphTargetDictionary) {
        const values = {
          skinAngry: morphs.angry ?? morphs.skinAngry ?? 0,
          skinSurprised: morphs.surprised ?? morphs.skinSurprised ?? 0,
          skinSad: morphs.sad ?? morphs.skinSad ?? 0,
        }
        for (const expression of SKIN_EXPRESSIONS) {
          const index = face.morphTargetDictionary[expression.morph]
          if (index !== undefined) face.morphTargetInfluences[index] = values[expression.key] ?? 0
        }
      }
      const pose = snap?.pose ?? params.skinPose ?? {}
      for (const part of SKIN_PARTS) {
        const bone = findPartBone(bones, part)
        if (!bone) continue
        const slot = partPose(pose, part.id)
        if (!slot.x && !slot.y && !slot.z) continue
        extraEuler.set(
          THREE.MathUtils.degToRad(slot.x),
          THREE.MathUtils.degToRad(slot.y),
          THREE.MathUtils.degToRad(slot.z),
          'XYZ',
        )
        extraQuat.setFromEuler(extraEuler)
        bone.quaternion.multiply(extraQuat)
      }
      const selected = findPartBone(
        bones,
        SKIN_PARTS.find((part) => part.id === params.skinPart) ?? SKIN_PARTS[0],
      )
      if (axes) {
        if (selected) {
          selected.getWorldPosition(boneWorld)
          axes.position.copy(boneWorld)
          axes.visible = true
        } else {
          axes.visible = false
        }
      }
    }

    const tickLive = (params) => {
      mixer.timeScale = 1
      mixer.update(SKIN_TICK)
      if (params.skinRecord === true) pushSnap(params)
    }

    const tickReplay = (dir) => {
      if (!tape.length) return
      playhead = Math.max(0, Math.min(tape.length - 1, playhead + dir))
      applySnap(tape[playhead])
    }

    let frame = 0
    let last = performance.now()
    let statsAt = 0
    const animate = (now) => {
      frame = requestAnimationFrame(animate)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const params = paramsRef.current
      const want = params.skinClip || 'Walking'
      const paused = params.skinPaused === true
      const rate = Math.max(0, params.skinRate ?? 1)
      const recording = params.skinRecord === true
      const replaying = params.skinReplay === true && tape.length > 0

      if (mixer && model) {
        if (recording && !wasRecording) {
          tape.length = 0
          playhead = 0
          appliedSnap = null
        }
        wasRecording = recording
        const clear = params.skinTapeClear
        if (clear && clear.id !== lastClearId) {
          lastClearId = clear.id
          tape.length = 0
          playhead = 0
          appliedSnap = null
        }
        if (want !== baseClip && !replaying) {
          baseClip = want
          if (!emoting) {
            active = fadeTo(actions, active, baseClip, 0.35)
            appliedSnap = null
          }
        }
        const emote = params.skinEmote
        if (!replaying && emote && emote.id !== lastEmoteId && actions[emote.name]) {
          lastEmoteId = emote.id
          emoting = true
          active = fadeTo(actions, active, emote.name, 0.2)
        }
        const seek = params.skinSeek
        if (!replaying && seek && seek.id !== lastSeekId && active) {
          lastSeekId = seek.id
          active.time = Math.max(0, Math.min(active.getClip().duration, seek.time ?? 0))
          mixer.update(0)
        }
        const head = params.skinPlayhead
        if (head && head.id !== lastHeadId && tape.length) {
          lastHeadId = head.id
          playhead = Math.max(0, Math.min(tape.length - 1, Math.round(head.frame ?? 0)))
          applySnap(tape[playhead])
        }

        const step = params.skinStep
        const stepNow = step && step.id !== lastStepId
        if (stepNow) lastStepId = step.id
        const dir = step?.dir < 0 ? -1 : 1

        if (replaying) {
          if (stepNow) tickReplay(dir)
          else if (!paused) {
            leftover += dt * rate
            while (leftover >= SKIN_TICK) {
              leftover -= SKIN_TICK
              tickReplay(1)
            }
          } else {
            mixer.update(0)
          }
        } else {
          appliedSnap = null
          if (stepNow) {
            leftover = 0
            if (dir < 0 && active) {
              active.time = Math.max(0, active.time - SKIN_TICK)
              mixer.update(0)
              if (recording) pushSnap(params)
            } else tickLive(params)
          } else if (paused) {
            leftover = 0
            mixer.update(0)
          } else {
            leftover += dt * rate
            while (leftover >= SKIN_TICK) {
              leftover -= SKIN_TICK
              tickLive(params)
            }
            mixer.update(0)
          }
        }

        applyOverlay(params, replaying ? appliedSnap : null)
      }

      const showMesh = params.skinMesh !== false
      for (const mesh of meshes) {
        mesh.visible = true
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const material of list) {
          material.transparent = !showMesh
          material.opacity = showMesh ? 1 : 0.16
          material.depthWrite = showMesh
        }
      }
      if (skeleton) skeleton.visible = params.skinSkeleton !== false
      floor.visible = true

      if (now - statsAt > 180) {
        statsAt = now
        publish(params)
      }
      controls.update()
      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(animate)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      mixer?.stopAllAction()
      controls.dispose()
      toonRamp.dispose()
      floor.geometry.dispose()
      floor.material.dispose()
      grid.geometry.dispose()
      grid.material.dispose()
      axes?.geometry.dispose()
      if (Array.isArray(axes?.material)) axes.material.forEach((item) => item.dispose())
      else axes?.material?.dispose()
      skeleton?.geometry.dispose()
      skeleton?.material.dispose()
      model?.traverse((object) => {
        if (object.isMesh) object.geometry.dispose()
      })
      for (const material of owned) material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [paramsRef])

  return <div className="galaxy-canvas" ref={mountRef} />
}
