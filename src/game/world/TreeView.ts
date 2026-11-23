import type Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { buildParts, type Brush, type Part } from './structures/PartsTexture';
import { TREE_COLUMNS, treeGround, type TreeState } from './Trees';

/** Medidas del sprite del árbol (px); se apoya por el centro de su base. */
export const TREE_SPRITE = { w: 32, h: 48 } as const;
export const standingTreeFrame = (index: number) =>
  index % 2 === 0 ? 'tree' : 'tree_spread';

type StandingTreeFrame = ReturnType<typeof standingTreeFrame>;

const CROWNS = [
  [
    [7, 13, 8],
    [14, 8, 9],
    [20, 11, 8],
    [2, 17, 10],
    [6, 19, 8],
    [19, 16, 10],
    [24, 18, 7],
    [14, 13, 7],
  ],
  [
    [5, 13, 9],
    [12, 11, 9],
    [19, 13, 9],
    [1, 18, 10],
    [5, 21, 9],
    [19, 18, 12],
    [24, 21, 7],
    [12, 16, 8],
  ],
] as const;

/** Grupos de hojuelas tupidos en el centro y abiertos en las puntas. */
function foliage(b: Brush, x: number, y: number, w: number): void {
  b.rect(x + 2, y, w - 4, 1, P.khaki);
  b.rect(x + 1, y + 1, w - 2, 2, P.taupe);
  b.rect(x, y + 2, w, 1, P.taupe);
  b.rect(x + 1, y + 1, w - 4, 1, P.desertSand);
  b.rect(x + 1, y + 3, w - 3, 1, P.desertRock);
  b.rect(x + 3, y + 4, w - 5, 1, P.desertRock);
  b.px(x + Math.floor(w / 2), y + 2, P.khaki);
}

/** Algarrobo blanco del norte, de copa abierta y corteza acanalada. */
const PARTS: Part[] = [
  ...CROWNS.map((crown, i): Part => ({
    name: standingTreeFrame(i),
    w: TREE_SPRITE.w,
    h: TREE_SPRITE.h,
    draw(b) {
      // Fuste retorcido y horquillas expuestas. Vetas en la cara iluminada.
      b.line(15, 46, 16, 34, P.ink);
      b.line(19, 46, 19, 35, P.ink);
      b.rect(15, 36, 4, 11, P.earth);
      b.line(16, 44, 17, 35, P.desertSand);
      b.line(18, 44, 18, 35, P.desertRock);
      b.line(17, 36, 13, 24, P.earth);
      b.line(16, 35, 12, 24, P.desertRock);
      b.line(16, 32, 10, 25, P.desertSand);
      b.line(18, 36, 19, 27, P.earth);
      b.line(19, 29, 25, 23, P.earth);
      b.line(19, 30, 24, 24, P.desertRock);
      b.line(17, 33, 22, 25, P.desertSand);
      b.line(12, 26, 6, 19, P.earth);
      b.line(11, 25, 6, 22, P.desertSand);
      b.line(13, 25, 13, 14, P.desertRock);
      b.line(13, 20, 10, 13, P.desertSand);
      b.line(14, 22, 17, 13, P.earth);
      b.line(22, 26, 22, 17, P.desertRock);
      b.line(25, 24, 28, 19, P.desertRock);
      b.line(15, 44, 10, 47, P.ink);
      b.line(13, 46, 16, 46, P.desertSand);
      b.line(18, 44, 23, 47, P.ink);
      b.rect(14, 47, 8, 1, P.earth);

      // Foliolos secos alrededor de ramas visibles y vainas dispersas.
      for (const [x, y, w] of crown) foliage(b, x, y, w);
      for (const [x, y] of [crown[1], crown[3], crown[5], crown[6]]) {
        b.line(x + 3, y + 3, x + 4, y + 6, P.desertSand);
        b.px(x + 4, y + 6, P.khaki);
      }
    },
  })),
  {
    name: 'tree_stump',
    w: 12,
    h: 6,
    draw(b) {
      b.rect(1, 1, 10, 5, P.ink);
      b.rect(2, 1, 8, 4, P.earth);
      b.rect(2, 1, 8, 1, P.sand);
      b.rect(2, 2, 2, 3, P.clay);
      b.rect(9, 2, 1, 3, P.umber);
      b.px(5, 2, P.clay);
      b.px(6, 3, P.clay);
    },
  },
];

export function createTreeParts(scene: Phaser.Scene): void {
  buildParts(scene, 'trees', PARTS);
}

/**
 * Árboles y tocones del mundo. Solo dibuja y anima: qué árboles siguen en
 * pie, los golpes y la madera los decide TreeState (lógica pura y guardada).
 */
export class TreeView {
  private readonly trees = new Map<number, Phaser.GameObjects.Image>();
  private readonly stumps = new Map<number, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    state: TreeState,
  ) {
    createTreeParts(scene);
    for (let i = 0; i < TREE_COLUMNS.length; i++) {
      if (state.standing(i))
        this.trees.set(i, this.plant(i, standingTreeFrame(i), 0));
      else this.stumps.set(i, this.plant(i, 'tree_stump', 1));
    }
  }

  private plant(
    index: number,
    frame: StandingTreeFrame | 'tree_stump',
    lift: number,
  ): Phaser.GameObjects.Image {
    const ground = treeGround(index);
    const image = this.scene.add
      .image(
        ground.column * TILE_SIZE + TILE_SIZE / 2,
        ground.row * TILE_SIZE + lift,
        'trees',
        frame,
      )
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.structures - 3);
    if (frame !== 'tree_stump') image.setFlipX(index % 4 >= 2);
    return image;
  }

  /** Golpe de hacha: el árbol se sacude unos píxeles. */
  shake(index: number): void {
    const image = this.trees.get(index);
    if (!image?.active) return;
    const x = image.x;
    [2, -2, 1, 0].forEach((dx, step) =>
      this.scene.time.delayedCall(40 * (step + 1), () => {
        if (image.active) image.setX(x + dx);
      }),
    );
  }

  /**
   * El árbol cae hacia el lado opuesto al minero y deja un tocón; `done` se
   * llama al terminar la caída (la escena lanza entonces las astillas).
   */
  fall(index: number, away: 1 | -1, done: () => void): void {
    const image = this.trees.get(index);
    this.trees.delete(index);
    if (!image?.active) {
      this.stump(index);
      done();
      return;
    }
    this.scene.tweens.add({
      targets: image,
      angle: away * 84,
      duration: 480,
      ease: 'Quad.easeIn',
      onComplete: () => {
        image.destroy();
        this.stump(index);
        done();
      },
    });
  }

  private stump(index: number): void {
    if (!this.stumps.has(index))
      this.stumps.set(index, this.plant(index, 'tree_stump', 1));
  }

  /** El suelo se excavó: el árbol y su tocón desaparecen sin animación. */
  remove(index: number): void {
    this.trees.get(index)?.destroy();
    this.trees.delete(index);
    this.stumps.get(index)?.destroy();
    this.stumps.delete(index);
  }

  /** Índice del árbol (en pie o tocón) cuyo suelo es la celda, o -1. */
  groundAt(column: number, row: number): number {
    const i = TREE_COLUMNS.indexOf(column);
    return i >= 0 && treeGround(i).row === row ? i : -1;
  }
}
