# Interface

[All areas](my-react-app/README.md)

The HUD is instrumentation. The galaxy, the terrace, and the CSG solid can be visually busy. The chrome around them stays dark, small, and technical.

## What I learned

One highlight color, `#3EE0FF`. It marks state: the active tab, the slider fill, the numeric readout, focus. It is not a decoration, and there is no second brand color.

Type is monospace. Nothing in the HUD is larger than 18px. The page title is 18px. Panel titles are 11px, uppercase, tracked out. Panels use a 1px line, a 0–2px corner radius, and no blur and no shadow.

The canvas is the full window. The HUD is `position: absolute`. The overlay root ignores the pointer, so orbit still works. Each panel sets `pointer-events: auto`, so the sliders still receive the drag.

On a narrow window (under 720px) the controls dock to the bottom. The title stays at the top left.

## Example

The controls panel: hairline border, uppercase section titles, the value in the accent, a square thumb on a 2px track.

![Controls panel, one accent on the active tab and the slider values](hud-controls.png)

The same rules on the full page. Title at the top left, map at the lower left, account at the bottom center, controls at the top right. Empty canvas between them.

![Full HUD over the field](noise-field.png)

## Full notes

Tokens, type sizes, slider rules, and the shipping checklist: [STYLE GUIDE](STYLE%20GUIDE.md).

The CSS variables from that guide are copied into `my-react-app/src/index.css`. Layout is `App.css`.
