import Phaser from 'phaser';
import type { BiomeId } from '../config/biomes';
import { TILE_SIZE } from '../config/constants';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { LANDMARK_BURY, LANDMARK_SITES, landmarkSpot } from './LandmarkSites';

/**
 * Monumentos de Antofagasta (18 de noviembre de 2026), dibujados a mano por
 * código con la paleta del juego: no son fotos, recortes ni arte de
 * terceros. Cada uno es una imagen anclada al mundo en un plano justo detrás
 * del suelo (delante de las dunas, detrás de la pared subterránea):
 *
 * - Mano del Desierto: la gran mano que asoma de la arena.
 * - Oficina salitrera: chimenea de ladrillo y galpón de calamina en ruinas.
 * - Locomotora a vapor del Ferrocarril de Antofagasta a Bolivia (FCAB).
 * - Ruinas de Huanchaca: terrazas de piedra de la antigua fundición.
 *
 * (La Portada es parte del fondo de la costa: world/Backdrop.ts.)
 *
 * No tienen colisión ni se excavan: el pie de cada imagen tiene unos
 * cimientos (BURY px) que el terreno y la pared subterránea tapan, así un
 * hueco excavado junto a un monumento muestra la pared, no el dibujo. El
 * tinte de la hora lo pone NightTint, como al resto del mundo.
 */

/** Cimientos bajo la línea del suelo (los tapa el terreno). */
const BURY = LANDMARK_BURY;
/** Plano del monumento: delante de dunas y aves, detrás de la pared (3). */
const LANDMARK_DEPTH = DEPTH.background + 2.85;

/** Material de cada píxel: colores de luz, base, sombra y oscuro. */
interface Material {
  lit: number;
  base: number;
  shade: number;
  /** Detalle propio del material (juntas, vetas, óxido) o null. */
  pattern?: (x: number, y: number) => number | null;
}

