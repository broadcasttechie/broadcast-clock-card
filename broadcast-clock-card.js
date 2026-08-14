const DEFAULT_BARS = [
  { label: 'STATUS 1', color: '#ff3b3b', entity: '' },
  { label: 'STATUS 2', color: '#3bd6ff', entity: '' },
  { label: 'STATUS 3', color: '#3bff6a', entity: '' },
  { label: 'STATUS 4', color: '#ffcf3b', entity: '' }
];

const RING_PALETTES = {
  rainbow: ['#ff3b3b', '#ffcf3b', '#3bff6a', '#3bd6ff', '#8a3bff', '#ff3b3b'],
  sunset: ['#ff3ba1', '#ff3b3b', '#ff8a3b', '#ffd93b'],
  ocean: ['#3b3bff', '#3b8aff', '#3bd6ff', '#3bffcc'],
  neon: ['#ff3bd6', '#3bfff2', '#faff3b', '#ff3bd6']
};

const LAYOUTS = ['clock_bars', 'bars_clock', 'clock_only', 'bars_only', 'stacked'];

// Top-level clock hierarchy: 3 clock types, each with their own sub-options
// (see BroadcastClockCard.setConfig for the full field list and defaults).
const CLOCK_TYPES = ['master_clock', 'led_ring', 'text'];
const LED_STYLES = ['glowing', 'flat'];
const LED_OFF_STYLES = ['dull', 'blank'];
const TEXT_FONTS = ['segment', 'normal'];
const SECONDS_PLACEMENTS = ['inline', 'newline', 'newline_large'];
const TIME_FORMATS = ['24h', '12h'];
const DATE_FORMATS = ['long', 'long_year', 'short', 'numeric'];
const DATE_FONTS = ['default', 'mono'];

// Legacy configs (saved before this settings hierarchy existed) used a flat
// `clock_style` with 6 values instead of today's `clock_type` + sub-options.
// Used only as a fallback in setConfig when the new `clock_type` key is
// absent, so old saved cards keep rendering identically with zero manual
// changes -- their config isn't rewritten, just interpreted.
// show_case: false on every non-master_clock entry -- none of those old
// styles ever had a case/housing box, so migrating them must not suddenly
// grow one just because a stray `master_clock_case: true` (the old default,
// irrelevant to non-master styles, but often present anyway) happens to be
// sitting in the saved config.
const LEGACY_CLOCK_STYLE_MAP = {
  ring: { clock_type: 'led_ring', led_style: 'flat', text_font: 'normal', show_seconds: true, seconds_placement: 'newline', show_case: false },
  led_ring: { clock_type: 'led_ring', led_style: 'glowing', text_font: 'normal', show_seconds: true, seconds_placement: 'newline', show_case: false },
  led_clock: { clock_type: 'led_ring', led_style: 'glowing', text_font: 'segment', show_seconds: true, seconds_placement: 'inline', show_case: false },
  digital_led: { clock_type: 'text', text_font: 'segment', show_seconds: true, seconds_placement: 'inline', show_case: false },
  text: { clock_type: 'text', text_font: 'normal', show_seconds: true, seconds_placement: 'inline', show_case: false },
  master_clock: { clock_type: 'master_clock' }
};

function hexToRgb(hex) {
  const h = (hex || '#ff3b3b').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16) || 0;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

// Scales a colour's own RGB toward black -- used for the "tinted" status-bar
// off state, so an unlit bar reads as a dark version of its own on-colour
// (like a real tally light's unlit plastic) rather than a fixed neutral grey.
function darkenHex(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const f = Math.min(1, Math.max(0, percent / 100));
  return rgbToHex(r * f, g * f, b * f);
}

function paletteColor(stops, t) {
  const clamped = Math.min(0.999999, Math.max(0, t));
  const segments = stops.length - 1;
  const scaled = clamped * segments;
  const idx = Math.floor(scaled);
  return lerpColor(stops[idx], stops[idx + 1], scaled - idx);
}

// ---- Seven-segment digit geometry (used by the 'segment' text_font) ----

function hSeg(x1, x2, yc, th) {
  const h = th / 2;
  return [[x1 + h, yc], [x1 + th, yc - h], [x2 - th, yc - h], [x2 - h, yc], [x2 - th, yc + h], [x1 + th, yc + h]]
    .map((p) => p.join(',')).join(' ');
}

function vSeg(xc, y1, y2, th) {
  const h = th / 2;
  return [[xc, y1 + h], [xc + h, y1 + th], [xc + h, y2 - th], [xc, y2 - h], [xc - h, y2 - th], [xc - h, y1 + th]]
    .map((p) => p.join(',')).join(' ');
}

const SEG_W = 56, SEG_H = 100, SEG_TH = 12, SEG_PAD = 6;
const SEG_X1 = SEG_PAD, SEG_X2 = SEG_W - SEG_PAD;
const SEG_YTOP = SEG_PAD, SEG_YMID = SEG_H / 2, SEG_YBOT = SEG_H - SEG_PAD;
const SEG_POINTS = {
  a: hSeg(SEG_X1, SEG_X2, SEG_YTOP, SEG_TH),
  g: hSeg(SEG_X1, SEG_X2, SEG_YMID, SEG_TH),
  d: hSeg(SEG_X1, SEG_X2, SEG_YBOT, SEG_TH),
  f: vSeg(SEG_X1, SEG_YTOP, SEG_YMID, SEG_TH),
  b: vSeg(SEG_X2, SEG_YTOP, SEG_YMID, SEG_TH),
  e: vSeg(SEG_X1, SEG_YMID, SEG_YBOT, SEG_TH),
  c: vSeg(SEG_X2, SEG_YMID, SEG_YBOT, SEG_TH)
};
const SEVEN_SEG_DIGITS = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc',
  '5': 'afgcd', '6': 'afgecd', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg'
};

// Minimum gap between time_sync_entity offset corrections -- see
// _updateTimeSync for why this needs to be much longer than 1 second even
// when the sync entity itself updates every second.
const TIME_SYNC_MIN_INTERVAL_MS = 60000;

// ---- Analog clock-face geometry (used by the "master_clock" clock type) ----
// Clock angles: 0deg = 12 o'clock (top), increasing clockwise.
const CLOCK_CX = 100, CLOCK_CY = 100;
function clockPoint(angleDeg, r) {
  const rad = (angleDeg * Math.PI) / 180;
  return [CLOCK_CX + r * Math.sin(rad), CLOCK_CY - r * Math.cos(rad)];
}

// Second-hand step is a fixed 6deg (one tick of 360/60). cubic-bezier's
// overshoot isn't a direct "degrees past target" knob -- it's the peak of
// y(t) = 3(1-t)^2*t*y1 + 3(1-t)t^2*y2 + t^3 for the (0,0)/(x1,y1)/(x2,y2)/(1,1)
// curve, which only maps to visual degrees once multiplied by the 6deg step.
// This inverts that (binary search -- no closed form) so the config option
// can be a plain "degrees of overshoot" number instead of an opaque y1.
const SECOND_HAND_STEP_DEG = 6;
const SECOND_HAND_BEZIER_X1 = 0.34;
const SECOND_HAND_BEZIER_X2 = 0.64;
const SECOND_HAND_BEZIER_Y2 = 1;

function bezierPeakY(y1, y2) {
  let peak = 0;
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    const y = 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3;
    if (y > peak) peak = y;
  }
  return peak;
}

