// Блоки/menu.js

const MENU_BG = './Текстуры/Меню/Фон.jpg';
const MENU_LIGHTNING = './Текстуры/Меню/Фон-молния.jpg';
const MENU_LOGO = './Текстуры/Меню/Название.jpg'; // Точный путь из структуры

export const Menu = {
  isMounted: false,
  lightningTimeout: null,
  currentState: 'title',
  isTransitioning: false, // Защита от повторных нажатий во время анимации

  start(mode = 'title') {
    if (mode === true) mode = 'menu';
    if (mode === false || !mode) mode = 'title';
    this.currentState = mode;
    this.isTransitioning = false;

    const container = document.getElementById('game-container');
    if (!container) throw new Error('game-container was not found');

    if (this.lightningTimeout) clearTimeout(this.lightningTimeout);

    const bg = (window.GameAssets && window.GameAssets.menu_bg) || MENU_BG;
    const lightning = (window.GameAssets && window.GameAssets.menu_lightning) || MENU_LIGHTNING;
    const logo = (window.GameAssets && window.GameAssets.menu_logo) || MENU_LOGO;

    const isMenu = mode === 'menu';

    if (!this.isMounted || !container.querySelector('.woland-menu')) {
      container.innerHTML = `
        <section class="woland-menu ${isMenu ? 'menu-mode dark-shade' : ''}" aria-label="Главное меню">
          <div class="woland-menu__bg-wrapper ${isMenu ? 'normal-scale' : 'zoom-in'}">
            <div class="woland-menu__bg" style="background-image: url('${bg}')"></div>
            <div class="woland-menu__lightning" style="background-image: url('${lightning}')"></div>
          </div>
          
          <div class="woland-menu__shade"></div>
          
          <div class="woland-menu__logo-container">
            <img class="woland-menu__logo" src="${logo}" alt="Woland's Mansion" onerror="this.hidden=true">
          </div>

          <div class="woland-menu__title-screen">
            <div class="woland-menu__press-to-continue">Нажмите чтобы продолжить</div>
          </div>

          <div class="woland-menu__buttons-screen">
            <div class="woland-menu__content">
              <button class="btn-folder" id="btn-play" type="button"><span>Играть</span></button>
              <button class="btn-folder" id="btn-settings" type="button"><span>Настройки</span></button>
              <button class="btn-folder" id="btn-about" type="button"><span>Об игре</span></button>
              <button class="btn-link" id="btn-back" type="button">Обратно на титульный</button>
            </div>
          </div>

          <div class="woland-menu__footer">HTML Gaming 2026</div>
        </section>
        
        <style>
          .woland-menu {
            position: absolute; inset: 0; overflow: hidden; background: #000;
            opacity: 0; transition: opacity 1s ease;
          }
          .woland-menu.active { opacity: 1; }

          .woland-menu__bg-wrapper {
            position: absolute; inset: 0; z-index: 0;
            transform: scale(1.50);
            transition: transform 1.8s cubic-bezier(0.2, 0.8, 0.2, 1);
          }
          .woland-menu__bg-wrapper.normal-scale {
            transform: scale(1.00);
          }

          .woland-menu__bg, .woland-menu__lightning {
            position: absolute; inset: 0; background-size: cover; background-position: center;
          }
          .woland-menu__lightning {
            opacity: 0; pointer-events: none; mix-blend-mode: screen;
          }

          .woland-menu__shade {
            position: absolute; inset: 0; z-index: 1;
            background: rgba(0, 0, 0, 0.3);
            transition: background 1.5s ease;
          }
          .woland-menu.dark-shade .woland-menu__shade {
            background: rgba(0, 0, 0, 0.7);
          }

          .woland-menu__logo-container {
            position: absolute; top: 18%; left: 50%; transform: translateX(-50%);
            z-index: 10; display: flex; justify-content: center; pointer-events: none;
            transition: top 1.5s cubic-bezier(0.2, 0.8, 0.2, 1), transform 1.5s cubic-bezier(0.2, 0.8, 0.2, 1);
            width: 100%;
          }
          .woland-menu__logo {
            width: min(80vw, 550px); max-height: 38vh; object-fit: contain;
            filter: drop-shadow(0 0 25px rgba(180,20,20,0.8));
            opacity: 0; transform: scaleY(0); transform-origin: bottom center;
            transition: transform 1.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 1s ease;
          }
          .woland-menu__logo.animate-in { opacity: 1; transform: scaleY(1); }

          .woland-menu.menu-mode .woland-menu__logo-container {
            top: 6%;
            transform: translateX(-50%) scale(0.65);
          }

          .woland-menu__title-screen {
            position: absolute; inset: 0; z-index: 5;
            display: flex; align-items: flex-end; justify-content: center; padding-bottom: 12vh;
            transition: opacity 0.6s ease, visibility 0.6s;
          }
          .woland-menu.menu-mode .woland-menu__title-screen {
            opacity: 0; visibility: hidden; pointer-events: none;
          }

          .woland-menu__press-to-continue {
            font-size: clamp(16px, 2.8vh, 24px); color: #dcdcdc; letter-spacing: 2px;
            text-shadow: 0 0 12px rgba(255,0,0,0.6); animation: pulse-text 2.5s infinite ease-in-out;
          }
          @keyframes pulse-text {
            0%, 100% { opacity: 0.3; text-shadow: 0 0 5px rgba(255,0,0,0.2); }
            50% { opacity: 1; text-shadow: 0 0 15px rgba(255,0,0,0.8); }
          }

          .woland-menu__buttons-screen {
            position: absolute; inset: 0; z-index: 5;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            opacity: 0; visibility: hidden; pointer-events: none;
            transition: opacity 1s ease, visibility 1s;
          }
          .woland-menu.menu-mode .woland-menu__buttons-screen {
            opacity: 1; visibility: visible; pointer-events: auto;
          }

          .woland-menu__content {
            display: flex; flex-direction: column; gap: clamp(12px, 2.5vh, 20px);
            width: 100%; max-width: 340px; margin-top: 12vh;
          }

          .btn-folder {
            position: relative;
            background: linear-gradient(135deg, #351216 0%, #1a080a 100%);
            border: 2px solid #9e2a2a;
            color: #f0f0f0; font-size: clamp(16px, 2.5vh, 20px);
            padding: clamp(14px, 2vh, 18px) 24px;
            cursor: pointer; transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
            text-align: center; box-shadow: 0 6px 20px rgba(0,0,0,0.8), inset 0 1px 3px rgba(255,100,100,0.2);
            letter-spacing: 2px;
            clip-path: polygon(14px 0%, 100% 0%, calc(100% - 14px) 100%, 0% 100%);
          }
          .btn-folder::before {
            content: ''; position: absolute; top: -9px; left: 16px;
            width: 38%; height: 9px;
            background: #351216; border: 2px solid #9e2a2a; border-bottom: none;
            clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);
          }
          .btn-folder:hover {
            background: linear-gradient(135deg, #5c1e24 0%, #2b0d10 100%);
            border-color: #ff3b3b; color: #ffffff;
            box-shadow: 0 0 25px rgba(255,30,30,0.5), inset 0 2px 5px rgba(255,255,255,0.3);
            transform: translateY(-2px);
          }
          .btn-folder:active { transform: translateY(1px); }

          .btn-link {
            background: transparent; border: none; color: #999;
            font-size: clamp(13px, 1.8vh, 15px); cursor: pointer;
            text-decoration: underline; text-underline-offset: 6px;
            margin-top: 15px; transition: color 0.3s; letter-spacing: 1px;
          }
          .btn-link:hover { color: #ff4d4d; }

          .woland-menu__footer {
            position: absolute; bottom: 15px; width: 100%; text-align: center;
            color: #666; font-size: 12px; letter-spacing: 1px; z-index: 5;
            opacity: 0.8;
          }
        </style>
      `;
      this.isMounted = true;
    }

    const menuEl = container.querySelector('.woland-menu');
    const bgWrapper = container.querySelector('.woland-menu__bg-wrapper');
    const logoEl = container.querySelector('.woland-menu__logo');
    const titleScreen = container.querySelector('.woland-menu__title-screen');

    requestAnimationFrame(() => {
      menuEl.classList.add('active');
    });

    // Музыка без наложений
    if (window.SoundsEngine) {
      window.SoundsEngine.init();
      if (window.SoundsEngine.currentMusicTrack !== 'menu_theme') {
        window.SoundsEngine.setMasterVolume('music', 0);
        window.SoundsEngine.play('menu_theme', { loop: true, type: 'music' });
        window.SoundsEngine.currentMusicTrack = 'menu_theme';
        let vol = 0; 
        const targetVal = window.SoundsEngine.volumes.music || 0.8;
        const step = targetVal / 20;
        const fadeIn = setInterval(() => {
          vol += step;
          if (vol >= targetVal) { vol = targetVal; clearInterval(fadeIn); }
          window.SoundsEngine.setMasterVolume('music', vol);
        }, 50);
      }
    }

    // --- РЕАЛИСТИЧНЫЙ СТЕРЕО ГРОМ С РЕВЕРБЕРАЦИЕЙ ---
    const playThunder = () => {
      if (!window.SoundsEngine) return;
      const pans = [-0.85, -0.45, 0, 0.45, 0.85];
      const pan = pans[Math.floor(Math.random() * pans.length)];
      
      // Вызываем гром со спецэффектом реверберации и стереопозиционированием
      window.SoundsEngine.play('thunder', { 
        type: 'effects', 
        position: { x: pan, y: 0, z: 1 },
        reverb: true // Включает реалистичный отзвук эха о стены особняка
      });
    };

    // --- УЛУЧШЕННЫЕ МНОГОСТУПЕНЧАТЫЕ МОЛНИИ ---
    const triggerLightning = () => {
      const lightningEl = container.querySelector('.woland-menu__lightning');
      if (!lightningEl) return;
      
      // Настоящий многофазный паттерн молнии
      const flashSteps = [
        { opacity: 0.95, duration: 50 },
        { opacity: 0.15, duration: 70 },
        { opacity: 0.80, duration: 40 },
        { opacity: 0.30, duration: 100 },
        { opacity: 1.00, duration: 60 },
        { opacity: 0.00, duration: 500 }
      ];

      playThunder();

      let currentStep = 0;
      const runFlash = () => {
        if (currentStep >= flashSteps.length) {
          lightningEl.style.opacity = '0';
          return;
        }
        const stepData = flashSteps[currentStep];
        lightningEl.style.transition = `opacity ${stepData.duration / 1000}s ease`;
        lightningEl.style.opacity = stepData.opacity;
        currentStep++;
        setTimeout(runFlash, stepData.duration);
      };
      runFlash();
    };

    const scheduleLightning = () => {
      const delay = Math.random() * 8000 + 7000; 
      this.lightningTimeout = setTimeout(() => {
        triggerLightning();
        scheduleLightning();
      }, delay);
    };

    scheduleLightning();

    const applyState = (targetMode) => {
      this.currentState = targetMode;
      if (targetMode === 'menu') {
        menuEl.classList.add('menu-mode', 'dark-shade');
        bgWrapper.classList.add('normal-scale');
        logoEl.classList.add('animate-in');
      } else {
        menuEl.classList.remove('menu-mode', 'dark-shade');
        bgWrapper.classList.remove('normal-scale');
        logoEl.classList.remove('animate-in');
        setTimeout(() => logoEl.classList.add('animate-in'), 300);
      }
    };

    applyState(mode);

    if (mode === 'title') {
      setTimeout(() => { logoEl.classList.add('animate-in'); }, 400);
    }

    // Переход в меню с защитой от двойных кликов
    const goToMenu = () => {
      if (this.isTransitioning || this.currentState === 'menu') return;
      this.isTransitioning = true;
      applyState('menu');
      if (window.SoundsEngine) {
        window.SoundsEngine.play('transition', { type: 'effects' });
      }
      setTimeout(() => { this.isTransitioning = false; }, 1500); // Снимаем блок по окончании анимации
    };

    titleScreen.onclick = () => goToMenu();

    const playSfx = (name) => {
      if (window.SoundsEngine) window.SoundsEngine.play(name, { type: 'effects' });
    };

    const backBtn = container.querySelector('#btn-back');
    if (backBtn) {
      backBtn.onclick = () => {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        playSfx('btn_back');
        applyState('title');
        setTimeout(() => { this.isTransitioning = false; }, 1000);
      };
    }

    // Обработчики кнопок с блокировкой повторных кликов
    const setupSubmenuButton = (btnId, moduleImportCallback) => {
      const btn = container.querySelector(btnId);
      if (btn) {
        btn.onclick = () => {
          if (this.isTransitioning) return;
          this.isTransitioning = true;
          playSfx('btn_click');
          menuEl.style.opacity = '0';
          setTimeout(async () => {
            try {
              await moduleImportCallback();
            } catch (e) {
              this.isTransitioning = false;
              menuEl.style.opacity = '1';
            }
          }, 1000);
        };
      }
    };

    setupSubmenuButton('#btn-play', async () => {
      const mod = await import('./game.js').catch(() => null);
      if (mod && mod.Game) mod.Game.start();
    });

    setupSubmenuButton('#btn-settings', async () => {
      const mod = await import('./settings.js').catch(() => null);
      if (mod && mod.Settings) mod.Settings.start();
    });

    setupSubmenuButton('#btn-about', async () => {
      const mod = await import('./about.js').catch(() => null);
      if (mod && mod.About) mod.About.start();
    });

    this.isMounted = true;
  }
};