const pmod = (v: number, m: number) => ((v % m) + m) % m;
const hash = (x: number, y: number, seed = 3) => {
  let h = Math.imul(x + seed * 101, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const MATERIALS = {
  /** Hormigón de la Mano: gris pardo con vetas de polvo. */
  concrete: {
    lit: P.khaki,
    base: P.taupe,
    shade: P.desertRock,
    pattern: (x, y) =>
      pmod(x * 7 + Math.floor(y / 9) * 3, 11) === 0 && hash(x, Math.floor(y / 5)) < 0.5
        ? P.desertRock
        : null,
  },
  /** Ladrillo de la chimenea: hiladas con junta de mortero. */
  brick: {
    lit: P.clay,
    base: P.rust,
    shade: P.ember,
    pattern: (x, y) =>
      pmod(y, 4) === 3 || pmod(x + (pmod(Math.floor(y / 4), 2) ? 3 : 0), 6) === 0
        ? P.earth
        : null,
  },
  /** Mismo hormigón, otra pieza: separa dedos vecinos con una línea oscura. */
  concrete2: {
    lit: P.khaki,
    base: P.taupe,
    shade: P.desertRock,
    pattern: (x, y) =>
      pmod(x * 5 + Math.floor(y / 8) * 3, 13) === 0 && hash(x, Math.floor(y / 6)) < 0.5
        ? P.desertRock
        : null,
  },
  /** Calamina oxidada: ondas verticales con chorreaduras de herrumbre. */
  zinc: {
    lit: P.steel,
    base: P.stone,
    shade: P.slate,
    pattern: (x, y) =>
      // Chorreaduras: trazos de 1 px de ancho que bajan desde los clavos.
      hash(x, Math.floor(y / 12), 9) < 0.07 && pmod(y, 12) < 9
        ? P.rust
        : pmod(x, 3) === 2
          ? P.slate
          : null,
  },
  /** Madera reseca de marcos y vigas. */
  wood: { lit: P.clay, base: P.earth, shade: P.umber },
  /** Hierro negro de la locomotora. */
  iron: { lit: P.stone, base: P.slate, shade: P.night },
  /** Pintura roja de la locomotora (topes, ruedas). */
  red: { lit: P.red, base: P.rust, shade: P.ember },
  /** Bronce de la campana y franjas. */
  brass: { lit: P.cream, base: P.gold, shade: P.amber },
  /** Piedra de Huanchaca: sillares con juntas, gris ocre. */
  stone: {
    lit: P.khaki,
    base: P.taupe,
    shade: P.desertRock,
    pattern: (x, y) => {
      const course = Math.floor(y / 6);
      const w = 9 + Math.floor(hash(course, 1, 5) * 5);
      const off = Math.floor(hash(course, 2, 5) * w);
      return pmod(y, 6) === 5 || pmod(x + off, w) === 0 ? P.desertRock : null;
    },
  },
  /** Terrazas de atrás: la misma piedra, más tostada por el sol. */
  stone2: {
    lit: P.desertSand,
    base: P.khaki,
    shade: P.taupe,
    pattern: (x, y) => {
      const course = Math.floor(y / 6);
      const w = 10 + Math.floor(hash(course, 3, 5) * 5);
      const off = Math.floor(hash(course, 4, 5) * w);
      return pmod(y, 6) === 5 || pmod(x + off, w) === 0 ? P.taupe : null;
    },
  },
  /** Hueco oscuro (ventanas, arcos, interior). */
  hole: { lit: P.night, base: P.ink, shade: P.ink },
  /** Riel de acero y durmientes. */
  rail: { lit: P.silver, base: P.steel, shade: P.stone },
  /** Tierra y cascajo al pie de los monumentos. */
  rubble: {
    lit: P.desertSand,
    base: P.desertSoil,
    shade: P.desertMountain,
    pattern: (x, y) => (hash(x, y, 13) < 0.2 ? P.desertRock : null),
  },
} satisfies Record<string, Material>;
type MaterialName = keyof typeof MATERIALS;
const NAMES = Object.keys(MATERIALS) as MaterialName[];
/** Materiales que no reciben luz ni contorno propio (huecos). */
const FLAT: ReadonlySet<MaterialName> = new Set(['hole']);

/** Lienzo de materiales: 0 vacío, n = NAMES[n − 1]. */
class Sketch {
  readonly cells: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.cells = new Uint8Array(w * h);
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.cells[y * this.w + x]!;
  }

  set(x: number, y: number, m: MaterialName | null): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.cells[y * this.w + x] = m ? NAMES.indexOf(m) + 1 : 0;
  }

  rect(x: number, y: number, w: number, h: number, m: MaterialName | null): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, m);
    return this;
  }

  /** Rellena los píxeles cuyo centro cumple `inside`. */
  shape(inside: (x: number, y: number) => boolean, m: MaterialName | null): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) if (inside(x + 0.5, y + 0.5)) this.set(x, y, m);
    return this;
  }

  disc(cx: number, cy: number, r: number, m: MaterialName | null): this {
    return this.shape((x, y) => (x - cx) ** 2 + (y - cy) ** 2 < r * r, m);
  }

  /** Rectángulo de esquinas superiores redondeadas (dedos, cúpulas). */
  pill(x: number, y: number, w: number, h: number, m: MaterialName): this {
    const r = w / 2;
    return this.shape(
      (px, py) =>
        px >= x &&
        px < x + w &&
        py < y + h &&
        (py >= y + r || (px - (x + r)) ** 2 + (py - (y + r)) ** 2 < r * r),
      m,
    );
  }
}

/**
 * Pinta el boceto: contorno de tinta de 1 px contra el vacío, luz en los
 * píxeles con vacío a 1–2 px arriba o a la izquierda, sombra con vacío a 1–3
 * px a la derecha, y el detalle de cada material en el resto.
 */
