import { handSession } from './handSession.js'

const MIN_POLAR = 0.28
const MAX_POLAR = Math.PI * 0.48

let engaged = false
let refX = 0
let refY = 0
let bound = null

export function applyHandOrbit(controls, limits) {
  if (bound !== controls) {
    bound = controls
    engaged = false
  }
  controls.minPolarAngle = limits?.min ?? MIN_POLAR
  controls.maxPolarAngle = limits?.max ?? MAX_POLAR

  const hand = handSession.hands.left
  const driving = hand.active && !hand.hold && !hand.fist
  if (!driving) {
    engaged = false
    return
  }
  if (!engaged) {
    engaged = true
    refX = hand.x
    refY = hand.y
    return
  }

  let dx = hand.x - refX
  let dy = hand.y - refY
  refX = hand.x
  refY = hand.y
  if (Math.abs(dx) < 0.0015) dx = 0
  if (Math.abs(dy) < 0.0015) dy = 0
  if (dx === 0 && dy === 0) return

  const gain = (handSession.orbit > 0 ? handSession.orbit : 1) * 2.6
  if (dx !== 0) controls.rotateLeft(dx * gain)
  if (dy !== 0) controls.rotateUp(dy * gain * 0.85)
}

export function resetHandOrbit() {
  engaged = false
}
