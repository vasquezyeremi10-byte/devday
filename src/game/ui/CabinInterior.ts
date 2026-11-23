import Phaser from 'phaser';
import { VIEW } from '../config/constants';
import { DEPTH } from '../config/layers';
import { PALETTE as P, cssColor } from '../config/palette';
import type { FoodKind } from '../config/survival';
import type { DayNightCycle } from '../systems/DayNightCycle';
import { buildParts, type Part } from '../world/structures/PartsTexture';
import { pixelText } from './PixelFont';

/**
 * Interior del pabellón (V8): una pieza pequeña vista de costado, dibujada
 * en la vista de 480 × 270 sobre el mundo (bajo el HUD). El minero entra
 * como una figura con su mismo aspecto (casco, uniforme y EPP) que camina
 * entre la puerta, el casillero y la cama.
 *
 * Dormir es una secuencia real: caminar a la cama, sentarse, acostarse bajo
 * la frazada, respirar con «Z» que suben, fundido a negro con trama Bayer
 * (sin alfa parcial), cambio de hora en negro, fundido de vuelta, sentarse
 * y estirarse. La hora cambia solo mientras la pantalla está negra.
 */
const FLOOR = 206;
const DOOR = { x: 22, w: 30 };
const LOCKER = { x: 84, w: 26 };
/** Refrigerador entre el casillero y la estufa (24 × 54 px, apoyado en el piso). */
const FRIDGE_X = 146;
const BED = { x: 350, w: 96 };
/** Recorrido de la figura dentro de la pieza. */
const WALK = { min: DOOR.x + DOOR.w + 6, max: BED.x - 8 };
const SPEED = 62;

export type CabinAction =
  | 'exit'
  | 'sleep'
  | 'locker'
  | 'calendar'
  | 'stove'
  | 'window'
  | 'shelf'
  | 'fridge'
  | 'board'
  | 'book'
  | null;
/** Estado de la tabla suelta del piso («La herencia del abuelo»). */
export type BoardState = 'hidden' | 'loose' | 'open';
const BOARD = { x: 257, bottom: FLOOR + 11, w: 26 };
/** Zonas del recorrido donde E hace algo (gana la de centro más cercano). */
interface Spot {
  id: Exclude<CabinAction, null>;
  x: number;
  r: number;
  prompt: string;
}
const SPOTS: Spot[] = [
  { id: 'exit', x: WALK.min, r: 16, prompt: '[E] SALIR DE LA CABAÑA' },
  { id: 'locker', x: LOCKER.x + LOCKER.w / 2, r: 18, prompt: '[E] REVISAR CASILLERO' },
  { id: 'calendar', x: 128, r: 12, prompt: '[E] VER EL CALENDARIO' },
  { id: 'fridge', x: FRIDGE_X + 12, r: 12, prompt: '[E] ABRIR EL REFRIGERADOR' },
  { id: 'stove', x: 190, r: 14, prompt: '[E] MIRAR LA ESTUFA' },
  { id: 'window', x: 240, r: 22, prompt: '[E] MIRAR LA VENTANA' },
  { id: 'shelf', x: 310, r: 12, prompt: '[E] REVISAR LA REPISA' },
  { id: 'sleep', x: WALK.max, r: 40, prompt: '[E] DESCANSAR' },
];
type Phase =
  | 'idle'
  | 'walk'
  | 'sit'
  | 'lie'
  | 'doze'
  | 'fadeOut'
  | 'black'
  | 'fadeIn'
  | 'wake'
  | 'stretch';
