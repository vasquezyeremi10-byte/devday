import Phaser from 'phaser';
import { VIEW, TILE_SIZE, WORLD_LEFT, WORLD_WIDTH } from '../config/constants';
import { earthGroup } from '../config/biomes';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import type { DayNightCycle } from '../systems/DayNightCycle';
import type { TerrainGrid } from './TerrainGrid';
import { surfaceRow } from './TerrainGrid';
import {
  LANDSCAPE,
  LANDSCAPE_STRIP,
  SEA_TOP,
  landscapeBounds,
  landscapeColumn,
  type LandscapePlane,
} from './Landscape';

/**
 * Fondo vivo del Atacama (V7). Todo se genera una sola vez como atlas de
 * píxeles de la paleta con alfa 0/255; en cada fotograma solo cambian
 * posiciones y cuadros. Las transiciones de hora usan cuadros intermedios
 * con dithering Bayer 4 × 4 (nunca alfa parcial ni filtros).
 *
 * Capas, de atrás hacia adelante: cielo, estrellas, sol/luna, nubes lejanas,
 * cordillera lejana con volcanes, aves lejanas, nubes cercanas, cerros rojos,
 * lomas con quebradas, dunas y aves cercanas. Las cordilleras descienden en
 * cabos que dejan ver el mar y La Portada. Los monumentos van delante de
 * las dunas (world/Landmarks.ts). La pared subterránea y el terreno tapan
 * todo lo anterior bajo la superficie.
 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hash = (x: number, y: number, seed = 7) => {
  let h = Math.imul(x + seed, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)]!;

/** Cuadros por juego de tonos: noche → tono cálido → día. */
const STEPS = 9;
/**
 * Rampa de cinco colores reales de la paleta: noche, penumbra cálida, hora
 * dorada, tarde y día. Juego 0: amanecer (rosado); juego 1: atardecer
 * (naranja y violeta). Noche y día son iguales en ambos juegos.
 */
type Tones = readonly [
  night: number,
  dusk: number,
  warm: number,
  late: number,
  day: number,
];

/**
 * Color de un cuadro: los pasos pares son colores planos de la rampa; los
 * impares, un tablero 50 % entre dos vecinos parecidos. Nunca se tramea
 * todo el cielo con colores lejanos (no parece un filtro).
 */
function mix(t: Tones, step: number, x: number, y: number): number {
  if (step % 2 === 0) return t[step / 2]!;
  return bayer(x, y) < 8 ? t[(step + 1) / 2]! : t[(step - 1) / 2]!;
}

/** Atlas de cuadros iguales, generado una sola vez. */
function art(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  count: number,
  draw: (
    frame: number,
    pixel: (x: number, y: number, color: number) => void,
  ) => void,
): void {
  if (scene.textures.exists(key)) return;
  const cols = Math.max(1, Math.min(count, Math.floor(1024 / w)));
  const texture = scene.textures.createCanvas(
    key,
    w * cols,
    h * Math.ceil(count / cols),
  )!;
  const ctx = texture.context;
  const data = ctx.createImageData(
    texture.source[0]!.width,
    texture.source[0]!.height,
  );
  const stride = data.width;
  for (let frame = 0; frame < count; frame++) {
    const ox = (frame % cols) * w,
      oy = Math.floor(frame / cols) * h;
    draw(frame, (x, y, color) => {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = ((y + oy) * stride + x + ox) * 4;
      data.data[i] = (color >>> 16) & 255;
      data.data[i + 1] = (color >>> 8) & 255;
      data.data[i + 2] = color & 255;
      data.data[i + 3] = 255;
    });
    texture.add(frame, 0, ox, oy, w, h);
  }
  ctx.putImageData(data, 0, 0);
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/**
 * Cielo por bandas (cénit → horizonte) con bordes dithered de 6 px. Franja
 * de 8 px de ancho que se repite como TileSprite: el patrón Bayer es
 * periódico, así que la textura completa ocupa muy poco.
 */
const SKY_BANDS = [52, 96, 128];
const SKY: readonly (readonly [Tones, Tones])[] = [
  // [amanecer, atardecer] por banda, del cénit al horizonte.
  [
    [P.desertNight, P.indigo, P.dusk, P.azure, P.desertSky],
    [P.desertNight, P.indigo, P.dusk, P.azure, P.desertSky],
  ],
  [
    [P.desertNight, P.indigo, P.violet, P.cobalt, P.desertSky],
    [P.desertNight, P.indigo, P.duskViolet, P.violet, P.desertSky],
  ],
  [
    [P.indigo, P.mauve, P.dawnPink, P.mist, P.blue],
    [P.indigo, P.duskViolet, P.desertSunset, P.peach, P.blue],
  ],
  [
    [P.dusk, P.dawnPink, P.peach, P.cream, P.mist],
    [P.dusk, P.desertSunset, P.orange, P.desertSunset, P.mist],
  ],
];
function makeSky(scene: Phaser.Scene): void {
  art(scene, 'v7-sky', 8, VIEW.height, STEPS * 2, (f, px) => {
    const set = f >= STEPS ? 1 : 0,
      step = f % STEPS;
    for (let y = 0; y < VIEW.height; y++)
      for (let x = 0; x < 8; x++) {
        let band = SKY_BANDS.findIndex((edge) => y < edge);
        if (band < 0) band = SKY_BANDS.length;
        // Borde dithered: los 6 px previos a cada límite mezclan bandas.
        const next = SKY_BANDS[band];
        if (next !== undefined && next - y <= 6 && bayer(x, y) >= (next - y) * 2.6)
          band++;
        px(x, y, mix(SKY[band]![set], step, x, y));
      }
  });
}

/** Sol (alto y bajo) y luna llena con cráteres; halos por puntos dispersos. */
function makeCelestial(scene: Phaser.Scene): void {
  art(scene, 'v7-celestial', 32, 32, 3, (f, px) => {
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const d = Math.hypot(x - 15.5, y - 15.5);
        if (f < 2) {
          const low = f === 1;
          if (d < 7) px(x, y, x + y < 27 ? (low ? P.cream : P.white) : low ? P.gold : P.cream);
          else if (d < 8.5) px(x, y, low ? P.orange : P.gold);
          else if (d < 13 && bayer(x, y) < (13 - d) * 1.6)
            px(x, y, low ? P.desertSunset : P.cream);
        } else if (d < 7) {
          const crater =
            Math.hypot(x - 13, y - 13) < 2 ||
            Math.hypot(x - 18, y - 18) < 1.6 ||
            Math.hypot(x - 17, y - 11) < 1;
          px(x, y, crater ? P.steel : x + y < 29 ? P.white : P.silver);
        } else if (d < 7.8) px(x, y, P.mist);
        else if (d < 11 && bayer(x, y) < 2) px(x, y, P.steel);
      }
  });
}

