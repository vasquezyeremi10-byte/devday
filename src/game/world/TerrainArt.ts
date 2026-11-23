import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { PALETTE as P } from '../config/palette';
import {
  MACRO_COLUMNS,
  MACRO_ROWS,
  MATERIALS,
  TERRAIN_FRAME_COUNT,
  TERRAIN_TEXTURE_COLUMNS,
  TerrainFrame as F,
  type Material,
} from './TerrainVisuals';

/**
 * Texturas geológicas generadas por código con la paleta global. Guía:
 * luz desde arriba a la izquierda (borde claro arriba-izquierda, sombra
 * abajo-derecha), colores planos, alfa 0/255 y grietas de 1 px.
 */
const W = MACRO_COLUMNS * TILE_SIZE;
const H = MACRO_ROWS * TILE_SIZE;

/** PRNG determinista (mulberry32): mismas texturas en cada ejecución. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Celdas de Voronoi toroidales: el borde derecho continúa en el izquierdo. */
function cells(seed: number, spacing: number, jitter: number) {
  const random = rng(seed);
  const cols = W / spacing;
  const rows = H / spacing;
  const points: [number, number][] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      points.push([
        c * spacing + spacing / 2 + (random() - 0.5) * jitter * spacing,
        r * spacing + spacing / 2 + (random() - 0.5) * jitter * spacing,
      ]);
  const ids = new Int32Array(W * H);
  const gaps = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cc = Math.floor(x / spacing);
      const cr = Math.floor(y / spacing);
      let d1 = Infinity;
      let d2 = Infinity;
      let id = 0;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) {
          const c = (cc + dc + cols) % cols;
          const r = (cr + dr + rows) % rows;
          const [px, py] = points[r * cols + c]!;
          let dx = Math.abs(px - x - 0.5);
          let dy = Math.abs(py - y - 0.5);
          dx = Math.min(dx, W - dx);
          dy = Math.min(dy, H - dy);
          const d = Math.hypot(dx, dy * 1.15);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            id = r * cols + c;
          } else if (d < d2) d2 = d;
        }
      ids[y * W + x] = id;
      gaps[y * W + x] = d2 - d1;
    }
  const at = (x: number, y: number) => ids[((y + H) % H) * W + ((x + W) % W)]!;
  return { ids, gaps, at };
}

type Macro = Uint32Array;
const NONE = 0xffffffff;

interface Recipe {
  spacing: number;
  jitter: number;
  crack: number;
  /** Colores de una piedra o terrón según su tono aleatorio estable (0–1). */
  pick: (tone: number) => {
    base: number;
    light: number;
    dark: number;
    crack: number;
    fleck: number;
  };
  veinlets?: number;
  inclusions?: number;
  /** Relleno de las diaclasas anchas (tierra infiltrada en el contacto). */
  infill?: number;
}

/**
 * Suelos: matriz homogénea sin contornos, con manchas suaves, terrones,
 * arena y clastos redondeados incrustados. No usan celdas con grietas, que
 * los hacían parecer barro seco o adoquines.
 */
interface EarthRecipe {
  /** Proporción de manchas más oscuras (dithering suave de sombra). */
  patches: number;
  clods: number;
  sand: number;
  pebbles: number;
  pebbleRadius: [number, number];
  roots: number;
  /** Colores: matriz, manchas, terrón claro, terrón oscuro, arena, raicilla. */
  colors?: {
    base: number;
    patch: number;
    lit: number;
    shade: number;
    grain: number;
    root: number;
  };
}
const EARTH: Partial<Record<Material, EarthRecipe>> = {
  // V7: suelo del Atacama, anaranjado y seco, con caliche y raíces secas.
  soil: {
    patches: 0.3,
    clods: 70,
    sand: 0.02,
    pebbles: 7,
    pebbleRadius: [1, 1.6],
    roots: 4,
    colors: {
      base: P.desertSoil,
      patch: P.desertMountain,
      lit: P.desertSand,
      shade: P.desertMountain,
      grain: P.sand,
      root: P.desertRock,
    },
  },
  // Material meteorizado: tierra con gravas y clastos dispersos.
  subsoil: {
    patches: 0.4,
    clods: 45,
    sand: 0.006,
    pebbles: 22,
    pebbleRadius: [1.4, 3],
    roots: 0,
  },
  // V9, biomas verdes: tierra de bosque, marrón oscura, húmeda, con raíces
  // finas y briznas verdes entre los terrones.
  forest: {
    patches: 0.34,
    clods: 60,
    sand: 0.004,
    pebbles: 8,
    pebbleRadius: [1, 1.8],
    roots: 6,
    colors: {
      base: P.earth,
      patch: P.umber,
      lit: P.loam,
      shade: P.umber,
      grain: P.moss,
      root: P.ochre,
    },
  },
  // V9, costa: arena de playa con gránulos claros y algunas conchillas.
  sand: {
    patches: 0.25,
    clods: 26,
    sand: 0.05,
    pebbles: 4,
    pebbleRadius: [1, 1.6],
    roots: 0,
    colors: {
      base: P.sand,
      patch: P.desertMountain,
      lit: P.desertSand,
      shade: P.desertMountain,
      grain: P.cream,
      root: P.desertRock,
    },
  },
};

