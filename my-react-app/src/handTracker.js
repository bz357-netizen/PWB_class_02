import { createHandSlot, handSession, publishHand } from './handSession.js'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm'
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
const PALM = [0, 5, 9, 13, 17]
const THUMB = 4
const INDEX = 8
const FINGER_TIPS = [8, 12, 16, 20]
const FINGER_KNUCKLES = [5, 9, 13, 17]
const SIDES = ['left', 'right']

const PREVIEW_COLOR = { left: '#b6e39a', right: '#9fd0f2' }

let generation = 0
let vision = null
let landmarker = null
let frameId = 0
let stream = null
let videoEl = null
let canvasEl = null
let lastVideoTime = -1
let lastStamp = 0
let lastFrame = 0

function createTrack() {
  return {
    smoothX: 0.5,
    smoothY: 0.55,
    smoothStrength: 0,
    smoothLift: 0,
    fisting: false,
    fistAnchorY: 0,
    lost: 0,
  }
}

const tracks = { left: createTrack(), right: createTrack() }

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function setStatus(status, detail) {
  handSession.status = status
  handSession.detail = detail
  publishHand()
}

function cameraFailure(error) {
  const name = error?.name || ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return ['denied', 'Camera permission denied']
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return ['missing', 'No camera found']
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return ['error', 'Camera is busy in another app']
  }
  return ['error', 'Camera could not start']
}

function stopLoop() {
  if (frameId) cancelAnimationFrame(frameId)
  frameId = 0
}

function stopStream() {
  if (stream) {
    for (const track of stream.getTracks()) track.stop()
    stream = null
  }
  if (videoEl) {
    videoEl.pause()
    videoEl.srcObject = null
  }
}

function releaseLandmarker() {
  if (landmarker && typeof landmarker.close === 'function') landmarker.close()
  landmarker = null
}

function resetSlot(slot, pose) {
  slot.active = false
  slot.hold = false
  slot.fist = false
  slot.lift = 0
  slot.strength = 0
  slot.pose = pose
}

function syncLegacy() {
  const right = handSession.hands.right
  handSession.active = right.active
  handSession.x = right.x
  handSession.y = right.y
  handSession.strength = right.strength
  handSession.fist = right.active ? right.fist : false
  handSession.lift = right.active ? right.lift : 0
}

/**
 * The webcam preview is mirrored with CSS. detectForVideo reads the
 * video pixels, which that transform does not flip, and the skeleton
 * is drawn with x reversed so it sits on the mirrored picture.
 * MediaPipe's categoryName is already the person's own hand. Swapping
 * it labeled the user's left hand as Right, so the name is kept.
 * A hand keeps that slot when the other hand leaves.
 */
export function sideFromHandedness(categoryName) {
  if (categoryName === 'Left') return 'left'
  if (categoryName === 'Right') return 'right'
  return ''
}

function poseFor(side, track) {
  if (side === 'left') return track.fisting ? 'closed' : 'aiming'
  if (!track.fisting) return 'aiming'
  if (track.smoothLift > 0.08) return 'raising'
  if (track.smoothLift < -0.08) return 'digging'
  return 'closed'
}

function palmCenter(landmarks) {
  let x = 0
  let y = 0
  for (const index of PALM) {
    x += landmarks[index].x
    y += landmarks[index].y
  }
  return { x: x / PALM.length, y: y / PALM.length }
}

function curledFingers(landmarks) {
  const wrist = landmarks[0]
  let curled = 0
  for (let i = 0; i < FINGER_TIPS.length; i++) {
    const tip = landmarks[FINGER_TIPS[i]]
    const knuckle = landmarks[FINGER_KNUCKLES[i]]
    const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y)
    const knuckleDist = Math.hypot(knuckle.x - wrist.x, knuckle.y - wrist.y) + 0.0001
    if (tipDist < knuckleDist * 1.4) curled += 1
  }
  return curled
}

