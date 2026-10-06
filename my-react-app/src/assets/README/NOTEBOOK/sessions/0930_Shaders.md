---
aliases:
  - 30 September
tags:
  - pwb
  - shaders
date: 2026-09-30
---

# 30 September

[Sessions](my-react-app/README.md) · [All areas](my-react-app/README.md)

Open the app on **Shaders**, or go to [http://localhost:5173/#shaders](http://localhost:5173/#shaders). The published copy of the trees is [https://pwb2026-3cb0f.web.app/#shaders](https://pwb2026-3cb0f.web.app/#shaders). Unknown and the flow field were still local when this note was written.

## What landed

The height field is unchanged. `noise.js` still builds it. The Shaders tab only changes what is drawn on top.

**Strategies.** Lit, Elevation, Slope, Contours, Drainage, and Waterline were already there. **Unknown** was added. Reach climbs a front out of the valleys. Eaten ground sinks into a dark void, gullies run ahead of it, and trees in that zone break apart. While Unknown is on, filaments, orbs, a bright core, colored haze, and a few hard shards hang over the eaten land. That is a light sketch of the Doctor Strange still, not the film frame.

**Trees.** Three heights, scattered on gentle ground. Tall conifers take the low land, medium crowns the middle, short shrubs the high ground. Cliffs stay bare. Cover, default 72%, sets how full the groves are. On Waterline, trunks under the line disappear and crowns can remain.

**Flow.** Arrows sit on the mesh. Valleys point downhill. Open ground carries a rotating typhoon spiral. Particles ride those vectors: wind on the spiral, fish in the valley, one bear walking gentle ground toward a honey marker. Hover stirs the field. Holding the button stirs it harder.

| Slider | Default |
|---|---|
| Cover | 72% |
| Reach | 0.42 |
| Vectors | 140 |
| Particles | 28 |
| Trail | 8 |
| Field grid | 18 |

## Where the code is

| File | Role |
|---|---|
| `shaders.js` | The draw strategies, including Unknown |
| `ShaderCanvas.jsx` | The scene: mesh, trees, filaments, flow, the cursor raycast |
| `trees.js` | The three tree meshes and the scatter |
| `flowField.js` | Arrows, particles, trails, the stir |
| `paths.js` | Height lookup on the mesh, the honey patch, the bear path |

Drag still orbits. The stir only happens when the cursor ray hits the ground.

New Mode:
1. Shader mode
![[Pasted image 20260930114428.png]]![[Pasted image 20260930113901.png]]
2. Shader-mode <UNKNOWN> 

    Meaning: By using the reference picture from <DOC STRANGE> movie about the reality erosion and also the reference of pseudohuasca (a digital visual art)

