---
tags:
  - pwb
  - assignment
date: 2026-09-22
---


[Sessions](my-react-app/README.md) · [All areas](my-react-app/README.md)

Scripts from this session. Related notes: [[Script map]], [[Chunking and meshing]]

---

1.

Create a Voxel Terrain in a different tab

![Voxel tab: cubes stacked to the noise height](voxel-terrain.png)

2.

Explore and implement different density shapes

Explore and understand CSG techniques — sequential operations

3.

Sequential operations

Consider the limitations of size and performance

Explore and document why we need "chunking"

Implement a "meshing" solution such as marching cubes

![CSG tab after meshing: density slice and the isosurface](density-csg.png)

Document and understand the features of alternative meshing techniques

Explore ways to optimize a voxel structure


4.
The Firestore walkthrough is [0916_Firebase.md](0916_Firebase.md), in the same style as the React and Three.js notes.

It walks through a project you create yourself, then connects it to `my-react-app`:

- What Firestore is, and which Firebase products to ignore for now
- Create a project, register the web app, and start a database in test mode
- `npm install firebase`, put the config in `.env.local`, and add `src/firebase.js`
- A small **Save / Load** box that writes one note and shows it in the Firebase console
- Why test-mode rules expire, and the mistakes that usually block the first write

The terrain stays as it is. The note box is only there while you try the checklist, and the tutorial tells you which two lines to remove afterward.

---

## Sign-in session

Scripts from the Firebase account session, with the replies. The real `apiKey` stays in `my-react-app/.env.local` only. Do not paste it into this note.

![Account box used for Create and Sign in](account-panel.png)

5.

Install Firebase in the app folder, not the notes folder:

```powershell
cd C:\Users\asus\Documents\GitHub\PWB_class_02\my-react-app
npm install firebase
```

`package.json` already lists `"firebase"` next to `"react"` and `"three"`.

6.

Create `my-react-app/.env.local`. Vite only shares names that start with `VITE_`. One name per line, no quotes:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

The repo ignores `*.local`, so this file is not committed. Do not rename it to `.env`. Restart `npm run dev` after saving. Vite reads that file only when it starts.

The web `apiKey` is not a secret password. Firebase expects it in the browser. Security rules protect the data. A downloaded service-account JSON is a secret. Never put that file in `src/` or in React.

7.

`my-react-app/src/firebase.js` connects the app once:

```js
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
```

`initializeApp` runs once. `auth` is the handle for Create and Sign in. `db` is the handle for Firestore.

8.

Create and Sign in both failed at first.

The account panel calls `createUserWithEmailAndPassword` and `signInWithEmailAndPassword`. The first error was `auth/api-key-not-valid`. The key copied from the setup screenshot had one wrong letter, so Google rejected both buttons before it checked the email or password.

The corrected key is the first line of `my-react-app/.env.local`:

```text
VITE_FIREBASE_API_KEY=
```

Replace only the text after `=`. Leave the other five lines. Save, then restart the dev server.

**Web Push certificates** in Firebase is the wrong screen. That page is for Cloud Messaging. Do not click **Generate key pair**.

The `apiKey` is on **项目设置 → 常规 → 您的应用**, inside `firebaseConfig`. Copy the text in quotes on the `apiKey` line. It starts with `AIza`.

9.

After the key was fixed, the panel said `auth/configuration-not-found`. The key was accepted. Email sign-in was never turned on.

In the Firebase console, project **PWB2026**:

1. Open [https://console.firebase.google.com/](https://console.firebase.google.com/) and click **PWB2026**.
2. Left menu: **Authentication** (身份验证). If you only see **构建**, open that first.
3. Click **Get started** (开始使用).
4. Open **Sign-in method** (登录方法).
5. Click **Email/Password** (电子邮件/密码).
6. Turn on the first switch, **Enable** (启用). Leave the second switch off.
7. Click **Save** (保存).

Then use **Create** in the app. The password must be at least 6 characters. This console change does not need another dev-server restart.

10.

`http://localhost:5173/` is the private copy on this computer. It works only while `npm run dev` is running.

The public site is:

https://pwb2026-3cb0f.web.app

In the console: **Hosting** (托管), under **构建** if the left menu is collapsed. The address at the top ends in `.web.app`.

The settings URL for the web app (`settings/general/web:…`) shows `firebaseConfig`. It is not the website link.

11.

The public site kept showing `auth/api-key-not-valid` after `.env.local` was fixed. The published JavaScript still contained the old key. Changing the local file does not change a site that was already uploaded.

The app was built again and published to the same Hosting URL. A fresh load of https://pwb2026-3cb0f.web.app now sends the corrected key, and Google accepts that key.

If the old error is still on screen, the browser is showing the previous files. Close the tab, open https://pwb2026-3cb0f.web.app again, or press Ctrl+Shift+R. Check that the address is the `.web.app` link, not `localhost`.

If the message then becomes “open Authentication, click Get started,” finish step 9. That switch is still required before Create or Sign in can succeed.

