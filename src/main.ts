import Phaser from 'phaser';
import './style.css';
import { VIEW } from './game/config/constants';
import {
  GAME_MAX_SCALE,
  GAME_TITLE,
  MENU_MAX_SCALE,
  PAGE_MAX_SCALE,
  shouldShowMenu,
} from './game/config/menu';
import { installFullscreen } from './game/systems/DisplayMode';
import { shouldShowSplash } from './game/config/splash';
import { DeathScene } from './game/scenes/DeathScene';
import { MenuScene } from './game/scenes/MenuScene';
import { StudioIntroScene } from './game/scenes/StudioIntroScene';
import { PauseScene } from './game/scenes/PauseScene';
import { MiningScene, physicsConfig } from './game/scenes/MiningScene';
import { ExpeditionScene } from './game/scenes/ExpeditionScene';
import { TopDownScene } from './game/scenes/TopDownScene';
import { GalleryScene } from './game/scenes/GalleryScene';
import { TopDownCabinScene } from './game/scenes/TopDownCabinScene';
import { integerZoom, overflowsSlightly } from './game/systems/IntegerZoom';

const parent = document.querySelector<HTMLDivElement>('#game')!;
const topDown =
  new URLSearchParams(window.location.search).get('view') === 'top-down';
// El juego arranca en el menú principal. En desarrollo, un navegador
// automatizado entra directo a la mina (?menu=on / ?menu=off lo fuerzan).
const startInMenu =
  !topDown &&
  shouldShowMenu(
    import.meta.env.DEV,
    navigator.webdriver === true,
    window.location.search,
  );
if (startInMenu) document.body.classList.add('in-menu');
// Modo inmersivo: menú y partida muestran solo el lienzo, a ventana completa
// y sin la página web alrededor. La vista cenital de desarrollo conserva la
// página porque su botón «Volver…» es la única salida de esa vista.
if (!topDown) document.body.classList.add('immersive');
// Antes del menú, la introducción del estudio (config/splash.ts). Un
// navegador automatizado en desarrollo la salta (?splash=on la fuerza).
const splash =
  startInMenu &&
  shouldShowSplash(
    import.meta.env.DEV,
    navigator.webdriver === true,
    window.location.search,
  );
const gameScenes = startInMenu
  ? [...(splash ? [StudioIntroScene] : []), MenuScene, MiningScene]
  : [MiningScene, MenuScene];
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width: VIEW.width,
  height: VIEW.height,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  antialiasGL: false,
  backgroundColor: '#0d1020',
  scale: { mode: Phaser.Scale.NONE, width: VIEW.width, height: VIEW.height },
  physics: physicsConfig,
  // La primera escena de la lista es la que arranca.
  scene: topDown
    ? [TopDownScene, MiningScene, ExpeditionScene, GalleryScene, TopDownCabinScene, MenuScene, DeathScene, PauseScene]
    : [...gameScenes, ExpeditionScene, DeathScene, PauseScene],
  audio: { disableWebAudio: false },
});

function resize(): void {
  // Menú: toda la ventana hasta MENU_MAX_SCALE×. Partida inmersiva: toda la
  // ventana con la mayor escala entera (bandas negras alrededor). Vista
  // cenital de desarrollo: dentro del marco de la página, hasta 3×.
  const body = document.body.classList;
  const inMenu = body.contains('in-menu');
  const immersive = body.contains('immersive');
  const available = immersive
    ? window.innerWidth
    : parent.parentElement!.clientWidth;
  // En pantallas estrechas se conserva 1× con desplazamiento del contenedor.
  // En modo inmersivo se admite un píxel del juego de holgura: así una
  // diferencia de fracciones de píxel físico no cuesta un escalón entero.
  const scale = integerZoom(
    available,
    window.innerHeight,
    inMenu ? MENU_MAX_SCALE : immersive ? GAME_MAX_SCALE : PAGE_MAX_SCALE,
    window.devicePixelRatio,
    immersive ? 1 : 0,
  );
  // Si el lienzo sobra por esa holgura, el contenedor recorta ese margen en
  // lugar de ofrecer un desplazamiento por una fracción de píxel.
  parent.parentElement!.style.overflow =
    immersive &&
    overflowsSlightly(scale, available, window.innerHeight, window.devicePixelRatio)
      ? 'hidden'
      : '';
  parent.style.width = `${VIEW.width * scale}px`;
  parent.style.height = `${VIEW.height * scale}px`;
  game.scale.setZoom(scale);
  game.scale.refresh();
  game.scale.updateBounds();
}
game.events.once(Phaser.Core.Events.READY, resize);
window.addEventListener('resize', resize);
// F11 y cambios de pantalla completa: solo se reajusta el lienzo; la escena
// en curso sigue igual (no se reinicia ni se recarga la partida).
const removeFullscreen = installFullscreen(() => {
  resize();
  game.events.emit('fullscreenchange');
});
const viewport = parent.parentElement!;
const refreshPointerBounds = () => game.scale.updateBounds();
viewport.addEventListener('scroll', refreshPointerBounds);
const restart = document.querySelector<HTMLButtonElement>('#restart')!;
if (topDown) {
  parent.setAttribute(
    'aria-label',
    'Campamento top-down. Usa WASD o las flechas para caminar y Z para interactuar.',
  );
  restart.textContent = 'Volver al juego lateral';
  restart.title = `Abrir ${GAME_TITLE}`;
}
restart.addEventListener('click', () => {
  if (
    game.scene.isActive('DeathScene') ||
    game.scene.isActive('MenuScene') ||
    game.scene.isActive(StudioIntroScene.KEY) ||
    game.scene.isActive(PauseScene.KEY)
  )
    return;
  if (topDown) {
    if (game.scene.isActive('TopDownScene')) {
      const camp = game.scene.getScene('TopDownScene') as TopDownScene;
      if (camp.closeWarehouse()) {
        return;
      }
    }
    if (game.scene.isActive('TopDownCabinScene')) {
      (
        game.scene.getScene('TopDownCabinScene') as TopDownCabinScene
      ).requestExit();
      return;
    }
    if (game.scene.isActive('GalleryScene')) {
      (game.scene.getScene('GalleryScene') as GalleryScene).requestExit();
      return;
    }
    if (game.scene.isActive('ExpeditionScene')) {
      (game.scene.getScene('ExpeditionScene') as ExpeditionScene).requestExit();
      return;
    }
    if (!game.scene.isActive('TopDownScene')) {
      (game.scene.getScene('MiningScene') as MiningScene).returnToCamp();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    window.location.assign(url);
    return;
  }
  if (game.scene.isActive('MiningScene'))
    (game.scene.getScene('MiningScene') as MiningScene).returnToSurface();
  parent.focus();
});

// Solo desarrollo: observación para pruebas de comportamiento en navegador real.
if (import.meta.env.DEV) {
  Object.assign(window, { __MINA_GAME__: game });
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    window.removeEventListener('resize', resize);
    removeFullscreen();
    viewport.removeEventListener('scroll', refreshPointerBounds);
    game.destroy(true);
  });
