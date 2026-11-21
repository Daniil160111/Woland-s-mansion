// Блоки/settings.js

import { Settings } from '../Фон/settings-manager.js';

export const SettingsMenu = {
  activeCategory: 'audio',
  hasUnsavedChanges: false,
  currentTab: 'audio', // 'audio', 'brightness', 'graphics', 'system'

  start() {
    const container = document.getElementById('game-container');
    if (!container) throw new Error('game-container not found');

    // Применяем настройки при входе
    Settings.init();

    this.renderUI(container);
  },

  renderUI(container) {
    container.innerHTML = `
      <div class="settings-layout">
        <!-- Категории -->
        <div class="settings-sidebar">
          <button class="cat-btn ${this.currentTab === 'audio' ? 'active' : ''}" data-cat="audio">Звук</button>
          <button class="cat-btn ${this.currentTab === 'brightness' ? 'active' : ''}" data-cat="brightness">Яркость</button>
          <button class="cat-btn ${this.currentTab === 'graphics' ? 'active' : ''}" data-cat="graphics">Графика</button>
          <button class="cat-btn ${this.currentTab === 'system' ? 'active' : ''}" data-cat="system">Система</button>
        </div>

        <!-- Контент категории -->
        <div class="settings-content" id="settings-content">
          <!-- Сюда рендерится контент -->
        </div>

        <!-- Футер -->
        <div class="settings-footer">
          <button id="btn-settings-back" class="btn-settings secondary">Выйти</button>
          <button id="btn-settings-save" class="btn-settings primary" style="display: ${this.hasUnsavedChanges ? 'block' : 'none'};">Сохранить</button>
        </div>
      </div>
      
      <style>
        .settings-layout {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          background: #050407; color: #fff;
        }
        .settings-sidebar {
          display: flex; justify-content: center; gap: 10px;
          padding: 20px; background: rgba(0,0,0,0.5); flex-wrap: wrap;
        }
        .cat-btn {
          padding: 10px 20px; background: transparent; border: 2px solid #333;
          color: #aaa; font-size: 16px; cursor: pointer; border-radius: 8px;
          transition: all 0.3s;
        }
        .cat-btn.active {
          border-color: #f00; color: #fff; background: rgba(255,0,0,0.2);
          box-shadow: 0 0 10px rgba(255,0,0,0.4);
        }
        
        .settings-content {
          flex: 1; overflow-y: auto; padding: 20px;
          display: flex; flex-direction: column; align-items: center;
          gap: 15px;
        }
        
        /* Стили для ползунков */
        .setting-group {
          width: 100%; max-width: 400px;
          display: flex; flex-direction: column; gap: 5px;
        }
        .setting-group label {
          font-size: 14px; color: #ccc; display: flex; justify-content: space-between;
        }
        .setting-group input[type="range"] {
          width: 100%; accent-color: #f00; cursor: pointer;
        }

        /* Стили для переключателей */
        .setting-group select {
          padding: 10px; background: #111; color: #fff;
          border: 1px solid #555; border-radius: 5px; font-size: 16px;
        }

        /* Футер */
        .settings-footer {
          padding: 20px; display: flex; justify-content: space-between;
          background: rgba(0,0,0,0.8);
        }
        .btn-settings {
          padding: 12px 30px; font-size: 16px; cursor: pointer;
          border-radius: 8px; border: 2px solid #555; background: transparent; color: #fff;
        }
        .btn-settings.primary { background: #800000; border-color: #f00; }
        .btn-settings.primary:hover { background: #a00000; }
        .btn-settings.secondary:hover { border-color: #fff; }

        /* Стили для системы */
        .system-actions { display: flex; flex-direction: column; gap: 15px; width: 100%; max-width: 400px; }
        .btn-danger {
          padding: 15px; background: #500; border: 2px solid #f00;
          color: #fff; border-radius: 8px; cursor: pointer; font-size: 16px;
        }
        .btn-danger:hover { background: #700; }
      </style>
    `;

    // Обработчики вкладок
    container.querySelectorAll('.cat-btn').forEach(btn => {
      btn.onclick = () => {
        this.currentTab = btn.dataset.cat;
        if (window.SoundsEngine) window.SoundsEngine.play('btn_click', { type: 'effects', dolby: false });
        this.renderUI(container);
      };
    });

    // Рендерим контент в зависимости от вкладки
    this.renderTabContent(container);

    // Кнопка "Выйти"
    container.querySelector('#btn-settings-back').onclick = () => {
      if (this.hasUnsavedChanges) {
        // Показываем подтверждение
        if (confirm('Сохранить несохранённые изменения?')) {
          this.saveSettings();
        }
      }
      if (window.SoundsEngine) window.SoundsEngine.play('btn_back', { type: 'effects', dolby: false });
      import('./menu.js').then(mod => {
        if (mod && mod.Menu) mod.Menu.start('menu');
      });
    };

    // Кнопка "Сохранить" (появляется только если есть изменения)
    const saveBtn = container.querySelector('#btn-settings-save');
    if (saveBtn) {
      saveBtn.onclick = () => {
        this.saveSettings();
      };
    }
  },

  renderTabContent(container) {
    const content = container.querySelector('#settings-content');
    content.innerHTML = '';

    if (this.currentTab === 'audio') {
      this.renderAudioTab(content);
    } else if (this.currentTab === 'brightness') {
      this.renderBrightnessTab(content);
    } else if (this.currentTab === 'graphics') {
      this.renderGraphicsTab(content);
    } else if (this.currentTab === 'system') {
      this.renderSystemTab(content);
    }
  },

  // --- ЗВУК ---
  renderAudioTab(content) {
    content.innerHTML = `
      <div class="setting-group">
        <label>Общая громкость: <span id="val-masterVol">${Settings.current.masterVolume}</span></label>
        <input type="range" id="set-masterVol" min="0" max="150" value="${Settings.current.masterVolume}">
      </div>
      <div class="setting-group">
        <label>Громкость эффектов: <span id="val-effectsVol">${Settings.current.effectsVolume}</span></label>
        <input type="range" id="set-effectsVol" min="0" max="150" value="${Settings.current.effectsVolume}">
      </div>
      <div class="setting-group">
        <label>Режим звука:</label>
        <select id="set-audioMode">
          <option value="mono" ${Settings.current.audioMode === 'mono' ? 'selected' : ''}>Моно</option>
          <option value="stereo" ${Settings.current.audioMode === 'stereo' ? 'selected' : ''}>Стерео</option>
          <option value="dolby" ${Settings.current.audioMode === 'dolby' ? 'selected' : ''}>Dolby Surround</option>
        </select>
      </div>
      
      <button id="btn-recommended-audio" class="btn-settings secondary" style="margin-top: 20px;">Рекомендуемые значения</button>
    `;

    // Обработчики
    const masterVol = content.querySelector('#set-masterVol');
    masterVol.oninput = (e) => {
      const val = parseInt(e.target.value);
      content.querySelector('#val-masterVol').textContent = val;
      Settings.set('masterVolume', val);
      this.markChanged();
    };

    const effectsVol = content.querySelector('#set-effectsVol');
    effectsVol.oninput = (e) => {
      const val = parseInt(e.target.value);
      content.querySelector('#val-effectsVol').textContent = val;
      Settings.set('effectsVolume', val);
      this.markChanged();
    };

    const audioMode = content.querySelector('#set-audioMode');
    audioMode.onchange = (e) => {
      Settings.set('audioMode', e.target.value);
      if (window.SoundsEngine) window.SoundsEngine.play('btn_select', { type: 'effects', dolby: false });
      this.markChanged();
    };

    content.querySelector('#btn-recommended-audio').onclick = () => {
      if (confirm('Сбросить настройки звука к рекомендуемым?')) {
        if (window.SoundsEngine) window.SoundsEngine.play('reset', { type: 'effects', dolby: false });
        Settings.resetCategory('audio');
        this.renderUI(document.getElementById('game-container'));
      }
    };
  },

  // --- ЯРКОСТЬ ---
  renderBrightnessTab(content) {
    content.innerHTML = `
      <div class="setting-group">
        <label>Яркость: <span id="val-brightness">${Settings.current.brightness}</span></label>
        <input type="range" id="set-brightness" min="0" max="150" value="${Settings.current.brightness}">
      </div>
      <div class="setting-group">
        <label>Минимальная яркость: <span id="val-minBrightness">${Settings.current.minBrightness}</span></label>
        <input type="range" id="set-minBrightness" min="0" max="50" value="${Settings.current.minBrightness}">
      </div>
      
      <button id="btn-recommended-brightness" class="btn-settings secondary" style="margin-top: 20px;">Рекомендуемые значения</button>
    `;

    const brightness = content.querySelector('#set-brightness');
    brightness.oninput = (e) => {
      const val = parseInt(e.target.value);
      content.querySelector('#val-brightness').textContent = val;
      Settings.set('brightness', val);
      this.markChanged();
    };

    const minBrightness = content.querySelector('#set-minBrightness');
    minBrightness.oninput = (e) => {
      const val = parseInt(e.target.value);
      content.querySelector('#val-minBrightness').textContent = val;
      Settings.set('minBrightness', val);
      this.markChanged();
    };

    content.querySelector('#btn-recommended-brightness').onclick = () => {
      if (confirm('Сбросить настройки яркости к рекомендуемым?')) {
        if (window.SoundsEngine) window.SoundsEngine.play('reset', { type: 'effects', dolby: false });
        Settings.resetCategory('brightness');
        this.renderUI(document.getElementById('game-container'));
      }
    };
  },

  // --- ГРАФИКА ---
  renderGraphicsTab(content) {
    const graphicsSettings = [
      { id: 'aspectRatio', label: 'Соотношение сторон', options: [['auto', 'Авто'], ['4:3', '4:3'], ['16:9', '16:9'], ['20:9', '20:9'], ['21:9', '21:9'], ['16:10', '16:10']] },
      { id: 'shadows', label: 'Тени', options: [['ultra', 'Ультра'], ['high', 'Высокие'], ['medium', 'Средние'], ['low', 'Низкие'], ['simple', 'Простые'], ['off', 'Выкл']] },
      { id: 'realisticLight', label: 'Реалистичный свет', options: [['ultra', 'Ультра'], ['high', 'Высокий'], ['medium', 'Средний'], ['low', 'Низкий']] },
      { id: 'render3D', label: '3D-рендер', options: [['no_distortion', 'Без искажений'], ['ultra', 'Ультра'], ['high', 'Высокий'], ['medium', 'Средний'], ['low', 'Низкий']] },
      { id: 'textureQuality', label: 'Качество текстур', options: [['ultra', 'Ультра'], ['high', 'Высокий'], ['medium', 'Средний'], ['low', 'Низкий']] },
      { id: 'drawDistance', label: 'Дальность прорисовки', options: [['no_simplification', 'Без упрощений'], ['far', 'Дальний'], ['near', 'Недалёкий'], ['close', 'Ближний']] }
    ];

    let html = '';
    graphicsSettings.forEach(setting => {
      html += `
        <div class="setting-group">
          <label>${setting.label}:</label>
          <select id="set-${setting.id}">
            ${setting.options.map(([val, text]) => `
              <option value="${val}" ${Settings.current[setting.id] === val ? 'selected' : ''}>${text}</option>
            `).join('')}
          </select>
        </div>
      `;
    });

    html += `<button id="btn-recommended-graphics" class="btn-settings secondary" style="margin-top: 20px;">Рекомендуемые значения</button>`;
    content.innerHTML = html;

    // Обработчики для селектов
    graphicsSettings.forEach(setting => {
      const select = content.querySelector(`#set-${setting.id}`);
      select.onchange = (e) => {
        Settings.set(setting.id, e.target.value);
        if (window.SoundsEngine) window.SoundsEngine.play('btn_select', { type: 'effects', dolby: false });
        this.markChanged();
      };
    });

    content.querySelector('#btn-recommended-graphics').onclick = () => {
      if (confirm('Сбросить настройки графики к рекомендуемым?')) {
        if (window.SoundsEngine) window.SoundsEngine.play('reset', { type: 'effects', dolby: false });
        Settings.resetCategory('graphics');
        this.renderUI(document.getElementById('game-container'));
      }
    };
  },

  // --- СИСТЕМА ---
  renderSystemTab(content) {
    content.innerHTML = `
      <div class="system-actions">
        <button id="btn-reset-settings" class="btn-danger">Сбросить все настройки</button>
        <button id="btn-clear-cache" class="btn-danger">Сбросить кэш медиа и кода</button>
      </div>
    `;

    content.querySelector('#btn-reset-settings').onclick = () => {
      if (confirm('Сбросить ВСЕ настройки к заводским? Это нельзя отменить.')) {
        if (window.SoundsEngine) window.SoundsEngine.play('reset', { type: 'effects', dolby: false });
        Settings.reset();
        this.renderUI(document.getElementById('game-container'));
      }
    };

    content.querySelector('#btn-clear-cache').onclick = async () => {
      if (confirm('Очистить кэш медиа и кода? Игра перезапустится.')) {
        if (window.SoundsEngine) window.SoundsEngine.play('reset', { type: 'effects', dolby: false });
        
        // Чистим IndexedDB
        try {
          const DB_NAME = 'woland_db';
          const req = indexedDB.deleteDatabase(DB_NAME);
          req.onsuccess = () => {
            localStorage.removeItem('woland_version');
            location.reload();
          };
          req.onerror = () => {
            console.warn('Не удалось удалить БД');
            location.reload();
          };
        } catch(e) {
          console.warn(e);
          location.reload();
        }
      }
    };
  },

  // Вспомогательные методы
  markChanged() {
    this.hasUnsavedChanges = true;
    const saveBtn = document.querySelector('#btn-settings-save');
    if (saveBtn) saveBtn.style.display = 'block';
  },

  saveSettings() {
    if (window.SoundsEngine) window.SoundsEngine.play('transition', { type: 'effects', dolby: false });
    Settings.save();
    this.hasUnsavedChanges = false;
    const saveBtn = document.querySelector('#btn-settings-save');
    if (saveBtn) saveBtn.style.display = 'none';
  }
};