function applyHand(side, landmarks, dt) {
  const track = tracks[side]
  const slot = handSession.hands[side]
  const palm = palmCenter(landmarks)
  const follow = 1 - Math.exp(-dt * 12)
  track.smoothX += (1 - palm.x - track.smoothX) * follow
  track.smoothY += (palm.y - track.smoothY) * follow
  const span = Math.hypot(landmarks[0].x - landmarks[9].x, landmarks[0].y - landmarks[9].y)
  const targetStrength = clamp((span - 0.08) / 0.22, 0.12, 1)
  track.smoothStrength += (targetStrength - track.smoothStrength) * follow

  const curled = curledFingers(landmarks)
  const wantFist = track.fisting ? curled >= 3 : curled >= 4
  if (wantFist && !track.fisting) {
    track.fisting = true
    track.fistAnchorY = track.smoothY
    track.smoothLift = 0
  } else if (!wantFist) {
    track.fisting = false
  }

  const rise = track.fistAnchorY - track.smoothY
  const dead = 0.03
  let targetLift = 0
  if (track.fisting && Math.abs(rise) > dead) {
    const past = rise - Math.sign(rise) * dead
    targetLift = clamp(past / 0.16, -1, 1)
  }
  track.smoothLift += (targetLift - track.smoothLift) * (track.fisting ? follow : 0.45)
  track.lost = 0

  slot.active = true
  slot.hold = false
  slot.x = track.smoothX
  slot.y = track.smoothY
  slot.strength = track.smoothStrength
  slot.fist = track.fisting
  slot.lift = track.fisting ? track.smoothLift : 0
  slot.pose = poseFor(side, track)
}

function loseHand(side) {
  const track = tracks[side]
  const slot = handSession.hands[side]
  if (!slot.active && !slot.hold) return
  track.lost += 1
  if (track.lost === 1) {
    track.fisting = false
    track.smoothLift = 0
    slot.fist = false
    slot.lift = 0
    slot.hold = true
  }
  if (track.lost < 10) return
  resetSlot(slot, handSession.enabled ? 'none' : 'off')
}

