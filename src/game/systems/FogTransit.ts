import Phaser from 'phaser';
import { VIEW } from '../config/constants';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { DitherCover } from '../ui/DitherCover';
import type { FogPortal } from '../ui/FogPortal';

/** Secuencia corta de absorción que reemplaza los cambios instantáneos de vista. */
export function crossFog(
  scene: Phaser.Scene,
  portal: FogPortal,
  traveler: Phaser.Physics.Arcade.Sprite,
  target: string,
  data: object | undefined,
): void {
  if (!scene.input.enabled) return;
  scene.input.enabled = false;
  scene.input.keyboard?.resetKeys();
  scene.physics.pause();
  traveler.setVelocity(0, 0);
  portal.setIntensity(1);
  const camera = scene.cameras.main;
  camera.stopFollow();
  camera.pan(portal.x, portal.y - 18, 360, 'Sine.easeInOut', true);
  camera.zoomTo(1.08, 360, 'Sine.easeInOut', true);
  const cover = new DitherCover(scene, 0, 0, VIEW.width, VIEW.height, P.ink, DEPTH.ui + 20);
  const streaks = scene.add.graphics().setDepth(DEPTH.worldUi + 20);
  let step = 0;
  scene.time.addEvent({
    delay: 48,
    repeat: 10,
    callback: () => {
      step++;
      const t = step / 11;
      cover.set(t);
      portal.setIntensity(Math.min(1, 0.35 + t));
      streaks.clear();
      for (let i = 0; i < 12; i++) {
        const bend = ((i * 13 + step * 3) % 9) - 4;
        const x = Math.round(traveler.x + (portal.x - traveler.x) * t + bend * (1 - t));
        const y = Math.round(traveler.y - 6 + (portal.y - traveler.y - 14) * t + ((i % 3) - 1) * 5);
        streaks.fillStyle(i % 3 === 0 ? P.mist : P.violet).fillRect(x, y, t > 0.55 ? 2 : 1, 1);
      }
      if (step >= 11) scene.scene.start(target, data);
    },
  });
}

/** Aparición equivalente, tramada y sin alfa parcial. */
export function revealFromFog(scene: Phaser.Scene, complete: () => void): void {
  scene.input.enabled = false;
  scene.physics.pause();
  const cover = new DitherCover(scene, 0, 0, VIEW.width, VIEW.height, P.ink, DEPTH.ui + 20);
  let step = 0;
  scene.time.addEvent({
    delay: 48,
    repeat: 8,
    callback: () => {
      step++;
      cover.set(1 - step / 9);
      if (step < 9) return;
      cover.destroy();
      scene.cameras.main.setZoom(1);
      scene.physics.resume();
      scene.input.keyboard?.resetKeys();
      scene.input.enabled = true;
      complete();
    },
  });
}
