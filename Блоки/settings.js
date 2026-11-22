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

// физика капли: мгновенный отклик + торможение 80 мс при перехвате
const SPRING_RELEASE = { k: 260, c: 22 };
const SPRING_DRAG    = { k: 900, c: 46 };
const BRAKE_MS = 80, BRAKE_DAMP = 55;
const STRETCH_DIV = 2200, STRETCH_MAX = 0.42;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const TIPS = {
  masterVol: 'Громкость музыки настроек и всего, кроме звуков эффектов.',
  effectsVol: 'Громкость игровых эффектов: шаги, двери, предметы, демо-звук.',
  audioMode: 'Режим воспроизведения. При смене играет демо-звук в новом режиме.',
  brightness: 'Общая яркость изображения в игре.',
  minBrightness: 'Минимальная яркость при нулевом значении основной настройки.',
  shadows: 'Качество теней. Выше — реалистичнее, но тяжелее для устройства.',
  realisticLight: 'Качество и реалистичность освещения сцен.',
  render3D: 'Качество 3D-рендеринга объектов и окружения.',
  textureQuality: 'Детализация текстур поверхностей.',
  drawDistance: 'Как далеко видны объекты. Влияет на производительность.',
  resetAll: 'Вернуть все настройки игры к заводским значениям.',
  clearCache: 'Очистить кэшированные файлы. Игра перезапустится.'
};

