---
tags:
  - pwb
  - threejs
  - react
  - notes
date: 2026-09-16
---

# Noise field

Class app in `my-react-app`. Full-window WebGL terrace + HUD.

This vault **is** the Obsidian folder. Notes live next to the code.

## What it is

A **noise height field** on the xz plane. React draws the HUD. Three.js draws the land, sun, weather, and optional simulations.

Start it:

```powershell
cd C:\Users\asus\Documents\GitHub\PWB_class_02\my-react-app
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Notes from this session

- [[Process]] — how values move from sliders to the 3D mesh
- [[Script map]] — what each source file does

## Class tutorials

- [[Installing React]]
- [[Downloading Three.js]]
- [[Three.js & React Resources]]
- [[Git & Github 101]]
- [[STYLE GUIDE]]

## Default scene

| Control | Starting value |
|---|---|
| Time of day | 12:00 |
| Weather | Clear |
| Scenario | Off |
| Layers | Base (Perlin FBM) + Detail (Value FBM) + Ridges (Ridged FBM) |
| Resolution | 300 |
| Display | Mesh (sun and shadow) |

HUD: dark panel, monospace, one accent `#3EE0FF`. Fold **Simulation**, **Shape**, and **Grid** when you want more canvas.
