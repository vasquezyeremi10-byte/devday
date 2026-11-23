import Phaser from 'phaser';
import { DEPTH } from '../../config/layers';
import { PALETTE as P } from '../../config/palette';
import type { LightSource } from '../Scenery';
import { buildParts, type Part } from './PartsTexture';
import { createFloraParts } from './Flora';

/**
 * Cabaña minera V8 (rediseño 11 de noviembre de 2026). Sustituye al pabellón
 * de tablas: cabaña habitada de madera cálida, techo a dos aguas de tejas
 * violetas con polvo de caliche, frontón con ventanuco, chimenea de ladrillos
 * con humo animado, porche con escalones, farol colgante, silla mecedora,
 * barril, picota y caja con cristales, rocas y matas del desierto.
 *
 * Todo por piezas (como la bodega y el antiguo pabellón): nada de imagen
 * única ni filtros; píxeles enteros, colores planos de la paleta, alfa 0/255,
 * contorno de tinta de 1 px y luz desde arriba a la izquierda. Los cuadros
 * con «window» o «lantern» en el nombre no se tiñen de noche (NightTint).
 *
 * La puerta se mantiene centrada en el mismo x del mundo (CAMP_LAYOUT.doorX):
 * la interacción, el interior y la secuencia de introducción no cambian.
 */

/** Ancho del muro; el techo sobresale 12 px por lado (parte de 152 px). */
const WALL_W = 128;
/** Altura del porche sobre el suelo y del muro sobre el porche. */
const PORCH_H = 14;
const WALL_H = 40;
/** Techo: 54 px de alto desde la cumbrera a la tabla del alero. */
const ROOF_W = 152;
const ROOF_H = 54;
const RIDGE_X = 76;
const RIDGE_Y = 8;
const EAVES_Y = 42;

/** Pseudoaleatorio determinista en [0, 1) para vaivén y bocanadas. */
const jitter = (n: number): number => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

/** Altura de la falda del techo para cada x local del cuadro del techo. */
const slopeY = (x: number): number =>
  RIDGE_Y + Math.round((Math.abs(x - RIDGE_X) * (EAVES_Y - RIDGE_Y)) / RIDGE_X);
/** Bordes del frontón de madera (triángulo interior de (76,12) a (40,42)). */
const gableLeft = (y: number): number => RIDGE_X - (y - 12) * 1.2;
const gableRight = (y: number): number => RIDGE_X + (y - 12) * 1.2;

/** Porche: tablón superior, canto frontal, pilares y piedras de cimentación. */
const porchPart: Part = {
  name: 'hb_porch',
  w: WALL_W,
  h: PORCH_H,
  draw(b) {
    b.rect(0, 0, WALL_W, 1, P.ink);
    // Tablones largos con juntas cada 16 px.
    for (let x = 0; x < WALL_W; x += 16) {
      b.rect(x, 1, 16, 4, x % 32 === 0 ? P.loam : P.clay);
      b.rect(x, 1, 16, 1, P.ochre);
      b.rect(x, 4, 16, 1, P.soil);
      b.px(x + 2, 2, P.peach);
      b.rect(x + 15, 1, 1, 5, P.ink);
    }
    // Canto frontal del tablón.
    b.rect(0, 5, WALL_W, 2, P.umber);
    // Bajo el porche: sombra con pilares de apoyo.
    b.rect(0, 7, WALL_W, 7, P.night);
    b.dither(0, 7, WALL_W, 7, P.umber, 1);
    for (const x of [6, 117]) {
      b.rect(x, 7, 5, 7, P.ink);
      b.rect(x + 1, 7, 3, 7, P.earth);
      b.rect(x + 1, 7, 1, 7, P.clay);
    }
    // Piedras bajo los extremos.
    for (const x of [0, 121]) {
      b.rect(x, 9, 7, 5, P.ink);
      b.rect(x + 1, 9, 5, 4, P.taupe);
      b.rect(x + 1, 9, 5, 1, P.khaki);
      b.px(x + 2, 12, P.plum);
      b.px(x + 4, 11, P.stone);
    }
  },
};