function paint(scene: Phaser.Scene, key: string, s: Sketch): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, s.w, s.h)!;
  const ctx = texture.context;
  const data = ctx.createImageData(s.w, s.h);
  const put = (x: number, y: number, color: number) => {
    const i = (y * s.w + x) * 4;
    data.data[i] = (color >>> 16) & 255;
    data.data[i + 1] = (color >>> 8) & 255;
    data.data[i + 2] = color & 255;
    data.data[i + 3] = 255;
  };
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const m = s.get(x, y);
      if (!m) continue;
      const name = NAMES[m - 1]!;
      const mat: Material = MATERIALS[name];
      const empty = (dx: number, dy: number) => s.get(x + dx, y + dy) === 0;
      if (empty(-1, 0) || empty(1, 0) || empty(0, -1) || empty(0, 1)) {
        put(x, y, P.ink);
        continue;
      }
      if (FLAT.has(name)) {
        put(x, y, mat.base);
        continue;
      }
      // Borde con otro material: línea oscura que separa las piezas.
      const other = (dx: number, dy: number) => {
        const n = s.get(x + dx, y + dy);
        return n !== 0 && n !== m && FLAT.has(NAMES[n - 1]!) === false;
      };
      if (other(1, 0) || other(0, 1)) {
        put(x, y, mat.shade);
        continue;
      }
      const lit = empty(-2, 0) || empty(0, -2) || empty(-1, -1);
      const shade = empty(2, 0) || empty(3, 0) || empty(2, 1);
      const detail = mat.pattern?.(x, y) ?? null;
      put(x, y, lit ? mat.lit : shade ? mat.shade : (detail ?? mat.base));
    }
  ctx.putImageData(data, 0, 0);
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** Mano del Desierto: mano izquierda abierta que asoma de la arena. */
function sketchHand(): Sketch {
  const s = new Sketch(72, 160 + BURY);
  const ground = 160;
  // Antebrazo que sale de la arena y palma.
  s.shape((x, y) => {
    if (y < 96 || y > ground + BURY) return false;
    const half = 15 + (y - 96) * 0.03;
    return Math.abs(x - 37) < half;
  }, 'concrete');
  s.shape((x, y) => y >= 54 && y < 100 && x >= 17 && x < 57 - Math.max(0, 62 - y) * 0.15, 'concrete');
  // Cuatro dedos gruesos y juntos, de alturas distintas, apenas curvados
  // hacia la palma; cada dedo es otra pieza, así los separa una línea oscura.
  const finger = (x: number, top: number, w: number, lean: number, m: 'concrete' | 'concrete2') =>
    s.shape((px, py) => {
      if (py > 66) return false;
      const shift = lean * Math.max(0, (40 - (py - top)) / 40);
      const fx = x + shift;
      const r = w / 2;
      if (px < fx || px >= fx + w) return false;
      return py >= top + r || (px - (fx + r)) ** 2 + (py - (top + r)) ** 2 < r * r;
    }, m);
  finger(17, 22, 10, 0, 'concrete2');
  finger(27, 10, 10, 0, 'concrete');
  finger(37, 15, 10, 0, 'concrete2');
  finger(47, 31, 9, 0, 'concrete');
  // Separación entre dedos: una línea oscura de 1 px desde la punta del dedo
  // más bajo hasta la palma.
  for (const [gx, from] of [
    [27, 27],
    [37, 20],
    [47, 36],
  ] as const)
    s.rect(gx, from, 1, 58 - from, 'hole');
  // Pulgar abierto hacia la izquierda, en diagonal, grueso en la base.
  s.shape((x, y) => {
    // Eje del pulgar desde (22, 86) hacia (8, 58).
    const t = Math.max(0, Math.min(1, ((x - 22) * -14 + (y - 86) * -28) / (14 * 14 + 28 * 28)));
    const cx = 22 - 14 * t,
      cy = 86 - 28 * t;
    return (x - cx) ** 2 + (y - cy) ** 2 < (6 - t * 1.6) ** 2;
  }, 'concrete2');
  // Pliegues de los nudillos.
  for (const [x, y, w] of [
    [20, 46, 5],
    [30, 36, 5],
    [40, 41, 5],
    [49, 51, 4],
  ] as const)
    s.rect(x, y, w, 1, 'hole');
  // Arena amontonada al pie.
  s.shape(
    (x, y) =>
      y >= ground - 6 + Math.round(Math.sin(x / 4)) &&
      y < ground + BURY &&
      Math.abs(x - 37) < 35 - Math.max(0, ground - y) * 3,
    'rubble',
  );
  return s;
}

