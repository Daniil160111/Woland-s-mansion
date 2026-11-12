// Блоки/select.js

export const Select = {
  isMounted: false,
  currentMode: null,
  currentDifficulty: 'normal',

  // Настройки сложностей (скорость и описание)
  difficulties: {
    ghost: {
      name: 'Призрак',
      speed: 0.7,
      desc: 'Воланд двигается медленно. Он полупрозрачный и не может вас видеть или атаковать. Идеально для изучения особняка.',
      filter: 'opacity(0.5) grayscale(50%)'
    },
    easy: {
      name: 'Лёгкая',
      speed: 0.7,
      desc: 'Воланд двигается медленно, но уже может вас видеть и атаковать. Отличный старт для новичков.',
      filter: 'none'
    },
    normal: {
      name: 'Нормальная',
      speed: 1.0,
      desc: 'Классический баланс. Воланд двигается с обычной скоростью и представляет реальную угрозу.',
      filter: 'none'
    },
    hard: {
      name: 'Сложная',
      speed: 1.2,
      desc: 'Воланд быстрее. Дальность обзора ухудшена чёрным туманом по краям экрана.',
      filter: 'none',
      vignette: 'rgba(0,0,0,0.6)'
    },
    horror: {
      name: 'Ужасная',
      speed: 1.3,
      desc: 'Воланд быстрее и агрессивнее. Туман сильнее. Он может стрелять снарядами даже вне босс-файта.',
      filter: 'none',
      vignette: 'rgba(0,0,0,0.8)'
    },
    impossible: {
      name: 'Невозможная',
      speed: 1.5,
      desc: 'Максимальная скорость. Воланд стреляет очень часто. Выжить почти невозможно.',
      filter: 'none',
      vignette: 'rgba(0,0,0,0.9)'
    },
    custom: {
      name: 'Настраиваемая',
      speed: 1.0,
      desc: 'Настройте скорость Воланда, его урон и другие параметры под себя.',
      filter: 'none'
    }
  },

  start(mode) {
    this.currentMode = mode; // 'one' или 'two'
    this.isMounted = true;
    
    const container = document.getElementById('game-container');
    if (!container) throw new Error('game-container not found');

    // Если переключились на "Одиночную игру", меняем музыку (если нужно)
    if (window.SoundsEngine) {
      if (this.currentMode === 'one') {
        window.SoundsEngine.setMasterVolume('music', 0);
        window.SoundsEngine.play('menu_single', { loop: true, type: 'music' });
        let vol = 0; 
        const targetVal = window.SoundsEngine.volumes.music || 0.8;
        const fadeIn = setInterval(() => {
          vol += 0.05;
          if (vol >= targetVal) { vol = targetVal; clearInterval(fadeIn); }
          window.SoundsEngine.setMasterVolume('music', vol);
        }, 50);
      } else if (this.currentMode === 'two') {
        window.SoundsEngine.setMasterVolume('music', 0);
        window.SoundsEngine.play('menu_multiplayer', { loop: true, type: 'music' });
        let vol = 0; 
        const targetVal = window.SoundsEngine.volumes.music || 0.8;
        const fadeIn = setInterval(() => {
          vol += 0.05;
          if (vol >= targetVal) { vol = targetVal; clearInterval(fadeIn); }
          window.SoundsEngine.setMasterVolume('music', vol);
        }, 50);
      }
    }

    if (this.currentMode === 'two') {
      this.renderMultiplayer(container);
    } else {
      this.renderSinglePlayer(container);
    }
  },

  // --- МУЛЬТИПЛЕЕР (Заглушка) ---
  renderMultiplayer(container) {
    container.innerHTML = `
      <div class="select-wrapper" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center;">
        <h1 style="color:#fff; font-size:clamp(24px, 5vh, 48px); text-shadow: 0 0 20px #f00; margin-bottom: 20px;">Мультиплеер</h1>
        <p style="color:#aaa; font-size:clamp(14px, 2vh, 20px); max-width: 80%; margin-bottom: 40px;">Здесь скоро что-то будет...</p>
        <button class="btn-back" style="padding: 12px 30px; background: #500; color: #fff; border: 2px solid #f00; border-radius: 8px; cursor: pointer;">Назад</button>
      </div>
    `;

    const backBtn = container.querySelector('.btn-back');
    backBtn.onclick = () => {
      if (window.SoundsEngine) window.SoundsEngine.play('btn_back', { type: 'effects' });
      this.goBack();
    };
  },

  // --- ОДИНОЧНАЯ ИГРА (Выбор сложности) ---
  renderSinglePlayer(container) {
    // Находим текущую сложность или ставим по умолчанию
    const diff = this.difficulties[this.currentDifficulty] || this.difficulties.normal;

    container.innerHTML = `
      <div class="select-layout">
        
        <!-- Сверху: 3D-сцена с коридором и Воландом -->
        <div class="select-scene">
          <div class="scene-wall"></div>
          <div class="scene-floor"></div>
          <img class="scene-voland" src="./Текстуры/Воланд/Воланд0.png" alt="Voland" onerror="this.style.display='none';">
          <!-- Виньетка (туман по краям) -->
          <div class="scene-vignette" style="background: radial-gradient(ellipse at center, transparent 30%, ${diff.vignette || 'transparent'} 100%);"></div>
        </div>

        <!-- В центре: Выбор сложности -->
        <div class="select-content">
          <h2 class="select-title">Выберите сложность</h2>
          
          <div class="difficulty-grid">
            <!-- Кнопки сложности (генерируются) -->
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
        </div>

        <!-- Внизу: Кнопки Старт и Назад -->
        <div class="select-footer">
          <button class="btn-start" id="btn-start">Начать игру</button>
          <button class="btn-back" id="btn-back">Назад</button>
        </div>

      </div>

      <style>
        .select-layout {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          background: #050407; color: #fff; font-family: 'WolandFont', monospace;
        }

        /* 3D-Сцена */
        .select-scene {
          flex: 1; position: relative; overflow: hidden;
          background: #000;
        }
        /* Стена (задний фон) */
        .scene-wall {
          position: absolute; inset: 0;
          background: linear-gradient(to bottom, #1a1010, #0a0505);
        }
        /* Пол (перспектива) */
        .scene-floor {
          position: absolute; bottom: 0; left: 0; width: 100%; height: 50%;
          background: linear-gradient(to top, #2a1515, #0a0505);
          transform: perspective(500px) rotateX(60deg);
          transform-origin: bottom;
        }
        /* Воланд */
        .scene-voland {
          position: absolute; bottom: 10%; left: 50%; transform: translateX(-50%);
          height: 60%; object-fit: contain;
          filter: ${diff.filter || 'none'};
          /* Скорость движения (анимация) зависит от сложности */
          animation: walk-towards 4s infinite linear;
        }
        /* Виньетка */
        .scene-vignette {
          position: absolute; inset: 0; pointer-events: none;
        }

        @keyframes walk-towards {
          0% { transform: translateX(-50%) scale(0.8); opacity: 0.8; }
          50% { transform: translateX(-50%) scale(1.1); opacity: 1; }
          100% { transform: translateX(-50%) scale(1.3); opacity: 0; }
        }

        /* Выбор сложности */
        .select-content {
          padding: 20px;
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
        .btn-start:hover { background: linear-gradient(135deg, #ff5555, #800); transform: scale(1.05); }
        .btn-back {
          padding: 12px 30px; background: transparent; color: #888;
          border: 2px solid #555; border-radius: 8px; font-size: clamp(14px, 2vh, 18px);
          cursor: pointer; transition: all 0.2s;
        }
        .btn-back:hover { color: #fff; border-color: #fff; }
      </style>
    `;

    const containerEl = container.querySelector('.select-layout');
    
    // Логика выбора сложности
    const diffButtons = container.querySelectorAll('.diff-btn');
    const descText = container.querySelector('#diff-desc-text');
    const volandEl = container.querySelector('.scene-voland');
    const vignetteEl = container.querySelector('.scene-vignette');

    diffButtons.forEach(btn => {
      btn.onclick = () => {
        const diffKey = btn.dataset.diff;
        this.currentDifficulty = diffKey;
        const d = this.difficulties[diffKey];

        if (window.SoundsEngine) window.SoundsEngine.play('btn_click', { type: 'effects' });

        // Обновляем активную кнопку
        diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Обновляем описание
        descText.textContent = d.desc;

        // Обновляем визуал Воланда (фильтр и скорость анимации)
        if (volandEl) {
          volandEl.style.filter = d.filter || 'none';
          // Изменяем длительность анимации (чем выше speed, тем быстрее)
          const duration = 4 / d.speed; 
          volandEl.style.animation = 'none';
          void volandEl.offsetWidth;
          volandEl.style.animation = `walk-towards ${duration}s infinite linear`;
        }

        // Обновляем туман (виньетку)
        if (vignetteEl) {
          vignetteEl.style.background = `radial-gradient(ellipse at center, transparent 30%, ${d.vignette || 'transparent'} 100%)`;
        }
      };
    });

    // Кнопка Назад
    container.querySelector('#btn-back').onclick = () => {
      if (window.SoundsEngine) window.SoundsEngine.play('btn_back', { type: 'effects' });
      this.goBack();
    };

    // Кнопка Начать игру
    container.querySelector('#btn-start').onclick = async () => {
      if (window.SoundsEngine) window.SoundsEngine.play('transition', { type: 'effects' });
      
      // Останавливаем музыку выбора
      if (window.SoundsEngine) window.SoundsEngine.setMasterVolume('music', 0);
      
      // Загружаем и запускаем игру
      containerEl.style.opacity = '0';
      containerEl.style.transition = 'opacity 1s ease';
      
      setTimeout(async () => {
        try {
          const mod = await import('./game.js');
          if (mod && mod.Game) {
            // Передаем выбранную сложность в игру
            mod.Game.start(this.currentDifficulty);
          }
        } catch (e) {
          console.error('game.js not found', e);
        }
      }, 1000);
    };
  },

  // Возврат в главное меню
  goBack() {
    this.isMounted = false;
    // Возвращаем музыку меню
    if (window.SoundsEngine) {
      window.SoundsEngine.setMasterVolume('music', 0);
      window.SoundsEngine.play('menu_theme', { loop: true, type: 'music' });
      let vol = 0; 
      const targetVal = window.SoundsEngine.volumes.music || 0.8;
      const fadeIn = setInterval(() => {
        vol += 0.05;
        if (vol >= targetVal) { vol = targetVal; clearInterval(fadeIn); }
        window.SoundsEngine.setMasterVolume('music', vol);
      }, 50);
    }
    
    // Вызываем меню (оно уже загружено)
    import('./menu.js').then(mod => {
      if (mod && mod.Menu) mod.Menu.start('menu');
    });
  }
};