/** Escalones de madera hasta el tablón (el porche es el tercer nivel). */
const stepsPart: Part = {
  name: 'hb_steps',
  w: 36,
  h: PORCH_H,
  draw(b) {
    b.rect(8, 0, 20, 1, P.ink);
    b.rect(8, 1, 20, 3, P.loam);
    b.rect(8, 1, 20, 1, P.ochre);
    b.rect(8, 3, 20, 1, P.soil);
    b.rect(4, 4, 28, 1, P.ink);
    b.rect(4, 5, 28, 3, P.clay);
    b.rect(4, 5, 28, 1, P.ochre);
    b.rect(4, 7, 28, 1, P.soil);
    b.rect(0, 8, 36, 1, P.ink);
    b.rect(0, 9, 36, 4, P.soil);
    b.rect(0, 9, 36, 1, P.clay);
    b.rect(0, 12, 36, 2, P.umber);
    // Esquineros metálicos.
    for (const [x, y] of [
      [4, 4],
      [31, 4],
      [0, 8],
      [35, 8],
    ] as const) {
      b.px(x, y, P.silver);
      b.px(x, y + 1, P.steel);
    }
  },
};

/** Muro de troncos horizontales con postes y placas metálicas en esquinas. */
const wallPart: Part = {
  name: 'hb_wall',
  w: WALL_W,
  h: WALL_H,
  draw(b) {
    for (let y = 0, i = 0; y < WALL_H; y += 7, i++) {
      const body = [P.clay, P.loam, P.soil, P.clay, P.loam][i % 5]!;
      b.rect(0, y, WALL_W, 7, body);
      b.rect(0, y, WALL_W, 1, P.ochre);
      b.rect(0, y + 6, WALL_W, 1, P.umber);
      // Vetas y nudos.
      for (let k = 0; k < 3; k++)
        b.px(
          14 + ((i * 37 + k * 53) % 98),
          y + 2 + ((k * 5 + i) % 4),
          i % 2 ? P.earth : P.umber,
        );
    }
    // Tapajuntas verticales con clavos.
    for (let x = 31; x < WALL_W; x += 32) {
      b.rect(x, 0, 1, WALL_H, P.umber);
      b.px(x, 5, P.silver);
      b.px(x, 33, P.silver);
    }
    // Postes de esquina con placa metálica remachada.
    for (const x of [0, 122]) {
      b.rect(x, 0, 6, WALL_H, P.clay);
      b.rect(x, 0, 1, WALL_H, P.ochre);
      b.rect(x + 5, 0, 1, WALL_H, P.umber);
      b.rect(x + 1, 5, 4, 9, P.stone);
      b.rect(x + 1, 5, 4, 1, P.silver);
      b.px(x + 1, 5, P.silver);
      b.px(x + 4, 13, P.silver);
      b.rect(x + 1, 28, 4, 7, P.stone);
      b.rect(x + 1, 28, 4, 1, P.silver);
      b.px(x + 4, 34, P.silver);
    }
    // Sombra del alero.
    b.rect(0, 0, WALL_W, 1, P.ink);
    b.rect(0, 1, WALL_W, 1, P.umber);
    b.dither(0, 2, WALL_W, 2, P.umber);
  },
};

