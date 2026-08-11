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
show_status_bars: true
bars:
  - label: STATUS 1
    color: "#ff3b3b"
    entity: binary_sensor.example
```

| Option | Type | Default | Description |
|---|---|---|---|
| `size_percent` | number | `70` | Clock size as a percentage of card height (10-100) |
| `show_status_bars` | boolean | `true` | Show/hide the status bar row |
| `bars` | list | 4 demo bars | Status bars; each has `label`, `color`, `entity` (optional), `demo_active` (used when no entity is set) |

A visual editor is included — configure entirely from the Lovelace UI if preferred.
