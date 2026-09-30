# Git and GitHub

[All areas](../../README.md)

Git is the history of this folder. GitHub is the copy of that history at [bz357-netizen/PWB_class_02](https://github.com/bz357-netizen/PWB_class_02).

## What I learned

Git watches a folder. A **commit** is one saved snapshot with a message. The everyday loop is:

```text
edit files
git status
git add <files>
git commit -m "Describe the change"
git push
```

`git pull` brings down commits that were made somewhere else. A **branch** is a parallel line of commits. This class work stays on `main`.

Two rules that already mattered in this repo:

- Do not commit `.env.local`. The Firebase web config lives there. The file is ignored because the name ends in `.local`.
- Do not commit `node_modules`. Classmates run `npm install` and get React, Three.js, and Firebase from `package.json`.

## Full notes

The beginner walkthrough, with the install, the first commit, clone, and the mistakes that usually show up: [Git & Github 101](Git%20%26%20Github%20101.md).

## Where this shows up

The study notes and `my-react-app` are one repository. Pushing `main` is how the notebook and the app stay together.