/** Puerta de tablas con bandas metálicas, remaches y anillo. */
const doorPart: Part = {
  name: 'hb_door',
  w: 18,
  h: 28,
  draw(b) {
    b.rect(0, 0, 18, 28, P.ink);
    b.rect(1, 1, 16, 27, P.clay);
    b.rect(1, 1, 16, 1, P.ochre);
    b.rect(1, 1, 1, 27, P.loam);
    b.rect(16, 1, 1, 27, P.umber);
    for (let x = 3; x < 15; x += 3) {
      b.rect(x, 2, 3, 26, x === 3 || x === 9 ? P.loam : P.clay);
      b.rect(x, 2, 1, 26, P.earth);
    }
    // Bandas metálicas con remaches.
    for (const y of [6, 18]) {
      b.rect(1, y, 16, 3, P.ink);
      b.rect(2, y, 14, 1, P.silver);
      b.rect(2, y + 1, 14, 1, P.steel);
      b.rect(2, y + 2, 14, 1, P.stone);
      for (const x of [3, 14]) b.px(x, y + 1, P.white);
    }
    // Bisagras a la izquierda.
    for (const y of [4, 22]) {
      b.rect(1, y, 2, 3, P.steel);
      b.px(1, y, P.silver);
    }
    // Anillo de la manilla.
    b.rect(11, 13, 3, 1, P.silver);
    b.rect(11, 14, 1, 3, P.silver);
    b.rect(13, 14, 1, 3, P.silver);
    b.rect(11, 17, 3, 1, P.silver);
    b.px(12, 15, P.night);
  },
};

/** Ventana encendida: vidrio cálido con siluetas de plantas. Variante A. */
const windowPart = (variant: 0 | 1): Part => ({
  name: variant === 0 ? 'hb_window' : 'hb_window_alt',
  w: 22,
  h: 18,
  draw(b) {
    b.rect(0, 0, 22, 18, P.ink);
    b.rect(1, 1, 20, 14, P.earth);
    b.rect(1, 1, 20, 1, P.ochre);
    b.rect(1, 1, 1, 14, P.loam);
    b.rect(20, 1, 1, 14, P.umber);
    b.rect(3, 3, 16, 10, P.ember);
    // Vidrio encendido: alguien vive aquí, de día y de noche.
    b.rect(4, 4, 14, 8, P.gold);
    b.rect(4, 4, 14, 2, P.cream);
    if (variant === 0) {
      // Dos matas de interior en silueta.
      for (const x of [5, 13]) {
        b.rect(x, 9, 3, 3, P.orange);
        b.px(x, 8, P.orange);
        b.px(x + 1, 8, P.ember);
        b.px(x + 2, 7, P.orange);
      }
      b.px(6, 6, P.cream);
    } else {
      // Variante: una mata grande y brillo desplazado.
      b.rect(6, 7, 4, 5, P.orange);
      b.px(6, 6, P.orange);
      b.px(7, 6, P.ember);
      b.px(9, 5, P.orange);
      b.rect(14, 10, 3, 2, P.orange);
      b.px(15, 5, P.cream);
    }
    // Travesaños en cruz.
    b.rect(10, 4, 2, 8, P.earth);
    b.rect(4, 7, 14, 1, P.earth);
    // Alféizar.
    b.rect(0, 15, 22, 3, P.ink);
    b.rect(1, 15, 20, 2, P.loam);
    b.rect(1, 15, 20, 1, P.ochre);
  },
});

/** Ventanuco del frontón: vidrio oscuro de desván con reflejo tenue. */
const gableWindowPart: Part = {
  name: 'hb_gablewin',
  w: 14,
  h: 16,
  draw(b) {
    b.rect(0, 0, 14, 14, P.ink);
    b.rect(1, 1, 12, 12, P.earth);
    b.rect(1, 1, 12, 1, P.ochre);
    b.rect(1, 1, 1, 12, P.loam);
    b.rect(12, 1, 1, 12, P.umber);
    b.rect(3, 3, 8, 8, P.indigo);
    b.rect(3, 3, 8, 2, P.dusk);
    b.px(4, 4, P.mist);
    b.line(5, 10, 9, 6, P.stone);
    b.rect(6, 3, 2, 8, P.earth);
    b.rect(3, 7, 8, 1, P.earth);
    // Alféizar.
    b.rect(0, 14, 14, 2, P.ink);
    b.rect(1, 14, 12, 1, P.loam);
  },
};

/** Techo: faldas de tejas violetas, frontón de madera con vigas, cumbrera con
 * remate circular de tronco, musgo y banda colgante sobre el porche. */
