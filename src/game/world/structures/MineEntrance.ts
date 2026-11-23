import Phaser from 'phaser';
import { TILE_SIZE } from '../../config/constants';
import { DEPTH } from '../../config/layers';
import { PALETTE as P } from '../../config/palette';
import { TUNNEL, type Cell } from '../TerrainGrid';
import { buildParts, type Part } from './PartsTexture';

const GX = TUNNEL.fromColumn * TILE_SIZE;
const GY = TUNNEL.topRow * TILE_SIZE;
const G_END = (TUNNEL.toColumn + 1) * TILE_SIZE;
const FLOOR = (TUNNEL.bottomRow + 1) * TILE_SIZE;
const HEIGHT = FLOOR - GY;
/** Postes interiores del entibado (x izquierda). */
const SETS = [GX + 44, GX + 92];
export const RAIL = { from: 204, to: G_END - 14 } as const;

/** Viga de madera con veta, canto iluminado a la izquierda y sombra a la derecha. */
const timber = (
  b: Parameters<Part['draw']>[0],
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  b.rect(x, y, w, h, P.ink);
  b.rect(x + 1, y + 1, w - 2, h - 2, P.clay);
  b.rect(x + 1, y + 1, 1, h - 2, P.ochre);
  b.rect(x + 2, y + 1, 1, h - 2, P.loam);
  b.rect(x + w - 3, y + 1, 1, h - 2, P.soil);
  b.rect(x + w - 2, y + 1, 1, h - 2, P.umber);
  for (let j = y + 4; j < y + h - 3; j += 7)
    b.rect(x + 4, j, 1, 3, (j >> 3) % 2 ? P.soil : P.earth);
};

