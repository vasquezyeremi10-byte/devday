import type Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { DEPTH } from '../config/layers';
import type { TerrainGrid } from '../world/TerrainGrid';
import type { Miner } from './Miner';

/**
 * Accesorios visuales del minero, sin efecto en su física: sombra de
 * tablero sobre el suelo real bajo sus pies. La luz del casco ya no es una
 * imagen superpuesta: la calcula LightingSystem con oclusión real.
 */
export class MinerGear {
  private readonly shadow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add
      .image(0, 0, 'warehouse', 'shadow_small')
      .setOrigin(0, 0)
      .setDepth(DEPTH.characters - 1);
  }

  update(miner: Miner, grid: TerrainGrid): void {
    const column = Math.floor(miner.x / TILE_SIZE);
    // Suelo real: primera celda sólida bajo los pies, hasta 4 bloques abajo.
    const start = Math.floor((miner.body.bottom - 1) / TILE_SIZE) + 1;
    let ground = -1;
    for (let row = start; row < start + 4 && row < grid.rows; row++)
      if (grid.isSolid(column, row)) {
        ground = row * TILE_SIZE;
        break;
      }
    this.shadow
      .setVisible(ground >= 0)
      .setPosition(Math.round(miner.x) - 6, ground);
  }
}
