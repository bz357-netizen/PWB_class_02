import * as THREE from 'three'

export const SHADER_STRATEGIES = [
  {
    id: 'lit',
    label: 'Lit',
    why: 'The Field tab path. The CPU writes height and vertex color. This material only lights the mesh.',
  },
  {
    id: 'elevation',
    label: 'Elevation',
    why: 'Color is height, per pixel. A snow line or a flood line can move without rewriting the grid.',
  },
  {
    id: 'slope',
    label: 'Slope',
    why: 'Steep faces go dark, flats stay green. Erosion and snow both key off slope, and the normal is already on the mesh.',
  },
  {
    id: 'contours',
    label: 'Contours',
    why: 'Elevation lines drawn on the surface. The terrace stays one mesh. The map reading happens in the shader.',
  },
  {
    id: 'drainage',
    label: 'Drainage',
    why: 'Streaks follow the downhill gradient. Direction only: a preview before the CPU drainage sim.',
  },
  {
    id: 'waterline',
    label: 'Waterline',
    why: 'Land under a chosen height is water. Drag the level instead of replaying the flood scenario.',
  },
]

export function getShaderStrategy(id) {
  return SHADER_STRATEGIES.find((item) => item.id === id) ?? SHADER_STRATEGIES[1]
}

const VERT = /* glsl */ `
attribute vec3 color;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vColor = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const COMMON = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
uniform vec3 uSun;
uniform vec3 uSky;
uniform float uLow;
uniform float uHigh;
uniform float uTime;
uniform float uSpacing;
uniform float uWater;
uniform float uFog;

float shade() {
  vec3 n = normalize(vNormal);
  float lambert = clamp(dot(n, normalize(uSun)), 0.0, 1.0);
  return 0.38 + 0.62 * lambert;
}

float height01() {
  return clamp((vWorld.y - uLow) / max(0.001, uHigh - uLow), 0.0, 1.0);
}

vec3 elevationColor(float h) {
  vec3 low = vec3(0.20, 0.40, 0.32);
  vec3 mid = vec3(0.52, 0.68, 0.30);
  vec3 high = vec3(0.90, 0.88, 0.78);
  vec3 col = mix(low, mid, smoothstep(0.12, 0.55, h));
  return mix(col, high, smoothstep(0.5, 0.95, h));
}

vec3 fogged(vec3 col) {
  float fog = 1.0 - exp(-uFog * length(vWorld - cameraPosition));
  return mix(col, uSky, clamp(fog, 0.0, 0.82));
}
`

const FRAGMENTS = {
  elevation: /* glsl */ `
void main() {
  vec3 col = elevationColor(height01()) * shade();
  gl_FragColor = vec4(fogged(col), 1.0);
}
`,
  slope: /* glsl */ `
void main() {
  float steep = 1.0 - clamp(normalize(vNormal).y, 0.0, 1.0);
  vec3 flatC = vec3(0.36, 0.70, 0.30);
  vec3 midC = vec3(0.72, 0.46, 0.20);
  vec3 cliff = vec3(0.42, 0.30, 0.26);
  vec3 col = mix(flatC, midC, smoothstep(0.015, 0.16, steep));
  col = mix(col, cliff, smoothstep(0.16, 0.42, steep));
  gl_FragColor = vec4(fogged(col * shade()), 1.0);
}
`,
  contours: /* glsl */ `
void main() {
  vec3 col = elevationColor(height01());
  float cells = vWorld.y / max(0.05, uSpacing);
  float edge = abs(fract(cells) - 0.5);
  float line = 1.0 - smoothstep(0.0, 0.07, edge);
  float majorEdge = abs(fract(cells / 5.0) - 0.5);
  float major = 1.0 - smoothstep(0.0, 0.1, majorEdge);
  col = mix(col, vec3(0.08, 0.12, 0.10), clamp(line * 0.75 + major * 0.35, 0.0, 1.0));
  gl_FragColor = vec4(fogged(col * shade()), 1.0);
}
`,
  drainage: /* glsl */ `
void main() {
  vec3 n = normalize(vNormal);
  vec2 down = -n.xz;
  float steep = 1.0 - clamp(n.y, 0.0, 1.0);
  float len = length(down);
  down = len > 0.0008 ? down / len : vec2(0.0, 1.0);
  float along = dot(vWorld.xz, down);
  float streaks = fract(along * max(0.5, uSpacing) + uTime * 0.15);
  float line = smoothstep(0.62, 0.95, streaks) * smoothstep(0.04, 0.2, steep);
  vec3 ground = elevationColor(height01());
  vec3 flow = vec3(0.18, 0.48, 0.66);
  vec3 col = mix(ground, flow, line);
  gl_FragColor = vec4(fogged(col * shade()), 1.0);
}
`,
  waterline: /* glsl */ `
void main() {
  vec3 land = elevationColor(height01()) * shade();
  float depth = uWater - vWorld.y;
  float wet = smoothstep(0.0, 0.28, depth);
  float shore = exp(-abs(vWorld.y - uWater) * 14.0);
  float ripple = sin(vWorld.x * 1.7 + vWorld.z * 1.15 + uTime * 1.4);
  ripple += sin(vWorld.x * 0.45 - vWorld.z * 0.7 - uTime * 0.6);
  vec3 water = vec3(0.14, 0.36, 0.46) * (0.82 + 0.18 * ripple);
  water *= 0.72 + 0.28 * shade();
  vec3 col = mix(land, water, wet);
  col = mix(col, vec3(0.88, 0.94, 0.92), shore * (1.0 - wet) * 0.85);
  gl_FragColor = vec4(fogged(col), 1.0);
}
`,
}

function uniforms() {
  return {
    uSun: { value: new THREE.Vector3(0.4, 0.85, 0.25) },
    uSky: { value: new THREE.Color(0xeef6ec) },
    uLow: { value: 0 },
    uHigh: { value: 1 },
    uTime: { value: 0 },
    uSpacing: { value: 0.45 },
    uWater: { value: 0.15 },
    uFog: { value: 0.004 },
  }
}

export function createStrategyMaterial(id) {
  if (id === 'lit') {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0,
      fog: true,
      dithering: true,
    })
  }
  const body = FRAGMENTS[id] ?? FRAGMENTS.elevation
  return new THREE.ShaderMaterial({
    uniforms: uniforms(),
    vertexShader: VERT,
    fragmentShader: COMMON + body,
  })
}
