import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { DEPTH } from '../config/layers';
import { HEADLAMP_RANGE, LIGHTING } from '../config/lighting';
import { mineralInfo, type MineralKey } from '../config/minerals';
import { PALETTE as P } from '../config/palette';
import { UndergroundDarkness } from '../lighting/UndergroundDarkness';
import { GalleryStability } from '../systems/GalleryStability';
import { GEOTECH } from '../systems/GeotechnicalSystem';
import {
  Block,
  mineralOf,
  TerrainGrid,
  type Cell,
  type Point,
} from './TerrainGrid';
import {
  GALLERY_ENTRY,
  galleryVisible,
  type TopDownGallery,
} from './TopDownGallery';

const rect = (
  g: Phaser.GameObjects.Graphics,
  color: number,
  x: number,
  y: number,
  w: number,
  h: number,
) => g.fillStyle(color).fillRect(x, y, w, h);
const unit = TILE_SIZE;
const lightCell = LIGHTING.renderCell;
const WORK_LAMPS = [
  { column: 5, row: 10 },
  { column: 26, row: 11 },
].map(TerrainGrid.center);

/** Siluetas de veta para la planta cenital; se reconocen aun con poca luz. */
function oreMarks(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  ore: MineralKey,
): void {
  const [dark, mid, light] = mineralInfo(ore).chips;
  if (ore === 'coal') {
    // Carbón: fragmentos angulosos, con arista fría sobre la roca oscura.
    for (const [dx, dy, w] of [
      [2, 3, 5],
      [9, 7, 5],
      [4, 11, 4],
    ]) {
      rect(g, P.steel, x + dx!, y + dy!, w!, 1);
      rect(g, P.ink, x + dx!, y + dy! + 1, w! - 1, 3);
      rect(g, P.night, x + dx! + 1, y + dy! + 2, w! - 2, 1);
    }
    return;
  }
  if (ore === 'iron') {
    // Hierro: masas compactas de óxido con un núcleo metálico.
    for (const [dx, dy] of [
      [3, 4],
      [9, 9],
    ]) {
      rect(g, P.umber, x + dx! - 1, y + dy!, 7, 5);
      rect(g, mid!, x + dx!, y + dy!, 5, 3);
      rect(g, light!, x + dx! + 1, y + dy!, 3, 1);
      rect(g, P.steel, x + dx! + 2, y + dy! + 2, 2, 1);
      rect(g, dark!, x + dx! + 1, y + dy! + 3, 4, 1);
    }
    return;
  }
  if (ore === 'copper') {
    // Cobre: veta ramificada y dos destellos claros separados.
    for (const [dx, dy, w] of [
      [2, 10, 5],
      [5, 8, 5],
      [8, 5, 5],
      [10, 3, 3],
    ]) {
      rect(g, P.umber, x + dx! - 1, y + dy! + 1, w! + 1, 2);
      rect(g, mid!, x + dx!, y + dy!, w!, 2);
      rect(g, light!, x + dx! + 1, y + dy!, 2, 1);
    }
    rect(g, P.mint, x + 3, y + 9, 2, 1);
    rect(g, P.mint, x + 11, y + 4, 1, 1);
    return;
  }
  // Las vetas adicionales conservan cristales escalonados, no puntos redondos.
  for (const [dx, dy] of [
    [3, 4],
    [10, 7],
    [5, 11],
  ]) {
    rect(g, dark!, x + dx! - 1, y + dy!, 5, 4);
    rect(g, mid!, x + dx!, y + dy!, 3, 3);
    rect(g, light!, x + dx!, y + dy!, 2, 1);
  }
}