const roofPart: Part = {
  name: 'hb_roof',
  w: ROOF_W,
  h: ROOF_H,
  draw(b) {
    // 1) Frontón: tablones horizontales dentro del triángulo.
    for (let y = 12; y < EAVES_Y; y++) {
      const l = Math.round(gableLeft(y)),
        r = Math.round(gableRight(y));
      const band = (y - 12) % 6;
      const body = [P.clay, P.loam, P.soil, P.loam, P.clay][
        Math.floor((y - 12) / 6) % 5
      ]!;
      for (let x = Math.max(0, l); x <= Math.min(ROOF_W - 1, r); x++)
        b.px(x, y, band === 0 ? P.ink : band === 1 ? P.ochre : body);
    }
    // 2) Vigas de arista del frontón (3 px a cada lado).
    for (let y = 12; y < EAVES_Y; y++)
      for (const side of [-1, 1]) {
        const e = Math.round(RIDGE_X + side * (y - 12) * 1.2);
        for (let x = e - 2; x <= e + 2; x++)
          if (x >= 0 && x < ROOF_W)
            b.px(x, y, x === e - 2 ? P.ink : x < e ? P.peach : P.clay);
      }
    // 3) Tejas: toda la silueta salvo el frontón y sus vigas.
    for (let x = 0; x < ROOF_W; x++) {
      const y0 = slopeY(x);
      for (let y = y0; y < EAVES_Y; y++) {
        if (y >= 12 && x > gableLeft(y) - 3 && x < gableRight(y) + 3) continue;
        const left = x < RIDGE_X;
        const row = Math.floor((y - y0) / 4);
        const alt = (Math.floor(x / 8) + row * (left ? 0 : 1)) % 2 === 0;
        const band = (y - y0) % 4;
        let c: number = left ? (alt ? P.violet : P.mauve) : alt ? P.dusk : P.indigo;
        if (band === 0) c = left ? P.silver : P.steel;
        else if (band === 3) c = left ? P.dusk : P.night;
        b.px(x, y, c);
        // Irregularidades claras del polvo sobre las tejas.
        if ((x * 7 + y * 13) % 47 < 2 && y > y0 + 2)
          b.px(x, y, (x + y) % 2 ? P.khaki : P.taupe);
      }
    }
    // 4) Cumbrera y remate circular de tronco en la cima.
    b.rect(RIDGE_X - 8, 6, 17, 3, P.ink);
    b.rect(RIDGE_X - 7, 6, 15, 1, P.mauve);
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -5; dx <= 5; dx++)
        if (dx * dx + dy * dy <= 20)
          b.px(
            RIDGE_X + dx,
            4 + dy,
            dx * dx + dy * dy <= 8 ? P.earth : P.clay,
          );
    b.rect(RIDGE_X - 4, 2, 3, 1, P.ochre);
    b.px(RIDGE_X + 3, 5, P.peach);
    b.px(RIDGE_X - 2, 6, P.umber);
    // 5) Banda colgante del alero: fila de tejas y tabla frontal.
    for (let x = 0; x < ROOF_W; x++) {
      const left = x < RIDGE_X;
      const alt = Math.floor(x / 8) % 2 === 0;
      for (let y = EAVES_Y; y < 48; y++)
        b.px(
          x,
          y,
          left ? (alt ? P.violet : P.mauve) : alt ? P.dusk : P.indigo,
        );
      if (x % 8 === 0) b.px(x, 48, P.ink);
    }
    b.rect(0, 48, ROOF_W, 1, P.ink);
    b.rect(0, 49, ROOF_W, 4, P.clay);
    b.rect(0, 49, ROOF_W, 1, P.ochre);
    b.rect(0, 52, ROOF_W, 1, P.umber);
    b.rect(0, 53, ROOF_W, 1, P.ink);
  },
};

