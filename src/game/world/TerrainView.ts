import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { DEPTH } from '../config/layers';
import { Block, type Cell, type TerrainGrid } from './TerrainGrid';

export class TerrainView {
  readonly layer: Phaser.Tilemaps.TilemapLayer;

  constructor(scene: Phaser.Scene, grid: TerrainGrid) {
    const map = scene.make.tilemap({
      data: grid.cells.map((row) => [...row]),
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage(
      'terrain',
      'terrain',
      TILE_SIZE,
      TILE_SIZE,
      0,
      0,
    );
    if (!tileset) throw new Error('Falta el tileset de terreno');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!(layer instanceof Phaser.Tilemaps.TilemapLayer))
      throw new Error('No se pudo crear terreno CPU');
    this.layer = layer.setDepth(DEPTH.terrain);
    this.layer.setCollision([Block.Dirt, Block.Rock, Block.Bedrock]);
  }

  remove({ column, row }: Cell): void {
    // replaceWithNull y recalculateFaces eliminan colisión y exponen vecinos.
    this.layer.removeTileAt(column, row, true, true);
  }
}
