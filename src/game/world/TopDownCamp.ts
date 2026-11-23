import Phaser from 'phaser';
import { PALETTE as P } from '../config/palette';
import { smallText } from '../ui/PixelFont';

import { CAMP_MAP } from '../config/topDownCamp';
import { createFloraParts, type FloraPart } from './structures/Flora';
import { createTreeParts, standingTreeFrame } from './TreeView';

type Graphics = Phaser.GameObjects.Graphics;
type Point = readonly [number, number];
const rect = (
  g: Graphics,
  c: number,
  x: number,
  y: number,
  w: number,
  h: number,
) => g.fillStyle(c).fillRect(x, y, w, h);

// Polígonos escalonados con bordes enteros también al hornear el suelo.
function pixels(g: Graphics, c: number, outline: readonly Point[]): void {
  g.fillStyle(c);
  const first = Math.min(...outline.map(([, y]) => y));
  const last = Math.max(...outline.map(([, y]) => y));
  for (let y = first; y < last; y++) {
    const cuts: number[] = [];
    for (let i = 0; i < outline.length; i++) {
      const [ax, ay] = outline[i]!;
      const [bx, by] = outline[(i + 1) % outline.length]!;
      if (y >= Math.min(ay, by) && y < Math.max(ay, by))
        cuts.push(Math.round(ax + ((y + 0.5 - ay) * (bx - ax)) / (by - ay)));
    }
    cuts.sort((a, b) => a - b);
    for (let i = 0; i + 1 < cuts.length; i += 2)
      g.fillRect(cuts[i]!, y, cuts[i + 1]! - cuts[i]!, 1);
  }
}

const routes: readonly (readonly Point[])[] = [
  [
    [0, 354],
    [194, 342],
    [316, 306],
    [452, 310],
    [572, 334],
    [742, 337],
    [960, 381],
  ],
  [
    [306, 305],
    [302, 272],
  ],
  [
    [551, 331],
    [552, 285],
  ],
  [
    [653, 334],
    [672, 285],
  ],
  [
    [452, 310],
    [418, 392],
    [472, 477],
    [456, 640],
  ],
  [
    [170, 348],
    [135, 263],
    [145, 170],
    [102, 0],
  ],
];