/** Chimenea de ladrillos con sombrerete y boca abierta. */
const chimneyPart: Part = {
  name: 'hb_chimney',
  w: 18,
  h: 34,
  draw(b) {
    b.rect(0, 0, 18, 3, P.ink);
    b.rect(1, 1, 16, 2, P.stone);
    b.px(1, 1, P.silver);
    b.px(16, 1, P.silver);
    // Boca abierta.
    b.rect(2, 3, 14, 4, P.ink);
    b.rect(3, 4, 12, 2, P.night);
    // Columna de ladrillos con juntas escalonadas.
    b.rect(1, 7, 16, 27, P.rust);
    for (let y = 7; y < 34; y += 5) {
      b.rect(1, y, 16, 1, P.ember);
      const off = ((y - 7) / 5) % 2 ? 3 : 0;
      for (let x = off; x < 16; x += 6) b.rect(1 + x, y + 1, 1, 4, P.night);
      b.px(3 + ((y / 5) % 2), y + 1, P.red);
      b.px(13 - ((y / 5) % 2), y + 3, P.mauve);
    }
    b.rect(1, 7, 1, 27, P.red);
    b.rect(16, 7, 1, 27, P.ember);
  },
};

/** Bocanadas de humo gris violeta: nace oscura, crece, aclara y se disuelve.
 * Sin alfa parcial: la última fase se deshace con trama. */
const smokePart = (f: 0 | 1 | 2 | 3): Part => ({
  name: `hb_smoke_${f}`,
  w: 22,
  h: 22,
  draw(b) {
    // Crecimiento y desplazamiento por fase (el viento va a la izquierda).
    const cx = 11 - f * 2,
      cy = 18 - f * 4,
      r = 3 + f * 2;
    const body = f < 2 ? P.plum : P.mauve;
    const light = f < 2 ? P.mauve : P.silver;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const d = dx * dx + dy * dy;
        if (d > r * r) continue;
        // La última fase se disuelve en puntitos.
        if (f === 3 && (dx + dy + 5) % 2 === 0) continue;
        b.px(
          cx + dx + (f > 1 && dy < 0 ? 1 : 0),
          cy + dy,
          dy < -r / 2 ? light : body,
        );
      }
    // Brillo interno de la nube.
    if (f < 3) b.px(cx + 1, cy - 1, light);
  },
});

/** Ménsula y gancho del farol bajo el alero. */
const hookPart: Part = {
  name: 'hb_hook',
  w: 14,
  h: 8,
  draw(b) {
    b.rect(0, 0, 14, 2, P.ink);
    b.rect(1, 0, 12, 1, P.umber);
    b.rect(6, 2, 2, 4, P.ink);
    b.rect(6, 2, 1, 4, P.steel);
    b.rect(5, 5, 4, 2, P.ink);
    b.rect(6, 5, 2, 2, P.silver);
  },
};

/** Silla mecedora con manta roja; dos fases de vaivén muy sutil. */
const chairPart = (rocked: boolean): Part => ({
  name: rocked ? 'hb_chair_1' : 'hb_chair_0',
  w: 22,
  h: 22,
  draw(b) {
    const tilt = rocked ? 1 : 0;
    // Respaldo con manta.
    b.rect(3 + tilt, 2, 7, 13, P.ink);
    b.rect(4 + tilt, 3, 5, 11, P.clay);
    b.rect(4 + tilt, 3, 1, 11, P.ochre);
    // Manta roja con flecos sobre el respaldo.
    b.rect(3 + tilt, 3, 7, 5, P.red);
    b.rect(3 + tilt, 3, 7, 1, P.rust);
    for (const y of [5, 7]) b.rect(4 + tilt, y, 5, 1, P.rust);
    for (const x of [4, 6, 8]) b.px(x + tilt, 8, P.cream);
    // Asiento y patas.
    b.rect(3, 14, 15, 3, P.ink);
    b.rect(4, 14, 13, 2, P.loam);
    b.rect(4, 14, 13, 1, P.ochre);
    for (const x of [4, 14]) {
      b.rect(x, 17, 2, 3, P.ink);
      b.rect(x, 17, 1, 3, P.clay);
    }
    // Brazo con poste delantero.
    b.rect(9, 10, 9, 2, P.ink);
    b.rect(10, 10, 7, 1, P.clay);
    b.rect(16, 12, 2, 3, P.ink);
    b.rect(16, 12, 1, 3, P.ochre);
    // Patines curvos.
    b.line(1, 20, 8, 19, P.umber);
    b.line(8, 19, 20, 20, P.umber);
    b.line(1, 21, 8, 20, P.ink);
    b.line(8, 20, 20, 21, P.ink);
  },
});

