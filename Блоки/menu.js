// Блоки/menu.js

const MENU_BACKGROUND = './Текстуры/Меню/Фон.jpg';
const MENU_LIGHTNING = './Текстуры/Меню/Фон-молния.jpg';
const MENU_LOGO = './Текстуры/Меню/Название.jpg';

export const Menu = {
  isMounted: false,
  lightningTimeout: null,
  lightningInterval: null,

  start(fromSubmenu = false) {
    const container = document.getElementById('game-container');
    if (!container) throw new Error('game-container was not found');

    // Очищаем предыдущие таймеры молний, если они были
    if (this.lightningTimeout) clearTimeout(this.lightningTimeout);
    if (this.lightningInterval) clearInterval(this.lightningInterval);

    const background = (window.GameAssets && window.GameAssets.menu_bg) || MENU_BACKGROUND;
    const lightning = (window.GameAssets && window.GameAssets.menu_lightning) || MENU_LIGHTNING;
    const logo = (window.GameAssets && window.GameAssets.menu_logo) || MENU_LOGO;

    const showButtonsImmediately = fromSubmenu;

    container.innerHTML = `
      <section class="woland-menu" aria-label="Главное меню Woland's Mansion">
        <!-- Слой обычного фона -->
        <div class="woland-menu__bg" style="background-image: url('${background}')"></div>
        <!-- Слой с молнией -->
        <div class="woland-menu__lightning" style="background-image: url('${lightning}')"></div>
        
        <div class="woland-menu__shade"></div>
        
        <!-- ТИТУЛЬНЫЙ ЭКРАН -->
        <div class="woland-menu__title-screen ${showButtonsImmediately ? 'hidden' : ''}">
          <img class="woland-menu__logo" src="${logo}" alt="Woland's Mansion" onerror="this.hidden=true">
          <div class="woland-menu__press-to-continue">Нажмите чтобы продолжить</div>
        </div>

        <!-- ЭКРАН МЕНЮ -->
        <div class="woland-menu__buttons-screen ${showButtonsImmediately ? 'visible' : ''}">
          <div class="woland-menu__content">
            <button class="btn-folder" id="btn-play" type="button">Играть</button>
            <button class="btn-folder" id="btn-settings" type="button">Настройки</button>
            <button class="btn-folder" id="btn-about" type="button">Об игре</button>
            <button class="btn-link" id="btn-back" type="button">Обратно на титульный</button>
          </div>
        </div>

        <div class="woland-menu__footer">HTML Gaming 2026</div>
      </section>
      
      <style>
        .woland-menu {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          overflow: hidden; background: #10090d;
          opacity: 0; transition: opacity 1s ease;
          user-select: none;
        }
        .woland-menu.active { opacity: 1; }
        
        /* Фоновые слои */
        .woland-menu__bg, .woland-menu__lightning {
          position: absolute; inset: 0;
          background-size: cover; background-position: center;
          z-index: 0;
        }
        .woland-menu__lightning {
          opacity: 0; transition: opacity 0.1s ease; /* Быстрое включение */
        }

        .woland-menu__shade {
          position: absolute; inset: 0;
          background: linear-gradient(90deg, rgba(9,5,9,0.7), rgba(9,5,9,0.3), rgba(9,5,9,0.7)), 
                      linear-gradient(0deg, rgba(8,4,8,0.8), transparent 70%);
          z-index: 1;
        }

        /* --- ТИТУЛЬНЫЙ ЭКРАН --- */
        .woland-menu__title-screen {
          position: absolute; inset: 0; z-index: 2;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          transition: opacity 0.5s ease, visibility 0.5s;
        }
        .woland-menu__title-screen.hidden {
          opacity: 0; visibility: hidden; pointer-events: none;
        }

        .woland-menu__logo {
          width: min(80vw, 600px); max-height: 40vh; object-fit: contain;
          filter: drop-shadow(0 0 20px rgba(170,21,21,0.5));
          opacity: 0;
          transform: scaleY(0);
          transform-origin: bottom center;
          /* Анимация растягивания снизу вверх: быстрый старт, плавное замедление */
          transition: transform 1s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 1s ease;
        }
        .woland-menu__logo.animate-in {
          opacity: 1;
          transform: scaleY(1);
        }

        .woland-menu__press-to-continue {
          position: absolute; bottom: 15vh;
          font-size: clamp(16px, 3vh, 24px);
          color: #ccc; letter-spacing: 2px;
          text-shadow: 0 0 10px rgba(255,0,0,0.5);
          opacity: 0; animation: pulse-text 3s infinite;
        }
        @keyframes pulse-text {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }

        /* --- ЭКРАН МЕНЮ --- */
        .woland-menu__buttons-screen {
          position: absolute; inset: 0; z-index: 3;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          opacity: 0; visibility: hidden; pointer-events: none;
          transition: opacity 1.5s ease, visibility 1.5s, background 1.5s ease;
        }
        .woland-menu__buttons-screen.visible {
          opacity: 1; visibility: visible; pointer-events: auto;
          background: rgba(0, 0, 0, 0.5); /* Затемнение 50% */
        }

        .woland-menu__content {
          display: flex; flex-direction: column; gap: clamp(15px, 3vh, 25px);
          width: 100%; max-width: 300px;
        }

        /* Кнопки "Папка" */
        .btn-folder {
          position: relative;
          background: linear-gradient(180deg, #1a1014, #0d0709);
          border: 2px solid #551111; border-radius: 0 8px 8px 8px;
          color: #ddd; font-size: clamp(16px, 2.5vh, 20px);
          padding: clamp(12px, 2vh, 18px) 20px;
          cursor: pointer; transition: all 0.2s ease;
          text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.8);
          letter-spacing: 2px;
        }
        .btn-folder::before {
          content: ''; position: absolute; top: -10px; left: -2px;
          width: 40%; height: 10px;
          background: #1a1014; border: 2px solid #551111; border-bottom: none;
          border-radius: 8px 8px 0 0;
        }
        .btn-folder:hover, .btn-folder:focus-visible {
          background: linear-gradient(180deg, #2a151a, #150a0e);
          border-color: #aa2222; color: #fff;
          box-shadow: 0 0 20px rgba(170,34,34,0.4);
          transform: translateY(-2px);
        }

        /* Ссылка "Назад" */
        .btn-link {
          background: transparent; border: none; color: #888;
          font-size: clamp(12px, 1.8vh, 14px); cursor: pointer;
          text-decoration: underline; text-underline-offset: 4px;
          margin-top: 20px; transition: color 0.2s;
        }
        .btn-link:hover { color: #f00; }

        /* Футер */
        .woland-menu__footer {
          position: absolute; bottom: 15px; width: 100%; text-align: center;
          color: #555; font-size: 12px; letter-spacing: 1px; z-index: 2;
          opacity: 0; transition: opacity 1s ease;
        }
        .woland-menu__footer.visible { opacity: 1; }

        @media (prefers-reduced-motion: reduce) {
          .woland-menu, .woland-menu__logo, .woland-menu__press-to-continue, .woland-menu__buttons-screen, .woland-menu__lightning {
            transition: none !important; animation: none !important;
          }
        }
      </style>
    `;

    const menuEl = container.querySelector('.woland-menu');
    const logoEl = container.querySelector('.woland-menu__logo');
    const pressEl = container.querySelector('.woland-menu__press-to-continue');
    const titleScreen = container.querySelector('.woland-menu__title-screen');
    const buttonsScreen = container.querySelector('.woland-menu__buttons-screen');
    const footerEl = container.querySelector('.woland-menu__footer');
    const lightningEl = container.querySelector('.woland-menu__lightning');

    // --- МУЗЫКА ---
    const playMenuMusic = () => {
      if (window.SoundsEngine && window.SoundsEngine.loadedBuffers && window.SoundsEngine.loadedBuffers.menu_theme) {
        if (window.SoundsEngine.currentMusic === 'menu_theme') return;
        try {
          window.SoundsEngine.play('menu_theme', { loop: true, type: 'music', fadeIn: 1 });
        } catch (error) { console.warn('[Menu] Music unavailable:', error); }
      }
    };

    // --- ЛОГИКА МОЛНИЙ ---
    const triggerLightning = () => {
      if (!lightningEl) return;
      
      // Количество вспышек (2-3)
      const flashes = Math.floor(Math.random() * 2) + 2; 
      let count = 0;

      const doFlash = () => {
        if (count >= flashes) return;
        
        // 1. Резко включаем молнию (0.1с)
        lightningEl.style.transition = 'opacity 0.1s ease';
        lightningEl.style.opacity = '1';
        
        // 2. Через 0.2с плавно гасим (0.7с)
        setTimeout(() => {
          lightningEl.style.transition = 'opacity 0.7s ease';
          lightningEl.style.opacity = '0';
          
          count++;
          // Если есть еще вспышки, повторяем через 0.2с после начала гашения (т.е. через 0.9с всего)
          if (count < flashes) {
            setTimeout(doFlash, 900); 
          }
        }, 200);
      };

      doFlash();
    };

    // Запускаем случайные молнии (раз в 10-20 секунд)
    const scheduleLightning = () => {
      const delay = Math.random() * 10000 + 10000; // от 10000 до 20000 мс
      this.lightningTimeout = setTimeout(() => {
        triggerLightning();
        scheduleLightning();
      }, delay);
    };

    // --- ТИП ЗАПУСКА ---
    if (showButtonsImmediately) {
      menuEl.classList.add('active');
      footerEl.classList.add('visible');
      buttonsScreen.classList.add('visible');
      playMenuMusic();
      scheduleLightning(); // Запускаем молнии
    } else {
      requestAnimationFrame(() => {
        menuEl.classList.add('active');
        footerEl.classList.add('visible');
        playMenuMusic();
        scheduleLightning(); // Запускаем молнии
      });

      // Запуск анимации логотипа через 500мс
      setTimeout(() => {
        if (!titleScreen.classList.contains('hidden')) {
          logoEl.classList.add('animate-in');
        }
      }, 500);

      // Обработчик клика по титульному экрану (прерывание анимации)
      titleScreen.addEventListener('click', () => {
        logoEl.style.transition = 'none';
        logoEl.classList.add('animate-in');
        pressEl.style.display = 'none';
        
        titleScreen.classList.add('hidden');
        buttonsScreen.classList.add('visible');
        
        setTimeout(() => {}, 1000);
      }, { once: true });
    }

    // --- ОБРАБОТЧИКИ КНОПОК ---
    container.querySelector('#btn-back').addEventListener('click', () => {
      if (window.SoundsEngine) window.SoundsEngine.play('btn_click');
      this.start(false);
    });

    container.querySelector('#btn-play').addEventListener('click', () => {
      if (window.SoundsEngine) window.SoundsEngine.play('btn_click');
      console.log('Играть (в разработке)');
    });

    container.querySelector('#btn-settings').addEventListener('click', () => {
      if (window.SoundsEngine) window.SoundsEngine.play('btn_click');
      console.log('Настройки');
    });

    container.querySelector('#btn-about').addEventListener('click', () => {
      if (window.SoundsEngine) window.SoundsEngine.play('btn_click');
      console.log('Об игре');
    });

    this.isMounted = true;
  }
};
