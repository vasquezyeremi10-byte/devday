import Phaser from 'phaser';
import { DEPTH } from '../../config/layers';
import { PALETTE as P } from '../../config/palette';
import { pixelText } from '../../ui/PixelFont';
import { buildParts, type Part } from './PartsTexture';

/**
 * Bodega minera rústica construida por piezas. Luz desde arriba a la
 * izquierda: canto claro a la izquierda/arriba, sombra abajo/derecha.
 *
 * Niveles: 1 implementado (galpón de tablones con techo de calamina).
 * 2 y 3 quedan reservados: se agregan como nuevas listas de piezas en
 * WAREHOUSE_LEVELS sin cambiar la composición ni el resto de la escena.
 */
export type WarehouseLevel = 1 | 2 | 3;
interface Placement {
  part: string;
  x: number;
  /** Desde el suelo hacia arriba (borde inferior de la pieza). */
  bottom: number;
  depth?: number;
}
interface WarehouseSpec {
  width: number;
  parts: Placement[];
  sign: { x: number; bottom: number };
  lantern: { x: number; bottom: number };
}

const WALL_W = 64;
const WALL_H = 30;
const BASE_H = 5;

/** Color de un tablón según su índice: variaciones cálidas estables. */
const PLANK = [P.clay, P.soil, P.loam, P.clay, P.soil] as const;

