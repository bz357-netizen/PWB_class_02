# Three.js & React — Resources and Conclusion

A wrap-up for complete beginners. You do not need to finish every link. This page is a map: what you already did, what each tool is for, and where to learn next without getting lost.

---

## What you already built

In this class you:

1. Installed **Node** and created a **Vite + React** app
2. Ran it with `npm run dev` at [http://localhost:5173](http://localhost:5173)
3. Added **Three.js** with `npm install three`
4. Put a **full-window WebGL canvas** behind a **React HUD** (title + sliders)
5. Used **OrbitControls** (drag to orbit, scroll to zoom)
6. Drew a **Milky Way** with particles
7. Locked the overlay look in `STYLE GUIDE.md` (dark, small type, one accent)

That split is the main idea:

| Layer | Job |
|---|---|
| **Three.js** | 3D scene: camera, points, animation, mouse orbit |
| **React** | Website chrome: title, panel, sliders, style |

Keep 3D code in something like `GalaxyCanvas.jsx`. Keep buttons and sliders in `App.jsx`. Mixing everything in one giant file gets hard fast.

---

## How the pieces fit (one picture)

```text
Browser
  └── React (App.jsx)          ← HUD: title, sliders
        └── GalaxyCanvas.jsx   ← Three.js scene
              ├── Scene
              ├── Camera + OrbitControls
              ├── Milky Way points
              └── renderer.render() every frame
```

**React** re-draws the UI when a slider changes.  
**Three.js** re-draws the canvas many times per second (`requestAnimationFrame`).  
You pass slider values through a **ref** (`paramsRef`) so the 3D loop can read them without rebuilding the whole scene every tick.

---

## Commands you will reuse

Run these **inside** `my-react-app` (the folder with `package.json`):

```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm install
npm run dev
```

| Command | Meaning |
|---|---|
| `npm install` | Download packages listed in `package.json` (including `three`) |
| `npm install three` | Add Three.js if it is missing |
| `npm run dev` | Start the local site |
| Ctrl + C | Stop the local site |

Import in code:

```javascript
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
```

---

## Official docs (start here)

Read **one** of these at a time. Skim, then try one small change in your project.

### React

- Learn React (start): [https://react.dev/learn](https://react.dev/learn)  
  Components, `useState`, `useEffect`, `useRef` — those four cover this app.
- `useRef`: [https://react.dev/reference/react/useRef](https://react.dev/reference/react/useRef)  
  How the canvas mount and `paramsRef` work.
- `useEffect`: [https://react.dev/reference/react/useEffect](https://react.dev/reference/react/useEffect)  
  “Create the Three.js scene once, clean it up when the page unmounts.”

### Vite (your project starter)

- Guide: [https://vite.dev/guide](https://vite.dev/guide)  
  You already used this. Come back if `npm run dev` or imports break.

### Three.js

- Manual — creating a scene: [https://threejs.org/manual/#en/creating-a-scene](https://threejs.org/manual/#en/creating-a-scene)  
  Best first Three.js read. Scene, camera, renderer, cube, animation loop.
- Manual — cameras: [https://threejs.org/manual/#en/cameras](https://threejs.org/manual/#en/cameras)
- Docs index: [https://threejs.org/docs](https://threejs.org/docs)  
  Search names you already use: `Scene`, `PerspectiveCamera`, `WebGLRenderer`, `Points`, `PointsMaterial`, `OrbitControls`.
- Examples: [https://threejs.org/examples](https://threejs.org/examples)  
  Look, then click **view source**. Copy *ideas*, not whole files.
- Installation (npm): [https://threejs.org/docs/#manual/en/introduction/Installation](https://threejs.org/docs/#manual/en/introduction/Installation)

### Orbit camera

- `OrbitControls` docs: [https://threejs.org/docs/#examples/en/controls/OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls)

---

## Extra learning (when you are ready)

Do **not** start all of these in week one.

| Resource | Why it helps | When |
|---|---|---|
| [https://discoverthreejs.com](https://discoverthreejs.com) | Gentle Three.js book in the browser | After the official “creating a scene” page |
| Three.js Journey (paid): [https://threejs-journey.com](https://threejs-journey.com) | Very clear video path | If you want a structured course |
| React Three Fiber: [https://r3f.docs.pmnd.rs](https://r3f.docs.pmnd.rs) | Write Three.js *inside* React JSX | **Later.** Your app uses “plain” Three.js in `useEffect`, which is easier to understand first |
| Drei (helpers for Fiber): [https://github.com/pmndrs/drei](https://github.com/pmndrs/drei) | Ready-made orbit, stars, etc. | Only after Fiber |
| MDN — Canvas / WebGL overview: [https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Getting_started_with_WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Getting_started_with_WebGL) | What Three.js is wrapping | Optional curiosity |

**React Three Fiber** is popular. Skip it until you can explain: scene, camera, renderer, animation loop. You already have those in `GalaxyCanvas.jsx`.

---

## Class notes in this vault

| Note | Topic |
|---|---|
| `Tutorials/Installing React.md` | Node, npm, Vite, `npm run dev` |
| `Tutorials/Downloading Three.js.md` | `npm install three`, CDN, zip |
| `Tutorials/Git & Github 101.md` | Save and share the project |
| `STYLE GUIDE.md` | HUD look: dark, small type, one accent |

---

## A simple study order

1. Change **slider ranges** or labels in `App.jsx` and see the HUD update  
2. Change **camera start position** in `GalaxyCanvas.jsx` (`camera.position.set`)  
3. Follow Three.js **creating a scene** and compare it to your canvas file  
4. Read React **useEffect** and match it to your setup/cleanup  
5. Pick **one** example on threejs.org (particles or controls) and steal one idea  
6. Only then look at React Three Fiber, if you want a second style of code

If something breaks: open the browser **Console** (F12). The first red line is usually the real error.

---

## Conclusion

You do not need to “finish Three.js” or “finish React.” You need a **loop**:

- React draws a page and listens to you (clicks, sliders)  
- Three.js draws a world and listens to the mouse on the canvas  
- `npm run dev` lets you see both on your computer  

For a beginner, that is enough of a foundation. Your Milky Way app is a real example of that loop. Next skills are small: one new Three.js object, or one new React control — not a new framework every day.

When you are stuck, use the **official** React learn page and the **Three.js manual** before random videos. They match the names in your code.
