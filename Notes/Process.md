---
tags:
  - pwb
  - process
date: 2026-09-16
---

# Process

How the Noise field app runs, from a slider move to a frame on screen.

See also: [[Script map]], [[Noise field]]

---

## Everyday loop (you)

```text
1. Terminal in my-react-app
2. npm run dev
3. Browser → http://localhost:5173
4. Edit src/ → Vite hot-reloads
5. Drag canvas to orbit · HUD to change land
6. Ctrl + C to stop
```

That is the same loop as [[Installing React]].

---

## Runtime loop (the program)

```text
You move a slider / select / button
        │
        ▼
App.jsx  commit()  →  React state  +  paramsRef.current
        │
        ├──────────────────────────────┐
        ▼                              ▼
NoiseMap2D.jsx                  GalaxyCanvas.jsx
paints 2D preview               animation loop (every frame)
        │                              │
        │                              ├─ getDaylight()     sky, sun, fog, rain
        │                              ├─ applyNoiseToGrid  vertex heights
        │                              ├─ applyEventToGrid  fire / flood / snow / hydro
        │                              └─ getLivingLayout   huts, roads (if Living)
        ▼                              ▼
  HUD canvas (2D)                 WebGL canvas (3D)
```

**Why `paramsRef`?**  
The Three.js loop runs many times per second. React state would rebuild the scene too often. `App` writes the latest params into a **ref**. `GalaxyCanvas` **reads** that ref each frame.

---

## Height pipeline

World size is `GRID_SIZE = 48` ([[noise.js]]).

1. Up to **4 layers**. Each has an equation (Perlin FBM, Worley, Gray–Scott, …).
2. Optional **shape** remap (ridged, terrace, clamp, …).
3. Layers **blend** (add, mix, max, min, multiply) with a mix amount.
4. Result `y` is written onto a `PlaneGeometry` rotated onto xz.
5. Vertex **colors** follow height (and event overlays).

Formula on the 2D panel: `y = ⊕ᵢ Aᵢ · sᵢ(nᵢ(x, z))`

Simulated equations (Gray–Scott, erosion, waves, diffusion) run a **grid sim** in `simulate.js`, then sample that field as height.

---

## Daylight

`timeOfDay` (0–24) + `weather` → `getDaylight()`:

- sun direction and color
- sky / fog / clear color
- shadow on or off
- rain particles
- starfield opacity at night

Some scenarios **override** weather (flood → rain, fire → storm, snow → overcast).

---

## Simulation map (optional)

`simEvent` is off by default. When on:

| Scenario | What happens |
|---|---|
| Forest fire | Arrival time over the height field |
| Flood season | Water in valleys |
| Heavy snow | Snowpack with elevation |
| Hydraulic erosion | D8 drainage / channels |
| Living settlement | Villages, roads, highways from climate + country |

Press **Start** to run `simTime` 0 → 1. **Living** also places 3D huts and path meshes.

---

## Display

- **Mesh**: `MeshStandardMaterial`, sun shadows
- **Lines**: wireframe, same geometry

Resolution (95 / 300 / 500 / 1000) rebuilds the plane segments. Higher = slower.

---

## HUD process (UI)

`App.jsx` owns all controls. Sections fold: Daylight, Simulation, Layers, Noise, Shape, Grid.

Telemetry under the title: time, weather, layer count, resolution.

2D map (bottom-left) is a **preview**, not the 3D mesh. It uses the same `sampleHeight` so it should match the terrace.

Hover a dotted label for help (`paramHelp.js` + `ParamTooltip.jsx`).
