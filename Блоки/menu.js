// Блоки/menu.js

const MENU_BG = './Текстуры/Меню/Фон.jpg';
const MENU_LIGHTNING = './Текстуры/Меню/Фон-молния.jpg';
const MENU_LOGO = './Текстуры/Меню/Название.jpg';

export const Menu = {
  isMounted: false,
  lightningTimeout: null,

  // fromSubmenu = true, если возвращаемся из настроек/об игре
  start(fromSubmenu = false) {
    const container = document.getElementById('game-container');
    if (!container) throw new Error('game-container was not found');

    if (this.lightningTimeout) clearTimeout(this.lightningTimeout);

    const bg = (window.GameAssets && window.GameAssets.menu_bg) || MENU_BG;
    const lightning = (window.GameAssets && window.GameAssets.menu_lightning) || MENU_LIGHTNING;
    const logo = (window.GameAssets && window.GameAssets.menu_logo) || MENU_LOGO;

    const isReturn = fromSubmenu;

    container.innerHTML = `
      <section class="woland-menu" aria-label="Главное меню">
        <div class="woland-menu__bg" style="background-image: url('${bg}')"></div>
        <div class="woland-menu__lightning" style="background-image: url('${lightning}')"></div>
        <div class="woland-menu__shade"></div>
        
        <div class="woland-menu__logo-container ${isReturn ? 'menu-mode' : ''}">
          <img class="woland-menu__logo" src="${logo}" alt="Woland's Mansion" onerror="this.hidden=true">
        </div>

        <!-- ТИТУЛЬНЫЙ ЭКРАН -->
        <div class="woland-menu__title-screen ${isReturn ? 'hidden' : ''}">
          <div class="woland-menu__press-to-continue">Нажмите чтобы продолжить</div>
        </div>

        <!-- ЭКРАН МЕНЮ -->
        <div class="woland-menu__buttons-screen ${isReturn ? 'visible' : ''}">
          <div class="woland-menu__content">
            <button class="btn-folder" id="btn-play" type="button">Играть</button>
            <button class="btn-folder" id="btn-settings" type="button">Настройки</button>
            <button class="btn-folder" id="btn-about" type="button">Об игре</button>
            <button class="btn-link" id="btn-back" type="button">Обратно на титульный</button>
          </div>
        </div>

        <div class="woland-menu__footer ${isReturn ? 'visible' : ''}">HTML Gaming 2026</div>
      </section>
      
      <style>
        .woland-menu {
          position: absolute; inset: 0; overflow: hidden; background: #10090d;
          opacity: ${isReturn ? '1' : '0'}; transition: opacity 1s ease;
        }
        .woland-menu.active { opacity: 1; }

        /* Фоны */
        .woland-menu__bg, .woland-menu__lightning {
          position: absolute; inset: 0; background-size: cover; background-position: center;
          z-index: 0;
        }
        .woland-menu__lightning {
          opacity: 0; pointer-events: none;
        }

        .woland-menu__shade {
          position: absolute; inset: 0;
          background: linear-gradient(90deg, rgba(9,5,9,0.7), rgba(9,5,9,0.3), rgba(9,5,9,0.7)), 
                      linear-gradient(0deg, rgba(8,4,8,0.8), transparent 70%);
          z-index: 1; transition: background 1.5s ease;
        }
        .woland-menu__buttons-screen.visible ~ .woland-menu__shade {
          background: rgba(0, 0, 0, 0.5);
        }

        /* --- ЛОГОТИП --- */
        .woland-menu__logo-container {
          position: absolute; top: 15%; left: 50%; transform: translateX(-50%);
          z-index: 2; display: flex; justify-content: center; pointer-events: none;
          transition: top 1.5s ease, transform 1.5s ease;
          width: 100%;
        }
        .woland-menu__logo {
          width: min(80vw, 600px); max-height: 40vh; object-fit: contain;
          filter: drop-shadow(0 0 20px rgba(170,21,21,0.5));
          opacity: 0; transform: scaleY(0); transform-origin: bottom center;
          transition: transform 1s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 1s ease;
        }
        .woland-menu__logo.animate-in { opacity: 1; transform: scaleY(1); }

        .woland-menu__logo-container.menu-mode {
          top: 10%;
          transform: translateX(-50%) scale(0.7);
        }

        /* --- ТИТУЛЬНЫЙ ЭКРАН --- */
        .woland-menu__title-screen {
          position: absolute; inset: 0; z-index: 3;
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
          position: absolute; inset: 0; z-index: 4;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          opacity: 0; visibility: hidden; pointer-events: none;
          transition: opacity 1.5s ease, visibility 1.5s;
        }
        .woland-menu__buttons-screen.visible { opacity: 1; visibility: visible; pointer-events: auto; }

        .woland-menu__content {
          display: flex; flex-direction: column; gap: clamp(15px, 3vh, 25px);
          width: 100%; max-width: 320px; margin-top: 15vh;
        }

        /* --- КНОПКИ-ПАПКИ --- */
        .btn-folder {
          position: relative;
          background: linear-gradient(180deg, #2a1014, #150709);
          border: 2px solid #8a2222;
          border-radius: 8px 0 8px 0;
          color: #ddd; font-size: clamp(16px, 2.5vh, 20px);
          padding: clamp(12px, 2vh, 18px) 20px;
          cursor: pointer; transition: all 0.2s ease;
          text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.8);
          letter-spacing: 2px;
        }
        .btn-folder::before {
          content: ''; position: absolute; top: -8px; left: -2px;
          width: 45%; height: 8px;
          background: #2a1014; border: 2px solid #8a2222; border-bottom: none;
          border-radius: 6px 6px 0 0;
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
          color: #555; font-size: 12px; letter-spacing: 1px; z-index: 2;
          opacity: ${isReturn ? '1' : '0'}; transition: opacity 1s ease;
        }
        .woland-menu__footer.visible { opacity: 1; }
      </style>
    `;

    const menuEl = container.querySelector('.woland-menu');
    const logoCont = container.querySelector('.woland-menu__logo-container');
    const logoEl = container.querySelector('.woland-menu__logo');
    const pressEl = container.querySelector('.woland-menu__press-to-continue');
    const titleScreen = container.querySelector('.woland-menu__title-screen');
    const buttonsScreen = container.querySelector('.woland-menu__buttons-screen');
    const footerEl = container.querySelector('.woland-menu__footer');
    const lightningEl = container.querySelector('.woland-menu__lightning');

    // --- МУЗЫКА (ЗАПУСКАЕТСЯ ТОЛЬКО ЕСЛИ ЕЩЁ НЕ ИГРАЕТ) ---
    if (window.SoundsEngine) {
      const currentTrack = window.SoundsEngine.currentMusic || window.SoundsEngine.playingMusic;
      const isMusicPlaying = currentTrack === 'menu_theme';
      
      if (!isMusicPlaying) {
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
      }
    }

    // --- ЛОГИКА МОЛНИЙ ---
    const triggerLightning = () => {
      if (!lightningEl) return;
      const flashes = Math.floor(Math.random() * 2) + 2; // 2 или 3 вспышки
      let count = 0;

      const doFlash = () => {
        if (count >= flashes) return;
        
        // Появление молнии за 0.1 секунды
        lightningEl.style.transition = 'opacity 0.1s ease';
        lightningEl.style.opacity = '1';
        
        setTimeout(() => {
          // Плавное угасание за 0.7 секунд
          lightningEl.style.transition = 'opacity 0.7s ease';
          lightningEl.style.opacity = '0';
          count++;
          
          if (count < flashes) {
            // Резкий повторный всплеск через 0.2 секунды после начала угасания
            setTimeout(doFlash, 200);
          }
        }, 100);
      };
      doFlash();
    };

    const scheduleLightning = () => {
      const delay = Math.random() * 10000 + 10000; // От 10 до 20 секунд
      this.lightningTimeout = setTimeout(() => {
        triggerLightning();
        scheduleLightning();
      }, delay);
    };

    // --- СТАРТ АНИМАЦИИ ---
    if (!isReturn) {
      requestAnimationFrame(() => {
        menuEl.classList.add('active');
        footerEl.classList.add('visible');
      });
      
      setTimeout(() => {
        if (!titleScreen.classList.contains('hidden')) {
          logoEl.classList.add('animate-in');
        }
      }, 500);
    } else {
      logoEl.classList.add('animate-in');
    }

    scheduleLightning();

    // Клик по титульному экрану
    titleScreen.addEventListener('click', () => {
      logoEl.style.transition = 'none';
      logoEl.classList.add('animate-in');
      pressEl.style.display = 'none';
      
      logoCont.classList.add('menu-mode');
      titleScreen.classList.add('hidden');
      buttonsScreen.classList.add('visible');
      
      if (window.SoundsEngine) window.SoundsEngine.play('Переход', { type: 'effects' });
    }, { once: true });

    // --- КНОПКИ ---
    const playSfx = (name) => {
      if (window.SoundsEngine) window.SoundsEngine.play(name, { type: 'effects' });
    };

    container.querySelector('#btn-back').addEventListener('click', () => {
      playSfx('Назад');
      this.start(false);
    });

    container.querySelector('#btn-play').addEventListener('click', () => {
      playSfx('Кнопка');
      console.log('Играть');
    });

    container.querySelector('#btn-settings').addEventListener('click', () => {
      playSfx('Кнопка');
      console.log('Настройки');
    });

    container.querySelector('#btn-about').addEventListener('click', () => {
      playSfx('Кнопка');
      console.log('Об игре');
    });

    this.isMounted = true;
  }
};
