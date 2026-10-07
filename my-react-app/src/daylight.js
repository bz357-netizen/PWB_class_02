import * as THREE from 'three'

export const WEATHER_OPS = [
  { id: 'clear', label: 'Clear' },
  { id: 'overcast', label: 'Overcast' },
  { id: 'fog', label: 'Fog' },
  { id: 'rain', label: 'Rain' },
  { id: 'storm', label: 'Storm' },
]

function lerpColor(a, b, t) {
  const out = a.clone()
  out.lerp(b, t)
  return out
}

/** hour is 0–24. Returns lighting, fog, and weather flags for the terrace. */
export function getDaylight(hour, weather) {
  const h = ((hour % 24) + 24) % 24
  const dayWave = Math.sin(((h - 6) / 12) * Math.PI)
  const isDay = h >= 5.5 && h <= 18.5
  const elevation = isDay ? Math.max(0.04, dayWave) : -0.12
  const azimuth = ((h - 6) / 24) * Math.PI * 2

  const sunDir = new THREE.Vector3(
    Math.cos(elevation) * Math.cos(azimuth),
    Math.max(0.04, Math.sin(elevation)),
    Math.cos(elevation) * Math.sin(azimuth),
  ).normalize()

  const night = new THREE.Color(0x2a2826)
  const dawn = new THREE.Color(0xf6f1e6)
  const daySky = new THREE.Color(0xf4efe6)
  const dusk = new THREE.Color(0xe4d9c8)
  let sky
  if (h < 5.5 || h > 20.5) sky = night
  else if (h < 8) sky = lerpColor(dawn, daySky, (h - 5.5) / 2.5)
  else if (h < 16.5) sky = daySky
  else if (h < 20.5) sky = lerpColor(daySky, dusk, (h - 16.5) / 4)
  else sky = night

  const sunDay = new THREE.Color(0xf7f4ee)
  const sunDawn = new THREE.Color(0xf0e2cc)
  let sunColor = sunDay
  if (h < 7.5 || h > 17.5) sunColor = sunDawn
  if (!isDay) sunColor = new THREE.Color(0xc8c2b8)

  let sunIntensity = isDay ? 0.26 + elevation * 0.32 : 0.05
  let ambient = isDay ? 0.32 : 0.1
  let hemi = isDay ? 0.4 : 0.12
  let fogDensity = isDay ? 0.009 : 0.02
  let shadow = isDay
  let rain = false
  let wetness = 0
  let starOpacity = isDay ? Math.max(0, 1 - elevation * 2.2) : 1

  if (weather === 'overcast') {
    sunIntensity *= 0.18
    ambient += 0.28
    hemi += 0.2
    sky.lerp(new THREE.Color(0xd8d2c6), 0.55)
    sunColor.lerp(new THREE.Color(0xe4ded2), 0.7)
    fogDensity = 0.01
    shadow = false
    starOpacity *= 0.15
  } else if (weather === 'fog') {
    sunIntensity *= 0.25
    ambient += 0.18
    sky.lerp(new THREE.Color(0xf7f4ee), 0.5)
    fogDensity = 0.042
    shadow = false
    starOpacity *= 0.2
  } else if (weather === 'rain') {
    sunIntensity *= 0.35
    ambient += 0.12
    sky.lerp(new THREE.Color(0xc8c2b6), 0.45)
    fogDensity = 0.014
    rain = true
    wetness = 0.7
    starOpacity *= 0.25
  } else if (weather === 'storm') {
    sunIntensity *= 0.12
    ambient = 0.08
    hemi = 0.1
    sky = new THREE.Color(0x3a3834)
    fogDensity = 0.03
    rain = true
    wetness = 0.9
    shadow = false
    starOpacity = 0.05
  }

  return {
    sunDir,
    sunColor,
    sunIntensity,
    ambient,
    hemi,
    sky,
    fogDensity,
    shadow,
    rain,
    wetness,
    starOpacity,
    storm: weather === 'storm',
  }
}
