export function createHandSlot() {
  return {
    active: false,
    hold: false,
    x: 0.5,
    y: 0.55,
    strength: 0,
    fist: false,
    lift: 0,
    pose: 'off',
  }
}

export const handSession = {
  enabled: false,
  status: 'off',
  detail: 'Camera off',
  active: false,
  x: 0.5,
  y: 0.55,
  strength: 0,
  fist: false,
  lift: 0,
  sensitivity: 0.7,
  orbit: 1,
  reach: 1.7,
  resetToken: 0,
  sculptable: true,
  hands: {
    left: createHandSlot(),
    right: createHandSlot(),
  },
}

const listeners = new Set()
let published = ''

export function subscribeHand(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publishHand() {
  const left = handSession.hands.left
  const right = handSession.hands.right
  const next = `${handSession.status}|${handSession.detail}|${handSession.enabled}|${left.pose}|${right.pose}|${left.active}|${right.active}`
  if (next === published) return
  published = next
  for (const listener of listeners) listener()
}

export function requestTerrainReset() {
  handSession.resetToken += 1
}