function bezierY1ForOvershootDeg(overshootDeg) {
  if (!(overshootDeg > 0)) return SECOND_HAND_BEZIER_Y2; // no bounce -> no overshoot
  const targetPeak = 1 + overshootDeg / SECOND_HAND_STEP_DEG;
  let lo = 1;
  let hi = 40;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (bezierPeakY(mid, SECOND_HAND_BEZIER_Y2) < targetPeak) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

class BroadcastClockCard extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    this._bars = (this._config.bars && this._config.bars.length ? this._config.bars : DEFAULT_BARS);
    this._sizePercent = this._clampSize(this._config.size_percent);
    this._textScalePercent = this._clampTextScale(this._config.text_scale_percent);
    this._textGlowPercent = this._clampGlow(this._config.text_glow_percent);
    this._layout = this._normalizeLayout(this._config.layout, this._config.show_status_bars);
    this._showSpoken = this._config.show_spoken_time !== false;
    this._showDate = this._config.show_date !== false;
    this._dateFormat = this._normalizeEnum(this._config.date_format, DATE_FORMATS, 'long');
    this._dateFont = this._normalizeEnum(this._config.date_font, DATE_FONTS, 'default');
    this._timeSyncEntity = this._config.time_sync_entity || '';
    this._ringColorMode = this._normalizeRingColorMode(this._config.ring_color_mode);
    this._ringColor = this._config.ring_color || '#ff3b3b';
    this._textColor = this._config.text_color || '#ff3b3b';
    this._secondHandBounceDeg = this._clampBounce(this._config.second_hand_bounce_deg);
    this._barOffStyle = this._config.bar_off_style === 'tinted' ? 'tinted' : 'neutral';
    this._barOffBrightness = this._clampBarOffBrightness(this._config.bar_off_brightness);

    const legacy = LEGACY_CLOCK_STYLE_MAP[this._config.clock_style] || {};
    this._clockType = this._normalizeEnum(this._config.clock_type ?? legacy.clock_type, CLOCK_TYPES, 'led_ring');
    this._ledStyle = this._normalizeEnum(this._config.led_style ?? legacy.led_style, LED_STYLES, 'glowing');
    this._ledOffStyle = this._normalizeEnum(this._config.led_off_style, LED_OFF_STYLES, 'dull');
    this._emphasizeCurrentSecond = this._config.emphasize_current_second !== false;
    this._textFont = this._normalizeEnum(this._config.text_font ?? legacy.text_font, TEXT_FONTS, 'normal');
    this._showSeconds = (this._config.show_seconds ?? legacy.show_seconds) !== false;
    this._secondsPlacement = this._normalizeEnum(this._config.seconds_placement ?? legacy.seconds_placement, SECONDS_PLACEMENTS, 'newline');
    this._timeFormat = this._normalizeEnum(this._config.time_format, TIME_FORMATS, '24h');
    // Generic across all 3 clock types (was 'master_clock_case', master-clock
    // only). Priority: new key -> legacy per-style default (false for
    // everything except master_clock) -> old master_clock_case key -> true.
    this._showCase = (this._config.show_case ?? legacy.show_case ?? this._config.master_clock_case) !== false;

    const styleKey = this._clockStyleKey();
    if (!this._built) this._build();
    if (this._builtStyleKey !== styleKey) this._buildClockPanel();
    this._applySecondHandBounce();

    this._applyColors();
    this._applyLayout();
    this._renderBars();
    if (this._built) this._tick();
  }

  set hass(hass) {
    this._hass = hass;
    this._renderBars();
    this._updateTimeSync();
  }

  _updateTimeSync() {
    if (!this._timeSyncEntity || !this._hass) {
      this._timeOffsetMs = 0;
      this._timeSyncLastUpdated = null;
      this._timeSyncLastAppliedAt = null;
      return;
    }
    const st = this._hass.states[this._timeSyncEntity];
    if (!st || !st.last_updated) return;
    // set hass() fires on every state change anywhere in HA, not just when
    // this entity updates -- so most calls here see the SAME last_updated as
    // last time. Recomputing the offset against those stale reads anyway
    // (using a fresh, later Date.now()) makes the offset drift smaller/more
    // negative between the entity's real ~1/sec updates, then snap back when
    // a genuine update arrives -- which is exactly what caused the "skips
    // seconds" stutter. Only re-derive the offset when last_updated has
    // actually moved.
    if (st.last_updated === this._timeSyncLastUpdated) return;
    this._timeSyncLastUpdated = st.last_updated;

    // Even fixing the above, a sync entity that itself updates every second
    // (e.g. a live "seconds" sensor) means this still runs roughly once a
    // second -- and any few-ms jitter in exactly when that update reaches
    // the browser (network, HA's own scheduler) races this card's own
    // independent 1-second tick timer (_scheduleNextTick), which is enough
    // to visibly skip or repeat a second. A local clock doesn't drift enough
    // in under a minute for that to matter, so only actually apply a fresh
    // offset this infrequently -- correction stays accurate, but stops
    // fighting the tick scheduler.
    const now = Date.now();
    if (this._timeSyncLastAppliedAt && (now - this._timeSyncLastAppliedAt) < TIME_SYNC_MIN_INTERVAL_MS) return;

    const serverTime = new Date(st.last_updated).getTime();
    if (Number.isNaN(serverTime)) return;
    // Offset between this entity's last-known-good server timestamp and the
    // browser's own clock at the moment we received it — applied to every
    // subsequent tick so the displayed time tracks the HA host's clock even
    // if the browser/tablet's own clock is wrong or drifting.
    this._timeOffsetMs = serverTime - now;
    this._timeSyncLastAppliedAt = now;
  }

  connectedCallback() {
    if (!this._built) this._build();
    this._startClock();
    this._startResizeObserver();
  }

  disconnectedCallback() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (this._smoothSecondHandRaf) {
      cancelAnimationFrame(this._smoothSecondHandRaf);
      this._smoothSecondHandRaf = null;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  getCardSize() {
    return 6;
  }

  static getStubConfig() {
    return {
      layout: 'clock_bars',
      clock_type: 'led_ring',
      size_percent: 70,
      text_scale_percent: 16,
      text_glow_percent: 100,
      show_spoken_time: true,
      show_date: true,
      date_format: 'long',
      date_font: 'default',
      time_sync_entity: '',
      show_case: true,
      ring_color_mode: 'rainbow',
      ring_color: '#ff3b3b',
      led_style: 'glowing',
      led_off_style: 'dull',
      emphasize_current_second: true,
      text_color: '#ff3b3b',
      text_font: 'normal',
      show_seconds: true,
      seconds_placement: 'newline',
      time_format: '24h',
      second_hand_bounce_deg: 2,
      bar_off_style: 'neutral',
      bar_off_brightness: 15,
      bars: DEFAULT_BARS
    };
  }

  static getConfigElement() {
    return document.createElement('broadcast-clock-card-editor');
  }

  _clampSize(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 70;
    return Math.min(100, Math.max(10, n));
  }

  _clampTextScale(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 16;
    return Math.min(40, Math.max(5, n));
  }

  _clampGlow(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 100;
    return Math.min(200, Math.max(0, n));
  }

  _clampBounce(v) {
    const n = Number(v);
    // Default of 2deg is a modest, clearly-visible kick without being
    // cartoonish; 5deg (an earlier iteration) read as "too much" in practice.
    if (!Number.isFinite(n)) return 2;
    return Math.min(8, Math.max(0, n));
  }

  _clampBarOffBrightness(v) {
    const n = Number(v);
    // % of the on-colour's RGB kept for the off state. Floor of 5 keeps the
    // hue identifiable even at low settings; ceiling of 40 keeps it reading
    // as clearly "off" next to the full-brightness lit state.
    if (!Number.isFinite(n)) return 15;
    return Math.min(40, Math.max(5, n));
  }

  _normalizeEnum(v, allowed, fallback) {
    return allowed.includes(v) ? v : fallback;
  }

  _applySecondHandBounce() {
    const hand = this._analogHands && this._analogHands.secondHand;
    if (!hand) return; // clock type without an analog second hand
    const deg = this._secondHandBounceDeg;
    hand.style.transition = deg > 0
      ? `transform 0.4s cubic-bezier(${SECOND_HAND_BEZIER_X1}, ${bezierY1ForOvershootDeg(deg).toFixed(3)}, ${SECOND_HAND_BEZIER_X2}, ${SECOND_HAND_BEZIER_Y2})`
      : 'transform 0.15s ease-out';
  }

  _normalizeLayout(layout, legacyShowStatusBars) {
    if (LAYOUTS.includes(layout)) return layout;
    // Back-compat for cards saved before the layout option existed.
    return legacyShowStatusBars === false ? 'clock_only' : 'clock_bars';
  }

  _normalizeRingColorMode(v) {
    return (v === 'solid' || v === 'match_text' || RING_PALETTES[v]) ? v : 'rainbow';
  }

  // Any config field that changes what DOM _buildClockPanel produces needs
  // to trigger a rebuild -- this composite key covers all of them so
  // setConfig can cheaply detect "did the shape change" without a bespoke
  // comparison per field. Rebuilds only happen when the user edits the card
  // config (not per-tick), so this being coarse (rebuilding on e.g. a
  // led_style change that's actually CSS-only) costs nothing in practice.
  _clockStyleKey() {
    return [
      this._clockType, this._textFont, this._showSeconds, this._secondsPlacement,
      this._timeFormat, this._showCase, this._ledStyle
    ].join('|');
  }

  _applyColors() {
    if (!this._root) return;
    this._root.style.setProperty('--bc-text-color', this._textColor);
    this._root.style.setProperty('--bc-text-glow-scale', this._textGlowPercent / 100);
  }

  _build() {
    this._built = true;

    this.style.display = 'block';
    this.style.width = '100%';
    this.style.height = '100%';
    this.style.overflow = 'hidden';

    const root = document.createElement('div');
    root.className = 'bc-root';

    const style = document.createElement('style');
    style.textContent = `
      .bc-root {
        display: flex;
        width: 100%;
        height: 100%;
        background: #000;
        color: #fff;
        box-sizing: border-box;
        overflow: hidden;
        font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      }
      .bc-panel {
        box-sizing: border-box;
        min-width: 0;
        min-height: 0;
      }
      .bc-panel-clock {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .bc-panel-bars {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 3vh;
        padding: 3vh 3vw;
      }

      .bc-root[data-layout="clock_bars"] { flex-direction: row; }
      .bc-root[data-layout="clock_bars"] .bc-panel-clock { flex: 1.6; order: 1; }
      .bc-root[data-layout="clock_bars"] .bc-panel-bars { flex: 1; order: 2; }

      .bc-root[data-layout="bars_clock"] { flex-direction: row; }
      .bc-root[data-layout="bars_clock"] .bc-panel-clock { flex: 1.6; order: 2; }
      .bc-root[data-layout="bars_clock"] .bc-panel-bars { flex: 1; order: 1; }

      .bc-root[data-layout="clock_only"] { flex-direction: row; justify-content: center; }
      .bc-root[data-layout="clock_only"] .bc-panel-clock { flex: 1; }

      .bc-root[data-layout="bars_only"] { flex-direction: row; }
      .bc-root[data-layout="bars_only"] .bc-panel-bars { flex: 1; }

      .bc-root[data-layout="stacked"] { flex-direction: column; }
      .bc-root[data-layout="stacked"] .bc-panel-clock { flex: 1.5; order: 1; }
      .bc-root[data-layout="stacked"] .bc-panel-bars { flex: 1; order: 2; }

      /* Shared dark bezel "case box" -- used by led_ring (wraps ring+digits)
         and text (wraps the digits/text) when show_case is on. */
      .bc-case-box {
        background: #050505;
        border-radius: 6px;
        padding: 2vh 2vw;
        border: 3px solid #2a2a2a;
        box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.85), 0 0 0 1px #444, 0 4px 14px rgba(0, 0, 0, 0.6);
        box-sizing: border-box;
        max-width: 100%;
        max-height: 100%;
        overflow: hidden;
      }

      /* LED Ring clock type */
      .bc-ring-wrap {
        position: relative;
        flex-shrink: 0;
      }
      .bc-ring-wrap svg {
        width: 100%;
        height: 100%;
        overflow: visible;
        display: block;
      }
      .bc-digital {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;
      }
      .bc-hhmm {
        font-weight: 700;
        letter-spacing: 0.03em;
        color: var(--bc-text-color, #ff3b3b);
        text-shadow: 0 0 calc(18px * var(--bc-text-glow-scale, 1)) var(--bc-text-color, #ff3b3b);
        line-height: 1;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .bc-ss {
        font-weight: 700;
        color: var(--bc-text-color, #ff3b3b);
        text-shadow: 0 0 calc(14px * var(--bc-text-glow-scale, 1)) var(--bc-text-color, #ff3b3b);
        line-height: 1.3;
        font-variant-numeric: tabular-nums;
      }
      .bc-date {
        color: var(--bc-text-color, #ff3b3b);
        opacity: 0.55;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .bc-date-font-mono {
        font-family: ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace;
        letter-spacing: 0.02em;
      }
      /* Bulb-styled ring dots -- opt-in per instance via the panel's
         data-led-style attribute, set from the led_style config option. */
      .bc-ring-dot-highlight {
        fill: #fff;
        opacity: 0;
        pointer-events: none;
      }
      .bc-panel-clock[data-led-style="glowing"] .bc-ring-dot-core {
        filter: drop-shadow(0 0 3px currentColor) drop-shadow(0 0 7px currentColor);
      }
      .bc-panel-clock[data-led-style="glowing"] .bc-ring-dot-highlight {
        opacity: 0.5;
      }
      .bc-spoken {
        font-weight: 700;
        color: var(--bc-text-color, #ff3b3b);
        text-align: center;
        padding: 0 2vw;
        box-sizing: border-box;
      }

      /* Text clock type: normal (plain) font */
      .bc-text-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .bc-text-time {
        font-weight: 800;
        letter-spacing: 0.02em;
        color: var(--bc-text-color, #ff3b3b);
        text-shadow: 0 0 calc(18px * var(--bc-text-glow-scale, 1)) var(--bc-text-color, #ff3b3b);
        line-height: 1;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      /* Text clock type / LED Ring's embedded readout: segment font */
      .bc-textstyle-housing {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .bc-textstyle-screen {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .bc-digitalled-digits {
        display: flex;
        align-items: center;
      }
      .bc-digitalled-digit, .bc-digitalled-colon {
        flex-shrink: 0;
        display: block;
      }
      .bc-digitalled-digit .seg, .bc-digitalled-colon .seg {
        fill: rgba(255, 255, 255, 0.05);
        transition: fill 0.1s ease;
      }
      .bc-digitalled-digit .seg.on, .bc-digitalled-colon .seg.on {
        fill: var(--bc-text-color, #ff3b3b);
        filter: drop-shadow(0 0 calc(6px * var(--bc-text-glow-scale, 1)) var(--bc-text-color, #ff3b3b));
      }

      /* Studio master-clock analog style */
      .bc-analog-housing {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .bc-analog-face-wrap {
        background: #111;
        border-radius: 8px;
        padding: 4%;
        box-sizing: border-box;
        box-shadow: 0 0 0 1px #333, 0 6px 18px rgba(0, 0, 0, 0.6);
        flex-shrink: 0;
      }
      .bc-analog-face-wrap.bc-analog-no-case {
        background: none;
        padding: 0;
        box-shadow: none;
        border-radius: 0;
      }
      .bc-analog-face-wrap svg {
        width: 100%;
        height: 100%;
        display: block;
        overflow: visible;
      }
      .bc-analog-facebg {
        fill: url(#bc-analog-facegrad);
      }
      .bc-analog-innerglow {
        fill: none;
        stroke: #fff;
        stroke-width: 30;
        opacity: calc(0.85 * var(--bc-text-glow-scale, 1));
        filter: blur(calc(9px * var(--bc-text-glow-scale, 1)));
      }
      .bc-analog-tick {
        stroke: #111;
        stroke-width: 2;
      }
      .bc-analog-num12 {
        fill: #111;
        font-weight: 700;
        text-anchor: middle;
        dominant-baseline: central;
        font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      }
      .bc-analog-num24 {
        fill: var(--bc-text-color, #ff3b3b);
        font-weight: 600;
        text-anchor: middle;
        dominant-baseline: central;
        font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      }
      .bc-analog-hand {
        stroke-linecap: round;
      }
      .bc-analog-hand-hour, .bc-analog-hand-minute {
        stroke: #161616;
      }
      .bc-analog-hand-second {
        stroke: var(--bc-text-color, #ff3b3b);
        transform-origin: 100px 100px;
        /* transition is set inline per-instance by _applySecondHandBounce(),
           driven by the second_hand_bounce_deg config option -- see
           bezierY1ForOvershootDeg() for why this can't be a plain CSS number. */
      }
      .bc-analog-hub {
        fill: var(--bc-text-color, #ff3b3b);
      }
      .bc-analog-label {
        margin-top: 1.5vh;
      }

      /* Status bars */
      .bc-bar {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 13vh;
        border-radius: 6px;
        font-size: min(4vh, 3vw);
        font-weight: 800;
        letter-spacing: 0.04em;
        color: #000;
        background: #1c1c1c;
        transition: background 0.3s ease, color 0.3s ease, box-shadow 0.3s ease;
        text-align: center;
        padding: 0 1vw;
        box-sizing: border-box;
      }
      .bc-bar.bc-inactive {
        color: #4a4a4a;
        background: #161616;
      }
    `;

    root.innerHTML = `
      <div class="bc-panel bc-panel-clock" id="bc-panel-clock"></div>
      <div class="bc-panel bc-panel-bars" id="bc-bars"></div>
    `;

    root.prepend(style);
    this.innerHTML = '';
    this.appendChild(root);

    this._root = root;
    this._clockPanel = root.querySelector('#bc-panel-clock');
    this._barsEl = root.querySelector('#bc-bars');

    this._buildClockPanel();
  }

  _buildClockPanel() {
    this._builtStyleKey = this._clockStyleKey();
    const panel = this._clockPanel;
    panel.className = 'bc-panel bc-panel-clock bc-clock-type-' + this._clockType;
    panel.dataset.ledStyle = this._ledStyle;
    this._dots = null;
    this._digitalLedDigits = null;
    this._ampmDots = null;
    this._analogHands = null;
    this._ringWrap = null;
    this._analogWrap = null;
    this._textStyleScreen = null;
    this._textTimeEl = null;
    this._hhmmEl = null;
    this._ssEl = null;

    const caseOpen = this._showCase ? '<div class="bc-case-box">' : '';
    const caseClose = this._showCase ? '</div>' : '';

    if (this._clockType === 'master_clock') {
      panel.innerHTML = `
        <div class="bc-analog-housing">
          <div class="bc-analog-face-wrap" id="bc-analog-wrap"></div>
          <div class="bc-date bc-analog-label" id="bc-date">-</div>
        </div>
        <div class="bc-spoken" id="bc-spoken">&nbsp;</div>
      `;
      this._dateEl = panel.querySelector('#bc-date');
      this._spokenEl = panel.querySelector('#bc-spoken');
      this._analogWrap = panel.querySelector('#bc-analog-wrap');
      this._buildAnalogClock();
    } else if (this._clockType === 'led_ring') {
      // Case wraps the whole ring (dots + readout together), not just the
      // inner readout -- matches a real studio clock's single boxed screen.
      panel.innerHTML = `
        ${caseOpen}<div class="bc-ring-wrap" id="bc-ring-wrap">
          <svg viewBox="0 0 300 300"></svg>
          <div class="bc-digital">
            <div class="bc-textstyle-screen" id="bc-textstyle-screen"></div>
          </div>
        </div>${caseClose}
        <div class="bc-date" id="bc-date">-</div>
        <div class="bc-spoken" id="bc-spoken">&nbsp;</div>
      `;
      this._ringWrap = panel.querySelector('#bc-ring-wrap');
      this._svg = panel.querySelector('svg');
      this._dateEl = panel.querySelector('#bc-date');
      this._spokenEl = panel.querySelector('#bc-spoken');
      this._textStyleScreen = panel.querySelector('#bc-textstyle-screen');
      this._buildDots();
      this._buildTextStyle();
    } else {
      // 'text'
      panel.innerHTML = `
        <div class="bc-textstyle-housing">
          ${caseOpen}<div class="bc-textstyle-screen" id="bc-textstyle-screen"></div>${caseClose}
          <div class="bc-date" id="bc-date">-</div>
        </div>
        <div class="bc-spoken" id="bc-spoken">&nbsp;</div>
      `;
      this._dateEl = panel.querySelector('#bc-date');
      this._spokenEl = panel.querySelector('#bc-spoken');
      this._textStyleScreen = panel.querySelector('#bc-textstyle-screen');
      this._buildTextStyle();
    }
  }

  // Builds the shared "text style" sub-block (segment digits or plain text)
  // used by both the 'led_ring' clock type's embedded readout and the
  // standalone 'text' clock type -- driven by text_font/show_seconds/
  // seconds_placement/time_format, identically in both contexts.
  _buildTextStyle() {
    this._textStyleScreen.innerHTML = '';
    this._digitalLedDigits = null;
    this._ampmDots = null;
    this._textTimeEl = null;
    this._hhmmEl = null;
    this._ssEl = null;

    const newlineSeconds = this._showSeconds && this._secondsPlacement !== 'inline';

    if (this._textFont === 'segment') {
      this._buildSegmentTextStyle(newlineSeconds);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'bc-text-wrap';
      if (newlineSeconds) {
        wrap.innerHTML = `
          <div class="bc-hhmm" id="bc-hhmm">--:--</div>
          <div class="bc-ss" id="bc-ss">--</div>
        `;
      } else {
        wrap.innerHTML = `<div class="bc-text-time" id="bc-text-time">--:--:--</div>`;
      }
      this._textStyleScreen.appendChild(wrap);
      this._hhmmEl = wrap.querySelector('#bc-hhmm');
      this._ssEl = wrap.querySelector('#bc-ss');
      this._textTimeEl = wrap.querySelector('#bc-text-time');
    }
  }

  _buildSegmentTextStyle(newlineSeconds) {
    const NS = 'http://www.w3.org/2000/svg';
    const makeDigit = (row) => {
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${SEG_W} ${SEG_H}`);
      svg.setAttribute('class', 'bc-digitalled-digit');
      const segs = {};
      for (const key of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
        const poly = document.createElementNS(NS, 'polygon');
        poly.setAttribute('points', SEG_POINTS[key]);
        poly.setAttribute('class', 'seg');
        svg.appendChild(poly);
        segs[key] = poly;
      }
      row.appendChild(svg);
      return { svg, segs };
    };
    const makeDotPair = (row, extraClass, cyTop, cyBot) => {
      // Shape shared by the HH:MM colon, the (optional) MM:SS colon, and the
      // AM/PM indicator -- all just "two stacked circles", differing only in
      // vertical spacing (colons stay close together like a colon; AM/PM
      // spreads to near the top/bottom of the element so it doesn't read as
      // a second colon), which dot(s) light up, and whether they blink.
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 20 100');
      svg.setAttribute('class', 'bc-digitalled-colon' + (extraClass ? ' ' + extraClass : ''));
      const top = document.createElementNS(NS, 'circle');
      top.setAttribute('cx', '10'); top.setAttribute('cy', String(cyTop ?? 34)); top.setAttribute('r', '7');
      top.setAttribute('class', 'seg');
      const bot = document.createElementNS(NS, 'circle');
      bot.setAttribute('cx', '10'); bot.setAttribute('cy', String(cyBot ?? 66)); bot.setAttribute('r', '7');
      bot.setAttribute('class', 'seg');
      svg.appendChild(top); svg.appendChild(bot);
      row.appendChild(svg);
      return { svg, dots: [top, bot], top, bot };
    };

    const row1 = document.createElement('div');
    row1.className = 'bc-digitalled-digits bc-digitalled-row-primary';
    this._textStyleScreen.appendChild(row1);

    const h1 = makeDigit(row1), h2 = makeDigit(row1), colon1 = makeDotPair(row1),
      m1 = makeDigit(row1), m2 = makeDigit(row1);

    let colon2 = null, s1 = null, s2 = null, row2 = row1;
    if (this._showSeconds) {
      if (newlineSeconds) {
        row2 = document.createElement('div');
        row2.className = 'bc-digitalled-digits bc-digitalled-row-seconds';
        this._textStyleScreen.appendChild(row2);
      } else {
        colon2 = makeDotPair(row1);
      }
      s1 = makeDigit(row2);
      s2 = makeDigit(row2);
    }

    // Always appended last to row1 -- "LED dot on the right hand side".
    // Spread near the top/bottom (r=7 stays fully inside the 0-100 viewBox
    // from cy=7 to cy=93) rather than the colon's close-together spacing, so
    // it reads as a top/bottom AM/PM pair and not a second colon.
    const ampm = this._timeFormat === '12h' ? makeDotPair(row1, 'bc-digitalled-ampm', 10, 90) : null;

    this._digitalLedDigits = { h1, h2, colon1, m1, m2, colon2, s1, s2 };
    this._ampmDots = ampm;
  }

  _setDigitalLedDigit(digitRef, ch) {
    const lit = SEVEN_SEG_DIGITS[ch] || '';
    for (const key of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
      digitRef.segs[key].classList.toggle('on', lit.includes(key));
    }
  }

  _setLedDigits(hh, mm, ss) {
    const d = this._digitalLedDigits;
    if (!d) return;
    this._setDigitalLedDigit(d.h1, hh[0]);
    this._setDigitalLedDigit(d.h2, hh[1]);
    this._setDigitalLedDigit(d.m1, mm[0]);
    this._setDigitalLedDigit(d.m2, mm[1]);
    if (d.s1 && d.s2) {
      this._setDigitalLedDigit(d.s1, ss[0]);
      this._setDigitalLedDigit(d.s2, ss[1]);
    }
  }

  _buildAnalogClock() {
    const NS = 'http://www.w3.org/2000/svg';
    this._analogWrap.innerHTML = '';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');

    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `
      <radialGradient id="bc-analog-facegrad" cx="50%" cy="50%" r="65%">
        <stop offset="0%" stop-color="#e9e9e7"/>
        <stop offset="100%" stop-color="#b6b6b4"/>
      </radialGradient>
      <clipPath id="bc-analog-faceclip">
        <circle cx="${CLOCK_CX}" cy="${CLOCK_CY}" r="94"/>
      </clipPath>
    `;
    svg.appendChild(defs);

    const face = document.createElementNS(NS, 'circle');
    face.setAttribute('cx', String(CLOCK_CX));
    face.setAttribute('cy', String(CLOCK_CY));
    face.setAttribute('r', '94');
    face.setAttribute('class', 'bc-analog-facebg');
    svg.appendChild(face);

    // Edge-lit glow: a blurred ring straddling the face boundary, clipped to
    // the face circle so it only ever brightens inward from the rim and never
    // bleeds onto the black housing outside.
    const glowGroup = document.createElementNS(NS, 'g');
    glowGroup.setAttribute('clip-path', 'url(#bc-analog-faceclip)');
    const glow = document.createElementNS(NS, 'circle');
    glow.setAttribute('cx', String(CLOCK_CX));
    glow.setAttribute('cy', String(CLOCK_CY));
    glow.setAttribute('r', '94');
    glow.setAttribute('class', 'bc-analog-innerglow');
    glowGroup.appendChild(glow);
    svg.appendChild(glowGroup);

    for (let i = 0; i < 60; i++) {
      const angle = i * 6;
      const [x1, y1] = clockPoint(angle, 88);
      const [x2, y2] = clockPoint(angle, i % 5 === 0 ? 78 : 83);
      const tick = document.createElementNS(NS, 'line');
      tick.setAttribute('x1', x1.toFixed(2)); tick.setAttribute('y1', y1.toFixed(2));
      tick.setAttribute('x2', x2.toFixed(2)); tick.setAttribute('y2', y2.toFixed(2));
      tick.setAttribute('class', 'bc-analog-tick');
      tick.setAttribute('stroke-width', i % 5 === 0 ? '2.5' : '1.5');
      svg.appendChild(tick);
    }

    for (let h = 1; h <= 12; h++) {
      const angle = h * 30;
      const [bx, by] = clockPoint(angle, 68);
      const black = document.createElementNS(NS, 'text');
      black.setAttribute('x', bx.toFixed(2)); black.setAttribute('y', by.toFixed(2));
      black.setAttribute('class', 'bc-analog-num12');
      black.setAttribute('font-size', '15');
      black.textContent = String(h);
      svg.appendChild(black);

      const [rx, ry] = clockPoint(angle, 48);
      const red = document.createElementNS(NS, 'text');
      red.setAttribute('x', rx.toFixed(2)); red.setAttribute('y', ry.toFixed(2));
      red.setAttribute('class', 'bc-analog-num24');
      red.setAttribute('font-size', '10');
      red.textContent = String(h === 12 ? 24 : h + 12);
      svg.appendChild(red);
    }

    const makeHand = (cls, tail, length, width) => {
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', String(CLOCK_CX));
      line.setAttribute('y1', String(CLOCK_CY + tail));
      line.setAttribute('x2', String(CLOCK_CX));
      line.setAttribute('y2', String(CLOCK_CY - length));
      line.setAttribute('stroke-width', String(width));
      line.setAttribute('class', `bc-analog-hand ${cls}`);
      svg.appendChild(line);
      return line;
    };
    const hourHand = makeHand('bc-analog-hand-hour', 8, 48, 6);
    const minuteHand = makeHand('bc-analog-hand-minute', 12, 74, 4);
    const secondHand = makeHand('bc-analog-hand-second', 16, 80, 2);

    const hub = document.createElementNS(NS, 'circle');
    hub.setAttribute('cx', String(CLOCK_CX));
    hub.setAttribute('cy', String(CLOCK_CY));
    hub.setAttribute('r', '5');
    hub.setAttribute('class', 'bc-analog-hub');
    svg.appendChild(hub);

    this._analogWrap.appendChild(svg);
    this._analogHands = { hourHand, minuteHand, secondHand };
  }

  _startResizeObserver() {
    if (this._resizeObserver || typeof ResizeObserver === 'undefined') return;
    this._resizeObserver = new ResizeObserver(() => this._applySize());
    this._resizeObserver.observe(this);
  }

  _applyLayout() {
    if (!this._root) return;
    this._root.dataset.layout = this._layout;
    const clockVisible = this._layout !== 'bars_only';
    const barsVisible = this._layout !== 'clock_only';
    this._clockPanel.style.display = clockVisible ? '' : 'none';
    this._barsEl.style.display = barsVisible ? '' : 'none';
    if (this._spokenEl) this._spokenEl.style.display = this._showSpoken ? '' : 'none';
    if (this._dateEl) {
      this._dateEl.style.display = this._showDate ? '' : 'none';
      this._dateEl.classList.toggle('bc-date-font-mono', this._dateFont === 'mono');
    }
    if (this._analogWrap) this._analogWrap.classList.toggle('bc-analog-no-case', !this._showCase);
    this._applySize();
  }

  _applySize() {
    if (!this._clockPanel || this._layout === 'bars_only') return;
    const rect = this._clockPanel.getBoundingClientRect();
    const w = rect.width || this.getBoundingClientRect().width || 400;
    const h = rect.height || this.getBoundingClientRect().height || 400;
    const envelope = Math.max(80, Math.min(w, h) * (this._sizePercent / 100));
    const baseUnit = envelope * (this._textScalePercent / 100);

    if (this._clockType === 'master_clock') {
      this._applySizeAnalog(envelope);
    } else if (this._clockType === 'led_ring') {
      // When the case is on, it now wraps the whole ring (not just the
      // inner readout) -- shrink the ring itself so the ring + the case's
      // own border/padding together still fit the original envelope,
      // instead of the boxed clock overflowing it.
      const ringSize = this._showCase ? envelope * 0.88 : envelope;
      this._ringWrap.style.width = `${ringSize}px`;
      this._ringWrap.style.height = `${ringSize}px`;
      // The readout must fit inside the ring's circle, not the full panel --
      // constrained to the ring's own diameter shrunk to a safe inscribed
      // fraction.
      const inner = ringSize * 0.62;
      this._applySizeTextStyle(baseUnit, inner, inner);
    } else {
      this._applySizeTextStyle(baseUnit, w * 0.92, h * 0.7);
    }

    if (this._dateEl) {
      this._dateEl.style.fontSize = `${Math.max(9, baseUnit * 0.2)}px`;
      this._dateEl.style.marginTop = `${envelope * 0.03}px`;
    }
    if (this._spokenEl) {
      this._spokenEl.style.fontSize = `${Math.max(11, baseUnit * 0.3125)}px`;
      this._spokenEl.style.marginTop = `${envelope * 0.08}px`;
    }
  }

  // 'newline' shrinks the seconds row to half the primary row's size;
  // 'newline_large' keeps it full-size instead -- everywhere the seconds
  // row's relative size matters (segment font row2, normal font .bc-ss)
  // reads this same ratio.
  _secondsRowRatio() {
    return this._secondsPlacement === 'newline_large' ? 1 : 0.5;
  }

  _applySizeTextStyle(baseUnit, maxWidthPx, maxHeightPx) {
    if (this._textFont === 'segment') {
      this._applySizeSegment(baseUnit, maxWidthPx, maxHeightPx);
    } else {
      if (this._hhmmEl) this._hhmmEl.style.fontSize = `${baseUnit}px`;
      if (this._ssEl) this._ssEl.style.fontSize = `${baseUnit * this._secondsRowRatio()}px`;
      if (this._textTimeEl) this._textTimeEl.style.fontSize = `${baseUnit * 2.0}px`;
    }
  }

  // Measures a built digit row generically (rather than hand-deriving a
  // width formula per show_seconds/inline/12h combination) -- every element
  // is either a full digit (digitWRatio wide) or one of the dot-pairs
  // (colonWRatio wide, covers both colons and the AM/PM indicator), with a
  // gap between each. Stays correct automatically for any combination.
  _rowUnits(row) {
    const digitWRatio = 0.56, colonWRatio = 0.22, gapRatio = 0.12;
    let units = 0;
    Array.from(row.children).forEach((el, i) => {
      units += el.classList.contains('bc-digitalled-colon') ? colonWRatio : digitWRatio;
      if (i > 0) units += gapRatio;
    });
    return units;
  }

  _applySizeSegment(baseUnit, maxWidthPx, maxHeightPx) {
    const row1 = this._textStyleScreen.querySelector('.bc-digitalled-row-primary');
    if (!row1) return;
    const row2 = this._textStyleScreen.querySelector('.bc-digitalled-row-seconds');
    const secRatio = this._secondsRowRatio();
    const gapRatio = 0.12;
    const widestUnits = Math.max(this._rowUnits(row1), row2 ? this._rowUnits(row2) : 0);
    // Height-budget constants tuned per case: no row2 (single row, same as
    // before); row2 at half-size ('newline', same constants as before this
    // option existed); row2 at full-size ('newline_large' -- the stack is
    // taller, so both the target height and the height ceiling shrink to
    // leave room for two full-size rows instead of one-and-a-half).
    const desiredH = baseUnit * (!row2 ? 2.2 : (secRatio === 0.5 ? 1.3 : 1.1));
    const maxHByHeight = !row2 ? maxHeightPx * 0.7 : maxHeightPx * (secRatio === 0.5 ? 0.55 : 0.42);
    const digitH = Math.max(16, Math.min(desiredH, maxWidthPx / widestUnits, maxHByHeight));
    const gapPx = digitH * gapRatio;

    const digitWRatio = 0.56, colonWRatio = 0.22;
    const applyRow = (row, heightPx) => {
      if (!row) return;
      row.style.gap = `${gapPx}px`;
      Array.from(row.children).forEach((el) => {
        const isNarrow = el.classList.contains('bc-digitalled-colon');
        el.style.height = `${heightPx}px`;
        el.style.width = `${heightPx * (isNarrow ? colonWRatio : digitWRatio)}px`;
      });
    };
    applyRow(row1, digitH);
    if (row2) {
      applyRow(row2, digitH * secRatio);
      row1.style.marginBottom = `${digitH * 0.15}px`;
    }
  }

  _applySizeAnalog(envelope) {
    if (this._analogWrap) {
      this._analogWrap.style.width = `${envelope}px`;
      this._analogWrap.style.height = `${envelope}px`;
    }
  }

  _buildDots() {
    // Each dot is a <g> wrapping the coloured core circle plus a fixed white
    // "glass" highlight -- the highlight's own opacity is driven entirely by
    // CSS (0 for the plain flat-dot look, visible for the bulb-styled
    // "glowing" led_style), and both circles share the group's opacity in
    // _tickDotsRing so the highlight dims along with its dot instead of
    // needing separate per-tick bookkeeping.
    const NS = 'http://www.w3.org/2000/svg';
    const cx = 150, cy = 150, r = 140;
    this._dots = [];
    for (let i = 0; i < 60; i++) {
      const angle = -Math.PI / 2 + (i * (2 * Math.PI / 60));
      const dx = cx + r * Math.cos(angle);
      const dy = cy + r * Math.sin(angle);
      const group = document.createElementNS(NS, 'g');
      group.setAttribute('class', 'bc-ring-dot');

      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', dx.toFixed(2));
      circle.setAttribute('cy', dy.toFixed(2));
      circle.setAttribute('r', '4.5');
      circle.setAttribute('class', 'bc-ring-dot-core');
      group.appendChild(circle);

      const highlight = document.createElementNS(NS, 'circle');
      highlight.setAttribute('cx', (dx - 1.3).toFixed(2));
      highlight.setAttribute('cy', (dy - 1.3).toFixed(2));
      highlight.setAttribute('r', '1.3');
      highlight.setAttribute('class', 'bc-ring-dot-highlight');
      group.appendChild(highlight);

      this._svg.appendChild(group);
      this._dots.push({ group, circle });
    }
  }

  _dotColorForIndex(i) {
    switch (this._ringColorMode) {
      case 'solid':
        return this._ringColor;
      case 'match_text':
        return this._textColor;
      default:
        return paletteColor(RING_PALETTES[this._ringColorMode] || RING_PALETTES.rainbow, i / 59);
    }
  }

  _startClock() {
    if (this._timer) clearTimeout(this._timer);
    this._scheduleNextTick();
  }

  _scheduleNextTick() {
    // Anchor each repaint to the actual (offset-corrected) wall-clock second
    // boundary rather than a fixed 1000ms interval from whenever this card
    // happened to mount — otherwise two card instances (even on different
    // devices) tick on independent phases and can visibly disagree by up to
    // a full second even when their underlying corrected time is identical.
    // Re-anchoring every tick also self-corrects for setTimeout/setInterval
    // drift and for time_sync_entity offset changes.
    this._tick();
    const correctedNow = Date.now() + (this._timeOffsetMs || 0);
    const msToNextSecond = 1000 - (correctedNow % 1000);
    this._timer = setTimeout(() => this._scheduleNextTick(), msToNextSecond);
  }

  _tick() {
    const now = new Date(Date.now() + (this._timeOffsetMs || 0));
    const h24 = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    const dateStr = this._formatDate(now);

    if (this._clockType === 'master_clock') {
      this._tickAnalog(h24, m, s, dateStr);
    } else {
      this._tickTextStyle(h24, m, s, dateStr);
      if (this._clockType === 'led_ring') this._tickDotsRing(s);
    }

    if (this._spokenEl) this._spokenEl.textContent = this._showSpoken ? this._spokenTime(h24, m) : ' ';
  }

  _formatDate(now) {
    switch (this._dateFormat) {
      case 'long_year':
        return now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      case 'short':
        return now.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      case 'numeric':
        return now.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
      default: // 'long'
        return now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    }
  }

  // Shared by 'led_ring' (embedded readout) and 'text' clock types.
  _tickTextStyle(h24, m, s, dateStr) {
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    const isPM = h24 >= 12;
    const hoursForDisplay = this._timeFormat === '12h' ? h12 : h24;
    const hh = String(hoursForDisplay).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    const suffix = this._timeFormat === '12h' ? (isPM ? ' PM' : ' AM') : '';

    if (this._textFont === 'segment') {
      const d = this._digitalLedDigits;
      if (d) {
        this._setLedDigits(hh, mm, ss);
        // The ring itself is the live seconds indicator for 'led_ring', so
        // its colon(s) stay steady; 'text' has no other seconds indicator,
        // so its colon(s) blink like a classic digital clock.
        const colonOn = this._clockType === 'led_ring' ? true : (s % 2 === 0);
        [d.colon1, d.colon2].forEach((c) => { if (c) c.dots.forEach((dot) => dot.classList.toggle('on', colonOn)); });
      }
      if (this._ampmDots) {
        this._ampmDots.top.classList.toggle('on', !isPM);
        this._ampmDots.bot.classList.toggle('on', isPM);
      }
    } else {
      if (this._hhmmEl) this._hhmmEl.textContent = `${hh}:${mm}${suffix}`;
      if (this._ssEl) this._ssEl.textContent = ss;
      if (this._textTimeEl) {
        const base = this._showSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
        this._textTimeEl.textContent = base + suffix;
      }
    }
    if (this._dateEl) this._dateEl.textContent = dateStr;
  }

  // Shared by any clock type that includes the 60-dot second ring
  // ('led_ring' only, currently) -- led_off_style/emphasize_current_second
  // are per-instance config, everything else is the seconds-progress math.
  _tickDotsRing(s) {
    if (!this._dots) return;
    const offOpacity = this._ledOffStyle === 'blank' ? '0' : '0.28';
    for (let i = 0; i < 60; i++) {
      const { group, circle } = this._dots[i];
      const color = this._dotColorForIndex(i);
      circle.setAttribute('fill', color);
      circle.style.color = color;
      if (i <= s) {
        const isCurrent = i === s && this._emphasizeCurrentSecond;
        circle.setAttribute('r', isCurrent ? '7.5' : '5');
        group.setAttribute('opacity', '1');
      } else {
        circle.setAttribute('r', '3.5');
        group.setAttribute('opacity', offOpacity);
      }
    }
  }

  _tickAnalog(h24, m, s, dateStr) {
    const hands = this._analogHands;
    if (!hands) return;
    const hourAngle = ((h24 % 12) + m / 60) * 30;
    const minuteAngle = (m + s / 60) * 6;
    hands.hourHand.setAttribute('transform', `rotate(${hourAngle.toFixed(2)} ${CLOCK_CX} ${CLOCK_CY})`);
    hands.minuteHand.setAttribute('transform', `rotate(${minuteAngle.toFixed(2)} ${CLOCK_CX} ${CLOCK_CY})`);
    // Second hand uses a CSS transform (not the SVG attribute) so the
    // transition below can animate it — kept as an ever-increasing angle
    // (never reset to 0) so it always steps forward by exactly 6deg and the
    // overshoot/settle animation never has to spin the "wrong way" around
    // the minute-boundary wraparound.
    this._secondHandDeg = (this._secondHandDeg || 0) + 6;
    hands.secondHand.style.transform = `rotate(${this._secondHandDeg}deg)`;
    if (this._dateEl) this._dateEl.textContent = dateStr;
  }

  _numberWord(n) {
    const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
      'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
      'eighteen', 'nineteen'];
    const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];
    if (n < 20) return ONES[n];
    const t = Math.floor(n / 10), o = n % 10;
    return TENS[t] + (o ? '-' + ONES[o] : '');
  }

  _spokenTime(h24, m) {
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    let nextH12 = (h24 + 1) % 12;
    if (nextH12 === 0) nextH12 = 12;
    const hourWord = this._numberWord(h12);
    const nextHourWord = this._numberWord(nextH12);
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    if (m === 0) return cap(`exactly ${hourWord} o'clock`);
    if (m === 15) return cap(`quarter past ${hourWord}`);
    if (m === 30) return cap(`half past ${hourWord}`);
    if (m === 45) return cap(`quarter to ${nextHourWord}`);
    if (m < 30) {
      return cap(`${this._numberWord(m)} minute${m === 1 ? '' : 's'} past ${hourWord}`);
    }
    const rem = 60 - m;
    return cap(`${this._numberWord(rem)} minute${rem === 1 ? '' : 's'} to ${nextHourWord}`);
  }

  _renderBars() {
    if (!this._barsEl || !this._bars) return;
    this._barsEl.innerHTML = '';
    for (const bar of this._bars) {
      const el = document.createElement('div');
      let active = false;
      if (bar.entity && this._hass && this._hass.states[bar.entity]) {
        const st = this._hass.states[bar.entity];
        // attribute (optional) reads an attribute instead of the entity's
        // own state -- e.g. a climate entity's hvac_action, or a custom
        // integration's raw sensor payload field.
        const raw = bar.attribute ? st.attributes[bar.attribute] : st.state;
        if (bar.on_values && bar.on_values.trim()) {
          // on_values (optional, comma-separated) replaces the default
          // on/true/home/open set entirely -- lets a bar go active on any
          // custom value (numeric attribute readings, other integrations'
          // state strings, etc), not just the handful HA itself uses for "on".
          const onSet = bar.on_values.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
          active = onSet.includes(String(raw).toLowerCase());
        } else {
          active = raw === 'on' || raw === 'true' || raw === 'home' || raw === 'open' || raw === true;
        }
      }
      el.className = 'bc-bar' + (active ? '' : ' bc-inactive');
      el.textContent = bar.label || '';
      if (active) {
        const color = bar.color || '#3bff6a';
        el.style.background = `linear-gradient(180deg, ${color}, ${color}cc)`;
        el.style.boxShadow = `0 0 18px ${color}66`;
        el.style.color = '#000';
      } else if (this._barOffStyle === 'tinted') {
        const dark = darkenHex(bar.color || '#3bff6a', this._barOffBrightness);
        el.style.background = `linear-gradient(180deg, ${dark}, ${dark}cc)`;
      }
      this._barsEl.appendChild(el);
    }
  }
}

if (!customElements.get('broadcast-clock-card')) {
  customElements.define('broadcast-clock-card', BroadcastClockCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'broadcast-clock-card',
    name: 'Broadcast Clock',
    description: 'A broadcast-studio style on-air clock (master clock, LED ring or text-only, each with sub-options) with optional status bars and flexible layouts.'
  });
}