export class TopDownGalleryView {
  readonly darkness: UndergroundDarkness;
  readonly lit: Float32Array;
  private readonly terrain: Phaser.GameObjects.Graphics;
  private readonly solids: Phaser.Physics.Arcade.StaticBody[] = [];
  private readonly byCell = new Map<number, Phaser.Physics.Arcade.StaticBody>();
  private readonly posts = new Map<
    number,
    Phaser.Physics.Arcade.StaticBody[]
  >();
  private readonly frames: Phaser.GameObjects.Graphics;
  private previous = '';
  private dirty = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly gallery: TopDownGallery,
    miner: Phaser.Physics.Arcade.Sprite,
  ) {
    const { grid } = gallery;
    this.lit = new Float32Array(grid.columns * grid.rows);
    this.terrain = scene.add.graphics().setDepth(DEPTH.terrain);
    this.frames = scene.add.graphics().setDepth(DEPTH.foreground - 1);
    this.darkness = new UndergroundDarkness(scene);
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.columns; c++) {
        if (!grid.isSolid(c, r)) continue;
        this.terrainChanged({ column: c, row: r });
      }
    scene.physics.add.collider(miner, this.solids);
    for (const support of gallery.stability.supports.values())
      this.supportChanged(support, false);
    this.drawFrames();
  }

  private discard(body: Phaser.Physics.Arcade.StaticBody): void {
    body.enable = false;
    Phaser.Utils.Array.Remove(this.solids, body);
    body.destroy();
  }

  terrainChanged(cell: Cell): void {
    const key = cell.row * this.gallery.grid.columns + cell.column;
    const body = this.byCell.get(key);
    if (this.gallery.grid.isSolid(cell.column, cell.row)) {
      if (!body) {
        const solid = this.scene.physics.add.staticBody(
          cell.column * unit,
          cell.row * unit,
          unit,
          unit,
        );
        this.solids.push(solid);
        this.byCell.set(key, solid);
      }
    } else if (body) {
      this.discard(body);
      this.byCell.delete(key);
    }
    this.dirty = true;
    this.previous = '';
  }

  supportChanged(cell: Cell, draw = true): void {
    const stability = this.gallery.stability;
    const key = stability.key(cell);
    this.posts.get(key)?.forEach((body) => this.discard(body));
    this.posts.delete(key);
    const support = stability.at(cell);
    if (support) {
      const posts = GalleryStability.posts(support).map(({ x, y }) =>
        this.scene.physics.add.staticBody(x - 1.5, y - 1.5, 3, 3),
      );
      this.posts.set(key, posts);
      this.solids.push(...posts);
    }
    this.dirty = true;
    if (draw) this.drawFrames();
  }

  private drawFrames(): void {
    const g = this.frames.clear();
    for (const support of this.gallery.stability.supports.values()) {
      const wood = support.kind === 'wood';
      const edge = wood ? P.umber : P.ink,
        face = wood ? P.clay : P.steel;
      const lit = wood ? P.ochre : P.silver;
      const intact = support.durability > 0;
      for (const { x, y } of GalleryStability.posts(support)) {
        rect(g, P.earth, x - 2, y + 1, 5, 2);
        rect(g, edge, x - 2, y - (intact ? 5 : 2), 4, intact ? 7 : 4);
        rect(g, face, x - 1, y - (intact ? 5 : 2), 2, intact ? 6 : 3);
        rect(g, lit, x - 1, y - (intact ? 4 : 2), 1, 2);
      }
      if (!intact) continue;
      const { x, y } = TerrainGrid.center(support);
      const cross = support.axis === 'x';
      rect(
        g,
        edge,
        x - (cross ? 2 : 7),
        y - (cross ? 11 : 7),
        cross ? 5 : 15,
        cross ? 14 : 4,
      );
      rect(
        g,
        face,
        x - (cross ? 1 : 6),
        y - (cross ? 10 : 6),
        cross ? 3 : 13,
        cross ? 12 : 2,
      );
      rect(
        g,
        lit,
        x - (cross ? 1 : 6),
        y - (cross ? 10 : 6),
        cross ? 1 : 13,
        cross ? 12 : 1,
      );
      for (const d of [-5, 5])
        rect(
          g,
          wood ? P.silver : P.slate,
          x + (cross ? 0 : d),
          y + (cross ? d - 3 : -5),
          1,
          1,
        );
    }
  }

  illuminate(
    camera: Phaser.Cameras.Scene2D.Camera,
    origin: Point,
    aim: Point,
    lamp: number,
  ): void {
    const { grid, visibility } = this.gallery;
    const ox = Math.round(origin.x / 2) * 2,
      oy = Math.round(origin.y / 2) * 2;
    const key = [
      ox,
      oy,
      aim.x,
      aim.y,
      Math.round(lamp * 20),
      Math.floor(camera.scrollX / lightCell),
      Math.floor(camera.scrollY / lightCell),
    ].join(',');
    if (key === this.previous && !this.dirty) return;
    this.previous = key;
    this.lit.fill(0);
    const from = { x: ox, y: oy };
    const nearRadius = 42 + 30 * lamp;
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.columns; c++) {
        const center = TerrainGrid.center({ column: c, row: r });
        const dx = center.x - ox,
          dy = center.y - oy;
        const distance = Math.hypot(dx, dy);
        const angle = (dx * aim.x + dy * aim.y) / Math.max(1, distance);
        const beam =
          angle > 0.62 && distance < HEADLAMP_RANGE
            ? lamp * Math.pow(1 - distance / (HEADLAMP_RANGE + 16), 1.1)
            : 0;
        // El rebote cercano del casco ilumina el uniforme y las herramientas.
        const near = Math.max(0, 1 - distance / nearRadius) * (0.94 + lamp * 0.06);
        const entryDistance = Math.hypot(
          center.x - GALLERY_ENTRY.x,
          center.y - GALLERY_ENTRY.y,
        );
        const entry =
          entryDistance < 41 &&
          galleryVisible(grid, GALLERY_ENTRY, { column: c, row: r })
            ? 0.86 - entryDistance / 75
            : 0;
        const current =
          (beam || near) && galleryVisible(grid, from, { column: c, row: r })
            ? Math.max(beam, near)
            : 0;
        let value = Math.max(current, entry);
        if (this.gallery.layoutSeed !== undefined) {
          for (const source of WORK_LAMPS) {
            const dist = Math.hypot(center.x - source.x, center.y - source.y);
            if (
              dist < 48 &&
              galleryVisible(grid, source, { column: c, row: r })
            )
              value = Math.max(value, 0.9 - dist / 64);
          }
        }
        if (value <= 0) continue;
        this.lit[r * grid.columns + c] = value;
        if (visibility.reveal(c, r)) this.dirty = true;
      }
    if (this.dirty) this.draw();
    const d = this.darkness;
    d.begin(camera);
    for (let y = 0; y < d.rows; y++)
      for (let x = 0; x < d.columns; x++) {
        const i = y * d.columns + x;
        const c = Math.floor((d.x + x * lightCell) / unit);
        const r = Math.floor((d.y + y * lightCell) / unit);
        if (!visibility.has(c, r)) continue;
        const light = this.lit[r * grid.columns + c]!;
        d.known[i] = 1;
        d.light[i] = light;
        d.warm[i] = light > 0.3 ? 1 : 0;
        d.glowAmount[i] = Math.max(0, light - 0.35) * 0.48;
      }
    d.compose();
    d.present();
  }

  private draw(): void {
    this.dirty = false;
    const { grid, visibility } = this.gallery;
    visibility.dirty.length = 0;
    const g = this.terrain.clear();
    rect(g, P.ink, 0, 0, grid.columns * unit, grid.rows * unit);
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.columns; c++) {
        if (!visibility.has(c, r)) continue;
        const x = c * unit,
          y = r * unit;
        const block = grid.get(c, r);
        const seed = (c * 53 + r * 71 + c * r * 13) & 15;
        if (block === Block.Air) {
          rect(g, seed % 3 ? P.taupe : P.desertRock, x, y, 16, 16);
          rect(g, P.earth, x + (seed % 9), y + 11, 4, 1);
          rect(g, P.khaki, x + ((seed + 3) % 10), y + 4, 3, 1);
          rect(g, P.desertRock, x + 11, y + 7 + (seed % 4), 2, 1);
          if (grid.isSolid(c, r - 1)) rect(g, P.earth, x, y, 16, 2);
          if (grid.isSolid(c - 1, r)) rect(g, P.desertRock, x, y, 2, 16);
          continue;
        }
        if (block === Block.Rubble) {
          rect(g, P.earth, x, y, 16, 16);
          for (const [dx, dy, w] of [
            [2, 4, 5],
            [8, 2, 6],
            [5, 9, 6],
            [11, 10, 4],
            [1, 11, 3],
          ]) {
            rect(g, P.slate, x + dx!, y + dy!, w!, 4);
            rect(g, P.taupe, x + dx! + 1, y + dy!, w! - 2, 2);
            rect(g, P.khaki, x + dx! + 1, y + dy!, 2, 1);
          }
          continue;
        }
        // Planos de roca continuos y fisuras parciales, sin marco por celda.
        const base = block === Block.Bedrock ? P.night : P.stone;
        rect(g, base, x, y, 16, 16);
        // Las caras expuestas tienen un canto irregular y un estrato claro.
        if (!grid.isSolid(c, r + 1)) {
          const ledge = 9 + (seed % 3);
          rect(g, P.slate, x, y + ledge, 16, 16 - ledge);
          rect(g, P.steel, x, y + ledge - 1, 6 + (seed % 5), 1);
          rect(g, P.stone, x + 4 + (seed % 4), y + ledge + 1, 6, 2);
        }
        if (seed % 3 === 0) {
          const dx = 2 + (seed % 7);
          const dy = 3 + ((c * 7 + r * 3) % 8);
          rect(g, P.slate, x + dx, y + dy, 5, 1);
          rect(g, P.slate, x + dx + 4, y + dy + 1, 1, 3);
          rect(g, P.steel, x + dx, y + dy - 1, 2, 1);
        }
        if (seed % 5 === 1) rect(g, P.steel, x + 2 + (seed % 9), y + 4, 2, 1);
        if (!grid.isSolid(c, r + 1)) rect(g, P.ink, x, y + 15, 16, 1);
        const ore = mineralOf(block);
        if (!ore || !grid.isExposed(c, r)) continue;
        oreMarks(g, x, y, ore);
      }
    }
    for (const sector of this.gallery.stability.sectors.values()) {
      for (const { cell, score } of sector.cells) {
        if (!visibility.has(cell.column, cell.row)) continue;
        const { x, y } = TerrainGrid.center(cell);
        const c = score >= GEOTECH.imminent ? P.ember : P.umber;
        rect(g, c, x - 3, y - 6, 4, 1);
        rect(g, c, x, y - 5, 1, 3);
        if (score >= GEOTECH.danger) {
          rect(g, c, x, y - 2, 4, 1);
          rect(g, c, x + 3, y - 1, 1, 3);
        }
      }
    }
    if (this.gallery.layoutSeed !== undefined) {
      for (const { x, y } of WORK_LAMPS) {
        rect(g, P.earth, x - 7, y + 4, 14, 2);
        rect(g, P.umber, x - 7, y - 7, 2, 12);
        rect(g, P.clay, x - 7, y - 7, 11, 2);
        rect(g, P.ink, x - 2, y - 5, 5, 7);
        rect(g, P.gold, x - 1, y - 3, 3, 4);
        rect(g, P.cream, x, y - 2, 1, 2);
      }
    }
    // Trampilla con marco de madera y peldaños de acero.
    const { x, y } = GALLERY_ENTRY;
    rect(g, P.earth, x - 11, y - 16, 23, 25);
    for (let yy = y - 16; yy < y + 8; yy += 4) {
      rect(g, P.clay, x - 10, yy, 21, 3);
      rect(g, P.ochre, x - 10, yy, 12, 1);
      rect(g, P.ink, x + 9, yy + 1, 1, 1);
    }
    rect(g, P.umber, x - 8, y - 16, 16, 16);
    rect(g, P.ochre, x - 7, y - 15, 14, 2);
    rect(g, P.ink, x - 5, y - 12, 10, 11);
    for (let yy = y - 11; yy < y; yy += 3) rect(g, P.steel, x - 4, yy, 8, 1);
    rect(g, P.umber, x - 14, y + 2, 6, 7);
    rect(g, P.gold, x - 13, y + 3, 4, 4);
    rect(g, P.cream, x - 12, y + 3, 2, 3);
  }
}
