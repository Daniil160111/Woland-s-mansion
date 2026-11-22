// Блоки/settings.js
import { Settings } from '../Фон/settings-manager.js';

const MUSIC_ID   = 'menu_settings_theme';
const MUSIC_PATH = './Звуки/Меню/Настройки.opus';
const DEMO_ID    = 'audio_demo';
const DEMO_PATH  = './Звуки/Эффекты/Звук.wav';
const MUSIC_BASE = 0.32;
const FX_BASE    = 0.8;

const TABS = [
  { id: 'audio',      label: 'Звук' },
  { id: 'brightness', label: 'Яркость' },
  { id: 'graphics',   label: 'Графика' },
  { id: 'system',     label: 'Система' }
];

const UI_FALLBACK = { btn_click: 0.30, btn_select: 0.30, btn_back: 0.35, transition: 0.50, reset: 0.50 };
const SPRING_RELEASE = { k: 300, c: 24 };
const SPRING_DRAG    = { k: 900, c: 50 };
const BRAKE_MS = 80, BRAKE_DAMP = 55;
const STRETCH_DIV = 2200, STRETCH_MAX = 0.42;
const LINE_PAD = 18;
const LINE_THUMB_TOP = 34;
const WALL_Y = 8;
const WALL_DEAD = 50;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const TIPS = {
  masterVol: 'Громкость музыки настроек и всего, кроме звуков эффектов.',
  effectsVol: 'Громкость игровых эффектов: шаги, двери, предметы, демо-звук.',
  audioMode: 'Режим воспроизведения. При смене играет демо-звук в новом режиме.',
  brightness: 'Общая яркость: 0–150 пунктов, нижняя граница задаётся порогом ниже.',
  minBrightness: 'Нижний порог яркости: при 0% основной яркости видно именно его.',
  shadows: 'Качество теней. Выше — реалистичнее, но тяжелее для устройства.',
  realisticLight: 'Качество и реалистичность освещения сцен.',
  render3D: 'Качество 3D-рендеринга объектов и окружения.',
  textureQuality: 'Детализация текстур поверхностей.',
  drawDistance: 'Как далеко видны объекты. Влияет на производительность.',
  resetAll: 'Вернуть все настройки к заводским. Игра перезапустится.',
  clearCache: 'Очистить кэш медиа и кода. Игра перезапустится.'
};