const DURATION: Partial<Record<Phase, number>> = {
  sit: 500,
  lie: 600,
  doze: 1300,
  fadeOut: 1000,
  black: 1500,
  fadeIn: 1000,
  wake: 700,
  stretch: 700,
};

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const FURNITURE: Part[] = [
  {
    // Cama de fierro con colchón, almohada y respaldo a la derecha.
    name: 'bed',
    w: BED.w,
    h: 30,
    draw(b) {
      // Respaldo y pie de fierro pintado.
      b.rect(BED.w - 6, 0, 6, 30, P.ink);
      b.rect(BED.w - 5, 1, 4, 29, P.steel);
      b.rect(BED.w - 5, 1, 1, 29, P.silver);
      b.rect(0, 10, 5, 20, P.ink);
      b.rect(1, 11, 3, 19, P.steel);
      b.rect(1, 11, 1, 19, P.silver);
      // Bastidor.
      b.rect(4, 20, BED.w - 9, 4, P.ink);
      b.rect(5, 21, BED.w - 11, 2, P.stone);
      // Colchón.
      b.rect(5, 14, BED.w - 11, 7, P.ink);
      b.rect(6, 15, BED.w - 13, 5, P.mist);
      b.rect(6, 15, BED.w - 13, 1, P.white);
      for (let x = 10; x < BED.w - 10; x += 8) b.px(x, 18, P.silver);
      // Almohada a la derecha.
      b.rect(BED.w - 24, 9, 17, 7, P.ink);
      b.rect(BED.w - 23, 10, 15, 5, P.white);
      b.rect(BED.w - 23, 14, 15, 1, P.silver);
      // Patas.
      for (const x of [6, BED.w - 12]) b.rect(x, 24, 3, 6, P.ink);
    },
  },
  ...[0, 1].map(
    (f): Part => ({
      // Frazada a cuadros rojos (respira: sube 1 px en el cuadro 1).
      name: `blanket_${f}`,
      w: 70,
      h: 14,
      draw(b) {
        const top = f ? 2 : 3;
        b.rect(0, top, 70, 14 - top, P.ink);
        b.rect(1, top + 1, 68, 12 - top, P.red);
        b.rect(1, top + 1, 68, 1, P.peach);
        for (let x = 6; x < 68; x += 10) b.rect(x, top + 1, 2, 12 - top, P.rust);
        b.rect(1, top + 6, 68, 1, P.rust);
        // Bulto de las rodillas y doblez al pecho.
        b.rect(22, top - 1, 14, 2, P.ink);
        b.rect(23, top, 12, 1, P.red);
        b.rect(66, top + 1, 3, 12 - top, P.cream);
      },
    }),
  ),
  {
    name: 'nightstand',
    w: 18,
    h: 22,
    draw(b) {
      b.rect(0, 0, 18, 22, P.ink);
      b.rect(1, 1, 16, 21, P.clay);
      b.rect(1, 1, 16, 2, P.ochre);
      b.rect(3, 6, 12, 6, P.soil);
      b.rect(3, 6, 12, 1, P.earth);
      b.rect(8, 8, 2, 2, P.gold);
      b.rect(3, 14, 12, 6, P.soil);
      b.rect(8, 16, 2, 2, P.gold);
    },
  },
  ...[0, 1].map(
    (on): Part => ({
      // Lámpara de velador (la luz sobre la pared la dibuja `lampLight`).
      name: on ? 'lamp_glow' : 'lamp_off',
      w: 21,
      h: 22,
      draw(b) {
        // Pantalla, cuerpo y base.
        b.rect(5, 2, 11, 7, P.ink);
        b.rect(6, 3, 9, 5, on ? P.cream : P.sand);
        b.rect(6, 7, 9, 1, on ? P.gold : P.loam);
        b.rect(9, 9, 3, 9, P.ink);
        b.rect(10, 9, 1, 9, on ? P.gold : P.steel);
        b.rect(6, 18, 9, 4, P.ink);
        b.rect(7, 18, 7, 2, P.stone);
      },
    }),
  ),
  {
    // Casillero minero de acero con rejillas, número y candado.
    name: 'locker',
    w: LOCKER.w,
    h: 58,
    draw(b) {
      b.rect(0, 0, LOCKER.w, 58, P.ink);
      b.rect(1, 1, LOCKER.w - 2, 57, P.stone);
      b.rect(1, 1, 3, 57, P.steel);
      b.rect(1, 1, LOCKER.w - 2, 1, P.silver);
      for (let y = 6; y < 16; y += 2) b.rect(7, y, 12, 1, P.slate);
      b.rect(8, 20, 10, 6, P.ink);
      b.rect(9, 21, 8, 4, P.cream);
      b.rect(10, 22, 2, 2, P.ink);
      b.rect(14, 22, 2, 2, P.ink);
      b.rect(19, 30, 3, 5, P.ink);
      b.rect(19, 31, 3, 3, P.gold);
      b.rect(13, 1, 1, 57, P.slate);
      b.rect(1, 54, LOCKER.w - 2, 3, P.slate);
    },
  },
  {
    // Refrigerador de esmalte crema con manijas cromadas, bajo una placa
    // dorada y una lucecita de encendido: de los años cincuenta, como la
    // estufa y el casillero, y cálido como la madera de la cabaña.
    name: 'fridge',
    w: 24,
    h: 54,
    draw(b) {
      // Contorno con la parte alta redondeada.
      b.rect(2, 0, 20, 1, P.ink);
      b.rect(1, 1, 22, 1, P.ink);
      b.rect(0, 2, 24, 50, P.ink);
      // Esmalte: brillo a la izquierda, sombra a la derecha.
      b.rect(2, 1, 20, 1, P.white);
      b.rect(1, 2, 22, 49, P.cream);
      b.rect(1, 2, 3, 49, P.white);
      b.rect(19, 2, 4, 49, P.sand);
      b.rect(22, 2, 1, 49, P.khaki);
      // Junta entre el congelador y la puerta principal.
      b.rect(1, 16, 22, 2, P.ink);
      b.rect(1, 18, 22, 1, P.white);
      // Manijas cromadas.
      b.rect(16, 6, 3, 8, P.ink);
      b.rect(17, 7, 1, 6, P.silver);
      b.px(17, 7, P.white);
      b.rect(16, 21, 3, 15, P.ink);
      b.rect(17, 22, 1, 13, P.silver);
      b.px(17, 22, P.white);
      // Placa dorada y luz de encendido.
      b.rect(5, 24, 8, 4, P.ink);
      b.rect(6, 25, 6, 2, P.gold);
      b.px(6, 25, P.cream);
      b.rect(5, 8, 3, 3, P.ink);
      b.px(6, 9, P.mist);
      // Escarcha del congelador y una nota con imán.
      b.rect(5, 12, 7, 1, P.mist);
      b.rect(6, 34, 6, 7, P.ink);
      b.rect(7, 35, 4, 5, P.white);
      b.px(8, 36, P.red);
      b.rect(8, 38, 2, 1, P.steel);
      // Patas.
      b.rect(2, 52, 4, 2, P.ink);
      b.rect(18, 52, 4, 2, P.ink);
    },
  },
  {
    // Puerta del pabellón vista desde dentro.
    name: 'door',
    w: DOOR.w,
    h: 58,
    draw(b) {
      b.rect(0, 0, DOOR.w, 58, P.ink);
      b.rect(1, 1, DOOR.w - 2, 57, P.earth);
      b.rect(1, 1, DOOR.w - 2, 1, P.ochre);
      for (let x = 4; x < DOOR.w - 3; x += 5) {
        b.rect(x, 4, 5, 54, x % 2 ? P.clay : P.soil);
        b.rect(x, 4, 1, 54, P.loam);
      }
      b.rect(4, 14, DOOR.w - 7, 3, P.umber);
      b.rect(4, 44, DOOR.w - 7, 3, P.umber);
      b.rect(DOOR.w - 8, 28, 3, 4, P.ink);
      b.px(DOOR.w - 8, 28, P.silver);
    },
  },
  {
    // Estufa a leña con su cañón hacia el techo.
    name: 'stove',
    w: 28,
    h: 34,
    draw(b) {
      b.rect(0, 6, 28, 28, P.ink);
      b.rect(1, 7, 26, 22, P.slate);
      b.rect(1, 7, 26, 2, P.stone);
      b.rect(6, 14, 14, 9, P.ink);
      b.rect(7, 15, 12, 7, P.ember);
      b.rect(8, 18, 10, 4, P.orange);
      b.rect(10, 19, 5, 2, P.gold);
      b.rect(3, 29, 4, 5, P.ink);
      b.rect(21, 29, 4, 5, P.ink);
      b.rect(16, 0, 7, 7, P.ink);
      b.rect(17, 0, 5, 7, P.stone);
    },
  },
  {
    // Calendario de faena con días tachados.
    name: 'calendar',
    w: 16,
    h: 19,
    draw(b) {
      b.rect(0, 0, 16, 19, P.ink);
      b.rect(1, 1, 14, 17, P.white);
      b.rect(1, 1, 14, 4, P.red);
      for (let y = 7; y < 17; y += 3)
        for (let x = 2; x < 14; x += 3) b.px(x, y, P.stone);
      for (const [x, y] of [[2, 7], [5, 7], [8, 7], [11, 7], [2, 10]] as const) {
        b.px(x, y, P.red);
        b.px(x + 1, y + 1, P.red);
      }
    },
  },
  {
    // Bandera chilena clavada en la pared.
    name: 'flag',
    w: 16,
    h: 11,
    draw(b) {
      b.rect(0, 0, 16, 11, P.ink);
      b.rect(1, 1, 14, 4, P.white);
      b.rect(1, 5, 14, 5, P.red);
      b.rect(1, 1, 5, 4, P.sky);
      b.px(3, 2, P.white);
      b.px(3, 3, P.white);
      b.px(2, 3, P.white);
      b.px(4, 3, P.white);
    },
  },
  {
    // Foto familiar enmarcada.
    name: 'photo',
    w: 15,
    h: 13,
    draw(b) {
      b.rect(0, 0, 15, 13, P.ink);
      b.rect(1, 1, 13, 11, P.ochre);
      b.rect(2, 2, 11, 9, P.mist);
      b.rect(2, 8, 11, 3, P.mint);
      for (const [x, c] of [[4, P.earth], [7, P.red], [10, P.gold]] as const) {
        b.px(x, 5, P.peach);
        b.rect(x - 1, 6, 2, 3, c);
      }
    },
  },
  {
    // Repisa con radio a pilas, libros y termo.
    name: 'shelf',
    w: 44,
    h: 18,
    draw(b) {
      b.rect(0, 14, 44, 4, P.ink);
      b.rect(1, 14, 42, 2, P.clay);
      b.rect(1, 14, 42, 1, P.ochre);
      // Radio.
      b.rect(2, 4, 16, 10, P.ink);
      b.rect(3, 5, 14, 8, P.rust);
      b.rect(4, 6, 6, 6, P.slate);
      for (let y = 7; y < 12; y += 2) b.rect(4, y, 6, 1, P.ink);
      b.rect(12, 6, 3, 2, P.cream);
      b.line(16, 4, 19, 0, P.silver);
      // Libros.
      for (const [x, c, h] of [[21, P.sky, 11], [24, P.mint, 9], [27, P.gold, 12]] as const) {
        b.rect(x, 14 - h, 3, h, P.ink);
        b.rect(x + 1, 15 - h, 1, h - 1, c);
      }
      // Termo.
      b.rect(34, 3, 6, 11, P.ink);
      b.rect(35, 4, 4, 9, P.mint);
      b.rect(35, 4, 1, 9, P.lime);
    },
  },
  {
    // Alfombra tejida a franjas.
    name: 'rug',
    w: 92,
    h: 4,
    draw(b) {
      b.rect(0, 0, 92, 4, P.ink);
      const colors = [P.red, P.gold, P.sky, P.cream, P.mint];
      for (let x = 1; x < 91; x++) b.rect(x, 1, 1, 2, colors[Math.floor(x / 6) % 5]!);
    },
  },
  {
    // Marco de la ventana (el cielo se dibuja detrás, según la hora).
    name: 'window_frame',
    w: 66,
    h: 50,
    draw(b) {
      b.rect(0, 0, 66, 4, P.ink);
      b.rect(0, 0, 4, 50, P.ink);
      b.rect(62, 0, 4, 50, P.ink);
      b.rect(0, 44, 66, 6, P.ink);
      b.rect(1, 1, 64, 2, P.ochre);
      b.rect(1, 1, 2, 43, P.ochre);
      b.rect(63, 1, 2, 43, P.earth);
      b.rect(1, 45, 64, 3, P.loam);
      b.rect(1, 45, 64, 1, P.cream);
      b.rect(31, 3, 4, 41, P.ink);
      b.rect(32, 3, 2, 41, P.earth);
      b.rect(3, 22, 60, 2, P.earth);
      // Cortinas a los lados.
      for (const x of [4, 52]) {
        b.rect(x, 3, 10, 41, P.ink);
        b.rect(x + 1, 3, 8, 40, P.red);
        for (let y = 6; y < 42; y += 6) b.rect(x + 2, y, 6, 1, P.rust);
        b.rect(x + 1, 3, 2, 40, P.peach);
      }
    },
  },
  {
    // Gancho con casco de repuesto y chaqueta.
    name: 'hook',
    w: 18,
    h: 26,
    draw(b) {
      b.rect(0, 0, 18, 3, P.ink);
      b.rect(1, 1, 16, 1, P.clay);
      b.rect(2, 3, 9, 5, P.ink);
      b.rect(3, 3, 7, 4, P.gold);
      b.px(4, 3, P.cream);
      b.rect(11, 3, 6, 22, P.ink);
      b.rect(12, 4, 4, 20, P.orange);
      b.rect(12, 13, 4, 1, P.silver);
      b.rect(12, 18, 4, 1, P.silver);
    },
  },
  ...[0, 1].map(
    (f): Part => ({
      // Tabla suelta del piso: en el cuadro 1 la punta se levanta sobre la rendija.
      name: `board_${f}`,
      w: 26,
      h: 7,
      draw(b) {
        const top = f ? 0 : 1;
        b.rect(0, 3, 26, 4, P.ink);
        b.rect(1, 4, 24, 2, P.umber);
        b.rect(0, top, 26, 4, P.ink);
        b.rect(1, top + 1, 24, 2, P.loam);
        b.rect(1, top + 1, 24, 1, P.cream);
        b.px(3, top + 2, P.ink);
        b.px(22, top + 2, P.ink);
      },
    }),
  ),
  {
    // Hueco bajo la tabla.
    name: 'hole',
    w: 26,
    h: 7,
    draw(b) {
      b.rect(0, 0, 26, 7, P.ink);
      b.rect(1, 1, 24, 5, P.night);
      b.rect(1, 1, 24, 1, P.umber);
    },
  },
  {
    // Libro del abuelo envuelto en tela encerada, con broche dorado.
    name: 'book',
    w: 14,
    h: 9,
    draw(b) {
      b.rect(0, 0, 14, 9, P.ink);
      b.rect(1, 1, 12, 7, P.earth);
      b.rect(1, 1, 12, 1, P.clay);
      b.rect(1, 1, 2, 7, P.ochre);
      b.rect(2, 7, 11, 1, P.cream);
      b.rect(5, 3, 5, 1, P.gold);
      b.rect(5, 5, 3, 1, P.gold);
      b.rect(11, 3, 2, 3, P.gold);
    },
  },
  {
    // Botas bajo la cama.
    name: 'boots',
    w: 12,
    h: 7,
    draw(b) {
      for (const x of [0, 6]) {
        b.rect(x, 0, 5, 7, P.ink);
        b.rect(x + 1, 0, 3, 5, P.gold);
        b.rect(x + 1, 5, 4, 1, P.earth);
      }
    },
  },
];

