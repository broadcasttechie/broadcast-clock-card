# Broadcast Clock Card

A broadcast-studio style on-air clock for Home Assistant Lovelace dashboards, with an optional row of configurable status bars (e.g. recording / on-air / live indicators).

## Installation

### HACS

Add this repository as a custom repository in HACS (category: Dashboard), then install "Broadcast Clock Card".

### Manual

Copy `broadcast-clock-card.js` into `<config>/www/`, then add it as a Lovelace resource:

```yaml
url: /local/broadcast-clock-card.js
type: module
```

## Usage

```yaml
type: custom:broadcast-clock-card
size_percent: 70
text_scale_percent: 16
ring_color_mode: rainbow
text_color: "#ff3b3b"
show_status_bars: true
show_spoken_time: true
bars:
  - label: STATUS 1
    color: "#ff3b3b"
    entity: binary_sensor.example
```

| Option | Type | Default | Description |
|---|---|---|---|
| `size_percent` | number | `70` | Clock ring size as a percentage of the available card height/width, whichever is smaller (10-100) |
| `text_scale_percent` | number | `16` | Digital time text size as a percentage of the clock ring diameter (5-40) |
| `ring_color_mode` | string | `rainbow` | Second-ring colour: `rainbow`, `sunset`, `ocean`, `neon` (multi-colour palettes), `solid` (uses `ring_color`), or `match_text` (follows `text_color`) |
| `ring_color` | string | `#ff3b3b` | Ring colour used when `ring_color_mode: solid` |
| `text_color` | string | `#ff3b3b` | Colour of the digital time, seconds, date, and spoken-time text |
| `show_status_bars` | boolean | `true` | Show/hide the status bar row |
| `show_spoken_time` | boolean | `true` | Show/hide the plain-English spoken time line (e.g. "Quarter past six") |
| `bars` | list | 4 demo bars | Status bars; each has `label`, `color`, `entity` (optional), `demo_active` (used when no entity is set) |

A visual editor is included — configure entirely from the Lovelace UI if preferred.

Multiple clock face styles (currently only the 60-dot ring) are on the roadmap — the colour and layout logic is kept separate from the tick/render loop so a new face can be added without touching the config schema.