const PARTS: Part[] = [
  {
    // Cimiento de piedra de cerro: la bodega apoya sobre el terreno, no flota.
    name: 'wh_foundation',
    w: WALL_W + 6,
    h: BASE_H,
    draw(b) {
      b.rect(0, 0, WALL_W + 6, BASE_H, P.ink);
      for (let x = 1, i = 0; x < WALL_W + 5; i++) {
        const w = 5 + ((i * 3) % 4);
        const lit = i % 3 === 1 ? P.khaki : P.taupe;
        b.rect(x, 1, w - 1, 3, i % 3 === 1 ? P.taupe : P.stone);
        b.rect(x, 1, w - 1, 1, lit);
        b.px(x + w - 2, 3, P.slate);
        // Musgo en algunas juntas.
        if (i % 4 === 2) b.px(x, 1, P.mint);
        x += w;
      }
      b.rect(1, 4, WALL_W + 4, 1, P.slate);
    },
  },
  {
    name: 'wh_wall',
    w: WALL_W,
    h: WALL_H,
    draw(b) {
      // Tablones horizontales de 5 px, cada fila partida en tablas de largo
      // irregular con tonos propios, vetas, clavos y desgaste.
      for (let k = 0; k < 6; k++) {
        const y = k * 5;
        let x = -((k * 9) % 13),
          i = 0;
        while (x < WALL_W) {
          const len = 13 + ((k * 7 + i * 11) % 12);
          const body = PLANK[(k + i * 2) % PLANK.length]!;
          const x0 = Math.max(0, x);
          const w = Math.min(WALL_W, x + len) - x0;
          b.rect(x0, y, w, 1, body === P.loam ? P.ochre : P.loam);
          b.rect(x0, y + 1, w, 3, body);
          b.rect(x0, y + 4, w, 1, P.umber);
          // Veta y nudo.
          b.rect(x0 + 3, y + 2, Math.min(4, w - 4), 1, P.earth);
          if ((k + i) % 3 === 0) b.px(x0 + Math.min(w - 2, 9), y + 2, P.umber);
          // Junta con clavos a ambos lados.
          if (x + len < WALL_W) {
            b.rect(x + len - 1, y + 1, 1, 3, P.umber);
            b.px(x + len - 2, y + 2, P.silver);
            b.px(x + len, y + 2, P.silver);
          }
          x += len;
          i++;
        }
      }
      // Tabla desgastada: astilla clara y hueco.
      b.rect(30, 21, 5, 1, P.sand);
      b.rect(46, 7, 3, 2, P.umber);
      // Cadeneta reforzada a media altura con pernos.
      b.rect(0, 14, WALL_W, 2, P.umber);
      b.rect(0, 14, WALL_W, 1, P.ochre);
      for (let x = 7; x < WALL_W - 4; x += 12) b.px(x, 15, P.steel);
      // Pilares esquineros con canto iluminado, flejes de acero y clavos.
      for (const x of [0, WALL_W - 5]) {
        b.rect(x, 0, 5, WALL_H, P.earth);
        b.rect(x, 0, 1, WALL_H, P.ochre);
        b.rect(x + 1, 0, 1, WALL_H, P.clay);
        b.rect(x + 4, 0, 1, WALL_H, P.umber);
        for (const y of [3, 24]) {
          b.rect(x, y, 5, 2, P.slate);
          b.rect(x, y, 5, 1, P.steel);
          b.px(x + 2, y + 1, P.silver);
        }
      }
      // Sombra del alero: tinta, sombra y dithering.
      b.rect(0, 0, WALL_W, 1, P.ink);
      b.rect(0, 1, WALL_W, 1, P.umber);
      b.dither(0, 2, WALL_W, 2, P.umber);
      b.rect(0, 0, 1, WALL_H, P.ink);
      b.rect(WALL_W - 1, 0, 1, WALL_H, P.ink);
    },
  },
  {
    // Techo a dos aguas de tejuelas oscuras con aleros reforzados y frontón.
    name: 'wh_roof',
    w: WALL_W + 18,
    h: 27,
    draw(b) {
      const w = WALL_W + 18;
      const peak = (w - 1) / 2;
      const top = (x: number) => Math.round(Math.abs(x - peak) / 2) + 1;
      // Frontón: tablas verticales alternas con luz y sombra.
      for (let x = 9; x < w - 9; x++)
        for (let y = top(x) + 6; y < 27; y++)
          b.px(
            x,
            y,
            (x - 9) % 5 === 0
              ? P.umber
              : (x - 9) % 5 === 1
                ? P.loam
                : (x - 9) % 10 < 5
                  ? P.clay
                  : P.soil,
          );
      // Ventana del altillo con luz cálida.
      const c = Math.round(peak);
      b.rect(c - 4, 11, 9, 8, P.ink);
      b.rect(c - 3, 12, 7, 6, P.gold);
      b.rect(c - 3, 12, 7, 2, P.cream);
      b.rect(c, 12, 1, 6, P.earth);
      b.rect(c - 3, 15, 7, 1, P.earth);
      b.rect(c - 4, 19, 9, 1, P.ochre);
      // Faldones: tejuelas en hileras desfasadas, borde de tinta y alero.
      for (let x = 0; x < w; x++) {
        const y = top(x);
        b.px(x, y - 1, P.ink);
        for (let j = 0; j < 5; j++) {
          const row = Math.floor(j / 2);
          const seam = (x + row * 3) % 6 === 0;
          b.px(
            x,
            y + j,
            seam
              ? P.night
              : j % 2 === 0
                ? x < peak
                  ? P.stone
                  : P.slate
                : P.slate,
          );
        }
        if ((x * 7) % 19 === 0) b.px(x, y + 2, P.mauve);
        // Tabla de alero (fascia) ocre con sombra.
        b.px(x, y + 5, P.ochre);
        b.px(x, y + 6, P.ink);
      }
      // Cumbrera con remate de acero.
      b.rect(c - 4, 0, 9, 2, P.ink);
      b.rect(c - 3, 0, 7, 1, P.silver);
      b.rect(c - 3, 1, 7, 1, P.steel);
    },
  },
  {
    // Puerta entreabierta con marco grueso, umbral y luz interior cálida.
    name: 'wh_door',
    w: 16,
    h: 26,
    draw(b) {
      b.rect(0, 0, 16, 26, P.ink);
      // Marco de madera con canto claro.
      b.rect(1, 1, 14, 25, P.earth);
      b.rect(1, 1, 14, 1, P.ochre);
      b.rect(1, 1, 1, 25, P.ochre);
      // Vano: interior iluminado con profundidad (sombra arriba y derecha).
      b.rect(3, 3, 11, 22, P.gold);
      b.rect(3, 3, 11, 2, P.ochre);
      b.rect(12, 3, 2, 22, P.amber);
      b.rect(4, 6, 6, 1, P.cream);
      b.rect(5, 10, 1, 13, P.cream);
      // Estante del fondo con cajas en silueta.
      b.rect(7, 14, 6, 1, P.umber);
      b.rect(8, 11, 2, 3, P.clay);
      b.rect(11, 12, 2, 2, P.soil);
      // Hoja abierta hacia dentro: tablas verticales en sombra.
      for (let x = 3; x < 7; x++) b.rect(x, 3, 1, 22, x % 2 ? P.soil : P.earth);
      b.rect(3, 6, 4, 1, P.umber);
      b.rect(3, 19, 4, 1, P.umber);
      b.rect(7, 3, 1, 22, P.ink);
      b.px(5, 13, P.gold);
      // Umbral de piedra.
      b.rect(0, 25, 16, 1, P.taupe);
      b.rect(2, 25, 12, 1, P.khaki);
    },
  },
  {
    // Ventana con luz interior, travesaños y jardinera con flores.
    name: 'wh_window',
    w: 16,
    h: 15,
    draw(b) {
      b.rect(0, 0, 16, 12, P.ink);
      b.rect(1, 1, 14, 10, P.earth);
      b.rect(1, 1, 14, 1, P.ochre);
      b.rect(2, 2, 12, 8, P.gold);
      b.rect(2, 2, 12, 3, P.cream);
      b.rect(2, 2, 3, 1, P.white);
      b.rect(7, 2, 2, 8, P.earth);
      b.rect(2, 6, 12, 1, P.earth);
      // Silueta de estante y frascos.
      b.rect(10, 8, 3, 2, P.ochre);
      b.px(3, 8, P.amber);
      b.px(4, 9, P.amber);
      // Jardinera.
      b.rect(0, 11, 16, 4, P.ink);
      b.rect(1, 12, 14, 2, P.clay);
      b.rect(1, 12, 14, 1, P.loam);
      for (const [x, color] of [
        [2, P.red],
        [5, P.gold],
        [8, P.red],
        [11, P.white],
        [13, P.gold],
      ] as const) {
        b.px(x, 10, color);
        b.px(x + 1, 11, P.mint);
      }
    },
  },
  {
    // Letrero de madera colgado con cadenas bajo el alero.
    name: 'wh_sign',
    w: 44,
    h: 13,
    draw(b) {
      for (const x of [4, 39]) {
        b.px(x, 0, P.steel);
        b.px(x, 1, P.silver);
        b.px(x, 2, P.steel);
      }
      b.rect(0, 3, 44, 10, P.ink);
      b.rect(1, 4, 42, 8, P.earth);
      b.rect(1, 4, 42, 1, P.ochre);
      b.rect(1, 11, 42, 1, P.umber);
      b.rect(2, 5, 40, 6, P.umber);
      b.rect(2, 5, 40, 1, P.earth);
      for (const x of [2, 41]) {
        b.px(x, 5, P.gold);
        b.px(x, 10, P.gold);
      }
    },
  },
  ...[0, 1].map((frame): Part => ({
    // Farol a parafina en ménsula de fierro; dos cuadros de llama.
    name: `wh_lantern_${frame}`,
    w: 9,
    h: 14,
    draw(b) {
      b.rect(0, 0, 7, 1, P.ink);
      b.rect(0, 1, 1, 2, P.ink);
      b.rect(5, 0, 1, 3, P.ink);
      b.rect(3, 3, 5, 1, P.ink);
      b.rect(2, 4, 7, 9, P.ink);
      b.rect(3, 4, 5, 1, P.slate);
      b.rect(3, 5, 5, 7, frame ? P.amber : P.gold);
      b.rect(4, 6, 3, 5, frame ? P.gold : P.cream);
      b.rect(5, frame ? 7 : 8, 1, 2, P.white);
      b.rect(3, 12, 5, 1, P.slate);
      b.rect(4, 13, 3, 1, P.ink);
    },
  })),
  {
    // Cajón de herramientas con tapa y manilla.
    name: 'wh_toolbox',
    w: 14,
    h: 8,
    draw(b) {
      b.rect(0, 2, 14, 6, P.ink);
      b.rect(1, 3, 12, 4, P.red);
      b.rect(1, 3, 12, 1, P.peach);
      b.rect(1, 5, 12, 1, P.rust);
      b.rect(5, 0, 4, 1, P.ink);
      b.px(5, 1, P.ink);
      b.px(8, 1, P.ink);
      b.rect(6, 4, 2, 1, P.silver);
    },
  },
  {
    // Pala apoyada contra el muro.
    name: 'wh_shovel',
    w: 8,
    h: 25,
    draw(b) {
      b.rect(4, 0, 4, 2, P.ink);
      b.rect(5, 0, 2, 1, P.clay);
      b.line(6, 2, 3, 17, P.ink);
      b.line(5, 2, 2, 17, P.clay);
      b.rect(0, 17, 6, 7, P.ink);
      b.rect(1, 18, 4, 5, P.silver);
      b.rect(1, 22, 4, 1, P.steel);
      b.px(2, 24, P.ink);
    },
  },
  {
    // Picota apoyada, con la hoja hacia arriba.
    name: 'wh_pick',
    w: 12,
    h: 23,
    draw(b) {
      b.line(8, 4, 3, 22, P.ink);
      b.line(7, 4, 2, 22, P.clay);
      b.line(1, 4, 6, 1, P.ink);
      b.line(2, 4, 7, 2, P.silver);
      b.line(7, 2, 11, 3, P.silver);
      b.px(11, 4, P.steel);
      b.px(1, 5, P.steel);
    },
  },
  {
    // Sombra proyectada sobre el suelo: tablero de tinta, sin alfa parcial.
    name: 'shadow_wide',
    w: 24,
    h: 3,
    draw(b) {
      b.dither(0, 0, 24, 2, P.ink);
      b.dither(4, 2, 16, 1, P.ink, 1);
    },
  },
  {
    name: 'shadow_small',
    w: 12,
    h: 2,
    draw(b) {
      b.dither(0, 0, 12, 1, P.ink);
      b.dither(2, 1, 8, 1, P.ink, 1);
    },
  },
];