/** Paredes, techo y piso de la pieza en una textura de fondo de la vista. */
function paintRoom(scene: Phaser.Scene): void {
  const key = 'cabin-room';
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, VIEW.width, VIEW.height)!;
  const ctx = t.context;
  const fill = (c: number, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = cssColor(c);
    ctx.fillRect(x, y, w, h);
  };
  // Muro de tablas verticales (tibio, iluminado por la lámpara).
  const boards = [P.soil, P.clay, P.loam, P.clay, P.soil, P.earth];
  for (let x = 0, i = 0; x < VIEW.width; x += 9, i++) {
    const c = boards[(i * 5) % boards.length]!;
    fill(c, x, 0, 8, FLOOR);
    fill(c === P.earth ? P.soil : P.loam, x, 0, 1, FLOOR);
    fill(P.umber, x + 8, 0, 1, FLOOR);
    fill(P.earth, x + 4, 60 + ((i * 23) % 70), 1, 8);
  }
  // Zócalo de tablas horizontales con cadeneta.
  for (let y = 160; y < FLOOR; y += 6) {
    fill(P.earth, 0, y, VIEW.width, 5);
    fill(P.soil, 0, y, VIEW.width, 1);
    fill(P.umber, 0, y + 5, VIEW.width, 1);
  }
  fill(P.umber, 0, 156, VIEW.width, 4);
  fill(P.ochre, 0, 156, VIEW.width, 1);
  // Cielo raso con vigas.
  fill(P.umber, 0, 0, VIEW.width, 40);
  for (let x = 0; x < VIEW.width; x += 60) {
    fill(P.ink, x + 20, 0, 14, 44);
    fill(P.earth, x + 21, 0, 12, 43);
    fill(P.clay, x + 21, 0, 2, 43);
  }
  fill(P.ink, 0, 40, VIEW.width, 2);
  fill(P.earth, 0, 42, VIEW.width, 2);
  // Piso de tablas.
  fill(P.ink, 0, FLOOR, VIEW.width, 1);
  for (let y = FLOOR + 1, k = 0; y < VIEW.height; y += 5, k++) {
    fill(k % 2 ? P.loam : P.clay, 0, y, VIEW.width, 4);
    fill(P.umber, 0, y + 4, VIEW.width, 1);
    for (let x = (k * 37) % 70; x < VIEW.width; x += 70) fill(P.umber, x, y, 1, 4);
  }
  // Pilares de los costados.
  for (const x of [0, VIEW.width - 12]) {
    fill(P.ink, x, 0, 12, FLOOR);
    fill(P.earth, x + 1, 0, 10, FLOOR);
    fill(P.ochre, x + 1, 0, 2, FLOOR);
  }
  t.refresh();
  t.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** Trama Bayer 4 × 4 de 17 niveles para el fundido a negro (alfa 0/255). */
