import type Phaser from 'phaser';
import { PALETTE as P } from '../../config/palette';
import { buildParts, type Brush, type Part } from './PartsTexture';

type Point = readonly [x: number, y: number];

function copao(
  name: 'copao' | 'copao_joven',
  h: number,
  branches: readonly (readonly [number, number, number, number])[],
): Part {
  return {
    name,
    w: 25,
    h,
    draw(b) {
      for (const [base, tip, top, half] of branches) {
        for (let y = top; y < h; y++) {
          const d = y - top;
          const x = Math.round(tip + (base - tip) * (d / (h - 1 - top)) ** 2);
          const r = half - (d === 0 ? 2 : d === 1 ? 1 : 0);
          b.rect(x - r, y, r * 2 + 1, 1, P.ink);
          if (d === 0) continue;
          b.rect(x - r + 1, y, r * 2 - 1, 1, P.taupe);
          b.px(x - r + 1, y, P.khaki);
          b.px(x, y, P.khaki);
          if (r > 2) b.px(x + r - 1, y, P.pine);
          if (d % 4 === 1) b.px(x - r + 1, y, P.silver);
          if (d % 5 === 2 && r > 2) b.px(x + 2, y, P.khaki);
          if (d % 6 === 2 && d < h - top - 4) b.px(x - r - 1, y - 1, P.khaki);
        }
      }
      if (name === 'copao') {
        b.rect(10, 1, 3, 1, P.cream);
        b.px(11, 0, P.silver);
        b.px(11, 2, P.khaki);
      }
    },
  };
}

/** Un cojín bajo se dibuja de atrás hacia delante, con sus costillas y areolas. */
function cactusHead(
  b: Brush,
  x: number,
  y: number,
  w: number,
  h: number,
  ribbed: boolean,
): void {
  for (let row = 0; row < h; row++) {
    const inset = row === 0 ? 2 : row === 1 || row === h - 1 ? 1 : 0;
    b.rect(x + inset, y + row, w - inset * 2, 1, P.ink);
    if (row === 0 || row === h - 1) continue;
    b.rect(x + inset + 1, y + row, w - inset * 2 - 2, 1, P.taupe);
    b.px(x + w - inset - 2, y + row, P.pine);
    for (let rib = inset + 1; rib < w - inset - 2; rib += 2) {
      if (ribbed || row < 3) b.px(x + rib, y + row, P.khaki);
      if ((row + rib) % 4 === 1) b.px(x + rib, y + row, P.silver);
    }
  }
}

/** Hojas cortas agrupadas por rama, con huecos por donde se ve el suelo. */
function leafCluster(b: Brush, x: number, y: number, w: number): void {
  b.rect(x, y + 1, w, 2, P.taupe);
  b.rect(x + 1, y, w - 2, 1, P.khaki);
  b.rect(x, y + 1, w - 2, 1, P.sand);
  b.px(x + w - 2, y + 2, P.desertRock);
}

function swaying(
  name: SwayingPlant,
  w: number,
  h: number,
  draw: (b: Brush, lean: number) => void,
): Part[] {
  return [0, 1].map((lean) => ({
    name: lean ? `${name}_w` : name,
    w,
    h,
    draw: (b) => draw(b, lean),
  }));
}

const CACHIYUYO: readonly Point[] = [
  [1, 6],
  [3, 3],
  [6, 4],
  [8, 1],
  [11, 3],
  [14, 4],
  [15, 7],
];
const BREA: readonly Point[] = [
  [2, 6],
  [5, 3],
  [8, 5],
  [10, 1],
  [13, 3],
];
const GRAMA: readonly (readonly [base: number, tip: number, height: number])[] =
  [
    [4, 1, 5],
    [6, 4, 2],
    [7, 7, 4],
    [8, 9, 1],
    [9, 12, 3],
    [10, 14, 6],
    [6, 2, 8],
  ];

const SWAYING = ['cachiyuyo', 'brea', 'grama_salada', 'nolana'] as const;
type SwayingPlant = (typeof SWAYING)[number];
export type FloraPart =
  | SwayingPlant
  | 'copao'
  | 'copao_joven'
  | 'copiapoa'
  | 'cojin_atacameno'
  | 'desert_rock_large'
  | 'desert_rock_small'
  | 'boulder'
  | 'pebble_gray';

export const swaysInBreeze = (name: FloraPart): name is SwayingPlant =>
  SWAYING.some((plant) => plant === name);