export const SettingsMenu = {
  activeCategory: 'audio',
  hasUnsavedChanges: false,
  currentTab: 'audio',

  _active: false, _uiLockUntil: 0, _musicSource: null, _demoSource: null,
  _musicToken: 0, _musicStartedAt: 0, _busTimers: { music: null, effects: null },
  _visHandler: null, _ro: null, _reducedMotion: false, _tip: null,
  _tipHandler: null, _tipHost: null, _enterAnim: null,
  _ph: { x:0, v:0, target:0, dragging:false, pop:0, press:0, pressX:0, brakeUntil:0,
         lastIdx:0, raf:null, lastT:0, centers:[], segW:0, pad:5, downX:0, downT:0, moved:false, downIdx:0 },

  // ==================== ВХОД / ВЫХОД ====================
  start() {
    const container = document.getElementById('game-container');
    if (!container) throw new Error('game-container not found');
    Settings.init();
    if (window.SoundsEngine) window.SoundsEngine.init();

    this._active = true;
    this._uiLockUntil = 0;
    this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.applyEngineVolumes(0);
    this._renderShell(container);
    this._initPill();
    this._startMusic();
    this._preloadDemo();
    this._bindTooltips(container);

    const layout = container.querySelector('.settings-layout');
    if (!this._reducedMotion && layout.animate) {
      this._enterAnim = layout.animate(
        [{ opacity: 0, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }],
        { duration: 180, easing: 'cubic-bezier(.32,.72,0,1)' }
      );
    }

    this._visHandler = () => {
      const eng = window.SoundsEngine;
      if (!this._active || !eng || !eng.ctx) return;
      if (document.hidden) { eng.ctx.suspend(); this._sleepPill(); }
      else { eng.ctx.resume(); this._wakePill(); }
    };
    document.addEventListener('visibilitychange', this._visHandler);
  },

  async leave() {
    this._active = false;
    this._musicToken++;
    this._stopDemo();
    const layout = document.querySelector('.settings-layout');
    const anim = (layout && layout.animate && !this._reducedMotion)
      ? layout.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {})
      : Promise.resolve();
    await Promise.all([anim, this._stopMusic(300)]);
    this._cleanup();
  },

  _cleanup() {
    this._sleepPill();
    this._unbindTooltips();
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    if (this._visHandler) { document.removeEventListener('visibilitychange', this._visHandler); this._visHandler = null; }
    clearInterval(this._busTimers.music); clearInterval(this._busTimers.effects);
    this._musicSource = null;
  },

  // ==================== ДЕМО-ЗВУК РЕЖИМА ====================
  async _preloadDemo() {
    const eng = window.SoundsEngine;
    if (eng && !eng.loadedBuffers[DEMO_ID]) {
      try { await eng.loadSound(DEMO_ID, new URL(DEMO_PATH, document.baseURI).href); } catch (e) {}
    }
  },

  _stopDemo() {
    if (this._demoSource && window.SoundsEngine) {
      try { window.SoundsEngine.stop(this._demoSource); } catch (e) {}
    }
    this._demoSource = null;
  },

  _playDemoForMode(mode) {
    const eng = window.SoundsEngine;
    if (!eng || !eng.loadedBuffers[DEMO_ID]) return;
    this._stopDemo(); // резко обрываем предыдущий
    const opts = { type: 'effects', modeOverride: mode, volume: 1 };
    if (mode === 'stereo') opts.channelGains = [0.4, 0.6];   // моно-файл → честное стерео 40/60
    if (mode === 'dolby')  opts.panSweep = true;             // панорама L→R на весь трек
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
    const sec = eng?.loadedBuffers?.[name]?.duration ?? UI_FALLBACK[name] ?? 0.30;
    const ms = Math.ceil(sec * 1000) + 40;
    this._uiLockUntil = now + ms;
    const layout = document.querySelector('.settings-layout');
    layout?.classList.add('sound-locked');
    setTimeout(() => {
      if (!this.isLocked()) document.querySelector('.settings-layout')?.classList.remove('sound-locked');
    }, ms);
    if (eng) eng.play(name, { type: 'effects', dolby: false, tailFade: name === 'reset' ? 0.3 : 0 });
    return new Promise(res => setTimeout(() => res(true), ms));
  },

  // ==================== ГРОМКОСТЬ / МУЗЫКА ====================
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

  async _startMusic() {
    const eng = window.SoundsEngine;
    if (!eng || this._musicSource) return;
    const token = ++this._musicToken;
    try {
      // запускаем загрузку и терпеливо ждём буфер (до 3 c)
      if (!eng.loadedBuffers[MUSIC_ID]) eng.loadSound(MUSIC_ID, new URL(MUSIC_PATH, document.baseURI).href);
      for (let i = 0; i < 15; i++) {
        if (eng.loadedBuffers[MUSIC_ID] || token !== this._musicToken || !this._active) break;
        await new Promise(r => setTimeout(r, 200));
      }
      if (token !== this._musicToken || !this._active) return;
      if (!eng.loadedBuffers[MUSIC_ID]) { console.warn('[Settings] музыка не загружена:', MUSIC_PATH); return; }
      eng.setDolbyIntensity(100);
      this._musicStartedAt = eng.ctx.currentTime;
      eng.setMasterVolume('music', 0);
      this._musicSource = eng.play(MUSIC_ID, {
        type: 'music', loop: true, volume: this._musicTrackVolume(),
        dolby: Settings.current.audioMode === 'dolby'
      });
      console.info('[Settings] музыка настроек запущена');
      this._fadeBus('music', this._musicBusTarget(), 700);
    } catch (e) { console.warn('[Settings] ошибка музыки:', e); }
  },

  async _stopMusic(fadeMs = 300) {
    const eng = window.SoundsEngine;
    this._musicToken++;
    const src = this._musicSource;
    this._musicSource = null;
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
    this._musicSource = eng.play(MUSIC_ID, {
      type: 'music', loop: true, volume: this._musicTrackVolume(), offset,
      dolby: Settings.current.audioMode === 'dolby'
    });
  },

  // ==================== ТУЛТИПЫ ====================
  _bindTooltips(host) {
    this._unbindTooltips();
    const handler = (e) => {
      const icon = e.target.closest('.tip-icon');
      if (e.type === 'pointerenter') { if (icon) this._showTip(icon); }
      else if (e.type === 'pointerleave') { if (icon) this._hideTip(); }
      else if (e.type === 'click') {
        if (icon) { e.preventDefault(); e.stopPropagation();
          if (this._tip?.classList.contains('show')) this._hideTip(); else this._showTip(icon); }
        else if (this._tip && !this._tip.contains(e.target)) this._hideTip();
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
    const group = icon.closest('[data-tooltip]');
    const text = group?.dataset.tooltip;
    if (!text) return;
    this._hideTip();
    const tip = document.createElement('div');
    tip.className = 'wm-tooltip'; tip.textContent = text;
    document.body.appendChild(tip);
    this._tip = tip;
    requestAnimationFrame(() => {
      const r = icon.getBoundingClientRect();
      const tr = tip.getBoundingClientRect();
      tip.style.left = Math.max(8, Math.min(window.innerWidth - tr.width - 8, r.left + r.width / 2 - tr.width / 2)) + 'px';
      tip.style.top  = Math.max(8, r.top - tr.height - 8) + 'px';
      tip.classList.add('show');
    });
  },
  _hideTip() { if (this._tip) { this._tip.remove(); this._tip = null; } },

  // ==================== КАРКАС ====================
  _renderShell(container) {
    const saveVisible = this.hasUnsavedChanges ? 'show' : '';
    container.innerHTML = `
      <div class="settings-layout">
        <div class="wm-fog" aria-hidden="true"><i></i><i></i><i></i></div>
        <svg width="0" height="0" style="position:absolute" aria-hidden="true">
          <filter id="wm-liquid" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.028" numOctaves="2" seed="8" result="n"/>
            <feGaussianBlur in="n" stdDeviation="1.2" result="ns"/>
            <feDisplacementMap in="SourceGraphic" in2="ns" scale="16" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </svg>

        <div class="settings-header">
          <button id="btn-settings-back" class="g-btn ghost">‹ Выйти</button>
          <div class="settings-title">Настройки</div>
          <button id="btn-settings-save" class="g-btn primary save-btn ${saveVisible}">Сохранить</button>
        </div>

        <div class="settings-pages" id="settings-pages"></div>

        <div class="cat-bar-wrap">
          <div class="cat-bar" id="cat-bar" role="tablist" aria-label="Категории настроек">
            <div class="pill" id="cat-pill" aria-hidden="true">
              <div class="pill-lens"></div>
              <span class="pill-press"></span>
            </div>
            ${TABS.map(t => `
              <button class="cat-btn ${this.currentTab === t.id ? 'active' : ''}" role="tab"
                aria-selected="${this.currentTab === t.id}" tabindex="${this.currentTab === t.id ? 0 : -1}"
                data-cat="${t.id}">${t.label}</button>
            `).join('')}
          </div>
        </div>

        <style>${this._css()}</style>
      </div>
    `;

    // все 4 страницы сразу: трек следует за каплей пропорционально
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
      if (this.isLocked()) return;
      if (this.hasUnsavedChanges) {
        const save = await this.confirmDialog({
          title: 'Несохранённые изменения', text: 'Сохранить изменения перед выходом?',
          okText: 'Сохранить', cancelText: 'Не сохранять'
        });
        if (save) await this.saveSettings();
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

  _tapTo(cat) {
    const idx = TABS.findIndex(t => t.id === cat);
    if (idx < 0) return;
    const ph = this._ph;
    if (Math.abs(ph.v) > 40) ph.brakeUntil = performance.now() + BRAKE_MS; // перехват: тормоз 80 мс
    ph.target = ph.centers[idx];
    ph.lastIdx = idx;
    this._wakePill();
    this._commit(idx, true);
  },

  _commit(idx, sound) {
    const cat = TABS[idx].id;
    if (cat !== this.currentTab) {
      this.currentTab = cat;
      this.activeCategory = cat;
      this._updateTabsAria();
    }
    if (sound && !this.isLocked()) this.playUI('btn_click');
  },

  _updateTabsAria() {
    document.querySelectorAll('#cat-bar .cat-btn').forEach(btn => {
      const on = btn.dataset.cat === this.currentTab;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on);
      btn.tabIndex = on ? 0 : -1;
    });
  },

  _rebuildPage(idx) {
    const track = document.getElementById('pages-track');
    if (!track) return;
    const pg = track.children[idx];
    if (!pg) return;
    pg.innerHTML = '';
    this._fillPage(pg, TABS[idx].id);
  },

  // ==================== КОНТЕНТ ====================
  _fillPage(page, cat) {
    page.setAttribute('role', 'tabpanel');
    if (cat === 'audio')      this._pageAudio(page);
    if (cat === 'brightness') this._pageBrightness(page);
    if (cat === 'graphics')   this._pageGraphics(page);
    if (cat === 'system')     this._pageSystem(page);
    page.querySelectorAll(':scope > *').forEach((el, i) => el.style.setProperty('--i', i));
  },

  _rangeHTML(id, label, min, max, val, tipKey) {
    return `
      <div class="setting-group glass" ${tipKey ? `data-tooltip="${TIPS[tipKey]}"` : ''}>
        <label><span>${label}: <b id="val-${id}">${val}</b></span>${tipKey ? '<span class="tip-icon" aria-label="Справка">?</span>' : ''}</label>
        <input type="range" id="set-${id}" min="${min}" max="${max}" value="${val}">
      </div>`;
  },

  _stripHTML(id, label, options, current, tipKey) {
    const idx = Math.max(0, options.findIndex(o => o[0] === current));
    const w = 100 / options.length;
    return `
      <div class="setting-group glass" ${tipKey ? `data-tooltip="${TIPS[tipKey]}"` : ''}>
        <label><span>${label}:</span>${tipKey ? '<span class="tip-icon" aria-label="Справка">?</span>' : ''}</label>
        <div class="seg-strip" id="set-${id}" role="radiogroup" aria-label="${label}">
          <span class="seg-thumb" style="width:${w}%; transform:translateX(${idx * 100}%)"></span>
          ${options.map(([v, t], i) => `
            <button type="button" class="seg-item ${i === idx ? 'on' : ''}" data-val="${v}"
              role="radio" aria-checked="${i === idx}">
              <span class="seg-label">${t}</span><span class="seg-dot"></span>
            </button>`).join('')}
        </div>
      </div>`;
  },

  _bindRange(page, id, key, onChange) {
    const input = page.querySelector('#set-' + id);
    const val = page.querySelector('#val-' + id);
    const paint = () => input.style.setProperty('--p', (input.value - input.min) / (input.max - input.min) * 100 + '%');
    paint();
    input.addEventListener('pointerdown', () => this.playUI('btn_select'));
    input.addEventListener('keydown', (e) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)) this.playUI('btn_select');
    });
    input.addEventListener('input', () => {
      const v = parseInt(input.value, 10);
      val.textContent = v; paint();
      Settings.set(key, v);
      if (onChange) onChange(v);
      this.markChanged();
    });
  },

  _bindStrip(page, id, key, onChange) {
    const strip = page.querySelector('#set-' + id);
    const thumb = strip.querySelector('.seg-thumb');
    const items = [...strip.querySelectorAll('.seg-item')];
    items.forEach((btn, i) => {
      btn.onclick = () => {
        if (this.isLocked()) return;
        const val = btn.dataset.val;
        this.playUI('btn_select');
        if (Settings.current[key] === val) return;
        Settings.set(key, val);
        items.forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-checked', j === i); });
        thumb.style.transform = `translateX(${i * 100}%)`;
        this.markChanged();
        if (onChange) onChange(val);
      };
    });
  },

  _pageAudio(page) {
    const c = Settings.current;
    page.innerHTML = `
      ${this._rangeHTML('masterVol', 'Общая громкость', 0, 150, c.masterVolume, 'masterVol')}
      ${this._rangeHTML('effectsVol', 'Громкость эффектов', 0, 150, c.effectsVolume, 'effectsVol')}
      ${this._stripHTML('audioMode', 'Режим звука',
          [['mono','Моно'],['stereo','Стерео'],['dolby','Dolby Vertical']], c.audioMode, 'audioMode')}
      <button id="btn-recommended" class="g-btn ghost wide">Рекомендуемые значения</button>
    `;
    this._bindRange(page, 'masterVol', 'masterVolume', () => this._fadeBus('music', this._musicBusTarget(), 100));
    this._bindRange(page, 'effectsVol', 'effectsVolume', () => this._fadeBus('effects', this._fxBusTarget(), 100));
    this._bindStrip(page, 'audioMode', 'audioMode', (v) => {
      this._restartMusicWithMode();
      this._playDemoForMode(v); // демо на шине эффектов, без замка
    });
    this._bindRecommended(page, 'audio', 'Сброс звука', 'Вернуть рекомендуемые настройки звука?');
  },

  _pageBrightness(page) {
    const c = Settings.current;
    page.innerHTML = `
      ${this._rangeHTML('brightness', 'Яркость', 0, 150, c.brightness, 'brightness')}
      ${this._rangeHTML('minBrightness', 'Минимальная яркость', 0, 50, c.minBrightness, 'minBrightness')}
      <button id="btn-recommended" class="g-btn ghost wide">Рекомендуемые значения</button>
    `;
    this._bindRange(page, 'brightness', 'brightness');
    this._bindRange(page, 'minBrightness', 'minBrightness');
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
    page.innerHTML = defs.map(d => this._stripHTML(d.id, d.label, d.options, Settings.current[d.id], d.tip)).join('') +
      `<button id="btn-recommended" class="g-btn ghost wide">Рекомендуемые значения</button>`;
    defs.forEach(d => this._bindStrip(page, d.id, d.id));
    this._bindRecommended(page, 'graphics', 'Сброс графики', 'Вернуть рекомендуемые настройки графики?');
  },

  _bindRecommended(page, category, title, text) {
    page.querySelector('#btn-recommended').onclick = async () => {
      if (this.isLocked()) return;
      const ok = await this.confirmDialog({ title, text, okText: 'Сбросить', cancelText: 'Отмена' });
      if (!ok) return;
      if (!(await this.playUI('reset'))) return;
      Settings.resetCategory(category);
      if (category === 'audio') { this.applyEngineVolumes(150); this._restartMusicWithMode(); }
      const idx = TABS.findIndex(t => t.id === category || (category === 'audio' && t.id === 'audio'));
      this._rebuildPage(TABS.findIndex(t => t.id === this.currentTab));
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
      if (this.isLocked()) return;
      const ok = await this.confirmDialog({
        title: 'Сброс всех настроек', text: 'Вернуть ВСЕ настройки к заводским? Это нельзя отменить.',
        okText: 'Сбросить всё', cancelText: 'Отмена', danger: true
      });
      if (!ok) return;
      if (!(await this.playUI('reset'))) return;
      Settings.reset();
      this.applyEngineVolumes(150);
      this._restartMusicWithMode();
      TABS.forEach((t, i) => this._rebuildPage(i));
    };
    page.querySelector('#btn-clear-cache').onclick = async () => {
      if (this.isLocked()) return;
      const ok = await this.confirmDialog({
        title: 'Очистка кэша', text: 'Очистить кэш медиа и кода? Игра перезапустится.',
        okText: 'Очистить', cancelText: 'Отмена', danger: true
      });
      if (!ok) return;
      await this.playUI('reset');
      await this._stopMusic(200);
      this._cleanup();
      const reload = () => { localStorage.removeItem('woland_version'); location.reload(); };
      try {
        const req = indexedDB.deleteDatabase('woland_db');
        req.onsuccess = req.onerror = req.onblocked = reload;
      } catch (e) { console.warn(e); reload(); }
    };
  },

  // ==================== СОХРАНЕНИЕ / МОДАЛКА ====================
  markChanged() {
    this.hasUnsavedChanges = true;
    document.querySelector('#btn-settings-save')?.classList.add('show');
  },

  async saveSettings() {
    if (!(await this.playUI('transition'))) return;
    Settings.save();
    this.hasUnsavedChanges = false;
    document.querySelector('#btn-settings-save')?.classList.remove('show');
  },

  confirmDialog({ title = 'Подтверждение', text = '', okText = 'Да', cancelText = 'Нет', danger = false } = {}) {
    return new Promise(resolve => {
      const host = document.querySelector('.settings-layout') || document.body;
      const overlay = document.createElement('div');
      overlay.className = 'wm-overlay';
      overlay.innerHTML = `
        <div class="wm-dialog glass" role="alertdialog" aria-modal="true" aria-label="${title}">
          <div class="wm-dialog-title">${title}</div>
          <div class="wm-dialog-text">${text}</div>
          <div class="wm-dialog-buttons">
            <button type="button" class="g-btn ghost wm-cancel">${cancelText}</button>
            <button type="button" class="g-btn ${danger ? 'danger' : 'primary'} wm-ok">${okText}</button>
          </div>
        </div>`;
      host.appendChild(overlay);
      requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));
      let closing = false;
      const close = async (result, sound) => {
        if (closing) return;
        closing = true;
        document.removeEventListener('keydown', onKey);
        const wait = this._uiLockUntil - performance.now();
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        await this.playUI(sound);
        overlay.classList.remove('show');
        setTimeout(() => { overlay.remove(); resolve(result); }, 130);
      };
      const onKey = (e) => {
        if (!overlay.isConnected) { document.removeEventListener('keydown', onKey); return; }
        if (e.key === 'Escape') { e.preventDefault(); close(false, 'btn_back'); }
        if (e.key === 'Enter')  { e.preventDefault(); close(true, 'btn_select'); }
        if (e.key === 'Tab') {
          e.preventDefault();
          const ok = overlay.querySelector('.wm-ok'), no = overlay.querySelector('.wm-cancel');
          (document.activeElement === ok ? no : ok).focus();
        }
      };
      document.addEventListener('keydown', onKey);
      overlay.querySelector('.wm-ok').onclick     = () => close(true,  'btn_select');
      overlay.querySelector('.wm-cancel').onclick = () => close(false, 'btn_back');
      overlay.onclick = (e) => { if (e.target === overlay) close(false, 'btn_back'); };
      overlay.querySelector('.wm-ok').focus();
    });
  },

  // ==================== КАПЛЯ: ФИЗИКА + 3D TOUCH ====================
  _initPill() {
    const bar = document.getElementById('cat-bar');
    this._measurePill();
    const idx = TABS.findIndex(t => t.id === this.currentTab);
    this._ph.x = this._ph.target = this._ph.centers[idx];
    this._ph.lastIdx = idx;
    this._renderPill();
    this._ro = new ResizeObserver(() => {
      this._measurePill();
      const i = TABS.findIndex(t => t.id === this.currentTab);
      this._ph.x = this._ph.target = this._ph.centers[i];
      this._ph.v = 0;
      this._renderPill();
    });
    this._ro.observe(bar);
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

  _pressFrom(e) {
    if (e.pointerType === 'mouse') return 0.35;
    return clamp((e.pressure - 0.25) / 0.75, 0, 1);
  },

  _pillDown(e) {
    if (!this._active || this._pageBusyGuard()) return;
    const bar = document.getElementById('cat-bar');
    bar.setPointerCapture(e.pointerId);
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ph = this._ph;
    ph.dragging = false; ph.moved = false;
    ph.downX = x; ph.downT = performance.now();
    ph.downIdx = clamp(Math.floor((x - ph.pad) / ph.segW), 0, TABS.length - 1);
    ph.press = this._pressFrom(e);
    ph.pressX = x;
    // МГНОВЕННЫЙ отклик: цель ставится сразу на нажатие
    if (Math.abs(ph.v) > 40) ph.brakeUntil = performance.now() + BRAKE_MS;
    ph.target = ph.centers[ph.downIdx];
    ph.lastIdx = ph.downIdx;
    this._wakePill();
  },

  _pageBusyGuard() { return false; }, // страницы больше не блокируют: трек едет всегда

  _pillMove(e) {
    const ph = this._ph;
    if (ph.downT === 0) return;
    const bar = document.getElementById('cat-bar');
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    ph.press = this._pressFrom(e);
    ph.pressX = x;
    if (!ph.moved && Math.abs(x - ph.downX) > 8) ph.moved = true;
    if (!ph.moved) return;
    ph.dragging = true;
    ph.brakeUntil = 0;
    ph.target = clamp(x, ph.centers[0], ph.centers[TABS.length - 1]);
    this._wakePill();
  },

  _pillUp(e) {
    const ph = this._ph;
    if (ph.downT === 0) return;
    const wasDrag = ph.moved;
    const downIdx = ph.downIdx;
    ph.downT = 0; ph.dragging = false;
    try { document.getElementById('cat-bar').releasePointerCapture(e.pointerId); } catch (_) {}
    if (!wasDrag) {
      this._commit(downIdx, true); // тап: цель уже стоит с pointerdown
      return;
    }
    const idx = clamp(Math.round((ph.x - ph.pad) / ph.segW - 0.5), 0, TABS.length - 1);
    ph.target = ph.centers[idx];
    this._wakePill();
    this._commit(idx, true);
  },

  _pillCancel() {
    const ph = this._ph;
    ph.downT = 0; ph.dragging = false;
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
        const a = braking ? -BRAKE_DAMP * ph.v : s.k * (ph.target - ph.x) - s.c * ph.v;
        ph.v += a * h;
        ph.x += ph.v * h;
      }
      ph.pop *= Math.exp(-7 * dt);
      ph.press += ((ph.downT ? ph.press : 0) - ph.press) * 0; // press обновляется в событиях
      this._renderPill();
      if (!ph.dragging && Math.abs(ph.v) < 1 && Math.abs(ph.target - ph.x) < 0.25 && !ph.downT) {
        ph.x = ph.target; ph.v = 0;
        this._renderPill();
        return;
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
    let sx = 1, sy = 1, skew = 0;
    if (!this._reducedMotion) {
      const s = Math.min(Math.abs(ph.v) / STRETCH_DIV, STRETCH_MAX);
      const bulge = ph.press * 0.16;             // 3D touch: давление раздувает каплю
      sx = 1 + s - ph.pop * 0.05 + bulge;
      sy = 1 - s * 0.55 + ph.pop * 0.14 + bulge * 0.55;
      skew = clamp(-ph.v / 160, -9, 9);
    } else { ph.x = ph.target; ph.v = 0; }
    pill.style.transform = `translate3d(${ph.x}px,0,0) translate(-50%,-50%) skewX(${skew}deg) scale(${sx},${sy})`;
    pill.style.setProperty('--pressx', (ph.pressX - ph.x + (pill.offsetWidth * sx) / 2) + 'px');
    pill.style.setProperty('--pressop', (ph.downT ? ph.press : 0).toFixed(2));
    // страницы следуют за каплей пропорционально
    if (track) {
      const f = clamp((ph.x - ph.centers[0]) / ph.segW, 0, TABS.length - 1);
      track.style.transform = `translate3d(${-f * 25}%,0,0)`;
    }
  },

  // ==================== СТИЛИ ====================
  _css() { return `
    .settings-layout {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      background: #0b0714; color: #fff; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    /* тёмно-фиолетовый туман */
    .wm-fog { position: absolute; inset: -25%; pointer-events: none; filter: blur(70px); opacity: .6; z-index: 0; }
    .wm-fog i { position: absolute; display: block; border-radius: 50%; }
    .wm-fog i:nth-child(1) { width: 60%; height: 55%; left: 2%; top: 6%;
      background: radial-gradient(circle, rgba(96,42,170,.55), transparent 65%);
      animation: fog1 26s ease-in-out infinite alternate; }
    .wm-fog i:nth-child(2) { width: 55%; height: 50%; right: 0%; top: 30%;
      background: radial-gradient(circle, rgba(120,32,120,.38), transparent 65%);
      animation: fog2 31s ease-in-out infinite alternate; }
    .wm-fog i:nth-child(3) { width: 70%; height: 55%; left: 12%; bottom: -6%;
      background: radial-gradient(circle, rgba(44,22,96,.55), transparent 70%);
      animation: fog3 23s ease-in-out infinite alternate; }
    @keyframes fog1 { to { transform: translate3d(6%,4%,0) scale(1.12); } }
    @keyframes fog2 { to { transform: translate3d(-7%,5%,0) scale(1.08); } }
    @keyframes fog3 { to { transform: translate3d(4%,-5%,0) scale(1.15); } }
    .settings-layout::after {
      content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .05; z-index: 0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    .settings-layout > *:not(.wm-fog) { position: relative; z-index: 1; }

    /* БЕСЦВЕТНОЕ жидкое стекло */
    .glass, .g-btn, .cat-bar, .pill {
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.16);
      -webkit-backdrop-filter: blur(18px) saturate(1.6) brightness(1.06);
      backdrop-filter: blur(18px) saturate(1.6) brightness(1.06);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.22), inset 0 -1px 0 rgba(255,255,255,.06), 0 10px 30px rgba(0,0,0,.45);
    }

    .settings-header {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 12px 16px; padding-top: calc(12px + env(safe-area-inset-top));
    }
    .settings-title { font-size: 17px; font-weight: 700; letter-spacing: .3px; opacity: .92; }

    .g-btn {
      position: relative; padding: 10px 20px; font-size: 15px; color: #fff; cursor: pointer;
      border-radius: 999px; overflow: hidden;
      transition: transform .12s cubic-bezier(.34,1.56,.64,1), background .15s ease, border-color .15s ease, opacity .15s ease;
    }
    .g-btn::before {
      content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
      background: linear-gradient(180deg, rgba(255,255,255,.25), transparent 45%);
    }
    .g-btn:hover { background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.35); }
    .g-btn:active { transform: scale(.94); }
    .g-btn.primary { background: rgba(255,20,20,.22); border-color: rgba(255,70,70,.55); }
    .g-btn.danger { background: rgba(120,0,0,.45); border-color: rgba(255,0,0,.6); }
    .g-btn.wide { width: 100%; max-width: 420px; padding: 14px; }

    .save-btn { opacity: 0; transform: scale(.85); pointer-events: none; transition: all .15s cubic-bezier(.32,.72,0,1); }
    .save-btn.show { opacity: 1; transform: none; pointer-events: auto; }

    /* страницы: трек следует за каплей */
    .settings-pages { position: relative; flex: 1; overflow: hidden; }
    .pages-track { display: flex; width: 400%; height: 100%; will-change: transform; }
    .settings-page {
      width: 25%; height: 100%; overflow-y: auto; padding: 16px 18px 24px;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.28) transparent;
    }
    .settings-page::-webkit-scrollbar { width: 6px; }
    .settings-page::-webkit-scrollbar-track { background: transparent; }
    .settings-page::-webkit-scrollbar-thumb { background: rgba(255,255,255,.22); border-radius: 3px; }
    .settings-page > * { animation: wm-rise .3s cubic-bezier(.32,.72,0,1) both; animation-delay: calc(var(--i,0) * 25ms); }
    @keyframes wm-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

    .setting-group { width: 100%; max-width: 420px; padding: 13px 16px; border-radius: 18px; display: flex; flex-direction: column; gap: 10px; }
    .setting-group label { font-size: 14px; color: #d8d8dc; display: flex; justify-content: space-between; align-items: center; }
    .setting-group label b { color: #fff; font-weight: 600; }

    .tip-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; border-radius: 50%; font-size: 11px; font-weight: 700;
      background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.22);
      color: rgba(255,255,255,.8); cursor: help; flex-shrink: 0;
      transition: background .15s ease, border-color .15s ease, transform .1s ease;
    }
    .tip-icon:hover { background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.5); }
    .tip-icon:active { transform: scale(.9); }
    .tip-icon.btn-tip { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); z-index: 2; }

    input[type="range"] {
      -webkit-appearance: none; appearance: none; width: 100%; height: 8px; border-radius: 999px; cursor: pointer;
      background: linear-gradient(90deg, rgba(255,255,255,.75) var(--p,50%), rgba(255,255,255,.12) var(--p,50%));
      box-shadow: inset 0 1px 2px rgba(0,0,0,.5); outline: none;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%;
      background: radial-gradient(circle at 32% 28%, rgba(255,255,255,.98), rgba(255,255,255,.4) 40%, rgba(210,210,220,.28));
      border: 1px solid rgba(255,255,255,.6);
      box-shadow: 0 2px 8px rgba(0,0,0,.55), inset 0 1px 1px rgba(255,255,255,.8);
      transition: transform .12s cubic-bezier(.34,1.56,.64,1);
    }
    input[type="range"]:active::-webkit-slider-thumb { transform: scale(1.18); }
    input[type="range"]::-moz-range-thumb {
      width: 24px; height: 24px; border-radius: 50%;
      background: radial-gradient(circle at 32% 28%, rgba(255,255,255,.98), rgba(255,255,255,.4) 40%, rgba(210,210,220,.28));
      border: 1px solid rgba(255,255,255,.6);
    }

    /* полоски-сегменты с подписями */
    .seg-strip {
      position: relative; display: flex; padding: 4px; border-radius: 16px;
      background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12);
    }
    .seg-thumb {
      position: absolute; top: 4px; bottom: 4px; left: 4px; border-radius: 12px;
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.28);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 4px 12px rgba(0,0,0,.35);
      -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
      transition: transform .18s cubic-bezier(.32,.72,0,1);
      pointer-events: none;
    }
    .seg-item {
      position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 8px 2px; background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,.55); transition: color .15s ease, transform .1s ease;
    }
    .seg-item:active { transform: scale(.94); }
    .seg-item.on { color: #fff; }
    .seg-label { font-size: 10px; font-weight: 600; letter-spacing: .2px; text-align: center; line-height: 1.1; }
    .seg-dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid currentColor; opacity: .8; }
    .seg-item.on .seg-dot { background: currentColor; box-shadow: 0 0 10px rgba(255,255,255,.5); }

    .system-actions { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 420px; align-items: center; }

    /* капсула-оболочка */
    .cat-bar-wrap { padding: 10px 14px; padding-bottom: calc(10px + env(safe-area-inset-bottom)); }
    .cat-bar {
      position: relative; display: flex; height: 58px; border-radius: 999px;
      touch-action: none; user-select: none; -webkit-user-select: none;
      max-width: 560px; margin: 0 auto;
      box-shadow: inset 0 2px 6px rgba(0,0,0,.5), inset 0 -1px 0 rgba(255,255,255,.12), 0 10px 30px rgba(0,0,0,.45);
    }
    .cat-btn {
      flex: 1; position: relative; z-index: 2; background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,.55); font-size: 14px; font-weight: 600; border-radius: 999px;
      transition: color .15s ease, transform .1s ease;
    }
    .cat-btn:active { transform: scale(.94); }
    .cat-btn.active { color: #fff; text-shadow: 0 0 12px rgba(255,255,255,.45); }
    .cat-btn:focus-visible { outline: 2px solid rgba(255,255,255,.6); outline-offset: -4px; }

    .pill {
      position: absolute; left: 0; top: 50%; z-index: 1; border-radius: 999px;
      will-change: transform; pointer-events: none;
      background: rgba(255,255,255,.10);
      border: 1px solid rgba(255,255,255,.30);
      -webkit-backdrop-filter: blur(3px) saturate(1.8) brightness(1.1);
      backdrop-filter: blur(3px) saturate(1.8) brightness(1.1);
      box-shadow: inset 0 1px 1px rgba(255,255,255,.55), inset 0 -1px 1px rgba(255,255,255,.15), 0 6px 18px rgba(0,0,0,.4);
    }
    .pill-lens {
      position: absolute; inset: 0; border-radius: inherit;
      -webkit-backdrop-filter: url(#wm-liquid); backdrop-filter: url(#wm-liquid);
    }
    .pill::after {
      content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
      background: linear-gradient(180deg, rgba(255,255,255,.35), transparent 42%, rgba(255,255,255,.06));
    }
    .pill-press {
      position: absolute; top: 50%; left: var(--pressx, 50%); width: 46px; height: 46px;
      transform: translate(-50%,-50%); border-radius: 50%; pointer-events: none;
      background: radial-gradient(circle, rgba(255,255,255,.5), transparent 65%);
      opacity: var(--pressop, 0); filter: blur(2px);
      transition: opacity .12s ease;
    }

    .settings-layout.sound-locked button:not(.cat-btn):not(.seg-item),
    .settings-layout.sound-locked select { pointer-events: none; }
    .settings-layout.sound-locked input[type="range"] { pointer-events: none; }
    .settings-layout.sound-locked { cursor: progress; }

    .wm-overlay {
      position: absolute; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0); -webkit-backdrop-filter: blur(0); backdrop-filter: blur(0);
      transition: background .16s ease, backdrop-filter .16s ease;
    }
    .wm-overlay.show { background: rgba(5,2,10,.55); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
    .wm-dialog {
      width: min(92%, 380px); padding: 20px; border-radius: 24px; background: rgba(26,18,34,.85);
      transform: translateY(14px) scale(.95); opacity: 0;
      transition: transform .16s cubic-bezier(.32,.72,0,1), opacity .14s ease;
    }
    .wm-overlay.show .wm-dialog { transform: none; opacity: 1; }
    .wm-dialog-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    .wm-dialog-text { font-size: 14px; color: #cfcfd4; line-height: 1.45; margin-bottom: 16px; }
    .wm-dialog-buttons { display: flex; gap: 10px; }
    .wm-dialog-buttons .g-btn { flex: 1; }

    .wm-tooltip {
      position: fixed; z-index: 120; padding: 10px 14px; max-width: 280px;
      background: rgba(32,22,44,.94); color: #fff; font-size: 13px; line-height: 1.4;
      border: 1px solid rgba(255,255,255,.18); border-radius: 12px;
      -webkit-backdrop-filter: blur(10px) saturate(1.4); backdrop-filter: blur(10px) saturate(1.4);
      box-shadow: 0 8px 24px rgba(0,0,0,.6);
      opacity: 0; transform: translateY(4px); transition: opacity .12s ease, transform .12s ease;
      pointer-events: none;
    }
    .wm-tooltip.show { opacity: 1; transform: none; }

    @media (prefers-reduced-motion: reduce) {
      .settings-page > * { animation: none; }
      .wm-fog i { animation: none; }
      .g-btn, .cat-btn, .wm-dialog, .wm-tooltip, .seg-thumb { transition: none; }
    }
  `; }
};
