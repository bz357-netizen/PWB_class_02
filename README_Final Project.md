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