import type Phaser from 'phaser';
import {
  CABIN_BED,
  CABIN_BOARD,
  CABIN_FURNITURE,
  CABIN_ROOM,
} from '../config/topDownCabin';
import { PALETTE as P } from '../config/palette';
import type { DayNightCycle } from '../systems/DayNightCycle';

type Art = Phaser.GameObjects.Graphics;
const rect = (g: Art, c: number, x: number, y: number, w: number, h: number) =>
  g.fillStyle(c).fillRect(x, y, w, h);

/** Dibujo original a resolución nativa, con huellas independientes del arte. */
export class TopDownCabinView {
  private readonly window: Art;
  private readonly lamp: Art;
  private readonly board: Art;
  private readonly sleeper: Art;
  private lighting = '';
  private boardState = '';

  constructor(scene: Phaser.Scene, miner: Phaser.Physics.Arcade.Sprite) {
    const { x, y, w, h } = CABIN_ROOM;
    const floor = scene.add.graphics();
    rect(floor, P.night, x - 6, y - 7, w + 12, h + 14);
    for (let row = 0; row < h / 4; row++) {
      const yy = y + row * 4;
      rect(floor, row % 3 ? P.loam : P.clay, x, yy, w, 4);
      rect(floor, P.earth, x, yy + 3, w, 1);
      for (let xx = x + ((row * 17) % 31); xx < x + w - 9; xx += 37) {
        rect(floor, P.umber, xx, yy + 1, 1, 2);
        rect(floor, P.ochre, xx + 2, yy, 6, 1);
      }
    }
    rect(floor, P.umber, x, y, w, 20);
    for (let yy = y + 1; yy < y + 20; yy += 5) {
      rect(floor, P.earth, x + 1, yy, w - 2, 4);
      rect(floor, P.clay, x + 3, yy, w - 6, 1);
    }
    rect(floor, P.ink, x, y + 19, w, 2);
    for (const xx of [x - 4, x + w]) {
      rect(floor, P.ink, xx, y, 4, h);
      rect(floor, P.earth, xx + 1, y + 1, 2, h - 1);
    }
    rect(floor, P.earth, x, y + h - 2, w, 2);
    rect(floor, P.earth, 230, 199, 20, 9);
    rect(floor, P.ochre, 231, 201, 18, 2);
    rect(floor, P.ink, 232, 204, 16, 4);
    rect(floor, P.umber, 197, 132, 74, 43);
    rect(floor, P.rust, 198, 133, 72, 41);
    rect(floor, P.sand, 201, 136, 66, 35);
    rect(floor, P.duskViolet, 202, 137, 64, 33);
    for (let i = 0; i < 11; i++) {
      const xx = 204 + i * 6;
      rect(floor, P.mauve, xx, 142 + (i % 2), 3, 2);
      rect(floor, P.mauve, xx, 163 - (i % 2), 3, 2);
    }
    for (let i = 0; i < 6; i++)
      rect(floor, P.gold, 233 - i, 148 + i, 3 + i * 2, 1);
    for (let i = 0; i < 5; i++)
      rect(floor, P.gold, 228 + i, 154 + i, 13 - i * 2, 1);

    const objects = CABIN_FURNITURE.map((f) => {
      const g = scene.add.graphics().setDepth(f.y + f.h);
      rect(g, P.earth, f.x + 2, f.y + 4, f.w + 2, f.h - 2);
      rect(g, P.ink, f.x, f.y - 5, f.w, f.h + 4);
      rect(g, P.umber, f.x + 1, f.y - 4, f.w - 2, f.h + 2);
      return g;
    });
    const [bed, table, locker, desk, chair, stove, shelf, fridge] = objects;
    if (bed && table && locker && desk && chair && stove && shelf && fridge) {
      // Refrigerador de esmalte crema visto de frente: congelador arriba,
      // puerta principal con manija cromada, placa dorada y luz de encendido.
      rect(fridge, P.cream, 327, 110, 20, 32);
      rect(fridge, P.white, 327, 110, 3, 32);
      rect(fridge, P.sand, 343, 110, 4, 32);
      rect(fridge, P.khaki, 346, 111, 1, 31);
      rect(fridge, P.ink, 327, 110, 1, 1);
      rect(fridge, P.ink, 346, 110, 1, 1);
      rect(fridge, P.white, 329, 110, 15, 1);
      rect(fridge, P.ink, 327, 119, 20, 1);
      rect(fridge, P.white, 327, 120, 20, 1);
      rect(fridge, P.ink, 340, 112, 3, 6);
      rect(fridge, P.silver, 341, 113, 1, 4);
      rect(fridge, P.ink, 340, 122, 3, 11);
      rect(fridge, P.silver, 341, 123, 1, 9);
      rect(fridge, P.ink, 330, 125, 6, 3);
      rect(fridge, P.gold, 331, 126, 4, 1);
      rect(fridge, P.mist, 330, 113, 2, 1);
      rect(fridge, P.ink, 329, 142, 3, 2);
      rect(fridge, P.ink, 342, 142, 3, 2);
      rect(bed, P.clay, 145, 95, 23, 7);
      rect(bed, P.ochre, 146, 96, 20, 1);
      rect(bed, P.sand, 147, 103, 19, 32);
      rect(bed, P.cream, 149, 104, 15, 7);
      rect(bed, P.plum, 147, 113, 19, 22);
      rect(bed, P.duskViolet, 148, 113, 17, 18);
      rect(bed, P.mauve, 149, 113, 15, 2);
      rect(bed, P.gold, 148, 129, 17, 1);
      rect(bed, P.clay, 146, 135, 21, 3);
      rect(table, P.ochre, 172, 95, 14, 8);
      rect(table, P.clay, 173, 104, 12, 5);
      rect(table, P.gold, 179, 105, 2, 1);
      rect(locker, P.stone, 294, 87, 28, 18);
      rect(locker, P.steel, 295, 88, 26, 4);
      for (const xx of [296, 309]) {
        rect(locker, P.slate, xx, 93, 11, 11);
        rect(locker, P.silver, xx + 2, 94, 6, 1);
        rect(locker, P.steel, xx + 8, 99, 1, 3);
      }
      rect(desk, P.clay, 272, 135, 35, 20);
      rect(desk, P.ochre, 273, 135, 33, 3);
      rect(desk, P.earth, 273, 155, 33, 3);
      rect(desk, P.sand, 279, 140, 13, 8);
      rect(desk, P.rust, 281, 143, 7, 1);
      rect(desk, P.slate, 298, 138, 5, 6);
      rect(desk, P.silver, 299, 138, 3, 1);
      rect(chair, P.ochre, 310, 143, 11, 3);
      rect(chair, P.clay, 311, 147, 9, 8);
      rect(stove, P.slate, 145, 169, 15, 17);
      rect(stove, P.steel, 147, 170, 11, 4);
      rect(stove, P.ink, 148, 177, 9, 6);
      rect(stove, P.ember, 150, 179, 6, 3);
      rect(stove, P.orange, 151, 180, 4, 1);
      rect(shelf, P.clay, 200, 94, 34, 4);
      for (const [xx, color] of [
        [203, P.pine],
        [207, P.duskViolet],
        [211, P.rust],
        [226, P.steel],
      ] as const)
        rect(shelf, color, xx, 87, 3, 7);
      rect(shelf, P.silver, 216, 90, 7, 3);
      rect(shelf, P.ink, 217, 91, 5, 1);
    }
    const trim = scene.add.graphics().setDepth(84);
    // Casco y pico del abuelo apoyados contra el muro.
    rect(trim, P.earth, 316, 76, 9, 5);
    rect(trim, P.ink, 317, 72, 7, 5);
    rect(trim, P.gold, 318, 72, 5, 3);
    rect(trim, P.cream, 319, 72, 2, 1);
    rect(trim, P.clay, 287, 71, 2, 10);
    rect(trim, P.steel, 284, 70, 8, 2);
    rect(trim, P.ink, 242, 64, 42, 20);
    rect(trim, P.ochre, 244, 65, 38, 18);
    rect(trim, P.earth, 242, 82, 42, 2);
    rect(trim, P.sand, 330, 69, 8, 10);
    rect(trim, P.rust, 330, 69, 8, 2);
    for (let xx = 331; xx < 337; xx += 2) rect(trim, P.earth, xx, 74, 1, 3);
    this.window = scene.add.graphics().setDepth(85);
    this.lamp = scene.add.graphics().setDepth(112);
    this.board = scene.add.graphics().setDepth(1);
    this.sleeper = scene.add.graphics().setDepth(142);
    const solids = [...CABIN_FURNITURE, { x, y, w, h: 20 }].map((f) =>
      scene.physics.add.staticBody(f.x, f.y, f.w, f.h),
    );
    scene.physics.add.collider(miner, solids);
  }