const PARTS: Part[] = [
  {
    // Poste de la bocamina: madera gruesa con flejes de acero apernados.
    name: 'portal_post',
    w: 11,
    h: HEIGHT + 16,
    draw(b) {
      timber(b, 0, 0, 11, HEIGHT + 16);
      for (const y of [7, 25, 45]) {
        b.rect(0, y, 11, 3, P.ink);
        b.rect(1, y, 9, 1, P.silver);
        b.rect(1, y + 1, 9, 1, P.steel);
        b.px(3, y + 1, P.ink);
        b.px(7, y + 1, P.ink);
      }
      // Zapata de piedra al pie del poste.
      b.rect(0, HEIGHT + 12, 11, 4, P.ink);
      b.rect(1, HEIGHT + 13, 9, 2, P.taupe);
      b.rect(1, HEIGHT + 13, 9, 1, P.khaki);
    },
  },
  {
    // Marco interior más oscuro: da profundidad al socavón.
    name: 'portal_inner',
    w: 7,
    h: HEIGHT + 2,
    draw(b) {
      b.rect(0, 0, 7, HEIGHT + 2, P.ink);
      b.rect(1, 1, 5, HEIGHT, P.earth);
      b.rect(1, 1, 1, HEIGHT, P.soil);
      b.rect(5, 1, 1, HEIGHT, P.umber);
    },
  },
  {
    // Sombrero (dintel) grueso con placas de acero y franja de seguridad.
    name: 'portal_header',
    w: 54,
    h: 13,
    draw(b) {
      const w = 54;
      b.rect(0, 0, w, 13, P.ink);
      b.rect(1, 1, w - 2, 7, P.clay);
      b.rect(1, 1, w - 2, 1, P.ochre);
      b.rect(1, 2, w - 2, 1, P.loam);
      b.rect(1, 7, w - 2, 1, P.soil);
      for (let x = 7; x < w - 4; x += 11) b.rect(x, 4, 5, 1, P.earth);
      // Cabeza de viga con anillos de crecimiento.
      b.rect(1, 1, 5, 7, P.loam);
      b.rect(2, 3, 3, 3, P.ochre);
      b.px(3, 4, P.earth);
      // Placas de acero apernadas.
      for (const x of [12, 36]) {
        b.rect(x, 2, 7, 5, P.ink);
        b.rect(x + 1, 3, 5, 3, P.steel);
        b.rect(x + 1, 3, 5, 1, P.silver);
        b.px(x + 2, 4, P.ink);
        b.px(x + 4, 4, P.ink);
      }
      // Franja de seguridad amarilla y negra.
      for (let x = 1; x < w - 1; x++)
        for (let y = 9; y < 12; y++)
          b.px(x, y, ((x + y) >> 2) % 2 ? P.gold : P.ink);
    },
  },
  {
    // Encamado de troncos que contiene la tierra sobre la bocamina.
    name: 'headwall',
    w: 34,
    h: 10,
    draw(b) {
      for (const y of [0, 5]) {
        b.rect(0, y, 34, 5, P.ink);
        b.rect(1, y + 1, 32, 3, P.clay);
        b.rect(1, y + 1, 32, 1, P.loam);
        b.rect(1, y + 3, 32, 1, P.earth);
        b.rect(1, y + 1, 3, 3, P.sand);
        b.px(2, y + 2, P.ochre);
      }
    },
  },
  {
    // Rocas apiladas junto a la bocamina, con musgo.
    name: 'portal_rocks',
    w: 30,
    h: 22,
    draw(b) {
      const rocks: [number, number, number, number, number, number][] = [
        // x, y, w, h, base, luz
        [0, 12, 12, 10, P.stone, P.steel],
        [9, 6, 13, 16, P.taupe, P.khaki],
        [18, 0, 12, 22, P.plum, P.mauve],
        [4, 3, 9, 10, P.stone, P.steel],
      ];
      for (const [x, y, w, h, base, lit] of rocks) {
        b.rect(x + 1, y, w - 2, h, P.ink);
        b.rect(x, y + 1, w, h - 1, P.ink);
        b.rect(x + 1, y + 1, w - 2, h - 2, base);
        b.rect(x + 1, y + 1, w - 3, 1, lit);
        b.rect(x + 1, y + 1, 1, h - 3, lit);
        b.rect(x + w - 2, y + 2, 1, h - 3, P.slate);
        b.rect(x + 2, y + h - 2, w - 3, 1, P.slate);
      }
      b.rect(5, 3, 4, 1, P.khaki);
      b.rect(19, 0, 5, 1, P.silver);
      b.px(20, 1, P.khaki);
      b.px(12, 6, P.taupe);
      b.rect(0, 21, 30, 1, P.ink);
    },
  },
  ...[0, 1].map((frame): Part => ({
    // Farol colgante de la bocamina, más grande que el de la bodega.
    name: `portal_lantern_${frame}`,
    w: 9,
    h: 14,
    draw(b) {
      b.rect(4, 0, 1, 3, P.ink);
      b.rect(2, 3, 5, 1, P.ink);
      b.rect(1, 4, 7, 9, P.ink);
      b.rect(2, 4, 5, 1, P.steel);
      b.rect(2, 5, 5, 7, frame ? P.amber : P.gold);
      b.rect(3, 6, 3, 5, frame ? P.gold : P.cream);
      b.rect(4, frame ? 7 : 8, 1, 2, P.white);
      b.rect(2, 12, 5, 1, P.steel);
      b.rect(3, 13, 3, 1, P.ink);
    },
  })),
  {
    // Marco interior: poste, sombrero y tornapuntas.
    name: 'set_post',
    w: 7,
    h: HEIGHT - 4,
    draw(b) {
      timber(b, 0, 0, 7, HEIGHT - 4);
    },
  },
  {
    name: 'knee_brace',
    w: 8,
    h: 8,
    draw(b) {
      for (let s = 0; s < 7; s++) {
        b.rect(s, s, 2, 2, P.ink);
        b.px(s, s, P.clay);
      }
    },
  },
  {
    // Tope de vía: dos postes con travesaño de franjas rojas y crema.
    name: 'buffer_stop',
    w: 10,
    h: 12,
    draw(b) {
      b.rect(1, 0, 8, 6, P.ink);
      for (let x = 2; x < 8; x++)
        b.rect(x, 1, 1, 4, (x >> 1) % 2 ? P.cream : P.red);
      b.rect(2, 6, 2, 6, P.ink);
      b.rect(6, 6, 2, 6, P.ink);
      b.rect(2, 6, 1, 6, P.steel);
      b.rect(6, 6, 1, 6, P.steel);
      b.rect(0, 11, 10, 1, P.umber);
    },
  },
  {
    // Señal de peligro: triángulo amarillo con exclamación.
    name: 'sign_hazard',
    w: 9,
    h: 8,
    draw(b) {
      for (let y = 0; y < 8; y++) {
        const half = Math.floor(y / 2);
        b.rect(4 - half, y, half * 2 + 1, 1, P.ink);
        if (y > 0 && y < 7)
          b.rect(5 - half, y, Math.max(0, half * 2 - 1), 1, P.gold);
      }
      b.rect(0, 7, 9, 1, P.ink);
      b.rect(4, 2, 1, 3, P.ink);
      b.px(4, 6, P.ink);
    },
  },
  {
    // Señal obligatoria: casco sobre disco azul.
    name: 'sign_helmet',
    w: 9,
    h: 9,
    draw(b) {
      b.rect(2, 0, 5, 9, P.ink);
      b.rect(0, 2, 9, 5, P.ink);
      b.rect(1, 1, 7, 7, P.ink);
      b.rect(2, 1, 5, 7, P.blue);
      b.rect(1, 2, 7, 5, P.blue);
      b.rect(3, 3, 3, 2, P.white);
      b.rect(2, 5, 5, 1, P.white);
    },
  },
  ...[0, 1].map((frame): Part => ({
    name: `mine_lamp_${frame}`,
    w: 7,
    h: 10,
    draw(b) {
      b.rect(3, 0, 1, 2, P.ink);
      b.rect(1, 2, 5, 1, P.ink);
      b.rect(0, 3, 7, 6, P.ink);
      b.rect(1, 4, 5, 4, frame ? P.amber : P.gold);
      b.rect(2, 5, 3, 2, frame ? P.gold : P.cream);
      b.rect(2, 9, 3, 1, P.ink);
    },
  })),
  {
    // Material suelto junto a la bocamina.
    name: 'rubble_large',
    w: 16,
    h: 7,
    draw(b) {
      const stones: [number, number, number, number][] = [
        [0, 4, 5, 3],
        [4, 2, 6, 5],
        [9, 3, 5, 4],
        [12, 5, 4, 2],
        [6, 0, 4, 3],
      ];
      for (const [x, y, w, h] of stones) {
        b.rect(x, y, w, h, P.ink);
        b.rect(x + 1, y + 1, w - 2, h - 1, P.stone);
        b.rect(x + 1, y + 1, w - 2, 1, P.steel);
      }
      b.px(8, 3, P.clay);
    },
  },
  {
    name: 'rubble_small',
    w: 9,
    h: 4,
    draw(b) {
      for (const [x, y, w] of [
        [0, 1, 4],
        [3, 0, 4],
        [6, 2, 3],
      ] as const) {
        b.rect(x, y, w, 4 - y, P.ink);
        b.rect(x + 1, y + 1, w - 2, 2 - y > 0 ? 3 - y : 1, P.stone);
        b.px(x + 1, y + 1, P.steel);
      }
    },
  },
];

