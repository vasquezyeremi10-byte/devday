import type Phaser from 'phaser';
import type { GameSession } from './GameSession';
import type { Point } from '../world/TerrainGrid';

export const SURFACE_MODE = 'MiningScene';
/** La mina jugable es lateral; la galería cenital anterior queda fuera del flujo. */
export const MINE_MODE = 'ExpeditionScene';
export interface MineVisit {
  session: GameSession;
  player: Point;
  fromSurface?: boolean;
  /** Entrada creada por la transición tramada, no por una carga directa. */
  fromFog?: boolean;
}

// Solo una escena procesa controles y física durante el cruce.
export function changeMineMode(
  scene: Phaser.Scene,
  mode: typeof SURFACE_MODE | typeof MINE_MODE,
  visit: MineVisit,
): void {
  const camera = scene.cameras.main;
  if (!scene.input.enabled) return;
  scene.physics.pause();
  scene.input.enabled = false;
  camera.once('camerafadeoutcomplete', () => {
    scene.scene.start(mode, mode === MINE_MODE ? visit : { mineVisit: visit });
  });
  camera.fade(180, 0, 0, 0, true);
}

export function arriveInMode(scene: Phaser.Scene): void {
  scene.input.enabled = true;
  scene.physics.resume();
  scene.input.keyboard?.resetKeys();
  scene.cameras.main.fadeIn(180);
}
