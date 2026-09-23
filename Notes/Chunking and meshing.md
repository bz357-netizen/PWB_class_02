---
tags:
  - pwb
  - csg
date: 2026-09-22
---

# Chunking and meshing

Why the CSG tab does not keep one giant voxel grid, and how that grid becomes a mesh.

Code: `my-react-app/src/meshing.js`, `marchTables.js`, `CsgCanvas.jsx`, `density.js`.
Open the app on `#csg`. The **Volume** panel shows chunks, samples, triangles, and rebuild time.

See also: [[Script map]], [[Process]]

---

## Sequential operations get expensive

Each sample walks the solid list in order:

```text
d = solid₀
d = op₁(d, solid₁)
d = op₂(d, solid₂)
…
```

Union, subtract, and intersect are cheap one at a time. The cost is how often we call that chain.

```text
samples × solids × (a few trig calls for rotation)
```

A dense grid is `cells³` samples. At 28 cells that is about 22,000. At 64 it is about 262,000. At 256 it is about 16 million. Every extra solid multiplies the whole thing. Smooth ops and a gyroid make the surface thicker, so more cells sit near the zero crossing.

Memory has the same shape. A dense `Float32` grid is `4 × cells³` bytes, and a cube mesh stores up to 6 faces per surface voxel. Most of those faces point at another solid voxel and should never be drawn.

That is the limit. Sequential CSG is fine for a handful of solids in a 40³ window. It is not a way to fill a large world.

---

## Why chunking

The volume is cut into blocks of **8³ cells**.

A signed distance is Lipschitz: the value cannot change faster than a known slope (about 1 for our primitives, higher for a gyroid). If the distance at a chunk’s center is larger than the chunk’s radius, the surface cannot enter that chunk. We skip it. No samples, no triangles.

What that buys:

- Empty space and deep interior cost one probe, not `8³` samples
- Neighboring chunks both sample the shared face, so a coarse grid where almost every chunk is live can cost more samples than one dense pass. The saving shows up when chunks are rejected. On the default mound at 28 cells, about 30 of 64 chunks stay live
- Memory is one small chunk array, thrown away after meshing, not a full volume
- A later edit can rebuild only the chunks a solid touches
- Each chunk is a small buffer instead of one huge allocation

What it does not buy:

- Moving any solid still rebuilds every live chunk, because each sample depends on the whole sequence. A subtract at one end changes the field produced by earlier unions.
- You cannot skip a chunk just because it misses one solid’s box. Intersect and subtract make the bounds of the result tighter or holey, not a simple union of boxes. The center probe is the safe test.
- Greedy face merges stop at the chunk border, so a flat wall becomes one quad per chunk instead of one quad for the whole wall.
- The probe is only valid while the slope bound holds. The gyroid raises that bound with frequency, so fewer chunks get skipped. Underestimating the slope would leave holes, so the bound is padded.

The HUD line `live/total chunks` and `samples/full` is this test, measured.

---

## Marching cubes

This is the mesh the CSG tab builds by default.

Each cell has 8 corner samples. The pattern of inside/outside (density &lt; 0 is inside) picks a case from the Bourke table in `marchTables.js`. Every edge that connects an inside corner to an outside corner gets a vertex, slid along the edge by the two densities. The case emits triangles through those vertices.

```text
t = d0 / (d0 − d1)     vertex = p0 + t (p1 − p0)
```

Features:

- One triangle mesh, not a cube per voxel
- The surface passes through the zero crossing, so a sphere stays round
- Vertex count follows surface area, not the volume of the solid
- Shared corner samples on a chunk face keep neighboring chunks from opening a crack
- Normals come from the density slope, so lighting follows the hill instead of the cube

Limits:

- Ambiguous corners (two opposite corners inside, the other pair outside) have more than one legal connection. The table picks one. A thin tunnel can pinch.
- Sharp edges become chamfers. A box’s crease is rounded to the grid.
- If the real surface lies outside the sample window, every chunk center is still deep inside, so the probe skips the volume and the mesh is empty. Drawing the border as air would fake a box around a solid that continues past the window.

---

## Other ways to mesh the same field

| Technique | What it emits | Useful when | Weakness |
|---|---|---|---|
| Cubes | One quad for each exposed voxel face | You want the occupancy, exactly | Stairs. Triangle count tracks every step of the surface |
| Greedy | Those same faces, merged into larger quads | Flat CSG: boxes, cuts, floors | No slopes. Chunk borders break the merge |
| Marching cubes | Triangles on the zero crossing | Smooth hills, spheres, fillets | Ambiguous cases. Creases are lost |
| Surface nets | One vertex per boundary cell, pulled onto the surface, then quads | Fewer polygons than marching cubes, a bit sharper | Can self-intersect. Not always a closed manifold |
| Dual contouring | One vertex per boundary cell, placed to keep the crease (needs Hermite data: where the edge crosses, and the normal there) | Hard edges from a box or a cut | Heavier. Cracks if neighbors disagree. More memory |
| Transvoxel | Marching cubes plus extra transition cells between a coarse chunk and a fine one | Level of detail without holes | A second, larger case table |
| Marching tetrahedra | Split each cube into tetrahedra and polygonize those | Tiny case table, no ambiguities | More triangles. The split direction biases the surface |
| Splats / brick shader | Draw the voxels directly, no mesh | Very fast edits | Silhouette stays blocky. Hard to export |

Cubes and greedy are both in the **Mesh** dropdown so the triangle counter can be compared on the same solid. Surface nets, dual contouring, and transvoxel are not built here. They need extra data (Hermite edges, or two resolutions) that this density field does not store yet.

---

## Making the voxel structure cheaper

What the mesher does now:

1. **Sparse chunks.** Only chunks the probe cannot reject are sampled. The full `cells³` array is never allocated.
2. **Surface only.** Interior voxels never become triangles. Cube and greedy modes keep a one-cell halo so a chunk border does not invent an inner wall.
3. **Face merge.** Greedy meshing collapses a flat run of cube faces into one quad. A box drops from hundreds of triangles toward a handful, plus a few extra quads where a chunk border cuts the face.
4. **One mesh.** The GPU gets a single vertex buffer. The old path uploaded a full cube instance for every surface voxel, including faces buried against a neighbor.

What is still left on the table:

- Rebuild only dirty chunks when one solid moves
- An octree, so large empty regions are one node instead of many rejected chunks
- Coarser chunks far from the camera (that is when transvoxel matters)
- A worker thread, so a 40³ rebuild does not hitch the sliders

The readout to watch is `samples / full` and `tris`. If those stay close to the full grid, the solid is filling the window (or it is a gyroid) and chunking has little to skip.