/** Oficina salitrera: chimenea de ladrillo y galpón de calamina en ruinas. */
function sketchSaltpeter(): Sketch {
  const s = new Sketch(176, 150 + BURY);
  const ground = 150;
  // Chimenea: fuste de ladrillo levemente cónico con corona.
  s.shape((x, y) => {
    if (y < 8 || y > ground + BURY) return false;
    const half = 5 + (y - 8) * 0.025;
    return Math.abs(x - 26) < half;
  }, 'brick');
  s.rect(19, 6, 15, 4, 'iron');
  s.rect(24, 3, 5, 3, 'hole');
  // Galpón: muros de calamina, marcos de madera y techo a dos aguas roto.
  s.rect(42, 92, 112, ground + BURY - 92, 'zinc');
  s.shape((x, y) => y >= 66 && y < 94 && x >= 40 && x < 156 && y > 66 + Math.abs(x - 98) * 0.45, 'zinc');
  // Parte del techo caída: hueco dentado a la derecha.
  s.shape((x, y) => x > 112 && y < 92 && y < 100 - (x - 112) * 0.4 + 6 * Math.sin(x / 3), null);
  for (const fx of [42, 76, 110, 150]) s.rect(fx, 92, 4, ground - 92, 'wood');
  s.rect(42, 92, 112, 3, 'wood');
  // Ventanas y portón sin hojas.
  for (const wx of [52, 88, 124]) s.rect(wx, 102, 12, 14, 'hole');
  s.rect(84, 124, 20, ground - 124, 'hole');
  // Muro bajo de adobe derrumbado a la izquierda del galpón.
  s.shape((x, y) => x >= 34 && x < 44 && y >= 120 + Math.round(4 * Math.sin(x)) && y < ground + 4, 'rubble');
  // Cascajo de caliche al pie, de borde irregular y continuo.
  s.shape(
    (x, y) =>
      y >= ground - 3 - Math.round(1.5 + 1.5 * Math.sin(x / 5) + Math.sin(x / 2.3)) &&
      y < ground + BURY,
    'rubble',
  );
  return s;
}

/** Glifos de 3 × 5 para la placa del ténder. */
const GLYPHS: Record<string, string> = {
  F: '111100110100100',
  C: '111100100100111',
  A: '010101111101101',
  B: '110101110101110',
};

/** Locomotora a vapor del FCAB con su ténder, sobre la vía. */
function sketchLocomotive(): { sketch: Sketch; plate: [number, number] } {
  const s = new Sketch(200, 86 + BURY);
  const rails = 80;
  // Vía: durmientes y riel.
  for (let x = 2; x < 198; x += 7) s.rect(x, rails + 2, 4, 3, 'wood');
  s.rect(0, rails, 200, 2, 'rail');
  // Ruedas: guía pequeña, tres motrices rojas y dos del ténder.
  const wheel = (cx: number, r: number) => {
    s.disc(cx, rails - r, r, 'red');
    s.disc(cx, rails - r, Math.max(1.5, r - 3), 'iron');
    s.disc(cx, rails - r, 1.2, 'brass');
  };
  wheel(38, 6);
  for (const cx of [62, 84, 106]) wheel(cx, 10);
  for (const cx of [158, 182]) wheel(cx, 6);
  // Bastidor y biela.
  s.rect(26, 60, 98, 5, 'iron');
  s.rect(60, 69, 48, 2, 'rail');
  // Caldera, caja de humo y chimenea.
  s.shape((x, y) => x >= 34 && x < 120 && Math.abs(y - 46) < 12, 'iron');
  s.rect(24, 34, 14, 26, 'iron');
  s.shape((x, y) => y >= 12 && y < 36 && Math.abs(x - 31) < 4 + Math.max(0, 18 - y) * 0.6, 'iron');
  // Domo, arenero y campana de bronce.
  s.pill(66, 25, 12, 12, 'iron');
  s.pill(90, 27, 10, 10, 'brass');
  s.rect(35, 40, 85, 2, 'brass');
  // Tope rojo y quitapiedras.
  s.rect(16, 54, 10, 8, 'red');
  s.shape((x, y) => y >= 62 && y < rails - 1 && x >= 10 + (y - 62) * -0.4 && x < 30 - (y - 62) * 0.6, 'iron');
  // Cabina con techo y ventana.
  s.rect(118, 22, 30, 42, 'iron');
  s.rect(114, 18, 38, 5, 'iron');
  s.rect(126, 28, 14, 12, 'hole');
  // Ténder con su placa.
  s.rect(150, 36, 44, 30, 'iron');
  s.rect(150, 34, 44, 3, 'brass');
  s.rect(156, 44, 32, 12, 'red');
  return { sketch: s, plate: [160, 47] };
}

