# Broadcast Clock Card

A broadcast-studio style on-air clock for Home Assistant Lovelace dashboards — built for radio studio clocks, TV studio and control-room master clocks, podcast/streaming setups, and any desk or wall display that wants a proper clock alongside live status indicators. Choose a Master Clock (studio analog), LED Ring (60-dot second ring with a digital or segment-LED readout), plain Text display, or a running Timecode (SMPTE/LTC-style session timer), plus an optional row of configurable status bars — ON AIR lights, recording indicators, streaming/mic-live lights, or any other single-colour or multi-state status synced to a Home Assistant entity.

## Use cases

- **Radio studio on-air clock** — master clock plus an ON AIR / MIC LIVE light bar synced to your mixing desk or broadcast software's status.
- **TV studio / control room master clock** — a large, legible studio-analog or LED-ring clock for a gallery or control room wall.
- **Podcast or streaming desk** — a "LIVE" or mic-status indicator next to the time, driven by an OBS/Teams/Zoom "in call"/"mic muted" sensor.
- **Home office on-air light** — a simple recording/on-air indicator tied to a webcam, mic, or do-not-disturb sensor, without dedicated hardware.

## Screenshots

*(a few still pending — placeholders below will be filled in. The Master Clock shot also shows the single-colour status bars alongside it.)*

| Master Clock (+ status bars) | LED Ring — glowing | LED Ring — bulb |
|---|---|---|
| ![Master Clock with status bars](screenshots/master-clock.webp) | ![LED Ring, glowing style](screenshots/led-ring-glowing.png) | ![LED Ring, bulb style](screenshots/led-ring-bulb.webp) |

| LED Ring — flat | Text — segment font | Text — normal font |
|---|---|---|
| ![LED Ring, flat style](screenshots/led-ring-flat.png) | ![Text style, segment font](screenshots/text-segment.png) | ![Text style, normal font](screenshots/text-normal.webp) |

| Status bars — single-colour | Status bars — multi-state |
|---|---|
| ![Single-colour status bars](screenshots/status-bars-single.png) | ![Multi-state status bars](screenshots/status-bars-multi.png) |

## Installation

### HACS

Add this repository as a custom repository in HACS (category: Dashboard), then install "Broadcast Clock Card".

### Manual

Copy `broadcast-clock-card.js` into `<config>/www/`, then add it as a Lovelace resource:

```yaml
url: /local/broadcast-clock-card.js
type: module
```

A visual editor is included — every option below is also configurable entirely from the Lovelace UI.

## Quick start

```yaml
type: custom:broadcast-clock-card
clock_type: led_ring
led_style: glowing
ring_color_mode: rainbow
bars:
  - label: ON AIR
    color: "#ff3b3b"
    entity: binary_sensor.on_air
```

```yaml
# Studio analog clock, smooth sweep second hand, no bars
type: custom:broadcast-clock-card
layout: clock_only
clock_type: master_clock
second_hand_style: smooth
```

```yaml
# Plain 7-segment digital readout, 12-hour time
type: custom:broadcast-clock-card
clock_type: text
text_font: segment
time_format: 12h
```

```yaml
# Running session timecode, driven by a recording sensor
type: custom:broadcast-clock-card
layout: clock_only
clock_type: timecode
text_font: segment
timecode_trigger: entity
timecode_source_entity: binary_sensor.recording
timecode_active_state: "on"
```

## Config reference

### Top level