/** Tocón con jarro de hojalata junto a la silla. */
const stumpPart: Part = {
  name: 'hb_stump',
  w: 14,
  h: 9,
  draw(b) {
    b.rect(2, 0, 10, 3, P.ink);
    b.rect(3, 1, 8, 2, P.ochre);
    b.px(5, 1, P.clay);
    b.px(8, 2, P.clay);
    b.rect(3, 3, 8, 5, P.clay);
    b.rect(3, 3, 1, 5, P.loam);
    b.rect(10, 3, 1, 5, P.umber);
    b.rect(2, 7, 10, 2, P.umber);
    // Jarro.
    b.rect(11, 3, 3, 4, P.ink);
    b.rect(12, 4, 1, 3, P.silver);
    b.px(13, 4, P.steel);
  },
};

/** Barril de duelas con aros. */
const barrelPart: Part = {
  name: 'hb_barrel',
  w: 16,
  h: 21,
  draw(b) {
    b.rect(1, 3, 14, 18, P.ink);
    b.rect(2, 4, 12, 15, P.clay);
    b.rect(2, 4, 12, 1, P.loam);
    for (let x = 4; x < 14; x += 3) b.rect(x, 4, 1, 15, P.soil);
    b.rect(2, 7, 12, 2, P.steel);
    b.rect(2, 7, 12, 1, P.silver);
    b.rect(2, 14, 12, 2, P.steel);
    b.rect(2, 14, 12, 1, P.silver);
    b.rect(2, 17, 12, 2, P.ember);
  },
};

/** Caja de herramientas con cristales violeta dentro. */
const cratePart: Part = {
  name: 'hb_crate',
  w: 26,
  h: 22,
  draw(b) {
    // Tres puntas de cristal asomando.
    b.rect(7, 4, 2, 6, P.violet);
    b.px(7, 4, P.mauve);
    b.px(8, 3, P.silver);
    b.rect(11, 2, 3, 8, P.violet);
    b.px(11, 2, P.mauve);
    b.px(12, 2, P.silver);
    b.px(13, 5, P.duskViolet);
    b.rect(17, 5, 2, 5, P.duskViolet);
    b.px(17, 5, P.mauve);
    // Caja con tapas en X.
    b.rect(0, 9, 26, 13, P.ink);
    b.rect(1, 10, 24, 11, P.clay);
    b.rect(1, 10, 24, 1, P.ochre);
    b.rect(1, 10, 3, 11, P.loam);
    b.rect(22, 10, 3, 11, P.loam);
    b.line(4, 12, 21, 20, P.soil);
    b.line(21, 12, 4, 20, P.soil);
    b.line(4, 13, 21, 21, P.umber);
    b.line(21, 13, 4, 21, P.umber);
    b.rect(0, 20, 26, 2, P.umber);
  },
};

/** Picota apoyada en el poste derecho. */
const pickPart: Part = {
  name: 'hb_pick',
  w: 10,
  h: 28,
  draw(b) {
    b.rect(4, 4, 3, 24, P.ink);
    b.rect(4, 4, 1, 24, P.ochre);
    b.rect(6, 4, 1, 24, P.soil);
    // Cabeza de acero con puntas curvadas.
    b.rect(0, 2, 10, 2, P.ink);
    b.rect(1, 3, 8, 2, P.silver);
    b.rect(1, 3, 8, 1, P.white);
    b.px(0, 5, P.steel);
    b.px(9, 5, P.steel);
    b.px(0, 6, P.ink);
    b.px(9, 6, P.ink);
  },
};