/**
 * Nubes: cinco siluetas distintas (lóbulos con radios y anchos por semilla),
 * en dos juegos de tonos. Base sombreada, cuerpo y luz arriba-izquierda.
 */
const CLOUD_W = 80,
  CLOUD_H = 24,
  CLOUD_SHAPES = 5;
const CLOUD: readonly [body: [Tones, Tones], shade: [Tones, Tones], lit: [Tones, Tones]] = [
  [
    [P.indigo, P.mauve, P.dawnPink, P.cream, P.white],
    [P.indigo, P.duskViolet, P.peach, P.cream, P.white],
  ],
  [
    [P.desertNight, P.indigo, P.mauve, P.mist, P.mist],
    [P.desertNight, P.plum, P.duskViolet, P.mist, P.mist],
  ],
  [
    [P.dusk, P.dawnPink, P.cream, P.white, P.white],
    [P.dusk, P.desertSunset, P.cream, P.white, P.white],
  ],
];
function makeClouds(scene: Phaser.Scene): void {
  const lobes = Array.from({ length: CLOUD_SHAPES }, (_, s) => {
    const width = 36 + Math.floor(hash(s, 1, 31) * 40);
    const count = 3 + Math.floor(hash(s, 2, 31) * 3);
    return Array.from({ length: count }, (_, k) => {
      const t = (k + 0.5) / count;
      const r = 4 + hash(s, k + 9, 31) * 5 * Math.sin(Math.PI * t) + 2;
      return [4 + t * (width - 8), 19 - r * 0.9, r] as const;
    });
  });
  art(scene, 'v7-clouds', CLOUD_W, CLOUD_H, CLOUD_SHAPES * STEPS * 2, (f, px) => {
    const shape = f % CLOUD_SHAPES,
      rest = Math.floor(f / CLOUD_SHAPES),
      step = rest % STEPS,
      set = rest >= STEPS ? 1 : 0;
    const inside = (x: number, y: number) =>
      y <= 20 &&
      lobes[shape]!.some(
        ([cx, cy, r]) => ((x - cx) / (r * 1.45)) ** 2 + ((y - cy) / r) ** 2 < 1,
      );
    for (let y = 0; y < CLOUD_H; y++)
      for (let x = 0; x < CLOUD_W; x++) {
        if (!inside(x, y)) continue;
        const kind = y > 17 || !inside(x, y + 2) ? 1 : !inside(x - 1, y - 2) ? 2 : 0;
        px(x, y, mix(CLOUD[kind]![set], step, x, y));
      }
  });
}

/**
 * Aves. Cercanas (cuadros 0–6): seis poses de aleteo y una de planeo, con
 * cuerpo, cabeza y cola. Lejanas (7–10): siluetas de 5–7 px que aletean.
 */
function makeBirds(scene: Phaser.Scene): void {
  art(scene, 'v7-birds', 16, 12, 11, (f, px) => {
    if (f < 7) {
      // Altura de la punta del ala y del codo en cada pose.
      const tip = [-4, -2, 1, 3, 1, -2, 0][f]!;
      const elbow = [-2, -1, 0, 1, 0, -1, -1][f]!;
      for (const side of [-1, 1])
        for (let j = 1; j <= 6; j++) {
          const y = 6 + Math.round(j <= 3 ? (elbow * j) / 3 : elbow + ((tip - elbow) * (j - 3)) / 3);
          px(8 + side * j, y, j > 4 ? P.ink : P.desertRock);
          if (j < 4) px(8 + side * j, y + 1, P.earth);
        }
      px(7, 6, P.desertRock); px(8, 6, P.desertRock); px(9, 6, P.desertRock);
      px(7, 7, P.earth); px(8, 7, P.earth);
      px(10, 5, P.desertRock); px(11, 5, P.ink); px(12, 6, P.desertSunset);
      px(5, 7, P.ink); px(4, 7, P.desertRock);
    } else {
      const up = [-2, -1, 1, -1][f - 7]!;
      for (const side of [-1, 1])
        for (let j = 1; j <= 3; j++)
          px(8 + side * j, 6 + Math.round((up * j) / 3), P.desertRock);
      px(8, 6, P.ink);
      px(8, 7, P.desertRock);
    }
  });
}

type RangeTones = readonly [
  lit: [Tones, Tones],
  shade: [Tones, Tones],
  rim: [Tones, Tones],
  detail: [Tones, Tones],
];