export function cabinFade(scene: Phaser.Scene, depth: number = DEPTH.ui + 80): Phaser.GameObjects.TileSprite {
  paintFade(scene);
  return scene.add.tileSprite(0, 0, VIEW.width, VIEW.height, 'v8-fade', 0)
    .setOrigin(0).setScrollFactor(0).setDepth(depth).setVisible(false);
}

function paintFade(scene: Phaser.Scene): void {
  const key = 'v8-fade';
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, 17 * 4, 4)!;
  const ctx = t.context;
  ctx.fillStyle = cssColor(P.ink);
  for (let level = 0; level <= 16; level++) {
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++)
        if (BAYER4[y * 4 + x]! < level) ctx.fillRect(level * 4 + x, y, 1, 1);
    t.add(level, 0, level * 4, 0, 4, 4);
  }
  t.refresh();
  t.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

export class CabinInterior {
  open = false;
  private readonly root: Phaser.GameObjects.Container;
  private readonly sky: Phaser.GameObjects.Graphics;
  private readonly lamp: Phaser.GameObjects.Image;
  private readonly puppet: Phaser.GameObjects.Sprite;
  private readonly blanket: Phaser.GameObjects.Image;
  private readonly held: Phaser.GameObjects.Image;
  private readonly zzz: Phaser.GameObjects.Graphics;
  private readonly lampLight: Phaser.GameObjects.Graphics;
  private readonly fade: Phaser.GameObjects.TileSprite;
  private readonly caption: Phaser.GameObjects.BitmapText;
  private phase: Phase = 'idle';
  private phaseAt = 0;
  private skyKey = '';
  private x: number = WALK.min;
  private flip = false;
  private walkAt = 0;
  private eatUntil = 0;
  private eatKind: FoodKind | null = null;
  /** Al quedar la pantalla en negro: la escena aplica el cambio de hora. */
  onSleep?: () => string;
  /** Al terminar de levantarse. */
  onWake?: () => void;
  private wokeText = '';
  private boardState: BoardState = 'hidden';
  private boardAt = -1e9;
  private marker: 'exit' | 'board' | null = null;
  private readonly boardImg: Phaser.GameObjects.Image;
  private readonly holeImg: Phaser.GameObjects.Image;
  private readonly bookImg: Phaser.GameObjects.Image;
  private readonly boardFx: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    /** Textura del minero vestido con su EPP real (base sin herramienta). */
    private readonly look: () => string,
  ) {
    paintRoom(scene);
    buildParts(scene, 'cabin-int', FURNITURE);
    const img = (frame: string, x: number, bottom: number) =>
      scene.add.image(x, bottom, 'cabin-int', frame).setOrigin(0, 1);
    this.sky = scene.add.graphics();
    this.lamp = img('lamp_off', BED.x - 26, FLOOR - 22);
    this.puppet = scene.add.sprite(WALK.min, FLOOR, 'miner-unarmed', 0).setOrigin(0.5, 1);
    this.blanket = img('blanket_0', BED.x + 6, FLOOR - 9).setVisible(false);
    this.held = scene.add.image(0, 0, 'v8-items', 'cola_hand').setVisible(false);
    this.zzz = scene.add.graphics();
    this.holeImg = img('hole', BOARD.x, BOARD.bottom).setVisible(false);
    this.bookImg = img('book', BOARD.x + 6, BOARD.bottom - 1).setVisible(false);
    this.boardImg = img('board_0', BOARD.x, BOARD.bottom).setVisible(false);
    this.boardFx = scene.add.graphics();
    // Luz de la lámpara: bandas ámbar cuantizadas en bloques de 4 px, con
    // mezcla aditiva (ilumina muro, velador, cama y minero; sin puntos).
    this.lampLight = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const lx = BED.x - 16,
      ly = FLOOR - 37;
    const bands = [
      [16, 0x4a300e],
      [32, 0x2a1806],
      [52, 0x120a02],
    ] as const;
    for (let y = ly - 56; y < FLOOR + 8; y += 4)
      for (let x = lx - 56; x < lx + 56; x += 4) {
        const d = Math.hypot(x + 2 - lx, (y + 2 - ly) * 1.15);
        const band = bands.find(([r]) => d < r);
        if (band) this.lampLight.fillStyle(band[1]).fillRect(x, y, 4, 4);
      }
    this.lampLight.setVisible(false);
    this.root = scene.add
      .container(0, 0, [
        scene.add.image(0, 0, 'cabin-room').setOrigin(0),
        this.sky,
        img('window_frame', 207, 124),
        img('flag', 150, 86),
        img('calendar', 124, 112),
        img('photo', 392, 116),
        img('shelf', 288, 124),
        img('stove', 176, FLOOR),
        img('fridge', FRIDGE_X, FLOOR),
        scene.add.rectangle(195, 0, 5, 172, P.ink).setOrigin(0),
        scene.add.rectangle(196, 0, 3, 172, P.stone).setOrigin(0),
        img('rug', 214, FLOOR + 3),
        this.holeImg,
        this.bookImg,
        this.boardImg,
        this.boardFx,
        img('door', DOOR.x, FLOOR),
        img('hook', 58, 138),
        img('locker', LOCKER.x, FLOOR),
        img('nightstand', BED.x - 24, FLOOR),
        this.lamp,
        img('bed', BED.x, FLOOR),
        img('boots', BED.x + 30, FLOOR),
        this.puppet,
        this.blanket,
        this.held,
        this.lampLight,
        this.zzz,
        pixelText(scene, 67, 139, 'CABAÑA 7', P.cream),
      ])
      .setScrollFactor(0)
      .setDepth(DEPTH.ui - 20)
      .setVisible(false);
    this.fade = cabinFade(scene, DEPTH.ui + 40);
    this.caption = pixelText(scene, 0, 128, '', P.cream)
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 41)
      .setVisible(false);
  }

  /** ¿La secuencia de descanso está en curso? (bloquea los controles). */
  get sleeping(): boolean {
    return this.phase !== 'idle' && this.phase !== 'walk';
  }
  /** Fase actual (diagnóstico y pruebas). */
  get state(): Phase {
    return this.phase;
  }
  get puppetX(): number {
    return this.x;
  }

  show(): void {
    this.open = true;
    this.phase = 'idle';
    this.x = WALK.min;
    this.flip = false;
    this.root.setVisible(true);
    this.fade.setVisible(false);
    this.caption.setVisible(false);
    this.blanket.setVisible(false);
  }

  hide(): void {
    this.open = false;
    this.phase = 'idle';
    this.root.setVisible(false);
    this.fade.setVisible(false);
    this.caption.setVisible(false);
  }

  /** Objeto que se usaría con E según dónde está la figura. */
  private spot(): Spot | undefined {
    if (!this.open || this.phase !== 'idle') return undefined;
    const spots: Spot[] = [...SPOTS];
    if (this.boardState === 'loose')
      spots.push({
        id: 'board',
        x: BOARD.x + BOARD.w / 2,
        r: 14,
        prompt: '[E] EXAMINAR LA TABLA',
      });
    else if (this.boardState === 'open')
      spots.push({
        id: 'book',
        x: BOARD.x + BOARD.w / 2,
        r: 14,
        prompt: '[E] LEER EL LIBRO',
      });
    return spots
      .filter((s) => Math.abs(this.x - s.x) <= s.r)
      .sort((a, b) => Math.abs(this.x - a.x) - Math.abs(this.x - b.x))[0];
  }

  /** Indicación según dónde está la figura. */
  get prompt(): string {
    return this.spot()?.prompt ?? '';
  }

  /** E dentro de la pieza: qué objeto se usa. */
  action(): CabinAction {
    return this.spot()?.id ?? null;
  }

  /** Tabla suelta: oculta, suelta (se puede examinar) o abierta con el libro. */
  setBoard(state: BoardState, now: number): void {
    if (state === this.boardState) return;
    this.boardState = state;
    this.boardAt = now;
  }
  get board(): BoardState {
    return this.boardState;
  }

  /** Flecha de la guía sobre la puerta o sobre la tabla (null = ninguna). */
  setMarker(target: 'exit' | 'board' | null): void {
    this.marker = target;
  }

  /** Tabla, hueco y libro: animación sencilla de levantar y apartar la tabla. */
  private drawBoard(now: number): void {
    const state = this.boardState;
    const fx = this.boardFx.clear();
    this.boardImg.setVisible(state !== 'hidden');
    this.holeImg.setVisible(state === 'open');
    this.bookImg.setVisible(state === 'open');
    if (state === 'loose') {
      // Se levanta y baja sobre la rendija; un destello llama la atención.
      const up = Math.floor(now / 650) % 2;
      this.boardImg.setFrame(`board_${up}`).setPosition(BOARD.x, BOARD.bottom);
      // Al descubrirla, da un saltito corto.
      const t = now - this.boardAt;
      if (t < 360) this.boardImg.y -= Math.round(Math.sin((t / 360) * Math.PI) * 5);
      if (Math.floor(now / 900) % 3 === 0)
        fx.fillStyle(P.white).fillRect(BOARD.x + 5, BOARD.bottom - 9, 1, 3).fillRect(BOARD.x + 4, BOARD.bottom - 8, 3, 1);
    } else if (state === 'open') {
      // La tabla se aparta con un arco corto y queda a un lado del hueco.
      const p = Math.min(1, (now - this.boardAt) / 420);
      this.boardImg
        .setFrame('board_0')
        .setPosition(
          BOARD.x + Math.round(p * 34),
          BOARD.bottom - Math.round(Math.sin(p * Math.PI) * 9),
        );
      this.bookImg.setY(BOARD.bottom - 1 - (p < 1 ? 0 : Math.floor(now / 500) % 2));
      if (p >= 1 && Math.floor(now / 1100) % 2 === 0)
        fx.fillStyle(P.cream).fillRect(BOARD.x + 18, BOARD.bottom - 11, 1, 3).fillRect(BOARD.x + 17, BOARD.bottom - 10, 3, 1);
    }
    // Flecha de la guía.
    if (this.marker) {
      const x = this.marker === 'exit' ? DOOR.x + DOOR.w / 2 : BOARD.x + BOARD.w / 2;
      const y = (this.marker === 'exit' ? FLOOR - 70 : FLOOR - 26) + (Math.floor(now / 220) % 2 ? 2 : 0);
      fx.fillStyle(P.ink)
        .fillRect(x - 4, y - 1, 9, 3)
        .fillRect(x - 3, y + 1, 7, 2)
        .fillRect(x - 2, y + 3, 5, 2)
        .fillRect(x - 1, y + 5, 3, 2)
        .fillRect(x, y + 6, 1, 2);
      fx.fillStyle(P.gold)
        .fillRect(x - 3, y, 7, 1)
        .fillRect(x - 2, y + 1, 5, 1)
        .fillRect(x - 1, y + 2, 3, 1)
        .fillRect(x, y + 3, 1, 1);
    }
  }

  /** Comienza la secuencia de descanso (la escena ya validó el hambre). */
  startSleep(now: number): void {
    this.phase = 'walk';
    this.phaseAt = now;
  }

  /** ESC antes del fundido: se levanta y queda despierto. */
  cancelSleep(): boolean {
    if (!['walk', 'sit', 'lie', 'doze'].includes(this.phase)) return false;
    this.phase = 'idle';
    this.blanket.setVisible(false);
    return true;
  }

  /** Comer o beber dentro de la pieza: mismo gesto que afuera. */
  eat(kind: FoodKind, now: number): void {
    this.eatKind = kind;
    this.eatUntil = now + 800;
  }

  private enter(phase: Phase, now: number): void {
    this.phase = phase;
    this.phaseAt = now;
    if (phase === 'black') this.wokeText = this.onSleep?.() ?? '';
    if (phase === 'idle') this.onWake?.();
  }

  update(
    now: number,
    dtMs: number,
    direction: number,
    day: DayNightCycle,
    tired: boolean,
    speedFactor: number,
  ): void {
    if (!this.open) return;
    this.drawSky(day);
    this.drawBoard(now);
    const night = day.sunStrength < 0.45;
    const lampOn = night && this.phase !== 'black';
    this.lamp.setFrame(lampOn ? 'lamp_glow' : 'lamp_off');
    this.lampLight.setVisible(lampOn);
    const t = now - this.phaseAt;
    const done = t >= (DURATION[this.phase] ?? Infinity);
    const look = this.look();
    const stand = (frame: number) => {
      this.puppet
        .setTexture(look, frame)
        .setOrigin(0.5, 1)
        .setAngle(0)
        .setFlipX(this.flip)
        .setPosition(Math.round(this.x), FLOOR);
    };
    const lie = () =>
      this.puppet
        .setTexture(look, 0)
        .setOrigin(0.5)
        .setAngle(90)
        .setFlipX(true)
        .setPosition(BED.x + BED.w - 22, FLOOR - 16);
    this.zzz.clear();
    this.blanket.setVisible(false);
    let fadeLevel = 0;
    switch (this.phase) {
      case 'idle': {
        if (direction) {
          this.flip = direction < 0;
          this.x = Phaser.Math.Clamp(
            this.x + (direction * SPEED * speedFactor * dtMs) / 1000,
            WALK.min,
            WALK.max,
          );
          this.walkAt += dtMs;
          stand(4 + (Math.floor(this.walkAt / 83) % 8));
        } else if (tired) stand(45 + (Math.floor(now / 500) % 2));
        else stand(Math.floor(now / 250) % 4);
        break;
      }
      case 'walk': {
        const target = WALK.max;
        const step = (SPEED * dtMs) / 1000;
        this.flip = target < this.x;
        if (Math.abs(target - this.x) <= step) {
          this.x = target;
          this.flip = false;
          this.enter('sit', now);
          stand(15);
        } else {
          this.x += Math.sign(target - this.x) * step;
          this.walkAt += dtMs;
          stand(4 + (Math.floor(this.walkAt / 83) % 8));
        }
        break;
      }
      case 'sit':
        stand(15);
        if (done) this.enter('lie', now);
        break;
      case 'lie':
      case 'doze':
      case 'fadeOut':
      case 'black':
      case 'fadeIn':
        lie();
        this.blanket
          .setVisible(true)
          .setFrame(`blanket_${Math.floor(now / 700) % 2}`);
        if (this.phase !== 'lie') this.drawZzz(now);
        if (this.phase === 'fadeOut') fadeLevel = Math.min(16, Math.floor((t / 1000) * 17));
        if (this.phase === 'black') fadeLevel = 16;
        if (this.phase === 'fadeIn') fadeLevel = Math.max(0, 16 - Math.floor((t / 1000) * 17));
        if (done)
          this.enter(
            this.phase === 'lie'
              ? 'doze'
              : this.phase === 'doze'
                ? 'fadeOut'
                : this.phase === 'fadeOut'
                  ? 'black'
                  : this.phase === 'black'
                    ? 'fadeIn'
                    : 'wake',
            now,
          );
        break;
      case 'wake':
        // Se incorpora: primero sentado al borde, luego de pie.
        if (t < 300) {
          lie();
          this.blanket.setVisible(true).setFrame('blanket_0');
        } else stand(15);
        if (done) this.enter('stretch', now);
        break;
      case 'stretch':
        // Estiramiento al despertar (brazo en alto).
        stand(t < 450 ? 28 : 0);
        if (done) this.enter('idle', now);
        break;
    }
    // Comer o beber: el alimento sube de la mano a la boca.
    const eating = now < this.eatUntil && this.phase === 'idle' && this.eatKind;
    this.held.setVisible(!!eating);
    if (eating) {
      const p = 1 - (this.eatUntil - now) / 800;
      const dx = this.flip ? -1 : 1;
      this.held
        .setFrame(`${this.eatKind}_hand`)
        .setFlipX(this.flip)
        .setPosition(
          Math.round(this.x + dx * (p < 0.3 ? 6 : 4)),
          FLOOR - (p < 0.3 ? 10 : 17) + (p > 0.4 && Math.floor(now / 120) % 2 ? 1 : 0),
        );
    }
    this.fade.setVisible(fadeLevel > 0).setFrame(fadeLevel);
    this.caption.setVisible(this.phase === 'black');
    if (this.phase === 'black') {
      const text = t < 700 ? 'DURMIENDO...' : this.wokeText;
      this.caption.setText(text).setX(Math.round((VIEW.width - text.length * 6) / 2));
    }
  }

  /** «Z» pequeñas que suben desde la almohada, en píxeles de la paleta. */
  private drawZzz(now: number): void {
    const g = this.zzz;
    for (let k = 0; k < 3; k++) {
      const age = ((now / 1000 + k * 0.6) % 1.8) / 1.8;
      const x = Math.round(BED.x + BED.w - 18 + age * 10 + k);
      const y = Math.round(FLOOR - 30 - age * 22);
      const s = age < 0.35 ? 2 : 3;
      g.fillStyle(age > 0.7 ? P.silver : P.cream);
      g.fillRect(x, y, s, 1).fillRect(x, y + s - 1, s, 1);
      g.fillRect(x + s - 2, y + 1, 1, Math.max(1, s - 2));
    }
  }

  /** Cielo de la ventana con la hora real del reloj (sol, luna, estrellas). */
  private drawSky(day: DayNightCycle): void {
    const s = day.sunStrength;
    const band = s > 0.7 ? 'day' : s > 0.3 ? 'dusk' : 'night';
    const sun = day.sun,
      moon = day.moon;
    const key = `${band}:${sun.visible ? Math.round(sun.x / 40) : 'x'}:${moon.visible ? Math.round(moon.x / 40) : 'x'}`;
    if (key === this.skyKey) return;
    this.skyKey = key;
    const g = this.sky.clear();
    const x0 = 210,
      y0 = 77,
      w = 60,
      h = 41;
    const [top, low] =
      band === 'day'
        ? [P.desertSky, P.blue]
        : band === 'dusk'
          ? [P.duskViolet, P.desertSunset]
          : [P.desertNight, P.indigo];
    g.fillStyle(top).fillRect(x0, y0, w, h);
    g.fillStyle(low).fillRect(x0, y0 + 24, w, h - 24);
    if (band === 'night')
      for (let i = 0; i < 14; i++)
        g.fillStyle(i % 3 ? P.steel : P.silver).fillRect(
          x0 + ((i * 37) % w),
          y0 + ((i * 17) % 22),
          1,
          1,
        );
    const body = sun.visible && band !== 'night' ? sun : moon.visible ? moon : null;
    if (body) {
      const bx = x0 + Math.round((body.x / VIEW.width) * w),
        by = y0 + 6 + Math.round(((body.y - 41) / 96) * 14);
      g.fillStyle(body === sun ? P.gold : P.silver).fillRect(bx - 2, by - 2, 5, 5);
      g.fillStyle(body === sun ? P.cream : P.white).fillRect(bx - 1, by - 1, 3, 3);
    }
    // Cerros rojos lejanos en el borde inferior.
    g.fillStyle(band === 'night' ? P.plum : P.desertMountain);
    for (let i = 0; i < w; i++) {
      const hill = 5 + Math.round(3 * Math.sin(i / 7) + 2 * Math.sin(i / 3));
      g.fillRect(x0 + i, y0 + h - hill, 1, hill);
    }
  }
}
