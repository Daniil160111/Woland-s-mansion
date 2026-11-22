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

const SPRING_RELEASE = { k: 170, c: 16 };
const SPRING_DRAG    = { k: 620, c: 38 };
const STRETCH_DIV = 2200, STRETCH_MAX = 0.42;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Тексты подсказок
const TIPS = {
  masterVol:      'Громкость музыки и всего, кроме звуков эффектов.',
  effectsVol:     'Громкость игровых эффектов: шаги, двери, предметы.',
  audioMode:      'Режим воспроизведения аудио. При изменении играет демо-звук.',
  brightness:     'Общая яркость изображения в игре.',
  minBrightness:  'Минимальная яркость при нулевом значении основной настройки.',
  shadows:        'Качество теней. Чем выше — тем реалистичнее, но тяжелее для устройства.',
  realisticLight: 'Качество и реалистичность освещения сцен.',
  render3D:       'Качество 3D-рендеринга объектов и окружения.',
  textureQuality: 'Детализация текстур поверхностей.',
  drawDistance:   'Насколько далеко видны объекты. Влияет на производительность.',
  resetAll:       'Вернуть все настройки игры к заводским значениям.',
  clearCache:     'Очистить кэшированные файлы. Игра перезапустится.'
};

export const SettingsMenu = {
  activeCategory: 'audio',
  hasUnsavedChanges: false,
  currentTab: 'audio',

  _active: false,
  _uiLockUntil: 0,
  _pageBusy: false,
  _musicSource: null,
  _demoSource: null,
  _musicToken: 0,
  _musicStartedAt: 0,
  _busTimers: { music: null, effects: null },
  _visHandler: null,
  _ro: null,
  _reducedMotion: false,
  _tip: null,
  _tipBoundHandler: null,
  _ph: { x: 0, v: 0, target: 0, dragging: false, pop: 0, lastIdx: 0, raf: null, lastT: 0,
         centers: [], segW: 0, pad: 5, downX: 0, downT: 0, moved: false, downIdx: 0 },

  // ==================== ВХОД / ВЫХОД ====================
  start() {
    const container = document.getElementById('game-container');
    if (!container) throw new Error('game-container not found');

    Settings.init();
    if (window.SoundsEngine) window.SoundsEngine.init();

    this._active = true;
    this._uiLockUntil = 0;
    this._pageBusy = false;
    this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.applyEngineVolumes(0);
    this._renderShell(container);
    this._initPill();
    this._startMusic();
    this._preloadDemo();
    this._bindTooltips(container);

    const layout = container.querySelector('.settings-layout');
    if (!this._reducedMotion && layout.animate) {
      layout.animate(
        [{ opacity: 0, transform: 'translateY(14px) scale(.985)' }, { opacity: 1, transform: 'none' }],
        { duration: 320, easing: 'cubic-bezier(.32,.72,0,1)' }
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
      ? layout.animate(
          [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(10px) scale(.985)' }],
          { duration: 240, easing: 'ease-in', fill: 'forwards' }
        ).finished.catch(() => {})
      : Promise.resolve();
    await Promise.all([anim, this._stopMusic(380)]);
    this._cleanup();
  },

  _cleanup() {
    this._sleepPill();
    this._unbindTooltips();
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    if (this._visHandler) { document.removeEventListener('visibilitychange', this._visHandler); this._visHandler = null; }
    clearInterval(this._busTimers.music);
    clearInterval(this._busTimers.effects);
    this._musicSource = null;
  },

  // ==================== ДЕМО-ЗВУК ====================
  async _preloadDemo() {
    const eng = window.SoundsEngine;
    if (!eng) return;
    if (!eng.loadedBuffers[DEMO_ID]) {
      try { await eng.loadSound(DEMO_ID, new URL(DEMO_PATH, document.baseURI).href); } catch (e) {}
    }
  },

  _stopDemo() {
    if (this._demoSource) {
      const eng = window.SoundsEngine;
      if (eng) {
        try { eng.stop(this._demoSource); } catch (e) {}
      }
      this._demoSource = null;
    }
  },

  _playDemoForMode(mode) {
    const eng = window.SoundsEngine;
    if (!eng || !eng.loadedBuffers[DEMO_ID]) return;
    this._stopDemo();
    const vol = clamp(Settings.current.effectsVolume ?? 100, 0, 150) / 100 * FX_BASE;
    const src = eng.play(DEMO_ID, {
      type: 'music',           // чтобы режим звука применился
      volume: vol,
      dolby: mode === 'dolby',
      modeOverride: mode       // ★ применяет режим к этому звуку
    });
    if (src) {
      this._demoSource = src;
      src.addEventListener('ended', () => {
        if (this._demoSource === src) this._demoSource = null;
      });
    }
  },

  // ==================== ЗВУКОВОЙ ЗАМОК ====================
  isLocked() { return performance.now() < this._uiLockUntil; },

  playUI(name) {
    const now = performance.now();
    if (now < this._uiLockUntil) return Promise.resolve(false);
    const eng = window.SoundsEngine;
    const sec = eng?.loadedBuffers?.[name]?.duration ?? UI_FALLBACK[name] ?? 0.30;
    const ms = Math.ceil(sec * 1000) + 50;
    this._uiLockUntil = now + ms;
    const layout = document.querySelector('.settings-layout');
    layout?.classList.add('sound-locked');
    setTimeout(() => {
      if (!this.isLocked()) document.querySelector('.settings-layout')?.classList.remove('sound-locked');
    }, ms);
    if (eng) eng.play(name, { type: 'effects', dolby: false });
    return new Promise(res => setTimeout(() => res(true), ms));
  },

  // ==================== ГРОМКОСТЬ / МУЗЫКА ====================
  _musicBusTarget() { return clamp(Settings.current.masterVolume ?? 100, 0, 150) / 100 * MUSIC_BASE; },
  _fxBusTarget()    { return clamp(Settings.current.effectsVolume ?? 100, 0, 150) / 100 * FX_BASE; },
  _musicTrackVolume() { return MUSIC_BASE * clamp(Settings.current.masterVolume ?? 100, 0, 150) / 100; },

  applyEngineVolumes(ms = 150) {
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
      if (!eng.loadedBuffers[MUSIC_ID]) {
        await eng.loadSound(MUSIC_ID, new URL(MUSIC_PATH, document.baseURI).href);
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
      this._fadeBus('music', this._musicBusTarget(), 900);
    } catch (e) { console.warn('[Settings] ошибка музыки:', e); }
  },

  async _stopMusic(fadeMs = 400) {
    const eng = window.SoundsEngine;
    this._musicToken++;
    const src = this._musicSource;
    this._musicSource = null;
    if (!eng || !src) return;
    this._fadeBus('music', 0, fadeMs);
    await new Promise(r => setTimeout(r, fadeMs + 40));
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
      if (e.type === 'pointerenter') {
        if (icon) this._showTip(icon);
      } else if (e.type === 'pointerleave') {
        if (icon) this._hideTip();
      } else if (e.type === 'click') {
        if (icon) {
          e.preventDefault();
          e.stopPropagation();
          if (this._tip && this._tip.classList.contains('show')) this._hideTip();
          else this._showTip(icon);
        } else if (this._tip && !this._tip.contains(e.target)) {
          this._hideTip();
        }
      }
    };
    host.addEventListener('pointerenter', handler, true);
    host.addEventListener('pointerleave', handler, true);
    host.addEventListener('click', handler, true);
    this._tipBoundHandler = handler;
    this._tipBoundHost = host;
  },

  _unbindTooltips() {
    if (this._tipBoundHost && this._tipBoundHandler) {
      this._tipBoundHost.removeEventListener('pointerenter', this._tipBoundHandler, true);
      this._tipBoundHost.removeEventListener('pointerleave', this._tipBoundHandler, true);
      this._tipBoundHost.removeEventListener('click', this._tipBoundHandler, true);
    }
    this._hideTip();
    this._tipBoundHandler = null;
    this._tipBoundHost = null;
  },

  _showTip(icon) {
    const group = icon.closest('[data-tooltip]');
    if (!group) return;
    const text = group.dataset.tooltip;
    if (!text) return;
    this._hideTip();
    const tip = document.createElement('div');
    tip.className = 'wm-tooltip';
    tip.textContent = text;
    document.body.appendChild(tip);
    this._tip = tip;
    requestAnimationFrame(() => {
      const r = icon.getBoundingClientRect();
      const tr = tip.getBoundingClientRect();
      const top = Math.max(8, r.top - tr.height - 8);
      const left = Math.max(8, Math.min(window.innerWidth - tr.width - 8, r.left + r.width / 2 - tr.width / 2));
      tip.style.left = left + 'px';
      tip.style.top  = top  + 'px';
      tip.classList.add('show');
    });
  },

  _hideTip() {
    if (this._tip) { this._tip.remove(); this._tip = null; }
  },

  // ==================== КАРКАС ====================
  _renderShell(container) {
    const saveVisible = this.hasUnsavedChanges ? 'show' : '';
    container.innerHTML = `
      <div class="settings-layout">
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
            <div class="pill" id="cat-pill" aria-hidden="true"><div class="pill-lens"></div></div>
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

    const pages = container.querySelector('#settings-pages');
    pages.appendChild(this._buildPage(this.currentTab));

    container.querySelector('#btn-settings-back').onclick = async () => {
      if (this.isLocked()) return;
      if (this.hasUnsavedChanges) {
        const save = await this.confirmDialog({
          title: 'Несохранённые изменения',
          text: 'Сохранить изменения перед выходом?',
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
      btn.onclick = (e) => { if (e.detail === 0) this.switchTab(btn.dataset.cat); };
    });
    bar.addEventListener('keydown', (e) => {
      const idx = TABS.findIndex(t => t.id === this.currentTab);
      let to = null;
      if (e.key === 'ArrowRight') to = clamp(idx + 1, 0, TABS.length - 1);
      if (e.key === 'ArrowLeft')  to = clamp(idx - 1, 0, TABS.length - 1);
      if (e.key === 'Home') to = 0;
      if (e.key === 'End')  to = TABS.length - 1;
      if (to !== null) {
        e.preventDefault();
        bar.querySelectorAll('.cat-btn')[to].focus();
        this.switchTab(TABS[to].id);
      }
    });
  },

  // ==================== ПЕРЕКЛЮЧЕНИЕ СТРАНИЦ ====================
  async switchTab(cat) {
    if (!this._active || this._pageBusy) return;
    if (cat === this.currentTab) { this.playUI('btn_select'); return; }
    if (!(await this.playUI('btn_click'))) return;

    this._stopDemo();

    const from = TABS.findIndex(t => t.id === this.currentTab);
    const to   = TABS.findIndex(t => t.id === cat);
    const dir  = to > from ? 1 : -1;

    this.currentTab = cat;
    this.activeCategory = cat;
    this._ph.target = this._ph.centers[to];
    this._ph.lastIdx = to;
    this._wakePill();
    this._updateTabsAria();
    await this._swapPage(cat, dir);
  },

  _updateTabsAria() {
    document.querySelectorAll('#cat-bar .cat-btn').forEach(btn => {
      const on = btn.dataset.cat === this.currentTab;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on);
      btn.tabIndex = on ? 0 : -1;
    });
  },

  async _swapPage(cat, dir) {
    const pages = document.getElementById('settings-pages');
    if (!pages) return;
    this._pageBusy = true;
    const old = pages.firstElementChild;
    const D = this._reducedMotion ? 0 : 1;
    if (old && old.animate && D) {
      await old.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-26 * dir}px)` }],
        { duration: 170, easing: 'ease-in', fill: 'forwards' }
      ).finished.catch(() => {});
    }
    old?.remove();
    const page = this._buildPage(cat);
    pages.appendChild(page);
    if (page.animate && D) {
      await page.animate(
        [{ opacity: 0, transform: `translateX(${26 * dir}px)` }, { opacity: 1, transform: 'none' }],
        { duration: 230, easing: 'cubic-bezier(.32,.72,0,1)' }
      ).finished.catch(() => {});
    }
    this._pageBusy = false;
  },

  _refreshPage() {
    const pages = document.getElementById('settings-pages');
    if (!pages) return;
    pages.firstElementChild?.remove();
    const page = this._buildPage(this.currentTab);
    pages.appendChild(page);
    if (page.animate && !this._reducedMotion) {
      page.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    }
  },

  // ==================== КОНТЕНТ СТРАНИЦ ====================
  _buildPage(cat) {
    const page = document.createElement('div');
    page.className = 'settings-page';
    page.setAttribute('role', 'tabpanel');
    if (cat === 'audio')      this._pageAudio(page);
    if (cat === 'brightness') this._pageBrightness(page);
    if (cat === 'graphics')   this._pageGraphics(page);
    if (cat === 'system')     this._pageSystem(page);
    page.querySelectorAll(':scope > *').forEach((el, i) => el.style.setProperty('--i', i));
    return page;
  },

  _rangeHTML(id, label, min, max, val, tipKey) {
    return `
      <div class="setting-group glass" ${tipKey ? `data-tooltip="${TIPS[tipKey]}"` : ''}>
        <label>
          <span>${label}: <span id="val-${id}">${val}</span></span>
          ${tipKey ? '<span class="tip-icon" aria-label="Справка">?</span>' : ''}
        </label>
        <input type="range" id="set-${id}" min="${min}" max="${max}" value="${val}">
      </div>`;
  },

  _bindRange(page, id, key, onChange) {
    const input = page.querySelector('#set-' + id);
    const val = page.querySelector('#val-' + id);
    const paint = () => {
      const p = (input.value - input.min) / (input.max - input.min) * 100;
      input.style.setProperty('--p', p + '%');
    };
    paint();
    input.addEventListener('pointerdown', () => this.playUI('btn_select'));
    input.addEventListener('keydown', (e) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)) this.playUI('btn_select');
    });
    input.addEventListener('input', () => {
      const v = parseInt(input.value, 10);
      val.textContent = v;
      paint();
      Settings.set(key, v);
      if (onChange) onChange(v);
      this.markChanged();
    });
  },

  // Для всех селектов, КРОМЕ audioMode: с замком и btn_select
  _bindSelectLocked(page, id, key, onChange) {
    const sel = page.querySelector('#set-' + id);
    sel.addEventListener('change', () => {
      if (this.isLocked()) { sel.value = Settings.current[key]; return; }
      Settings.set(key, sel.value);
      this.playUI('btn_select');
      sel.classList.remove('pulse'); void sel.offsetWidth; sel.classList.add('pulse');
      if (onChange) onChange(sel.value);
      this.markChanged();
    });
  },

  _pageAudio(page) {
    const c = Settings.current;
    page.innerHTML = `
      ${this._rangeHTML('masterVol', 'Общая громкость', 0, 150, c.masterVolume, 'masterVol')}
      ${this._rangeHTML('effectsVol', 'Громкость эффектов', 0, 150, c.effectsVolume, 'effectsVol')}
      <div class="setting-group glass" data-tooltip="${TIPS.audioMode}">
        <label>
          <span>Режим звука:</span>
          <span class="tip-icon" aria-label="Справка">?</span>
        </label>
        <select id="set-audioMode">
          <option value="mono"   ${c.audioMode === 'mono'   ? 'selected' : ''}>Моно</option>
          <option value="stereo" ${c.audioMode === 'stereo' ? 'selected' : ''}>Стерео</option>
          <option value="dolby"  ${c.audioMode === 'dolby'  ? 'selected' : ''}>Dolby Vertical</option>
        </select>
      </div>
      <button id="btn-recommended" class="g-btn ghost wide">Рекомендуемые значения</button>
    `;
    this._bindRange(page, 'masterVol', 'masterVolume', () => this._fadeBus('music', this._musicBusTarget(), 120));
    this._bindRange(page, 'effectsVol', 'effectsVolume', () => this._fadeBus('effects', this._fxBusTarget(), 120));

    // ★ Специальный обработчик: без замка, с демо-звуком
    const sel = page.querySelector('#set-audioMode');
    sel.addEventListener('change', () => {
      // Применяем режим (без блокировки)
      Settings.set('audioMode', sel.value);
      this.markChanged();
      this._restartMusicWithMode();
      // Играем демо в этом режиме (обрывает предыдущий)
      this._playDemoForMode(sel.value);
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
    page.innerHTML = defs.map(d => `
      <div class="setting-group glass" data-tooltip="${TIPS[d.tip]}">
        <label>
          <span>${d.label}:</span>
          <span class="tip-icon" aria-label="Справка">?</span>
        </label>
        <select id="set-${d.id}">
          ${d.options.map(([v, t]) => `<option value="${v}" ${Settings.current[d.id] === v ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
    `).join('') + `<button id="btn-recommended" class="g-btn ghost wide">Рекомендуемые значения</button>`;
    defs.forEach(d => this._bindSelectLocked(page, d.id, d.id));
    this._bindRecommended(page, 'graphics', 'Сброс графики', 'Вернуть рекомендуемые настройки графики?');
  },

  _bindRecommended(page, category, title, text) {
    page.querySelector('#btn-recommended').onclick = async () => {
      if (this.isLocked()) return;
      const ok = await this.confirmDialog({ title, text, okText: 'Сбросить', cancelText: 'Отмена' });
      if (!ok) return;
      if (!(await this.playUI('reset'))) return;
      Settings.resetCategory(category);
      if (category === 'audio') {
        this.applyEngineVolumes(200);
        this._restartMusicWithMode();
      }
      this._refreshPage();
    };
  },

  _pageSystem(page) {
    page.innerHTML = `
      <div class="system-actions">
        <button id="btn-reset-settings" class="g-btn danger wide" data-tooltip="${TIPS.resetAll}">
          <span class="tip-icon btn-tip" aria-label="Справка">?</span>
          Сбросить все настройки
        </button>
        <button id="btn-clear-cache" class="g-btn danger wide" data-tooltip="${TIPS.clearCache}">
          <span class="tip-icon btn-tip" aria-label="Справка">?</span>
          Сбросить кэш медиа и кода
        </button>
      </div>
    `;
    page.querySelector('#btn-reset-settings').onclick = async () => {
      if (this.isLocked()) return;
      const ok = await this.confirmDialog({
        title: 'Сброс всех настроек',
        text: 'Вернуть ВСЕ настройки к заводским? Это нельзя отменить.',
        okText: 'Сбросить всё', cancelText: 'Отмена', danger: true
      });
      if (!ok) return;
      if (!(await this.playUI('reset'))) return;
      Settings.reset();
      this.applyEngineVolumes(200);
      this._restartMusicWithMode();
      this._refreshPage();
    };

    page.querySelector('#btn-clear-cache').onclick = async () => {
      if (this.isLocked()) return;
      const ok = await this.confirmDialog({
        title: 'Очистка кэша',
        text: 'Очистить кэш медиа и кода? Игра перезапустится.',
        okText: 'Очистить', cancelText: 'Отмена', danger: true
      });
      if (!ok) return;
      await this.playUI('reset');
      await this._stopMusic(250);
      this._cleanup();
      const reload = () => { localStorage.removeItem('woland_version'); location.reload(); };
      try {
        const req = indexedDB.deleteDatabase('woland_db');
        req.onsuccess = req.onerror = req.onblocked = reload;
      } catch (e) { console.warn(e); reload(); }
    };
  },

  // ==================== СОХРАНЕНИЕ ====================
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

  // ==================== СВОЁ МОДАЛЬНОЕ ОКНО ====================
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
        setTimeout(() => { overlay.remove(); resolve(result); }, 240);
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

  // ==================== КАПСУЛА-КАПЛЯ: ФИЗИКА ====================
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
    const innerW = r.width - pad * 2;
    this._ph.segW = innerW / TABS.length;
    this._ph.centers = TABS.map((_, i) => pad + this._ph.segW * (i + 0.5));
    pill.style.width  = (this._ph.segW - 8) + 'px';
    pill.style.height = (r.height - 10) + 'px';
  },

  _pillDown(e) {
    if (!this._active || this.isLocked() || this._pageBusy) return;
    const bar = document.getElementById('cat-bar');
    bar.setPointerCapture(e.pointerId);
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    this._ph.dragging = false;
    this._ph.moved = false;
    this._ph.downX = x;
    this._ph.downT = performance.now();
    this._ph.downIdx = clamp(Math.floor((x - this._ph.pad) / this._ph.segW), 0, TABS.length - 1);
    this._wakePill();
  },

  _pillMove(e) {
    const ph = this._ph;
    if (ph.downT === 0) return;
    const bar = document.getElementById('cat-bar');
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (!ph.moved && Math.abs(x - ph.downX) > 8) ph.moved = true;
    if (!ph.moved) return;
    ph.dragging = true;
    ph.target = clamp(x, ph.centers[0], ph.centers[TABS.length - 1]);
    const idx = clamp(Math.round((ph.target - ph.pad) / ph.segW - 0.5), 0, TABS.length - 1);
    if (idx !== ph.lastIdx) { ph.lastIdx = idx; ph.pop = 1; }
    this._wakePill();
  },

  _pillUp(e) {
    const ph = this._ph;
    if (ph.downT === 0) return;
    const wasDrag = ph.moved;
    const downIdx = ph.downIdx;
    ph.downT = 0;
    ph.dragging = false;
    try { document.getElementById('cat-bar').releasePointerCapture(e.pointerId); } catch (_) {}

    if (!wasDrag) {
      this.switchTab(TABS[downIdx].id);
      return;
    }
    const idx = clamp(Math.round((ph.x - ph.pad) / ph.segW - 0.5), 0, TABS.length - 1);
    ph.target = ph.centers[idx];
    this._wakePill();
    if (TABS[idx].id !== this.currentTab) this.switchTab(TABS[idx].id);
    else this.playUI('btn_select');
  },

  _pillCancel() {
    const ph = this._ph;
    ph.downT = 0;
    ph.dragging = false;
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
      const s = ph.dragging ? SPRING_DRAG : SPRING_RELEASE;
      const n = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        const a = s.k * (ph.target - ph.x) - s.c * ph.v;
        ph.v += a * h;
        ph.x += ph.v * h;
      }
      ph.pop *= Math.exp(-7 * dt);
      this._renderPill();
      if (!ph.dragging && Math.abs(ph.v) < 1 && Math.abs(ph.target - ph.x) < 0.25) {
        ph.x = ph.target; ph.v = 0;
        this._renderPill();
        return;
      }
      ph.raf = requestAnimationFrame(frame);
    };
    ph.raf = requestAnimationFrame(frame);
  },

  _sleepPill() {
    if (this._ph.raf !== null) { cancelAnimationFrame(this._ph.raf); this._ph.raf = null; }
  },

  _renderPill() {
    const pill = document.getElementById('cat-pill');
    if (!pill) return;
    const ph = this._ph;
    let sx = 1, sy = 1, skew = 0;
    if (!this._reducedMotion) {
      const s = Math.min(Math.abs(ph.v) / STRETCH_DIV, STRETCH_MAX);
      sx = 1 + s - ph.pop * 0.05;
      sy = 1 - s * 0.55 + ph.pop * 0.14;
      skew = clamp(-ph.v / 160, -9, 9);
    } else {
      ph.x = ph.target; ph.v = 0;
    }
    pill.style.transform =
      `translate3d(${ph.x}px,0,0) translate(-50%,-50%) skewX(${skew}deg) scale(${sx},${sy})`;
  },

  // ==================== СТИЛИ ====================
  _css() { return `
    .settings-layout {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      background: #050407; color: #fff; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .settings-layout::before {
      content: ''; position: absolute; inset: 0; pointer-events: none;
      background:
        radial-gradient(60% 45% at 18% 8%, rgba(120,0,10,.35), transparent 70%),
        radial-gradient(55% 45% at 85% 92%, rgba(40,10,70,.4), transparent 70%),
        radial-gradient(40% 30% at 70% 30%, rgba(255,255,255,.04), transparent 70%);
    }
    .settings-layout::after {
      content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .05;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    .settings-layout > * { position: relative; z-index: 1; }

    .glass, .g-btn, .cat-bar, .pill {
      background: rgba(255,255,255,.055);
      border: 1px solid rgba(255,255,255,.14);
      -webkit-backdrop-filter: blur(14px) saturate(1.5);
      backdrop-filter: blur(14px) saturate(1.5);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(255,255,255,.05), 0 8px 24px rgba(0,0,0,.35);
    }

    .settings-header {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 14px 16px; padding-top: calc(14px + env(safe-area-inset-top));
    }
    .settings-title { font-size: 17px; font-weight: 700; letter-spacing: .3px; opacity: .9; }

    .g-btn {
      position: relative; padding: 11px 22px; font-size: 15px; color: #fff; cursor: pointer;
      border-radius: 999px; overflow: hidden;
      transition: transform .22s cubic-bezier(.34,1.56,.64,1), background .25s ease, border-color .25s ease, opacity .25s ease;
    }
    .g-btn::before {
      content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
      background: linear-gradient(180deg, rgba(255,255,255,.22), transparent 45%);
    }
    .g-btn:hover { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.3); }
    .g-btn:active { transform: scale(.94); }
    .g-btn.primary { background: rgba(255,20,20,.2); border-color: rgba(255,70,70,.55); }
    .g-btn.primary:hover { background: rgba(255,30,30,.32); }
    .g-btn.danger { background: rgba(120,0,0,.45); border-color: rgba(255,0,0,.6); }
    .g-btn.danger:hover { background: rgba(160,0,0,.55); }
    .g-btn.wide { width: 100%; max-width: 420px; padding: 14px; }

    .save-btn { opacity: 0; transform: scale(.85); pointer-events: none; }
    .save-btn.show { opacity: 1; transform: none; pointer-events: auto; }

    .settings-pages { position: relative; flex: 1; overflow: hidden; }
    .settings-page {
      position: absolute; inset: 0; overflow-y: auto; padding: 18px 16px 24px;
      display: flex; flex-direction: column; align-items: center; gap: 14px;
    }
    .settings-page > * { animation: wm-rise .45s cubic-bezier(.32,.72,0,1) both; animation-delay: calc(var(--i,0) * 45ms); }
    @keyframes wm-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

    .setting-group { width: 100%; max-width: 420px; padding: 14px 16px; border-radius: 18px; display: flex; flex-direction: column; gap: 10px; }
    .setting-group label {
      font-size: 14px; color: #d8d8dc; display: flex; justify-content: space-between; align-items: center;
    }
    .setting-group label > span:first-child { color: #d8d8dc; }
    .setting-group label span span { color: #fff; font-weight: 600; }

    .tip-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; border-radius: 50%; font-size: 11px; font-weight: 700;
      background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.2);
      color: rgba(255,255,255,.75); cursor: help; flex-shrink: 0;
      transition: background .2s ease, border-color .2s ease, transform .15s ease;
    }
    .tip-icon:hover { background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.45); }
    .tip-icon:active { transform: scale(.9); }
    .tip-icon.btn-tip {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      z-index: 2;
    }
    .g-btn.wide { position: relative; }

    input[type="range"] {
      -webkit-appearance: none; appearance: none; width: 100%; height: 8px; border-radius: 999px; cursor: pointer;
      background: linear-gradient(90deg, rgba(255,40,40,.85) var(--p,50%), rgba(255,255,255,.12) var(--p,50%));
      box-shadow: inset 0 1px 2px rgba(0,0,0,.5);
      outline: none;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%;
      background: radial-gradient(circle at 32% 28%, rgba(255,255,255,.95), rgba(255,255,255,.35) 40%, rgba(200,200,210,.25));
      border: 1px solid rgba(255,255,255,.5);
      box-shadow: 0 2px 8px rgba(0,0,0,.55), inset 0 1px 1px rgba(255,255,255,.7), 0 0 10px rgba(255,0,0,.25);
      transition: transform .18s cubic-bezier(.34,1.56,.64,1);
    }
    input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.12); }
    input[type="range"]:active::-webkit-slider-thumb { transform: scale(1.2); }
    input[type="range"]::-moz-range-thumb {
      width: 24px; height: 24px; border-radius: 50%;
      background: radial-gradient(circle at 32% 28%, rgba(255,255,255,.95), rgba(255,255,255,.35) 40%, rgba(200,200,210,.25));
      border: 1px solid rgba(255,255,255,.5);
      box-shadow: 0 2px 8px rgba(0,0,0,.55), inset 0 1px 1px rgba(255,255,255,.7);
    }

    .setting-group select {
      appearance: none; -webkit-appearance: none;
      padding: 12px 40px 12px 14px; font-size: 15px; color: #fff; cursor: pointer;
      background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16); border-radius: 14px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='white' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 14px center;
      transition: border-color .2s ease, background .2s ease, transform .2s ease;
    }
    .setting-group select:hover { border-color: rgba(255,255,255,.35); }
    .setting-group select:focus { outline: none; border-color: rgba(255,70,70,.6); box-shadow: 0 0 0 3px rgba(255,0,0,.15); }
    .setting-group select option { background: #14101a; color: #fff; }
    .setting-group select.pulse { animation: wm-pulse .3s ease; }
    @keyframes wm-pulse { 50% { transform: scale(1.025); } }

    .system-actions { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 420px; align-items: center; }

    .cat-bar-wrap { padding: 12px 14px; padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
    .cat-bar {
      position: relative; display: flex; height: 58px; border-radius: 999px;
      touch-action: none; user-select: none; -webkit-user-select: none;
      max-width: 560px; margin: 0 auto;
    }
    .cat-btn {
      flex: 1; position: relative; z-index: 2; background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,.55); font-size: 14px; font-weight: 600; border-radius: 999px;
      transition: color .25s ease, transform .2s cubic-bezier(.34,1.56,.64,1);
    }
    .cat-btn:active { transform: scale(.94); }
    .cat-btn.active { color: #fff; text-shadow: 0 0 12px rgba(255,60,60,.5); }
    .cat-btn:focus-visible { outline: 2px solid rgba(255,70,70,.7); outline-offset: -4px; }

    .pill {
      position: absolute; left: 0; top: 50%; z-index: 1; border-radius: 999px;
      will-change: transform; pointer-events: none;
      background: rgba(255,60,60,.14);
      border: 1px solid rgba(255,120,120,.35);
      -webkit-backdrop-filter: blur(3px) saturate(1.7) brightness(1.08);
      backdrop-filter: blur(3px) saturate(1.7) brightness(1.08);
      box-shadow: inset 0 1px 1px rgba(255,255,255,.5), inset 0 -1px 1px rgba(255,255,255,.12), 0 4px 16px rgba(255,0,0,.2);
    }
    .pill-lens {
      position: absolute; inset: 0; border-radius: inherit;
      -webkit-backdrop-filter: url(#wm-liquid);
      backdrop-filter: url(#wm-liquid);
    }
    .pill::after {
      content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
      background: linear-gradient(180deg, rgba(255,255,255,.3), transparent 40%, rgba(255,255,255,.06));
    }

    .settings-layout.sound-locked button,
    .settings-layout.sound-locked select,
    .settings-layout.sound-locked .cat-bar { pointer-events: none; }
    .settings-layout.sound-locked { cursor: progress; }
    /* Демо-звук не блокирует: audioMode-селект всегда кликабельный */
    #set-audioMode { pointer-events: auto !important; }

    .wm-overlay {
      position: absolute; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0); -webkit-backdrop-filter: blur(0); backdrop-filter: blur(0);
      transition: background .24s ease, backdrop-filter .24s ease, -webkit-backdrop-filter .24s ease;
    }
    .wm-overlay.show { background: rgba(0,0,0,.55); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
    .wm-dialog {
      width: min(92%, 380px); padding: 22px; border-radius: 24px;
      background: rgba(22,16,24,.82);
      transform: translateY(16px) scale(.94); opacity: 0;
      transition: transform .26s cubic-bezier(.32,.72,0,1), opacity .22s ease;
    }
    .wm-overlay.show .wm-dialog { transform: none; opacity: 1; }
    .wm-dialog-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    .wm-dialog-text { font-size: 14px; color: #cfcfd4; line-height: 1.45; margin-bottom: 18px; }
    .wm-dialog-buttons { display: flex; gap: 10px; }
    .wm-dialog-buttons .g-btn { flex: 1; }

    .wm-tooltip {
      position: fixed; z-index: 120; padding: 10px 14px; max-width: 280px;
      background: rgba(30,20,35,.94); color: #fff; font-size: 13px; line-height: 1.4;
      border: 1px solid rgba(255,255,255,.16); border-radius: 12px;
      -webkit-backdrop-filter: blur(10px) saturate(1.4);
      backdrop-filter: blur(10px) saturate(1.4);
      box-shadow: 0 8px 24px rgba(0,0,0,.6);
      opacity: 0; transform: translateY(4px);
      transition: opacity .18s ease, transform .18s ease;
      pointer-events: none;
    }
    .wm-tooltip.show { opacity: 1; transform: none; }

    @media (prefers-reduced-motion: reduce) {
      .settings-page > * { animation: none; }
      .g-btn, .cat-btn, .wm-dialog, input[type="range"]::-webkit-slider-thumb, .wm-tooltip { transition: none; }
    }
  `; }
};
