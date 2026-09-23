# Firebase

A short tutorial for complete beginners. You already have a Vite + React app (`my-react-app`). You do not need to know servers yet.

By the end, you will:

- know what Firebase is (and what it is not)
- create your own Firebase project
- connect that project to `my-react-app`
- save one note in the cloud and read it back

This does **not** replace the terrain. Firebase is a separate tool. You add a small test beside the app, then you can remove the test.

See also: [[Installing React]], [[Downloading Three.js]]

---

## 1. What Firebase is

Your React site runs in the **browser**. It can draw the terrain. It cannot, by itself, keep a shared list of notes after you close the tab. Something on the internet has to store that.

**Firebase** is Google’s set of backend tools. You do not rent a computer or install a database program. You create a project on Firebase’s website, and your React app talks to it.

For this tutorial you only turn on **one** product:

| Product | Plain English | This tutorial |
|---|---|---|
| **Firestore** | A database. Lists of documents in the cloud | **Yes. Use this** |
| Authentication | Sign in with email or Google | Not yet |
| Storage | Upload images and files | Not yet |
| Hosting | Put the finished website on the internet | Not yet |
| Realtime Database | An older database with a different API | **Do not use this one** |

If a blog says `firebase.database()`, that is the old Realtime Database. This tutorial uses **Firestore** and the modern `import` style.

