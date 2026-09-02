# Git & GitHub 101

A short tutorial for complete beginners. You do not need any coding experience.

By the end, you will know:

- what Git and GitHub are (and how they differ)
- how to save versions of your work
- how to put a project on GitHub and keep it in sync

---

## 1. Git vs GitHub

**Git** is a program on your computer. It tracks changes to files. Think of it as “save history” for a whole folder, not just one document.

**GitHub** is a website. It stores Git projects online so you can:

- back them up
- work from another computer
- share with classmates or teammates

| | Git | GitHub |
|---|---|---|
| Where it lives | Your computer | The internet |
| What it does | Records versions | Hosts and shares those versions |
| Do you need it? | Yes, to track history | Optional, but very useful |

You can use Git without GitHub. You cannot use GitHub well without Git.

---

## 2. Words you will see a lot

| Term | Plain English |
|---|---|
| **Repository** (repo) | A project folder that Git is watching |
| **Commit** | A saved snapshot with a short message (“what changed”) |
| **Working folder** | Your files as they look right now, including unsaved Git history |
| **Stage** (add) | Pick which changes go into the next snapshot |
| **Branch** | A parallel line of work (beginners can stay on `main`) |
| **Remote** | A copy of the repo somewhere else, usually GitHub |
| **Clone** | Download a GitHub repo onto your computer |
| **Push** | Send your new commits to GitHub |
| **Pull** | Download new commits from GitHub onto your computer |

You do not need to memorize this list. Come back to it when a word feels new.

---

## 3. Install Git and make a GitHub account

### Git