| Option | Type | Default | Description |
|---|---|---|---|
| `layout` | string | `clock_bars` | Panel arrangement: `clock_bars`, `bars_clock`, `clock_only`, `bars_only`, `stacked` (clock above bars) |
| `clock_type` | string | `led_ring` | `master_clock`, `led_ring`, `text`, or `timecode` — see below for type-specific options |
| `size_percent` | number | `70` | Clock size as a percentage of the available card height/width, whichever is smaller (10-100) |
| `text_scale_percent` | number | `16` | Digital/segment text size as a percentage of the clock's own size (5-40) |
| `text_glow_percent` | number | `100` | Glow intensity (0-200) — drives the LED Ring/Text digit glow and the Master Clock's edge-lit ring glow. Does **not** affect the LED Ring's own dot glow (see `led_style`) |
| `show_case` | boolean | `true` | Show the dark bezel "case" housing around the clock face |
| `text_color` | string | `#ff3b3b` | Colour of digital/segment text, date, and spoken-time text |
| `show_date` | boolean | `true` | Show/hide the date line |
| `date_format` | string | `long` | `long` ("Friday, 14 August"), `long_year` (+ year), `short` ("14 Aug 2026"), `numeric` ("14/08/2026") |
| `date_font` | string | `default` | `default` or `mono` (monospace) |
| `show_spoken_time` | boolean | `true` | Show/hide the spoken time line (e.g. "Quarter past six") |
| `language` | string | *(none)* | Overrides Home Assistant's own language for the date line and spoken time (e.g. `de`, `fr`) — useful for a shared/wall-mounted display that needs a fixed language regardless of who's logged in. Blank follows `hass.language`. The visual editor itself always follows your own `hass.language`, independent of this setting |
| `time_sync_entity` | string | *(none)* | Optional entity (e.g. a template sensor ticking every second) whose `last_updated` timestamp corrects the clock against server time instead of the browser/tablet's own clock. Corrections apply at most once a minute regardless of how often the entity itself updates |
| `bars` | list | 4 demo bars | Status bars — see [Status bars](#status-bars) |
| `bar_off_style` | string | `neutral` | Inactive single-colour bar background: `neutral` (fixed dark grey) or `tinted` (a darker shade of the bar's own on-colour) |
| `bar_off_brightness` | number | `15` | % of the on-colour's brightness kept for the off state when `bar_off_style: tinted` (5-40) |

### `clock_type: master_clock`

Studio analog clock face with hour/minute/second hands. No sub-styles beyond:

| Option | Type | Default | Description |
|---|---|---|---|
| `second_hand_style` | string | `tick` | `tick` (discrete per-second steps, optionally with overshoot bounce) or `smooth` (continuous sweep via `requestAnimationFrame`, always accurate — recomputed from real time every frame, never drifts) |
| `second_hand_bounce_deg` | number | `2` | Overshoot bounce in degrees when settling each tick (0-8). `tick` style only |
| `tick_travel_time` | string | `medium` | How long each tick's step takes: `short`, `medium`, `long`. `tick` style only |

### `clock_type: led_ring`

A 60-dot second ring wrapping a digital or segment-LED readout (the readout uses the shared "text style" options below).

| Option | Type | Default | Description |
|---|---|---|---|
| `ring_color_mode` | string | `rainbow` | `rainbow`, `sunset`, `ocean`, `neon` (multi-colour palettes), `solid` (uses `ring_color`), or `match_text` (follows `text_color`) |
| `ring_color` | string | `#ff3b3b` | Ring colour used when `ring_color_mode: solid` |
| `led_style` | string | `glowing` | `flat` (plain dot), `glowing` (soft drop-shadow glow on every lit dot), or `bulb` (glow + a glassy highlight circle per dot) |
| `emphasize_current_second` | boolean | `true` | Give the current-second dot a modest size bump. Independent of the glow — every lit dot glows regardless of this setting |
| `led_off_style` | string | `dull` | Unlit dots: `dull` (dim, still visible) or `blank` (fully invisible until lit) |
| `ring_countdown` | boolean | `false` | Invert which dots are lit — the ring starts each minute fully dark and fills up to fully lit by :59, instead of starting fully lit and emptying out |

### Shared text style (`led_ring`'s readout, and standalone `clock_type: text`)

| Option | Type | Default | Description |
|---|---|---|---|
| `text_font` | string | `normal` | `normal` (plain digits) or `segment` (true 7-segment LED digit rendering) |
| `segment_style` | string | `flat` | `text_font: segment` only. `flat` (soft outline glow) or `glowing` (brighter, punchier multi-layer halo matching the LED Ring's `bulb` style) |
| `show_seconds` | boolean | `true` | Show/hide the seconds |
| `seconds_placement` | string | `newline` | `inline` (same line as HH:MM), `newline` (own line, smaller), or `newline_large` (own line, full size) |
| `time_format` | string | `24h` | `24h` or `12h`. In `12h` + `segment` font, AM/PM shows as a 2-dot indicator (top lit = AM, bottom lit = PM) rather than text |

### `clock_type: timecode`

A running SMPTE/LTC-style session timer, `HH:MM:SS:FF` (frames), using the same digit rendering as the shared text style (`text_font`/`segment_style`) but always inline, with no seconds-placement or 12/24h options — it's a stopwatch, not a wall clock.

| Option | Type | Default | Description |
|---|---|---|---|
| `timecode_trigger` | string | `manual` | `manual` (tap the digits to start/stop, a Reset button clears to zero) or `entity` (runs automatically while `timecode_source_entity` is in `timecode_active_state`) |
| `timecode_source_entity` | string | *(none)* | `timecode_trigger: entity` only. Entity to watch — a `binary_sensor`, `input_boolean`, or anything with a state you can match |
| `timecode_active_state` | string | `on` | `timecode_trigger: entity` only. The state value that means "counting" — elapsed time is computed from that state's `last_changed` timestamp |
| `timecode_idle_behavior` | string | `reset` | `timecode_trigger: entity` only. What happens when the entity leaves its active state: `reset` (back to `00:00:00:00`) or `freeze` (hold the last value) |
| `timecode_frame_rate` | number | `25` | `24`, `25`, or `30` fps. **Non-drop-frame only** — see note below |

Manual mode owns its running/elapsed state in the card itself, so it doesn't survive a full page reload mid-count (a fresh load starts back at zero). Entity mode has no such limitation, since elapsed time is always recomputed from the entity's own `last_changed`.

**Drop-frame timecode is not implemented.** Real broadcast drop-frame timecode (skipping frame numbers at the top of most minutes to keep 29.97fps in sync with wall-clock time) is its own per-frame-rate arithmetic — this card does plain non-drop-frame counting, which is the right fit for a production/session timer and doesn't need genlock-grade accuracy.

### Status bars

Each entry in `bars` is one status bar:

| Field | Type | Description |
|---|---|---|
| `label` | string | Bar text |
| `type` | string | `single` (default) or `multi` |
| `entity` | string | Entity to read (optional — omit for a bar with no live data) |
| `attribute` | string | Read this attribute instead of the entity's own state (optional) |

**`type: single`** (default) — the bar is on/off:

| Field | Type | Description |
|---|---|---|
| `color` | string | On-state colour |
| `on_values` | string | Comma-separated values that count as "on" (optional — defaults to `on`/`true`/`home`/`open`) |

**`type: multi`** — the bar always shows a colour matching the entity's current value, never an on/off state:

| Field | Type | Description |
|---|---|---|
| `value_colors` | list | `{value, color}` pairs — value match is case-insensitive |
| `default_color` | string | Fallback colour for any value not in `value_colors` |

```yaml
bars:
  - label: ON AIR
    color: "#ff3b3b"
    entity: binary_sensor.on_air
  - label: PRESENCE
    type: multi
    entity: sensor.presence
    default_color: "#888888"
    value_colors:
      - value: home
        color: "#3bff6a"
      - value: away
        color: "#ff3b3b"
```

## Notes

- `time_sync_entity`, the smooth second hand, and the visibility/periodic resync (re-anchors the clock immediately when a hidden view/tab becomes visible again, plus a 60s backstop) all derive from the same corrected time source, so the whole card stays in sync with real time regardless of which display options are active. `clock_type: timecode` is independent of this — it's elapsed time, not wall-clock time, so it isn't affected by `time_sync_entity`.

## Localization

The visual editor follows your Home Assistant profile's language (`hass.language`), falling back to the base language (e.g. `fr` for `fr-CA`) and then English if a locale isn't translated yet. English is the only translation shipped so far — contributions adding another language to the `CARD_TRANSLATIONS` object in `broadcast-clock-card.js` are welcome.

The date line follows `hass.language` automatically (via `Intl`/`toLocaleDateString`), no translation needed there. The spoken-time line ("Quarter past six") is built per-language via `SPOKEN_TIME_LOCALES`, since telling-time idiom is real sentence grammar, not a dictionary swap (English "half past six" vs German "halb sieben" — literally "half toward seven"). English is the only language implemented so far; a language with no entry falls back to English automatically. Adding a language means implementing its own `numberWord`/`spokenTime` pair, not translating strings — contributions from fluent speakers are especially welcome here, since getting the idiom right isn't something a dictionary lookup can verify.

Use `language` (see [Top level](#top-level) options) to pin the card's own displayed language independently of the editor/your own HA profile — useful for a shared or wall-mounted display.

## Author's note

This, like most custom cards I guess, was written for a need I have, but so might you. (I couldn't find anything similar so here we are.)

I feel it's only right to disclose that this card wouldn't exist without the help of AI, Claude in particular. I know that for many this will immediately turn people away and that's fine. No one is forcing you to use this and to be honest I'll be genuinely happy if even one other person does use this card. 

I know that I could have created this card by hand (I have the skills I use every day); in a different time of my life I would have had the time.
But for me this is a hobby. One for which I don't have any spare time at the moment.
I welcome feedback and improvements (via issues/PRs). 


