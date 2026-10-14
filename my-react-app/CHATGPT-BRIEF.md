# Brief for changing this website

Give this file to ChatGPT together with the source files listed below. This note explains the site. The `.jsx`, `.js`, and `.css` files are what ChatGPT should edit.

## What this is

Procedural World Building class site. A Vite + React + Three.js terrain viewer. Users sign in with Firebase email and password, then enter a 3D landscape. The live site is https://pwb2026-3cb0f.web.app

Stack: React 19, Three.js r185, Vite 8, Firebase 12, MediaPipe hand tracking.

## How to run it locally

From the `my-react-app` folder:

```
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open http://127.0.0.1:5173/ and sign in.

## What must stay

- Sign-in happens before the 3D world. Do not show the terrain until the user is signed in.
- Saved setups stay private to that account. Do not make Firestore or Storage public.
- Do not read, print, or commit `.env.local`. It holds the Firebase keys.
- Field is the default view. Water flow and vortices belong on the Shaders view.
- The right hand sculpts terrain. The left hand orbits the camera. The mouse can still orbit.
- Keep the dark IBM Plex Mono panel style. Colors and type are defined in `src/index.css`, `src/App.css`, and `src/assets/README/NOTEBOOK/08-interface/STYLE GUIDE.md`.

## Files to attach, by change

| Change | Files |
|---|---|
| Layout, panels, sign-in gate | `src/App.jsx`, `src/App.css`, `src/index.css` |
| Sign-in screen or account menu | `src/SignInScreen.jsx`, `src/AccountMenu.jsx`, `src/useAuth.js` |
| Hand tracking or sculpting | `src/handTracker.js`, `src/handOrbit.js`, `src/terrainSculpt.js`, `src/HandPanel.jsx` |
| Terrain, water, or shaders | `src/GalaxyCanvas.jsx` or `src/ShaderCanvas.jsx`, plus `src/shaders.js`, `src/waterRipple.js`, or `src/flowField.js` |
| Colors and type | `src/index.css`, `src/App.css`, `src/assets/README/NOTEBOOK/08-interface/STYLE GUIDE.md` |

Also attach `package.json` so ChatGPT knows the libraries.

## Leave these out

Do not upload `.env.local`, `dist/`, `node_modules/`, or `package-lock.json`.