const RANGE_TONES: readonly RangeTones[] = [
  [
    [
      [P.dusk, P.mauve, P.dawnPink, P.khaki, P.khaki],
      [P.dusk, P.duskViolet, P.desertSunset, P.peach, P.khaki],
    ],
    [
      [P.indigo, P.plum, P.mauve, P.mauve, P.mauve],
      [P.indigo, P.plum, P.duskViolet, P.mauve, P.mauve],
    ],
    [
      [P.dusk, P.mauve, P.cream, P.silver, P.silver],
      [P.dusk, P.dawnPink, P.peach, P.cream, P.silver],
    ],
    [
      [P.indigo, P.plum, P.mauve, P.taupe, P.taupe],
      [P.indigo, P.plum, P.plum, P.taupe, P.taupe],
    ],
  ],
  [
    [
      [P.indigo, P.plum, P.desertMountain, P.desertMountain, P.desertMountain],
      [P.indigo, P.duskViolet, P.desertSoil, P.desertSoil, P.desertMountain],
    ],
    [
      [P.slate, P.plum, P.plum, P.desertRock, P.desertRock],
      [P.slate, P.plum, P.duskViolet, P.desertRock, P.desertRock],
    ],
    [
      [P.dusk, P.mauve, P.dawnPink, P.desertSoil, P.desertSoil],
      [P.dusk, P.duskViolet, P.desertSunset, P.desertSoil, P.desertSoil],
    ],
    [
      [P.night, P.plum, P.plum, P.desertRock, P.desertRock],
      [P.night, P.plum, P.rust, P.desertRock, P.desertRock],
    ],
  ],
  [
    [
      [P.slate, P.plum, P.desertMountain, P.desertSoil, P.desertSoil],
      [P.slate, P.plum, P.desertSunset, P.desertSoil, P.desertSoil],
    ],
    [
      [P.night, P.slate, P.plum, P.desertMountain, P.desertMountain],
      [P.night, P.plum, P.rust, P.desertMountain, P.desertMountain],
    ],
    [
      [P.stone, P.mauve, P.dawnPink, P.desertSand, P.desertSand],
      [P.stone, P.duskViolet, P.peach, P.desertSand, P.desertSand],
    ],
    [
      [P.ink, P.night, P.desertRock, P.desertRock, P.desertRock],
      [P.ink, P.night, P.ember, P.desertRock, P.desertRock],
    ],
  ],
  [
    [
      [P.dusk, P.mauve, P.sand, P.desertSand, P.desertSand],
      [P.dusk, P.duskViolet, P.peach, P.desertSand, P.desertSand],
    ],
    [
      [P.indigo, P.plum, P.desertMountain, P.desertSoil, P.desertSoil],
      [P.indigo, P.plum, P.desertSoil, P.desertSoil, P.desertSoil],
    ],
    [
      [P.mauve, P.mauve, P.dawnPink, P.cream, P.cream],
      [P.mauve, P.dawnPink, P.cream, P.cream, P.cream],
    ],
    [
      [P.indigo, P.plum, P.desertMountain, P.desertSoil, P.desertSoil],
      [P.indigo, P.plum, P.desertSoil, P.desertSoil, P.desertSoil],
    ],
  ],
];

const SALT_TONES: [Tones, Tones] = [
  [P.steel, P.mauve, P.khaki, P.sand, P.desertSand],
  [P.steel, P.duskViolet, P.peach, P.desertSand, P.desertSand],
];
const pmod = (x: number, period: number) => ((x % period) + period) % period;
const RANGE_MARGIN = 16;

interface LandscapeStrip {
  key: string;
  anchor: number;
  width: number;
  top: number;
  plane: LandscapePlane;
  /** Dibuja la textura si aún no existe (tramos del oeste, a demanda). */
  prepare?: () => void;
}

/**
 * Borde oeste del mundo anterior al mundo abierto (px). Los tramos de
 * cordillera desde aquí al este se dibujan al iniciar, como siempre; los del
 * oeste nuevo, recién cuando la cámara se acerca (BiomeBackdrop los pide): así
 * el arranque no paga el doble de fondo.
 */
const EAGER_LEFT = -120 * TILE_SIZE;

/** Dibuja la misma cordillera a ambos lados del límite de cada textura. */
function makeRange(scene: Phaser.Scene, plane: LandscapePlane, layer: number): LandscapeStrip[] {
  const [first, end] = landscapeBounds(plane);
  const eager = Math.round(EAGER_LEFT * plane.factor) - LANDSCAPE_STRIP;
  const strips: LandscapeStrip[] = [];
  for (let anchor = first; anchor < end; anchor += LANDSCAPE_STRIP) {
    const key = `${plane.key}-${strips.length}`;
    const width = Math.min(LANDSCAPE_STRIP, end - anchor);
    const existing = scene.textures.exists(key) ? scene.textures.get(key).get(0) : undefined;
    if (existing) {
      strips.push({ key, anchor, width, top: plane.bottom - existing.height, plane });
      continue;
    }

    const column = Array.from({ length: width + RANGE_MARGIN * 2 }, (_, x) =>
      landscapeColumn(plane, layer, anchor + x - RANGE_MARGIN),
    );
    const top = Math.floor(Math.min(...column.map((c) => c.crest)));
    const strip: LandscapeStrip = { key, anchor, width, top, plane };
    strips.push(strip);
    const draw = () => drawStrip(scene, strip, layer, column);
    if (anchor + width > eager) draw();
    else
      strip.prepare = () => {
        strip.prepare = undefined;
        draw();
      };
  }
  return strips;
}

