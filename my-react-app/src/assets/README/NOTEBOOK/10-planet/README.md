---
tags:
  - pwb
  - planet
  - process
date: 2026-10-28
---

# Planet

[All areas](my-react-app/README.md) · [[Final Project]]

The Field tab is a height on a plane. This view wraps the same noise around a ball, then asks a harder question: if the land is real, where is a house allowed to stand?

Open the app on **Planet**, or go to [http://localhost:5173/#planet](http://localhost:5173/#planet). The published copy is [https://pwb2026-3cb0f.web.app/#planet](https://pwb2026-3cb0f.web.app/#planet).

## Position

Settlement has to follow the ground. **Stepped** only changes the color. The mesh stays a smooth hill, the way [Messenger](https://messenger.abeto.co/) keeps a round planet. Trees and houses sample that mesh. They are not a second layer, and they are not allowed in the water.

## Method

1. Sample the noise stack at each vertex (`planetHeight` in `planet.js`).
2. Normalize height to 0–1 across this planet (`aElev`).
3. Push the vertex out by the raw noise height. Stepped color is a shader read of `aElev`. It does not stair-step the mesh.
4. Build a surface sampler so later queries hit the mesh, not a second copy of the noise.
5. Lay roads on dry land. Place a house only if the whole footprint sits above the shore. Place a tree the same way, then sink it a little so the trunk meets the ground.

The look starts from Messenger. Roads as a painted mask, toon ink, a walker. The land rule comes from **SimCity** and **Cities: Skylines**: a town is a road network on dry ground, not props on a picture. Full list: [[Final Project#References]].

## Code

`planet.js`, `PlanetCanvas.jsx`, `planetTown.js`, `planetWalker.js`.