/**
 * Familias de roca V6: gris azulada (competente), parda (sedimentaria) y
 * violácea (alterada). Cada piedra toma una según su tono estable, así la
 * profundidad no repite el mismo bloque.
 */
const GRAY = {
  base: P.stone,
  light: P.steel,
  dark: P.slate,
  crack: P.slate,
  fleck: P.slate,
};
const BROWN = {
  base: P.taupe,
  light: P.khaki,
  dark: P.earth,
  crack: P.earth,
  fleck: P.soil,
};
const VIOLET = {
  base: P.plum,
  light: P.mauve,
  dark: P.night,
  crack: P.night,
  fleck: P.stone,
};
const DARK = {
  base: P.slate,
  light: P.stone,
  dark: P.night,
  crack: P.night,
  fleck: P.stone,
};

const RECIPES: Partial<Record<Material, Recipe>> = {
  // Contacto alterado: bloques pardos con diaclasas rellenas de tierra.
  weathered: {
    spacing: 16,
    jitter: 0.85,
    crack: 1.7,
    infill: P.soil,
    pick: (tone) =>
      tone < 0.55
        ? { ...BROWN, crack: P.umber, fleck: P.loam }
        : tone < 0.85
          ? { ...GRAY, crack: P.umber, fleck: P.soil }
          : { ...VIOLET, crack: P.umber },
  },
  // Roca sedimentaria: mezcla de bancos grises y pardos con vetillas.
  rock: {
    spacing: 16,
    jitter: 0.85,
    crack: 1.05,
    pick: (tone) => (tone < 0.45 ? GRAY : tone < 0.8 ? BROWN : VIOLET),
    veinlets: 1,
    inclusions: 0.002,
  },
  // Fracturada: bloques pequeños con grietas de pizarra, no de tinta, para
  // que se lea como la misma roca rota y no como otro tipo de ladrillo.
  fractured: {
    spacing: 8,
    jitter: 0.95,
    crack: 1.15,
    pick: (tone) => (tone < 0.5 ? GRAY : tone < 0.75 ? VIOLET : DARK),
  },
  // Roca competente profunda: oscura, azul acero y violácea.
  deep: {
    spacing: 16,
    jitter: 0.8,
    crack: 1,
    pick: (tone) =>
      tone < 0.5
        ? {
            base: P.night,
            light: P.slate,
            dark: P.ink,
            crack: P.ink,
            fleck: P.slate,
          }
        : tone < 0.8
          ? { ...DARK, crack: P.ink }
          : { ...VIOLET, crack: P.ink },
    veinlets: 1,
    inclusions: 0.002,
  },
  // Afloramiento del desierto: bancos de arenisca rojiza y parda, con la
  // misma luz arriba-izquierda y grietas de tierra que el suelo que lo rodea.
  outcrop: {
    spacing: 16,
    jitter: 0.85,
    crack: 1.2,
    pick: (tone) =>
      tone < 0.5
        ? {
            base: P.desertMountain,
            light: P.desertSoil,
            dark: P.desertRock,
            crack: P.umber,
            fleck: P.desertRock,
          }
        : tone < 0.85
          ? {
              base: P.desertRock,
              light: P.desertMountain,
              dark: P.umber,
              crack: P.umber,
              fleck: P.earth,
            }
          : { ...BROWN, crack: P.umber, fleck: P.desertRock },
  },
  // V9, montaña: granito de la cresta, gris claro con bancos ocres y vetas
  // violáceas, a juego con la cordillera dibujada del bioma.
  gravel: {
    // Debe dividir la macrotextura (128 × 64): las celdas son toroidales.
    spacing: 16,
    jitter: 0.9,
    crack: 1.05,
    pick: (tone) =>
      tone < 0.55
        ? {
            base: P.stone,
            light: P.steel,
            dark: P.slate,
            crack: P.night,
            fleck: P.mauve,
          }
        : tone < 0.85
          ? {
              base: P.slate,
              light: P.stone,
              dark: P.night,
              crack: P.night,
              fleck: P.mist,
            }
          : {
              base: P.khaki,
              light: P.silver,
              dark: P.taupe,
              crack: P.taupe,
              fleck: P.stone,
            },
    inclusions: 0.003,
  },
};