  ambient(clock: DayNightCycle, now: number): void {
    const flicker = Math.floor(now / 430) % 4;
    const key = clock.phase + flicker;
    if (this.lighting === key) return;
    this.lighting = key;
    const night = !clock.isDay;
    const g = this.window.clear();
    rect(g, night ? P.desertNight : P.sky, 246, 67, 34, 14);
    rect(g, night ? P.cream : P.gold, 270, 68, 4, 4);
    if (night) {
      rect(g, P.mist, 252, 69, 1, 1);
      rect(g, P.silver, 262, 72, 1, 1);
      if (flicker) rect(g, P.mist, 277, 70, 1, 1);
    }
    rect(g, night ? P.indigo : P.desertMountain, 246, 77, 34, 4);
    rect(g, P.umber, 262, 67, 2, 14);
    rect(g, P.clay, 246, 74, 34, 1);
    const lamp = this.lamp.clear();
    rect(lamp, P.umber, 176, 99, 7, 3);
    rect(lamp, P.ochre, 179, 93, 2, 7);
    rect(lamp, P.gold, 175, 89, 9, 6);
    rect(lamp, flicker === 1 ? P.gold : P.cream, 177, 89, 5, 4);
    rect(lamp, P.ember, 150, 179, 6, 3);
    rect(lamp, flicker === 2 ? P.gold : P.orange, 152, 179, 3, 2);
  }

