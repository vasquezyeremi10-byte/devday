import type Phaser from 'phaser';
import { PALETTE as P } from '../config/palette';
import { buildParts, type Brush, type Part } from '../world/structures/PartsTexture';

/**
 * Íconos originales V8 (atlas `v8-items`): alimentos de la bodega (16 × 16
 * para inventario, tienda y barra rápida; versión de mano para la animación
 * de comer) e indicadores del HUD de energía y alimentación (9 × 8, lleno,
 * a medias y vacío). Colores de la paleta, alfa 0/255.
 */
type Grid = readonly string[];

/** Dibuja una cuadrícula de caracteres con un mapa de colores. */
function sprite(b: Brush, grid: Grid, colors: Record<string, number>, ox = 0, oy = 0) {
  grid.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const c = colors[ch];
      if (c !== undefined) b.px(ox + x, oy + y, c);
    }),
  );
}

const BOLT: Grid = [
  '....###.',
  '...#ab#.',
  '..#ab#..',
  '.#aabbb#',
  '.###bb#.',
  '...#b#..',
  '..#b#...',
  '..##....',
];
const DRUMSTICK: Grid = [
  '..####...',
  '.#aabb#..',
  '#abbbbb#.',
  '#bbbbbc#.',
  '.#bbcc#..',
  '..###w#..',
  '....#ww#.',
  '.....##..',
];

/** Ícono del HUD: `fill` 2 lleno, 1 mitad izquierda, 0 vacío. */
function meter(grid: Grid, full: Record<string, number>, fill: 0 | 1 | 2): Part['draw'] {
  return (b) =>
    grid.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        if (ch === '#') return b.px(x, y, P.ink);
        const on = fill === 2 || (fill === 1 && x < 4);
        b.px(x, y, on ? full[ch]! : ch === 'w' ? P.stone : P.slate);
      }),
    );
}

/** Cuadrícula con contorno de tinta automático alrededor de lo pintado. */
function outlined(grid: Grid, colors: Record<string, number>): Part['draw'] {
  const at = (x: number, y: number) =>
    y >= 0 && y < grid.length && x >= 0 && x < grid[y]!.length && grid[y]![x] !== '.';
  return (b) =>
    grid.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch !== '.') b.px(x, y, colors[ch]!);
        else if (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1))
          b.px(x, y, P.ink);
      }),
    );
}
/** Productos del celular: botiquín, completo, suavecilla y terremoto. */
const PHONE_FOOD_COLORS: Record<string, number> = {
  W: P.white,
  S: P.silver,
  l: P.steel,
  R: P.red,
  G: P.mint,
  g: P.teal,
  B: P.sand,
  b: P.loam,
  c: P.clay,
  C: P.cream,
  Y: P.gold,
  y: P.amber,
  K: P.dawnPink,
  M: P.ember,
};
const PHONE_FOODS: [string, Grid, Grid][] = [
  [
    'medkit',
    [
      '................',
      '................',
      '......llll......',
      '.....l....l.....',
      '..WWWWWWWWWWWW..',
      '..WWWWWRRWWWWW..',
      '..WWWWWRRWWWWW..',
      '..WWWRRRRRRWWW..',
      '..WWWRRRRRRWWW..',
      '..WWWWWRRWWWWW..',
      '..WWWWWRRWWWWW..',
      '..SSSSSSSSSSSS..',
      '................',
    ],
    ['.......', '.WWRWW.', '.WRRRW.', '.SSSSS.', '.......'],
  ],
  [
    'completo',
    [
      '................',
      '................',
      '................',
      '................',
      '...C.C.C.C.C....',
      '..GGGGGGGGGGGG..',
      '..RRgRRgRRgRRg..',
      '.cccccccccccccc.',
      '..BBBBBBBBBBBB..',
      '..bbbbbbbbbbbb..',
      '................',
    ],
    ['.......', '.GGGGG.', 'ccccccc', '.BBBBB.', '.......'],
  ],
  [
    'suavecilla',
    [
      '................',
      '......KKK.......',
      '.....KKKKK......',
      '.....KWKKK......',
      '.....KKKKK......',
      '.....KKKKK......',
      '.....CCCCC......',
      '.....CCCCC......',
      '.....CCCCC......',
      '.....CCCCC......',
      '.......B........',
      '.......B........',
      '.......B........',
      '................',
    ],
    ['.....', '.KKK.', '.KWK.', '.CCC.', '.CCC.', '..B..', '.....'],
  ],
  [
    'terremoto',
    [
      '..........R.....',
      '.........R......',
      '......YYYRy.....',
      '.....YYCYYYy....',
      '....SSSSRSSSS...',
      '....SYYYRYYYS...',
      '.....SYYRYYS....',
      '.....SYYYYYS....',
      '......SMMMS.....',
      '......SMMMS.....',
      '.......SSS......',
      '........S.......',
      '........S.......',
      '......SSSSS.....',
      '................',
    ],
    ['.....', '.YCY.', '.SYS.', '.SMS.', '..S..', '.SSS.', '.....'],
  ],
];

