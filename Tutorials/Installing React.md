# Installing React

A short tutorial for complete beginners. You do not need to know React or the command line yet.

By the end, you will:

- understand a few command-line basics
- install the tools React needs
- create a React project
- start it and open it in your browser

This class folder is notes (Obsidian). React will live in its **own project folder**, not mixed into random markdown files.

---

## 1. What you are installing

**React** is a library for building websites with reusable pieces called **components**.

React itself is not a program you double-click. You run it with:

| Tool | What it is |
|---|---|
| **Node.js** | Lets your computer run JavaScript outside the browser |
| **npm** | Comes with Node. It downloads packages (including React) |
| **Vite** | A starter that sets up a React project for you |

You install Node once. After that, `npm` can create and run React apps.

---

## 2. Command line in 60 seconds

The **command line** (also called **terminal**) is a text window where you type instructions instead of clicking.

On Windows, use **PowerShell** or **Command Prompt**. In Cursor / VS Code, use **Terminal** (menu: Terminal → New Terminal).

You always work **inside a folder**. These commands move you around:

```powershell
cd Documents
```

`cd` means **change directory** (go into a folder).

```powershell
cd ..
```

Go **up** one folder (the parent folder).

```powershell
dir
```

**List** what is in the current folder. On Mac/Linux the same idea is `ls`.

```powershell
pwd
```

Show **where you are** (full folder path). In Command Prompt, use `cd` with no extra words instead.

If a command fails, read the error. Most beginner mistakes are: wrong folder, or Node not installed yet.

---

## 3. Install Node.js

1. Go to [https://nodejs.org](https://nodejs.org).
2. Download the **LTS** version (the “recommended” one).
3. Run the installer. Keep the defaults. Make sure **npm** is included.
4. **Close and reopen** your terminal (so it can see Node).
5. Check that it worked:

```powershell
node -v
npm -v
```

You should see version numbers, like `v22.x.x` and `10.x.x`. If you see “not recognized,” Node is not on your PATH: reopen the terminal, or reinstall Node and tick the PATH option.

---

## 4. Pick a folder for the app

Do **not** run the create command inside a random notes file. Go to the folder where you want the new project to appear.

Example: this class repo on your computer:

```powershell
cd C:\Users\asus\Documents\GitHub\PWB_class_02
```

Use **your** path if it is different. `cd` into the parent folder; the next step will **create a new subfolder** for React.

---

## 5. Create a React project (Vite)

In the terminal, run:

```powershell
npm create vite@latest my-react-app -- --template react
```

What that means:

- `npm create vite@latest` = use the official Vite starter
- `my-react-app` = the **folder name** for your app (you can change this)
- `--template react` = JavaScript + React (simplest for a first app)

If it asks “Ok to proceed?” type `y` and press Enter.

Then go into the new folder and install packages:

```powershell
cd my-react-app
npm install
```

`npm install` reads a file called `package.json` and downloads everything the app needs into a folder named `node_modules`. That can take a minute. You do not edit `node_modules` yourself.

---

## 6. Run the app

Still inside `my-react-app`:

```powershell
npm run dev
```

Leave this terminal **open**. Vite starts a small local server and prints a URL, usually:

`http://localhost:5173`

Open that address in your browser. You should see the default Vite + React page.

To **stop** the server: click the terminal, then press `Ctrl + C`.

To **start it again** later:

```powershell
cd C:\Users\asus\Documents\GitHub\PWB_class_02\my-react-app
npm run dev
```

You only run `npm install` again if you added new packages or cloned the project on a new computer.

---

## 7. What the folders mean (quick look)

Inside `my-react-app` you will see something like:

| Item | Role |
|---|---|
| `package.json` | Project name, scripts (`dev`, `build`), and package list |
| `index.html` | The single HTML page the app loads |
| `src/` | Your React code lives here |
| `src/main.jsx` | Starts React and attaches it to the page |
| `src/App.jsx` | The main component you will edit first |
| `public/` | Static files (favicon, images) |
| `node_modules/` | Downloaded libraries — do not edit |

Open `src/App.jsx`, change some text, **save**, and watch the browser update. That is React running.

---

## 8. Everyday loop

```text
1. Open a terminal
2. cd into my-react-app
3. npm run dev
4. Open http://localhost:5173
5. Edit files in src/
6. Save and refresh is usually automatic
7. Ctrl + C when you are done
```

Useful extras (run these **inside** `my-react-app`):

```powershell
npm run build    # make a production folder named dist
npm run preview  # preview that production build
```

You do not need `build` until you want to publish the site.

---

## 9. Mistakes beginners make

**`npm` is not recognized**  
Node is missing or the terminal was open during install. Reopen the terminal. Run `node -v` again.

**I ran `npm create` in the wrong folder**  
Delete the extra `my-react-app` folder if it is empty/unwanted, `cd` to the right parent folder, and create it again.

**Port 5173 is already in use**  
Another `npm run dev` is still running. Stop it with `Ctrl + C`, or use the new URL Vite prints (sometimes `5174`).

**I closed the terminal and the site died**  
That is normal. The site only exists while `npm run dev` is running on your machine.

**Do not commit secrets**  
React apps can still leak API keys if you put them in source files. Keep passwords out of Git.

**Create React App (`npx create-react-app`)**  
That older tool is no longer the recommended starter. Use Vite, as above.

---

## 10. Practice checklist

- [ ] Install Node (LTS) and reopen the terminal
- [ ] Run `node -v` and `npm -v`
- [ ] `cd` to the folder where you want the app
- [ ] Run `npm create vite@latest my-react-app -- --template react`
- [ ] `cd my-react-app` then `npm install`
- [ ] `npm run dev` and open `http://localhost:5173`
- [ ] Change text in `src/App.jsx`, save, see it in the browser
- [ ] Stop the server with `Ctrl + C`

If you can do that list, React is installed and running for class.

---

## Where to go next

- Node.js: [https://nodejs.org](https://nodejs.org)
- Vite + React guide: [https://vite.dev/guide](https://vite.dev/guide)
- React docs (start here after the app runs): [https://react.dev/learn](https://react.dev/learn)

If you get stuck, copy the **full error** from the terminal (not just the last line). The first red line is usually the real problem.