/** Suelo continuo (toroidal) con terrones, arena, raicillas y clastos. */
function earthy(recipe: EarthRecipe, seed: number): Macro {
  const random = rng(seed * 7919);
  const { ids } = cells(seed, 16, 0.9);
  const tones = Array.from({ length: (W / 16) * (H / 16) }, () => random());
  const c = recipe.colors ?? {
    base: P.soil,
    patch: P.earth,
    lit: P.loam,
    shade: P.earth,
    grain: P.sand,
    root: P.ochre,
  };
  const out: Macro = new Uint32Array(W * H).fill(c.base);
  const set = (x: number, y: number, color: number) => {
    out[(((y % H) + H) % H) * W + (((x % W) + W) % W)] = color;
  };
  const get = (x: number, y: number) =>
    out[(((y % H) + H) % H) * W + (((x % W) + W) % W)]!;
  // Manchas de humedad: moteado aleatorio y escaso dentro de algunas celdas.
  // Un tablero regular se leía como malla, por eso es estocástico.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (tones[ids[y * W + x]!]! < recipe.patches && random() < 0.14)
        set(x, y, c.patch);
  // Terrones: luz arriba, sombra abajo.
  for (let i = 0; i < recipe.clods; i++) {
    const x = Math.floor(random() * W);
    const y = Math.floor(random() * H);
    const w = 2 + Math.floor(random() * 2);
    for (let k = 0; k < w; k++) {
      set(x + k, y, c.lit);
      set(x + k, y + 1, c.shade);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (random() < recipe.sand) set(x, y, c.grain);
  // Raicillas finas que bajan desde la superficie.
  for (let i = 0; i < recipe.roots; i++) {
    let x = Math.floor(random() * W);
    const y = Math.floor(random() * H);
    const length = 3 + Math.floor(random() * 4);
    for (let k = 0; k < length; k++) {
      set(x, y + k, k % 3 === 2 ? c.shade : c.root);
      if (random() < 0.3) x += random() < 0.5 ? -1 : 1;
    }
  }
  // Clastos redondeados: luz arriba-izquierda, sombra abajo-derecha y una
  // sombra de tierra bajo el borde para que queden incrustados.
  for (let i = 0; i < recipe.pebbles; i++) {
    const cx = Math.floor(random() * W);
    const cy = Math.floor(random() * H);
    const [min, max] = recipe.pebbleRadius;
    const rx = min + random() * (max - min);
    const ry = rx * (0.65 + random() * 0.25);
    const dark = random() < 0.3;
    const inside = (dx: number, dy: number) =>
      (dx / rx) ** 2 + (dy / ry) ** 2 <= 1;
    const reach = Math.ceil(rx) + 1;
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++) {
        if (!inside(dx, dy)) {
          if (inside(dx - 1, dy - 1) && get(cx + dx, cy + dy) !== P.taupe)
            set(cx + dx, cy + dy, P.earth);
          continue;
        }
        // Clastos pardos (comunes) y gris azulados (oscuros).
        let color: number = dark ? P.stone : P.taupe;
        if (!inside(dx - 1, dy) || !inside(dx, dy - 1))
          color = dark ? P.steel : P.khaki;
        else if (!inside(dx + 1, dy) || !inside(dx, dy + 1))
          color = dark ? P.slate : P.earth;
        set(cx + dx, cy + dy, color);
      }
  }
  return out;
}

/** Roca continua: masas grandes y fisuras sueltas, sin contornos por bloque. */
function naturalRock(material: Material, seed: number): Macro {
  const random = rng(seed * 7919);
  const { ids } = cells(seed, 32, 0.95);
  const tones = Array.from({ length: (W / 32) * (H / 32) }, () => random());
  const colorsAt = (id: number) => {
    const tone = tones[id]!;
    if (material === 'weathered') return tone < 0.7 ? BROWN : GRAY;
    if (material === 'deep') return tone < 0.8 ? DARK : VIOLET;
    if (material === 'fractured') return tone < 0.75 ? GRAY : DARK;
    return tone < 0.7 ? GRAY : tone < 0.9 ? DARK : BROWN;
  };
  const out: Macro = new Uint32Array(W * H);
  const set = (x: number, y: number, color: number) => {
    out[(((y % H) + H) % H) * W + (((x % W) + W) % W)] = color;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) out[y * W + x] = colorsAt(ids[y * W + x]!).base;

  // Estrías cortas con sombra y arista clara; ninguna cierra una celda.
  for (let n = 0; n < 19; n++) {
    let x = Math.floor(random() * W);
    let y = Math.floor(random() * H);
    let dx = random() < 0.5 ? -1 : 1;
    const colors = colorsAt(ids[y * W + x]!);
    const length = 5 + Math.floor(random() * 18);
    for (let step = 0; step < length; step++) {
      set(x, y, colors.crack);
      if (step % 3 === 0) set(x, y - 1, colors.light);
      if (random() < 0.36) y += random() < 0.5 ? -1 : 1;
      if (random() < 0.08) {
        x += dx;
        y += random() < 0.5 ? -1 : 1;
        dx = -dx;
      } else x += dx;
    }
  }
  // Pequeños planos minerales agrupados, sin ruido uniforme.
  for (let n = 0; n < 55; n++) {
    const x = Math.floor(random() * W);
    const y = Math.floor(random() * H);
    const colors = colorsAt(ids[y * W + x]!);
    set(x, y, colors.light);
    if (random() < 0.55) set(x + 1, y, colors.light);
    if (random() < 0.4) set(x + 1, y + 1, colors.dark);
  }
  return out;
}

function macro(material: Material, seed: number, fillSeams: boolean): Macro {
  const earth = EARTH[material];
  if (earth) return earthy(earth, seed);
  const recipe = RECIPES[material]!;
  if (fillSeams) return naturalRock(material, seed);
  const random = rng(seed * 7919);
  const { ids, gaps, at } = cells(seed, recipe.spacing, recipe.jitter);
  const tones = Array.from(
    { length: (W / recipe.spacing) * (H / recipe.spacing) },
    () => random(),
  );
  const out: Macro = new Uint32Array(W * H).fill(NONE);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const id = ids[i]!;
      const colors = recipe.pick(tones[id]!);
      let color = colors.base;
      if (gaps[i]! < recipe.crack)
        color = fillSeams
          ? colors.base
          : recipe.infill && gaps[i]! >= 0.7
            ? recipe.infill
            : colors.crack;
      else if (at(x - 1, y) !== id || at(x, y - 1) !== id) color = colors.light;
      else if (
        at(x + 1, y) !== id ||
        at(x, y + 1) !== id ||
        at(x + 1, y + 1) !== id
      )
        color = colors.dark;
      else if (random() < 0.05) color = colors.fleck;
      else if (recipe.inclusions && random() < recipe.inclusions)
        color = [P.peach, P.gold, P.mint][Math.floor(random() * 3)]!;
      out[i] = color;
    }
  // Vetillas de cuarzo: líneas finas onduladas que cruzan varias piedras.
  for (let v = 0; v < (recipe.veinlets ?? 0); v++) {
    const y0 = random() * H;
    const slope = (random() - 0.5) * 0.25;
    const phase = random() * 6;
    let previous = -1;
    for (let x = 0; x < W; x++) {
      const y =
        Math.floor(y0 + x * slope + Math.sin(x / 14 + phase) * 4 + H) % H;
      const fill = (yy: number) => {
        const i = yy * W + x;
        if (gaps[i]! >= recipe.crack)
          out[i] = material === 'deep' ? P.stone : P.mist;
      };
      fill(y);
      // Escalón vertical continuo, sin diagonales sueltas.
      if (
        previous >= 0 &&
        Math.abs(previous - y) > 1 &&
        Math.abs(previous - y) < H / 2
      )
        for (
          let yy = Math.min(previous, y) + 1;
          yy < Math.max(previous, y);
          yy++
        )
          fill(yy);
      previous = y;
    }
  }
  return out;
}

