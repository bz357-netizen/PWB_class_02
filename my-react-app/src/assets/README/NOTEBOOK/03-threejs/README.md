# Three.js

[All areas](my-react-app/README.md)

Three.js draws in the browser: a scene, a camera, lights, and a mesh. It is a package inside `my-react-app`, not a separate program.

## What I learned

The class install is npm, from the app folder:

```powershell
cd C:\Users\asus\Documents\GitHub\PWB_class_02\my-react-app
npm install three
```

That writes `"three"` into `package.json` and puts the library in `node_modules`. Code imports it:

```javascript
import * as THREE from 'three'
```

Two other ways exist, and this project does not use them:

- A CDN script, for one HTML file with no React
- The GitHub zip, for reading the official examples

Installing the package does not draw anything. A scene still needs a renderer, a camera, and a loop. Those live in `GalaxyCanvas.jsx`, `VoxelCanvas.jsx`, and `CsgCanvas.jsx`.

## Example

The green land is a `PlaneGeometry` whose vertices were moved by the noise function. Orbit is `OrbitControls`: drag to look, scroll to zoom. The panels on top are React, not Three.js.

![Three.js height mesh behind the React HUD](noise-field.png)

The voxel view is the same idea with a different mesh: one cube column per cell, still rendered by Three.js.

![Voxel cubes rendered with Three.js](voxel-terrain.png)

## Full notes

npm, the CDN, the zip, and the errors (`Cannot find module 'three'`, a blank page): [Downloading Three.js](Downloading%20Three.js.md).

Next: [how React and Three.js share the page](my-react-app/src/assets/README/NOTEBOOK/04-react-and-threejs/README.md).
