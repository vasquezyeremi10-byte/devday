import Phaser from 'phaser';
import { PLAYER, TILE_SIZE, WORLD } from '../config/constants';
import { DEPTH } from '../config/layers';
import { Miner } from '../entities/Miner';
import { queueAssets } from '../systems/AssetLoader';
import { MiningSystem, type MiningResult } from '../systems/MiningSystem';
import { MiningHUD } from '../ui/MiningHUD';
import {
  createPlaceholderTextures,
  drawPlaceholderWorld,
} from '../world/PlaceholderArt';
import { mountAssetLayers } from '../world/SceneLayers';
import { createInitialTerrain, TerrainGrid } from '../world/TerrainGrid';
import { TerrainView } from '../world/TerrainView';

export class MiningScene extends Phaser.Scene {
  miner!: Miner;
  terrain!: TerrainView;
  mining!: MiningSystem;
  private selection!: Phaser.GameObjects.Graphics;
  private hud!: MiningHUD;
  private restartRequested = false;

  constructor() {
    super('MiningScene');
  }
  preload(): void {
    queueAssets(this);
  }

  create(): void {
    this.restartRequested = false;
    createPlaceholderTextures(this);
    drawPlaceholderWorld(this);
    mountAssetLayers(this);
    const grid = createInitialTerrain();
    this.mining = new MiningSystem(grid);
    this.terrain = new TerrainView(this, grid);
    this.physics.world.setBounds(
      0,
      0,
      WORLD.columns * TILE_SIZE,
      WORLD.rows * TILE_SIZE,
    );
    this.miner = new Miner(this);
    this.physics.add.collider(this.miner, this.terrain.layer);
    this.cameras.main
      // Espacio inferior para que el HUD no oculte los pies en el fondo del mapa.
      .setBounds(0, 0, WORLD.columns * TILE_SIZE, WORLD.rows * TILE_SIZE + 21)
      .startFollow(this.miner, true, 1, 1);
    this.cameras.main.setDeadzone(100, 50);
    this.selection = this.add.graphics().setDepth(DEPTH.foreground);
    this.hud = new MiningHUD(this);
    this.input.keyboard!.addKey('R').on('down', () => {
      this.restartRequested = true;
    });
    this.input.on('pointerdown', this.onPointerDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.onPointerDown, this);
    });
    document.querySelector('#game-status')!.textContent =
      'Mina lista · Explora y abre camino';
  }

  private target(pointer: Phaser.Input.Pointer) {
    // No reutilizar pointer.worldX/Y: la cámara puede haberse movido sin mover el mouse.
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return TerrainGrid.worldToCell(point.x, point.y);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.leftButtonDown() || this.isOverHUD(pointer)) return;
    const cell = this.target(pointer);
    if (this.mining.dig(this.miner.body.center, cell) === 'ready')
      this.terrain.remove(cell);
  }

  private isOverHUD(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.y >= 249 ||
      (pointer.x >= 10 &&
        pointer.x <= 105 &&
        pointer.y >= 10 &&
        pointer.y <= 31)
    );
  }

  update(): void {
    this.miner.step();
    if (this.restartRequested) {
      this.scene.restart();
      return;
    }
    const pointer = this.input.activePointer;
    const cell = this.target(pointer);
    const result: MiningResult = this.isOverHUD(pointer)
      ? 'empty'
      : this.mining.inspect(this.miner.body.center, cell);
    this.selection.clear();
    if (result !== 'empty' && result !== 'outside') {
      const color = result === 'ready' ? 0xffd580 : 0xb77d70;
      this.selection
        .lineStyle(1, color, 1)
        .strokeRect(
          cell.column * TILE_SIZE + 0.5,
          cell.row * TILE_SIZE + 0.5,
          TILE_SIZE - 1,
          TILE_SIZE - 1,
        );
    }
    this.hud.update(this.miner.body.bottom, this.mining.excavated, result);
  }
}

export const physicsConfig = {
  default: 'arcade',
  arcade: {
    gravity: { x: 0, y: PLAYER.gravity },
    debug: false,
    fixedStep: true,
    fps: 60,
  },
};
