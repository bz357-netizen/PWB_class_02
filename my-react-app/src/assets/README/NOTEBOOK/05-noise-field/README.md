# Noise field

[All areas](my-react-app/README.md)

The Field tab is a height field on the xz plane. Up to four layers each run a noise equation, an optional shape remap, then a blend. The result is written onto a plane mesh. A 2D canvas at the lower left samples the same function, so the map and the mesh should match.

## What I learned

World size is `GRID_SIZE = 48` in `noise.js`. The formula on the 2D panel is:

```text
y = ⊕ᵢ Aᵢ · sᵢ(nᵢ(x, z))
```

`⊕` is the blend (add, mix, max, min, multiply). `s` is the shape (ridged, terrace, clamp, and others). `n` is the equation (Perlin FBM, value noise, Worley, and a few grid simulations).

Daylight is separate from the height. `timeOfDay` and `weather` go through `getDaylight()` and set the sun, the sky, fog, shadows, rain, and the night stars. Some scenarios override the weather: flood forces rain, fire forces storm, snow forces overcast.

A scenario is off by default. When it is on, `eventSim.js` paints fire, flood, snow, or hydraulic erosion over the height. Living settlement also places huts and paths.

## Example

Default scene: 12:00, clear, three layers (base, detail, ridges), resolution 300, mesh display. Fold Simulation, Shape, and Grid when the panel covers too much of the land.

![Field tab, three layers, 2D noise preview](noise-field.png)

An earlier session with hydraulic erosion running. The editor is still in the frame. The sim map shows eroded height and drainage beside the mesh.

![Hydraulic erosion on the terrace, with the drainage preview](erosion-session.png)

## Full notes

| Note | What it answers |
|---|---|
| [Noise field](Noise%20field.md) | What the scene is, and the default controls |
| [Process](Process.md) | Slider → React state → ref → mesh, in order |
| [Script map](Script%20map.md) | Which file to open for a given change |

Code: `my-react-app/src/noise.js`, `simulate.js`, `daylight.js`, `eventSim.js`, `GalaxyCanvas.jsx`.