function drawHands(found) {
  const canvas = canvasEl
  const video = videoEl
  if (!canvas || !video) return
  if (video.videoWidth && canvas.width !== video.videoWidth) {
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const px = (landmark) => (1 - landmark.x) * canvas.width
  const py = (landmark) => landmark.y * canvas.height
  for (const { side, landmarks } of found) {
    ctx.lineWidth = 3
    ctx.strokeStyle = PREVIEW_COLOR[side]
    ctx.beginPath()
    for (const link of vision.HandLandmarker.HAND_CONNECTIONS) {
      const start = landmarks[link.start]
      const end = landmarks[link.end]
      if (!start || !end) continue
      ctx.moveTo(px(start), py(start))
      ctx.lineTo(px(end), py(end))
    }
    ctx.stroke()
    for (let i = 0; i < landmarks.length; i++) {
      const tip = i === THUMB || i === INDEX
      ctx.fillStyle = tip ? '#ffe1a8' : PREVIEW_COLOR[side]
      ctx.beginPath()
      ctx.arc(px(landmarks[i]), py(landmarks[i]), tip ? 6 : 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.font = '600 18px IBM Plex Mono, monospace'
    ctx.fillStyle = PREVIEW_COLOR[side]
    ctx.fillText(side === 'left' ? 'L' : 'R', px(landmarks[0]) + 10, py(landmarks[0]) - 10)
  }
}

function categoryName(entry) {
  if (!entry) return ''
  if (Array.isArray(entry)) return entry[0]?.categoryName || entry[0]?.displayName || ''
  return entry.categoryName || entry.displayName || ''
}

function tick() {
  frameId = requestAnimationFrame(tick)
  const video = videoEl
  if (!landmarker || !video || video.readyState < 2) return
  if (video.currentTime === lastVideoTime) return
  lastVideoTime = video.currentTime
  const now = performance.now()
  const stamp = Math.max(lastStamp + 1, now)
  lastStamp = stamp
  let result
  try {
    result = landmarker.detectForVideo(video, stamp)
  } catch {
    handSession.active = false
    for (const side of SIDES) resetSlot(handSession.hands[side], 'none')
    syncLegacy()
    setStatus('error', 'Hand tracking stalled')
    stopLoop()
    return
  }

  const detected = result?.landmarks || []
  const labels = result?.handedness || result?.handednesses || []
  const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016
  lastFrame = now
  const seen = { left: false, right: false }
  const found = []
  for (let i = 0; i < detected.length; i++) {
    const landmarks = detected[i]
    if (!landmarks || landmarks.length < 21) continue
    let side = sideFromHandedness(categoryName(labels[i]))
    if (side !== 'left' && side !== 'right') side = seen.left ? 'right' : 'left'
    if (seen[side]) {
      const other = side === 'left' ? 'right' : 'left'
      if (seen[other]) continue
      side = other
    }
    seen[side] = true
    applyHand(side, landmarks, dt || 0.016)
    found.push({ side, landmarks })
  }
  for (const side of SIDES) {
    if (!seen[side]) loseHand(side)
  }
  syncLegacy()
  drawHands(found)
  if (handSession.active) setStatus('tracking', 'Hands tracked')
  else if (handSession.status === 'tracking' || handSession.status === 'searching') {
    setStatus('searching', 'Looking for a hand')
  } else publishHand()
}

async function createLandmarker() {
  if (!vision) vision = await import('@mediapipe/tasks-vision')
  const { FilesetResolver, HandLandmarker } = vision
  const fileset = await FilesetResolver.forVisionTasks(WASM)
  const shared = {
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  }
  try {
    return await HandLandmarker.createFromOptions(fileset, {
      ...shared,
      baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
    })
  } catch {
    return HandLandmarker.createFromOptions(fileset, {
      ...shared,
      baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
    })
  }
}

function clearTracks() {
  tracks.left = createTrack()
  tracks.right = createTrack()
  Object.assign(handSession.hands.left, createHandSlot())
  Object.assign(handSession.hands.right, createHandSlot())
}

export async function enableHandTracking(video, canvas) {
  const ticket = ++generation
  videoEl = video
  canvasEl = canvas
  handSession.enabled = true
  clearTracks()
  syncLegacy()
  lastVideoTime = -1
  setStatus('loading', 'Loading hand model…')

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error', 'This browser cannot open a camera')
      return
    }
    if (!landmarker) landmarker = await createLandmarker()
    if (ticket !== generation) return
    setStatus('requesting', 'Waiting for camera permission…')
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    })
    if (ticket !== generation) {
      for (const track of stream.getTracks()) track.stop()
      stream = null
      return
    }
    video.srcObject = stream
    await video.play()
    if (ticket !== generation) return
    for (const side of SIDES) handSession.hands[side].pose = 'none'
    setStatus('searching', 'Looking for a hand')
    stopLoop()
    lastFrame = performance.now()
    tick()
  } catch (error) {
    if (ticket !== generation) return
    stopStream()
    clearTracks()
    syncLegacy()
    const modelFailed = !stream && handSession.status !== 'requesting'
    if (modelFailed) {
      releaseLandmarker()
      setStatus('error', 'Hand model failed to load')
      return
    }
    const [status, detail] = cameraFailure(error)
    setStatus(status, detail)
  }
}

export function disableHandTracking() {
  generation += 1
  stopLoop()
  stopStream()
  releaseLandmarker()
  videoEl = null
  canvasEl = null
  handSession.enabled = false
  clearTracks()
  for (const side of SIDES) handSession.hands[side].pose = 'off'
  syncLegacy()
  setStatus('off', 'Camera off')
}
