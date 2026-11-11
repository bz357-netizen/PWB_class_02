/** Same clips as three.js webgl_animation_skinning_morph. */
export const SKIN_STATES = [
  { id: 'Idle', label: 'Idle' },
  { id: 'Walking', label: 'Walk' },
  { id: 'Running', label: 'Run' },
  { id: 'Dance', label: 'Dance' },
  { id: 'Sitting', label: 'Sit' },
  { id: 'Standing', label: 'Stand' },
  { id: 'Death', label: 'Death' },
]

export const SKIN_EMOTES = ['Jump', 'Yes', 'No', 'Wave', 'Punch', 'ThumbsUp']

export const SKIN_HOLD = new Set(['Death', 'Sitting', 'Standing'])

export const SKIN_EXPRESSIONS = [
  { key: 'skinAngry', morph: 'Angry', label: 'Angry' },
  { key: 'skinSurprised', morph: 'Surprised', label: 'Surprised' },
  { key: 'skinSad', morph: 'Sad', label: 'Sad' },
]

/** Joints a starter can turn. Names match RobotExpressive (mixamorig*). */
export const SKIN_PARTS = [
  { id: 'head', label: 'Head', names: ['Head'] },
  { id: 'neck', label: 'Neck', names: ['Neck'] },
  { id: 'spine', label: 'Chest', names: ['Spine2', 'Spine1'] },
  { id: 'hips', label: 'Hips', names: ['Hips'] },
  { id: 'armL', label: 'Left arm', names: ['LeftArm'] },
  { id: 'foreL', label: 'Left forearm', names: ['LeftForeArm'] },
  { id: 'handL', label: 'Left hand', names: ['LeftHand'] },
  { id: 'armR', label: 'Right arm', names: ['RightArm'] },
  { id: 'foreR', label: 'Right forearm', names: ['RightForeArm'] },
  { id: 'handR', label: 'Right hand', names: ['RightHand'] },
  { id: 'upLegL', label: 'Left thigh', names: ['LeftUpLeg'] },
  { id: 'legL', label: 'Left shin', names: ['LeftLeg'] },
  { id: 'footL', label: 'Left foot', names: ['LeftFoot'] },
  { id: 'upLegR', label: 'Right thigh', names: ['RightUpLeg'] },
  { id: 'legR', label: 'Right shin', names: ['RightLeg'] },
  { id: 'footR', label: 'Right foot', names: ['RightFoot'] },
]

/** One simulation tick. Pause + Step and the tape all use this, so a run can be replayed. */
export const SKIN_TICK = 1 / 30
export const SKIN_TAPE_MAX = 30 * 30

export function createSkinParams() {
  return {
    skinClip: 'Walking',
    skinEmote: null,
    skinAngry: 0,
    skinSurprised: 0,
    skinSad: 0,
    skinRate: 1,
    skinPaused: false,
    skinSkeleton: true,
    skinMesh: true,
    skinPart: 'head',
    skinPose: {},
    skinStep: null,
    skinRecord: false,
    skinReplay: false,
    skinTapeClear: null,
    skinSeek: null,
    skinPlayhead: null,
    skinSeed: 1,
  }
}

export function formatSkinTime(seconds) {
  const t = Math.max(0, Number(seconds) || 0)
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}

export function copyPose(pose) {
  const out = {}
  if (!pose || typeof pose !== 'object') return out
  for (const key of Object.keys(pose)) {
    const slot = pose[key]
    out[key] = {
      x: Number(slot?.x) || 0,
      y: Number(slot?.y) || 0,
      z: Number(slot?.z) || 0,
    }
  }
  return out
}

export function emptyPose() {
  return { x: 0, y: 0, z: 0 }
}

export function partPose(pose, partId) {
  const slot = pose?.[partId]
  if (!slot || typeof slot !== 'object') return emptyPose()
  return {
    x: Number(slot.x) || 0,
    y: Number(slot.y) || 0,
    z: Number(slot.z) || 0,
  }
}

export function boneStub(name) {
  return String(name || '').replace(/^mixamorig/i, '')
}

export function findPartBone(bones, part) {
  if (!part) return null
  return (
    bones.find((bone) => part.names.some((name) => boneStub(bone.name) === name)) ??
    bones.find((bone) => part.names.some((name) => boneStub(bone.name).endsWith(name))) ??
    null
  )
}