/** Rocas de cimentación con sombras violáceas. */
const rocksPart: Part = {
  name: 'hb_rocks',
  w: 28,
  h: 10,
  draw(b) {
    b.rect(2, 2, 14, 8, P.ink);
    b.rect(3, 3, 12, 6, P.taupe);
    b.rect(3, 3, 12, 1, P.khaki);
    b.rect(3, 8, 12, 1, P.plum);
    b.px(6, 5, P.stone);
    b.px(11, 6, P.stone);
    b.rect(17, 5, 10, 5, P.ink);
    b.rect(18, 5, 8, 4, P.stone);
    b.rect(18, 5, 8, 1, P.khaki);
    b.px(22, 7, P.taupe);
  },
};

const CABIN_PARTS: Part[] = [
  porchPart,
  stepsPart,
  wallPart,
  doorPart,
  windowPart(0),
  windowPart(1),
  gableWindowPart,
  roofPart,
  chimneyPart,
  ...([0, 1, 2, 3] as const).map(smokePart),
  hookPart,
  chairPart(false),
  chairPart(true),
  stumpPart,
  barrelPart,
  cratePart,
  pickPart,
  rocksPart,
];

/** Montaje: x local (0 = borde izquierdo del muro) y altura sobre el suelo. */
interface Placement {
  part: string;
  x: number;
  bottom: number;
  flip?: boolean;
}

/** Orden de dibujo: las últimas piezas quedan delante. */
const CABIN: Placement[] = [
  { part: 'hb_rocks', x: -10, bottom: 0 },
  { part: 'hb_rocks', x: 148, bottom: 0, flip: true },
  { part: 'hb_porch', x: 0, bottom: 0 },
  { part: 'hb_steps', x: 44, bottom: 0 },
  { part: 'hb_wall', x: 0, bottom: PORCH_H },
  { part: 'hb_door', x: 52, bottom: PORCH_H },
  { part: 'hb_window', x: 12, bottom: PORCH_H + 16 },
  { part: 'hb_window_alt', x: 86, bottom: PORCH_H + 16 },
  { part: 'hb_roof', x: -12, bottom: 50 },
  // El ventanuco y la chimenea van tras el techo: el frontón y la falda
  // derecha no deben taparlos (solo sus bases quedan tras la falda).
  { part: 'hb_gablewin', x: 56, bottom: 66 },
  { part: 'hb_chimney', x: 104, bottom: 70 },
  { part: 'hb_hook', x: 38, bottom: 50 },
  { part: 'hb_chair_0', x: 8, bottom: PORCH_H },
  { part: 'hb_stump', x: 31, bottom: PORCH_H },
  { part: 'hb_barrel', x: 72, bottom: PORCH_H },
  { part: 'hb_crate', x: 90, bottom: PORCH_H },
  { part: 'hb_pick', x: 118, bottom: PORCH_H },
];

/** Bocanada de humo en vuelo. */
interface Puff {
  sprite: Phaser.GameObjects.Sprite;
  life: number;
  total: number;
}

/**
 * Cabaña animada: humo de chimenea, ventanas que titilan, farol con vaivén,
 * cachiyuyos al viento y silla mecedora ocasional. La estructura queda fija.
 */
export class CabinSite {
  readonly lights: LightSource[] = [];
  private readonly windows: Phaser.GameObjects.Image[] = [];
  private readonly shrubs: Phaser.GameObjects.Image[] = [];
  private readonly chair!: Phaser.GameObjects.Image;
  private readonly lantern: Phaser.GameObjects.Image;
  private readonly puffs: Puff[] = [];
  private elapsed = 0;
  private nextPuff = 700;
  private nextWindow = 4200;
  private nextShrub = 2800;
  private nextChair = 6400;
  private chairUntil = 0;
  private puffCount = 0;