/** Textura de un tramo de cordillera (los cuadros de toda la hora del día). */
function drawStrip(
  scene: Phaser.Scene,
  strip: LandscapeStrip,
  layer: number,
  column: ReturnType<typeof landscapeColumn>[],
): void {
  const { key, anchor, width, top, plane } = strip;
  if (scene.textures.exists(key)) return;
  {
    const height = plane.bottom - top;
    const tone = new Int8Array(width * height).fill(-1);
    for (let i = 0; i < width; i++) {
      const x = anchor + i;
      const c = column[i + RANGE_MARGIN]!;
      const crest = Math.round(c.crest);
      const ledge = Math.round(4 * Math.sin(x / 62) + 2 * Math.sin(x / 17));
      const wash = Math.sin(x / 24 + Math.sin(x / 91) * 2);
      const shadowDepth = plane.shadeDepth + Math.round(4 * Math.sin(x / 29));
      const ravineDepth = 9 + c.strata * 25 + Math.sin(x / 33) * 8;
      for (let y = crest; y < plane.bottom; y++) {
        const depth = y - crest;
        // La sombra baja en diagonal por grupos amplios de roca.
        const sample = i + RANGE_MARGIN - Math.min(9, Math.floor(depth / 6));
        const slope = column[sample + 6]!.crest - column[sample - 6]!.crest;
        const shaded = slope > 1.8 && depth < shadowDepth;
        const band = pmod(y + ledge, layer === 3 ? 9 : 15);
        const bed = band < 2 && depth > 4 && wash + c.strata > 0.92;
        const channel = x - Math.round(depth * 0.56 + Math.sin(depth / 8 + ledge) * 2);
        const ravine = (layer === 1 || layer === 2) && depth > 7 &&
          depth < ravineDepth && wash + c.strata > 0.2 && pmod(channel, 43) < 2;
        const salt = layer > 0 && band >= 3 && band <= 5 && depth > 5 &&
          Math.sin((x + y * 1.2) / 22) + c.salt * 1.65 > 1.85;
        const rim = depth === 0 && slope < 3;
        tone[(y - top) * width + i] = rim ? 2 : salt ? 4 : bed || ravine ? 3 : shaded ? 1 : 0;
      }
    }
    const tones = [...RANGE_TONES[layer]!, SALT_TONES];
    art(scene, key, width, height, STEPS * 2, (f, px) => {
      const set = f >= STEPS ? 1 : 0;
      const step = f % STEPS;
      for (let y = 0; y < height; y++)
        for (let i = 0; i < width; i++) {
          const kind = tone[y * width + i]!;
          if (kind >= 0) px(i, y, mix(tones[kind]![set], step, anchor + i, top + y));
        }
    });
  }
}

/**
 * Mar de La Portada (costa): horizonte recto en y = SEA_TOP y agua hasta el
 * pie de la vista, con una franja clara de bruma y crestas de ola en perspectiva.
 * Cubre toda la vista al acercarse a la costa y queda detrás de las cordilleras.
 */
const FAR_PLANE = LANDSCAPE[0]!;
const SEA_FACTOR = FAR_PLANE.factor;
const [SEA_ANCHOR, FAR_END] = landscapeBounds(FAR_PLANE);
const SEA_VISIBLE_FROM = FAR_END - FAR_PLANE.coast[1];
const SEA_WIDTH = Math.round((WORLD_LEFT + WORLD_WIDTH - VIEW.width) * SEA_FACTOR) +
  VIEW.width - SEA_ANCHOR;
const SEA: readonly [horizon: [Tones, Tones], haze: [Tones, Tones], water: [Tones, Tones], crest: [Tones, Tones]] = [
  [
    [P.dusk, P.mauve, P.cream, P.mist, P.mist],
    [P.dusk, P.dawnPink, P.desertSunset, P.mist, P.mist],
  ],
  [
    [P.indigo, P.mauve, P.dawnPink, P.blue, P.blue],
    [P.indigo, P.duskViolet, P.peach, P.blue, P.blue],
  ],
  [
    [P.desertNight, P.indigo, P.violet, P.sky, P.sky],
    [P.desertNight, P.indigo, P.duskViolet, P.sky, P.sky],
  ],
  [
    [P.slate, P.mauve, P.cream, P.mist, P.white],
    [P.slate, P.dawnPink, P.peach, P.mist, P.white],
  ],
];
/** Filas (bajo el horizonte) donde corre una línea de olas. */
const CREST_ROWS = [3, 6, 10, 15, 21, 28, 36, 45];

function makeSea(scene: Phaser.Scene): void {
  const height = FAR_PLANE.bottom - SEA_TOP;
  art(scene, 'v7-coast-sea', SEA_WIDTH, height, STEPS * 2, (f, px) => {
    const set = f >= STEPS ? 1 : 0,
      step = f % STEPS;
    for (let d = 0; d < height; d++) {
      const row = CREST_ROWS.indexOf(d);
      for (let x = 0; x < SEA_WIDTH; x++) {
        let kind = d === 0 ? 0 : d <= 4 ? 1 : 2;
        // Crestas: trazos que se alargan y separan hacia la orilla.
        if (row >= 0) {
          const cycle = [16, 16, 32, 32, 32, 64, 64, 64][row]!;
          const dash = 2 + row;
          if (pmod(x + row * 11, cycle) < dash) kind = 3;
        }
        px(x, d, mix(SEA[kind]![set], step, x, SEA_TOP + d));
      }
    }
  });
}