export const SettingsMenu = {
  activeCategory: 'audio',
  hasUnsavedChanges: false,
  currentTab: 'audio',

  _active: false, _uiLockUntil: 0, _musicSource: null, _demoSource: null,
  _musicToken: 0, _musicStartedAt: 0, _musicLoading: null, _musicRetry: false,
  _busTimers: { music: null, effects: null },
  _visHandler: null, _ro: null, _reducedMotion: false, _tip: null,
  _tipHandler: null, _tipHost: null, _dialogOpen: false, _pendingDemo: null,
  _snapshot: null, _canVib: false,
  _liq: new Map(), _liqRaf: null,
  _ph: { x:0, y:0, v:0, vy:0, target:0, yT:0, dragging:false, pop:0, press:0, pressS:0, hold:0,
         pressX:0, brakeUntil:0, rawOver:0, wallY:0, hitX:0,
         vibAcc:0, lastVib:0, touchF:0,
         lastIdx:0, raf:null, lastT:0, centers:[], segW:0, pad:5, downX:0, downY:0, downT:0, moved:false, downIdx:0 },

  _buzz(ms, el) {
    if (this._canVib) { try { navigator.vibrate(ms); } catch (e) {} return; }
    if (el && el.classList) {
      el.classList.remove('hapt'); void el.offsetWidth; el.classList.add('hapt');
      setTimeout(() => el.classList.remove('hapt'), 110);
    }
  },
  _vibMove(st, dt, el) {
    const speed = Math.abs(st.v) + Math.abs(st.vy || 0);
    if (el) el.classList.toggle('mov', !this._canVib && (st.dragging || speed > 60));
    if (!this._canVib) return;
    if (!st.downT && speed < 60) return;
    st.vibAcc = (st.vibAcc || 0) + speed * dt;
    const now = performance.now();
    if (st.vibAcc > 16 && now - (st.lastVib || 0) > 45) {
      try { navigator.vibrate(Math.round(clamp(4 + (st.pressS ?? 0.5) * 6 + speed / 500, 4, 16))); } catch (e) {}
      st.lastVib = now; st.vibAcc = 0;
    }
  },
  _pressFrom(e, st) {
    if (e.pointerType === 'mouse') return 0.5;
    if (e.pressure > 0.01) return clamp((e.pressure - 0.2) / 0.8, 0, 1);
    const f = st?.touchF || 0;
    if (f > 0.01) return clamp(f * 1.4, 0, 1);
    return 0.35;
  },
  _playFree(name) {
    const eng = window.SoundsEngine;
    if (!eng) return;
    eng.play(name, { type: 'effects', dolby: false });
  },

  _snapEq() {
    const a = this._snapshot || {}, b = Settings.current || {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false;
    return true;
  },
  _syncDirty() {
    const dirty = !this._snapEq();
    this.hasUnsavedChanges = dirty;
    document.querySelector('#btn-settings-save')?.classList.toggle('show', dirty);
  },

  // ==================== ВХОД / ВЫХОД ====================
  start() {
    const container = document.getElementById('game-container');
    if (!container) throw new Error('game-container not found');
    Settings.init();
    if (window.SoundsEngine) window.SoundsEngine.init();

    this._active = true;
    this._uiLockUntil = 0;
    this._dialogOpen = false;
    this._musicRetry = false;
    this._canVib = typeof navigator !== 'undefined' && !!navigator.vibrate;
    this._liq.clear();
    this._snapshot = JSON.parse(JSON.stringify(Settings.current));
    this.hasUnsavedChanges = false;
    this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.applyEngineVolumes(0);
    this._renderShell(container);
    this._initPill();
    this._bindWobble(container);
    this._startMusic();
    this._preloadDemo();
    this._bindTooltips(container);

    const layout = container.querySelector('.settings-layout');
    if (!this._reducedMotion && layout.animate) {
      layout.animate([{ opacity: 0, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }],
        { duration: 160, easing: 'cubic-bezier(.32,.72,0,1)' });
    }

    this._visHandler = () => {
      const eng = window.SoundsEngine;
      if (!this._active || !eng || !eng.ctx) return;
      if (document.hidden) { eng.ctx.suspend(); this._sleepPill(); this._sleepLiq(); }
      else { eng.ctx.resume(); this._wakePill(); this._tryMusicRetry(); }
    };
    document.addEventListener('visibilitychange', this._visHandler);
  },

  async leave() {
    this._active = false;
    this._musicToken++;
    this._stopDemo();
    if (!this._snapEq() && this._snapshot) {
      Settings.current = JSON.parse(JSON.stringify(this._snapshot));
      Settings.apply();
    }
    const layout = document.querySelector('.settings-layout');
    const anim = (layout && layout.animate && !this._reducedMotion)
      ? layout.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {})
      : Promise.resolve();
    await Promise.all([anim, this._stopMusic(280)]);
    this._cleanup();
  },

  _cleanup() {
    this._sleepPill(); this._sleepLiq();
    this._unbindTooltips();
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    if (this._visHandler) { document.removeEventListener('visibilitychange', this._visHandler); this._visHandler = null; }
    clearInterval(this._busTimers.music); clearInterval(this._busTimers.effects);
    this._musicSource = null;
  },

  // ==================== МУЗЫКА / ДЕМО ====================
  _ensureMusicBuffer(eng) {
    if (eng.loadedBuffers[MUSIC_ID] || this._musicLoading) return;
    this._musicLoading = (async () => {
      try {
        const res = await fetch(new URL(MUSIC_PATH, document.baseURI).href, { cache: 'force-cache' });
        if (!res.ok) throw new Error(res.status);
        const buf = await eng.ctx.decodeAudioData(await res.arrayBuffer());
        if (!eng.loadedBuffers[MUSIC_ID]) eng.loadedBuffers[MUSIC_ID] = buf;
      } catch (e) {}
      finally { this._musicLoading = null; }
    })();
  },
  async _startMusic() {
    const eng = window.SoundsEngine;
    if (!eng || this._musicSource) return;
    const token = ++this._musicToken;
    this._ensureMusicBuffer(eng);
    for (let i = 0; i < 600 && this._active; i++) {
      if (eng.loadedBuffers[MUSIC_ID]) break;
      await new Promise(r => setTimeout(r, 80));
    }
    if (token !== this._musicToken || !this._active) return;
    if (!eng.loadedBuffers[MUSIC_ID]) { this._musicRetry = true; return; }
    try {
      eng.setDolbyIntensity(100);
      this._musicStartedAt = eng.ctx.currentTime;
      eng.setMasterVolume('music', 0);
      this._musicSource = eng.play(MUSIC_ID, { type: 'music', loop: true, volume: this._musicTrackVolume(), dolby: Settings.current.audioMode === 'dolby' });
      this._fadeBus('music', this._musicBusTarget(), 700);
    } catch (e) { console.warn('[Settings] музыка:', e); }
  },
  _tryMusicRetry() {
    if (this._musicRetry && this._active && !this._musicSource) { this._musicRetry = false; this._startMusic(); }
  },
  _stopDemo() {
    if (this._demoSource && window.SoundsEngine) { try { window.SoundsEngine.stop(this._demoSource); } catch (e) {} }
    this._demoSource = null;
  },
  async _loadDemoBuffer() {
    const eng = window.SoundsEngine;
    if (!eng || eng.loadedBuffers[DEMO_ID]) return true;
    const url = new URL(DEMO_PATH, document.baseURI).href;
    for (const mode of ['default', 'no-store']) {
      try {
        const res = await fetch(url, mode === 'no-store' ? { cache: 'no-store' } : undefined);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const buf = await eng.ctx.decodeAudioData(await res.arrayBuffer());
        if (buf) { eng.loadedBuffers[DEMO_ID] = buf; return true; }
      } catch (e) { console.warn('[Settings] демо fetch (' + mode + '):', e); }
    }
    return false;
  },
  async _preloadDemo() {
    if (await this._loadDemoBuffer()) {
      if (this._pendingDemo) { const m = this._pendingDemo; this._pendingDemo = null; this._playDemoForMode(m); }
    }
  },
  _playDemoForMode(mode) {
    const eng = window.SoundsEngine;
    if (!eng) return;
    if (!eng.loadedBuffers[DEMO_ID]) {
      this._pendingDemo = mode;
      this._loadDemoBuffer().then(ok => {
        const m = this._pendingDemo;
        this._pendingDemo = null;
        if (ok && m) this._playDemoForMode(m);
        else if (!ok) this._playFree('btn_select');
      });
      return;
    }
    this._stopDemo();
    const opts = { type: 'effects', modeOverride: mode, volume: 1 };
    if (mode === 'stereo') opts.channelGains = [0.4, 0.6];
    if (mode === 'dolby')  opts.panSweep = true;
    const src = eng.play(DEMO_ID, opts);
    if (src) {
      this._demoSource = src;
      src.addEventListener('ended', () => { if (this._demoSource === src) this._demoSource = null; });
    }
  },

  // ==================== ЗАМОК ====================
  isLocked() { return performance.now() < this._uiLockUntil; },
  playUI(name) {
    const now = performance.now();
    if (now < this._uiLockUntil) return Promise.resolve(false);
    const eng = window.SoundsEngine;
    let sec = eng?.loadedBuffers?.[name]?.duration ?? UI_FALLBACK[name] ?? 0.30;
    if (name === 'reset') sec = Math.min(sec, 0.5);
    const ms = Math.ceil(sec * 1000) + 40;
    this._uiLockUntil = now + ms;
    const layout = document.querySelector('.settings-layout');
    layout?.classList.add('sound-locked');
    setTimeout(() => { if (!this.isLocked()) document.querySelector('.settings-layout')?.classList.remove('sound-locked'); }, ms);
    if (eng) eng.play(name, { type: 'effects', dolby: false, cutTo: name === 'reset' ? 0.5 : 0 });
    return new Promise(res => setTimeout(() => res(true), ms));
  },

  // ==================== ГРОМКОСТЬ ====================
  _musicBusTarget() { return clamp(Settings.current.masterVolume ?? 100, 0, 150) / 100 * MUSIC_BASE; },
  _fxBusTarget()    { return clamp(Settings.current.effectsVolume ?? 100, 0, 150) / 100 * FX_BASE; },
  _musicTrackVolume() { return MUSIC_BASE * clamp(Settings.current.masterVolume ?? 100, 0, 150) / 100; },
  applyEngineVolumes(ms = 120) {
    this._fadeBus('music', this._musicBusTarget(), ms);
    this._fadeBus('effects', this._fxBusTarget(), ms);
  },
  _fadeBus(bus, to, ms) {
    const eng = window.SoundsEngine;
    if (!eng) return;
    clearInterval(this._busTimers[bus]);
    if (ms <= 0) { eng.setMasterVolume(bus, to); return; }
    const from = eng.volumes[bus] ?? to;
    const t0 = performance.now();
    this._busTimers[bus] = setInterval(() => {
      const k = clamp((performance.now() - t0) / ms, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      eng.setMasterVolume(bus, from + (to - from) * e);
      if (k >= 1) clearInterval(this._busTimers[bus]);
    }, 16);
  },
  async _stopMusic(fadeMs = 280) {
    const eng = window.SoundsEngine;
    this._musicToken++;
    const src = this._musicSource; this._musicSource = null;
    if (!eng || !src) return;
    this._fadeBus('music', 0, fadeMs);
    await new Promise(r => setTimeout(r, fadeMs + 30));
    eng.stop(src);
    eng.setMasterVolume('music', this._musicBusTarget());
  },
  _restartMusicWithMode() {
    const eng = window.SoundsEngine;
    if (!eng || !this._musicSource) return;
    const buf = eng.loadedBuffers[MUSIC_ID];
    const offset = buf ? (eng.ctx.currentTime - this._musicStartedAt) % buf.duration : 0;
    eng.stop(this._musicSource);
    this._musicStartedAt = eng.ctx.currentTime - offset;
    eng.setDolbyIntensity(100);
    this._musicSource = eng.play(MUSIC_ID, { type: 'music', loop: true, volume: this._musicTrackVolume(), offset, dolby: Settings.current.audioMode === 'dolby' });
  },

  // ==================== ВОЛНА: ТОЛЬКО КНОПКИ ====================
  _bindWobble(host) {
    host.addEventListener('pointerdown', (e) => {
      this._tryMusicRetry();
      const el = e.target.closest('.g-btn');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * 100;
      const py = ((e.clientY - r.top) / r.height) * 100;
      const press = e.pointerType === 'mouse' ? 0.5 : clamp(e.pressure || 0.5, 0, 1);
      el.style.transformOrigin = `${px}% ${py}%`;
      el.style.setProperty('--wamp', (0.4 + press * 1.2).toFixed(2));
      el.classList.remove('wob'); void el.offsetWidth; el.classList.add('wob');
      this._buzz(6, el);
    }, true);
  },

  // ==================== ТУЛТИПЫ ====================
  _bindTooltips(host) {
    this._unbindTooltips();
    const handler = (e) => {
      const icon = e.target.closest('.tip-icon');
      if (e.type === 'pointerenter') { if (icon) this._showTip(icon); }
      else if (e.type === 'pointerleave') { if (icon) this._hideTip(); }
      else if (e.type === 'click') {
        if (icon) {
          e.preventDefault(); e.stopPropagation();
          if (this._tip?.classList.contains('show')) this._hideTip(); else this._showTip(icon);
        } else if (this._tip && !this._tip.contains(e.target)) this._hideTip();
      }
    };
    host.addEventListener('pointerenter', handler, true);
    host.addEventListener('pointerleave', handler, true);
    host.addEventListener('click', handler, true);
    this._tipHandler = handler; this._tipHost = host;
  },
  _unbindTooltips() {
    if (this._tipHost && this._tipHandler) {
      this._tipHost.removeEventListener('pointerenter', this._tipHandler, true);
      this._tipHost.removeEventListener('pointerleave', this._tipHandler, true);
      this._tipHost.removeEventListener('click', this._tipHandler, true);
    }
    this._hideTip(); this._tipHandler = null; this._tipHost = null;
  },
  _showTip(icon) {
    const text = icon.closest('[data-tooltip]')?.dataset.tooltip;
    if (!text) return;
    this._hideTip();
    const tip = document.createElement('div');
    tip.className = 'wm-tooltip'; tip.textContent = text;
    document.body.appendChild(tip); this._tip = tip;
    requestAnimationFrame(() => {
      const r = icon.getBoundingClientRect(); const tr = tip.getBoundingClientRect();
      tip.style.left = Math.max(8, Math.min(window.innerWidth - tr.width - 8, r.left + r.width / 2 - tr.width / 2)) + 'px';
      tip.style.top  = Math.max(8, r.top - tr.height - 8) + 'px';
      tip.classList.add('show');
    });
  },
  _hideTip() { if (this._tip) { this._tip.remove(); this._tip = null; } },

  // ==================== КАРКАС ====================
  _renderShell(container) {
    container.innerHTML = `
      <div class="settings-layout">
        <div class="wm-fog" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <svg width="0" height="0" style="position:absolute" aria-hidden="true">
          <filter id="wm-liquid" x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence type="fractalNoise" baseFrequency="0.011 0.026" numOctaves="2" seed="8" result="n"/>
            <feGaussianBlur in="n" stdDeviation="1.1" result="ns"/>
            <feDisplacementMap in="SourceGraphic" in2="ns" scale="22" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </svg>

        <div class="settings-header">
          <button id="btn-settings-back" class="g-btn ghost">‹ Выйти</button>
          <div class="settings-title">Настройки</div>
          <button id="btn-settings-save" class="g-btn primary save-btn ${this.hasUnsavedChanges ? 'show' : ''}">Сохранить</button>
        </div>

        <div class="settings-pages" id="settings-pages"></div>

        <div class="cat-bar-wrap">
          <div class="cat-bar" id="cat-bar" role="tablist" aria-label="Категории настроек">
            <div class="pill" id="cat-pill" aria-hidden="true">
              <div class="pill-lens"></div><span class="pill-press"></span><span class="pill-vspill"></span>
            </div>
            ${TABS.map(t => `
              <button class="cat-btn ${this.currentTab === t.id ? 'active' : ''}" role="tab"
                aria-selected="${this.currentTab === t.id}" tabindex="${this.currentTab === t.id ? 0 : -1}"
                data-cat="${t.id}">${t.label}</button>`).join('')}
          </div>
        </div>

        <style>${this._css()}</style>
      </div>
    `;

    const pages = container.querySelector('#settings-pages');
    pages.innerHTML = '<div class="pages-track" id="pages-track"></div>';
    const track = pages.firstElementChild;
    TABS.forEach((t, i) => {
      const pg = document.createElement('div');
      pg.className = 'settings-page'; pg.dataset.idx = i;
      this._fillPage(pg, t.id);
      track.appendChild(pg);
    });

    container.querySelector('#btn-settings-back').onclick = async () => {
      if (this.isLocked() || this._dialogOpen) return;
      this._syncDirty();
      if (this.hasUnsavedChanges) {
        const r = await this.confirmDialog({
          title: 'Несохранённые изменения',
          text: 'Что сделать с изменениями перед выходом?',
          buttons: [
            { id: 'save',    label: 'Сохранить и выйти', cls: 'primary' },
            { id: 'discard', label: 'Выйти не сохраняя', cls: 'ghost' },
            { id: 'stay',    label: 'Отмена',            cls: 'ghost' }
          ]
        });
        if (r === 'stay') return;
        if (r === 'save') await this.saveSettings();
      }
      if (!(await this.playUI('btn_back'))) return;
      await this.leave();
      const mod = await import('./menu.js');
      if (mod?.Menu) mod.Menu.start('menu');
    };
    container.querySelector('#btn-settings-save').onclick = () => this.saveSettings();

    const bar = container.querySelector('#cat-bar');
    bar.addEventListener('pointerdown', (e) => this._pillDown(e));
    bar.addEventListener('pointermove', (e) => this._pillMove(e));
    bar.addEventListener('pointerup',   (e) => this._pillUp(e));
    bar.addEventListener('pointercancel', () => this._pillCancel());
    this._bindTouchForce(bar, this._ph);
    bar.querySelectorAll('.cat-btn').forEach(btn => {
      btn.onclick = (e) => { if (e.detail === 0) this._tapTo(btn.dataset.cat); };
    });
    bar.addEventListener('keydown', (e) => {
      const idx = TABS.findIndex(t => t.id === this.currentTab);
      let to = null;
      if (e.key === 'ArrowRight') to = clamp(idx + 1, 0, TABS.length - 1);
      if (e.key === 'ArrowLeft')  to = clamp(idx - 1, 0, TABS.length - 1);
      if (e.key === 'Home') to = 0;
      if (e.key === 'End')  to = TABS.length - 1;
      if (to !== null) { e.preventDefault(); bar.querySelectorAll('.cat-btn')[to].focus(); this._tapTo(TABS[to].id); }
    });
  },

  _bindTouchForce(el, st) {
    const read = (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      const f = t.force || t.webkitForce || 0;
      if (f > 0) st.touchF = clamp(f, 0, 1);
    };
    el.addEventListener('touchstart', read, { passive: true });
    el.addEventListener('touchmove', read, { passive: true });
    el.addEventListener('touchend', () => { st.touchF = 0; }, { passive: true });
  },

  _tapTo(cat) {
    const idx = TABS.findIndex(t => t.id === cat);
    if (idx < 0) return;
    const ph = this._ph;
    if (Math.abs(ph.v) > 40) ph.brakeUntil = performance.now() + BRAKE_MS;
    ph.target = ph.centers[idx];
    ph.lastIdx = idx;
    this._wakePill();
    this._commit(idx);
  },
  _commit(idx) {
    const cat = TABS[idx].id;
    if (cat !== this.currentTab) {
      this.currentTab = cat; this.activeCategory = cat;
      this._updateTabsAria();
      this._buzz(10);
    }
  },
  _updateTabsAria() {
    document.querySelectorAll('#cat-bar .cat-btn').forEach(btn => {
      const on = btn.dataset.cat === this.currentTab;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on);
      btn.tabIndex = on ? 0 : -1;
    });
  },
  _pruneLiq() { this._liq.forEach((st, el) => { if (!el.isConnected) this._liq.delete(el); }); },
  _rebuildPage(idx) {
    const track = document.getElementById('pages-track');
    const pg = track?.children[idx];
    if (!pg) return;
    pg.innerHTML = '';
    this._fillPage(pg, TABS[idx].id);
    this._pruneLiq();
  },

  // ==================== КОНТЕНТ ====================
  _fillPage(page, cat) {
    page.setAttribute('role', 'tabpanel');
    if (cat === 'audio')      this._pageAudio(page);
    if (cat === 'brightness') this._pageBrightness(page);
    if (cat === 'graphics')   this._pageGraphics(page);
    if (cat === 'system')     this._pageSystem(page);
  },

  _sliderHTML(id, label, min, max, val, tipKey) {
    return `
      <div class="setting-group glass" ${tipKey ? `data-tooltip="${TIPS[tipKey]}"` : ''}>
        <label><span>${label}: <b id="val-${id}">${val}</b></span>${tipKey ? '<span class="tip-icon" aria-label="Справка">?</span>' : ''}</label>
        <div class="liq-line" id="set-${id}" data-key="${id}" data-cont="1" data-min="${min}" data-max="${max}" data-val="${val}" tabindex="0">
          <span class="liq-track"></span>
          <span class="liq-fill"></span>
          <span class="liq-thumb"><span class="liq-lens"></span><span class="liq-shine"></span><span class="liq-vspill"></span></span>
        </div>
      </div>`;
  },

  _lineHTML(id, label, options, current, tipKey) {
    const idx = Math.max(0, options.findIndex(o => o[0] === current));
    const n = options.length;
    return `
      <div class="setting-group glass" ${tipKey ? `data-tooltip="${TIPS[tipKey]}"` : ''}>
        <label><span>${label}:</span>${tipKey ? '<span class="tip-icon" aria-label="Справка">?</span>' : ''}</label>
        <div class="liq-line" id="set-${id}" data-key="${id}" data-idx="${idx}" tabindex="0">
          <span class="liq-track"></span>
          <span class="liq-fill"></span>
          <span class="liq-thumb"><span class="liq-lens"></span><span class="liq-shine"></span><span class="liq-vspill"></span></span>
          ${options.map(([v, t], i) => `
            <button type="button" class="liq-stop ${i === idx ? 'on' : ''}" data-i="${i}" data-val="${v}"
              style="--t:${n > 1 ? i / (n - 1) : 0.5}" role="radio" aria-checked="${i === idx}">
              <span class="liq-label">${t}</span><span class="liq-dot"></span>
            </button>`).join('')}
        </div>
      </div>`;
  },

  // ==================== ФИЗИКА ШАЙБ: 360° + невидимые стены ====================
  _bindLine(page, id, key, opts = {}) {
    const line = page.querySelector('#set-' + id);
    if (!line) return;
    const stops = [...line.querySelectorAll('.liq-stop')];
    const n = stops.length;
    const cont = line.dataset.cont === '1';
    const st = {
      el: line, n, cont, key,
      cMin: cont ? parseFloat(line.dataset.min) : 0,
      cMax: cont ? parseFloat(line.dataset.max) : 150,
      idx: parseInt(line.dataset.idx, 10) || 0,
      x: 0, v: 0, target: 0, y: 0, vy: 0, yT: 0,
      dragging: false, grab: false, brakeUntil: 0,
      press: 0, pressS: 0, hold: 0, pressX: 0,
      downT: 0, downX: 0, downY: 0, moved: false, pop: 0, lastStop: -1,
      rawOver: 0, wallY: 0, hitX: 0,
      vibAcc: 0, lastVib: 0, touchF: 0, touched: false,
      startVal: null, changed: false, lastV: null,
      min: 0, max: 0, pos: [], width: 0, measured: false,
      onLive: opts.onLive, onRelease: opts.onRelease
    };
    this._liq.set(line, st);
    const measure = () => {
      const r = line.getBoundingClientRect();
      st.min = LINE_PAD; st.max = r.width - LINE_PAD; st.width = r.width;
      if (!cont) st.pos = stops.map((_, i) => st.min + (st.max - st.min) * (n > 1 ? i / (n - 1) : 0.5));
      if (!st.measured) {
        if (cont) {
          const v0 = parseFloat(line.dataset.val) || st.cMin;
          st.lastV = v0;
          st.x = st.target = st.min + (st.max - st.min) * ((v0 - st.cMin) / ((st.cMax - st.cMin) || 1));
        } else st.x = st.target = st.pos[st.idx];
        st.measured = true;
      }
    };
    st.measure = measure;
    measure();
    this._bindTouchForce(line, st);

    line.addEventListener('pointerdown', (e) => {
      if (!this._active) return;
      this._tryMusicRetry();
      line.setPointerCapture(e.pointerId);
      const r = line.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      measure();
      st.touched = true;
      st.downT = performance.now(); st.downX = x; st.downY = y; st.moved = false; st.changed = false;
      st.press = this._pressFrom(e, st); st.pressX = x;
      st.startVal = cont ? st.lastV : st.idx;
      st.grab = Math.abs(x - st.x) < 30 && Math.abs(y - LINE_THUMB_TOP) < 30;
      if (Math.abs(st.v) > 40) st.brakeUntil = performance.now() + BRAKE_MS;
      if (!st.grab) {
        if (cont) st.target = clamp(x, st.min, st.max);
        else {
          const i = clamp(Math.round((x - st.min) / ((st.max - st.min) / (n - 1 || 1))), 0, n - 1);
          st.target = st.pos[i];
          this._liqCommit(st, i);
        }
      }
      this._wakeLiq();
    });
    line.addEventListener('pointermove', (e) => {
      if (!st.downT) return;
      const r = line.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      st.press = this._pressFrom(e, st); st.pressX = x;
      if (!st.moved && (Math.abs(x - st.downX) > 6 || Math.abs(y - st.downY) > 6)) st.moved = true;
      if (!st.moved || !st.grab) return;
      st.dragging = true; st.brakeUntil = 0;
      st.target = clamp(x, st.min, st.max);
      st.rawOver = Math.max(0, x - st.max, st.min - x);
      const dy = y - st.downY;
      st.yT = clamp(dy * 0.12, -WALL_Y, WALL_Y);
      st.wallY = Math.max(0, Math.abs(dy) - WALL_DEAD);
      if (!cont) {
        const i = clamp(Math.round((st.target - st.min) / ((st.max - st.min) / (n - 1 || 1))), 0, n - 1);
        if (st.lastStop === -1) st.lastStop = i;
        if (i !== st.lastStop) { st.lastStop = i; st.pop = 1; }
      }
      this._wakeLiq();
    });
    const up = (e) => {
      if (!st.downT) return;
      const wasDrag = st.moved && st.grab;
      st.downT = 0; st.dragging = false; st.lastStop = -1;
      st.rawOver = 0; st.wallY = 0; st.yT = 0;
      try { line.releasePointerCapture(e.pointerId); } catch (_) {}
      if (wasDrag) {
        if (cont) st.target = clamp(st.x, st.min, st.max);
        else {
          const i = clamp(Math.round((st.x - st.min) / ((st.max - st.min) / (n - 1 || 1))), 0, n - 1);
          st.target = st.pos[i];
          this._liqCommit(st, i);
        }
        this._wakeLiq();
      }
      this._liqRelease(st);
    };
    line.addEventListener('pointerup', up);
    line.addEventListener('pointercancel', up);
    stops.forEach((btn, i) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        if (this.isLocked() && st.key !== 'audioMode') return;
        st.touched = true;
        if (Math.abs(st.v) > 40) st.brakeUntil = performance.now() + BRAKE_MS;
        st.target = st.pos[i];
        this._wakeLiq();
        this._liqCommit(st, i);
        this._liqRelease(st);
      };
    });
    line.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 1;
      let handled = true;
      st.touched = true;
      if (cont) {
        const px = (st.max - st.min) / ((st.cMax - st.cMin) || 1) * step;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') st.target = clamp(st.target + px, st.min, st.max);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') st.target = clamp(st.target - px, st.min, st.max);
        else handled = false;
        if (handled) { st.changed = true; this._wakeLiq(); this._liqRelease(st); }
      } else {
        let i = st.idx;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') i = clamp(i + 1, 0, n - 1);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') i = clamp(i - 1, 0, n - 1);
        else handled = false;
        if (handled) { st.target = st.pos[i]; this._wakeLiq(); this._liqCommit(st, i); this._liqRelease(st); }
      }
      if (handled) e.preventDefault();
    });
    this._renderLiq(st);
  },

  _liqCommit(st, i) {
    const val = st.el.querySelectorAll('.liq-stop')[i]?.dataset.val;
    if (!val) return;
    st.el.querySelectorAll('.liq-stop').forEach((b, j) => {
      b.classList.toggle('on', j === i); b.setAttribute('aria-checked', j === i);
    });
    if (st.idx !== i) { st.idx = i; st.changed = true; }
  },

  _liqRelease(st) {
    const thumb = st.el.querySelector('.liq-thumb');
    if (st.key === 'audioMode') {
      const val = st.el.querySelectorAll('.liq-stop')[st.idx]?.dataset.val;
      if (!val) return;
      this._playDemoForMode(val);
      this._buzz(this._canVib ? [10, 30, 14] : 10, thumb);
      if (st.changed && Settings.current[st.key] !== val) {
        Settings.set(st.key, val);
        this._syncDirty();
        if (st.onRelease) st.onRelease(val);
      }
      st.changed = false;
      return;
    }
    if (!st.changed) return;
    if (!st.cont) {
      const val = st.el.querySelectorAll('.liq-stop')[st.idx]?.dataset.val;
      if (val && Settings.current[st.key] !== val) {
        Settings.set(st.key, val);
        this._syncDirty();
        if (st.onRelease) st.onRelease(val);
      }
    } else this._syncDirty();
    this._playFree('btn_select');
    this._buzz(this._canVib ? [8, 24, 10] : 8, thumb);
    st.changed = false;
  },

  _wakeLiq() {
    if (this._liqRaf !== null || !this._active) return;
    let last = performance.now();
    const tick = (t) => {
      this._liqRaf = null;
      if (!this._active) return;
      const dt = clamp((t - last) / 1000, 0, 1 / 30);
      last = t;
      let any = false;
      this._liq.forEach(st => {
        if (!st.el.isConnected) return;
        const braking = !st.dragging && t < st.brakeUntil;
        const s = st.dragging ? SPRING_DRAG : SPRING_RELEASE;
        const nn = Math.max(1, Math.ceil(dt / (1 / 120)));
        const h = dt / nn;
        for (let i = 0; i < nn; i++) {
          const a  = braking ? -BRAKE_DAMP * st.v  : s.k * (st.target - st.x) - s.c * st.v;
          const ay = braking ? -BRAKE_DAMP * st.vy : s.k * ((st.yT || 0) - st.y) - s.c * st.vy;
          st.v += a * h;  st.x += st.v * h;
          st.vy += ay * h; st.y += st.vy * h;
        }
        const atWallX = (st.x <= st.min + 0.5 && st.v < 0) || (st.x >= st.max - 0.5 && st.v > 0);
        st.hitX = Math.max(st.hitX * Math.exp(-6 * dt), atWallX ? Math.abs(st.v) / 900 : 0);
        st.x = clamp(st.x, st.min, st.max);
        st.pop *= Math.exp(-7 * dt);
        st.pressS += (st.press - (st.pressS || 0)) * Math.min(1, dt * 12);
        st.hold   += ((st.downT ? 1 : 0) - (st.hold || 0)) * Math.min(1, dt * 10);
        this._vibMove(st, dt, st.el.querySelector('.liq-thumb'));
        this._renderLiq(st);
        if (st.dragging || Math.abs(st.v) > 1 || Math.abs(st.vy) > 1 || Math.abs(st.target - st.x) > 0.25 ||
            Math.abs(st.y) > 0.2 || st.downT || st.hold > 0.02 || st.hitX > 0.02) any = true;
      });
      if (any) this._liqRaf = requestAnimationFrame(tick);
    };
    this._liqRaf = requestAnimationFrame(tick);
  },
  _sleepLiq() { if (this._liqRaf !== null) { cancelAnimationFrame(this._liqRaf); this._liqRaf = null; } },

  _renderLiq(st) {
    const thumb = st.el.querySelector('.liq-thumb');
    const fill = st.el.querySelector('.liq-fill');
    if (!thumb) return;
    const sqX = Math.min((st.rawOver || 0) / 55 + (st.hitX || 0), 0.45);
    const sqY = Math.min((st.wallY || 0) / 90 + Math.abs(st.y || 0) / WALL_Y * 0.12, 0.4);
    const s = this._reducedMotion ? 0 : Math.min(Math.abs(st.v) / STRETCH_DIV, STRETCH_MAX);
    const bulge = (st.hold || 0) * (0.10 + (st.pressS || 0) * 0.22);
    const sx = 1 + s + bulge + sqY * 0.6 - sqX * 0.45 - st.pop * 0.05;
    const sy = 1 - s * 0.5 + bulge * 0.8 + sqX * 0.6 - sqY * 0.45 + st.pop * 0.14;
    const skew = this._reducedMotion ? 0 : clamp(-st.v / 160, -9, 9);
    thumb.style.left = st.x + 'px';
    thumb.style.top  = (LINE_THUMB_TOP + (st.y || 0)) + 'px';
    thumb.style.transform = `translate(-50%,-50%) skewX(${skew}deg) scale(${sx},${sy})`;
    thumb.style.setProperty('--pressx', (st.pressX - st.x + 14) + 'px');
    thumb.style.setProperty('--pressop', ((st.downT ? 1 : 0) * (st.pressS || 0)).toFixed(2));
    thumb.style.setProperty('--spill', sqX.toFixed(2));
    thumb.style.setProperty('--spilldir', (st.rawOver && st.x >= st.max - 0.5) ? 1 : (st.rawOver ? -1 : (st.hitX ? (st.v > 0 ? 1 : -1) : 0)));
    thumb.style.setProperty('--spilly', sqY.toFixed(2));
    thumb.style.setProperty('--spilldiry', (st.y || 0) < 0 ? -1 : 1);
    if (fill) fill.style.width = Math.max(0, st.x - st.min) + 'px';
    if (st.cont) {
      const v = Math.round(st.cMin + (st.x - st.min) / ((st.max - st.min) || 1) * (st.cMax - st.cMin));
      if (v !== st.lastV) {
        st.lastV = v;
        const lab = document.getElementById('val-' + st.key);
        if (lab) lab.textContent = v;
        if (st.touched) {
          if (v !== st.startVal) st.changed = true;
          if (st.onLive) st.onLive(v);
          this._syncDirty();
        }
      }
    }
  },

  // ==================== СТРАНИЦЫ ====================
  _pageAudio(page) {
    const c = Settings.current;
    page.innerHTML = `
      ${this._lineHTML('audioMode', 'Режим звука', [['mono','Моно'],['stereo','Стерео'],['dolby','Dolby Vertical']], c.audioMode, 'audioMode')}
      ${this._sliderHTML('masterVol', 'Общая громкость', 0, 150, c.masterVolume, 'masterVol')}
      ${this._sliderHTML('effectsVol', 'Громкость эффектов', 0, 150, c.effectsVolume, 'effectsVol')}
      <button id="btn-recommended" class="g-btn ghost wide">Рекомендуемые значения</button>
    `;
    this._bindLine(page, 'audioMode', 'audioMode', { onRelease: () => this._restartMusicWithMode() });
    this._bindLine(page, 'masterVol', 'masterVolume', { onLive: (v) => { Settings.set('masterVolume', v); this._fadeBus('music', this._musicBusTarget(), 60); } });
    this._bindLine(page, 'effectsVol', 'effectsVolume', { onLive: (v) => { Settings.set('effectsVolume', v); this._fadeBus('effects', this._fxBusTarget(), 60); } });
    this._bindRecommended(page, 'audio', 'Сброс звука', 'Вернуть рекомендуемые настройки звука?');
  },

  _pageBrightness(page) {
    const c = Settings.current;
    page.innerHTML = `
      ${this._sliderHTML('brightness', 'Яркость', 0, 150, c.brightness, 'brightness')}
      ${this._sliderHTML('minBrightness', 'Минимальная яркость', 0, 50, c.minBrightness, 'minBrightness')}
      <button id="btn-recommended" class="g-btn ghost wide">Рекомендуемые значения</button>
    `;
    this._bindLine(page, 'brightness', 'brightness', { onLive: (v) => Settings.set('brightness', v) });
    this._bindLine(page, 'minBrightness', 'minBrightness', { onLive: (v) => Settings.set('minBrightness', v) });
    this._bindRecommended(page, 'brightness', 'Сброс яркости', 'Вернуть рекомендуемые настройки яркости?');
  },

  _pageGraphics(page) {
    const defs = [
      { id: 'shadows',        label: 'Тени',                 tip: 'shadows',        options: [['ultra','Ультра'],['high','Высокие'],['medium','Средние'],['low','Низкие'],['simple','Простые'],['off','Выкл']] },
      { id: 'realisticLight', label: 'Реалистичный свет',    tip: 'realisticLight', options: [['ultra','Ультра'],['high','Высокий'],['medium','Средний'],['low','Низкий']] },
      { id: 'render3D',       label: '3D-рендер',            tip: 'render3D',       options: [['no_distortion','Без искажений'],['ultra','Ультра'],['high','Высокий'],['medium','Средний'],['low','Низкий']] },
      { id: 'textureQuality', label: 'Качество текстур',     tip: 'textureQuality', options: [['ultra','Ультра'],['high','Высокий'],['medium','Средний'],['low','Низкий']] },
      { id: 'drawDistance',   label: 'Дальность прорисовки', tip: 'drawDistance',   options: [['no_simplification','Без упрощений'],['far','Дальний'],['near','Недалёкий'],['close','Ближний']] }
    ];
    page.innerHTML = defs.map(d => this._lineHTML(d.id, d.label, d.options, Settings.current[d.id], d.tip)).join('') +
      `<button id="btn-recommended" class="g-btn ghost wide">Рекомендуемые значения</button>`;
    defs.forEach(d => this._bindLine(page, d.id, d.id));
    this._bindRecommended(page, 'graphics', 'Сброс графики', 'Вернуть рекомендуемые настройки графики?');
  },

  _bindRecommended(page, category, title, text) {
    page.querySelector('#btn-recommended').onclick = async () => {
      if (this.isLocked() || this._dialogOpen) return;
      const ok = await this.confirmDialog({ title, text, okText: 'Сбросить', cancelText: 'Отмена' });
      if (!ok) return;
      if (!(await this.playUI('reset'))) return;
      Settings.resetCategory(category);
      if (category === 'audio') { this.applyEngineVolumes(150); this._restartMusicWithMode(); }
      TABS.forEach((t, i) => this._rebuildPage(i));
      this._syncDirty();
    };
  },

  _pageSystem(page) {
    page.innerHTML = `
      <div class="system-actions">
        <button id="btn-reset-settings" class="g-btn danger wide" data-tooltip="${TIPS.resetAll}">
          <span class="tip-icon btn-tip" aria-label="Справка">?</span>Сбросить все настройки
        </button>
        <button id="btn-clear-cache" class="g-btn danger wide" data-tooltip="${TIPS.clearCache}">
          <span class="tip-icon btn-tip" aria-label="Справка">?</span>Сбросить кэш медиа и кода
        </button>
      </div>
    `;
    page.querySelector('#btn-reset-settings').onclick = async () => {
      if (this.isLocked() || this._dialogOpen) return;
      const ok = await this.confirmDialog({
        title: 'Сброс всех настроек', text: 'Вернуть ВСЕ настройки к заводским? Игра перезапустится.',
        okText: 'Сбросить всё', cancelText: 'Отмена', danger: true
      });
      if (!ok) return;
      await this.playUI('reset');
      Settings.reset();
      this._snapshot = JSON.parse(JSON.stringify(Settings.current));
      this._syncDirty();
      setTimeout(() => location.reload(), 500);
    };
    page.querySelector('#btn-clear-cache').onclick = async () => {
      if (this.isLocked() || this._dialogOpen) return;
      const ok = await this.confirmDialog({
        title: 'Очистка кэша', text: 'Очистить кэш медиа и кода? Игра перезапустится.',
        okText: 'Очистить', cancelText: 'Отмена', danger: true
      });
      if (!ok) return;
      await this.playUI('reset');
      await this._stopMusic(200);
      this._cleanup();
      const reload = () => { localStorage.removeItem('woland_version'); location.reload(); };
      setTimeout(reload, 1500);
      try {
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        const reg = await navigator.serviceWorker?.getRegistration();
        await reg?.update?.();
      } catch (e) { console.warn('[Settings] purge caches:', e); }
      try {
        const req = indexedDB.deleteDatabase('woland_db');
        req.onsuccess = req.onerror = req.onblocked = reload;
      } catch (e) { console.warn(e); reload(); }
    };
  },

  // ==================== СОХРАНЕНИЕ / МОДАЛКА ====================
  markChanged() { this._syncDirty(); },
  async saveSettings() {
    if (!(await this.playUI('transition'))) return;
    Settings.save();
    this._snapshot = JSON.parse(JSON.stringify(Settings.current));
    this._syncDirty();
    this._buzz(this._canVib ? [12, 30, 18] : 14);
  },

  confirmDialog({ title = 'Подтверждение', text = '', okText = 'Да', cancelText = 'Нет', danger = false, buttons = null } = {}) {
    if (this._dialogOpen) return Promise.resolve(false);
    this._dialogOpen = true;
    this._buzz(10);
    const btns = buttons || [
      { id: false, label: cancelText, cls: 'ghost' },
      { id: true,  label: okText,     cls: danger ? 'danger' : 'primary' }
    ];
    const enterId = buttons ? buttons[0].id : true;
    return new Promise(resolve => {
      const host = document.querySelector('.settings-layout') || document.body;
      const overlay = document.createElement('div');
      overlay.className = 'wm-overlay';
      overlay.innerHTML = `
        <div class="wm-dialog glass" role="alertdialog" aria-modal="true" aria-label="${title}">
          <div class="wm-dialog-title">${title}</div>
          <div class="wm-dialog-text">${text}</div>
          <div class="wm-dialog-buttons ${btns.length > 2 ? 'col' : ''}">
            ${btns.map((b, i) => `<button type="button" data-i="${i}" class="g-btn ${b.cls} wm-b">${b.label}</button>`).join('')}
          </div>
        </div>`;
      host.appendChild(overlay);
      requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));
      let closing = false;
      const done = (v) => { this._dialogOpen = false; resolve(v); };
      const close = async (result, sound) => {
        if (closing) return;
        closing = true;
        document.removeEventListener('keydown', onKey);
        const waitMs = this._uiLockUntil - performance.now();
        if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
        await this.playUI(sound);
        overlay.classList.remove('show');
        setTimeout(() => { overlay.remove(); done(result); }, 120);
      };
      const onKey = (e) => {
        if (!overlay.isConnected) { document.removeEventListener('keydown', onKey); return; }
        if (e.key === 'Escape') { e.preventDefault(); close(btns.length > 2 ? 'stay' : false, 'btn_back'); }
        if (e.key === 'Enter')  { e.preventDefault(); close(enterId, 'btn_select'); }
        if (e.key === 'Tab') {
          e.preventDefault();
          const all = [...overlay.querySelectorAll('.wm-b')];
          const i = all.indexOf(document.activeElement);
          all[(i + 1) % all.length].focus();
        }
      };
      document.addEventListener('keydown', onKey);
      overlay.querySelectorAll('.wm-b').forEach(b => {
        b.onclick = () => {
          const def = btns[parseInt(b.dataset.i, 10)];
          close(def.id, (def.id === 'discard' || def.id === false) ? 'btn_back' : 'btn_select');
        };
      });
      overlay.onclick = (e) => { if (e.target === overlay) close(btns.length > 2 ? 'stay' : false, 'btn_back'); };
      overlay.querySelector('.wm-b').focus();
    });
  },

  // ==================== КАПЛЯ КАТЕГОРИЙ ====================
  _initPill() {
    const bar = document.getElementById('cat-bar');
    this._measurePill();
    const idx = TABS.findIndex(t => t.id === this.currentTab);
    this._ph.x = this._ph.target = this._ph.centers[idx];
    this._ph.lastIdx = idx;
    this._renderPill();
    const onResize = () => {
      this._measurePill();
      const i = TABS.findIndex(t => t.id === this.currentTab);
      this._ph.x = this._ph.target = this._ph.centers[i];
      this._ph.v = 0;
      this._renderPill();
      this._liq.forEach(st => {
        if (!st.el.isConnected) return;
        st.measured = false; st.measure();
        if (!st.cont) st.x = st.target = st.pos[st.idx];
        else st.x = st.target = st.min + (st.max - st.min) * (((st.lastV ?? st.cMin) - st.cMin) / ((st.cMax - st.cMin) || 1));
        this._renderLiq(st);
      });
    };
    if ('ResizeObserver' in window) { this._ro = new ResizeObserver(onResize); this._ro.observe(bar); }
    else window.addEventListener('resize', onResize);
  },
  _measurePill() {
    const bar = document.getElementById('cat-bar');
    const pill = document.getElementById('cat-pill');
    if (!bar || !pill) return;
    const r = bar.getBoundingClientRect();
    const pad = this._ph.pad;
    this._ph.segW = (r.width - pad * 2) / TABS.length;
    this._ph.centers = TABS.map((_, i) => pad + this._ph.segW * (i + 0.5));
    pill.style.width  = (this._ph.segW - 8) + 'px';
    pill.style.height = (r.height - 10) + 'px';
  },
  _pillDown(e) {
    if (!this._active) return;
    this._tryMusicRetry();
    const bar = document.getElementById('cat-bar');
    bar.setPointerCapture(e.pointerId);
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const ph = this._ph;
    ph.dragging = false; ph.moved = false;
    ph.downX = x; ph.downY = y; ph.downT = performance.now();
    ph.downIdx = clamp(Math.floor((x - ph.pad) / ph.segW), 0, TABS.length - 1);
    ph.press = this._pressFrom(e, ph); ph.pressX = x;
    if (Math.abs(ph.v) > 40) ph.brakeUntil = performance.now() + BRAKE_MS;
    ph.target = ph.centers[ph.downIdx];
    ph.lastIdx = ph.downIdx;
    this._wakePill();
  },
  _pillMove(e) {
    const ph = this._ph;
    if (ph.downT === 0) return;
    const bar = document.getElementById('cat-bar');
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    ph.press = this._pressFrom(e, ph); ph.pressX = x;
    if (!ph.moved && (Math.abs(x - ph.downX) > 8 || Math.abs(y - ph.downY) > 8)) ph.moved = true;
    if (!ph.moved) return;
    ph.dragging = true; ph.brakeUntil = 0;
    ph.target = clamp(x, ph.centers[0], ph.centers[TABS.length - 1]);
    ph.rawOver = Math.max(0, x - ph.centers[TABS.length - 1], ph.centers[0] - x);
    const dy = y - ph.downY;
    ph.yT = clamp(dy * 0.12, -WALL_Y, WALL_Y);
    ph.wallY = Math.max(0, Math.abs(dy) - WALL_DEAD);
    this._wakePill();
  },
  _pillUp(e) {
    const ph = this._ph;
    if (ph.downT === 0) return;
    const wasDrag = ph.moved;
    const downIdx = ph.downIdx;
    ph.downT = 0; ph.dragging = false;
    ph.rawOver = 0; ph.wallY = 0; ph.yT = 0;
    try { document.getElementById('cat-bar').releasePointerCapture(e.pointerId); } catch (_) {}
    if (!wasDrag) { this._commit(downIdx); return; }
    const idx = clamp(Math.round((ph.x - ph.pad) / ph.segW - 0.5), 0, TABS.length - 1);
    ph.target = ph.centers[idx];
    this._wakePill();
    this._commit(idx);
  },
  _pillCancel() {
    const ph = this._ph;
    ph.downT = 0; ph.dragging = false; ph.rawOver = 0; ph.wallY = 0; ph.yT = 0;
    const i = TABS.findIndex(t => t.id === this.currentTab);
    ph.target = ph.centers[i];
    this._wakePill();
  },
  _wakePill() {
    const ph = this._ph;
    if (ph.raf !== null || !this._active) return;
    ph.lastT = performance.now();
    const frame = (t) => {
      ph.raf = null;
      if (!this._active) return;
      const dt = clamp((t - ph.lastT) / 1000, 0, 1 / 30);
      ph.lastT = t;
      const braking = !ph.dragging && t < ph.brakeUntil;
      const s = ph.dragging ? SPRING_DRAG : SPRING_RELEASE;
      const n = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        const a  = braking ? -BRAKE_DAMP * ph.v  : s.k * (ph.target - ph.x) - s.c * ph.v;
        const ay = braking ? -BRAKE_DAMP * ph.vy : s.k * ((ph.yT || 0) - ph.y) - s.c * ph.vy;
        ph.v += a * h;  ph.x += ph.v * h;
        ph.vy += ay * h; ph.y += ph.vy * h;
      }
      const c0 = ph.centers[0], cN = ph.centers[TABS.length - 1];
      const atWallX = (ph.x <= c0 + 0.5 && ph.v < 0) || (ph.x >= cN - 0.5 && ph.v > 0);
      ph.hitX = Math.max((ph.hitX || 0) * Math.exp(-6 * dt), atWallX ? Math.abs(ph.v) / 900 : 0);
      ph.pop *= Math.exp(-7 * dt);
      ph.pressS += (ph.press - (ph.pressS || 0)) * Math.min(1, dt * 12);
      ph.hold   += ((ph.downT ? 1 : 0) - (ph.hold || 0)) * Math.min(1, dt * 10);
      this._vibMove(ph, dt, document.getElementById('cat-pill'));
      this._renderPill();
      if (!ph.dragging && Math.abs(ph.v) < 1 && Math.abs(ph.vy) < 1 && Math.abs(ph.target - ph.x) < 0.25 &&
          Math.abs(ph.y) < 0.2 && !ph.downT && ph.hold < 0.02 && (ph.hitX || 0) < 0.02) {
        ph.x = ph.target; ph.v = 0; ph.y = 0; ph.vy = 0; this._renderPill(); return;
      }
      ph.raf = requestAnimationFrame(frame);
    };
    ph.raf = requestAnimationFrame(frame);
  },
  _sleepPill() { if (this._ph.raf !== null) { cancelAnimationFrame(this._ph.raf); this._ph.raf = null; } },
  _renderPill() {
    const pill = document.getElementById('cat-pill');
    const track = document.getElementById('pages-track');
    if (!pill) return;
    const ph = this._ph;
    const c0 = ph.centers[0], cN = ph.centers[TABS.length - 1];
    const sqX = Math.min((ph.rawOver || 0) / 60 + (ph.hitX || 0), 0.45);
    const sqY = Math.min((ph.wallY || 0) / 90 + Math.abs(ph.y || 0) / WALL_Y * 0.12, 0.4);
    let sx = 1, sy = 1, skew = 0;
    if (!this._reducedMotion) {
      const s = Math.min(Math.abs(ph.v) / STRETCH_DIV, STRETCH_MAX);
      const bulge = (ph.hold || 0) * (0.10 + (ph.pressS || 0) * 0.22);
      sx = 1 + s - ph.pop * 0.05 + bulge + sqY * 0.6 - sqX * 0.45;
      sy = 1 - s * 0.55 + ph.pop * 0.14 + bulge * 0.8 + sqX * 0.6 - sqY * 0.45;
      skew = clamp(-ph.v / 160, -9, 9);
    } else { ph.x = ph.target; ph.v = 0; ph.y = 0; }
    pill.style.transform = `translate3d(${ph.x}px, ${ph.y || 0}px, 0) translate(-50%,-50%) skewX(${skew}deg) scale(${sx},${sy})`;
    pill.style.setProperty('--pressx', (ph.pressX - ph.x + pill.offsetWidth * sx / 2) + 'px');
    pill.style.setProperty('--pressop', ((ph.downT ? 1 : 0) * (ph.pressS || 0)).toFixed(2));
    pill.style.setProperty('--spill', sqX.toFixed(2));
    pill.style.setProperty('--spilldir', (ph.rawOver && ph.x >= cN - 0.5) ? 1 : (ph.rawOver ? -1 : (ph.hitX ? (ph.v > 0 ? 1 : -1) : 0)));
    pill.style.setProperty('--spilly', sqY.toFixed(2));
    pill.style.setProperty('--spilldiry', (ph.y || 0) < 0 ? -1 : 1);
    if (track) {
      const f = clamp((ph.x - c0) / ph.segW, -0.22, TABS.length - 1 + 0.22);
      track.style.transform = `translate3d(${-f * 25}%,0,0)`;
    }
  },

  // ==================== СТИЛИ ====================
  _css() { return `
    .settings-layout {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      background: #050308; color: #fff; overflow: hidden;
    }
    .wm-fog { position: absolute; inset: -20%; pointer-events: none; opacity: .9; z-index: 0; }
    .wm-fog i { position: absolute; display: block; border-radius: 50%; will-change: transform, opacity; }
    .wm-fog i:nth-child(1) { width: 62%; height: 58%; left: -2%; top: 2%;
      background: radial-gradient(closest-side, rgba(30,64,168,.5), rgba(30,64,168,.2) 45%, transparent 74%);
      animation: fog1 26s ease-in-out infinite alternate; }
    .wm-fog i:nth-child(2) { width: 56%; height: 52%; right: -2%; top: 26%;
      background: radial-gradient(closest-side, rgba(12,22,74,.55), rgba(12,22,74,.22) 45%, transparent 74%);
      animation: fog2 31s ease-in-out infinite alternate; }
    .wm-fog i:nth-child(3) { width: 70%; height: 58%; left: 8%; bottom: -8%;
      background: radial-gradient(closest-side, rgba(84,32,148,.44), rgba(84,32,148,.18) 45%, transparent 74%);
      animation: fog3 23s ease-in-out infinite alternate; }
    .wm-fog i:nth-child(4) { width: 46%; height: 46%; left: 36%; top: 34%;
      background: radial-gradient(closest-side, rgba(20,12,46,.6), rgba(20,12,46,.25) 45%, transparent 74%);
      animation: fog4 19s ease-in-out infinite alternate; }
    @keyframes fog1 { 0% { opacity:.75; } 50% { opacity:.95; } 100% { transform: translate3d(6%,4%,0) scale(1.12); opacity:.8; } }
    @keyframes fog2 { 0% { opacity:.85; } 50% { opacity:.65; } 100% { transform: translate3d(-7%,5%,0) scale(1.08); opacity:.9; } }
    @keyframes fog3 { 0% { opacity:.7; } 50% { opacity:.95; } 100% { transform: translate3d(4%,-5%,0) scale(1.15); opacity:.75; } }
    @keyframes fog4 { 0% { opacity:.55; } 50% { opacity:.85; } 100% { transform: translate3d(-5%,6%,0) scale(1.1); opacity:.6; } }
    .settings-layout::after {
      content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .05; z-index: 0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    .settings-layout > *:not(.wm-fog):not(.wm-overlay) { position: relative; z-index: 1; }

    .glass, .g-btn, .cat-bar, .pill, .liq-thumb, .wm-dialog, .liq-track {
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.16);
      -webkit-backdrop-filter: blur(18px) saturate(1.6) brightness(1.06);
      backdrop-filter: blur(18px) saturate(1.6) brightness(1.06);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.22), inset 0 -1px 0 rgba(255,255,255,.06), 0 10px 30px rgba(0,0,0,.45);
    }
    @supports not ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {
      .glass, .g-btn, .cat-bar, .pill, .liq-thumb, .wm-dialog, .liq-track { background: rgba(30,24,42,.78); }
    }

    .wob { animation: wm-wob .45s cubic-bezier(.36,.07,.19,.97); }
    @keyframes wm-wob {
      0%   { transform: scale(1,1); }
      18%  { transform: scale(calc(1 + .05*var(--wamp,1)), calc(1 - .045*var(--wamp,1))) rotate(calc(.5deg*var(--wamp,1))); }
      42%  { transform: scale(calc(1 - .03*var(--wamp,1)), calc(1 + .028*var(--wamp,1))); }
      68%  { transform: scale(calc(1 + .015*var(--wamp,1)), calc(1 - .013*var(--wamp,1))); }
      100% { transform: none; }
    }
    .hapt { animation: wm-hapt .1s ease; }
    @keyframes wm-hapt { 30% { transform: scale(1.07); } 60% { transform: scale(.97); } 100% { transform: scale(1); } }
    .liq-thumb.mov, .pill.mov { filter: brightness(1.14); }

    .settings-header { display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 10px 14px; padding-top: calc(10px + env(safe-area-inset-top)); }
    .settings-title { font-size: 16px; font-weight: 700; letter-spacing: .3px; opacity: .92; }

    .g-btn { position: relative; padding: 9px 18px; font-size: 15px; color: #fff; cursor: pointer;
      border-radius: 999px; overflow: hidden;
      transition: transform .1s cubic-bezier(.34,1.56,.64,1), background .12s ease, border-color .12s ease, opacity .12s ease; }
    .g-btn::before { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
      background: linear-gradient(180deg, rgba(255,255,255,.25), transparent 45%); }
    .g-btn:hover { background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.35); }
    .g-btn:active { transform: scale(.94); }
    .g-btn.primary { background: rgba(255,20,20,.22); border-color: rgba(255,70,70,.55); }
    .g-btn.danger { background: rgba(120,0,0,.45); border-color: rgba(255,0,0,.6); }
    .g-btn.wide { width: 80%; padding: 10px 32px 10px 12px; text-align: left; font-size: 13px; }

    .save-btn {
      opacity: .35; pointer-events: none; filter: saturate(.35) brightness(.8);
      transition: opacity .25s ease, filter .25s ease, background .25s ease,
                  border-color .25s ease, box-shadow .25s ease, transform .25s ease;
    }
    .save-btn.show {
      opacity: 1; pointer-events: auto; filter: none;
      background: rgba(255,20,20,.28); border-color: rgba(255,80,80,.75);
      box-shadow: 0 0 18px rgba(255,0,0,.28), inset 0 1px 0 rgba(255,255,255,.25);
    }

    .settings-pages { position: relative; flex: 1; overflow: hidden; }
    .pages-track { display: flex; width: 400%; height: 100%; will-change: transform; }
    .settings-page { width: 25%; height: 100%; overflow-y: auto; padding: 10px 0 18px;
      display: flex; flex-direction: column; align-items: center; gap: 9px;
      scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.28) transparent; }
    .settings-page::-webkit-scrollbar { width: 6px; }
    .settings-page::-webkit-scrollbar-thumb { background: rgba(255,255,255,.22); border-radius: 3px; }
    .settings-page > * { flex: 0 0 auto; animation: wm-rise .18s cubic-bezier(.32,.72,0,1) both; }
    @keyframes wm-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

    .setting-group { width: 80%; padding: 8px 12px; border-radius: 16px; display: flex; flex-direction: column; gap: 6px; }
    .setting-group label { font-size: 13px; color: #d8d8dc; display: flex; justify-content: space-between; align-items: center; }
    .setting-group label b { color: #fff; font-weight: 600; }

    .tip-icon { display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px;
      border-radius: 50%; font-size: 10px; font-weight: 700; background: rgba(255,255,255,.07);
      border: 1px solid rgba(255,255,255,.22); color: rgba(255,255,255,.8); cursor: help; flex-shrink: 0;
      transition: background .12s ease, border-color .12s ease, transform .1s ease; }
    .tip-icon:hover { background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.5); }
    .tip-icon.btn-tip { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); z-index: 2; }

    .liq-line { position: relative; height: 46px; touch-action: none; user-select: none; -webkit-user-select: none; outline: none; }
    .liq-line:focus-visible .liq-track { box-shadow: 0 0 0 3px rgba(255,255,255,.25), inset 0 1px 2px rgba(0,0,0,.55); }
    .liq-track { position: absolute; left: 18px; right: 18px; top: 32px; height: 4px; border-radius: 999px;
      background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.14);
      -webkit-backdrop-filter: blur(8px) saturate(1.4); backdrop-filter: blur(8px) saturate(1.4);
      box-shadow: inset 0 1px 2px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.12); }
    .liq-fill { position: absolute; left: 19px; top: 33px; height: 3px; border-radius: 999px;
      background: rgba(255,255,255,.65); box-shadow: 0 0 8px rgba(255,255,255,.35); pointer-events: none; }
    .liq-thumb { position: absolute; top: 34px; left: 18px; width: 28px; height: 28px; border-radius: 50%;
      overflow: hidden; will-change: transform; pointer-events: none; z-index: 2;
      background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.35);
      -webkit-backdrop-filter: blur(4px) saturate(2) brightness(1.15);
      backdrop-filter: blur(4px) saturate(2) brightness(1.15);
      box-shadow:
        inset 0 2px 2px rgba(255,255,255,.5), inset 0 -2px 3px rgba(255,255,255,.12),
        inset 1px 0 0 rgba(120,220,255,.22), inset -1px 0 0 rgba(255,120,220,.2),
        0 8px 20px rgba(0,0,0,.5); }
    .liq-thumb::before { content: ''; position: absolute; inset: 0; border-radius: inherit; z-index: 2;
      background: linear-gradient(180deg, rgba(255,255,255,.45), transparent 45%, rgba(255,255,255,.08)); }
    .liq-thumb::after { content: ''; position: absolute; top: 15%; bottom: 15%; width: calc(var(--spill,0) * 20px);
      border-radius: 50%; background: rgba(255,255,255,.28); filter: blur(3px); z-index: 1;
      left: calc(var(--spilldir,0) * -1 * var(--spill,0) * 20px); opacity: var(--spill,0); }
    .liq-vspill { position: absolute; left: 15%; right: 15%; height: calc(var(--spilly,0) * 18px);
      border-radius: 50%; background: rgba(255,255,255,.26); filter: blur(3px); z-index: 1; pointer-events: none;
      top: calc(50% - var(--spilldiry,1) * (50% + var(--spilly,0) * 9px));
      opacity: var(--spilly,0); }
    .liq-lens { position: absolute; inset: 0; border-radius: inherit; z-index: 0;
      -webkit-backdrop-filter: url(#wm-liquid); backdrop-filter: url(#wm-liquid); }
    .liq-lens::after { content: ''; position: absolute; inset: 0; border-radius: inherit;
      background: conic-gradient(from 210deg, transparent 0 12%, rgba(140,220,255,.5) 22%, rgba(255,255,255,.65) 30%,
        rgba(255,170,230,.45) 40%, transparent 52% 62%, rgba(160,255,220,.35) 74%, rgba(255,255,255,.5) 84%, transparent 94%);
      -webkit-mask: radial-gradient(closest-side, transparent 88%, #000 93%);
      mask: radial-gradient(closest-side, transparent 88%, #000 93%);
      opacity: .8; }
    .liq-shine { position: absolute; top: 50%; left: var(--pressx,50%); width: 32px; height: 32px; z-index: 3;
      transform: translate(-50%,-50%); border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,.55), transparent 65%);
      opacity: var(--pressop,0); filter: blur(2px); transition: opacity .1s ease; }
    .liq-stop { position: absolute; top: 34px; left: calc(18px + (100% - 36px) * var(--t));
      transform: translate(-50%,-50%); background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,.5); padding: 5px; transition: color .12s ease, transform .1s ease; }
    .liq-stop:active { transform: translate(-50%,-50%) scale(.9); }
    .liq-stop.on { color: #fff; }
    .liq-label { position: absolute; bottom: calc(100% + 2px); left: 50%; transform: translateX(-50%);
      font-size: 9px; font-weight: 600; text-align: center; line-height: 1.05; white-space: nowrap; max-width: 56px;
      overflow: hidden; text-overflow: ellipsis; }
    .liq-dot { display: block; width: 8px; height: 8px; border-radius: 50%; border: 2px solid currentColor; opacity: .85; }
    .liq-stop.on .liq-dot { background: currentColor; box-shadow: 0 0 8px rgba(255,255,255,.5); }

    .system-actions { display: flex; flex-direction: column; gap: 12px; width: 80%; align-items: center; }

    .cat-bar-wrap { padding: 8px 12px; padding-bottom: calc(8px + env(safe-area-inset-bottom)); }
    .cat-bar { position: relative; display: flex; height: 52px; border-radius: 999px;
      touch-action: none; user-select: none; -webkit-user-select: none; max-width: 560px; margin: 0 auto;
      box-shadow: inset 0 2px 6px rgba(0,0,0,.5), inset 0 -1px 0 rgba(255,255,255,.12), 0 10px 30px rgba(0,0,0,.45); }
    .cat-btn { flex: 1; position: relative; z-index: 2; background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,.55); font-size: 14px; font-weight: 600; border-radius: 999px;
      transition: color .12s ease, transform .1s ease; }
    .cat-btn:active { transform: scale(.94); }
    .cat-btn.active { color: #fff; text-shadow: 0 0 12px rgba(255,255,255,.45); }
    .cat-btn:focus-visible { outline: 2px solid rgba(255,255,255,.6); outline-offset: -4px; }

    .pill { position: absolute; left: 0; top: 50%; z-index: 1; border-radius: 999px; overflow: hidden;
      will-change: transform; pointer-events: none;
      background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.30);
      -webkit-backdrop-filter: blur(3px) saturate(1.8) brightness(1.1);
      backdrop-filter: blur(3px) saturate(1.8) brightness(1.1);
      box-shadow:
        inset 0 2px 2px rgba(255,255,255,.5), inset 0 -2px 3px rgba(255,255,255,.12),
        inset 1px 0 0 rgba(120,220,255,.2), inset -1px 0 0 rgba(255,120,220,.18),
        0 8px 20px rgba(0,0,0,.45); }
    .pill-lens { position: absolute; inset: 0; border-radius: inherit;
      -webkit-backdrop-filter: url(#wm-liquid); backdrop-filter: url(#wm-liquid); }
    .pill-lens::after { content: ''; position: absolute; inset: 0; border-radius: inherit;
      background: conic-gradient(from 210deg, transparent 0 10%, rgba(140,220,255,.4) 20%, rgba(255,255,255,.5) 28%,
        rgba(255,170,230,.35) 38%, transparent 50% 62%, rgba(160,255,220,.3) 74%, rgba(255,255,255,.4) 84%, transparent 94%);
      -webkit-mask: radial-gradient(closest-side, transparent 86%, #000 93%);
      mask: radial-gradient(closest-side, transparent 86%, #000 93%);
      opacity: .8; }
    .pill::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
      background: linear-gradient(180deg, rgba(255,255,255,.35), transparent 42%, rgba(255,255,255,.06)); }
    .pill::before { content: ''; position: absolute; top: 12%; bottom: 12%; width: calc(var(--spill,0) * 40px);
      border-radius: 50%; background: rgba(255,255,255,.3); filter: blur(4px); z-index: 3;
      left: calc(var(--spilldir,0) * -1 * var(--spill,0) * 40px); opacity: var(--spill,0); }
    .pill-vspill { position: absolute; left: 6%; right: 6%; height: calc(var(--spilly,0) * 26px);
      border-radius: 50%; background: rgba(255,255,255,.28); filter: blur(4px); z-index: 3; pointer-events: none;
      top: calc(50% - var(--spilldiry,1) * (50% + var(--spilly,0) * 13px));
      opacity: var(--spilly,0); }
    .pill-press { position: absolute; top: 50%; left: var(--pressx,50%); width: 46px; height: 46px;
      transform: translate(-50%,-50%); border-radius: 50%; pointer-events: none;
      background: radial-gradient(circle, rgba(255,255,255,.5), transparent 65%);
      opacity: var(--pressop,0); filter: blur(2px); transition: opacity .1s ease; }

    .settings-layout.sound-locked button:not(.cat-btn):not(.liq-stop), .settings-layout.sound-locked select { pointer-events: none; }
    .settings-layout.sound-locked { cursor: progress; }

    .wm-overlay { position: absolute; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0); -webkit-backdrop-filter: blur(0); backdrop-filter: blur(0);
      transition: background .14s ease, backdrop-filter .14s ease; }
    .wm-overlay.show { background: rgba(5,2,10,.6); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
    .wm-dialog { width: min(92%, 380px); padding: 18px; border-radius: 24px; background: rgba(26,18,34,.85);
      transform: translateY(12px) scale(.95); opacity: 0;
      transition: transform .14s cubic-bezier(.32,.72,0,1), opacity .12s ease; }
    .wm-overlay.show .wm-dialog { transform: none; opacity: 1; }
    .wm-dialog-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    .wm-dialog-text { font-size: 14px; color: #cfcfd6; line-height: 1.45; margin-bottom: 14px; }
    .wm-dialog-buttons { display: flex; gap: 10px; }
    .wm-dialog-buttons.col { flex-direction: column; }
    .wm-dialog-buttons .g-btn { flex: 1; padding: 12px 10px; text-align: center; }

    .wm-tooltip { position: fixed; z-index: 120; padding: 10px 14px; max-width: 280px;
      background: rgba(32,22,44,.94); color: #fff; font-size: 13px; line-height: 1.4;
      border: 1px solid rgba(255,255,255,.18); border-radius: 12px;
      -webkit-backdrop-filter: blur(10px) saturate(1.4); backdrop-filter: blur(10px) saturate(1.4);
      box-shadow: 0 8px 24px rgba(0,0,0,.6); opacity: 0; transform: translateY(4px);
      transition: opacity .1s ease, transform .1s ease; pointer-events: none; }
    .wm-tooltip.show { opacity: 1; transform: none; }

    @media (prefers-reduced-motion: reduce) {
      .settings-page > * { animation: none; }
      .wm-fog i { animation: none; }
      .g-btn, .cat-btn, .wm-dialog, .wm-tooltip, .wob, .hapt { transition: none; animation: none; }
    }
  `; }
};
