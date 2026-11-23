import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { DEPTH } from '../config/layers';
import type { VisibilitySystem } from '../systems/VisibilitySystem';
import { WORLD_REV_SOLID } from './Geology';
import { createSolidTerrainTexture, SOLID_TERRAIN_TEXTURE } from './TerrainArt';
import type { Cell, TerrainGrid } from './TerrainGrid';
import { edgeFrame, terrainFrame, transitionFrame } from './TerrainVisuals';

/**
 * Tres capas de tiles sobre la misma textura: la base (única con colisión),
 * las franjas de transición entre estratos y el autotile de bordes. Las dos
 * últimas son decorativas y se recalculan alrededor de cada bloque cambiado.
 * Un bloque no descubierto se dibuja como su estrato: no delata su mena.
 */
export class TerrainView {
  readonly layer: Phaser.Tilemaps.TilemapLayer;
  private readonly transitions: Phaser.Tilemaps.TilemapLayer;
  private readonly edges: Phaser.Tilemaps.TilemapLayer;
  private readonly revealed: (column: number, row: number) => boolean;

  /**
   * Columna del mundo del primer tile: `grid.first` (en el mundo abierto, el
   * borde oeste en x negativas). Los cuadros se eligen con la columna del
   * mundo, así las macrotexturas y la superficie continúan sin corte; las
   * capas de tiles usan la columna local (columna − offset).
   */
  private readonly offset: number;

  constructor(
    scene: Phaser.Scene,
    private readonly grid: TerrainGrid,
    private readonly visibility?: VisibilitySystem,
  ) {
    const offset = grid.first;
    this.offset = offset;
    this.revealed = visibility ? (c, r) => visibility.has(c, r) : () => true;
    const solid = grid.worldRev >= WORLD_REV_SOLID;
    if (solid) createSolidTerrainTexture(scene);
    const map = scene.make.tilemap({
      width: grid.columns,
      height: grid.rows,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage(
      'terrain',
      solid ? SOLID_TERRAIN_TEXTURE : 'terrain',
      TILE_SIZE,
      TILE_SIZE,
      0,
      0,
    );
    if (!tileset) throw new Error('Falta el tileset de terreno');
    const create = (name: string, depth: number) => {
      const layer = map.createBlankLayer(name, tileset);
      if (!(layer instanceof Phaser.Tilemaps.TilemapLayer))
        throw new Error('No se pudo crear terreno CPU');
      return layer.setDepth(depth).setX(offset * TILE_SIZE);
    };
    this.layer = create('terrain', DEPTH.terrain);
    this.transitions = create('transitions', DEPTH.terrain + 1);
    this.edges = create('edges', DEPTH.terrain + 2);
    for (let row = 0; row < grid.rows; row++)
      for (let column = 0; column < grid.columns; column++) {
        const frame = terrainFrame(grid, column + offset, row, this.revealed);
        if (frame >= 0) this.layer.putTileAt(frame, column, row, false);
        this.decorate(column + offset, row);
      }
    // Toda variante visual colisiona; solo el vacío es transitable.
    this.layer.setCollisionByExclusion([-1], true, true);
  }

  private decorate(column: number, row: number): void {
    const tile = column - this.offset;
    const set = (layer: Phaser.Tilemaps.TilemapLayer, frame: number) => {
      if (frame >= 0) layer.putTileAt(frame, tile, row, false);
      else layer.removeTileAt(tile, row, false, false);
    };
    const hidden =
      this.grid.isSolid(column, row) && !this.revealed(column, row);
    set(
      this.transitions,
      hidden ? -1 : transitionFrame(this.grid, column, row),
    );
    set(this.edges, edgeFrame(this.grid, column, row, this.revealed));
  }

  /** Frame base que mostraba un bloque antes de retirarlo (para el efecto). */
  frameAt({ column, row }: Cell): number {
    return this.tileAt(column, row)?.index ?? -1;
  }

  /** Tile de la capa base en una columna del MUNDO (null si está vacío). */
  tileAt(column: number, row: number): Phaser.Tilemaps.Tile | null {
    return this.layer.getTileAt(column - this.offset, row);
  }

  /** Base con colisión de una celda según el estado actual del terreno. */
  private base(column: number, row: number): void {
    const frame = terrainFrame(this.grid, column, row, this.revealed);
    const tile = column - this.offset;
    if (frame < 0) {
      this.layer.removeTileAt(tile, row, true, true);
      return;
    }
    this.layer
      .putTileAt(frame, tile, row, false)
      .setCollision(true, true, true, true, false);
    this.layer.calculateFacesAt(tile, row);
  }

  /** Redibuja una celda y la decoración de sus vecinas. */
  redraw({ column, row }: Cell): void {
    if (!this.grid.contains(column, row)) return;
    this.base(column, row);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const c = column + dx;
        const r = row + dy;
        if (this.grid.contains(c, r)) this.decorate(c, r);
      }
  }

  remove(cell: Cell): void {
    this.redraw(cell);
  }

  /** Aplica descubrimientos pendientes (mena revelada, cavernas abiertas). */
  sync(): number {
    const v = this.visibility;
    if (!v?.dirty.length) return 0;
    const n = v.dirty.length;
    for (const i of v.dirty.splice(0)) this.redraw(this.grid.cellOf(i));
    return n;
  }
}
