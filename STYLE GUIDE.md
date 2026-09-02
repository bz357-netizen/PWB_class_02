# Style Guide

Graphic specification for the **Milky Way** app (`my-react-app`). Use this file as the source of truth for UI. The 3D canvas can stay rich; chrome around it stays sparse, dark, and technical.

---

## Intent

The interface should read like **instrumentation**, not marketing.

- Dark field, almost no decoration
- **Small type** everywhere
- **One** highlight color
- Hairline geometry, tight spacing, monospace labels
- The galaxy is the hero; UI sits on top like a HUD

Do not add a second brand color. Do not use large display titles, soft blurs, or pill-shaped cards.

---

## Color

Only these tokens. Neutrals are grayscale-blue. Highlight is used for **state**, not decoration.

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#07080A` | App / page void |
| `--bg-panel` | `#0C0E12` | Panels, overlays |
| `--bg-panel-90` | `#0C0E12E6` | Panel fill over canvas (`90%`) |
| `--line` | `#2A3038` | Borders, ticks, dividers |
| `--line-dim` | `#1A1E24` | Recessed lines |
| `--text` | `#C8CED6` | Body, labels |
| `--text-dim` | `#7A828C` | Hints, inactive, units |
| `--text-bright` | `#E8ECF0` | Primary heading (still small) |
| `--accent` | `#3EE0FF` | **The only highlight** |
| `--accent-dim` | `#3EE0FF33` | Accent at 20% (tracks, focus rings) |
| `--danger` | — | **Do not add.** Use `--text-dim` or `--accent` |

Canvas clear color should match `--bg` (`#07080A`).

### Highlight rules

Use `--accent` only for:

- Active slider fill / thumb
- Focus outline
- Selected control
- Status “live” or “online”
- One small title tick or index mark (not the whole title)

Never:

- Colored headings
- Colored panel backgrounds
- Rainbow stars in the UI (galaxy particles are 3D, not UI)
- Hover fills that introduce a new hue

---

## Type

**Family:** monospace first.

```text
ui-monospace, "IBM Plex Mono", "SF Mono", Consolas, "Liberation Mono", monospace
```

If a second face is required for long reading, still keep UI chrome on mono. Do not use display serifs or rounded geometric sans.

| Role | Size | Weight | Tracking | Color |
|---|---|---|---|---|
| Kicker / product | `10px` | 500 | `0.16em` | `--text-dim`, uppercase |
| Page title | `18px` | 600 | `0.04em` | `--text-bright` |
| Panel title | `11px` | 600 | `0.14em` | `--text-bright`, uppercase |
| Control label | `11px` | 500 | `0.06em` | `--text` |
| Hint / help | `10px` | 400 | `0.02em` | `--text-dim` |
| Value / readout | `11px` | 500 | `0` | `--accent` |
| Body (rare) | `12px` | 400 | `0` | `--text` |

Hard limits:

- No UI text larger than **18px**
- Line-height **1.35** for labels, **1.25** for titles
- Do not bold an entire panel

---

## Layout

Full-viewport WebGL. HUD is `position: absolute` over the canvas. Overlay root uses `pointer-events: none`; interactive islands use `pointer-events: auto`.

```text
┌─────────────────────────────────────────────────────────┐
│  TITLE (top-left)                    PANEL (top-right)  │
│  kicker + 18px name + hint           hairline box       │
│                                                         │
│                     CANVAS (orbit)                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

| Measure | Value |
|---|---|
| Page inset | `16px` |
| Panel width | `220px` |
| Panel padding | `12px` |
| Gap between controls | `10px` |
| Title block offset | `16px` from top/left |
| Panel offset | `16px` from top/right |

On viewports **&lt; 720px**, dock the panel to the bottom edge, full width minus `16px` inset. Title stays top-left.

---

## Surfaces

Technical, not glassmorphism.

| Element | Treatment |
|---|---|
| Panel | `--bg-panel-90`, **1px** `--line` border, **0–2px** radius |
| Title block | No box, no shadow |
| Dividers | 1px `--line-dim`, full panel width |
| Shadow | None (or `0 0 0` only) |
| Backdrop blur | **Off** |
| Corner radius | `0px` preferred; `2px` maximum |

---

## Controls

### Sliders

- Track height `2px`, color `--line`
- Filled track `--accent`
- Thumb: `8px` square (not a circle), `--accent`
- Label row: name left, **numeric value** right in `--accent`
- Hit area at least `24px` tall

### Future / unused sliders

They must still be **usable** unless a feature is truly missing. Style unused rows as ready controls (same size, same accent). Do not grey out and `disabled` a slider that the user expects to drag. If a control has no scene binding yet, keep it interactive and show the value; bind it later.

### Buttons (when added)

- Height `24px`
- 1px `--line` border, transparent fill
- Hover: border `--accent`, text `--accent`
- No drop shadow, no large radius

### Focus

`:focus-visible { outline: 1px solid var(--accent); outline-offset: 2px; }`

---

## Motion

- HUD: no enter animations
- Sliders: instant
- Canvas: orbit damping already in Three.js; do not add CSS motion on the canvas
- Accent blink: only for a true live indicator, `1s` step or slow pulse, never on titles

---

## 3D vs UI

The galaxy may use many star colors. That does **not** expand the UI palette.

| Layer | Palette |
|---|---|
| WebGL scene | Procedural (core, arms, dust) |
| HUD / panels / type | Tokens in this document only |

---

## CSS variables (copy)

```css
:root {
  --bg: #07080a;
  --bg-panel: #0c0e12;
  --bg-panel-90: #0c0e12e6;
  --line: #2a3038;
  --line-dim: #1a1e24;
  --text: #c8ced6;
  --text-dim: #7a828c;
  --text-bright: #e8ecf0;
  --accent: #3ee0ff;
  --accent-dim: #3ee0ff33;
  --font: ui-monospace, "IBM Plex Mono", "SF Mono", Consolas, monospace;
  --text-kicker: 10px;
  --text-title: 18px;
  --text-panel: 11px;
  --text-ui: 11px;
  --text-hint: 10px;
  --radius: 2px;
  --inset: 16px;
  --panel-width: 220px;
}
```

---

## Do / don’t

**Do**

- Keep labels uppercase or sentence case consistently (prefer **uppercase** for kicker and panel titles)
- Show live numeric readouts next to sliders
- Leave empty canvas; do not frame it

**Don’t**

- Introduce purple, gold, or white-glow brand treatments
- Use 14px+ body copy in the HUD
- Round the side panel like a consumer card
- Disable a slider to mean “coming soon” if the user needs to move it

---

## Checklist before shipping UI

- [ ] No type above 18px
- [ ] No fill color except `--bg`, `--bg-panel`, and `--accent` on controls
- [ ] One accent hex: `#3EE0FF`
- [ ] Monospace HUD
- [ ] 1px borders, ≤2px radius
- [ ] Overlay does not block orbit except on the panel