/** Ruinas de Huanchaca: terrazas de sillares con arcos, subiendo a la derecha. */
function sketchHuanchaca(): Sketch {
  const s = new Sketch(256, 132 + BURY);
  const ground = 132;
  // Cuatro terrazas escalonadas que suben hacia la derecha. Se dibujan de
  // la más alta (la del fondo) a la más baja (la de adelante), alternando
  // el tono de la piedra para que cada escalón se lea por separado.
  const terraces: readonly [number, number, number][] = [
    [0, 252, 104],
    [36, 246, 76],
    [86, 238, 50],
    [140, 228, 24],
  ];
  for (let i = terraces.length - 1; i >= 0; i--) {
    const [x0, x1, top] = terraces[i]!;
    s.shape((x, y) => {
      // Esquinas desmoronadas: los extremos bajan en diagonal.
      const corner = Math.max(0, 10 - (x - x0)) * 0.9 + Math.max(0, 14 - (x1 - x)) * 1.2;
      if (x < x0 || x >= x1 || y > ground + BURY) return false;
      // Corona erosionada: ondulación suave y algunos sillares caídos.
      const wear =
        2 +
        2 * Math.sin(x / 11 + top) +
        Math.sin(x / 4.3 + i) +
        (hash(Math.floor(x / 9), top, 11) < 0.22 ? 4 : 0);
      return y >= top + Math.round(Math.max(0, wear) + corner);
    }, i % 2 ? 'stone2' : 'stone');
  }
  // Arcos en los muros de las terrazas bajas.
  const arch = (cx: number, base: number, w: number, h: number) =>
    s.shape(
      (x, y) =>
        y < base &&
        Math.abs(x - cx) < w / 2 &&
        (y > base - h + w / 2 || (x - cx) ** 2 + (y - (base - h + w / 2)) ** 2 < (w / 2) ** 2),
      'hole',
    );
  for (const cx of [20, 52, 84, 150, 206]) arch(cx, ground - 2, 14, 22);
  for (const cx of [74, 118, 176]) arch(cx, 102, 12, 18);
  for (const cx of [128, 196]) arch(cx, 74, 10, 16);
  // Cascajo al pie, continuo y de borde irregular.
  s.shape(
    (x, y) =>
      y >= ground - 4 - Math.round(2 + 2 * Math.sin(x / 6) + Math.sin(x / 2.7)) &&
      y < ground + BURY,
    'rubble',
  );
  return s;
}

/** Dibujo de cada monumento (sus lugares están en LandmarkSites). */
interface Drawing {
  sketch: () => Sketch;
  /** Retoques ya pintados (placa del FCAB). */
  after?: (scene: Phaser.Scene, key: string) => void;
}

let plate: [number, number] = [0, 0];
const DRAWINGS: Record<string, Drawing> = {
  'landmark-hand': { sketch: sketchHand },
  'landmark-saltpeter': { sketch: sketchSaltpeter },
  'landmark-fcab': {
    sketch: () => {
      const loco = sketchLocomotive();
      plate = loco.plate;
      return loco.sketch;
    },
    after: (scene, key) => {
      // Placa «FCAB» en crema sobre el rojo del ténder (glifos 3 × 5).
      const texture = scene.textures.get(key) as Phaser.Textures.CanvasTexture;
      const ctx = texture.context;
      ctx.fillStyle = `#${P.cream.toString(16).padStart(6, '0')}`;
      [...'FCAB'].forEach((ch, i) => {
        const bits = GLYPHS[ch]!;
        for (let k = 0; k < 15; k++)
          if (bits[k] === '1') ctx.fillRect(plate[0] + i * 4 + (k % 3), plate[1] + Math.floor(k / 3), 1, 1);
      });
      texture.refresh();
    },
  },
  'landmark-huanchaca': { sketch: sketchHuanchaca },
};

/** Posición de cada monumento en el mundo (diagnóstico y pruebas). */
export interface LandmarkSpot {
  key: string;
  biome: BiomeId;
  /** Centro x y pie (y del borde inferior de la imagen) en px del mundo. */
  x: number;
  bottom: number;
  width: number;
  height: number;
}

export function createLandmarks(scene: Phaser.Scene): LandmarkSpot[] {
  return LANDMARK_SITES.map((p) => {
    const drawing = DRAWINGS[p.key]!;
    const sketch = drawing.sketch();
    if (!scene.textures.exists(p.key)) {
      paint(scene, p.key, sketch);
      drawing.after?.(scene, p.key);
    }
    if (sketch.w !== p.width)
      throw new Error(`Monumento ${p.key}: el dibujo mide ${sketch.w} px y LandmarkSites dice ${p.width}`);
    const { column, groundRow } = landmarkSpot(p, p.width);
    const x = column * TILE_SIZE + 8;
    const bottom = groundRow * TILE_SIZE + BURY;
    scene.add
      .image(x, bottom, p.key)
      .setOrigin(0.5, 1)
      .setDepth(LANDMARK_DEPTH);
    return { key: p.key, biome: p.biome, x, bottom, width: sketch.w, height: sketch.h };
  });
}
