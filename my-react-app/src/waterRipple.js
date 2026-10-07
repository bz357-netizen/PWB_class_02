import * as THREE from 'three'

const MAX_RIPPLES = 16
const MIN_STEP = 0.48

const RIPPLE_GLSL = /* glsl */ `
uniform float uRippleTime;
uniform vec2 uRipplePos[16];
uniform float uRippleBirth[16];
const float RIPPLE_LIFE = 3.4;
const float RIPPLE_SPEED = 2.7;

float rippleHeight(float x, float z) {
  vec2 xz = vec2(x, z);
  float h = 0.0;
  for (int i = 0; i < 16; i++) {
    float age = uRippleTime - uRippleBirth[i];
    float live = step(0.001, age) * (1.0 - step(RIPPLE_LIFE, age));
    float dist = length(xz - uRipplePos[i]);
    float band = dist - age * RIPPLE_SPEED;
    float crest = exp(-band * band * 0.38) * cos(band * 1.65);
    float wake = exp(-band * band * 0.12) * cos(band * 1.65 + 1.7) * 0.4;
    float fade = pow(clamp(1.0 - age / RIPPLE_LIFE, 0.0, 1.0), 1.35);
    float attack = smoothstep(0.0, 0.1, age);
    float falloff = exp(-dist * 0.04);
    h += (crest + wake) * fade * attack * falloff * live;
  }
  return clamp(h, -2.2, 2.2) * 0.4;
}

vec3 rippleNormal(float x, float z) {
  float e = 0.62;
  float h = rippleHeight(x, z);
  float hx = rippleHeight(x + e, z);
  float hz = rippleHeight(x, z + e);
  return normalize(vec3(h - hx, e, h - hz));
}
`

/** Circular waves on the existing water material. Old ripples fade on their own. */
export function attachWaterRipples(material) {
  const pos = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector2(0, 0))
  const birth = new Float32Array(MAX_RIPPLES)
  birth.fill(-100)
  const uniforms = {
    uRippleTime: { value: 0 },
    uRipplePos: { value: pos },
    uRippleBirth: { value: birth },
  }
  let slot = 0
  let trailing = false
  let lastX = 0
  let lastZ = 0

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRippleTime = uniforms.uRippleTime
    shader.uniforms.uRipplePos = uniforms.uRipplePos
    shader.uniforms.uRippleBirth = uniforms.uRippleBirth
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `${RIPPLE_GLSL}\n#include <common>`)
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nobjectNormal = rippleNormal(position.x, position.z);',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed.y += rippleHeight(position.x, position.z);',
      )
  }
  material.customProgramCacheKey = () => 'water-ripples-swell'

  const drop = (x, z, time) => {
    pos[slot].set(x, z)
    birth[slot] = time
    slot = (slot + 1) % MAX_RIPPLES
    uniforms.uRippleBirth.value = new Float32Array(birth)
  }

  const setTime = (time) => {
    uniforms.uRippleTime.value = time
  }

  const stroke = (x, z, time) => {
    setTime(time)
    if (!trailing) {
      drop(x, z, time)
      trailing = true
      lastX = x
      lastZ = z
      return
    }
    const dx = x - lastX
    const dz = z - lastZ
    const dist = Math.hypot(dx, dz)
    if (dist < MIN_STEP) return
    const steps = Math.min(4, Math.max(1, Math.floor(dist / MIN_STEP)))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      drop(lastX + dx * t, lastZ + dz * t, time)
    }
    lastX = x
    lastZ = z
  }

  const release = () => {
    trailing = false
  }

  return { setTime, stroke, release }
}
