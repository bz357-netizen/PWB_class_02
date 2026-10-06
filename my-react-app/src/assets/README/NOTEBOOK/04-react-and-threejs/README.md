# React and Three.js

[All areas](my-react-app/README.md)

The page is two programs that share a window.

| Layer | File | Job |
|---|---|---|
| React | `App.jsx` | Title, tabs, sliders, account |
| Three.js | `GalaxyCanvas.jsx`, `VoxelCanvas.jsx`, `CsgCanvas.jsx` | Scene, camera, mesh, every frame |

Mixing both in one file gets hard. Buttons stay in `App.jsx`. The WebGL scene stays in a canvas component.

## What I learned

React redraws when a slider changes. Three.js redraws many times a second with `requestAnimationFrame`. If the canvas read React state on every frame, the scene would rebuild too often.

`App` writes the latest sliders into `paramsRef`. The canvas **reads** that ref each frame. React does not rebuild the renderer when a number changes.

```text
Browser
  └── App.jsx                 HUD
        ├── GalaxyCanvas      noise mesh
        ├── VoxelCanvas       stacked cubes
        └── CsgCanvas         density mesh
```

`useEffect` creates the Three.js scene once and destroys it when the view unmounts. Switching Field / Voxel / CSG swaps which canvas is mounted.

## Example

The title and the right-hand panel update when React state changes. The land updates when the canvas reads `paramsRef` and writes new vertex heights. Both are on screen together.

![HUD and WebGL canvas on one page](noise-field.png)

## Full notes

Docs, the study order, and why React Three Fiber waits until later: [Three.js & React Resources](Three.js%20%26%20React%20Resources.md).

The file-by-file map is [Script map](Script%20map.md). The slider-to-pixel path is [Process](Process.md).