/**
 * La Portada: arco natural de roca sedimentaria en el mar, frente a
 * Antofagasta, dibujado a mano por código (no es una foto ni un recorte).
 * Dos pilares de estratos ocres con el ojo del arco abierto al mar, techo
 * irregular con la costra blanca de guano, un islote menor a la derecha y
 * espuma al pie. Luz arriba-izquierda: caras izquierdas claras, derechas en
 * sombra; contorno de tinta de 1 px.
 */
export const PORTADA = { width: 220, height: 172, factor: 0.45 } as const;
const PORTADA_TONES: readonly [
  lit: [Tones, Tones],
  base: [Tones, Tones],
  shade: [Tones, Tones],
  band: [Tones, Tones],
  guano: [Tones, Tones],
  outline: [Tones, Tones],
  foam: [Tones, Tones],
] = [
  [
    [P.mauve, P.dawnPink, P.peach, P.desertSand, P.desertSand],
    [P.mauve, P.dawnPink, P.desertSunset, P.desertSand, P.desertSand],
  ],
  [
    [P.plum, P.mauve, P.dawnPink, P.desertSoil, P.desertSoil],
    [P.plum, P.duskViolet, P.desertSunset, P.desertSoil, P.desertSoil],
  ],
  [
    [P.night, P.plum, P.plum, P.desertMountain, P.desertMountain],
    [P.night, P.plum, P.rust, P.desertMountain, P.desertMountain],
  ],
  [
    [P.night, P.plum, P.plum, P.soil, P.soil],
    [P.night, P.plum, P.ember, P.soil, P.soil],
  ],
  [
    [P.stone, P.mauve, P.cream, P.cream, P.white],
    [P.stone, P.dawnPink, P.peach, P.cream, P.white],
  ],
  [
    [P.ink, P.ink, P.night, P.desertRock, P.desertRock],
    [P.ink, P.ink, P.night, P.desertRock, P.desertRock],
  ],
  [
    [P.steel, P.mauve, P.cream, P.mist, P.white],
    [P.steel, P.dawnPink, P.peach, P.mist, P.white],
  ],
];

/** Línea del agua al pie de La Portada (y en la textura). */
const PORTADA_BASE = 152;

/**
 * ¿El píxel (x, y) es roca del arco o del islote? El arco es una masa de
 * techo abovedado e irregular, flancos que se ensanchan hacia el agua y un
 * ojo alto y redondeado (casi la mitad del ancho), con bordes mordidos por
 * la erosión. El islote es un peñón redondeado a la derecha.
 */
function portadaRock(x: number, y: number): boolean {
  const base = PORTADA_BASE;
  if (y > base || y < 0) return false;
  const up = base - y;
  const left = 22 + Math.round(4 * Math.sin(y / 9) + 2 * Math.sin(y / 3.7) + up * 0.1);
  const right = 172 - Math.round(3 * Math.sin(y / 7 + 1) + 2 * Math.sin(y / 4.1) + up * 0.13);
  if (x >= left && x <= right) {
    // Techo abovedado con bultos y una muesca hacia la derecha.
    const roof = Math.round(
      34 +
        16 * ((x - 96) / 74) ** 2 +
        3 * Math.sin(x / 7) +
        2 * Math.sin(x / 3.1 + 1) +
        (x > 128 && x < 140 ? 4 : 0),
    );
    if (y < roof) return false;
    // Ojo del arco: elipse de ~60 px de ancho que sube hasta y ≈ 76.
    const cx = 100,
      rx = 30 * (1 + 0.05 * Math.sin(y / 4)),
      ry = base - 76;
    const nx = (x - cx) / rx,
      ny = up / ry;
    return nx * nx + ny * ny >= 1;
  }
  // Islote: peñón redondeado a la derecha.
  const ix = (x - 192) / 15,
    iy = (base + 6 - y) / 42;
  return x >= 176 && ix * ix + iy * iy < 1 + 0.06 * Math.sin(x / 2);
}

function makePortada(scene: Phaser.Scene): void {
  const { width, height } = PORTADA;
  if (scene.textures.exists('v7-coast-portada')) return;
  // La forma no depende de la hora: la roca y el tono de cada píxel se
  // calculan una sola vez y los 18 cuadros solo cambian los colores.
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) mask[y * width + x] = portadaRock(x, y) ? 1 : 0;
  const rock = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
  /** Tono de cada píxel (índice de PORTADA_TONES) o −1 si es vacío. */
  const kinds = new Int8Array(width * height).fill(-1);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!rock(x, y)) {
        // Espuma al pie de la roca, en la línea del agua.
        if (
          y >= PORTADA_BASE - 2 &&
          y <= PORTADA_BASE + 2 &&
          (rock(x - 2, PORTADA_BASE - 1) || rock(x + 2, PORTADA_BASE - 1)) &&
          pmod(x * 3 + y, 5) < 3
        )
          kinds[i] = 6;
        continue;
      }
      const edge = !rock(x - 1, y) || !rock(x + 1, y) || !rock(x, y - 1) || !rock(x, y + 1);
      if (edge) kinds[i] = 5;
      else if (
        !rock(x, y - 2) ||
        (!rock(x, y - 3) && pmod(x * 7, 5) < 3) ||
        (!rock(x, y - 4) && pmod(x * 5, 9) === 0)
      )
        // Costra de guano en lo alto, con chorreaduras cortas.
        kinds[i] = 4;
      else {
        // Caras: luz con aire cerca a la izquierda; sombra con aire a la derecha.
        let lit = false,
          shade = false;
        for (let k = 2; k <= 6; k++) if (!rock(x - k, y) || !rock(x, y - k)) lit = true;
        for (let k = 2; k <= 9; k++) if (!rock(x + k, y)) shade = true;
        // Estratos ondulados de grosor variable y surcos verticales de erosión.
        const strata = pmod(y + Math.round(3 * Math.sin(x / 17) + 2 * Math.sin(x / 7)), 11);
        const groove = pmod(x + Math.round(y / 6), 23) === 0 && pmod(y, 7) < 4;
        kinds[i] = strata < 2 || groove ? 3 : shade ? 2 : lit ? 0 : 1;
      }
    }
  art(scene, 'v7-coast-portada', width, height, STEPS * 2, (f, px) => {
    const set = f >= STEPS ? 1 : 0,
      step = f % STEPS;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const kind = kinds[y * width + x]!;
        if (kind >= 0) px(x, y, mix(PORTADA_TONES[kind]![set], step, x, y));
      }
  });
}

