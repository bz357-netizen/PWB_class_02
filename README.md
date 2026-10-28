# Procedural World Building

Settlement has to follow the ground. The same noise stack from this class becomes a planet. Towns, trees, and roads are only allowed on dry land. They are not a second picture pasted on top of the land.

Live site: [https://pwb2026-3cb0f.web.app](https://pwb2026-3cb0f.web.app)

This repository is the class project: the React + Three.js app, the Obsidian notebook, and the final planet. Open [Final Project.md](Final%20Project.md) for the design position, the Messenger precedent, and the two critiques that had to be closed.

## Design position

A world is not finished when it looks busy. It is finished when every object can explain why it is allowed to stand where it stands. Houses do not sit in lakes. Trees sit on the same ground the mesh is made of.

The look starts from [Messenger](https://messenger.abeto.co/): a toon-ink planet, roads as a texture, a walker. The land rule comes from *SimCity* and *Cities: Skylines*: a town is a road network on dry ground, not props on a picture. What changes is the land itself. This project builds height from layered noise, paints that height in color bands, then plants settlement only where the mesh is dry. References are listed in [Final Project.md](Final%20Project.md#references).

## Studies

The planet is the final view. The earlier tabs are how it was learned, and they stay on the site.

| Tab | Hash | What it is |
|---|---|---|
| Planet | `#planet` | Final world. Noise → color bands → towns on dry land |
| Field | `#field` | Height field on a plane, weather, scatter |
| Shaders | `#shaders` | Same mesh, different readings (slope, waterline, drainage) |
| Voxel | `#voxel` | The same height as stacked cubes |
| CSG | `#csg` | Solids combined by signed distance |
| Break | `#break` | A structure whose joints fail under wind and quake |

## Notebook

Area notes live in `my-react-app/src/assets/README/NOTEBOOK/`. The index is [my-react-app/README.md](my-react-app/README.md).

## Run locally

```powershell
cd my-react-app
npm install
npm run dev
```

Open http://localhost:5173/. Sign in, or look around as a guest. Do not commit `.env.local`.