/** Crea la textura `terrain` (8 columnas de tiles) y registra un frame por tile. */
export function createTerrainTexture(scene: Phaser.Scene): void {
  buildTerrainTexture(scene, 'terrain');
}

export const SOLID_TERRAIN_TEXTURE = 'terrain-solid';

export function createSolidTerrainTexture(scene: Phaser.Scene): void {
  buildTerrainTexture(scene, SOLID_TERRAIN_TEXTURE);
}

function buildTerrainTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const rows = Math.ceil(TERRAIN_FRAME_COUNT / TERRAIN_TEXTURE_COLUMNS);
  const width = TERRAIN_TEXTURE_COLUMNS * TILE_SIZE;
  const texture = scene.textures.createCanvas(key, width, rows * TILE_SIZE)!;
  const ctx = texture.context;
  ctx.imageSmoothingEnabled = false;
  const image = ctx.createImageData(width, rows * TILE_SIZE);
  const put = (x: number, y: number, color: number) => {
    const i = (y * width + x) * 4;
    image.data[i] = (color >> 16) & 255;
    image.data[i + 1] = (color >> 8) & 255;
    image.data[i + 2] = color & 255;
    image.data[i + 3] = 255;
  };
  const clear = (x: number, y: number) => {
    image.data[(y * width + x) * 4 + 3] = 0;
  };
  const origin = (frame: number) => ({
    ox: (frame % TERRAIN_TEXTURE_COLUMNS) * TILE_SIZE,
    oy: Math.floor(frame / TERRAIN_TEXTURE_COLUMNS) * TILE_SIZE,
  });
  const rect = (
    frame: number,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
  ) => {
    const { ox, oy } = origin(frame);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) put(ox + x + i, oy + y + j, color);
  };

  // Macrotexturas: cada material ocupa 4 filas de la textura.
  const macros = new Map<Material, Macro>();
  MATERIALS.forEach((material, index) => {
    const fillSeams =
      material === 'weathered' ||
      material === 'rock' ||
      material === 'fractured' ||
      material === 'deep' ||
      material === 'gravel';
    const pixels = macro(material, 101 + index * 37, fillSeams);
    macros.set(material, pixels);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) put(x, index * H + y, pixels[y * W + x]!);
  });
  /** Copia la ventana (column,row) de una macrotextura a un frame especial. */
  const window = (
    frame: number,
    material: Material,
    column: number,
    row: number,
  ) => {
    const pixels = macros.get(material)!;
    const { ox, oy } = origin(frame);
    for (let y = 0; y < TILE_SIZE; y++)
      for (let x = 0; x < TILE_SIZE; x++)
        put(
          ox + x,
          oy + y,
          pixels[(row * TILE_SIZE + y) * W + column * TILE_SIZE + x]!,
        );
  };

  // Lecho: bandas trabadas, casi negro, con líneas claras discontinuas.
  [F.Bedrock, F.BedrockAlt].forEach((frame, v) => {
    rect(frame, 0, 0, 16, 16, P.ink);
    rect(frame, 0, 1, 16, 5, P.night);
    rect(frame, 0, 9, 16, 5, P.night);
    rect(frame, v ? 9 : 2, 1, 5, 1, P.slate);
    rect(frame, v ? 1 : 10, 9, 5, 1, P.slate);
    rect(frame, v ? 4 : 7, 1, 2, 5, P.ink);
    rect(frame, v ? 12 : 3, 9, 2, 5, P.ink);
  });

  // V7, costra del Atacama: arena clara arriba, gravilla y piedrecillas,
  // base anaranjada sombreada y caliche que gotea sobre la tierra. Conserva
  // los nombres Grass* de los frames (la colisión no depende de ellos).
  const grass = (
    frame: number,
    left: boolean,
    right: boolean,
    variant: number,
  ) => {
    window(frame, 'soil', variant, 0);
    rect(frame, 0, 0, 16, 1, P.desertSand);
    rect(frame, 0, 1, 16, 2, P.sand);
    rect(frame, 0, 3, 16, 1, P.desertSoil);
    rect(frame, 0, 4, 16, 1, P.desertMountain);
    // Granos, gravilla y costra que cuelga en posiciones irregulares.
    const random = rng(500 + variant);
    for (let x = 0; x < 16; x++) {
      const r = random();
      if (r < 0.22) rect(frame, x, 1, 1, 1, P.desertSand);
      else if (r < 0.34) rect(frame, x, 2, 1, 1, P.desertSoil);
      else if (r < 0.4) rect(frame, x, 0, 1, 1, P.cream);
      const hang = random();
      if (hang < 0.26)
        rect(frame, x, 5, 1, 1 + Math.floor(random() * 2), P.desertMountain);
      else if (hang < 0.36) rect(frame, x, 5, 1, 1, P.desertSoil);
      else if (hang < 0.46) rect(frame, x, 5, 1, 1, P.desertRock);
    }
    // Piedrecillas con luz arriba-izquierda (una o dos por variante).
    const pebble = (x: number, y: number) => {
      rect(frame, x, y, 2, 1, P.khaki);
      rect(frame, x, y + 1, 2, 1, P.desertRock);
      rect(frame, x + 2, y + 1, 1, 1, P.desertMountain);
    };
    pebble(2 + variant * 2, 1);
    if (variant % 2) pebble(11, 2);
    const { ox, oy } = origin(frame);
    [left, right].forEach((on, side) => {
      if (!on) return;
      const edge = (x: number) => (side === 0 ? x : 15 - x);
      for (let x = 0; x < 3; x++) clear(ox + edge(x), oy);
      for (let x = 0; x < 2; x++) clear(ox + edge(x), oy + 1);
      clear(ox + edge(0), oy + 2);
      rect(frame, edge(3), 0, 1, 1, P.desertSand);
      rect(frame, edge(2), 1, 1, 1, P.desertSand);
      rect(frame, edge(1), 2, 1, 1, P.desertSoil);
      rect(frame, edge(0), 3, 1, 1, P.desertSoil);
      rect(frame, edge(0), 4, 1, 2, P.desertMountain);
    });
  };
  grass(F.Grass, false, false, 1);
  grass(F.GrassLeft, true, false, 2);
  grass(F.GrassRight, false, true, 3);
  grass(F.GrassPeak, true, true, 4);

  // V9: costras de los biomas nuevos, con la misma luz y esquinas que la
  // del desierto. Costa: arena clara con gránulos y una conchilla. Biomas
  // verdes: pasto teal con briznas claras que se apaga a tierra oscura.
  const coast = (
    frame: number,
    left: boolean,
    right: boolean,
    variant: number,
  ) => {
    window(frame, 'sand', variant, 0);
    rect(frame, 0, 0, 16, 1, P.desertSand);
    rect(frame, 0, 1, 16, 2, P.sand);
    rect(frame, 0, 3, 16, 1, P.sand);
    rect(frame, 0, 4, 16, 1, P.desertMountain);
    const random = rng(600 + variant);
    for (let x = 0; x < 16; x++) {
      const r = random();
      if (r < 0.18) rect(frame, x, 0, 1, 1, P.cream);
      else if (r < 0.32) rect(frame, x, 2, 1, 1, P.desertSand);
      else if (r < 0.4) rect(frame, x, 4, 1, 1, P.sand);
      const hang = random();
      if (hang < 0.22)
        rect(frame, x, 5, 1, 1 + Math.floor(random() * 2), P.desertMountain);
      else if (hang < 0.32) rect(frame, x, 5, 1, 1, P.sand);
    }
    // Conchilla con luz arriba-izquierda (una por variante).
    const shell = 3 + (variant % 3) * 4;
    rect(frame, shell, 2, 2, 1, P.cream);
    rect(frame, shell, 3, 2, 1, P.khaki);
    const { ox, oy } = origin(frame);
    [left, right].forEach((on, side) => {
      if (!on) return;
      const edge = (x: number) => (side === 0 ? x : 15 - x);
      for (let x = 0; x < 3; x++) clear(ox + edge(x), oy);
      for (let x = 0; x < 2; x++) clear(ox + edge(x), oy + 1);
      clear(ox + edge(0), oy + 2);
      rect(frame, edge(3), 0, 1, 1, P.desertSand);
      rect(frame, edge(2), 1, 1, 1, P.sand);
      rect(frame, edge(1), 2, 1, 1, P.sand);
      rect(frame, edge(0), 3, 1, 1, P.sand);
      rect(frame, edge(0), 4, 1, 2, P.desertMountain);
    });
  };
  coast(F.SandTop, false, false, 1);
  coast(F.SandTopLeft, true, false, 2);
  coast(F.SandTopRight, false, true, 3);
  coast(F.SandTopPeak, true, true, 4);
  const meadow = (
    frame: number,
    left: boolean,
    right: boolean,
    variant: number,
  ) => {
    window(frame, 'forest', variant, 0);
    rect(frame, 0, 0, 16, 1, P.pine);
    rect(frame, 0, 1, 16, 2, P.teal);
    rect(frame, 0, 3, 16, 1, P.forest);
    rect(frame, 0, 4, 16, 1, P.umber);
    const random = rng(650 + variant);
    for (let x = 0; x < 16; x++) {
      const r = random();
      if (r < 0.18) rect(frame, x, 0, 1, 1, P.teal);
      else if (r < 0.3) rect(frame, x, 1, 1, 1, P.mint);
      else if (r < 0.38) rect(frame, x, 3, 1, 1, P.moss);
      const hang = random();
      if (hang < 0.24)
        rect(frame, x, 5, 1, 1 + Math.floor(random() * 2), P.forest);
      else if (hang < 0.34) rect(frame, x, 5, 1, 1, P.umber);
    }
    // Flor blanca diminuta (una por variante).
    rect(frame, 5 + (variant % 3) * 3, 1, 1, 1, P.white);
    const { ox, oy } = origin(frame);
    [left, right].forEach((on, side) => {
      if (!on) return;
      const edge = (x: number) => (side === 0 ? x : 15 - x);
      for (let x = 0; x < 3; x++) clear(ox + edge(x), oy);
      for (let x = 0; x < 2; x++) clear(ox + edge(x), oy + 1);
      clear(ox + edge(0), oy + 2);
      rect(frame, edge(3), 0, 1, 1, P.pine);
      rect(frame, edge(2), 1, 1, 1, P.teal);
      rect(frame, edge(1), 2, 1, 1, P.teal);
      rect(frame, edge(0), 3, 1, 1, P.forest);
      rect(frame, edge(0), 4, 1, 2, P.umber);
    });
  };
  meadow(F.GreenTop, false, false, 1);
  meadow(F.GreenTopLeft, true, false, 2);
  meadow(F.GreenTopRight, false, true, 3);
  meadow(F.GreenTopPeak, true, true, 4);

  // Menas: ventana de roca + veta importada (senmou, CC0) y contorno de veta.
  const veins = scene.textures.exists('ore-veins')
    ? (scene.textures.get('ore-veins').getSourceImage() as HTMLImageElement)
    : null;
  for (let i = 0; i < 9; i++)
    window(
      F.OreFirst + i,
      i >= 4 ? 'deep' : 'rock',
      (i + 1) % MACRO_COLUMNS,
      i % MACRO_ROWS,
    );
  // Gemas, diamante y mineral desconocido: cristales originales por código,
  // con contorno de tinta, cara clara arriba-izquierda y sombra abajo.
  const crystal = (
    frame: number,
    seeds: [number, number][],
    [dark, mid, light]: readonly [number, number, number],
  ) => {
    for (const [x, y] of seeds) {
      rect(frame, x - 1, y - 2, 4, 6, P.ink);
      rect(frame, x - 2, y - 1, 6, 4, P.ink);
      rect(frame, x - 1, y - 1, 4, 4, mid);
      rect(frame, x, y - 2 + 1, 1, 1, light);
      rect(frame, x - 1, y - 1, 1, 2, light);
      rect(frame, x + 2, y + 1, 1, 2, dark);
      rect(frame, x, y + 2, 2, 1, dark);
    }
  };
  const gemSpots: [number, number][] = [
    [4, 4],
    [11, 7],
    [6, 12],
  ];
  crystal(F.OreFirst + 4, gemSpots, [P.pine, P.teal, P.mint]);
  crystal(F.OreFirst + 5, gemSpots, [P.rust, P.red, P.peach]);
  crystal(F.OreFirst + 6, gemSpots, [P.sky, P.blue, P.mist]);
  crystal(
    F.OreFirst + 7,
    [
      [5, 5],
      [11, 11],
    ],
    [P.mist, P.white, P.white],
  );
  rect(F.OreFirst + 7, 5, 3, 1, 1, P.silver);
  rect(F.OreFirst + 7, 12, 10, 1, 1, P.silver);
  // Mineral desconocido: anillos concéntricos y nódulos que no siguen ninguna
  // forma cristalina conocida.
  {
    const f = F.OreFirst + 8;
    rect(f, 3, 3, 10, 10, P.ink);
    rect(f, 4, 4, 8, 8, P.pine);
    rect(f, 5, 5, 6, 6, P.mint);
    rect(f, 6, 6, 4, 4, P.teal);
    rect(f, 7, 7, 2, 2, P.peach);
    for (const [x, y] of [
      [2, 8],
      [13, 7],
      [8, 1],
      [7, 14],
    ] as const)
      rect(f, x, y, 1, 1, P.mint);
    rect(f, 5, 5, 1, 1, P.white);
  }
  // Cristal violeta (V10): racimo de prismas sobre roca profunda, con
  // contorno de tinta, cara clara arriba-izquierda y destello blanco.
  [F.Crystal, F.CrystalAlt].forEach((frame, v) => {
    window(frame, 'deep', 1 + v * 2, 1 + v);
    const prism = (x: number, y: number, w: number, h: number) => {
      rect(frame, x - 1, y - 1, w + 2, h + 2, P.ink);
      rect(frame, x, y, w, h, P.duskViolet);
      rect(frame, x, y, 1, h, P.mauve);
      rect(frame, x + w - 1, y + 1, 1, h - 1, P.plum);
      rect(frame, x, y, 1, 1, P.white);
    };
    prism(3 + v, 6, 3, 7);
    prism(8, 3 + v, 4, 9);
    prism(11, 8, 3, 6);
  });
  // Escombro: bloques sueltos apilados, polvo y huecos oscuros.
  [F.Rubble, F.RubbleAlt].forEach((frame, v) => {
    rect(frame, 0, 0, 16, 16, P.night);
    const random = rng(700 + v);
    for (let n = 0; n < 9; n++) {
      const w = 3 + Math.floor(random() * 4),
        h = 2 + Math.floor(random() * 3),
        x = Math.floor(random() * (17 - w)),
        y = Math.floor(random() * (17 - h));
      rect(frame, x, y, w, h, P.ink);
      rect(
        frame,
        x + 1,
        y + 1,
        Math.max(1, w - 2),
        Math.max(1, h - 2),
        P.stone,
      );
      rect(frame, x + 1, y + 1, Math.max(1, w - 2), 1, P.steel);
    }
    for (let x = 0; x < 16; x += 3) rect(frame, x, 15, 2, 1, P.umber);
  });
  // Madera colocada (V11): cuatro tablones con vetas, junta y clavos.
  {
    const f = F.Wood;
    rect(f, 0, 0, 16, 16, P.umber);
    for (let i = 0; i < 4; i++) {
      const y = i * 4;
      rect(f, 0, y, 16, 3, P.clay);
      rect(f, 0, y, 16, 1, P.amber);
      rect(f, 2 + ((i * 5) % 9), y + 1, 5, 1, P.earth);
      rect(f, i % 2 ? 6 : 11, y, 1, 3, P.umber);
      rect(f, 1, y + 1, 1, 1, P.ink);
      rect(f, 14, y + 1, 1, 1, P.ink);
    }
  }
  // Roca dura: base profunda con cristales de feldespato y trama más densa.
  [F.HardRock, F.HardRockAlt].forEach((frame, v) => {
    window(frame, 'deep', 2 + v * 3, v);
    const random = rng(800 + v);
    for (let n = 0; n < 7; n++) {
      const x = Math.floor(random() * 15),
        y = Math.floor(random() * 15);
      rect(frame, x, y, 2, 1, P.rust);
      rect(frame, x, y + 1, 1, 1, P.umber);
    }
    for (let y = 2; y < 16; y += 5) rect(frame, (y * 7) % 13, y, 3, 1, P.slate);
  });

  // Bordes de autotile: contorno de tinta en caras expuestas y sombra de techo.
  for (let mask = 1; mask < 16; mask++) {
    const frame = F.EdgeFirst + mask;
    if (mask & 1) rect(frame, 0, 0, 16, 1, P.ink);
    if (mask & 2) rect(frame, 15, 0, 1, 16, P.ink);
    if (mask & 8) rect(frame, 0, 0, 1, 16, P.ink);
    if (mask & 4) {
      rect(frame, 0, 15, 16, 1, P.ink);
      for (let x = 0; x < 16; x += 2) rect(frame, x + 1, 14, 1, 1, P.night);
    }
  }

  // Transiciones: la capa superior se mete en la inferior con borde irregular.
  for (let v = 0; v < 8; v++) {
    const frame = F.TransitionFirst + v;
    const random = rng(900 + v);
    const deep = v >= 4;
    for (let x = 0; x < 16; x++) {
      const depth = 1 + Math.floor(random() * (deep ? 2 : 3));
      for (let y = 0; y < depth; y++)
        rect(
          frame,
          x,
          y,
          1,
          1,
          deep
            ? y === depth - 1
              ? P.slate
              : P.stone
            : y === depth - 1
              ? P.earth
              : random() < 0.2
                ? P.loam
                : P.soil,
        );
    }
  }

  // Grietas de impacto en cuatro etapas, desde el centro del golpe.
  const crackPaths: [number, number][][] = [
    [
      [8, 8],
      [6, 6],
      [5, 5],
      [3, 4],
    ],
    [
      [8, 8],
      [10, 7],
      [12, 7],
      [14, 6],
    ],
    [
      [8, 8],
      [8, 10],
      [7, 12],
      [7, 14],
    ],
    [
      [8, 8],
      [5, 10],
      [3, 11],
      [1, 13],
    ],
    [
      [8, 8],
      [11, 11],
      [12, 13],
      [14, 15],
    ],
    [
      [8, 8],
      [9, 5],
      [10, 3],
      [10, 1],
    ],
  ];
  for (let stage = 0; stage < 4; stage++) {
    const frame = F.CrackFirst + stage;
    const length = 2 + stage;
    crackPaths.slice(0, 3 + stage).forEach((path) =>
      path
        .slice(0, Math.min(path.length, length))
        .forEach(([x, y], i, list) => {
          rect(frame, x, y, 1, 1, P.ink);
          const next = list[i + 1];
          if (next)
            rect(
              frame,
              Math.round((x + next[0]) / 2),
              Math.round((y + next[1]) / 2),
              1,
              1,
              P.ink,
            );
        }),
    );
    if (stage === 3)
      for (const [x, y] of [
        [4, 7],
        [11, 9],
        [7, 3],
        [9, 13],
      ] as const)
        rect(frame, x, y, 2, 1, P.night);
  }

  ctx.putImageData(image, 0, 0);
  // Vetas importadas (senmou, CC0): columnas 0 carbón, 1 cobre, 2 hierro,
  // 4 oro de la hoja original; se reordenan al orden económico V3.
  if (veins)
    [0, 2, 1, 4].forEach((sheet, i) => {
      const { ox, oy } = origin(F.OreFirst + i);
      ctx.drawImage(veins, sheet * 16, 0, 16, 16, ox, oy, 16, 16);
    });
  for (let frame = 0; frame < TERRAIN_FRAME_COUNT; frame++) {
    const { ox, oy } = origin(frame);
    texture.add(frame, 0, ox, oy, TILE_SIZE, TILE_SIZE);
  }
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}
