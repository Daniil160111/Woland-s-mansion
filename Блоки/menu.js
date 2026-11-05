const MENU_BACKGROUND = './Текстуры/Меню/Фон.jpg';
const MENU_LOGO = './Текстуры/Меню/name1.png';

export const Menu = {
  start() {
    const container = document.getElementById('game-container');
    if (!container) throw new Error('game-container was not found');

    const background = window.GameAssets && window.GameAssets.menu_bg;
    const logo = window.GameAssets && window.GameAssets.menu_logo;
    const safeBackground = background || MENU_BACKGROUND;
    const safeLogo = logo || MENU_LOGO;

    container.innerHTML = `
      <section class="woland-menu" aria-label="Главное меню Woland's Mansion">
        <div class="woland-menu__shade"></div>
        <div class="woland-menu__content">
          <img class="woland-menu__logo" src="${safeLogo}" alt="Woland's Mansion" onerror="this.hidden=true">
          <h1>WOLAND'S MANSION</h1>
          <button class="woland-menu__button" type="button">Начать игру</button>
          <p class="woland-menu__message" role="status" aria-live="polite"></p>
        </div>
      </section>
      <style>
        .woland-menu { position: absolute; inset: 0; display: grid; place-items: center; overflow: hidden; background: #10090d url("${safeBackground}") center / cover no-repeat; animation: woland-menu-in .9s ease both; }
        .woland-menu__shade { position: absolute; inset: 0; background: linear-gradient(90deg, #090509bb, #09050955, #090509bb), linear-gradient(0deg, #080408cc, transparent 70%); }
        .woland-menu__content { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: clamp(14px, 3vh, 28px); padding: 24px; text-align: center; }
        .woland-menu__logo { width: min(78vw, 560px); max-height: 32vh; object-fit: contain; filter: drop-shadow(0 0 20px #aa151566); animation: woland-logo-in 1.1s .12s both; }
        .woland-menu h1 { margin: 0; color: #f2e6df; font-size: clamp(22px, 5vw, 48px); letter-spacing: .14em; text-shadow: 0 4px 24px #000; }
        .woland-menu__button { min-width: 210px; padding: 14px 28px; color: #fff; background: linear-gradient(135deg,#941010,#460707); border: 1px solid #d85353; border-radius: 7px; cursor: pointer; box-shadow: 0 0 22px #bd151544; transition: transform .2s, box-shadow .2s; }
        .woland-menu__button:hover, .woland-menu__button:focus-visible { transform: translateY(-2px); box-shadow: 0 0 30px #e22a2a88; }
        .woland-menu__message { min-height: 1.4em; margin: 0; color: #eee; text-shadow: 0 2px 6px #000; }
        @keyframes woland-menu-in { from { opacity: 0; transform: scale(1.025); } to { opacity: 1; transform: scale(1); } }
        @keyframes woland-logo-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .woland-menu, .woland-menu__logo { animation: none; } }
      </style>`;

    const button = container.querySelector('.woland-menu__button');
    const message = container.querySelector('.woland-menu__message');
    button.addEventListener('click', () => {
      message.textContent = 'Игровой уровень появится в следующем обновлении.';
      button.textContent = 'Игра скоро';
      button.disabled = true;
    }, { once: true });

    if (window.SoundsEngine && window.SoundsEngine.loadedBuffers && window.SoundsEngine.loadedBuffers.menu_theme) {
      try { window.SoundsEngine.play('menu_theme', { loop: true, type: 'music' }); } catch (error) { console.warn('[Menu] Music unavailable:', error); }
    }
  }
};
