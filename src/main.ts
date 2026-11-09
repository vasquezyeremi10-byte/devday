import Phaser from 'phaser';
import './style.css';
import { VIEW } from './game/config/constants';
import { MiningScene, physicsConfig } from './game/scenes/MiningScene';

const parent = document.querySelector<HTMLDivElement>('#game')!;
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width: VIEW.width,
  height: VIEW.height,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#292936',
  scale: { mode: Phaser.Scale.NONE, width: VIEW.width, height: VIEW.height },
  physics: physicsConfig,
  scene: [MiningScene],
  audio: { noAudio: true },
});

function resize(): void {
  const available = parent.parentElement!.clientWidth;
  const scale =
    available >= VIEW.width
      ? Math.max(1, Math.floor(available / VIEW.width))
      : available / VIEW.width;
  parent.style.width = `${VIEW.width * scale}px`;
  parent.style.height = `${VIEW.height * scale}px`;
  game.scale.setZoom(scale);
  game.scale.refresh();
}
game.events.once(Phaser.Core.Events.READY, resize);
window.addEventListener('resize', resize);
document.querySelector('#restart')!.addEventListener('click', () => {
  if (game.scene.isActive('MiningScene'))
    game.scene.getScene('MiningScene').scene.restart();
  parent.focus();
});

// Solo desarrollo: observación para pruebas de comportamiento en navegador real.
if (import.meta.env.DEV) {
  Object.assign(window, { __MINA_GAME__: game });
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    window.removeEventListener('resize', resize);
    game.destroy(true);
  });
