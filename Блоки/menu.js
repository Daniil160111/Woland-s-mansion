// Блоки/menu.js

const MENU_BG = './Текстуры/Меню/Фон.jpg';
const MENU_LIGHTNING = './Текстуры/Меню/Фон-молния.jpg';
const MENU_LOGO = './Текстуры/Меню/Название.jpg';

const THUNDER_SOUNDS = [
  'thunder', 'lightning_fx', 'storm_1', 'storm_2', 'storm_3', 
  'storm_4', 'storm_5', 'storm_6', 'storm_7', 'storm_8', 'storm_9'
];

export const Menu = {
  isMounted: false,
  lightningTimeout: null,
  currentState: 'title',
  isTransitioning: false,
  
  currentScreen: 'main', 
  gameMode: null, 
  currentGameType: null,
  
  buttonsConfig: {
    main: [
      { id: 'btn-play', text: 'Играть', action: 'goto-mode' },
      { id: 'btn-shop', text: 'Магазин П. У. Галкина', action: 'module-shop' },
      { id: 'btn-settings', text: 'Настройки', action: 'module-settings' },
      { id: 'btn-about', text: 'Об игре', action: 'module-about' }
    ],
    mode: [
      { id: 'btn-single', text: 'Одиночная игра', action: 'goto-type', mode: 'one' },
      { id: 'btn-multi', text: 'Мультиплеер', action: 'goto-type', mode: 'two' },
      { id: 'btn-back-mode', text: 'Назад', action: 'back-main' }
    ],
    type: [
      { id: 'btn-story', text: 'Сюжет', action: 'module-select' },
      { id: 'btn-endless', text: "Woland's Mansion endless", action: 'module-endless' },
      { id: 'btn-back-type', text: 'Назад', action: 'back-mode' }
    ]
  },

  start(mode = 'title') {
    if (mode === true) mode = 'menu';
    if (mode === false || !mode) mode = 'title';
    this.currentState = mode;
    this.isTransitioning = false;
    this.currentScreen = 'main';

    const container = document.getElementById('game-container');
    if (!container) throw new Error('game-container was not found');

    if (this.lightningTimeout) clearTimeout(this.lightningTimeout);

    const bg = (window.GameAssets && window.GameAssets.menu_bg) || MENU_BG;
    const lightning = (window.GameAssets && window.GameAssets.menu_lightning) || MENU_LIGHTNING;
    const logo = (window.GameAssets && window.GameAssets.menu_logo) || MENU_LOGO;

    const isMenu = mode === 'menu';

    // Если меню уже создано
    if (this.isMounted && container.querySelector('.woland-menu')) {
      const menuEl = container.querySelector('.woland-menu');
      const bgWrapper = container.querySelector('.woland-menu__bg-wrapper');
      const backBtn = container.querySelector('#btn-title-screen');
      const logoEl = container.querySelector('.woland-menu__logo');
      
      if (isMenu) {
        menuEl.classList.add('menu-mode', 'dark-shade');
        bgWrapper.classList.add('normal-scale');
        logoEl.classList.add('animate-in');
        
        this.renderScreen('main', container, true);

        backBtn.style.animation = 'none';
        backBtn.style.opacity = '0';
        backBtn.style.pointerEvents = 'none';
        setTimeout(() => {
          backBtn.style.transition = 'opacity 1s ease';
          backBtn.style.opacity = '1';
          backBtn.style.pointerEvents = 'auto';
        }, 1500); 

        // Усиливаем музыку и молнии обратно до 100%
        if (window.SoundsEngine) {
          let vol = window.SoundsEngine.volumes.music || 0.5;
          const targetVal = 0.8; // Нормальная громкость
          const step = (targetVal - vol) / 14; // 0.7 сек (14 шагов по 50мс)
          const fadeIn = setInterval(() => {
            vol += step;
            if (vol >= targetVal) { vol = targetVal; clearInterval(fadeIn); }
            window.SoundsEngine.setMasterVolume('music', vol);
            window.SoundsEngine.setMasterVolume('effects', vol); // Усиливаем грозу
          }, 50);
        }

      } else {
        menuEl.classList.remove('menu-mode', 'dark-shade');
        bgWrapper.classList.remove('normal-scale');
        logoEl.classList.remove('animate-in'); 
        backBtn.style.opacity = '0';
        backBtn.style.pointerEvents = 'none';
        
        // Ослабляем музыку и молнии до 50%
        if (window.SoundsEngine) {
          let vol = window.SoundsEngine.volumes.music || 0.8;
          const targetVal = 0.4;
          const step = (targetVal - vol) / 14;
          const fadeOut = setInterval(() => {
            vol += step;
            if (vol <= targetVal) { vol = targetVal; clearInterval(fadeOut); }
            window.SoundsEngine.setMasterVolume('music', vol);
            window.SoundsEngine.setMasterVolume('effects', vol); // Ослабляем грозу
          }, 50);
        }
      }
      return;
    }

    // --- ПЕРВИЧНАЯ ОТРИСОВКА ---
    container.innerHTML = `
      <section class="woland-menu ${isMenu ? 'menu-mode dark-shade' : ''}" aria-label="Главное меню">
        <div class="woland-menu__bg-wrapper">
          <div class="woland-menu__bg" style="background-image: url('${bg}')"></div>
          <div class="woland-menu__lightning" style="background-image: url('${lightning}')"></div>
        </div>
        
        <div class="woland-menu__shade"></div>

        <div class="woland-menu__title-screen">
          <div class="woland-menu__press-to-continue" style="opacity: 0;">Нажмите, чтобы продолжить</div>
        </div>

        <div class="woland-menu__buttons-screen">
          <div class="woland-menu__content" id="menu-buttons-container"></div>
        </div>

        <div class="woland-menu__logo-container">
          <img class="woland-menu__logo" src="${logo}" alt="Woland's Mansion" onerror="this.style.display='none';">
        </div>

        <div class="woland-menu__bottom">
          <button class="btn-link" id="btn-title-screen" type="button" style="opacity: 0; pointer-events: none;">Титульный экран</button>
          <div class="woland-menu__footer" style="opacity: 0;">HTML Gaming 2026</div>
          <div class="woland-menu__version" id="version-display" style="opacity: 0;">v0.0.0</div>
        </div>
      </section>
      
      <style>
        .woland-menu {
          position: absolute; inset: 0; overflow: hidden; background: #000;
          opacity: 0; transition: opacity 1.5s ease;
        }
        .woland-menu.active { opacity: 1; }

        .woland-menu__bg-wrapper {
          position: absolute; inset: 0; z-index: 0;
          transform: scale(1.50);
          transition: transform 1.8s cubic-bezier(0.25, 1, 0.5, 1);
        }
        .woland-menu.menu-mode .woland-menu__bg-wrapper { transform: scale(1.00); }

        .woland-menu__bg, .woland-menu__lightning {
          position: absolute; inset: 0; background-size: cover; background-position: center;
        }
        .woland-menu__lightning { opacity: 0; pointer-events: none; mix-blend-mode: screen; }

        .woland-menu__shade {
          position: absolute; inset: 0; z-index: 1;
          background: rgba(0, 0, 0, 0.3); transition: background 1.5s ease;
        }
        .woland-menu.dark-shade .woland-menu__shade { background: rgba(0, 0, 0, 0.7); }

        .woland-menu__logo-container {
          position: absolute; top: 10vh; left: 50%; transform: translateX(-50%);
          z-index: 9999; display: flex; justify-content: center; pointer-events: none;
          width: 100%; transition: top 1.5s cubic-bezier(0.25, 1, 0.5, 1);
        }
        
        .woland-menu__logo {
          width: min(75vw, 520px); max-height: 32vh; object-fit: contain;
          opacity: 0; transform: scaleY(0); transform-origin: bottom center;
          transition: transform 1.5s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 1.5s ease;
        }
        .woland-menu__logo.animate-in { opacity: 1; transform: scaleY(1); }
        .woland-menu.menu-mode .woland-menu__logo-container { top: 2vh; }
        .woland-menu.menu-mode .woland-menu__logo {
          transform: scale(0.68) scaleY(1); transform-origin: top center;
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
          text-shadow: 0 0 12px rgba(255,0,0,0.6); 
          transition: opacity 0.7s ease;
        }
        .woland-menu__press-to-continue.show { animation: pulse-text 3s infinite ease-in-out; }
        @keyframes pulse-text {
          0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; }
        }

        .woland-menu__buttons-screen {
          position: absolute; inset: 0; z-index: 5;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          opacity: 0; visibility: hidden; pointer-events: none;
          transition: opacity 1.5s ease, visibility 1.5s;
        }
        .woland-menu.menu-mode .woland-menu__buttons-screen {
          opacity: 1; visibility: visible; pointer-events: auto;
        }

        .woland-menu__content {
          display: flex; flex-direction: column; gap: clamp(10px, 2vh, 16px);
          width: 100%; max-width: 350px; margin-top: 20vh;
          position: relative;
        }

        .btn-folder {
          position: relative;
          background: linear-gradient(180deg, #4a1a20 0%, #2a0c10 40%, #110406 100%);
          border: 2px solid #b33333;
          color: #ffdddd; font-size: clamp(14px, 2.1vh, 18px);
          padding: clamp(10px, 1.5vh, 14px) 20px;
          cursor: pointer; 
          transition: background 0.4s, border 0.4s, box-shadow 0.4s, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.4s;
          text-align: center; 
          box-shadow: 0 6px 20px rgba(0,0,0,0.9), inset 0 2px 4px rgba(255,150,150,0.3), inset 0 -2px 4px rgba(0,0,0,0.8);
          letter-spacing: 2px;
          text-shadow: 0 1px 3px #000;
          clip-path: polygon(15px 0%, 100% 0%, calc(100% - 15px) 100%, 0% 100%);
          transform: scale(1);
        }
        
        .btn-folder::before {
          content: ''; position: absolute; top: -10px; left: 18px;
          width: 40%; height: 10px;
          background: #4a1a20; border: 2px solid #b33333; border-bottom: none;
          clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);
          box-shadow: inset 0 2px 2px rgba(255,150,150,0.3);
          transition: background 0.4s, border 0.4s;
        }

        .btn-folder::after {
          content: ''; position: absolute; inset: 2px;
          border: 1px solid rgba(255, 100, 100, 0.2);
          clip-path: polygon(13px 0%, 100% 0%, calc(100% - 13px) 100%, 0% 100%);
          pointer-events: none;
        }

        .btn-folder:hover, .btn-folder.hovered {
          background: linear-gradient(180deg, #70252e 0%, #421218 40%, #1a0609 100%);
          border-color: #ff5555; color: #ffffff;
          box-shadow: 0 0 30px rgba(255,30,30,0.6), inset 0 2px 6px rgba(255,200,200,0.4);
          transform: scale(1.05);
        }
        .btn-folder:hover::before, .btn-folder.hovered::before {
          background: #70252e; border-color: #ff5555;
        }
        
        .btn-folder:active { 
          transform: scale(0.98); 
          box-shadow: 0 2px 10px rgba(0,0,0,0.8), inset 0 2px 5px rgba(0,0,0,0.5);
        }

        @keyframes drop-in {
          0% { opacity: 0; transform: translateY(-100px); }
          60% { opacity: 1; transform: translateY(5px); }
          80% { transform: translateY(-2px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes fall-down {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(100px); }
        }

        .woland-menu__bottom {
          position: absolute; bottom: 10px; left: 0; width: 100%;
          display: flex; flex-direction: column; align-items: center; gap: 5px;
          z-index: 10;
        }

        .btn-link {
          background: transparent; border: none; color: #999;
          font-size: clamp(11px, 1.6vh, 13px); cursor: pointer;
          text-decoration: underline; text-underline-offset: 5px;
          margin-bottom: 5px; transition: color 0.3s, opacity 1s ease; letter-spacing: 1px;
          opacity: 0;
        }
        .btn-link:hover { color: #ff4d4d; }

        .woland-menu__footer {
          color: #666; font-size: 11px; letter-spacing: 1px; 
          transition: opacity 1.5s ease;
        }

        .woland-menu__version {
          color: #444; font-size: 6px; font-family: monospace; letter-spacing: 0px;
          transition: opacity 1.5s ease;
        }
      </style>
    `;
    this.isMounted = true;

    const menuEl = container.querySelector('.woland-menu');
    const logoEl = container.querySelector('.woland-menu__logo');
    const backBtn = container.querySelector('#btn-title-screen');
    const pressText = container.querySelector('.woland-menu__press-to-continue');
    const footerEl = container.querySelector('.woland-menu__footer');
    const versionEl = container.querySelector('#version-display');
    const titleScreen = container.querySelector('.woland-menu__title-screen');

    // ★ ПОСЛЕДОВАТЕЛЬНОСТЬ ЗАПУСКА ★
    
    // 0.5с черный экран
    setTimeout(() => {
      menuEl.classList.add('active'); // Фон плавно появляется (1.5с)
      footerEl.style.opacity = '1';   // HTML Gaming появляется (1.5с)
      versionEl.style.opacity = '1';  // Версия появляется (1.5с)
    }, 500);

    // Через 2с (0.5 черный + 1.5с фон) — музыка и логотип
    setTimeout(() => {
      if (window.SoundsEngine) {
        window.SoundsEngine.init();
        
        const playMenuMusic = () => {
          if (window.SoundsEngine.loadedBuffers && window.SoundsEngine.loadedBuffers['menu_theme']) {
            if (window.SoundsEngine.currentMusicTrack !== 'menu_theme') {
              window.SoundsEngine.setMasterVolume('music', 0);
              window.SoundsEngine.play('menu_theme', { loop: true, type: 'music' });
              window.SoundsEngine.currentMusicTrack = 'menu_theme';
              
              let vol = 0; 
              const targetVal = 0.8; // 100%
              const step = targetVal / 20;
              const fadeIn = setInterval(() => {
                vol += step;
                if (vol >= targetVal) { vol = targetVal; clearInterval(fadeIn); }
                window.SoundsEngine.setMasterVolume('music', vol);
              }, 50);
            } else {
              // Если уже играет, просто ставим громкость (после возврата)
              window.SoundsEngine.setMasterVolume('music', 0.8);
            }
          } else {
            setTimeout(playMenuMusic, 100);
          }
        };
        playMenuMusic();
      }
      
      logoEl.classList.add('animate-in'); // Логотип появляется (1.5с)
    }, 2000);

    // Через 3.5с (2с + 1.5с логотип) — текст и сенсор
    setTimeout(() => {
      pressText.style.opacity = '1';
      pressText.classList.add('show');
      titleScreen.style.pointerEvents = 'auto';
    }, 3500);

    // Гроза
    const playThunder = () => {
      if (!window.SoundsEngine) return;
      const mainSound = THUNDER_SOUNDS[Math.floor(Math.random() * THUNDER_SOUNDS.length)];
      const mainPan = Math.random() * 2 - 1;
      const mainVol = Math.random() * 0.5 + 0.5;
      window.SoundsEngine.play(mainSound, { type: 'effects', pan: mainPan, volume: mainVol, reverb: true });
      
      if (Math.random() > 0.4) {
        setTimeout(() => {
          const echoSound = THUNDER_SOUNDS[Math.floor(Math.random() * THUNDER_SOUNDS.length)];
          window.SoundsEngine.play(echoSound, { type: 'effects', pan: mainPan > 0 ? -0.9 : 0.9, volume: mainVol * 0.4, reverb: true });
        }, Math.random() * 600 + 200);
      }
    };

    const triggerLightning = () => {
      const lightningEl = container.querySelector('.woland-menu__lightning');
      if (!lightningEl) return;
      const flashSteps = [
        { opacity: 0.95, duration: 50 }, { opacity: 0.15, duration: 70 },
        { opacity: 0.80, duration: 40 }, { opacity: 0.30, duration: 100 },
        { opacity: 1.00, duration: 60 }, { opacity: 0.00, duration: 500 }
      ];
      playThunder();
      let currentStep = 0;
      const runFlash = () => {
        if (currentStep >= flashSteps.length) { lightningEl.style.opacity = '0'; return; }
        const stepData = flashSteps[currentStep];
        lightningEl.style.transition = `opacity ${stepData.duration / 1000}s ease`;
        lightningEl.style.opacity = stepData.opacity;
        currentStep++;
        setTimeout(runFlash, stepData.duration);
      };
      runFlash();
    };

    const scheduleLightning = () => {
      const delay = Math.random() * 9000 + 6000; 
      this.lightningTimeout = setTimeout(() => { triggerLightning(); scheduleLightning(); }, delay);
    };
    scheduleLightning();

    // Версия
    fetch('./version.json')
      .then(res => res.json())
      .then(data => {
        if (versionEl && data.version) versionEl.textContent = data.version;
      })
      .catch(() => {
        if (versionEl) versionEl.textContent = 'Версия неизвестна';
      });

    // Переключение экранов
    this.renderScreen = (screenName, containerEl, animateIn = true) => {
      const config = this.buttonsConfig[screenName];
      const btnContainer = containerEl.querySelector('#menu-buttons-container');
      const oldButtons = btnContainer.querySelectorAll('.btn-folder');

      const hideOld = () => {
        return new Promise(resolve => {
          if (oldButtons.length === 0) return resolve();
          
          oldButtons.forEach((btn, index) => {
            btn.style.animation = 'none'; 
            void btn.offsetWidth;
            const delay = (oldButtons.length - 1 - index) * 0.05; 
            btn.style.animation = `fall-down 0.4s cubic-bezier(0.4, 0, 1, 1) ${delay}s forwards`;
          });

          setTimeout(resolve, 400 + (oldButtons.length * 50) + 50); 
        });
      };

      const renderNew = () => {
        btnContainer.innerHTML = ''; 
        config.forEach((btnInfo, index) => {
          const btn = document.createElement('button');
          btn.className = 'btn-folder';
          btn.id = btnInfo.id;
          btn.innerHTML = `<span>${btnInfo.text}</span>`;
          
          btn.addEventListener('pointerenter', () => btn.classList.add('hovered'));
          btn.addEventListener('pointerleave', () => btn.classList.remove('hovered'));
          btn.addEventListener('pointerdown', () => btn.classList.add('hovered'));
          btn.addEventListener('pointerup', () => btn.classList.remove('hovered'));
          btn.addEventListener('touchcancel', () => btn.classList.remove('hovered'));

          btnContainer.appendChild(btn);

          if (animateIn) {
            btn.style.opacity = '0';
            btn.style.animation = `drop-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) ${index * 0.1}s forwards`;
          } else {
            btn.style.opacity = '1';
          }

          btn.onclick = () => {
            if (this.isTransitioning) return;
            this.handleButtonClick(btnInfo, containerEl);
          };
        });
      };

      hideOld().then(() => {
        renderNew();
        this.currentScreen = screenName;
      });
    };

    // ★ ОБРАБОТЧИК КЛИКОВ С ПРАВИЛЬНЫМИ МОДУЛЯМИ ★
    this.handleButtonClick = (btnInfo, containerEl) => {
      if (this.isTransitioning) return;
      this.isTransitioning = true;

      const playSfx = () => { if (window.SoundsEngine) window.SoundsEngine.play('transition', { type: 'effects' }); };
      playSfx();

      // 1. Плавное затухание музыки и эффектов за 0.7с (14 шагов по 50мс)
      if (window.SoundsEngine) {
        let vol = window.SoundsEngine.volumes.music || 0.8;
        const targetVal = 0;
        const step = vol / 14;
        const fadeOut = setInterval(() => {
          vol -= step;
          if (vol <= 0) { vol = 0; clearInterval(fadeOut); }
          window.SoundsEngine.setMasterVolume('music', vol);
          window.SoundsEngine.setMasterVolume('effects', vol);
        }, 50);
      }

      // 2. Затемнение экрана за 1.5с и переход
      const menuEl = containerEl.querySelector('.woland-menu');
      menuEl.style.transition = 'opacity 1.5s ease';
      menuEl.style.opacity = '0';

      setTimeout(async () => {
        if (window.SoundsEngine) window.SoundsEngine.stopAll();
        
        try {
          if (btnInfo.action === 'goto-mode') {
            this.renderScreen('mode', containerEl);
            menuEl.style.opacity = '1';
            this.isTransitioning = false;
          } 
          else if (btnInfo.action === 'goto-type') {
            this.gameMode = btnInfo.mode;
            this.renderScreen('type', containerEl);
            menuEl.style.opacity = '1';
            this.isTransitioning = false;
          }
          else if (btnInfo.action === 'back-main') {
            this.renderScreen('main', containerEl);
            menuEl.style.opacity = '1';
            this.isTransitioning = false;
          }
          else if (btnInfo.action === 'back-mode') {
            this.renderScreen('mode', containerEl);
            menuEl.style.opacity = '1';
            this.isTransitioning = false;
          }
          // Запуск модулей
          else if (btnInfo.action === 'module-select') {
            const mod = await import('./select.js');
            if (mod && mod.Select) mod.Select.start(this.gameMode || 'one');
          }
          else if (btnInfo.action === 'module-endless') {
            const mod = await import('./endless.js');
            if (mod && mod.Endless) mod.Endless.start(this.gameMode || 'one');
          }
          else if (btnInfo.action === 'module-shop') {
            const mod = await import('./shop.js');
            if (mod && mod.Shop) mod.Shop.start();
          }
          else if (btnInfo.action === 'module-settings') {
            const mod = await import('./settings.js');
            if (mod && mod.Settings) mod.Settings.start();
          }
          else if (btnInfo.action === 'module-about') {
            const mod = await import('./about.js');
            if (mod && mod.About) mod.About.start();
          }
        } catch (e) {
          console.error('Ошибка перехода:', e);
          menuEl.style.opacity = '1';
          this.isTransitioning = false;
        }
      }, 1500);
    };

    const goToMenu = () => {
      if (this.isTransitioning || this.currentState === 'menu') return;
      this.isTransitioning = true;
      
      menuEl.classList.add('menu-mode', 'dark-shade');
      if (window.SoundsEngine) window.SoundsEngine.play('transition', { type: 'effects' });

      // Музыка затихает до 50% (0.7с)
      if (window.SoundsEngine) {
        let vol = window.SoundsEngine.volumes.music || 0.8;
        const targetVal = 0.4;
        const step = (vol - targetVal) / 14;
        const fadeOut = setInterval(() => {
          vol -= step;
          if (vol <= targetVal) { vol = targetVal; clearInterval(fadeOut); }
          window.SoundsEngine.setMasterVolume('music', vol);
          window.SoundsEngine.setMasterVolume('effects', vol);
        }, 50);
      }

      setTimeout(() => {
        this.renderScreen('main', container, true);
      }, 100);

      setTimeout(() => {
        backBtn.style.transition = 'opacity 1s ease';
        backBtn.style.opacity = '1';
        backBtn.style.pointerEvents = 'auto';
        this.isTransitioning = false;
      }, 1500);
    };

    container.querySelector('.woland-menu__title-screen').onclick = () => goToMenu();

    if (backBtn) {
      backBtn.onclick = () => {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        if (window.SoundsEngine) window.SoundsEngine.play('transition', { type: 'effects' });
        
        backBtn.style.opacity = '0';
        backBtn.style.pointerEvents = 'none';
        
        this.currentScreen = 'main';
        const btnContainer = container.querySelector('#menu-buttons-container');
        btnContainer.innerHTML = ''; 

        menuEl.classList.remove('menu-mode', 'dark-shade');
        
        // Музыка усиливается обратно до 100% (0.7с)
        if (window.SoundsEngine) {
          let vol = window.SoundsEngine.volumes.music || 0.4;
          const targetVal = 0.8;
          const step = (targetVal - vol) / 14;
          const fadeIn = setInterval(() => {
            vol += step;
            if (vol >= targetVal) { vol = targetVal; clearInterval(fadeIn); }
            window.SoundsEngine.setMasterVolume('music', vol);
            window.SoundsEngine.setMasterVolume('effects', vol);
          }, 50);
        }

        // Возвращаем текст "Нажмите, чтобы продолжить"
        pressText.style.opacity = '1';
        pressText.classList.add('show');
        
        setTimeout(() => { this.isTransitioning = false; }, 1000);
      };
    }
  }
};
