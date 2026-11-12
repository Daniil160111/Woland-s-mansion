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
  
  buttonsConfig: {
    main: [
      { id: 'btn-play', text: 'Играть', action: 'goto-mode' },
      { id: 'btn-shop', text: 'Магазин П. У. Галкина', action: 'goto-shop' },
      { id: 'btn-settings', text: 'Настройки', action: 'goto-settings' },
      { id: 'btn-about', text: 'Об игре', action: 'goto-about' }
    ],
    mode: [
      { id: 'btn-single', text: 'Одиночная игра', action: 'goto-type', mode: 'one' },
      { id: 'btn-multi', text: 'Мультиплеер', action: 'goto-type', mode: 'two' },
      { id: 'btn-back-mode', text: 'Назад', action: 'back-main' }
    ],
    type: [
      { id: 'btn-story', text: 'Сюжет', action: 'start-game', type: 'story' },
      { id: 'btn-endless', text: "Woland's Mansion endless", action: 'start-game', type: 'endless' },
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

    // Если меню уже создано, просто переключаем состояние
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

      } else {
        menuEl.classList.remove('menu-mode', 'dark-shade');
        bgWrapper.classList.remove('normal-scale');
        logoEl.classList.remove('animate-in'); 
        backBtn.style.opacity = '0';
        backBtn.style.pointerEvents = 'none';
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
          <div class="woland-menu__press-to-continue">Нажмите, чтобы продолжить</div>
        </div>

        <div class="woland-menu__buttons-screen">
          <div class="woland-menu__content" id="menu-buttons-container">
            <!-- Кнопки рендерятся динамически -->
          </div>
        </div>

        <div class="woland-menu__logo-container">
          <img class="woland-menu__logo" src="${logo}" alt="Woland's Mansion" onerror="this.style.display='none';">
        </div>

        <div class="woland-menu__bottom">
          <button class="btn-link" id="btn-title-screen" type="button" style="opacity: 0; pointer-events: none;">Титульный экран</button>
          <div class="woland-menu__footer">HTML Gaming 2026</div>
          <div class="woland-menu__version" id="version-display">v0.0.0</div>
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
          transition: transform 1s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 1s ease;
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
          text-shadow: 0 0 12px rgba(255,0,0,0.6); animation: pulse-text 3s infinite ease-in-out;
        }
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
          transition: background 0.2s, border 0.2s, box-shadow 0.2s, transform 0.1s;
          text-align: center; 
          box-shadow: 
            0 6px 20px rgba(0,0,0,0.9), 
            inset 0 2px 4px rgba(255,150,150,0.3),
            inset 0 -2px 4px rgba(0,0,0,0.8);
          letter-spacing: 2px;
          text-shadow: 0 1px 3px #000;
          clip-path: polygon(15px 0%, 100% 0%, calc(100% - 15px) 100%, 0% 100%);
        }
        
        .btn-folder::before {
          content: ''; position: absolute; top: -10px; left: 18px;
          width: 40%; height: 10px;
          background: #4a1a20; border: 2px solid #b33333; border-bottom: none;
          clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);
          box-shadow: inset 0 2px 2px rgba(255,150,150,0.3);
        }

        .btn-folder::after {
          content: ''; position: absolute; inset: 2px;
          border: 1px solid rgba(255, 100, 100, 0.2);
          clip-path: polygon(13px 0%, 100% 0%, calc(100% - 13px) 100%, 0% 100%);
          pointer-events: none;
        }

        .btn-folder:hover {
          background: linear-gradient(180deg, #70252e 0%, #421218 40%, #1a0609 100%);
          border-color: #ff5555; color: #ffffff;
          box-shadow: 
            0 0 30px rgba(255,30,30,0.6), 
            inset 0 2px 6px rgba(255,200,200,0.4);
          transform: translateY(-2px);
        }
        
        .btn-folder:active { 
          transform: translateY(2px) scale(0.98); 
          box-shadow: 0 2px 10px rgba(0,0,0,0.8), inset 0 2px 5px rgba(0,0,0,0.5);
        }

        /* Пружина с уменьшенной амплитудой */
        @keyframes drop-in {
          0% { opacity: 0; transform: translateY(-100vh); }
          70% { opacity: 1; transform: translateY(6px); }
          85% { transform: translateY(-2px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes fall-down {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(100vh); }
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
        }

        .woland-menu__version {
          color: #444; font-size: 6px; font-family: monospace; letter-spacing: 0px;
        }
      </style>
    `;
    this.isMounted = true;

    const menuEl = container.querySelector('.woland-menu');
    const logoEl = container.querySelector('.woland-menu__logo');
    const backBtn = container.querySelector('#btn-title-screen');

    requestAnimationFrame(() => {
      menuEl.classList.add('active');
    });

    setTimeout(() => {
      logoEl.classList.add('animate-in');
    }, 50);

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

    fetch('./version.json')
      .then(res => res.json())
      .then(data => {
        const versionEl = container.querySelector('#version-display');
        if (versionEl && data.version) versionEl.textContent = data.version;
      })
      .catch(() => {
        const versionEl = container.querySelector('#version-display');
        if (versionEl) versionEl.textContent = 'Версия неизвестна';
      });

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
            btn.style.animation = `fall-down 0.5s cubic-bezier(0.6, 0.04, 0.98, 0.335) ${delay}s forwards`;
          });
          setTimeout(resolve, 600);
        });
      };

      const renderNew = () => {
        btnContainer.innerHTML = ''; 
        config.forEach((btnInfo, index) => {
          const btn = document.createElement('button');
          btn.className = 'btn-folder';
          btn.id = btnInfo.id;
          btn.innerHTML = `<span>${btnInfo.text}</span>`;
          btnContainer.appendChild(btn);

          if (animateIn) {
            btn.style.opacity = '0';
            btn.style.animation = `drop-in 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) ${index * 0.1}s forwards`;
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

    this.handleButtonClick = (btnInfo, containerEl) => {
      const playSfx = () => { if (window.SoundsEngine) window.SoundsEngine.play('transition', { type: 'effects' }); };
      playSfx();

      switch (btnInfo.action) {
        case 'goto-mode':
          this.renderScreen('mode', containerEl);
          break;
        case 'goto-type':
          this.gameMode = btnInfo.mode;
          this.renderScreen('type', containerEl);
          break;
        case 'back-main':
          this.renderScreen('main', containerEl);
          break;
        case 'back-mode':
          this.renderScreen('mode', containerEl);
          break;
        case 'start-game':
          console.log('START GAME:', btnInfo.type, this.gameMode);
          break;
      }
    };

    const goToMenu = () => {
      if (this.isTransitioning || this.currentState === 'menu') return;
      this.isTransitioning = true;
      
      menuEl.classList.add('menu-mode', 'dark-shade');
      if (window.SoundsEngine) window.SoundsEngine.play('transition', { type: 'effects' });

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
        setTimeout(() => { this.isTransitioning = false; }, 1000);
      };
    }

    setTimeout(() => {
      this.renderScreen('main', container, isMenu);
    }, 100);
  }
};
