// Блоки/menu.js

import { Game } from './game.js';
import { Settings } from './settings.js';
import { About } from './about.js';

const MENU_BG = './Текстуры/Меню/Фон.jpg';
const MENU_LIGHTNING = './Текстуры/Меню/Фон-молния.jpg';
const MENU_LOGO = './Текстуры/Меню/name1.png';

export const Menu = {
  isMounted: false,
  lightningTimeout: null,

  // mode может быть 'title' или 'menu' (поддерживается также true/false для старого кода)
  start(mode = 'title') {
    if (mode === true) mode = 'menu';
    if (mode === false || !mode) mode = 'title';

    const container = document.getElementById('game-container');
    if (!container) throw new Error('game-container was not found');

    if (this.lightningTimeout) clearTimeout(this.lightningTimeout);

    const bg = (window.GameAssets && window.GameAssets.menu_bg) || MENU_BG;
    const lightning = (window.GameAssets && window.GameAssets.menu_lightning) || MENU_LIGHTNING;
    const logo = (window.GameAssets && window.GameAssets.menu_logo) || MENU_LOGO;

    const isMenu = mode === 'menu';

    container.innerHTML = `
      <section class="woland-menu" aria-label="Главное меню">
        <div class="woland-menu__bg-wrapper ${isMenu ? 'normal-scale' : 'zoom-in'}">
          <div class="woland-menu__bg" style="background-image: url('${bg}')"></div>
          <div class="woland-menu__lightning" style="background-image: url('${lightning}')"></div>
        </div>
        
        <div class="woland-menu__shade ${isMenu ? 'darkened' : ''}"></div>
        
        <!-- Логотип на самом верхнем слое (z-index: 10) -->
        <div class="woland-menu__logo-container ${isMenu ? 'menu-mode animate-instant' : ''}">
          <img class="woland-menu__logo ${isMenu ? 'animate-in' : ''}" src="${logo}" alt="Woland's Mansion" onerror="this.hidden=true">
        </div>

        <!-- ТИТУЛЬНЫЙ ЭКРАН -->
        <div class="woland-menu__title-screen ${isMenu ? 'hidden' : ''}">
          <div class="woland-menu__press-to-continue">Нажмите чтобы продолжить</div>
        </div>

        <!-- ЭКРАН МЕНЮ -->
        <div class="woland-menu__buttons-screen ${isMenu ? 'visible' : ''}">
          <div class="woland-menu__content">
            <button class="btn-folder" id="btn-play" type="button">Играть</button>
            <button class="btn-folder" id="btn-settings" type="button">Настройки</button>
            <button class="btn-folder" id="btn-about" type="button">Об игре</button>
            <button class="btn-link" id="btn-back" type="button">Обратно на титульный</button>
          </div>
        </div>

        <div class="woland-menu__footer ${isMenu ? 'visible' : ''}">HTML Gaming 2026</div>
      </section>
      
      <style>
        .woland-menu {
          position: absolute; inset: 0; overflow: hidden; background: #000;
          opacity: ${isMenu ? '1' : '0'}; transition: opacity 1s ease;
        }
        .woland-menu.active { opacity: 1; }

        /* Зум фона от 1.50 до 1.00 */
        .woland-menu__bg-wrapper {
          position: absolute; inset: 0; z-index: 0;
          transform: scale(1.50);
          transition: transform 1s ease;
        }
        .woland-menu__bg-wrapper.normal-scale {
          transform: scale(1.00);
        }

        .woland-menu__bg, .woland-menu__lightning {
          position: absolute; inset: 0; background-size: cover; background-position: center;
        }
        .woland-menu__lightning {
          opacity: 0; pointer-events: none;
        }

        .woland-menu__shade {
          position: absolute; inset: 0; z-index: 1;
          background: rgba(0, 0, 0, 0.2);
          transition: background 1.5s ease;
        }
        .woland-menu__shade.darkened,
        .woland-menu__buttons-screen.visible ~ .woland-menu__shade {
          background: rgba(0, 0, 0, 0.5);
        }

        /* --- ЛОГОТИП (Самый верхний слой z-index: 10) --- */
        .woland-menu__logo-container {
          position: absolute; top: 15%; left: 50%; transform: translateX(-50%);
          z-index: 10; display: flex; justify-content: center; pointer-events: none;
          transition: top 1.5s cubic-bezier(0.2, 0.8, 0.2, 1), transform 1.5s cubic-bezier(0.2, 0.8, 0.2, 1);
          width: 100%;
        }
        .woland-menu__logo-container.animate-instant {
          transition: none !important;
        }
        .woland-menu__logo {
          width: min(80vw, 600px); max-height: 40vh; object-fit: contain;
          filter: drop-shadow(0 0 20px rgba(170,21,21,0.7));
          opacity: 0; transform: scaleY(0); transform-origin: bottom center;
          transition: transform 1s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 1s ease;
        }
        .woland-menu__logo.animate-in { opacity: 1; transform: scaleY(1); }
        .woland-menu__logo-container.animate-instant .woland-menu__logo {
          transition: none !important; opacity: 1 !important; transform: scaleY(1) !important;
        }

        .woland-menu__logo-container.menu-mode {
          top: 8%;
          transform: translateX(-50%) scale(0.7);
        }

        /* --- ТИТУЛЬНЫЙ ЭКРАН --- */
        .woland-menu__title-screen {
          position: absolute; inset: 0; z-index: 5;
          display: flex; align-items: flex-end; justify-content: center; padding-bottom: 15vh;
          transition: opacity 0.5s ease, visibility 0.5s;
        }
        .woland-menu__title-screen.hidden { opacity: 0; visibility: hidden; pointer-events: none; }

        .woland-menu__press-to-continue {
          font-size: clamp(16px, 3vh, 24px); color: #ccc; letter-spacing: 2px;
          text-shadow: 0 0 10px rgba(255,0,0,0.5); opacity: 0; animation: pulse-text 3s infinite;
        }
        @keyframes pulse-text {
          0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0; }
        }

        /* --- ЭКРАН МЕНЮ --- */
        .woland-menu__buttons-screen {
          position: absolute; inset: 0; z-index: 5;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          opacity: 0; visibility: hidden; pointer-events: none;
          transition: opacity 1.5s ease, visibility 1.5s;
        }
        .woland-menu__buttons-screen.visible { opacity: 1; visibility: visible; pointer-events: auto; }

        .woland-menu__content {
          display: flex; flex-direction: column; gap: clamp(15px, 3vh, 25px);
          width: 100%; max-width: 320px; margin-top: 15vh;
        }

        /* --- КНОПКИ-ПАПКИ СО СКОСОМ / / --- */
        .btn-folder {
          position: relative;
          background: linear-gradient(180deg, #2a1014, #150709);
          border: 2px solid #8a2222;
          color: #ddd; font-size: clamp(16px, 2.5vh, 20px);
          padding: clamp(12px, 2vh, 18px) 20px;
          cursor: pointer; transition: all 0.2s ease;
          text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.8);
          letter-spacing: 2px;
          clip-path: polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%);
        }
        .btn-folder::before {
          content: ''; position: absolute; top: -8px; left: 12px;
          width: 40%; height: 8px;
          background: #2a1014; border: 2px solid #8a2222; border-bottom: none;
          clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);
        }
        .btn-folder:hover {
          background: linear-gradient(180deg, #4a151a, #250a0e);
          border-color: #e44; color: #fff;
          box-shadow: 0 0 20px rgba(200,20,20,0.6);
        }

        .btn-link {
          background: transparent; border: none; color: #888;
          font-size: clamp(12px, 1.8vh, 14px); cursor: pointer;
          text-decoration: underline; text-underline-offset: 4px;
          margin-top: 20px; transition: color 0.2s;
        }
        .btn-link:hover { color: #f00; }

        .woland-menu__footer {
          position: absolute; bottom: 15px; width: 100%; text-align: center;
          color: #555; font-size: 12px; letter-spacing: 1px; z-index: 5;
          opacity: ${isMenu ? '1' : '0'}; transition: opacity 1s ease;
        }
        .woland-menu__footer.visible { opacity: 1; }
      </style>
    `;

    const menuEl = container.querySelector('.woland-menu');
    const bgWrapper = container.querySelector('.woland-menu__bg-wrapper');
    const logoCont = container.querySelector('.woland-menu__logo-container');
    const logoEl = container.querySelector('.woland-menu__logo');
    const pressEl = container.querySelector('.woland-menu__press-to-continue');
    const titleScreen = container.querySelector('.woland-menu__title-screen');
    const buttonsScreen = container.querySelector('.woland-menu__buttons-screen');
    const footerEl = container.querySelector('.woland-menu__footer');
    const lightningEl = container.querySelector('.woland-menu__lightning');

    // --- МУЗЫКА ---
    if (window.SoundsEngine) {
      const currentTrack = window.SoundsEngine.currentMusic || window.SoundsEngine.playingMusic;
      if (currentTrack !== 'menu_theme') {
        window.SoundsEngine.setMasterVolume('music', 0);
        window.SoundsEngine.play('menu_theme', { loop: true, type: 'music' });
        let vol = 0; 
        const targetVol = 0.8; 
        const step = targetVol / 20;
        const fadeIn = setInterval(() => {
          vol += step;
          if (vol >= targetVol) { vol = targetVol; clearInterval(fadeIn); }
          window.SoundsEngine.setMasterVolume('music', vol);
        }, 50);
      } else if (isMenu) {
        window.SoundsEngine.setMasterVolume('music', 0.8);
      }
    }

    // --- РЕАЛИСТИЧНЫЙ СТЕРЕО ЗВУК ГРОМА ---
    const playThunder = () => {
      if (!window.SoundsEngine) return;
      
      // Различные позиции панорамирования: слева, по центру, справа, чуть ближе к краям
      const stereoPositions = [-0.85, -0.5, -0.2, 0, 0.3, 0.65, 0.9];
      const randomPan = stereoPositions[Math.floor(Math.random() * stereoPositions.length)];

      if (window.SoundsEngine.playWithPan) {
        window.SoundsEngine.playWithPan('thunder', { type: 'effects', pan: randomPan });
      } else {
        window.SoundsEngine.play('thunder', { type: 'effects' });
      }

      // С вероятностью раската грома — второй удар через небольшую паузу с другого ракурса
      if (Math.random() > 0.4) {
        setTimeout(() => {
          const secondPan = stereoPositions[Math.floor(Math.random() * stereoPositions.length)];
          if (window.SoundsEngine.playWithPan) {
            window.SoundsEngine.playWithPan('thunder', { type: 'effects', pan: secondPan });
          } else {
            window.SoundsEngine.play('thunder', { type: 'effects' });
          }
        }, Math.random() * 600 + 400);
      }
    };

    // --- ЛОГИКА МОЛНИЙ ---
    const triggerLightning = () => {
      if (!lightningEl) return;
      const flashes = Math.floor(Math.random() * 2) + 2; 
      let count = 0;

      const doFlash = () => {
        if (count >= flashes) return;
        lightningEl.style.transition = 'opacity 0.1s ease';
        lightningEl.style.opacity = '1';
        
        if (count === 0) {
          playThunder();
        }

        setTimeout(() => {
          lightningEl.style.transition = 'opacity 0.7s ease';
          lightningEl.style.opacity = '0';
          count++;
          if (count < flashes) {
            setTimeout(doFlash, 200);
          }
        }, 100);
      };
      doFlash();
    };

    const scheduleLightning = () => {
      const delay = Math.random() * 10000 + 10000; 
      this.lightningTimeout = setTimeout(() => {
        triggerLightning();
        scheduleLightning();
      }, delay);
    };

    let startupTimeout = null;

    if (!isMenu) {
      requestAnimationFrame(() => {
        menuEl.classList.add('active');
        bgWrapper.classList.add('normal-scale');
        footerEl.classList.add('visible');
      });
      
      startupTimeout = setTimeout(() => {
        logoEl.classList.add('animate-in');
      }, 1000);
    } else {
      bgWrapper.classList.add('normal-scale');
    }

    scheduleLightning();

    const goToMenu = () => {
      if (startupTimeout) clearTimeout(startupTimeout);
      logoEl.style.transition = 'none';
      logoEl.classList.add('animate-in');
      bgWrapper.classList.add('normal-scale');
      footerEl.classList.add('visible');

      pressEl.style.display = 'none';
      logoCont.classList.add('menu-mode');
      titleScreen.classList.add('hidden');
      buttonsScreen.classList.add('visible');
      
      if (window.SoundsEngine) window.SoundsEngine.play('transition', { type: 'effects' });
    };

    titleScreen.addEventListener('click', goToMenu, { once: true });

    const playSfx = (name) => {
      if (window.SoundsEngine) window.SoundsEngine.play(name, { type: 'effects' });
    };

    const handleSubmenuTransition = (callback) => {
      playSfx('btn_click');
      menuEl.style.transition = 'opacity 1.5s ease';
      menuEl.style.opacity = '0';
      setTimeout(() => {
        if (callback) callback();
      }, 1500);
    };

    container.querySelector('#btn-back').addEventListener('click', () => {
      playSfx('btn_back');
      this.start('title');
    });

    container.querySelector('#btn-play').addEventListener('click', () => {
      handleSubmenuTransition(() => {
        if (typeof Game !== 'undefined' && Game.start) Game.start();
      });
    });

    container.querySelector('#btn-settings').addEventListener('click', () => {
      handleSubmenuTransition(() => {
        if (typeof Settings !== 'undefined' && Settings.start) Settings.start();
      });
    });

    container.querySelector('#btn-about').addEventListener('click', () => {
      handleSubmenuTransition(() => {
        if (typeof About !== 'undefined' && About.start) About.start();
      });
    });

    this.isMounted = true;
  }
};
