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
    why: 'Steep faces go black, flats stay paper. The ink sits in the folds of the slope.',
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
  {
    id: 'unknown',
    label: 'Unknown',
    why: 'Erosion from the unknown. Dark ground collapses along gullies. Filaments, orbs, and a bright core hang over the eaten land. Reach climbs the front.',
  },
]

export function getShaderStrategy(id) {
  return SHADER_STRATEGIES.find((item) => item.id === id) ?? SHADER_STRATEGIES[1]
}

const UNKNOWN_LIB = /* glsl */ `
float unkHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float unkNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = unkHash(i);
  float b = unkHash(i + vec2(1.0, 0.0));
  float c = unkHash(i + vec2(0.0, 1.0));
  float d = unkHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float unknownMask(vec3 world, float low, float high, float erode, float time) {
  float h = clamp((world.y - low) / max(0.001, high - low), 0.0, 1.0);
  float field = unkNoise(world.xz * 0.065 + time * 0.025);
  field += 0.45 * unkNoise(world.xz * 0.15 - time * 0.02);
  float climb = h * 0.7 + (1.0 - field) * 0.3;
  return 1.0 - smoothstep(erode - 0.1, erode + 0.14, climb);
}
`

const VERT = /* glsl */ `
attribute vec3 color;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
uniform float uLow;
uniform float uHigh;
uniform float uTime;
uniform float uErode;
uniform float uUnknown;
${UNKNOWN_LIB}

void main() {
  vec3 pos = position;
  if (uUnknown > 0.5) {
    vec3 world0 = (modelMatrix * vec4(position, 1.0)).xyz;
    float eaten = unknownMask(world0, uLow, uHigh, uErode, uTime);
    pos.y -= eaten * 1.25;
    float slice = step(0.972, unkHash(vec2(floor(world0.z * 1.4), floor(uTime * 8.0))));
    pos.x += slice * eaten * 0.7 * sin(uTime * 26.0 + world0.z);
  }
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vColor = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
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
uniform float uErode;
uniform float uUnknown;
uniform vec3 uCore;
${UNKNOWN_LIB}

float shade() {
  vec3 n = normalize(vNormal);
  float lambert = clamp(dot(n, normalize(uSun)), 0.0, 1.0);
  return 0.78 + 0.22 * lambert;
}

float height01() {
  return clamp((vWorld.y - uLow) / max(0.001, uHigh - uLow), 0.0, 1.0);
}

float inkHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float inkNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = inkHash(i);
  float b = inkHash(i + vec2(1.0, 0.0));
  float c = inkHash(i + vec2(0.0, 1.0));
  float d = inkHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec3 elevationColor(float h) {
  vec3 meadow = vec3(0.84, 0.93, 0.66);
  vec3 grass = vec3(0.66, 0.86, 0.48);
  vec3 leaf = vec3(0.52, 0.76, 0.40);
  vec3 hill = vec3(0.64, 0.82, 0.46);
  vec3 col = mix(meadow, grass, smoothstep(0.0, 0.32, h));
  col = mix(col, leaf, smoothstep(0.26, 0.62, h));
  col = mix(col, hill, smoothstep(0.55, 0.95, h));
  float blot = inkNoise(vWorld.xz * 0.18);
  float grain = inkNoise(vWorld.xz * 2.4);
  col = mix(col, vec3(0.42, 0.64, 0.34), blot * blot * 0.16 * smoothstep(0.12, 0.7, h));
  col += (grain - 0.5) * vec3(0.02, 0.035, 0.015);
  float steep = 1.0 - clamp(normalize(vNormal).y, 0.0, 1.0);
  col = mix(col, vec3(0.40, 0.58, 0.32), smoothstep(0.18, 0.52, steep) * 0.55);
  return col;
}

vec3 fogged(vec3 col) {
  float fog = 1.0 - exp(-uFog * length(vWorld - cameraPosition));
  return mix(col, uSky, clamp(fog, 0.0, 0.88));
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
  vec3 flatC = vec3(0.80, 0.91, 0.60);
  vec3 midC = vec3(0.56, 0.78, 0.42);
  vec3 cliff = vec3(0.38, 0.56, 0.30);
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
  col = mix(col, vec3(0.08, 0.07, 0.06), clamp(line * 0.75 + major * 0.35, 0.0, 1.0));
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
  vec3 flow = vec3(0.12, 0.11, 0.10);
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
  vec3 water = vec3(0.78, 0.76, 0.71) * (0.9 + 0.1 * ripple);
  water *= 0.86 + 0.14 * shade();
  vec3 col = mix(land, water, wet);
  col = mix(col, vec3(0.16, 0.15, 0.13), shore * (1.0 - wet) * 0.7);
  gl_FragColor = vec4(fogged(col), 1.0);
}
`,
  unknown: /* glsl */ `
float hardShard(vec2 p, vec2 center, float ang, vec2 size) {
  vec2 q = p - center;
  float s = sin(ang);
  float c = cos(ang);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  vec2 a = abs(q);
  float box = max(a.x / size.x, a.y / size.y);
  return 1.0 - smoothstep(0.96, 1.02, box);
}

void main() {
  vec3 n = normalize(vNormal);
  float steep = 1.0 - clamp(n.y, 0.0, 1.0);
  float h = height01();
  float eaten = unknownMask(vWorld, uLow, uHigh, uErode, uTime);

  vec2 down = -n.xz;
  float len = length(down);
  down = len > 0.0008 ? down / len : vec2(0.0, 1.0);
  float along = dot(vWorld.xz, down);
  float gullyNoise = unkNoise(vWorld.xz * 0.22 + uTime * 0.05);
  float gully = smoothstep(0.78, 0.98, fract(along * 1.35 + gullyNoise * 3.0));
  gully *= smoothstep(0.03, 0.22, steep);
  float ahead = smoothstep(uErode - 0.28, uErode + 0.04, 1.0 - h);
  gully *= ahead * (1.0 - eaten);

  vec3 soil = mix(vec3(0.11, 0.045, 0.055), vec3(0.18, 0.08, 0.07), smoothstep(0.0, 0.55, h));
  vec3 ridge = vec3(0.12, 0.20, 0.24);
  vec3 land = mix(soil, ridge, smoothstep(0.5, 0.95, h));
  land *= 0.5 + 0.5 * shade();
  land = mix(land, vec3(0.85, 0.28, 0.08), gully * 0.85);
  land = mix(land, vec3(0.72, 0.48, 0.18), gully * (1.0 - smoothstep(0.0, 0.16, steep)) * 0.55);

  vec3 voidCol = vec3(0.045, 0.02, 0.055);
  float spark = step(0.992, unkHash(floor(vWorld.xz * 7.0) + floor(uTime * 8.0)));
  voidCol += vec3(0.55, 0.18, 0.72) * spark;
  voidCol += vec3(0.15, 0.45, 0.4) * step(0.9, fract(vWorld.y * 28.0 - uTime * 4.0)) * 0.35;

  float rim = smoothstep(0.06, 0.22, eaten) * (1.0 - smoothstep(0.48, 0.78, eaten));
  vec3 rimCol = mix(vec3(0.95, 0.28, 0.72), vec3(0.25, 0.9, 0.78), step(0.5, unkNoise(vWorld.xz * 0.3)));

  vec3 col = mix(land, voidCol, eaten);
  col = mix(col, rimCol, rim * 0.65);

  float hazeN = unkNoise(vWorld.xz * 0.035 + uTime * 0.02);
  col += vec3(0.42, 0.16, 0.62) * hazeN * 0.22;
  col += vec3(0.08, 0.32, 0.3) * (1.0 - hazeN) * 0.14;
  col += vec3(0.55, 0.32, 0.08) * unkNoise(vWorld.xz * 0.02 - uTime * 0.015) * 0.08;

  float core = exp(-length(vWorld - uCore) * 0.18);
  col += vec3(1.0, 0.9, 0.7) * core * 0.85;

  float shard = hardShard(vWorld.xz, uCore.xz + vec2(6.0, -3.0), 0.5, vec2(1.6, 0.35));
  shard = max(shard, hardShard(vWorld.xz, uCore.xz + vec2(-7.0, 4.0), -0.8, vec2(1.2, 0.28)));
  shard = max(shard, hardShard(vWorld.xz, uCore.xz + vec2(2.0, 8.0), 1.2, vec2(0.9, 0.22)));
  col = mix(col, vec3(0.72, 0.4, 1.0), shard * 0.55);
  col += vec3(1.0, 0.55, 0.2) * shard * 0.25;

  vec3 shown = fogged(col);
  shown = mix(shown, col, 0.55 + eaten * 0.35);
  gl_FragColor = vec4(shown, 1.0);
}
`,
}

function uniforms() {
  return {
    uSun: { value: new THREE.Vector3(0.4, 0.85, 0.25) },
    uSky: { value: new THREE.Color(0xf4efe6) },
    uLow: { value: 0 },
    uHigh: { value: 1 },
    uTime: { value: 0 },
    uSpacing: { value: 0.45 },
    uWater: { value: 0.15 },
    uFog: { value: 0.004 },
    uErode: { value: 0.42 },
    uUnknown: { value: 0 },
    uCore: { value: new THREE.Vector3(0, 8, 0) },
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
  const material = new THREE.ShaderMaterial({
    uniforms: uniforms(),
    vertexShader: VERT,
    fragmentShader: COMMON + body,
  })
  material.uniforms.uUnknown.value = id === 'unknown' ? 1 : 0
  return material
}