  setBoard(state: 'hidden' | 'loose' | 'open'): void {
    if (state === this.boardState) return;
    this.boardState = state;
    const g = this.board.clear();
    if (state === 'hidden') return;
    const { x, y } = CABIN_BOARD;
    rect(g, P.umber, x - 5, y - 5, 10, 9);
    rect(g, state === 'open' ? P.ink : P.loam, x - 4, y - 4, 8, 7);
    if (state === 'open') rect(g, P.cream, x - 2, y - 3, 4, 5);
    else rect(g, P.ochre, x - 3, y - 3, 6, 1);
  }

  sleepPose(progress: number, now: number, dreaming: boolean): void {
    const g = this.sleeper.clear();
    if (progress <= 0) return;
    const { x, y } = CABIN_BED;
    const yy = y - Math.round(17 * progress);
    rect(g, P.ink, x - 5, yy - 4, 10, 19);
    rect(g, P.blue, x - 4, yy - 3, 8, 7);
    rect(g, P.cream, x - 3, yy + 3, 6, 3);
    rect(g, P.ink, x - 2, yy + 4, 4, 1);
    rect(g, P.duskViolet, x - 6, yy + 7, 12, 8);
    rect(g, P.mauve, x - 5, yy + 7, 10, 1);
    if (dreaming)
      for (let i = 0; i < 2; i++) {
        const xx = x + 8 + i * 5,
          z = yy - 5 - i * 6 - (Math.floor(now / 150) % 4);
        rect(g, P.cream, xx, z, 3, 1);
        rect(g, P.cream, xx + 1, z + 1, 1, 1);
        rect(g, P.cream, xx, z + 2, 3, 1);
      }
  }
}
