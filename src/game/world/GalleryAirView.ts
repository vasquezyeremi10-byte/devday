import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { GALLERY_AIR as AIR } from '../config/galleryAir';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import type { GalleryVentilation } from '../systems/GalleryVentilation';
import { smallText } from '../ui/PixelFont';
import { TerrainGrid, type Point } from './TerrainGrid';
import { galleryVisible, type TopDownGallery } from './TopDownGallery';

type Graphics = Phaser.GameObjects.Graphics;
const rect = (
  g: Graphics,
  c: number,
  x: number,
  y: number,
  w: number,
  h: number,
) => g.fillStyle(c).fillRect(x, y, w, h);
const colorOf = (q: number) =>
  q >= AIR.good
    ? P.mint
    : q >= AIR.adequate
      ? P.gold
      : q >= AIR.critical
        ? P.orange
        : P.red;
export const airWarning = (q: number): string =>
  q === 0
    ? 'SIN AIRE · REGRESA A LA TOMA'
    : q < AIR.critical
      ? 'FALTA DE VENTILACION'
      : q < AIR.adequate
        ? 'AIRE DEFICIENTE'
        : '';

export class GalleryAirView {
  private readonly pipes: Graphics;
  private readonly fans: Graphics;
  private readonly arrows: Graphics;
  private readonly plate: Graphics;
  private readonly meter: Phaser.GameObjects.BitmapText;
  private readonly warning: Phaser.GameObjects.BitmapText;
  private readonly motor?: Phaser.Sound.BaseSound;
  private revision = -1;
  private frame = -1;
  private arrowFrame = -1;
  private reading = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly gallery: TopDownGallery,
  ) {
    this.pipes = scene.add.graphics().setDepth(DEPTH.terrain + 2);
    this.fans = scene.add.graphics().setDepth(DEPTH.terrain + 3);
    this.arrows = scene.add.graphics().setDepth(DEPTH.worldUi + 3);
    this.arrows.setName('gallery-airflow');
    this.plate = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 2);
    this.meter = smallText(scene, 425, 28, '', P.mint)
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 3);
    this.warning = smallText(scene, 474, 39, '', P.red)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 3);
    if (scene.cache.audio.exists('sfx-ventilation')) {
      this.motor = scene.sound.add('sfx-ventilation', {
        loop: true,
        volume: 0.12,
      });
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        this.motor?.destroy(),
      );
    }
  }

  update(
    now: number,
    origin: Point,
    quality: number,
    inspecting: boolean,
    modal: boolean,
  ): void {
    const network = this.gallery.ventilation;
    if (network.revision !== this.revision) {
      this.drawPipes(network);
      this.revision = network.revision;
      this.frame = -1;
      this.arrowFrame = -1;
    }
    const frame = Math.floor(now / 110);
    if (frame !== this.frame) {
      this.frame = frame;
      this.drawFans(network, frame % 4);
      const audible =
        !modal &&
        [...network.running].some((key) => {
          const fan = network.fans.get(key)!;
          const p = TerrainGrid.center(fan);
          return (
            Math.hypot(p.x - origin.x, p.y - origin.y) < 42 &&
            galleryVisible(this.gallery.grid, origin, fan)
          );
        });
      if (audible && !this.motor?.isPlaying && !this.scene.sound.locked)
        this.motor?.play();
      else if (!audible && this.motor?.isPlaying) this.motor.stop();
    }
    this.arrows.setVisible(inspecting && !modal);
    if (this.arrows.visible && this.arrowFrame !== frame) {
      this.arrowFrame = frame;
      this.drawFlow(network, frame % 3);
    }
    this.plate.setVisible(!modal);
    this.meter.setVisible(!modal);
    this.warning.setVisible(!modal && !!airWarning(quality));
    if (quality === this.reading) return;
    this.reading = quality;
    const color = colorOf(quality);
    this.meter.setText(`AIRE: ${quality}%`).setTint(color);
    this.warning.setText(airWarning(quality)).setTint(color);
    const p = this.plate.clear();
    rect(p, P.steel, 411, 26, 64, 11);
    rect(p, P.ink, 412, 27, 62, 9);
    for (const [x, y, w] of [
      [414, 29, 7],
      [415, 31, 5],
      [414, 33, 7],
    ] as const)
      rect(p, color, x, y, w, 1);
  }

  private drawPipes(network: GalleryVentilation): void {
    const g = this.pipes.clear();
    for (const duct of network.ducts.values()) {
      if (network.grid.isSolid(duct.column, duct.row)) continue;
      const x = duct.column * TILE_SIZE + 4,
        y = duct.row * TILE_SIZE + 4;
      const live = network.ductAir[network.key(duct)]! > 0;
      const links = network.links(duct);
      for (const { x: dx, y: dy } of links) {
        const endX = x + (dx < 0 ? -4 : dx > 0 ? 11 : 0);
        const endY = y + (dy < 0 ? -4 : dy > 0 ? 11 : 0);
        const sx = Math.min(x, endX),
          sy = Math.min(y, endY);
        const w = Math.abs(endX - x) + 1,
          h = Math.abs(endY - y) + 1;
        rect(
          g,
          P.ink,
          sx - (dy ? 2 : 0),
          sy - (dx ? 2 : 0),
          dy ? 5 : w,
          dx ? 5 : h,
        );
        rect(
          g,
          P.stone,
          sx - (dy ? 1 : 0),
          sy - (dx ? 1 : 0),
          dy ? 3 : w,
          dx ? 3 : h,
        );
        rect(
          g,
          live ? P.silver : P.steel,
          sx - (dy ? 1 : 0),
          sy - (dx ? 1 : 0),
          dy ? 1 : w,
          dx ? 1 : h,
        );
        rect(
          g,
          P.slate,
          x + dx * 3 - (dy ? 2 : 0),
          y + dy * 3 - (dx ? 2 : 0),
          dy ? 5 : 1,
          dx ? 5 : 1,
        );
      }
      rect(g, P.ink, x - 2, y - 2, 5, 5);
      rect(g, P.steel, x - 1, y - 1, 3, 3);
      rect(
        g,
        duct.integrity < 100 ? P.rust : live ? P.mint : P.slate,
        x,
        y,
        1,
        1,
      );
    }
  }

  private drawFans(network: GalleryVentilation, frame: number): void {
    const g = this.fans.clear();
    for (const [key, fan] of network.fans) {
      if (network.grid.isSolid(fan.column, fan.row)) continue;
      const x = fan.column * TILE_SIZE + 4,
        y = fan.row * TILE_SIZE + 4;
      const active = network.running.has(key);
      const direction = network.direction(fan);
      for (const sign of [-1, 1]) {
        const dx = direction.x * sign,
          dy = direction.y * sign;
        const port = { column: fan.column + dx, row: fan.row + dy };
        if (!network.links(port).some((d) => d.x === -dx && d.y === -dy))
          continue;
        rect(
          g,
          P.stone,
          x + (dx < 0 ? -4 : dx > 0 ? 4 : -1),
          y + (dy < 0 ? -4 : dy > 0 ? 4 : -1),
          dx > 0 ? 8 : dx ? 4 : 3,
          dy > 0 ? 8 : dy ? 4 : 3,
        );
        rect(
          g,
          P.silver,
          x + (dx < 0 ? -4 : dx > 0 ? 4 : -1),
          y + (dy < 0 ? -4 : dy > 0 ? 4 : -1),
          dx > 0 ? 8 : dx ? 4 : 1,
          dy > 0 ? 8 : dy ? 4 : 1,
        );
      }
      rect(g, P.ink, x - 4, y - 4, 10, 10);
      rect(g, fan.kind === 'fan_main' ? P.ochre : P.steel, x - 4, y - 4, 9, 9);
      rect(g, P.slate, x - 3, y - 3, 7, 7);
      rect(g, P.ink, x - 2, y - 2, 5, 5);
      const blades = active ? frame : 0;
      for (const [dx, dy] of [
        [-2, -1],
        [1, -2],
        [2, 1],
        [-1, 2],
      ] as const) {
        const px = blades % 2 ? -dy : dx;
        const py = blades % 2 ? dx : dy;
        rect(g, blades < 2 ? P.silver : P.steel, x + px, y + py, 2, 1);
      }
      rect(g, P.steel, x, y, 1, 1);
      rect(
        g,
        active ? P.mint : fan.enabled ? P.orange : P.red,
        x - 3,
        y + 3,
        2,
        1,
      );
      rect(g, P.silver, x + direction.x * 5, y + direction.y * 5, 2, 2);
    }
  }

  private drawFlow(network: GalleryVentilation, phase: number): void {
    const g = this.arrows.clear();
    for (let row = 0; row < network.grid.rows; row++)
      for (let column = 0; column < network.grid.columns; column++) {
        if (
          !this.gallery.visibility.has(column, row) ||
          network.grid.isSolid(column, row)
        )
          continue;
        const cell = { column, row },
          key = network.key(cell);
        const duct = network.ductAt(cell);
        const q = duct ? network.ductAir[key]! : network.at(cell);
        const c = duct && !q ? P.steel : colorOf(q);
        const dx = network.flowX[key]!,
          dy = network.flowY[key]!;
        const p = TerrainGrid.center(cell);
        const x = p.x - (duct ? 4 : 0) + dx * phase,
          y = p.y - (duct ? 4 : 0) + dy * phase;
        if (!q || (!dx && !dy)) {
          rect(g, c, x - 1, y, 3, 1);
          continue;
        }
        rect(g, c, x - (dx ? 2 : 0), y - (dy ? 2 : 0), dx ? 5 : 1, dy ? 5 : 1);
        for (const side of [-1, 1]) {
          rect(g, c, x + dx + dy * side, y + dy + dx * side, 1, 1);
          rect(g, c, x + dy * side * 2, y + dx * side * 2, 1, 1);
        }
      }
  }
}