/* ---------------- Visual editor ---------------- */

class BroadcastClockCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      layout: 'clock_bars',
      clock_type: 'led_ring',
      size_percent: 70,
      text_scale_percent: 16,
      text_glow_percent: 100,
      show_spoken_time: true,
      show_date: true,
      date_format: 'long',
      date_font: 'default',
      time_sync_entity: '',
      show_case: true,
      ring_color_mode: 'rainbow',
      ring_color: '#ff3b3b',
      led_style: 'glowing',
      led_off_style: 'dull',
      emphasize_current_second: true,
      text_color: '#ff3b3b',
      text_font: 'normal',
      show_seconds: true,
      seconds_placement: 'newline',
      time_format: '24h',
      second_hand_bounce_deg: 2,
      bar_off_style: 'neutral',
      bar_off_brightness: 15,
      bars: DEFAULT_BARS.map((b) => ({ ...b })),
      ...(config || {})
    };
    if (!this._config.bars || !this._config.bars.length) {
      this._config.bars = DEFAULT_BARS.map((b) => ({ ...b }));
    }
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // ha-entity-picker takes hass as a JS property, not an attribute -- keep
    // any already-rendered pickers in sync (setConfig/hass ordering from
    // Lovelace isn't guaranteed, and hass updates as entities change).
    if (this._wrap) {
      this._wrap.querySelectorAll('ha-entity-picker').forEach((el) => { el.hass = hass; });
    }
  }

  _emitChange() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true
    }));
  }

  _render() {
    if (!this._built) {
      this._built = true;
      const style = document.createElement('style');
      style.textContent = `
        .bce-row { display: flex; align-items: center; gap: 8px; margin: 10px 0; }
        .bce-row label { flex: 0 0 150px; font-size: 14px; opacity: 0.85; }
        .bce-row input[type="text"], .bce-row input[type="number"], .bce-row select {
          flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--divider-color, #444);
          background: var(--card-background-color, #1c1c1c); color: inherit;
        }
        .bce-row ha-entity-picker { flex: 1; }
        .bce-row input[type="color"] { width: 40px; height: 32px; padding: 0; border: none; background: none; }
        .bce-section-title { font-size: 15px; font-weight: 600; margin: 18px 0 6px; }
        .bce-section-title:first-child { margin-top: 4px; }
        .bce-bar-block {
          border: 1px solid var(--divider-color, #444); border-radius: 8px; padding: 10px; margin-bottom: 10px;
        }
        .bce-bar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .bce-remove-btn, .bce-add-btn {
          cursor: pointer; border: none; border-radius: 6px; padding: 6px 10px;
          background: var(--primary-color, #03a9f4); color: #fff; font-size: 13px;
        }
        .bce-remove-btn { background: #b23b3b; }
      `;
      this.appendChild(style);
      this._wrap = document.createElement('div');
      this._wrap.style.padding = '8px 4px';
      this.appendChild(this._wrap);
    }

    const c = this._config;
    const isLedRing = c.clock_type === 'led_ring';
    const isText = c.clock_type === 'text';
    const isMasterClock = c.clock_type === 'master_clock';
    const hasTextStyle = isLedRing || isText;
    // The panel that's hidden by the current layout has nothing to
    // configure -- no point showing clock options when only bars are
    // visible, or bar options when only the clock is visible.
    const showClockSettings = c.layout !== 'bars_only';
    const showBarSettings = c.layout !== 'clock_only';

    this._wrap.innerHTML = `
      <div class="bce-section-title">Panel layout</div>
      <div class="bce-row">
        <label>Layout</label>
        <select id="bce-layout">
          <option value="clock_bars" ${c.layout === 'clock_bars' ? 'selected' : ''}>Clock + status bars</option>
          <option value="bars_clock" ${c.layout === 'bars_clock' ? 'selected' : ''}>Status bars + clock</option>
          <option value="clock_only" ${c.layout === 'clock_only' ? 'selected' : ''}>Clock only</option>
          <option value="bars_only" ${c.layout === 'bars_only' ? 'selected' : ''}>Status bars only</option>
          <option value="stacked" ${c.layout === 'stacked' ? 'selected' : ''}>Stacked (clock above bars)</option>
        </select>
      </div>

      ${showClockSettings ? `
      <div class="bce-section-title">Clock</div>
      <div class="bce-row">
        <label>Clock type</label>
        <select id="bce-clocktype">
          <option value="master_clock" ${isMasterClock ? 'selected' : ''}>Master Clock (studio analog clock)</option>
          <option value="led_ring" ${isLedRing ? 'selected' : ''}>LED Ring (60-dot second ring + readout)</option>
          <option value="text" ${isText ? 'selected' : ''}>Text (readout only, no ring)</option>
        </select>
      </div>
      <div class="bce-row">
        <label>Clock size (% of card height)</label>
        <input type="number" id="bce-size" min="10" max="100" value="${c.size_percent}">
      </div>
      <div class="bce-row">
        <label>Text size (%)</label>
        <input type="number" id="bce-textscale" min="5" max="40" value="${c.text_scale_percent}">
      </div>
      <div class="bce-row">
        <label>Glow intensity (%)</label>
        <input type="number" id="bce-glow" min="0" max="200" value="${c.text_glow_percent}">
      </div>
      <div class="bce-row">
        <label>Show case housing</label>
        <input type="checkbox" id="bce-showcase" ${c.show_case !== false ? 'checked' : ''}>
      </div>
      <div class="bce-row">
        <label>Text colour</label>
        <input type="color" id="bce-textcolor" value="${c.text_color}">
      </div>

      ${isMasterClock ? `
      <div class="bce-row">
        <label>Second hand bounce (deg)</label>
        <input type="number" id="bce-secbounce" min="0" max="8" step="0.5" value="${c.second_hand_bounce_deg ?? 2}">
      </div>
      ` : ''}

      ${isLedRing ? `
      <div class="bce-row">
        <label>Ring colour</label>
        <select id="bce-ringmode">
          <option value="rainbow" ${c.ring_color_mode === 'rainbow' ? 'selected' : ''}>Rainbow</option>
          <option value="sunset" ${c.ring_color_mode === 'sunset' ? 'selected' : ''}>Sunset</option>
          <option value="ocean" ${c.ring_color_mode === 'ocean' ? 'selected' : ''}>Ocean</option>
          <option value="neon" ${c.ring_color_mode === 'neon' ? 'selected' : ''}>Neon</option>
          <option value="solid" ${c.ring_color_mode === 'solid' ? 'selected' : ''}>Solid colour</option>
          <option value="match_text" ${c.ring_color_mode === 'match_text' ? 'selected' : ''}>Match text colour</option>
        </select>
      </div>
      ${c.ring_color_mode === 'solid' ? `
      <div class="bce-row">
        <label>Ring colour</label>
        <input type="color" id="bce-ringcolor" value="${c.ring_color}">
      </div>` : ''}
      <div class="bce-row">
        <label>LED style</label>
        <select id="bce-ledstyle">
          <option value="glowing" ${c.led_style !== 'flat' ? 'selected' : ''}>Glowing bulb</option>
          <option value="flat" ${c.led_style === 'flat' ? 'selected' : ''}>Flat dot</option>
        </select>
      </div>
      <div class="bce-row">
        <label>Emphasize current second</label>
        <input type="checkbox" id="bce-emphasizesecond" ${c.emphasize_current_second !== false ? 'checked' : ''}>
      </div>
      <div class="bce-row">
        <label>LED off style</label>
        <select id="bce-ledoffstyle">
          <option value="dull" ${c.led_off_style !== 'blank' ? 'selected' : ''}>Dull (dim, still visible)</option>
          <option value="blank" ${c.led_off_style === 'blank' ? 'selected' : ''}>Blank (invisible until lit)</option>
        </select>
      </div>
      ` : ''}

      ${hasTextStyle ? `
      <div class="bce-row">
        <label>Font</label>
        <select id="bce-textfont">
          <option value="segment" ${c.text_font === 'segment' ? 'selected' : ''}>Segment LED</option>
          <option value="normal" ${c.text_font !== 'segment' ? 'selected' : ''}>Normal text</option>
        </select>
      </div>
      <div class="bce-row">
        <label>Show seconds</label>
        <input type="checkbox" id="bce-showseconds" ${c.show_seconds !== false ? 'checked' : ''}>
      </div>
      ${c.show_seconds !== false ? `
      <div class="bce-row">
        <label>Seconds placement</label>
        <select id="bce-secondsplacement">
          <option value="newline" ${(!c.seconds_placement || c.seconds_placement === 'newline') ? 'selected' : ''}>New line (smaller, below)</option>
          <option value="newline_large" ${c.seconds_placement === 'newline_large' ? 'selected' : ''}>New line (larger, below)</option>
          <option value="inline" ${c.seconds_placement === 'inline' ? 'selected' : ''}>Inline (same line)</option>
        </select>
      </div>
      ` : ''}
      <div class="bce-row">
        <label>Time format</label>
        <select id="bce-timeformat">
          <option value="24h" ${c.time_format !== '12h' ? 'selected' : ''}>24-hour</option>
          <option value="12h" ${c.time_format === '12h' ? 'selected' : ''}>12-hour (AM/PM)</option>
        </select>
      </div>
      ` : ''}

      <div class="bce-section-title">Date &amp; spoken time</div>
      <div class="bce-row">
        <label>Show date line</label>
        <input type="checkbox" id="bce-showdate" ${c.show_date !== false ? 'checked' : ''}>
      </div>
      ${c.show_date !== false ? `
      <div class="bce-row">
        <label>Date format</label>
        <select id="bce-dateformat">
          <option value="long" ${(!c.date_format || c.date_format === 'long') ? 'selected' : ''}>Friday, 14 August</option>
          <option value="long_year" ${c.date_format === 'long_year' ? 'selected' : ''}>Friday, 14 August 2026</option>
          <option value="short" ${c.date_format === 'short' ? 'selected' : ''}>14 Aug 2026</option>
          <option value="numeric" ${c.date_format === 'numeric' ? 'selected' : ''}>14/08/2026</option>
        </select>
      </div>
      <div class="bce-row">
        <label>Date font</label>
        <select id="bce-datefont">
          <option value="default" ${c.date_font !== 'mono' ? 'selected' : ''}>Default</option>
          <option value="mono" ${c.date_font === 'mono' ? 'selected' : ''}>Monospace</option>
        </select>
      </div>
      ` : ''}
      <div class="bce-row">
        <label>Time sync entity</label>
        <ha-entity-picker id="bce-timesync" allow-custom-entity></ha-entity-picker>
      </div>
      <div class="bce-row">
        <label>Show spoken time line</label>
        <input type="checkbox" id="bce-showspoken" ${c.show_spoken_time ? 'checked' : ''}>
      </div>
      ` : ''}

      ${showBarSettings ? `
      <div class="bce-section-title">Status bars</div>
      <div class="bce-row">
        <label>Bar off colour</label>
        <select id="bce-baroffstyle">
          <option value="neutral" ${c.bar_off_style !== 'tinted' ? 'selected' : ''}>Neutral dark</option>
          <option value="tinted" ${c.bar_off_style === 'tinted' ? 'selected' : ''}>Darker shade of on-colour</option>
        </select>
      </div>
      ${c.bar_off_style === 'tinted' ? `
      <div class="bce-row">
        <label>Off brightness (%)</label>
        <input type="number" id="bce-baroffbrightness" min="5" max="40" step="1" value="${c.bar_off_brightness ?? 15}">
      </div>
      ` : ''}
      <div id="bce-bars"></div>
      <button class="bce-add-btn" id="bce-add-bar" type="button">+ Add status bar</button>
      ` : ''}
    `;

    this._wrap.querySelector('#bce-layout').addEventListener('change', (e) => {
      this._config.layout = e.target.value;
      this._render();
      this._emitChange();
    });
    const clockTypeSelect = this._wrap.querySelector('#bce-clocktype');
    if (clockTypeSelect) {
      clockTypeSelect.addEventListener('change', (e) => {
        this._config.clock_type = e.target.value;
        this._render();
        this._emitChange();
      });
    }
    const sizeInput = this._wrap.querySelector('#bce-size');
    if (sizeInput) {
      sizeInput.addEventListener('change', (e) => {
        this._config.size_percent = Number(e.target.value) || 70;
        this._emitChange();
      });
    }
    const textScaleInput = this._wrap.querySelector('#bce-textscale');
    if (textScaleInput) {
      textScaleInput.addEventListener('change', (e) => {
        this._config.text_scale_percent = Number(e.target.value) || 16;
        this._emitChange();
      });
    }
    const glowInput = this._wrap.querySelector('#bce-glow');
    if (glowInput) {
      glowInput.addEventListener('change', (e) => {
        this._config.text_glow_percent = Number(e.target.value);
        this._emitChange();
      });
    }
    const showCaseInput = this._wrap.querySelector('#bce-showcase');
    if (showCaseInput) {
      showCaseInput.addEventListener('change', (e) => {
        this._config.show_case = e.target.checked;
        this._emitChange();
      });
    }
    const textColorInput = this._wrap.querySelector('#bce-textcolor');
    if (textColorInput) {
      textColorInput.addEventListener('change', (e) => {
        this._config.text_color = e.target.value;
        this._emitChange();
      });
    }
    const secondBounceInput = this._wrap.querySelector('#bce-secbounce');
    if (secondBounceInput) {
      secondBounceInput.addEventListener('change', (e) => {
        this._config.second_hand_bounce_deg = Number(e.target.value);
        this._emitChange();
      });
    }
    const ringModeSelect = this._wrap.querySelector('#bce-ringmode');
    if (ringModeSelect) {
      ringModeSelect.addEventListener('change', (e) => {
        this._config.ring_color_mode = e.target.value;
        this._render();
        this._emitChange();
      });
    }
    const ringColorInput = this._wrap.querySelector('#bce-ringcolor');
    if (ringColorInput) {
      ringColorInput.addEventListener('change', (e) => {
        this._config.ring_color = e.target.value;
        this._emitChange();
      });
    }
    const ledStyleSelect = this._wrap.querySelector('#bce-ledstyle');
    if (ledStyleSelect) {
      ledStyleSelect.addEventListener('change', (e) => {
        this._config.led_style = e.target.value;
        this._emitChange();
      });
    }
    const emphasizeSecondInput = this._wrap.querySelector('#bce-emphasizesecond');
    if (emphasizeSecondInput) {
      emphasizeSecondInput.addEventListener('change', (e) => {
        this._config.emphasize_current_second = e.target.checked;
        this._emitChange();
      });
    }
    const ledOffStyleSelect = this._wrap.querySelector('#bce-ledoffstyle');
    if (ledOffStyleSelect) {
      ledOffStyleSelect.addEventListener('change', (e) => {
        this._config.led_off_style = e.target.value;
        this._emitChange();
      });
    }
    const textFontSelect = this._wrap.querySelector('#bce-textfont');
    if (textFontSelect) {
      textFontSelect.addEventListener('change', (e) => {
        this._config.text_font = e.target.value;
        this._emitChange();
      });
    }
    const showSecondsInput = this._wrap.querySelector('#bce-showseconds');
    if (showSecondsInput) {
      showSecondsInput.addEventListener('change', (e) => {
        this._config.show_seconds = e.target.checked;
        this._render();
        this._emitChange();
      });
    }
    const secondsPlacementSelect = this._wrap.querySelector('#bce-secondsplacement');
    if (secondsPlacementSelect) {
      secondsPlacementSelect.addEventListener('change', (e) => {
        this._config.seconds_placement = e.target.value;
        this._emitChange();
      });
    }
    const timeFormatSelect = this._wrap.querySelector('#bce-timeformat');
    if (timeFormatSelect) {
      timeFormatSelect.addEventListener('change', (e) => {
        this._config.time_format = e.target.value;
        this._emitChange();
      });
    }
    const showDateInput = this._wrap.querySelector('#bce-showdate');
    if (showDateInput) {
      showDateInput.addEventListener('change', (e) => {
        this._config.show_date = e.target.checked;
        this._render();
        this._emitChange();
      });
    }
    const dateFormatSelect = this._wrap.querySelector('#bce-dateformat');
    if (dateFormatSelect) {
      dateFormatSelect.addEventListener('change', (e) => {
        this._config.date_format = e.target.value;
        this._emitChange();
      });
    }
    const dateFontSelect = this._wrap.querySelector('#bce-datefont');
    if (dateFontSelect) {
      dateFontSelect.addEventListener('change', (e) => {
        this._config.date_font = e.target.value;
        this._emitChange();
      });
    }
    const timeSyncPicker = this._wrap.querySelector('#bce-timesync');
    if (timeSyncPicker) {
      timeSyncPicker.hass = this._hass;
      timeSyncPicker.value = c.time_sync_entity || '';
      timeSyncPicker.addEventListener('value-changed', (e) => {
        this._config.time_sync_entity = (e.detail.value || '').trim();
        this._emitChange();
      });
    }
    const showSpokenInput = this._wrap.querySelector('#bce-showspoken');
    if (showSpokenInput) {
      showSpokenInput.addEventListener('change', (e) => {
        this._config.show_spoken_time = e.target.checked;
        this._emitChange();
      });
    }
    const barOffStyleSelect = this._wrap.querySelector('#bce-baroffstyle');
    if (barOffStyleSelect) {
      barOffStyleSelect.addEventListener('change', (e) => {
        this._config.bar_off_style = e.target.value;
        this._render();
        this._emitChange();
      });
    }
    const barOffBrightnessInput = this._wrap.querySelector('#bce-baroffbrightness');
    if (barOffBrightnessInput) {
      barOffBrightnessInput.addEventListener('change', (e) => {
        this._config.bar_off_brightness = Number(e.target.value);
        this._emitChange();
      });
    }
    const addBarBtn = this._wrap.querySelector('#bce-add-bar');
    if (addBarBtn) {
      addBarBtn.addEventListener('click', () => {
        this._config.bars = [...this._config.bars, { label: 'NEW STATUS', color: '#ffffff', entity: '' }];
        this._render();
        this._emitChange();
      });
    }

    const barsEl = this._wrap.querySelector('#bce-bars');
    if (barsEl) c.bars.forEach((bar, idx) => {
      const block = document.createElement('div');
      block.className = 'bce-bar-block';
      block.innerHTML = `
        <div class="bce-bar-header">
          <strong>Bar ${idx + 1}</strong>
          <button class="bce-remove-btn" type="button">Remove</button>
        </div>
        <div class="bce-row">
          <label>Label</label>
          <input type="text" data-field="label" value="${bar.label || ''}">
        </div>
        <div class="bce-row">
          <label>Color</label>
          <input type="color" data-field="color" value="${bar.color || '#ffffff'}">
        </div>
        <div class="bce-row">
          <label>Entity (optional)</label>
          <ha-entity-picker data-field="entity" allow-custom-entity></ha-entity-picker>
        </div>
        <div class="bce-row">
          <label>Attribute (optional)</label>
          <input type="text" data-field="attribute" placeholder="blank = use entity's state" value="${bar.attribute || ''}">
        </div>
        <div class="bce-row">
          <label>"On" values (optional)</label>
          <input type="text" data-field="on_values" placeholder="blank = on/true/home/open, e.g. active,42" value="${bar.on_values || ''}">
        </div>
      `;
      block.querySelector('.bce-remove-btn').addEventListener('click', () => {
        this._config.bars = this._config.bars.filter((_, i) => i !== idx);
        this._render();
        this._emitChange();
      });
      const barEntityPicker = block.querySelector('ha-entity-picker[data-field="entity"]');
      barEntityPicker.hass = this._hass;
      barEntityPicker.value = bar.entity || '';
      barEntityPicker.addEventListener('value-changed', (e) => {
        const val = e.detail.value || '';
        this._config.bars = this._config.bars.map((b, i) => i === idx ? { ...b, entity: val } : b);
        this._emitChange();
      });
      block.querySelectorAll('input[data-field]').forEach((input) => {
        const field = input.dataset.field;
        const evt = input.type === 'checkbox' ? 'change' : 'change';
        input.addEventListener(evt, () => {
          const val = input.type === 'checkbox' ? input.checked : input.value;
          this._config.bars = this._config.bars.map((b, i) => i === idx ? { ...b, [field]: val } : b);
          this._emitChange();
        });
      });
      barsEl.appendChild(block);
    });
  }
}

if (!customElements.get('broadcast-clock-card-editor')) {
  customElements.define('broadcast-clock-card-editor', BroadcastClockCardEditor);
}