/** Capa de parallax del fondo, con el cuadro de la hora vigente. */
export interface BackdropLayer {
  key: string;
  frame: number;
  depth: number;
  factor: number;
  /** x en su plano de parallax cuando scrollX = 0. */
  anchor: number;
  width: number;
  top: number;
  /** Se puede omitir mientras su borde cubierto siga fuera de la vista. */
  revealFrom?: number;
  /** Dibuja su textura si todavía no existe (tramos del oeste, a demanda). */
  prepare?: () => void;
}

/**
 * La Portada queda centrada en la vista cuando la cámara está a mitad de su
 * zona (columna 444): x en pantalla = PORTADA_ANCHOR − factor · scrollX.
 */
const PORTADA_ANCHOR = Math.round(
  VIEW.width / 2 -
    PORTADA.width / 2 +
    PORTADA.factor * (444 * TILE_SIZE + 8 - VIEW.width / 2),
);

interface Cloud {
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
  speed: number;
  factor: number;
  shape: number;
}
interface Bird {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  speed: number;
  offset: number;
  far: boolean;
  /** Próximo cambio entre aleteo y planeo (ms del fondo). */
  switchAt: number;
  gliding: boolean;
  drift: number;
}

export class DesertBackdrop {
  private readonly sky: Phaser.GameObjects.TileSprite;
  private readonly sun: Phaser.GameObjects.Image;
  private readonly moon: Phaser.GameObjects.Image;
  private readonly clouds: Cloud[] = [];
  private readonly birds: Bird[] = [];
  private readonly stars: Phaser.GameObjects.Graphics;
  private readonly dust: Phaser.GameObjects.Graphics;
  private readonly landscape: readonly LandscapeStrip[];
  private elapsed = 0;
  private nextBird = 6000;
  private starKey = '';
  private frame = -1;
  private wind?: { source: AudioBufferSourceNode; gain: GainNode };
  private audioTried = false;

