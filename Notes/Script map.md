---
tags:
  - pwb
  - source
date: 2026-09-16
---

# Script map

What each file in `my-react-app/src` is for. Pair with [[Process]].

Path: `C:\Users\asus\Documents\GitHub\PWB_class_02\my-react-app\src`

---

## Entry and shell

| File | Role |
|---|---|
| `main.jsx` | Mounts React on `#root`, loads `index.css` |
| `index.css` | Color tokens from [[STYLE GUIDE]] |
| `App.jsx` | HUD, params state, `paramsRef`, sliders / sections |
| `App.css` | HUD layout: title, side panel, 2D map, controls |
| `index.html` | Page title, IBM Plex Mono, Vite entry |

---

## 3D scene

| File | Role |
|---|---|
| `GalaxyCanvas.jsx` | Scene, camera, OrbitControls, lights, grid mesh, rain, living meshes, render loop |
| `CsgCanvas.jsx` | Same kind of scene for the CSG tab. Draws the mesh from `meshing.js` |
| `createMilkyWay.js` | Glow texture + background starfield points (night) |

`GalaxyCanvas` creates Three.js **once** in `useEffect`, then each frame:

1. Resize camera if needed
2. Rebuild plane if resolution changed
3. `applyNoiseToGrid` when the noise fingerprint changes
4. `applyEventToGrid` when a scenario is on
5. `applyEnvironment` (daylight / weather)
6. `syncLiving` if scenario is Living
7. `controls.update()` + `renderer.render()`

---

## Noise and height

| File | Role |
|---|---|
| `noise.js` | Layer model, Perlin/value/simplex/Worley/FBM, shape ops, `sampleHeight`, `applyNoiseToGrid` |
| `simulate.js` | Grid sims used as “equations”: Gray–Scott, hydraulic droplets, waves, diffusion |
| `density.js` | SDF primitives and sequential CSG (`sampleDensity`) |
| `meshing.js` | Chunk culling, cube faces, greedy quads, marching cubes |
| `marchTables.js` | Marching-cubes triangle cases |

Important exports from `noise.js`:

- `createNoiseLayer` — default layer params
- `sampleHeight(x, z, params)` — world height
- `applyNoiseToGrid(geometry, params)` — write vertices + colors
- `NOISE_EQUATIONS`, `SHAPE_OPS`, `BLEND_OPS`

---

## Day, events, settlement

| File | Role |
|---|---|
| `daylight.js` | `WEATHER_OPS`, `getDaylight(hour, weather)` |
| `eventSim.js` | Fire, flood, snow, hydraulic; `applyEventToGrid`, 2D sim maps, timeline labels |
| `livingSim.js` | `CLIMATES`, `COUNTRIES`, village / road / highway layout |

---

## HUD extras

| File | Role |
|---|---|
| `NoiseMap2D.jsx` | Bottom-left 2D height (and event) canvases |
| `paramHelp.js` | Hover text for control labels |
| `ParamTooltip.jsx` | Delayed tooltip portal |

---

## Where to edit (quick)

| I want to… | Open |
|---|---|
| Change a slider or default layer | `App.jsx` (`initialParams`) |
| Change HUD look | `App.css`, `index.css`, [[STYLE GUIDE]] |
| Change sun / weather math | `daylight.js` |
| Change how hills are built | `noise.js` |
| Change CSG shapes or boolean ops | `density.js` |
| Change chunking or the mesh | `meshing.js`, [[Chunking and meshing]] |
| Change fire / flood / snow | `eventSim.js` |
| Change villages / countries | `livingSim.js` |
| Change camera start | `GalaxyCanvas.jsx` (`camera.position.set`) |
| Change 2D preview colors | `NoiseMap2D.jsx` (`paletteColor`) |

Keep 3D in `GalaxyCanvas.jsx`. Keep buttons in `App.jsx`. That split is the class rule from [[Three.js & React Resources]].
