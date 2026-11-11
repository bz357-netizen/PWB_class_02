# Final project

[Notebook](my-react-app/README.md) · [GitHub](https://github.com/bz357-netizen/PWB_class_02) · [Live site](https://pwb2026-3cb0f.web.app)

## Goal

Build one world from the class noise stack, not a gallery of disconnected demos. The planet is the final view. Field, shaders, voxel, CSG, and break stay on the site as the studies that got it there.

## Design position

**Settlement has to follow the ground.**

A house is allowed only where the land can hold it. A tree sits on the same mesh the ground is made of. If the picture needs a town in the lake to look full, the land is not finished.

Stepped color is a reading of height. It is not a second geometry. The planet has to stay a round, smooth globe, like Messenger. Turning the color bands into stairs was a wrong turn.

## Precedent

Three works sit behind this planet. One is how it looks. Two are how a town is allowed to exist.

**[Messenger](https://messenger.abeto.co/)** is the visual starting point: a small toon planet, ink outlines, roads painted into the ground, a person walking. What I took: the ball, the toon material, roads as a texture, the walker. What I changed: the ground is not a painted globe. It is the class noise stack, wrapped in 3D. Color bands mark elevation. The mesh stays a hill.

**SimCity** is the rule. A city is not a sticker. Zones, roads, and buildings only work on land the simulation will accept. Water is a limit, not a texture. That is the position here: a house is refused if the land cannot hold it.

**Cities: Skylines** is the road logic. The town is a network first. Buildings line the asphalt; they do not float in open water or on a cliff because the skyline needed filling. Roads stay on dry ground, then houses attach to those roads.

Messenger places a world. SimCity and Cities: Skylines argue that a world has rules. This project keeps the Messenger look and borrows that rule: settlement has to follow the ground.

## How the planet is built

See [Planet](my-react-app/src/assets/README/NOTEBOOK/10-planet/README.md). Short version:

```text
noise layers → height on the sphere → color bands (shader only)
                                          ↓
                         roads on dry land → houses and trees only above the shore
```

## Critique

These frames were the project talking back.

![[Pasted image 20261027214823.png]]

The house stood in the middle of the water. Placement used to test one point, a hair above sea, then sink the mesh. A house is wider than that test, so the walls went into the lake.

**Change:** the whole footprint has to sit above sea, or the house is not planted. That part stays.

![[Pasted image 20261027214926.png]]

The style of the planet was right, but the trees and the color bands looked like different layers. Color was stepped. The mesh was still a smooth hill. Trees were a separate instanced mesh sitting on that hill.

**Wrong change:** snap the mesh to the color bands so trees sit on “treads.” That turned Messenger’s round planet into Minecraft stairs. Coasts pixelated. Green lids spanned lakes. It got worse.

![[Pasted image 20261028105545.png]]

**Change:** put the smooth ground back. Stepped stays a shader. Trees and houses sample the mesh and stay on dry land. They do not need a geometric terrace to belong.

## Studies

Planet is default. The other tabs stay in the HUD.

| Study   | Hash       |
| ------- | ---------- |
| Planet  | `#planet`  |
| Field   | `#field`   |
| Shaders | `#shaders` |
| Voxel   | `#voxel`   |
| CSG     | `#csg`     |
| Break   | `#break`   |

## References

1. Abeto. *Messenger*. https://messenger.abeto.co/
2. Maxis. *SimCity*. Will Wright / Electronic Arts, 1989–.
3. Colossal Order. *Cities: Skylines*. Paradox Interactive, 2015. https://www.citiesskylines.com/
![[Pasted image 20261028110459.png]]

## 11 November

Class asked for a **3:30** Tiny Glade-style film, time control (slow / fast / freeze / recorded), Three.js helpers, and to be accountable about what the planet is doing. Next week: short presentation, share GitHub. This is still local.

Open Planet: [http://localhost:5173/#planet](http://localhost:5173/#planet).

### Process film

The world is already built. Play does not rebuild it. Play only turns layers on, in order, like Tiny Glade. Dock tab **Process**. Hide puts the panel away.

| Control | What it does |
|---|---|
| Play process / Stop | Start from the wire sphere, or leave the film |
| Pause / Resume | Freeze. The clock stops |
| Prev / Next | Jump a whole stage |
| Scrub | Drag the playhead |
| 0.25 / 0.5 / 1 / 2 | Rate. **1 is the 3:30 talk clock** |
| Record | WebM of the canvas plus the captions |

Eleven holds. They add up to **210 seconds**.

| # | Stage | Seconds | What you see |
|---|---|---|---|
| 1 | Unit sphere | 16 | Wire ball. No color, no town |
| 2 | Sample height | 18 | Land / shore / water on the displaced mesh |
| 3 | Color bands | 18 | Pretty colors. Shader only. The hill is still smooth |
| 4 | Sea | 18 | Water sphere |
| 5 | Roads | 18 | Asphalt on dry land |
| 6 | Houses | 20 | Only if the whole footprint is dry |
| 7 | Trees | 20 | Dry land, off the roads and lots |
| 8 | Lamps and cars | 16 | Lamps on asphalt. Cars drive |
| 9 | UFO | 16 | Saucer over deep water |
| 10 | Walker | 20 | The robot |
| 11 | This world | 30 | Full planet, held for the close |

### Debug

Four clicks. One overlay at a time. A cream caption says what you are looking at.

| Button | What it reveals |
|---|---|
| 1. Land | Green dry / yellow shore / blue water. A house may only stand on green |
| 2. Height | `aElev` 0–1 at every vertex. The pretty bands are a coloring of this number |
| 3. Roads | Cyan segments the computer kept. Orange dots are town seeds that never got a road |
| 4. Refused | House attempts that failed: water, road, crowd, too far from a road |

Helpers: **Axes**, **Grid**, **Wire**, **Sites**, **Walker** (yellow capsule, blue heading). Hide can take ocean, town, ink, or the agent off.

**How it is built** is the live pipeline: noise stack → sphere → height → `aElev` → displace → color → sea → sampler → roads → towns → houses → trees → lamps/cars → UFO → walker.

### How to run the talk

1. Planet tab. Seed locked.
2. **Process** → Play process. Rate 1. Record if you need a file.
3. Stop. **Debug** → **1. Land**, then **2. Height**, then **3. Roads**, then **4. Refused**. Read the caption. Read **What is still hard**.

### Tried and took off

Bone lines on the Planet walker. They belong in Skin. On the planet they sat next to the mesh in the water. Deleted.

### Still hard

- Laying the town is slower than the mesh. Detail 64 is fine. The town pass costs more.
- The land rule fights density. More houses are refused than planted. Empty coasts are not a missing texture.
- Roads cannot cross water, so some town seeds stay unused.
- The walker can jam between walls and trunks. The yellow cage is the body that hits them.
- Color bands are not stairs. That one is already fixed. Height overlay is the proof.

### Code from this session

`worldProcess.js`, `ProcessFilm.jsx`, `debugLayers.js`, `worldReport.js`, plus `PlanetCanvas.jsx` and `planetTown.js`.