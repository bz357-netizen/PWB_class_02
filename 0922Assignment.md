---
tags:
  - pwb
  - assignment
date: 2026-09-22
---

# 0922 Assignment

Scripts from this session. Related notes: [[Script map]], [[Chunking and meshing]]

---

5.

Create a Voxel Terrain in a different tab

2.

Explore and implement different density shapes

Explore and understand CSG techniques — sequential operations

3.

Sequential operations

Consider the limitations of size and performance

Explore and document why we need "chunking"

Implement a "meshing" solution such as marching cubes

Document and understand the features of alternative meshing techniques

Explore ways to optimize a voxel structure

4.
Your Firebase tutorial is in ==`Tutorials/Firebase.md`, in the same style as the React and Three.js notes.==

It walks through a project you create yourself, then connects it to `my-react-app`:

- What Firestore is, and which Firebase products to ignore for now
- Create a project, register the web app, and start a database in test mode
- `npm install firebase`, put the config in `.env.local`, and add `src/firebase.js`
- A small **Save / Load** box that writes one note and shows it in the Firebase console
- Why test-mode rules expire, and the mistakes that usually block the first write

The terrain stays as it is. The note box is only there while you try the checklist, and the tutorial tells you which two lines to remove afterward.