function ground(scene: Phaser.Scene): void {
  const key = 'top-down-atacama-ground';
  if (!scene.textures.exists(key)) {
    const { width, height } = CAMP_MAP;
    const g = scene.add.graphics();
    rect(g, P.desertSand, 0, 0, width, height);
    const random = new Phaser.Math.RandomDataGenerator(['atacama-camp']);
    for (let i = 0; i < 110; i++) {
      const x = random.between(0, width),
        y = random.between(0, height);
      const w = random.between(12, 55),
        h = random.between(4, 17);
      pixels(g, i % 3 === 0 ? P.sand : P.desertSoil, [
        [x, y],
        [x + w, y - 3],
        [x + w + 9, (y + h / 2) | 0],
        [x + w - 12, y + h],
        [x - 7, y + h - 2],
      ]);
    }
    // Rodadas, arcenes irregulares y empalmes de los accesos.
    for (const [size, color] of [
      [20, P.loam],
      [16, P.desertSoil],
      [10, P.sand],
    ] as const) {
      for (const route of routes) {
        for (let i = 1; i < route.length; i++) {
          const [ax, ay] = route[i - 1]!,
            [bx, by] = route[i]!;
          const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
          for (let j = 0; j <= n; j++) {
            const x = Math.round(ax + ((bx - ax) * j) / n);
            const y = Math.round(ay + ((by - ay) * j) / n);
            const edge = ((x * 7 + y * 3) % 5) - 2;
            rect(g, color, x - size, y - size + edge, size * 2, size * 2);
          }
        }
      }
    }
    for (let i = 0; i < 1550; i++) {
      const x = random.between(0, width - 5),
        y = random.between(0, height - 3);
      const color = i % 4 === 0 ? P.khaki : i % 2 === 0 ? P.sand : P.desertSoil;
      rect(g, color, x, y, random.between(1, 4), 1);
      if (i % 8 === 0) rect(g, P.loam, x + 1, y + 1, 2, 1);
    }
    // Clastos incrustados: grupos pequeños con una cara clara y una sombra
    // desplazada. La frecuencia baja deja respirar las rutas y edificios.
    for (let i = 0; i < 125; i++) {
      const x = random.between(8, width - 9);
      const y = random.between(8, height - 7);
      const large = i % 5 === 0;
      const w = large ? 7 : 4;
      rect(g, P.loam, x + 1, y + 2, w + 2, 2);
      rect(g, P.desertRock, x, y, w, 3);
      rect(g, P.khaki, x + 1, y, w - 2, 1);
      rect(g, P.taupe, x + 1, y + 1, w - 1, 1);
      if (large) {
        rect(g, P.desertSoil, x - 3, y + 4, 3, 1);
        rect(g, P.sand, x + w + 2, y + 3, 2, 1);
      }
    }
    // Dos rodadas discontinuas siguen la ruta principal. Su ritmo irregular
    // evita que el camino parezca una cinta lisa o una cuadrícula de tiles.
    const road = routes[0]!;
    for (let i = 1; i < road.length; i++) {
      const [ax, ay] = road[i - 1]!;
      const [bx, by] = road[i]!;
      const length = Math.hypot(bx - ax, by - ay);
      const nx = -(by - ay) / length;
      const ny = (bx - ax) / length;
      for (let d = 4; d < length; d += 11) {
        const p = d / length;
        const cx = ax + (bx - ax) * p;
        const cy = ay + (by - ay) * p;
        for (const side of [-1, 1]) {
          const x = Math.round(cx + nx * side * 7);
          const y = Math.round(cy + ny * side * 7);
          rect(g, P.desertSoil, x, y, 4, 1);
          rect(g, P.sand, x + 1, y + 1, 2, 1);
        }
      }
    }
    g.generateTexture(key, width, height).destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  scene.add.image(0, 0, key).setOrigin(0).setDepth(-10);
}

function crate(g: Graphics, x: number, y: number): void {
  rect(g, P.umber, x, y, 15, 13);
  rect(g, P.ochre, x + 1, y + 1, 13, 4);
  rect(g, P.clay, x + 1, y + 6, 13, 6);
  rect(g, P.earth, x + 3, y + 6, 2, 6);
  rect(g, P.earth, x + 10, y + 6, 2, 6);
  rect(g, P.sand, x + 2, y + 2, 10, 1);
}

function barrel(g: Graphics, x: number, y: number): void {
  rect(g, P.umber, x, y + 2, 10, 13);
  rect(g, P.clay, x + 1, y + 3, 8, 11);
  rect(g, P.ochre, x + 2, y, 6, 4);
  for (const band of [6, 11]) rect(g, P.slate, x, y + band, 10, 2);
}

function windowFrame(g: Graphics, x: number, y: number): void {
  rect(g, P.umber, x, y, 15, 13);
  rect(g, P.amber, x + 2, y + 2, 11, 9);
  rect(g, P.cream, x + 3, y + 3, 9, 5);
  rect(g, P.clay, x + 7, y + 2, 1, 9);
  rect(g, P.earth, x + 1, y + 7, 13, 1);
}

function building(
  scene: Phaser.Scene,
  x: number,
  y: number,
  kind: 'cabin' | 'warehouse',
): void {
  const cabin = kind === 'cabin';
  const w = 96;
  const g = scene.add.graphics({ x, y }).setDepth(y);
  g.setName(kind);
  rect(g, P.loam, 6, -20, w + 9, 24);
  rect(g, P.umber, 0, -38, w, 37);
  rect(g, cabin ? P.clay : P.taupe, 2, -36, w - 5, 32);
  rect(g, P.earth, w - 11, -35, 9, 32);
  for (let yy = -32; yy < -4; yy += 5) {
    rect(g, P.earth, 2, yy, w - 4, 1);
    rect(g, cabin ? P.loam : P.khaki, 4 + (-yy % 9), yy + 1, 24, 1);
  }
  for (const xx of [3, w - 12]) {
    rect(g, P.umber, xx, -33, 4, 30);
    rect(g, P.ochre, xx + 1, -31, 1, 26);
  }
  const mid = w / 2;
  rect(g, P.ink, mid - 10, -27, 20, 24);
  rect(g, P.earth, mid - 8, -25, 16, 21);
  for (let i = -6; i < 8; i += 4) rect(g, P.clay, mid + i, -24, 2, 19);
  rect(g, P.gold, mid + 4, -13, 2, 2);
  rect(g, P.earth, mid - 13, -4, 26, 8);
  rect(g, P.ochre, mid - 12, -3, 24, 2);
  rect(g, P.clay, mid - 12, 0, 24, 2);
  windowFrame(g, 13, -24);
  windowFrame(g, w - 34, -24);

  const roof = cabin
    ? [P.plum, P.duskViolet, P.mauve]
    : [P.slate, P.stone, P.steel];
  pixels(g, P.ink, [
    [-6, -33],
    [7, -58],
    [19, -67],
    [w - 15, -67],
    [w + 5, -43],
    [w + 5, -31],
    [-6, -31],
  ]);
  pixels(g, roof[0]!, [
    [-4, -34],
    [11, -58],
    [20, -65],
    [w - 16, -65],
    [w + 3, -43],
    [w + 3, -33],
  ]);
  pixels(g, roof[1]!, [
    [-3, -36],
    [10, -58],
    [w - 18, -58],
    [w - 5, -36],
  ]);
  pixels(g, roof[2]!, [
    [10, -58],
    [20, -65],
    [w - 16, -65],
    [w - 18, -58],
  ]);
  for (let row = 0; row < 4; row++) {
    const yy = -57 + row * 6;
    for (let xx = 10 + (row % 2) * 5; xx < w - 20; xx += 10) {
      rect(g, roof[0]!, xx, yy + 3, 8, 1);
      rect(g, roof[2]!, xx + 1, yy, 5, 1);
    }
  }
  // Remates de cumbrera y alero: separan el volumen del techo de la fachada.
  rect(g, roof[2]!, 20, -65, w - 36, 1);
  rect(g, P.umber, -5, -33, w + 10, 2);
  for (let xx = 2; xx < w; xx += 12) {
    rect(g, P.ink, xx, -32, 2, 1);
    rect(g, roof[2]!, xx + 1, -33, 1, 1);
  }
  rect(g, cabin ? P.duskViolet : P.earth, -6, -34, w + 11, 2);
  if (cabin) {
    rect(g, P.ink, mid + 13, -21, 6, 9);
    rect(g, P.amber, mid + 14, -19, 4, 5);
    rect(g, P.cream, mid + 15, -18, 2, 3);
    rect(g, P.umber, 64, -76, 13, 28);
    rect(g, P.rust, 65, -72, 10, 23);
    for (let yy = -69; yy < -48; yy += 5) {
      rect(g, P.earth, 65, yy, 10, 1);
      rect(g, P.clay, yy % 2 ? 69 : 72, yy + 1, 1, 3);
    }
    rect(g, P.khaki, 63, -77, 15, 4);
    rect(g, P.ink, 66, -76, 9, 2);
  } else {
    rect(g, P.earth, 72, -18, 2, 14);
    rect(g, P.steel, 68, -19, 10, 3);
    rect(g, P.slate, 76, -18, 3, 4);
    const counter = scene.add.graphics({ x, y }).setDepth(y + 0.5);
    rect(counter, P.umber, 56, -10, 18, 7);
    rect(counter, P.ochre, 56, -10, 18, 2);
  }
  rect(g, P.umber, mid - 17, -34, 34, 9);
  smallText(
    scene,
    x + mid,
    y - 32,
    cabin ? 'CABAÑA' : 'BODEGA',
    P.cream,
  )
    .setOrigin(0.5, 0)
    .setDepth(y + 0.25);
}

function portal(scene: Phaser.Scene): void {
  const g = scene.add
    .graphics({ x: 624, y: 288 })
    .setDepth(288)
    .setName('mine');
  pixels(g, P.desertRock, [
    [0, 0],
    [0, -23],
    [11, -47],
    [27, -65],
    [66, -64],
    [87, -50],
    [96, -23],
    [96, 0],
  ]);
  pixels(g, P.desertMountain, [
    [1, -23],
    [12, -47],
    [28, -64],
    [62, -63],
    [84, -49],
    [86, -36],
    [65, -40],
    [46, -49],
    [28, -41],
    [15, -26],
  ]);
  pixels(g, P.khaki, [
    [12, -46],
    [26, -60],
    [41, -62],
    [31, -55],
    [25, -47],
    [13, -37],
  ]);
  pixels(g, P.earth, [
    [0, -17],
    [18, -22],
    [24, -10],
    [21, 0],
    [0, 0],
  ]);
  pixels(g, P.earth, [
    [76, -27],
    [96, -22],
    [96, 0],
    [69, 0],
    [76, -11],
  ]);
  for (const [x, y, w] of [
    [12, -26, 16],
    [60, -48, 15],
    [71, -31, 12],
    [6, -9, 11],
    [81, -13, 10],
  ]) {
    rect(g, P.earth, x!, y!, w!, 2);
    rect(g, P.desertSoil, x! + 2, y! - 2, w! - 3, 2);
  }
  rect(g, P.ink, 24, -33, 48, 33);
  rect(g, P.night, 33, -29, 30, 29);
  for (const x of [25, 65]) {
    rect(g, P.umber, x, -34, 7, 34);
    rect(g, P.ochre, x + 1, -33, 3, 31);
    rect(g, P.gold, x - 5, -16, 4, 5);
    rect(g, P.cream, x - 4, -15, 2, 3);
  }
  rect(g, P.umber, 22, -38, 52, 9);
  rect(g, P.ochre, 23, -37, 50, 2);
  for (let y = 279; y < 327; y += 6) {
    const target =
      y < 288 ? g : (scene.children.getByName('rail-yard') as Graphics);
    const dx = y < 288 ? 624 : 0,
      dy = y < 288 ? 288 : 0;
    rect(target, P.earth, 658 - dx, y - dy, 28, 3);
    for (const x of [663, 679]) rect(target, P.steel, x - dx, y - dy, 2, 6);
  }
  smallText(scene, 672, 253, 'MINA', P.cream)
    .setOrigin(0.5, 0)
    .setDepth(288.25);
}

export function buildCamp(
  scene: Phaser.Scene,
  miner: Phaser.Physics.Arcade.Sprite,
): void {
  ground(scene);
  // Sombras duras en la tierra, separadas de la fachada y bajo los actores.
  const shadows = scene.add.graphics().setDepth(-5);
  for (const [x, y, w] of [
    [256, 272, 96],
    [512, 288, 96],
    [624, 288, 96],
  ] as const) {
    pixels(shadows, P.loam, [
      [x + 5, y - 2],
      [x + w, y - 2],
      [x + w + 17, y + 11],
      [x + 20, y + 11],
    ]);
    rect(shadows, P.earth, x + 9, y + 1, w - 4, 1);
  }
  const solid = (x: number, y: number, w: number, h: number) =>
    scene.physics.add.collider(miner, scene.physics.add.staticBody(x, y, w, h));
  scene.add.graphics().setName('rail-yard').setDepth(-4);
  building(scene, 256, 272, 'cabin');
  building(scene, 512, 288, 'warehouse');
  portal(scene);
  solid(256, 224, 96, 48);
  solid(512, 240, 96, 48);
  solid(624, 240, 96, 48);

  for (const [x, y] of [
    [265, 278],
    [493, 282],
    [587, 299],
    [602, 300],
    [707, 293],
  ] as const) {
    const g = scene.add.graphics().setDepth(y);
    crate(g, x, y - 13);
    barrel(g, x - 11, y - 15);
    solid(x - 10, y - 7, 24, 7);
  }
  createFloraParts(scene);
  createTreeParts(scene);
  const random = new Phaser.Math.RandomDataGenerator(['flora-deepkin']);
  const low = scene.add.graphics().setDepth(-2);
  const plant = (x: number, y: number, frame: FloraPart) => {
    const image = scene.add.image(x, y, 'flora', frame).setOrigin(0, 1).setDepth(y);
    return image.setX(x - Math.floor(image.width / 2));
  };
  plant(249, 274, 'cachiyuyo');
  plant(350, 278, 'brea');

  for (const [x, y, flip] of [
    [245, 314, false],
    [370, 204, true],
    [501, 244, false],
    [360, 385, true],
    [711, 375, false],
    [165, 438, true],
    [807, 230, false],
  ] as const) {
    pixels(low, P.loam, [
      [x - 8, y - 4],
      [x + 9, y - 7],
      [x + 15, y - 1],
      [x + 12, y + 4],
      [x - 4, y + 3],
    ]);
    scene.add.image(x, y, 'trees', standingTreeFrame(Number(flip)))
      .setOrigin(0.5, 1).setDepth(y).setFlipX(flip);
    solid(x - 4, y - 6, 8, 6);
  }
  const shrubs: readonly FloraPart[] = ['cachiyuyo', 'grama_salada', 'brea', 'grama_salada'];
  for (let i = 0; i < 235; i++) {
    const x = random.between(12, 942),
      y = random.between(16, 622);
    const center = x > 214 && x < 750 && y > 158 && y < 379;
    if (center || Math.abs(y - 350) < 29 || (x > 389 && x < 505 && y > 368))
      continue;
    const shadow = i % 4 ? 8 : 15;
    rect(low, P.loam, x - 3, y - 1, shadow, 3);
    if (i % 7 === 0) {
      plant(x, y, 'cojin_atacameno').setFlipX(i % 2 === 0);
      solid(x - 4, y - 6, 8, 6);
    } else if (i % 4 === 0) {
      const rock = scene.add.graphics({ x, y }).setDepth(y);
      pixels(rock, P.desertRock, [
        [-10, 0],
        [-10, -8],
        [-5, -15],
        [6, -17],
        [15, -10],
        [16, -3],
        [12, 0],
      ]);
      pixels(rock, P.taupe, [
        [-9, -8],
        [-4, -14],
        [6, -16],
        [12, -10],
        [4, -7],
        [-4, -6],
      ]);
      pixels(rock, P.khaki, [
        [-8, -9],
        [-3, -14],
        [6, -15],
        [1, -11],
        [-5, -9],
      ]);
      rect(rock, P.earth, 3, -7, 2, 5);
      solid(x - 8, y - 6, 22, 6);
    } else {
      plant(x, y, shrubs[Math.floor(i / 3) % shrubs.length]!).setFlipX(i % 2 === 0);
    }
  }
  // Estacas de un terreno libre junto a la vía principal.
  for (const [x, y] of [
    [524, 382],
    [636, 382],
    [524, 462],
    [636, 462],
  ] as const) {
    rect(low, P.earth, x, y - 7, 3, 8);
    rect(low, P.cream, x, y - 6, 3, 2);
    rect(low, P.loam, x + 3, y, 5, 1);
  }
}