  constructor(private readonly scene: Phaser.Scene) {
    makeSky(scene);
    makeCelestial(scene);
    makeClouds(scene);
    makeBirds(scene);
    const fixed = (key: string, depth: number) =>
      scene.add
        .image(0, 0, key, 0)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(DEPTH.background + depth);
    this.sky = scene.add
      .tileSprite(0, 0, VIEW.width, VIEW.height, 'v7-sky', 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH.background);
    this.stars = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH.background + 0.1);
    this.sun = fixed('v7-celestial', 0.2).setOrigin(0.5);
    this.moon = fixed('v7-celestial', 0.2).setFrame(2).setOrigin(0.5);
    this.dust = scene.add.graphics().setDepth(DEPTH.terrain + 1);
    this.landscape = LANDSCAPE.flatMap((plane, layer) => makeRange(scene, plane, layer));
    makeSea(scene);
    makePortada(scene);
    // Nubes en dos capas de parallax: lejanas (lentas, tras la cordillera
    // lejana) y cercanas (más rápidas). Se reciclan al salir de la vista.
    for (let i = 0; i < 7; i++) {
      const near = i % 2 === 1;
      const cloud: Cloud = {
        image: fixed('v7-clouds', near ? 0.9 : 0.3),
        x: i * 78 - 40,
        y: 0,
        speed: 0,
        factor: near ? 0.14 : 0.05,
        shape: 0,
      };
      this.reshapeCloud(cloud, i);
      this.clouds.push(cloud);
    }
    for (const [key, frames, rate] of [
      ['v7-bird-flap', [0, 1, 2, 3, 4, 5], 11],
      ['v7-bird-glide', [6], 1],
      ['v7-bird-far', [7, 8, 9, 8], 8],
    ] as const)
      if (!scene.anims.exists(key))
        scene.anims.create({
          key,
          frames: frames.map((frame) => ({ key: 'v7-birds', frame })),
          frameRate: rate,
          repeat: -1,
        });
    for (let i = 0; i < 9; i++) {
      const far = i >= 6;
      this.birds.push({
        sprite: scene.add
          .sprite(0, 0, 'v7-birds', far ? 7 : 0)
          .setScrollFactor(0)
          .setDepth(DEPTH.background + (far ? 0.6 : 2.8))
          .setVisible(false),
        x: 0,
        y: 0,
        speed: 0,
        offset: i * 3,
        far,
        switchAt: 0,
        gliding: false,
        drift: 0,
      });
    }
    // Con la escena en pausa `update` no corre: sin esto el viento seguía
    // sonando en el menú de pausa (y sin obedecer su opción de silencio). Al
    // reanudar, el primer `update` le devuelve su volumen.
    const hush = () => {
      if (this.wind) this.wind.gain.gain.value = 0;
    };
    scene.events.on(Phaser.Scenes.Events.PAUSE, hush);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.PAUSE, hush);
      this.wind?.source.stop();
      this.wind?.gain.disconnect();
      this.wind = undefined;
    });
  }

  /** Nueva forma, altura y velocidad para una nube (al crearla o reciclarla). */
  private reshapeCloud(c: Cloud, seed: number): void {
    const r = (k: number) => hash(seed, Math.floor(this.elapsed / 997) + k, 17);
    c.shape = Math.floor(r(1) * CLOUD_SHAPES);
    c.y = Math.round(c.factor > 0.1 ? 22 + r(2) * 54 : 14 + r(2) * 40);
    c.speed = (c.factor > 0.1 ? 2.6 : 1.1) + r(3) * 1.9;
  }

  /** Lanza una bandada (1–3 aves) desde un borde de la pantalla. */
  spawnBirds(group: number, far = false): void {
    const seed = Math.floor(this.elapsed) + group * 13 + (far ? 5 : 0);
    const direction = hash(seed, 6) > 0.5 ? 1 : -1;
    // Algunas vuelan bajo, cerca de los cerros; las lejanas, alto y pequeñas.
    const low = !far && hash(seed, 9) > 0.65;
    const baseY = far
      ? 30 + Math.floor(hash(seed, 8) * 40)
      : low
        ? 92 + Math.floor(hash(seed, 8) * 22)
        : 40 + Math.floor(hash(seed, 8) * 44);
    this.birds
      .filter((b) => b.far === far && !b.sprite.visible)
      .slice(0, group)
      .forEach((b, i) => {
        b.x = direction > 0 ? -20 - i * 15 : 500 + i * 15;
        b.y = baseY + i * 4 + (i % 2) * 2;
        b.drift = 0;
        b.speed = direction * (far ? 7 + hash(i, baseY) * 4 : 14 + hash(i, baseY) * 9);
        b.gliding = false;
        b.switchAt = this.elapsed + 1500 + hash(i, seed) * 2500;
        b.sprite
          .setVisible(true)
          .setFlipX(direction < 0)
          .play({ key: far ? 'v7-bird-far' : 'v7-bird-flap', startFrame: i % 4 });
        b.sprite.anims.timeScale = 0.8 + hash(i, baseY) * 0.5;
      });
  }

  /** Diagnóstico para pruebas: posición en pantalla de cada nube. */
  cloudPositions(): number[] {
    return this.clouds.map((c) => c.image.x);
  }

  /** Tramos del paisaje con el cuadro de iluminación vigente. */
  rangeLayers(): BackdropLayer[] {
    const frame = Math.max(0, this.frame);
    return [
      ...this.landscape.map((strip) => ({
        key: strip.key,
        frame,
        depth: strip.plane.depth,
        factor: strip.plane.factor,
        anchor: strip.anchor,
        width: strip.width,
        top: strip.top,
        prepare: strip.prepare,
      })),
      {
        key: 'v7-coast-sea',
        frame,
        depth: 0.45,
        factor: SEA_FACTOR,
        anchor: SEA_ANCHOR,
        width: SEA_WIDTH,
        top: SEA_TOP,
        revealFrom: SEA_VISIBLE_FROM,
      },
      {
        key: 'v7-coast-portada',
        frame,
        depth: 1.25,
        factor: PORTADA.factor,
        anchor: PORTADA_ANCHOR,
        width: PORTADA.width,
        top: 0,
      },
    ];
  }
  /** Diagnóstico para pruebas: cuadro actual de cada ave en vuelo. */
  birdFrames(): string[] {
    return this.birds
      .filter((b) => b.sprite.visible)
      .map((b) => String(b.sprite.frame.name));
  }

  /** Ruido de viento original, sin muestras externas; sigue pausa, noche y M. */
  private updateWind(day: DayNightCycle, active: boolean): void {
    const manager = this.scene.sound;
    if (!this.audioTried && active) {
      this.audioTried = true;
      const context = (manager as Phaser.Sound.WebAudioSoundManager).context;
      if (context) {
        const buffer = context.createBuffer(
          1,
          context.sampleRate * 3,
          context.sampleRate,
        );
        const data = buffer.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < data.length; i++) {
          brown = (brown + (hash(i, 73) - 0.5) * 0.035) / 1.018;
          data[i] = brown;
        }
        const source = context.createBufferSource(),
          gain = context.createGain();
        source.buffer = buffer;
        source.loop = true;
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(context.destination);
        source.start();
        this.wind = { source, gain };
      }
    }
    // Viento suave de día; la noche es casi silenciosa.
    if (this.wind)
      this.wind.gain.gain.value =
        active && !manager.mute
          ? (0.012 + 0.06 * day.sunStrength) * manager.volume
          : 0;
  }

  update(
    day: DayNightCycle,
    dtMs: number,
    active: boolean,
    grid: TerrainGrid,
  ): void {
    const dt = active ? dtMs / 1000 : 0;
    this.elapsed += active ? dtMs : 0;
    this.updateWind(day, active);
    // Cuadro de la hora: juego del amanecer o del ocaso y paso noche→día.
    const set = day.phase === 'sunset' || (day.phase === 'night' && day.phaseProgress < 0.5) ? 1 : 0;
    // Solo pasos pares: colores planos de la rampa, nunca el tablero 50 %
    // (a tamaño real se veía como ruido). Cambia en cinco escalones.
    const step = 2 * Math.round(day.sunStrength * ((STEPS - 1) / 2));
    const frame = set * STEPS + step;
    if (frame !== this.frame) {
      this.frame = frame;
      this.sky.setFrame(frame);
    }
    const sun = day.sun,
      moon = day.moon;
    this.sun
      .setPosition(sun.x, sun.y)
      .setVisible(sun.visible)
      .setFrame(sun.y > 100 ? 1 : 0);
    this.moon.setPosition(moon.x, moon.y).setVisible(moon.visible);
    const cam = this.scene.cameras.main;
    this.clouds.forEach((c, i) => {
      c.x -= dt * c.speed;
      let sx = c.x - cam.scrollX * c.factor;
      // Reciclaje fuera de cámara: reaparece por el otro lado con otra forma.
      if (sx < -CLOUD_W - 6) {
        this.reshapeCloud(c, i);
        c.x = VIEW.width + 10 + hash(i, this.elapsed, 3) * 60 + cam.scrollX * c.factor;
        sx = c.x - cam.scrollX * c.factor;
      } else if (sx > VIEW.width + 80) {
        c.x = -CLOUD_W + cam.scrollX * c.factor;
        sx = -CLOUD_W;
      }
      c.image
        .setPosition(Math.round(sx), c.y)
        .setFrame((set * STEPS + step) * CLOUD_SHAPES + c.shape);
    });
    this.drawStars(day);
    this.updateBirds(day, dt, active);
    this.drawDust(day, grid, cam);
  }

  /** Estrellas: aparecen de a poco al anochecer; destellos lentos y escasos. */
  private drawStars(day: DayNightCycle): void {
    const amount = day.stars;
    const twinkleTick = Math.floor(this.elapsed / 900);
    const key = `${Math.round(amount * 60)}:${twinkleTick}`;
    if (key === this.starKey) return;
    this.starKey = key;
    this.stars.clear();
    if (amount <= 0) return;
    for (let i = 0; i < 90; i++) {
      const rank = hash(i, 1);
      if (rank > amount) continue;
      const x = Math.floor(hash(i, 2) * VIEW.width),
        y = 6 + Math.floor(hash(i, 3) * 120);
      const twinkle = (twinkleTick + i * 7) % 23 === 0;
      const color = twinkle ? P.mist : rank < 0.25 ? P.silver : rank < 0.6 ? P.steel : P.stone;
      this.stars.fillStyle(color).fillRect(x, y, 1, 1);
      // Pocas estrellas grandes con destello en cruz, solo al titilar.
      if (twinkle && rank < 0.15)
        this.stars.fillStyle(P.steel).fillRect(x - 1, y, 1, 1).fillRect(x + 1, y, 1, 1);
    }
  }

  private updateBirds(day: DayNightCycle, dt: number, active: boolean): void {
    if (active && this.elapsed >= this.nextBird) {
      const activity = day.birdActivity;
      const seed = Math.floor(this.elapsed);
      // De día, una bandada cada 10–28 s; de noche, muy rara vez.
      this.nextBird =
        this.elapsed + (10_000 + hash(seed, 4) * 18_000) / Math.max(0.12, activity);
      if (hash(seed, 5) < activity) {
        const far = hash(seed, 11) < 0.35;
        this.spawnBirds(1 + Math.floor(hash(seed, 7) * (far ? 2 : 3)), far);
      }
    }
    for (const b of this.birds) {
      if (!b.sprite.visible) continue;
      // Pausa real: las aves se congelan con el resto del mundo.
      if (!active) {
        b.sprite.anims.pause();
        continue;
      }
      b.sprite.anims.resume();
      if (!b.far && this.elapsed >= b.switchAt) {
        b.gliding = !b.gliding;
        b.switchAt = this.elapsed + (b.gliding ? 900 : 2200) + hash(b.offset, this.elapsed) * 1800;
        b.sprite.play(b.gliding ? 'v7-bird-glide' : 'v7-bird-flap', true);
      }
      // Al planear desciende un poco; al aletear recupera altura.
      b.drift = Math.max(-6, Math.min(6, b.drift + (b.gliding ? 3 : -2) * dt));
      b.x += b.speed * dt;
      b.sprite.setPosition(
        Math.round(b.x),
        Math.round(b.y + b.drift + Math.sin(this.elapsed / 1100 + b.offset) * 2),
      );
      if (b.x < -90 || b.x > VIEW.width + 90) b.sprite.setVisible(false).stop();
    }
  }

  /** Polvo escaso que el viento arrastra junto al suelo (no en galerías). */
  private drawDust(
    day: DayNightCycle,
    grid: TerrainGrid,
    cam: Phaser.Cameras.Scene2D.Camera,
  ): void {
    this.dust.clear();
    if (day.sunStrength < 0.25) return;
    for (let i = 0; i < 18; i++) {
      const wx =
        Math.floor(cam.scrollX) +
        ((i * 83 + Math.floor((this.elapsed / 100) * (1 + (i % 3)))) % 510) -
        15;
      const column = Math.floor(wx / TILE_SIZE),
        wy =
          surfaceRow(column) * TILE_SIZE -
          4 -
          (i % 9) -
          Math.round(Math.sin(this.elapsed / 700 + i) * 1.5);
      // V9: el polvo es del desierto; los otros biomas tienen su ambiente.
      if (
        wx < WORLD_LEFT + TILE_SIZE ||
        column >= grid.end - 1 ||
        earthGroup(column) !== 'desert' ||
        grid.isSolid(column, Math.floor(wy / TILE_SIZE))
      )
        continue;
      this.dust
        .fillStyle(i % 3 ? P.desertSand : P.desertSoil)
        .fillRect(wx, wy, i % 5 === 0 ? 2 : 1, 1);
    }
  }
}

/** Se conserva el punto de montaje del fondo provisional, ahora vivo y desértico. */
export function drawBackdrop(scene: Phaser.Scene): void {
  const backdrop = new DesertBackdrop(scene);
  scene.registry.set('desert-backdrop', backdrop);
}
