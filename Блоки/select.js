// Блоки/select.js

export const Select = {
  currentMode: null, // 'one_player', 'two_players', 'one_player_endless', 'two_players_endless'
  currentDifficulty: 'normal',
  isHardcore: false,

  difficulties: {
    ghost: {
      name: 'Призрак',
      speed: 0.7,
      desc: 'Воланд двигается медленно. Он полупрозрачный и не может вас видеть или атаковать. Идеально для изучения особняка.',
      filter: 'opacity(0.4) grayscale(80%) blur(1px)',
      vignette: 'transparent'
    },
    easy: {
      name: 'Лёгкая',
      speed: 0.7,
      desc: 'Воланд двигается медленно, но уже может вас видеть и атаковать. Отличный старт для новичков.',
      filter: 'none',
      vignette: 'rgba(0,0,0,0.3)'
    },
    normal: {
      name: 'Нормальная',
      speed: 1.0,
      desc: 'Классический баланс. Воланд двигается с обычной скоростью и представляет реальную угрозу.',
      filter: 'none',
      vignette: 'rgba(0,0,0,0.5)'
    },
    hard: {
      name: 'Сложная',
      speed: 1.2,
      desc: 'Воланд быстрее. Дальность обзора ухудшена чёрным туманом по краям экрана.',
      filter: 'none',
      vignette: 'rgba(0,0,0,0.7)'
    },
    horror: {
      name: 'Ужасная',
      speed: 1.3,
      desc: 'Воланд быстрее и агрессивнее. Туман сильнее. Он может стрелять снарядами даже вне босс-файта.',
      filter: 'none',
      vignette: 'rgba(0,0,0,0.85)'
    },
    impossible: {
      name: 'Невозможная',
      speed: 1.5,
      desc: 'Максимальная скорость. Воланд стреляет очень часто. Выжить почти невозможно.',
      filter: 'none',
      vignette: 'rgba(0,0,0,0.95)'
    },
    custom: {
      name: 'Настраиваемая',
      speed: 1.0,
      desc: 'Настройте скорость Воланда и другие параметры под себя.',
      filter: 'none',
      vignette: 'rgba(0,0,0,0.5)'
    }
  },

  start(mode) {
    this.currentMode = mode;
    this.currentDifficulty = 'normal';
    this.isHardcore = false;

    const container = document.getElementById('game-container');
    if (!container) throw new Error('game-container not found');

    // Если это не одиночный сюжет, показываем заглушку
    if (mode !== 'one_player') {
      this.renderStub(container, mode);
      return;
    }

    // Рендер экрана выбора сложности
    this.renderSinglePlayer(container);
  },

  // --- ЗАГЛУШКИ ДЛЯ ДРУГИХ РЕЖИМОВ ---
  renderStub(container, mode) {
    let title = "В разработке";
    if (mode === 'two_players') title = "Мультиплеер в разработке";
    if (mode === 'one_player_endless') title = "Бесконечный режим в разработке";
    if (mode === 'two_players_endless') title = "Мультиплеер Endless в разработке";

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:#050407; color:#fff; text-align:center;">
        <h1 style="font-size:clamp(24px, 5vh, 48px); text-shadow: 0 0 20px #f00; margin-bottom: 20px;">${title}</h1>
        <p style="color:#aaa; margin-bottom: 40px;">Здесь скоро что-то будет...</p>
        <button class="btn-back" style="padding: 12px 30px; background: #500; color: #fff; border: 2px solid #f00; border-radius: 8px; cursor: pointer; transition: all 0.2s;">Назад</button>
      </div>
    `;

    const backBtn = container.querySelector('.btn-back');
    backBtn.onclick = () => {
      if (window.SoundsEngine) window.SoundsEngine.play('btn_back', { type: 'effects' });
      import('./menu.js').then(mod => {
        if (mod && mod.Menu) mod.Menu.start('menu');
      });
    };
  },

  // --- ЭКРАН ОДИНОЧНОЙ ИГРЫ ---
  renderSinglePlayer(container) {
    const diff = this.difficulties[this.currentDifficulty];
    const isGhost = this.currentDifficulty === 'ghost';

    container.innerHTML = `
      <div class="select-layout">
        
        <!-- Сверху: 3D-сцена с коридором и Воландом -->
        <div class="select-scene">
          <div class="scene-wall"></div>
          <div class="scene-floor"></div>
          <img class="scene-voland" src="./Текстуры/Воланд/Воланд0.png" alt="Voland" onerror="this.style.display='none';">
          <!-- Виньетка (туман по краям) -->
          <div class="scene-vignette" style="background: radial-gradient(ellipse at center, transparent 30%, ${diff.vignette} 100%);"></div>
        </div>

        <!-- В центре: Выбор сложности -->
        <div class="select-content">
          <h2 class="select-title">Выберите сложность</h2>
          
          <div class="difficulty-grid">
            ${Object.keys(this.difficulties).map(key => {
              const d = this.difficulties[key];
              const isActive = this.currentDifficulty === key;
              return `
                <button class="diff-btn ${isActive ? 'active' : ''}" data-diff="${key}">
                  <span class="diff-name">${d.name}</span>
                </button>
              `;
            }).join('')}
          </div>

          <!-- Описание выбранной сложности -->
          <div class="diff-description">
            <p id="diff-desc-text">${diff.desc}</p>
          </div>

          <!-- Настройка кастомной сложности (скрыта, если выбрана не она) -->
          <div class="custom-settings" id="custom-settings" style="display: ${this.currentDifficulty === 'custom' ? 'block' : 'none'};">
            <label>Скорость Воланда: <input type="range" id="custom-speed" min="0.5" max="2.0" step="0.1" value="1.0"></label>
            <span id="custom-speed-val">1.0</span>
          </div>

          <!-- Хардкор (1 HP) -->
          <div class="hardcore-option" style="display: ${isGhost ? 'none' : 'block'};">
            <label>
              <input type="checkbox" id="hardcore-checkbox" ${this.isHardcore ? 'checked' : ''}>
              Хардкор (1 HP)
            </label>
          </div>
        </div>

        <!-- Внизу: Кнопки Старт и Назад -->
        <div class="select-footer">
          <button class="btn-start" id="btn-start" ${!this.currentDifficulty ? 'disabled' : ''}>Играть</button>
          <button class="btn-back" id="btn-back">Назад</button>
        </div>

      </div>

      <style>
        .select-layout {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          background: #050407; color: #fff; font-family: 'WolandFont', monospace;
          overflow-y: auto;
        }

        /* 3D-Сцена */
        .select-scene {
          flex: 0 0 30vh; position: relative; overflow: hidden;
          background: #000;
        }
        .scene-wall {
          position: absolute; inset: 0;
          background: linear-gradient(to bottom, #1a1010, #0a0505);
        }
        .scene-floor {
          position: absolute; bottom: 0; left: 0; width: 100%; height: 50%;
          background: linear-gradient(to top, #2a1515, #0a0505);
          transform: perspective(500px) rotateX(60deg);
          transform-origin: bottom;
        }
        .scene-voland {
          position: absolute; bottom: 10%; left: 50%; transform: translateX(-50%);
          height: 80%; object-fit: contain;
          transition: filter 0.5s ease, animation 0.5s ease;
          filter: ${diff.filter};
          animation: walk-towards ${4 / diff.speed}s infinite linear;
        }
        .scene-vignette {
          position: absolute; inset: 0; pointer-events: none;
          transition: background 0.5s ease;
        }

        @keyframes walk-towards {
          0% { transform: translateX(-50%) scale(0.7); opacity: 0.5; }
          50% { transform: translateX(-50%) scale(1.1); opacity: 1; }
          100% { transform: translateX(-50%) scale(1.4); opacity: 0; }
        }

        /* Выбор сложности */
        .select-content {
          flex: 1; padding: 20px;
          display: flex; flex-direction: column; align-items: center; gap: 15px;
        }
        .select-title {
          font-size: clamp(16px, 2.5vh, 24px); color: #ccc; letter-spacing: 2px;
        }
        .difficulty-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 10px; width: 100%; max-width: 600px;
        }
        .diff-btn {
          padding: 10px; background: rgba(255,255,255,0.05); border: 2px solid #333;
          color: #aaa; border-radius: 8px; cursor: pointer; transition: all 0.2s;
          font-size: clamp(12px, 1.8vh, 16px);
        }
        .diff-btn:hover {
          border-color: #888; color: #fff; background: rgba(255,255,255,0.1);
        }
        .diff-btn.active {
          border-color: #f00; color: #fff; background: rgba(255,0,0,0.2);
          box-shadow: 0 0 15px rgba(255,0,0,0.5);
        }
        .diff-description {
          width: 100%; max-width: 600px; text-align: center; min-height: 40px;
          color: #bbb; font-size: clamp(12px, 1.6vh, 14px); line-height: 1.4;
        }

        .custom-settings {
          width: 100%; max-width: 400px; padding: 10px;
          background: rgba(255,255,255,0.05); border: 1px solid #333; border-radius: 8px;
          font-size: 14px;
        }
        .custom-settings input[type="range"] { width: 100%; margin-top: 10px; }

        .hardcore-option {
          margin-top: 10px; padding: 10px;
          background: rgba(255,0,0,0.1); border: 1px solid #800; border-radius: 8px;
        }
        .hardcore-option label { cursor: pointer; font-size: 16px; color: #ff7777; }
        .hardcore-option input[type="checkbox"] { margin-right: 10px; transform: scale(1.3); }

        /* Футер (Кнопки) */
        .select-footer {
          padding: 20px; display: flex; justify-content: center; gap: 20px;
          background: rgba(0,0,0,0.8);
        }
        .btn-start {
          padding: 12px 40px; background: linear-gradient(135deg, #b33333, #500);
          color: #fff; border: 2px solid #ff5555; border-radius: 8px;
          font-size: clamp(16px, 2.5vh, 20px); cursor: pointer; letter-spacing: 2px;
          box-shadow: 0 0 20px rgba(255,0,0,0.5); transition: all 0.2s;
        }
        .btn-start:hover:not(:disabled) { background: linear-gradient(135deg, #ff5555, #800); transform: scale(1.05); }
        .btn-start:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(100%); }
        
        .btn-back {
          padding: 12px 30px; background: transparent; color: #888;
          border: 2px solid #555; border-radius: 8px; font-size: clamp(14px, 2vh, 18px);
          cursor: pointer; transition: all 0.2s;
        }
        .btn-back:hover { color: #fff; border-color: #fff; }
      </style>
    `;

    const containerEl = container.querySelector('.select-layout');
    const diffButtons = container.querySelectorAll('.diff-btn');
    const descText = container.querySelector('#diff-desc-text');
    const volandEl = container.querySelector('.scene-voland');
    const vignetteEl = container.querySelector('.scene-vignette');
    const hardcoreOption = container.querySelector('.hardcore-option');
    const hardcoreCheckbox = container.querySelector('#hardcore-checkbox');
    const customSettings = container.querySelector('#custom-settings');

    // Логика выбора сложности
    diffButtons.forEach(btn => {
      btn.onclick = () => {
        const diffKey = btn.dataset.diff;
        this.currentDifficulty = diffKey;
        const d = this.difficulties[diffKey];
        const isGhost = diffKey === 'ghost';

        if (window.SoundsEngine) window.SoundsEngine.play('btn_select', { type: 'effects' });

        // Обновляем активную кнопку
        diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Обновляем описание
        descText.textContent = d.desc;

        // Обновляем визуал Воланда
        if (volandEl) {
          volandEl.style.filter = d.filter;
          volandEl.style.animation = 'none';
          void volandEl.offsetWidth;
          volandEl.style.animation = `walk-towards ${4 / d.speed}s infinite linear`;
        }

        // Обновляем туман
        if (vignetteEl) {
          vignetteEl.style.background = `radial-gradient(ellipse at center, transparent 30%, ${d.vignette} 100%)`;
        }

        // Показываем/скрываем кастомные настройки
        customSettings.style.display = diffKey === 'custom' ? 'block' : 'none';

        // Блокируем Хардкор для Призрака
        if (isGhost) {
          hardcoreOption.style.display = 'none';
          this.isHardcore = false; // Сбрасываем, если был включен
        } else {
          hardcoreOption.style.display = 'block';
        }

        // Активируем кнопку "Играть"
        const startBtn = container.querySelector('#btn-start');
        if (startBtn) startBtn.disabled = false;
      };
    });

    // Кастомная скорость
    const speedInput = container.querySelector('#custom-speed');
    if (speedInput) {
      speedInput.oninput = (e) => {
        container.querySelector('#custom-speed-val').textContent = e.target.value;
        this.difficulties.custom.speed = parseFloat(e.target.value);
        // Обновляем скорость анимации
        if (volandEl) {
          volandEl.style.animation = 'none';
          void volandEl.offsetWidth;
          volandEl.style.animation = `walk-towards ${4 / this.difficulties.custom.speed}s infinite linear`;
        }
      };
    }

    // Хардкор
    if (hardcoreCheckbox) {
      hardcoreCheckbox.onchange = (e) => {
        this.isHardcore = e.target.checked;
        if (window.SoundsEngine) window.SoundsEngine.play('btn_select', { type: 'effects' });
      };
    }

    // Кнопка Назад
    container.querySelector('#btn-back').onclick = () => {
      if (window.SoundsEngine) window.SoundsEngine.play('btn_back', { type: 'effects' });
      import('./menu.js').then(mod => {
        if (mod && mod.Menu) mod.Menu.start('menu');
      });
    };

    // Кнопка Играть
    container.querySelector('#btn-start').onclick = async () => {
      if (window.SoundsEngine) window.SoundsEngine.play('transition', { type: 'effects' });
      
      containerEl.style.transition = 'opacity 1.5s ease';
      containerEl.style.opacity = '0';
      
      setTimeout(async () => {
        try {
          const mod = await import('./game.js');
          if (mod && mod.Game) {
            // Передаем данные в игру
            const gameData = {
              difficulty: this.currentDifficulty,
              hardcore: this.isHardcore,
              speed: this.difficulties[this.currentDifficulty].speed
            };
            mod.Game.start(this.currentMode, gameData);
          }
        } catch (e) {
          console.error('game.js not found', e);
        }
      }, 1500);
    };
  }
};