const LEVEL_1: WarehouseSpec = {
  width: WALL_W,
  parts: [
    { part: 'shadow_wide', x: WALL_W - 6, bottom: -2, depth: -2 },
    { part: 'wh_foundation', x: -3, bottom: 0 },
    { part: 'wh_wall', x: 0, bottom: BASE_H },
    { part: 'wh_roof', x: -9, bottom: BASE_H + WALL_H - 2 },
    { part: 'wh_window', x: 9, bottom: BASE_H + 1 },
    { part: 'wh_door', x: WALL_W - 20, bottom: BASE_H },
    { part: 'wh_shovel', x: -9, bottom: 0, depth: 1 },
    { part: 'wh_pick', x: -18, bottom: 0, depth: 1 },
    { part: 'wh_toolbox', x: 27, bottom: 0, depth: 1 },
  ],
  sign: { x: 1, bottom: BASE_H + WALL_H - 12 },
  lantern: { x: WALL_W - 4, bottom: BASE_H + WALL_H - 17 },
};
export const WAREHOUSE_LEVELS: Record<WarehouseLevel, WarehouseSpec | null> = {
  1: LEVEL_1,
  2: null,
  3: null,
};

export function createWarehouseParts(scene: Phaser.Scene): void {
  buildParts(scene, 'warehouse', PARTS);
  if (!scene.anims.exists('wh-lantern'))
    scene.anims.create({
      key: 'wh-lantern',
      frames: [
        { key: 'warehouse', frame: 'wh_lantern_0' },
        { key: 'warehouse', frame: 'wh_lantern_1' },
      ],
      frameRate: 3,
      repeat: -1,
    });
}