  constructor(private readonly scene: Phaser.Scene) {
    buildParts(scene, 'cabin', CABIN_PARTS);
    createFloraParts(scene);
    const cabinX = -360;
    const groundY = 160;
    const cabin = scene.add
      .container(cabinX, groundY)
      .setDepth(DEPTH.structures - 1);
    for (const p of CABIN) {
      const img = scene.add
        .image(p.x, -p.bottom, 'cabin', p.part)
        .setOrigin(0, 1);
      if (p.flip) img.setFlipX(true);
      cabin.add(img);
      if (p.part.startsWith('hb_window')) this.windows.push(img);
      if (p.part === 'hb_chair_0') this.chair = img;
    }
    for (const [x, flip] of [[-10, false], [142, true]] as const) {
      const shrub = scene.add.image(x, 0, 'flora', 'cachiyuyo').setOrigin(0, 1).setFlipX(flip);
      shrub.setX(x - Math.floor(shrub.width / 2));
      cabin.add(shrub);
      this.shrubs.push(shrub);
    }
    // Farol colgante del gancho: su vaivén es de 1 px, puro en la retícula.
    this.lantern = scene.add
      .sprite(45, -50, 'warehouse', 'wh_lantern_0')
      .setOrigin(0.5, 0)
      .play('wh-lantern');
    cabin.add(this.lantern);
    this.lights.push({
      x: cabinX + 45,
      y: groundY - 40,
      radius: 18,
      kind: 'decor',
      flicker: true,
    });
    // Ventanas: luz cálida solo de noche, con titileo sutil.
    for (const x of [23, 97])
      this.lights.push({
        x: cabinX + x,
        y: groundY - 30,
        radius: 22,
        kind: 'decor',
        nightOnly: true,
        flicker: true,
      });
  }

  /** Humo, titileo y vaivén; el mundo corre (delta ya escalado). */
  update(dtMs: number): void {
    this.elapsed += dtMs;
    // Humo: bocanadas espaciadas con jitter; suben, derivan y se disuelven.
    this.nextPuff -= dtMs;
    if (this.nextPuff <= 0 && this.puffs.length < 5) {
      const sprite = this.scene.add.sprite(113, -97, 'cabin', 'hb_smoke_0');
      sprite.setOrigin(0.5, 1);
      this.chair.parentContainer!.add(sprite);
      this.puffs.push({
        sprite,
        life: 0,
        total: 3800 + jitter(this.puffCount++) * 1400,
      });
      this.nextPuff = 950 + jitter(this.puffCount) * 750;
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const puff = this.puffs[i]!;
      puff.life += dtMs;
      const t = puff.life / puff.total;
      if (t >= 1) {
        puff.sprite.destroy();
        this.puffs.splice(i, 1);
        continue;
      }
      puff.sprite.setFrame(`hb_smoke_${Math.min(3, Math.floor(t * 4))}`);
      puff.sprite.setPosition(113 - t * 12, -97 - t * 46);
    }
    // Ventanas: variación natural entre dos fases encendidas.
    this.nextWindow -= dtMs;
    if (this.nextWindow <= 0) {
      const alt = this.windows[0]!.frame.name === 'hb_window';
      for (const [i, w] of this.windows.entries())
        w.setFrame(alt !== (i % 2 === 1) ? 'hb_window' : 'hb_window_alt');
      this.nextWindow = 3400 + jitter(this.elapsed) * 2600;
    }
    // Cachiyuyos al viento.
    this.nextShrub -= dtMs;
    if (this.nextShrub <= 0) {
      const sway = this.shrubs[0]!.frame.name === 'cachiyuyo';
      for (const [i, shrub] of this.shrubs.entries())
        shrub.setFrame(sway !== (i % 2 === 1) ? 'cachiyuyo_w' : 'cachiyuyo');
      this.nextShrub = 2200 + jitter(this.elapsed * 0.7) * 2200;
    }
    // Silla mecedora: mecido breve cada tanto, nadie la mueve.
    this.nextChair -= dtMs;
    if (this.nextChair <= 0) {
      this.chairUntil = this.elapsed + 1400;
      this.nextChair = 6400 + jitter(this.elapsed * 1.3) * 6200;
    }
    this.chair.setFrame(
      this.elapsed < this.chairUntil ? 'hb_chair_1' : 'hb_chair_0',
    );
    // Farol: vaivén de 1 px a paso entero.
    this.lantern.setX(45 + (Math.floor(this.elapsed / 1100) % 2));
  }
}