1. Download Git from [https://git-scm.com](https://git-scm.com).
2. Run the installer. On Windows, the defaults are fine.
3. Open **Git Bash** (Windows) or **Terminal** (Mac).
4. Check that it installed:

```bash
git --version
```

You should see a version number, not an error.

### Tell Git who you are (once)

Git stamps every snapshot with your name and email:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Use the same email as your GitHub account if you can.

### GitHub

1. Go to [https://github.com](https://github.com) and create a free account.
2. Pick a username you are comfortable sharing (it shows up in URLs).

---

## 4. Your first local project

Imagine a folder of notes. You want Git to remember every important save.

### Create a folder and turn it into a repo

```bash
mkdir my-first-repo
cd my-first-repo
git init
```

`git init` tells Git: “watch this folder.”

You will see a hidden `.git` folder. Leave it alone. That is Git’s memory.

### Make a file and check status

Create a file named `hello.txt` with any text, then:

```bash
git status
```

Git will say the file is **untracked**. That means Git sees it but has not saved a snapshot yet.

### Stage, then commit

Saving in Git is two steps on purpose:

1. **Stage** — choose what belongs in this snapshot
2. **Commit** — freeze that snapshot with a message

```bash
git add hello.txt
git commit -m "Add hello.txt"
```

- `git add .` stages every change in the folder (handy, but be careful not to add secrets like passwords).
- The `-m` flag is your commit message. Write it in the present tense, like a short instruction: `Add hello.txt`, `Fix typo in notes`.

Check that it worked:

```bash
git log --oneline
```

You should see one commit.

### Change something and save again

Edit `hello.txt`, then:

```bash
git status
git add hello.txt
git commit -m "Update hello.txt"
```

Now you have two snapshots. You can always go back to an older one if you mess up a file (that is the whole point).

---

## 5. Everyday commands (the loop)

This is the loop you will use forever:

```text
1. Edit files
2. git status          → see what changed
3. git add <files>     → choose what to save
4. git commit -m "..." → save a snapshot
```

Useful extras:

```bash
git diff          # show unstaged changes
git log           # full history
git log --oneline # short history
```

---

## 6. Put the project on GitHub

### Create an empty repo on GitHub

1. Log in to GitHub.
2. Click **New repository**.
3. Name it something like `my-first-repo`.
4. Leave it **empty** (do not add a README yet if you already have files locally — two “first commits” can clash).
5. Click **Create repository**.

GitHub will show you a URL, for example:

`https://github.com/YOUR-USERNAME/my-first-repo.git`

### Connect your computer to GitHub and push

In your project folder:

```bash
git remote add origin https://github.com/YOUR-USERNAME/my-first-repo.git
git branch -M main
git push -u origin main
```

What that means:

- **remote** = “the GitHub copy”
- **origin** = the usual nickname for that copy
- **push** = upload your commits
- `-u origin main` = remember this as the default push/pull target

Refresh the GitHub page. Your files should appear.

The first time you push, GitHub may ask you to sign in. On newer Git versions this often uses a browser login. Follow the prompts.

Later pushes are shorter:

```bash
git push
```

---

## 7. Start from GitHub instead (clone)

If the project already exists on GitHub (a class repo, a friend’s notes):

```bash
git clone https://github.com/USERNAME/REPO-NAME.git
cd REPO-NAME
```

That downloads the files **and** the history. You do not need `git init` after a clone.

Then the same loop: edit → `git add` → `git commit` → `git push`.

If someone else (or you, from another computer) pushed new work:

```bash
git pull
```

Do this before you start work when you share a repo, so you are not editing an old copy.

---

## 8. A tiny picture of the flow

```text
Your computer                      GitHub
---------------                    ------
edit files
     |
git add
     |
git commit  ---- git push ----->   updated repo
     ^
     |          git pull  <-----   (new commits from others)
     |
  git clone (first download)
```

---

## 9. Branches in one minute

A **branch** is a named line of commits. The default is usually `main`.

Beginners can stay on `main` for personal notes.

When you are ready:

```bash
git branch homework-1      # create a branch
git switch homework-1      # move onto it
# ... make commits ...
git switch main            # go back
```

Branches let you try ideas without breaking the “good” copy. GitHub **Pull Requests** are a way to review a branch and then merge it into `main`. You can ignore pull requests until you work on a team.

---

## 10. Mistakes beginners make (and what to do)

**I committed the wrong file**  
If you have not pushed yet, you can often add a new commit that fixes the file. That is normal. History is allowed to have “oops” commits.

**I cannot push: rejected / not fast-forward**  
Someone (including you on another machine) pushed first. Run `git pull`, fix any overlapping edits Git points out, then `git push` again.

**Git says “merge conflict”**  
The same lines were edited in two places. Open the file, look for `<<<<<<<`, `=======`, and `>>>>>>>`, keep the text you want, delete those markers, then `git add` and `git commit`.

**I ran `git init` inside the wrong folder**  
If you have not made important commits, delete the `.git` folder (hidden) and run `git init` in the correct project folder instead. Do not delete `.git` on a project you care about without a backup.

**Never commit passwords, API keys, or `.env` files**  
If you already did, treat those secrets as leaked and change them. Git history keeps old copies.

---

## 11. Mini cheat sheet

```bash
git --version
git config --global user.name "Your Name"
git config --global user.email "you@example.com"

git init
git clone <url>

git status
git add .
git commit -m "Describe the change"
git log --oneline

git remote add origin <url>
git push -u origin main
git push
git pull
```

---

## 12. Practice checklist

Do this once on your own computer:

- [ ] Install Git and run `git --version`
- [ ] Set your name and email
- [ ] Create a GitHub account
- [ ] `git init` in a practice folder
- [ ] Make two commits
- [ ] Create an empty GitHub repo and `git push`
- [ ] Change a file, commit, push again
- [ ] On GitHub, confirm you see both snapshots in **Commits**

If you can do that list, you know enough Git and GitHub to start class projects.

---

## Where to go next

- Official Git guide: [https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control](https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control)
- GitHub’s hello-world: [https://docs.github.com/en/get-started/quickstart/hello-world](https://docs.github.com/en/get-started/quickstart/hello-world)

Keep using `git status`. It is the friendliest command. When you are lost, run it, read what it suggests, and follow those next steps.