Official start page: [https://firebase.google.com/docs/web/setup](https://firebase.google.com/docs/web/setup)

---

## 2. Words you will see a lot

| Term | Plain English |
|---|---|
| **Project** | One Firebase “account folder” for this class app |
| **Web app** | The registration of `my-react-app` inside that project |
| **Config** | A few IDs that tell your code which project to call |
| **SDK** | The `firebase` package you install with npm |
| **Collection** | A named list, like a folder of notes |
| **Document** | One item in that list |
| **Security rules** | Who is allowed to read and write. The database is not “open” just because your page is |

You do not need to memorize the list. Come back when a word shows up in an error.

---

## 3. Create your own Firebase project

1. Open [https://console.firebase.google.com](https://console.firebase.google.com) and sign in with a Google account.
2. Click **Add project** (or **Create a project**).
3. Name it something you will recognize, such as `pwb-class`.
4. When it asks about **Google Analytics**, turn it **off** for this tutorial. You can add it later. Analytics adds an extra ID you do not need yet.
5. Wait until the project finishes creating, then open it.

You now have an empty project. No code is connected yet.

---

## 4. Register the React app

Still in the Firebase console, on the project overview:

1. Click the **Web** icon (`</>`). It means “this app runs in a browser,” not “I am writing HTML by hand.”
2. App nickname: `my-react-app`.
3. Do **not** check “Also set up Firebase Hosting.” Hosting is a later topic.
4. Click **Register app**.
5. Firebase shows a `firebaseConfig` object. It looks like this (yours will have real values):

```js
const firebaseConfig = {
  apiKey: "…",
  authDomain: "pwb-class.firebaseapp.com",
  projectId: "pwb-class",
  storageBucket: "pwb-class.firebasestorage.app",
  messagingSenderId: "…",
  appId: "…"
}
```

6. Leave that tab open. You will copy those values into a file on your computer in step 7.
7. You can skip the “add the SDK” snippet Firebase shows. This project already uses npm and Vite. The next sections do that part the class way.

---

## 5. Create the Firestore database

1. In the left menu, open **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Standard edition** if it asks. (Do not pick the older Realtime Database.)
4. Start in **test mode**. Firebase will write a rule that allows reads and writes for about 30 days.
5. Pick a region close to you. **You cannot casually move the database later.** If you are unsure, the default US region is fine for class.
6. Click **Enable** and wait until the empty database page appears.

Test mode is only for learning. Anyone who knows your project ID can read and write until the rule expires. Do not store passwords, private notes, or classmate data in test mode.

---

## 6. Install Firebase in `my-react-app`

Open a terminal in Cursor. Go into the app folder (not the notes folder):

```powershell
cd C:\Users\asus\Documents\GitHub\PWB_class_02\my-react-app
npm install firebase
```

Check `package.json`. You should see `"firebase"` next to `"react"` and `"three"`.

If npm says it cannot find `package.json`, you are in the wrong folder.

---

## 7. Put the config in `.env.local`

Vite only shares environment variables whose names start with `VITE_`. Create a new file:

`my-react-app/.env.local`

Paste your real values from the Firebase config. No quotes around the file itself. One name per line:

```text
VITE_FIREBASE_API_KEY=paste-apiKey-here
VITE_FIREBASE_AUTH_DOMAIN=paste-authDomain-here
VITE_FIREBASE_PROJECT_ID=paste-projectId-here
VITE_FIREBASE_STORAGE_BUCKET=paste-storageBucket-here
VITE_FIREBASE_MESSAGING_SENDER_ID=paste-messagingSenderId-here
VITE_FIREBASE_APP_ID=paste-appId-here
```

This file is gitignored because the repo ignores `*.local`. Do not rename it to `.env` and commit it. Do not paste the config into Discord or a screenshot you post publicly.

**About `apiKey`:** in a web app this key is not a secret password. Firebase expects it to be in the browser. What protects the data is **security rules**, not hiding this key. Still keep the file local so you are not in the habit of committing project IDs by accident.

If you later download a **service account JSON** (“admin” key), that one **is** a secret. Never put it in `src/` or in React.

Restart the dev server after you save `.env.local`. Vite reads that file only when it starts.

---

## 8. One small connection file

Create `my-react-app/src/firebase.js`:

```js
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
```

`initializeApp` runs once. `db` is the handle the rest of your code uses to talk to Firestore.

---

## 9. Save one note and read it back

Create `my-react-app/src/NoteTester.jsx`:

```jsx
import { useState } from 'react'
import { addDoc, collection, getDocs } from 'firebase/firestore'
import { db } from './firebase.js'

export default function NoteTester() {
  const [text, setText] = useState('hello from class')
  const [lines, setLines] = useState([])
  const [status, setStatus] = useState('Not saved yet')

  const saveNote = async () => {
    setStatus('Saving…')
    try {
      await addDoc(collection(db, 'notes'), {
        text,
        createdAt: Date.now(),
      })
      setStatus('Saved')
    } catch (error) {
      setStatus(error.message)
    }
  }

  const loadNotes = async () => {
    setStatus('Loading…')
    try {
      const snap = await getDocs(collection(db, 'notes'))
      const next = []
      snap.forEach((doc) => {
        next.push(doc.data().text)
      })
      setLines(next)
      setStatus(`${next.length} note(s)`)
    } catch (error) {
      setStatus(error.message)
    }
  }

  return (
    <div className="note-tester">
      <input value={text} onChange={(event) => setText(event.target.value)} />
      <button type="button" onClick={saveNote}>Save</button>
      <button type="button" onClick={loadNotes}>Load</button>
      <p>{status}</p>
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
```

In `src/App.jsx`, add the import at the top with the other imports:

```jsx
import NoteTester from './NoteTester.jsx'
```

Inside the `return`, just under `<div className="app">`, add:

```jsx
<NoteTester />
```

That box sits on top of the terrain only while you are testing. Delete those two lines when you are done. Do not delete the rest of `App.jsx`.

Start the app if it is not running:

```powershell
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Click **Save**, then **Load**. The sentence should come back.

Then, in the Firebase console, open **Firestore Database**. You should see:

```text
notes                 ← collection
  (random id)         ← document
    text: "hello from class"
    createdAt: 1710…
```

That random id is Firestore’s name for the document. You did not have to invent it. `addDoc` creates it.

```text
Browser  NoteTester.jsx
           │  addDoc / getDocs
           ▼
        firebase.js
           │
           ▼
     Firestore in your project
        collection "notes"
```

---

## 10. What test mode actually allows

In the Firestore **Rules** tab you will see something close to this (the date will be about a month after you created the database):

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(YYYY, M, D);
    }
  }
}
```

`{document=**}` means every collection. `allow read, write` means anyone. The date is the only lock, and it expires.

When you are ready to close it, a strict beginner rule is “nobody can touch it”:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Publish rules with the **Publish** button. After that, Save will fail with `Missing or insufficient permissions`. That failure is useful. It proves the rules are what guard the data, not the `apiKey`.

A real app would allow writes only for a signed-in user. That is Firebase Authentication, and it is the next tutorial, not this one.

---

## 11. Mistakes beginners make

**`npm` cannot find `package.json`**  
You ran the install in `PWB_class_02` instead of `my-react-app`. `cd` into `my-react-app` and run `npm install firebase` again.

**`Firebase: Error (auth/invalid-api-key)` or `projectId` is undefined**  
`.env.local` is missing, a name does not start with `VITE_`, or the dev server was already running when you saved the file. Stop it with `Ctrl + C`, start `npm run dev` again.

**`Missing or insufficient permissions`**  
The rules rejected the write. You are not in test mode, the test-mode date has passed, or you published `if false`. Open the Rules tab and read the condition.

**I created a Realtime Database**  
The left menu has two databases. This tutorial uses **Firestore**. The code imports `firebase/firestore`. The other database will stay empty, and that is fine.

**I pasted an old tutorial**  
If the sample says `import firebase from 'firebase'` or `firebase.firestore()`, it is the old style. Use the `initializeApp` / `getFirestore` / `addDoc` version above.

**The terrain broke**  
You only needed two added lines in `App.jsx` (the import and `<NoteTester />`). If the page is blank, open the browser console (F12) and read the first red line. Removing `<NoteTester />` puts the terrain back. `firebase.js` can stay.

**I committed `.env.local`**  
It should be ignored by `*.local` in `.gitignore`. Run `git status` and confirm `.env.local` is not listed. If it is listed, do not commit it.

---

## 12. Practice checklist

- [ ] Create a Firebase project with Analytics off
- [ ] Register a web app named `my-react-app` and copy `firebaseConfig`
- [ ] Create a **Firestore** database in test mode
- [ ] `cd` into `my-react-app` and run `npm install firebase`
- [ ] Save the six values in `.env.local` with `VITE_` names
- [ ] Add `src/firebase.js` and `src/NoteTester.jsx`
- [ ] Show `<NoteTester />` once, restart `npm run dev`
- [ ] Save a note, load it, and see the document in the Firestore console
- [ ] Remove `<NoteTester />` from `App.jsx` when you are finished looking

---

## Where to go next

- Web setup: [https://firebase.google.com/docs/web/setup](https://firebase.google.com/docs/web/setup)
- Add data: [https://firebase.google.com/docs/firestore/manage-data/add-data](https://firebase.google.com/docs/firestore/manage-data/add-data)
- Rules: [https://firebase.google.com/docs/firestore/security/get-started](https://firebase.google.com/docs/firestore/security/get-started)

When this checklist works, the next small step is Authentication: only you can write notes. Not Hosting, and not a second database.
