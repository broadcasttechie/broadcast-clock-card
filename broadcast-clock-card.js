const DEFAULT_BARS = [
  { label: 'STATUS 1', color: '#ff3b3b', demo_active: true, entity: '' },
  { label: 'STATUS 2', color: '#3bd6ff', demo_active: false, entity: '' },
  { label: 'STATUS 3', color: '#3bff6a', demo_active: true, entity: '' },
  { label: 'STATUS 4', color: '#ffcf3b', demo_active: false, entity: '' }
];

const RING_PALETTES = {
  rainbow: ['#ff3b3b', '#ffcf3b', '#3bff6a', '#3bd6ff', '#8a3bff', '#ff3b3b'],
  sunset: ['#ff3ba1', '#ff3b3b', '#ff8a3b', '#ffd93b'],
  ocean: ['#3b3bff', '#3b8aff', '#3bd6ff', '#3bffcc'],
  neon: ['#ff3bd6', '#3bfff2', '#faff3b', '#ff3bd6']
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

function paletteColor(stops, t) {
  const clamped = Math.min(0.999999, Math.max(0, t));
  const segments = stops.length - 1;
  const scaled = clamped * segments;
  const idx = Math.floor(scaled);
  return lerpColor(stops[idx], stops[idx + 1], scaled - idx);
}

class BroadcastClockCard extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    this._bars = (this._config.bars && this._config.bars.length ? this._config.bars : DEFAULT_BARS);
    this._sizePercent = this._clampSize(this._config.size_percent);
    this._textScalePercent = this._clampTextScale(this._config.text_scale_percent);
    this._showBars = this._config.show_status_bars !== false;
    this._showSpoken = this._config.show_spoken_time !== false;
    this._ringColorMode = this._normalizeRingColorMode(this._config.ring_color_mode);
    this._ringColor = this._config.ring_color || '#ff3b3b';
    this._textColor = this._config.text_color || '#ff3b3b';
    if (!this._built) this._build();
    this._applyColors();
    this._applyLayout();
    this._renderBars();
    if (this._built) this._tick();
  }

  set hass(hass) {
    this._hass = hass;
    this._renderBars();
  }

  connectedCallback() {
    if (!this._built) this._build();
    this._startClock();
    this._startResizeObserver();
  }

  disconnectedCallback() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
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
      size_percent: 70,
      text_scale_percent: 16,
      show_status_bars: true,
      show_spoken_time: true,
      ring_color_mode: 'rainbow',
      ring_color: '#ff3b3b',
      text_color: '#ff3b3b',
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

  _normalizeRingColorMode(v) {
    return (v === 'solid' || v === 'match_text' || RING_PALETTES[v]) ? v : 'rainbow';
  }

  _applyColors() {
    if (!this._root) return;
    this._root.style.setProperty('--bc-text-color', this._textColor);
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
        flex-direction: row;
        width: 100%;
        height: 100%;
        background: #000;
        color: #fff;
        box-sizing: border-box;
        overflow: hidden;
        font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      }
      .bc-root.bc-clock-only {
        justify-content: center;
      }
      .bc-clock-side {
        flex: 1.6;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
        box-sizing: border-box;
        min-width: 0;
      }
      .bc-root.bc-clock-only .bc-clock-side {
        flex: 1;
      }
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
        text-shadow: 0 0 18px var(--bc-text-color, #ff3b3b);
        line-height: 1;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .bc-ss {
        font-weight: 700;
        color: var(--bc-text-color, #ff3b3b);
        text-shadow: 0 0 14px var(--bc-text-color, #ff3b3b);
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
      .bc-spoken {
        font-weight: 700;
        color: var(--bc-text-color, #ff3b3b);
        text-align: center;
        padding: 0 2vw;
        box-sizing: border-box;
      }
      .bc-bars-side {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 3vh;
        padding: 3vh 3vw;
        box-sizing: border-box;
        min-width: 0;
      }
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
      <div class="bc-clock-side">
        <div class="bc-ring-wrap">
          <svg viewBox="0 0 300 300"></svg>
          <div class="bc-digital">
            <div class="bc-hhmm" id="bc-hhmm">--:--</div>
            <div class="bc-ss" id="bc-ss">--</div>
            <div class="bc-date" id="bc-date">-</div>
          </div>
        </div>
        <div class="bc-spoken" id="bc-spoken">&nbsp;</div>
      </div>
      <div class="bc-bars-side" id="bc-bars"></div>
    `;

    root.prepend(style);
    this.innerHTML = '';
    this.appendChild(root);

    this._root = root;
    this._svg = root.querySelector('svg');
    this._clockSide = root.querySelector('.bc-clock-side');
    this._ringWrap = root.querySelector('.bc-ring-wrap');
    this._hhmmEl = root.querySelector('#bc-hhmm');
    this._ssEl = root.querySelector('#bc-ss');
    this._dateEl = root.querySelector('#bc-date');
    this._spokenEl = root.querySelector('#bc-spoken');
    this._barsEl = root.querySelector('#bc-bars');

    this._buildDots();
  }

  _startResizeObserver() {
    if (this._resizeObserver || typeof ResizeObserver === 'undefined') return;
    this._resizeObserver = new ResizeObserver(() => this._applySize());
    this._resizeObserver.observe(this);
  }

  _applyLayout() {
    if (!this._root) return;
    this._root.classList.toggle('bc-clock-only', !this._showBars);
    this._barsEl.style.display = this._showBars ? '' : 'none';
    this._spokenEl.style.display = this._showSpoken ? '' : 'none';
    this._applySize();
  }

  _applySize() {
    if (!this._ringWrap) return;
    const rect = (this._clockSide || this).getBoundingClientRect();
    const availableHeight = rect.height || this.getBoundingClientRect().height || 400;
    const availableWidth = rect.width || availableHeight;
    const ringPx = Math.max(80, Math.min(availableHeight, availableWidth) * (this._sizePercent / 100));
    this._ringWrap.style.width = `${ringPx}px`;
    this._ringWrap.style.height = `${ringPx}px`;

    const textScale = this._textScalePercent / 100;
    const hhmmPx = ringPx * textScale;
    this._hhmmEl.style.fontSize = `${hhmmPx}px`;
    this._ssEl.style.fontSize = `${hhmmPx * 0.5}px`;
    this._dateEl.style.fontSize = `${Math.max(9, hhmmPx * 0.2)}px`;
    this._dateEl.style.marginTop = `${ringPx * 0.02}px`;
    this._spokenEl.style.fontSize = `${Math.max(11, hhmmPx * 0.3125)}px`;
    this._spokenEl.style.marginTop = `${ringPx * 0.08}px`;
  }

  _buildDots() {
    const NS = 'http://www.w3.org/2000/svg';
    const cx = 150, cy = 150, r = 140;
    this._dots = [];
    for (let i = 0; i < 60; i++) {
      const angle = -Math.PI / 2 + (i * (2 * Math.PI / 60));
      const dx = cx + r * Math.cos(angle);
      const dy = cy + r * Math.sin(angle);
      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', dx.toFixed(2));
      circle.setAttribute('cy', dy.toFixed(2));
      circle.setAttribute('r', '4.5');
      this._svg.appendChild(circle);
      this._dots.push(circle);
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
    if (this._timer) clearInterval(this._timer);
    this._tick();
    this._timer = setInterval(() => this._tick(), 1000);
  }

  _tick() {
    const now = new Date();
    const h24 = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();

    const hh = String(h24).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');

    if (this._hhmmEl) this._hhmmEl.textContent = `${hh}:${mm}`;
    if (this._ssEl) this._ssEl.textContent = ss;
    if (this._dateEl) {
      this._dateEl.textContent = now.toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long'
      });
    }
    if (this._spokenEl) this._spokenEl.textContent = this._spokenTime(h24, m);

    if (this._dots) {
      for (let i = 0; i < 60; i++) {
        const dot = this._dots[i];
        const color = this._dotColorForIndex(i);
        dot.setAttribute('fill', color);
        if (i <= s) {
          dot.setAttribute('r', i === s ? '7.5' : '5');
          dot.setAttribute('opacity', '1');
        } else {
          dot.setAttribute('r', '3.5');
          dot.setAttribute('opacity', '0.28');
        }
      }
    }
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
      let active = !!bar.demo_active;
      if (bar.entity && this._hass && this._hass.states[bar.entity]) {
        const st = this._hass.states[bar.entity].state;
        active = st === 'on' || st === 'true' || st === 'home' || st === 'open';
      }
      el.className = 'bc-bar' + (active ? '' : ' bc-inactive');
      el.textContent = bar.label || '';
      if (active) {
        const color = bar.color || '#3bff6a';
        el.style.background = `linear-gradient(180deg, ${color}, ${color}cc)`;
        el.style.boxShadow = `0 0 18px ${color}66`;
        el.style.color = '#000';
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
    description: 'A broadcast-studio style on-air clock with a 60-dot second ring and status bars.'
  });
}

/* ---------------- Visual editor ---------------- */

class BroadcastClockCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      size_percent: 70,
      text_scale_percent: 16,
      show_status_bars: true,
      show_spoken_time: true,
      ring_color_mode: 'rainbow',
      ring_color: '#ff3b3b',
      text_color: '#ff3b3b',
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
        .bce-row input[type="color"] { width: 40px; height: 32px; padding: 0; border: none; background: none; }
        .bce-section-title { font-size: 15px; font-weight: 600; margin: 18px 0 6px; }
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
    this._wrap.innerHTML = `
      <div class="bce-row">
        <label>Clock size (% of card height)</label>
        <input type="number" id="bce-size" min="10" max="100" value="${c.size_percent}">
      </div>
      <div class="bce-row">
        <label>Text size (% of clock ring)</label>
        <input type="number" id="bce-textscale" min="5" max="40" value="${c.text_scale_percent}">
      </div>
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
        <label>Text colour</label>
        <input type="color" id="bce-textcolor" value="${c.text_color}">
      </div>
      <div class="bce-row">
        <label>Show status bars</label>
        <input type="checkbox" id="bce-showbars" ${c.show_status_bars ? 'checked' : ''}>
      </div>
      <div class="bce-row">
        <label>Show spoken time line</label>
        <input type="checkbox" id="bce-showspoken" ${c.show_spoken_time ? 'checked' : ''}>
      </div>
      <div class="bce-section-title">Status bars</div>
      <div id="bce-bars"></div>
      <button class="bce-add-btn" id="bce-add-bar" type="button">+ Add status bar</button>
    `;

    this._wrap.querySelector('#bce-size').addEventListener('change', (e) => {
      this._config.size_percent = Number(e.target.value) || 70;
      this._emitChange();
    });
    this._wrap.querySelector('#bce-textscale').addEventListener('change', (e) => {
      this._config.text_scale_percent = Number(e.target.value) || 16;
      this._emitChange();
    });
    this._wrap.querySelector('#bce-ringmode').addEventListener('change', (e) => {
      this._config.ring_color_mode = e.target.value;
      this._render();
      this._emitChange();
    });
    const ringColorInput = this._wrap.querySelector('#bce-ringcolor');
    if (ringColorInput) {
      ringColorInput.addEventListener('change', (e) => {
        this._config.ring_color = e.target.value;
        this._emitChange();
      });
    }
    this._wrap.querySelector('#bce-textcolor').addEventListener('change', (e) => {
      this._config.text_color = e.target.value;
      this._emitChange();
    });
    this._wrap.querySelector('#bce-showbars').addEventListener('change', (e) => {
      this._config.show_status_bars = e.target.checked;
      this._emitChange();
    });
    this._wrap.querySelector('#bce-showspoken').addEventListener('change', (e) => {
      this._config.show_spoken_time = e.target.checked;
      this._emitChange();
    });
    this._wrap.querySelector('#bce-add-bar').addEventListener('click', () => {
      this._config.bars = [...this._config.bars, { label: 'NEW STATUS', color: '#ffffff', demo_active: false, entity: '' }];
      this._render();
      this._emitChange();
    });

    const barsEl = this._wrap.querySelector('#bce-bars');
    c.bars.forEach((bar, idx) => {
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
          <input type="text" data-field="entity" placeholder="e.g. binary_sensor.front_door" value="${bar.entity || ''}">
        </div>
        <div class="bce-row">
          <label>Demo active (used if no entity)</label>
          <input type="checkbox" data-field="demo_active" ${bar.demo_active ? 'checked' : ''}>
        </div>
      `;
      block.querySelector('.bce-remove-btn').addEventListener('click', () => {
        this._config.bars = this._config.bars.filter((_, i) => i !== idx);
        this._render();
        this._emitChange();
      });
      block.querySelectorAll('[data-field]').forEach((input) => {
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
