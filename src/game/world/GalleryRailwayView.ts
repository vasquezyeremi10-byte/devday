import Phaser from 'phaser';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { mineralInfo } from '../config/minerals';
import {
  CART_RADIUS,
  GALLERY_CART_LIMIT,
  GALLERY_STATION,
  type GalleryRailway,
} from '../systems/GalleryRailway';
import { smallText } from '../ui/PixelFont';
import { TerrainGrid } from './TerrainGrid';

type Graphics = Phaser.GameObjects.Graphics;
const rect = (
  g: Graphics,
  color: number,
  x: number,
  y: number,
  w: number,
  h: number,
) => g.fillStyle(color).fillRect(x, y, w, h);

export class GalleryRailwayView {
  private readonly tracks: Graphics;
  private readonly cart: Graphics;
  private readonly count: Phaser.GameObjects.BitmapText;
  private readonly body: Phaser.Physics.Arcade.StaticBody;

  constructor(
    scene: Phaser.Scene,
    private readonly railway: GalleryRailway,
    miner: Phaser.Physics.Arcade.Sprite,
  ) {
    this.tracks = scene.add.graphics().setDepth(DEPTH.terrain + 1);
    this.cart = scene.add.graphics();
    this.count = smallText(scene, 0, 0, '', P.cream)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.worldUi + 2);
    const p = railway.point;
    const hitbox = scene.add.zone(p.x, p.y, CART_RADIUS * 2, CART_RADIUS * 2);
    scene.physics.add.existing(hitbox, true);
    this.body = hitbox.body as Phaser.Physics.Arcade.StaticBody;
    scene.physics.add.collider(miner, hitbox);
    this.redraw();
    this.update(false);
  }

  redraw(): void {
    const g = this.tracks.clear();
    const { x, y } = TerrainGrid.center(GALLERY_STATION);
    rect(g, P.earth, x - 8, y - 8, 16, 16);
    for (let i = -7; i < 8; i += 4) {
      rect(g, P.loam, x - 7, y + i, 14, 2);
      rect(g, P.gold, x - 7, y + i, 2, 1);
    }
    for (const key of this.railway.segments) {
      const cell = this.railway.cell(key);
      if (this.railway.grid.isSolid(cell.column, cell.row)) continue;
      const x = cell.column * 16 + 8,
        y = cell.row * 16 + 8;
      const links = this.railway.connections(cell);
      const h = links.find((d) => d.x),
        v = links.find((d) => d.y);
      const iron = (ax: number, ay: number, bx: number, by: number) => {
        const xx = x + Math.min(ax, bx),
          yy = y + Math.min(ay, by);
        if (ay === by) {
          rect(g, P.slate, xx, yy, Math.abs(bx - ax) + 1, 2);
          rect(g, P.steel, xx, yy, Math.abs(bx - ax) + 1, 1);
        } else {
          rect(g, P.slate, xx, yy, 2, Math.abs(by - ay) + 1);
          rect(g, P.steel, xx, yy, 1, Math.abs(by - ay) + 1);
        }
      };
      for (const d of links) {
        for (const n of [2, 6]) {
          const xx = x + d.x * n,
            yy = y + d.y * n;
          rect(
            g,
            P.earth,
            xx - (d.y ? 5 : 1),
            yy - (d.x ? 5 : 1),
            d.y ? 11 : 2,
            d.x ? 11 : 2,
          );
          rect(
            g,
            P.clay,
            xx - (d.y ? 4 : 1),
            yy - (d.x ? 4 : 1),
            d.y ? 7 : 1,
            d.x ? 7 : 1,
          );
        }
      }
      if (h && v) {
        for (const side of [-1, 1]) {
          const ix = h.x * side * 3,
            iy = v.y * side * 3;
          iron(ix, iy, h.x < 0 ? -8 : 7, iy);
          iron(ix, iy, ix, v.y < 0 ? -8 : 7);
        }
      } else {
        const vertical = !!v;
        const min = links.some((d) => d.x < 0 || d.y < 0) ? -8 : -1;
        const max = links.some((d) => d.x > 0 || d.y > 0) ? 7 : 1;
        for (const side of [-3, 3]) {
          if (vertical) iron(side, min, side, max);
          else iron(min, side, max, side);
        }
        if (links.length < 2) {
          const end = min === -8 ? 1 : -1;
          rect(
            g,
            P.umber,
            x + (vertical ? -5 : end),
            y + (vertical ? end : -5),
            vertical ? 11 : 2,
            vertical ? 2 : 11,
          );
          rect(
            g,
            P.ochre,
            x + (vertical ? -4 : end),
            y + (vertical ? end : -4),
            vertical ? 8 : 1,
            vertical ? 1 : 8,
          );
        }
      }
      for (const d of links)
        for (const side of [-3, 3]) {
          const offset = d.x < 0 || d.y < 0 ? 7 : 6;
          rect(
            g,
            P.silver,
            x + d.x * offset + d.y * side,
            y + d.y * offset + d.x * side,
            1,
            1,
          );
        }
    }
  }

  update(showCount: boolean): void {
    const { x, y } = this.railway.point;
    if (x !== this.body.center.x || y !== this.body.center.y)
      this.body.reset(x, y);
    const g = this.cart
      .clear()
      .setPosition(Math.round(x), Math.round(y))
      .setDepth(DEPTH.characters + y / 1000);
    const w = this.railway.heading.y ? 12 : 14;
    const d = this.railway.heading.y ? 14 : 12;
    const ax = -w / 2,
      ay = -d / 2;
    const spin = Math.floor(this.railway.travelled / 2) % 2;
    const shake = this.railway.pushing
      ? Math.floor(this.railway.travelled / 4) % 2
      : 0;
    rect(g, P.earth, ax + 1, ay + 4, w + 2, d - 1);
    for (const xx of [ax, -ax - 2])
      for (const yy of [ay + 1, -ay - 2]) {
        rect(g, P.ink, xx, yy, 3, 3);
        rect(g, P.steel, xx + 1, yy + spin, 1, 1);
      }
    const top = ay - 3 + shake;
    rect(g, P.ink, ax, top, w, d - 1);
    rect(g, P.steel, ax + 1, top + 1, w - 2, d - 3);
    rect(g, P.silver, ax + 1, top + 1, w - 3, 1);
    rect(g, P.slate, ax + 2, top + 3, w - 4, d - 7);
    rect(g, P.stone, ax + 1, top + d - 4, w - 2, 2);
    for (const xx of [ax + 2, -ax - 3])
      rect(g, P.silver, xx, top + d - 4, 1, 1);
    const items = this.railway.inventory.items;
    for (let i = 0; i < Math.min(items.length, 5); i++) {
      const material = items[i]!;
      const colors =
        material === 'dirt' || material === 'stone'
          ? [P.khaki, P.steel]
          : mineralInfo(material).chips;
      const px = ax + 3 + ((i * 3) % (w - 6)),
        py = top + 3 + Math.floor(i / 2);
      rect(g, colors[0]!, px, py, 3, 2);
      rect(g, colors[1]!, px + 1, py, 1, 1);
    }
    this.count
      .setVisible(showCount)
      .setPosition(Math.round(x), Math.round(y) - 22)
      .setText(`CARRITO: ${items.length}/${GALLERY_CART_LIMIT}`);
  }
}
