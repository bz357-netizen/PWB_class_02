# Downloading Three.js

A short tutorial for complete beginners. You already have (or can make) a React app with Vite.

By the end, you will know:

- what Three.js is
- the three common ways to get it
- which way to use with `my-react-app`
- how to check that it installed

---

## 1. What Three.js is

**Three.js** is a JavaScript library for 3D in the browser (shapes, lights, camera, animation).

It is **not** a separate program you install like Node. You **download it into a project**, then import it in your code.

Official site: [https://threejs.org](https://threejs.org)

| Way | Best for |
|---|---|
| **npm** (`npm install three`) | Your Vite + React project — **use this** |
| **CDN** (link in HTML) | A single `.html` file, no React |
| **Zip from GitHub** | Looking at examples; usually *not* how you add it to class work |

---

## 2. Before you start

You need **Node.js** and **npm** (same as the React tutorial).

1. Open a terminal in Cursor (Terminal → New Terminal).
2. Check:

```powershell
node -v
npm -v
```

If those fail with “not recognized,” Node is installed but the terminal cannot see it. Try:

```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
node -v
npm -v
```

If that still fails, install Node LTS from [https://nodejs.org](https://nodejs.org), then **close and reopen** Cursor.

Go into your React app folder (the one that contains `package.json`):

```powershell
cd C:\Users\asus\Documents\GitHub\PWB_class_02\my-react-app
```

Use **your** path if the folder lives somewhere else. `dir` should show `package.json`.

---

## 3. Download Three.js with npm (recommended)

This is the normal way. npm copies Three.js into `node_modules` and lists it in `package.json`.

Still inside `my-react-app`:

```powershell
npm install three
```

Wait until it finishes. You should see `three` under `"dependencies"` in `package.json`.

That **is** the download. You do not also need a zip file.

### Prove it loaded

In any `.jsx` file (for a quick test, `src/App.jsx`), you can import it:

```javascript
import * as THREE from 'three'
```

Save, run the app:

```powershell
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). If the page loads with **no red error** in the browser console (F12 → Console), the library imported.

To *see* 3D, you still write a scene (canvas, camera, renderer). Installing only puts the toolbox on your computer.

---

## 4. Option B: CDN (no npm)

Use this only for a **plain HTML** page, not for your React app.

1. Create a file such as `three-test.html`.
2. Add an import map and a small script:

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Three.js CDN test</title>
    <script type="importmap">
      {
        "imports": {
          "three": "https://cdn.jsdelivr.net/npm/three/build/three.module.js"
        }
      }
    </script>
  </head>
  <body>
    <script type="module">
      import * as THREE from 'three'
      console.log('Three.js version:', THREE.REVISION)
    </script>
  </body>
</html>
```

3. Open the file in a browser (or serve the folder). Press F12, open **Console**. You should see a version number.

The CDN “downloads” Three.js from the internet **each time** the page loads. You need to be online.

---

## 5. Option C: Zip from GitHub

This is the literal “download a folder” method. You usually **do not** copy this whole repo into React.

1. Open [https://github.com/mrdoob/three.js](https://github.com/mrdoob/three.js).
2. Click the green **Code** button → **Download ZIP**.
3. Unzip it somewhere you can find (Downloads is fine).
4. Inside you will see `build/`, `examples/`, `src/`, and docs.

For class projects, still prefer `npm install three`. The zip is useful if you want to open the **examples** folder and study them.

Releases (versioned builds): [https://github.com/mrdoob/three.js/releases](https://github.com/mrdoob/three.js/releases)

---

## 6. Tiny picture of where the files go

```text
npm install three
        |
        v
my-react-app/
  package.json          ← lists "three"
  node_modules/three/   ← the actual library (do not edit)
  src/App.jsx           ← you write: import * as THREE from 'three'
```

Never commit secrets. `node_modules` is already ignored by Git; you do **not** upload that folder. Classmates run `npm install` to get Three.js again.

---

## 7. Mistakes beginners make

**I downloaded the zip and dropped it inside `src/`**  
That makes a huge, messy project. Use `npm install three` instead.

**`Cannot find module 'three'`**  
You are in the wrong folder, or you skipped `npm install three`. `cd` into `my-react-app` and run the install again.

**The page is blank**  
Installing Three.js does not draw anything by itself. You need a `<canvas>` (or a React canvas) plus a scene. Check the Console for errors first.

**I used a `<script src="three.js">` tag inside Vite**  
Vite expects `import`. Use npm + `import * as THREE from 'three'`.

---

## 8. Practice checklist

- [ ] `cd` into `my-react-app`
- [ ] Run `npm install three`
- [ ] Confirm `"three"` appears in `package.json`
- [ ] Add `import * as THREE from 'three'` in `src/App.jsx`
- [ ] Run `npm run dev` and open localhost with no console error

---

## Where to go next

- Manual: [https://threejs.org/manual/#en/creating-a-scene](https://threejs.org/manual/#en/creating-a-scene)
- Docs: [https://threejs.org/docs](https://threejs.org/docs)
- npm package: [https://www.npmjs.com/package/three](https://www.npmjs.com/package/three)

When you are ready to put a cube on the React page, say so and we can add a small scene next.