/**
 * Bocamina, galería y vía. Solo decoración: la colisión de la galería sigue
 * saliendo de TerrainGrid. `anchor` liga una pieza a un bloque excavable.
 */
export function createMineEntrance(
  scene: Phaser.Scene,
  anchor: (cell: Cell, item: Phaser.GameObjects.GameObject) => void,
  wideEntrance = false,
): void {
  createMineParts(scene);
  buildMine(scene, anchor, wideEntrance);
}

/** Textura de piezas de la mina (idempotente). */
export function createMineParts(scene: Phaser.Scene): void {
  buildParts(scene, 'mine', PARTS);
  for (const [key, base, rate] of [
    ['mine-lamp', 'mine_lamp', 3],
    ['portal-lantern', 'portal_lantern', 3],
  ] as const)
    if (!scene.anims.exists(key))
      scene.anims.create({
        key,
        frames: [
          { key: 'mine', frame: `${base}_0` },
          { key: 'mine', frame: `${base}_1` },
        ],
        frameRate: rate,
        repeat: -1,
      });
}

function buildMine(
  scene: Phaser.Scene,
  anchor: (cell: Cell, item: Phaser.GameObjects.GameObject) => void,
  wideEntrance: boolean,
): void {
  backWall(scene, wideEntrance);
  const part = (
    name: string,
    x: number,
    y: number,
    depth: number = DEPTH.structures,
  ) => scene.add.image(x, y, 'mine', name).setOrigin(0, 0).setDepth(depth);

  // Las vias funcionales se dibujan desde RailSystem.
  // Encostillado del techo: tablas de madera entre marcos.
  const lag = scene.add.graphics().setDepth(DEPTH.structures);
  lag.fillStyle(P.ink).fillRect(GX, GY, G_END - GX, 5);
  for (let x = GX; x < G_END; x += 6) {
    lag.fillStyle(x % 12 ? P.earth : P.clay).fillRect(x, GY, 5, 4);
    lag.fillStyle(P.umber).fillRect(x, GY + 3, 5, 1);
  }
  // Marcos interiores con tornapuntas y antorchas.
  for (const x of SETS) {
    part('set_post', x, GY + 4);
    part('knee_brace', x + 6, GY + 4);
    part('knee_brace', x - 7, GY + 4).setFlipX(true);
  }
  // Cable de alumbrado con catenaria escalonada.
  const cable = scene.add.graphics().setDepth(DEPTH.structures + 1);
  cable.fillStyle(P.ink);
  const hooks = [GX + 16, ...SETS.map((x) => x + 3), G_END - 8];
  for (let i = 0; i < hooks.length - 1; i++) {
    const a = hooks[i]!;
    const b2 = hooks[i + 1]!;
    for (let x = a; x <= b2; x++) {
      const t = (x - a) / (b2 - a);
      cable.fillRect(x, GY + 5 + Math.round(Math.sin(t * Math.PI) * 3), 1, 1);
    }
  }

  // Bocamina: poste grueso, marco interior, dintel saliente con franja de
  // seguridad y encamado anclado a la ladera, apoyado directamente en el dintel.
  const mouth = scene.add.graphics().setDepth(DEPTH.structures);
  mouth.fillStyle(P.night).fillRect(GX + 2, GY + 3, 34, FLOOR - GY - 3);
  mouth.fillStyle(P.ink).fillRect(GX + 5, GY + 7, 24, FLOOR - GY - 7);
  part('portal_inner', GX + 9, GY - 2, DEPTH.structures + 1);
  part('portal_post', GX - 4, GY - 16, DEPTH.structures + 2);
  part('portal_header', GX - 16, GY - 18, DEPTH.structures + 3);
  const top = { column: TUNNEL.fromColumn, row: TUNNEL.topRow - 1 };
  anchor(top, part('headwall', GX - 8, GY - 27, DEPTH.structures + 2));
  part('sign_hazard', GX - 3, GY + 14, DEPTH.structures + 3);
  part('sign_helmet', GX - 3, GY + 24, DEPTH.structures + 3);
  // Faroles: uno colgado fuera del dintel y otro en el primer marco. Su luz
  // la compone LightingSystem (sin halo de puntos pintado).
  scene.add
    .sprite(LANTERN.x - 4, LANTERN.y - 9, 'mine', 'portal_lantern_0')
    .setOrigin(0, 0)
    .setDepth(DEPTH.structures + 3)
    .play('portal-lantern');
  scene.add
    .sprite(GX + 14, GY + 4, 'mine', 'mine_lamp_0')
    .setOrigin(0, 0)
    .setDepth(DEPTH.structures + 1)
    .play('mine-lamp');
  // Rocas apiladas contra la ladera, a la izquierda del poste.
  part('portal_rocks', GX - 32, FLOOR - 22, DEPTH.structures - 2);
}