const PARTS: Part[] = [
  // Eulychnia iquiquensis. Brazos que nacen cerca del suelo y areolas blancas.
  copao('copao', 34, [
    [11, 4, 12, 3],
    [13, 20, 8, 3],
    [12, 11, 1, 4],
  ]),
  copao('copao_joven', 22, [
    [13, 17, 7, 3],
    [12, 9, 1, 3],
  ]),
  // Copiapoa rupestris. Costillas marcadas y cabezas reunidas entre las rocas.
  {
    name: 'copiapoa',
    w: 21,
    h: 13,
    draw(b) {
      cactusHead(b, 5, 1, 10, 12, true);
      cactusHead(b, 13, 5, 8, 8, true);
      cactusHead(b, 0, 6, 9, 7, true);
      b.px(10, 1, P.silver);
    },
  },
  // Maihueniopsis atacamensis. Artejos ovoides y flor pequeña en el cojín.
  {
    name: 'cojin_atacameno',
    w: 17,
    h: 9,
    draw(b) {
      cactusHead(b, 2, 3, 7, 6, false);
      cactusHead(b, 7, 2, 6, 7, false);
      cactusHead(b, 11, 4, 6, 5, false);
      cactusHead(b, 5, 5, 6, 4, false);
      b.px(8, 1, P.khaki);
      b.px(9, 1, P.ochre);
    },
  },
  // Atriplex atacamensis. Copa de hojas cenicientas con ramas abiertas.
  ...swaying('cachiyuyo', 21, 13, (b, lean) => {
    for (const [x, y] of CACHIYUYO) {
      const tip = x + (y < 6 ? lean : 0);
      b.line(10, 12, tip + 1, y + 2, P.desertRock);
      leafCluster(b, tip, y, y < 6 ? 4 : 5);
    }
    leafCluster(b, 3, 8, 5);
    leafCluster(b, 12, 9, 5);
    b.rect(9, 11, 3, 2, P.earth);
  }),
  // Tessaria absinthioides. Tallos erectos, hojas angostas y ápices rosados.
  ...swaying('brea', 19, 16, (b, lean) => {
    for (const [x, y] of BREA) {
      const tip = x + lean;
      const root = 7 + (x % 4);
      b.line(root, 15, tip, y + 2, P.taupe);
      b.line(root, 13, tip, y + 3, P.khaki);
      b.rect(tip - 2, y + 4, 4, 1, P.sand);
      b.rect(tip, y + 6, 3, 1, P.khaki);
      b.rect(tip - 1, y + 1, 3, 2, P.mauve);
      b.px(tip - 1, y + 1, P.dawnPink);
    }
    b.rect(6, 14, 6, 2, P.taupe);
  }),
  // Distichlis spicata. Hojas rígidas, estolón a ras de suelo y espigas cortas.
  ...swaying('grama_salada', 17, 11, (b, lean) => {
    b.line(3, 10, 13, 10, P.desertRock);
    for (const [base, x, y] of GRAMA) {
      const tip = x + (y < 5 ? lean : 0);
      const elbow = Math.round((base + tip) / 2);
      b.line(base, 10, elbow, 6 + Math.floor(y / 3), P.khaki);
      b.line(elbow, 6 + Math.floor(y / 3), tip, y, P.desertSand);
      if (y < 4) {
        b.rect(tip, y, 1, 2, P.cream);
        b.px(tip - 1, y + 1, P.sand);
      }
    }
  }),
  // Nolana diffusa. Mata costera baja con corolas azuladas y garganta clara.
  ...swaying('nolana', 19, 12, (b, lean) => {
    for (const [x, y] of [
      [2, 6],
      [8, 2],
      [14, 5],
    ] as const) {
      const tip = x + lean;
      b.line(9, 11, tip, y + 2, P.taupe);
      b.rect(tip, y + 3, 4, 2, P.khaki);
      b.px(tip + 2, y + 3, P.sand);
      b.rect(tip - 1, y, 3, 2, P.violet);
      b.px(tip, y - 1, P.mist);
      b.px(tip - 1, y, P.mist);
      b.px(tip, y + 1, P.cream);
    }
    b.rect(5, 10, 9, 2, P.taupe);
  }),
  ...[false, true].map((large): Part => ({
    name: large ? 'desert_rock_large' : 'desert_rock_small',
    w: large ? 15 : 9,
    h: large ? 10 : 6,
    draw(b) {
      const w = large ? 15 : 9,
        h = large ? 10 : 6;
      b.rect(2, 0, w - 4, h, P.ink);
      b.rect(0, 2, w, h - 2, P.ink);
      b.rect(2, 1, w - 4, h - 2, P.desertRock);
      b.rect(1, 2, w - 2, h - 3, P.desertRock);
      b.rect(2, 1, w - 5, 1, P.desertSand);
      b.rect(1, 2, 1, h - 4, P.desertSoil);
      b.rect(w - 4, 3, 2, h - 4, P.umber);
      b.px(4, h - 3, P.desertMountain);
    },
  })),
  {
    name: 'boulder',
    w: 17,
    h: 12,
    draw(b) {
      b.rect(3, 1, 11, 1, P.ink);
      b.rect(1, 3, 15, 8, P.ink);
      b.rect(2, 2, 13, 9, P.taupe);
      b.rect(2, 2, 13, 1, P.khaki);
      b.rect(2, 2, 2, 9, P.khaki);
      b.rect(13, 4, 2, 7, P.desertRock);
      b.line(5, 4, 11, 7, P.desertRock);
      b.rect(3, 11, 11, 1, P.umber);
    },
  },
  {
    name: 'pebble_gray',
    w: 7,
    h: 5,
    draw(b) {
      b.rect(1, 1, 5, 3, P.ink);
      b.rect(1, 1, 5, 1, P.steel);
      b.rect(1, 1, 2, 3, P.stone);
      b.rect(4, 1, 2, 2, P.slate);
    },
  },
];

export function createFloraParts(scene: Phaser.Scene): void {
  buildParts(scene, 'flora', PARTS);
}