const BOLT_COLORS = { a: P.cream, b: P.gold };
const FOOD_COLORS = { a: P.peach, b: P.amber, c: P.ochre, w: P.white };

const PARTS: Part[] = [
  ...(['full', 'half', 'empty'] as const).flatMap((state, i): Part[] => {
    const fill = (2 - i) as 0 | 1 | 2;
    return [
      { name: `bolt_${state}`, w: 9, h: 8, draw: meter(BOLT, BOLT_COLORS, fill) },
      { name: `food_${state}`, w: 9, h: 8, draw: meter(DRUMSTICK, FOOD_COLORS, fill) },
    ];
  }),
  {
    // Lata roja de «cola del desierto» (marca ficticia: ola blanca).
    name: 'cola',
    w: 16,
    h: 16,
    draw(b) {
      b.rect(4, 1, 8, 14, P.ink);
      b.rect(3, 2, 10, 12, P.ink);
      b.rect(4, 2, 8, 2, P.silver);
      b.rect(5, 2, 6, 1, P.white);
      b.px(8, 2, P.steel);
      b.rect(4, 4, 8, 9, P.red);
      b.rect(4, 4, 2, 9, P.peach);
      b.rect(10, 4, 2, 9, P.rust);
      // Ola de la etiqueta.
      b.line(4, 9, 7, 7, P.white);
      b.line(7, 7, 11, 9, P.white);
      b.px(6, 6, P.cream);
      b.rect(4, 13, 8, 1, P.steel);
      b.rect(5, 14, 6, 1, P.silver);
    },
  },
  {
    // Sándwich de potito: marraqueta, carne guisada, cebolla y ají.
    name: 'sandwich',
    w: 16,
    h: 16,
    draw(b) {
      sprite(
        b,
        [
          '................',
          '....########....',
          '..##ssssssss##..',
          '.#ssllssllssss#.',
          '.#ssssssssssss#.',
          '########oo######',
          '#mmrmmmmmmrmmmm#',
          '#gmmmommgmmmorm#',
          '.#mmmmmmmmmmmm#.',
          '.##############.',
          '.#ssssssssssss#.',
          '..#llllllllll#..',
          '...##########...',
        ],
        {
          '#': P.ink,
          s: P.sand,
          l: P.loam,
          m: P.earth,
          r: P.red,
          o: P.cream,
          g: P.mint,
        },
        0,
        2,
      );
      b.px(5, 5, P.cream);
      b.px(6, 5, P.white);
    },
  },
  {
    // Empanada de pino de horno: media luna dorada con repulgue.
    name: 'empanada',
    w: 16,
    h: 16,
    draw(b) {
      sprite(
        b,
        [
          '.....######.....',
          '...##gggggg##...',
          '..#ggccggggaa#..',
          '.#gccggggggaaa#.',
          '.#gggggggggaaa#.',
          '#oaoaoaoaoaoaoa#',
          '################',
        ],
        { '#': P.ink, g: P.gold, c: P.cream, a: P.amber, o: P.ochre },
        0,
        5,
      );
      b.px(6, 7, P.white);
    },
  },
  // Versiones en la mano (animación de comer y beber).
  {
    name: 'cola_hand',
    w: 5,
    h: 7,
    draw(b) {
      b.rect(0, 0, 5, 7, P.ink);
      b.rect(1, 1, 3, 1, P.silver);
      b.rect(1, 2, 3, 4, P.red);
      b.px(1, 3, P.white);
    },
  },
  {
    name: 'sandwich_hand',
    w: 7,
    h: 5,
    draw(b) {
      b.rect(0, 0, 7, 5, P.ink);
      b.rect(1, 1, 5, 1, P.sand);
      b.rect(1, 2, 5, 1, P.earth);
      b.px(2, 2, P.red);
      b.rect(1, 3, 5, 1, P.loam);
    },
  },
  {
    name: 'empanada_hand',
    w: 7,
    h: 5,
    draw(b) {
      b.rect(1, 0, 5, 5, P.ink);
      b.rect(0, 2, 7, 3, P.ink);
      b.rect(2, 1, 3, 2, P.gold);
      b.rect(1, 3, 5, 1, P.ochre);
      b.px(2, 1, P.cream);
    },
  },
  ...PHONE_FOODS.flatMap(([name, icon, hand]): Part[] => [
    { name, w: 16, h: 16, draw: outlined(icon, PHONE_FOOD_COLORS) },
    {
      name: `${name}_hand`,
      w: hand[0]!.length,
      h: hand.length,
      draw: outlined(hand, PHONE_FOOD_COLORS),
    },
  ]),
];

export function createSurvivalArt(scene: Phaser.Scene): void {
  buildParts(scene, 'v8-items', PARTS);
}
