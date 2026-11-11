export function round1(value) {
  return Math.round(value * 10) / 10
}

export function round2(value) {
  return Math.round(value * 100) / 100
}

export function latLonFromDir(dir) {
  if (!dir) return { lat: 0, lon: 0 }
  const y = Math.max(-1, Math.min(1, dir.y))
  return {
    lat: round1((Math.asin(y) * 180) / Math.PI),
    lon: round1((Math.atan2(dir.z, dir.x) * 180) / Math.PI),
  }
}

export function vec3(v) {
  if (!v) return [0, 0, 0]
  return [round2(v.x), round2(v.y), round2(v.z)]
}

export function inspectFingerprint(pick) {
  if (!pick) return ''
  const p = pick.transform?.position ?? []
  const s = pick.state ?? {}
  return [
    pick.id,
    p.map(round2).join(','),
    s.moving,
    s.stuck,
    s.place,
    s.speed,
    s.stun,
    s.offRoad,
    s.zone,
    s.delta,
  ].join('|')
}