/** Centro de la llama del farol exterior (luz decorativa en Scenery). */
export const LANTERN = { x: GX - 10, y: GY - 1 } as const;

/** Pared del fondo dibujada una sola vez en la textura de piezas. */
function backWall(scene: Phaser.Scene, wideEntrance: boolean): void {
  scene.add
    .image(GX, GY, 'mine', wideEntrance ? 'back_wall_wide' : 'back_wall')
    .setOrigin(0, 0)
    .setDepth(DEPTH.background + 4);
}

/**
 * Roca natural del fondo: estratos torcidos, manchas minerales y fracturas
 * discontinuas. No hay juntas horizontales ni cuadrícula de mampostería.
 * LightingSystem aplica la oscuridad y la luz de las antorchas encima.
 */
function rockWall(name: string, width: number): Part {
  return {
    name,
    w: width,
    h: HEIGHT,
    draw(b) {
      for (let y = 0; y < HEIGHT; y++)
        for (let x = 0; x < width; x++) {
          // Bandas torcidas sin unidades repetidas ni límites rectangulares.
          const upper =
            12 + Math.floor(3 * Math.sin(x / 17) + 2 * Math.sin(x / 6));
          const lower =
            34 + Math.floor(4 * Math.sin(x / 21 + 1) + 2 * Math.sin(x / 8));
          const fold = Math.sin(x / 14 + y / 9) + Math.sin(x / 7 - y / 11);
          let color: number =
            y < upper ? P.plum : y > lower ? P.slate : P.stone;
          if (fold > 1.3) color = P.slate;
          else if (fold < -1.25) color = P.taupe;
          const grain =
            (Math.imul(x + 17, 73856093) ^ Math.imul(y + 7, 19349663)) >>> 0;
          if (grain % 71 === 0) color = P.steel;
          b.px(x, y, color);
        }
      const fractures = [
        [
          [5, 9],
          [13, 13],
          [20, 12],
          [27, 19],
          [35, 18],
        ],
        [
          [40, 3],
          [46, 9],
          [53, 11],
          [60, 18],
          [68, 17],
        ],
        [
          [78, 30],
          [85, 23],
          [92, 24],
          [99, 15],
        ],
        [
          [104, 43],
          [112, 37],
          [119, 38],
          [127, 30],
        ],
        [
          [137, 6],
          [143, 13],
          [151, 14],
          [158, 22],
        ],
      ] as const;
      for (const path of fractures)
        for (let i = 1; i < path.length; i++) {
          const [x0, y0] = path[i - 1]!;
          const [x1, y1] = path[i]!;
          b.line(x0, y0, x1, y1, P.night);
          if (i % 2 === 0) b.line(x0, y0 - 1, x1, y1 - 1, P.stone);
        }
    },
  };
}
PARTS.push(rockWall('back_wall', G_END - GX));
PARTS.push(rockWall('back_wall_wide', 10 * TILE_SIZE));