/**
 * Compone la bodega: cada pieza es una imagen propia dentro de un contenedor,
 * por lo que un nivel posterior puede reemplazar piezas sueltas.
 */
export function createWarehouse(
  scene: Phaser.Scene,
  x: number,
  groundY: number,
  level: WarehouseLevel = 1,
): Phaser.GameObjects.Container {
  const spec = WAREHOUSE_LEVELS[level];
  if (!spec) throw new Error(`Bodega nivel ${level} aún no implementada`);
  createWarehouseParts(scene);
  const container = scene.add
    .container(x, groundY)
    .setDepth(DEPTH.structures - 1);
  const items = spec.parts.map(({ part, x: px, bottom, depth = 0 }) => {
    const image = scene.add
      .image(px, -bottom, 'warehouse', part)
      .setOrigin(0, 1);
    return { image, depth };
  });
  items
    .sort((a, b) => a.depth - b.depth)
    .forEach(({ image }) => container.add(image));
  container.add(
    scene.add
      .image(spec.sign.x, -spec.sign.bottom, 'warehouse', 'wh_sign')
      .setOrigin(0, 1),
  );
  container.add(
    pixelText(scene, spec.sign.x + 4, -spec.sign.bottom - 8, 'BODEGA', P.gold),
  );
  container.add(
    scene.add
      .sprite(spec.lantern.x, -spec.lantern.bottom, 'warehouse', 'wh_lantern_0')
      .setOrigin(0, 1)
      .play('wh-lantern'),
  );
  container.setData('level', level);
  return container;
}
