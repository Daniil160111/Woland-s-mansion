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

    // Если возвращаемся из подменю, фон уже есть (он не перезагружается), просто показываем кнопки.
    // Но для упрощения мы перерисовываем DOM, но музыка играть не перестает.
    const isReturn = fromSubmenu;

    container.innerHTML = `
      <section class="woland-menu" aria-label="Главное меню">
        <!-- Фоны вынесены в отдельные слои. Яркость меняется на контейнере -->
        <div class="woland-menu__bg" style="background-image: url('${bg}')"></div>
        <div class="woland-menu__lightning" style="background-image: url('${lightning}')"></div>
        <div class="woland-menu__shade"></div>
        
        <!-- Логотип теперь есть и на титульном, и в меню -->
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
            <!-- Форма папки через clip-path и border-image -->
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
          opacity: 0; transition: opacity 0.1s ease;
        }

        .woland-menu__shade {
          position: absolute; inset: 0;
          background: linear-gradient(90deg, rgba(9,5,9,0.7), rgba(9,5,9,0.3), rgba(9,5,9,0.7)), 
                      linear-gradient(0deg, rgba(8,4,8,0.8), transparent 70%);
          z-index: 1; transition: background 1.5s ease;
        }
        .woland-menu__buttons-screen.visible ~ .woland-menu__shade {
          background: rgba(0, 0, 0, 0.5); /* Затемнение 50% при меню */
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

        /* Позиция логотипа в меню (сдвигаем вверх) */
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
          width: 100%; max-width: 320px; margin-top: 15vh; /* Отступ под логотип */
        }

        /* --- КНОПКИ-ПАПКИ (Скошенные края / /) --- */
        .btn-folder {
          position: relative;
          background: linear-gradient(180deg, #2a1014, #150709);
          border: 2px solid #8a2222;
          /* Скошенные углы справа сверху и слева снизу для эффекта папки */
          border-radius: 8px 0 8px 0;
          color: #ddd; font-size: clamp(16px, 2.5vh, 20px);
          padding: clamp(12px, 2vh, 18px) 20px;
          cursor: pointer; transition: all 0.2s ease;
          text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.8);
          letter-spacing: 2px; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
        }
        /* Язычок папки */
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

    // --- МУЗЫКА (НЕ ПЕРЕЗАПУСКАЕТСЯ, ТОЛЬКО МЕНЯЕТ ГРОМКОСТЬ) ---
    if (window.SoundsEngine) {
      // Проверяем, играет ли уже тема меню
      const isMusicPlaying = window.SoundsEngine.currentMusic === 'menu_theme';
      
      if (!isMusicPlaying) {
        // Запускаем плавно с 0 до 80%
        window.SoundsEngine.setMasterVolume('music', 0);
        window.SoundsEngine.play('menu_theme', { loop: true, type: 'music' });
        // Плавное появление
        let vol = 0; const targetVol = 0.8; const step = targetVol / 20;
        const fadeIn = setInterval(() => {
          vol += step;
          if (vol >= targetVol) { vol = targetVol; clearInterval(fadeIn); }
          window.SoundsEngine.setMasterVolume('music', vol);
        }, 50); // 1 секунда
      }
    }

    // --- ЛОГИКА МОЛНИЙ ---
    const triggerLightning = () => {
      if (!lightningEl) return;
      const flashes = Math.floor(Math.random() * 2) + 2; // 2-3 вспышки
      let count = 0;

      const doFlash = () => {
        if (count >= flashes) return;
        
        lightningEl.style.transition = 'opacity 0.1s ease';
        lightningEl.style.opacity = '1';
        
        setTimeout(() => {
          lightningEl.style.transition = 'opacity 0.7s ease';
          lightningEl.style.opacity = '0';
          count++;
          if (count < flashes) setTimeout(doFlash, 900); 
        }, 200);
      };
      doFlash();
    };

    const scheduleLightning = () => {
      const delay = Math.random() * 10000 + 10000; // 10-20 сек
      this.lightningTimeout = setTimeout(() => {
        triggerLightning();
        scheduleLightning();
      }, delay);
    };

    // --- СТАРТ (АНИМАЦИЯ) ---
    if (!isReturn) {
      requestAnimationFrame(() => {
        menuEl.classList.add('active');
        footerEl.classList.add('visible');
      });
      
      // Анимация логотипа (старт через 500мс)
      setTimeout(() => {
        if (!titleScreen.classList.contains('hidden')) {
          logoEl.classList.add('animate-in');
        }
      }, 500);
    } else {
      // Если возвращаемся, логотип уже на месте
      logoEl.classList.add('animate-in');
    }

    scheduleLightning();

    // Обработчик клика по титульному (прерывание анимации)
    titleScreen.addEventListener('click', () => {
      logoEl.style.transition = 'none';
      logoEl.classList.add('animate-in');
      pressEl.style.display = 'none';
      
      // Переводим логотип в режим меню (сдвиг вверх)
      logoCont.classList.add('menu-mode');
      titleScreen.classList.add('hidden');
      buttonsScreen.classList.add('visible');
      
      // Проигрываем звук перехода
      if (window.SoundsEngine) window.SoundsEngine.play('Переход', { type: 'effects' });
    }, { once: true });

    // --- ОБРАБОТЧИКИ КНОПОК ---
    const playSfx = (name) => {
      if (window.SoundsEngine) window.SoundsEngine.play(name, { type: 'effects' });
    };

    container.querySelector('#btn-back').addEventListener('click', () => {
      playSfx('Назад');
      // Перезапускаем меню в режиме титульного
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
