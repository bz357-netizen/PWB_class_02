# Voxel, CSG, and meshing

[All areas](my-react-app/README.md)

Two more views of a field, and then a different field.

**Voxel** still uses the noise height. Instead of a smooth plane, each cell becomes a stack of cubes up to that height.

**CSG** does not use height. Each solid is a signed distance (box, sphere, and the other shapes in `density.js`). Solids combine in order:

```text
d = solid₀
d = op₁(d, solid₁)
d = op₂(d, solid₂)
…
```

Negative density is inside. The mesh is the surface where density crosses zero.

## What I learned

A dense grid is `cells³` samples. At 28 cells that is about 22,000. At 64 it is about 262,000. Every extra solid multiplies the whole chain, so one giant grid does not scale.

The volume is cut into **8³ chunks**. A signed distance cannot change faster than a known slope. If the distance at a chunk’s center is larger than the chunk’s radius, the surface cannot enter that chunk, and the chunk is skipped. The HUD line `live/total chunks` and `samples/full` is that test.

The default mesh is **marching cubes**. Eight corner samples pick a case from the Bourke table in `marchTables.js`. Each edge that joins an inside corner to an outside corner gets a vertex, slid by the two densities:

```text
t = d0 / (d0 − d1)
vertex = p0 + t (p1 − p0)
```

Cubes and greedy meshing are in the Mesh dropdown so the triangle count can be compared on the same solid. Surface nets, dual contouring, and transvoxel are studied in the notes and not built here. They need Hermite data, or two grid resolutions, which this field does not store.

## Examples

Voxel, resolution 48. The 2D map is still the noise preview, because this view is the height field drawn as blocks.

![Stacked cubes following the noise height](voxel-terrain.png)

CSG, 28 cells, five solids. The first solid is the base. Later solids use the CSG op (the default shown here starts from a union). The density slice is one horizontal cut. The mesh is the isosurface, so the box on the bottom stays blocky only where the grid is coarse, and the rounded form follows the zero crossing.

![Five sequential solids meshed as one surface](density-csg.png)

## Full notes

Why chunking pays off, what marching cubes gets wrong, and the other meshers: [Chunking and meshing](Chunking%20and%20meshing.md).

The assignment script for this session is in the [16 September log](0916_Vexel&Firebase.md).

Code: `density.js`, `meshing.js`, `marchTables.js`, `VoxelCanvas.jsx`, `CsgCanvas.jsx`.
