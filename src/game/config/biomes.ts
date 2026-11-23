import { TILE_SIZE, WORLD, WORLD_FIRST_COLUMN } from './constants';

/**
 * Zonas del mundo. Desde el 18 de noviembre de 2026 todo el mundo es el
 * Desierto de Atacama en la región de Antofagasta: los biomas verdes, la
 * montaña nevada y los fondos CraftPix de V9 se retiraron. Las siete zonas
 * conservan exactamente las columnas, el relieve (`profile`) y el contacto
 * con la roca (`rockTop`) de los biomas a los que reemplazan, así el terreno
 * que sale de la semilla, los yacimientos y las partidas guardadas no
 * cambian; solo cambian el aspecto, el nombre y sus monumentos.
 *
 * - Mundo abierto (18 de noviembre de 2026): Salar de Atacama, Valle de la
 *   Luna, Sierra Gorda y Cerro Paranal, al oeste (−760..−121). Zonas nuevas,
 *   sin partidas anteriores que conservar.
 * - Mano del Desierto (antes monolitos).
 * - Desierto de Atacama: campamento, bodega, mina y cabaña (−40..139).
 * - Pampa Salitrera (antes valle), Estación del FCAB (antes bosque),
 *   Ruinas de Huanchaca (antes pinar), Cerros de la Costa (antes cordillera)
 *   y La Portada (antes costa), al este.
 *
 * Todas se excavan y se construyen igual: el mundo entero es una cuadrícula.
 *
 * Los monumentos están en world/Landmarks.ts y el fondo en world/Backdrop.ts
 * (cordilleras del desierto; mar y La Portada en la costa).
 *
 * Este módulo es puro: no importa Phaser ni el terreno, solo geometría.
 */
export type BiomeId =
  | 'salar'
  | 'moon'
  | 'sierra'
  | 'paranal'
  | 'hand'
  | 'desert'
  | 'pampa'
  | 'fcab'
  | 'huanchaca'
  | 'hills'
  | 'portada';

/**
 * Identificadores anteriores (V9), guardados en partidas existentes. Cada
 * zona nueva ocupa las mismas columnas que la que reemplaza.
 */
export const LEGACY_BIOME_IDS: Readonly<Record<string, BiomeId>> = {
  monoliths: 'hand',
  valley: 'pampa',
  forest: 'fcab',
  pines: 'huanchaca',
  mountain: 'hills',
  coast: 'portada',
};

/** Familia del suelo: costra del desierto o arena de la playa. */
export type EarthGroup = 'desert' | 'sand';

/** Partículas de ambiente propias de cada zona (sin alfa parcial). */
export type Ambience = 'dust' | 'wind' | 'spray';

/** Fondo de la zona: cordilleras del desierto o el mar con La Portada. */
export type BackdropKind = 'desert' | 'coast';

/** Relieve de la superficie: senos compuestos, deterministas y sin estado. */
export interface BiomeProfile {
  base: number;
  amp: number;
  f1: number;
  f2: number;
  phase: number;
  clamp: readonly [number, number];
}

/** Probabilidad por columna de cada tipo de decoración (y separación mínima). */
export interface DecorRule {
  trees: number;
  treeGap: number;
  plants: number;
  rocks: number;
}

export interface BiomeDef {
  id: BiomeId;
  /** Nombre en el HUD (fuente 5 × 7: mayúsculas sin tildes). */
  name: string;
  /** Primera y última columna del mundo (inclusive). */
  from: number;
  to: number;
  earth: EarthGroup;
  /** Fila donde empieza la roca bajo la tierra. */
  rockTop: number;
  /** Relieve propio; el desierto central conserva sus perfiles fijos. */
  profile: BiomeProfile | null;
  decor: DecorRule;
  ambience: Ambience;
  backdrop: BackdropKind;
}

/** Zonas de oeste a este, sin huecos ni solapes. */
export const BIOMES: readonly BiomeDef[] = [
  {
    id: 'salar',
    name: 'SALAR DE ATACAMA',
    from: -760,
    to: -601,
    earth: 'desert',
    rockTop: 13,
    profile: { base: 10, amp: 0.6, f1: 14, f2: 6, phase: 0.2, clamp: [10, 11] },
    decor: { trees: 0.02, treeGap: 14, plants: 0.16, rocks: 0.08 },
    ambience: 'wind',
    backdrop: 'desert',
  },
  {
    id: 'moon',
    name: 'VALLE DE LA LUNA',
    from: -600,
    to: -441,
    earth: 'desert',
    rockTop: 11,
    profile: { base: 9, amp: 1.6, f1: 7, f2: 3.1, phase: 0.9, clamp: [7, 11] },
    decor: { trees: 0.02, treeGap: 12, plants: 0.12, rocks: 0.24 },
    ambience: 'wind',
    backdrop: 'desert',
  },
  {
    id: 'sierra',
    name: 'SIERRA GORDA',
    from: -440,
    to: -281,
    earth: 'desert',
    rockTop: 12,
    profile: { base: 10, amp: 1, f1: 10, f2: 4.7, phase: 1.6, clamp: [9, 11] },
    decor: { trees: 0.05, treeGap: 9, plants: 0.22, rocks: 0.14 },
    ambience: 'dust',
    backdrop: 'desert',
  },
  {
    id: 'paranal',
    name: 'CERRO PARANAL',
    from: -280,
    to: -121,
    earth: 'desert',
    rockTop: 11,
    profile: { base: 8, amp: 1.5, f1: 16, f2: 6.3, phase: 2.6, clamp: [6, 10] },
    decor: { trees: 0.04, treeGap: 10, plants: 0.18, rocks: 0.2 },
    ambience: 'wind',
    backdrop: 'desert',
  },
  {
    id: 'hand',
    name: 'MANO DEL DESIERTO',
    from: -120,
    to: -41,
    earth: 'desert',
    rockTop: 12,
    profile: { base: 10, amp: 1, f1: 15, f2: 7, phase: 0.4, clamp: [9, 11] },
    decor: { trees: 0.05, treeGap: 9, plants: 0.2, rocks: 0.14 },
    ambience: 'dust',
    backdrop: 'desert',
  },
  {
    id: 'desert',
    name: 'DESIERTO DE ATACAMA',
    from: -40,
    to: 139,
    earth: 'desert',
    rockTop: 13,
    profile: null,
    decor: { trees: 0.12, treeGap: 6, plants: 0.3, rocks: 0.1 },
    ambience: 'dust',
    backdrop: 'desert',
  },
  {
    id: 'pampa',
    name: 'PAMPA SALITRERA',
    from: 140,
    to: 219,
    earth: 'desert',
    rockTop: 13,
    profile: { base: 10, amp: 1.1, f1: 9, f2: 4.3, phase: 1.1, clamp: [9, 11] },
    decor: { trees: 0.04, treeGap: 10, plants: 0.22, rocks: 0.12 },
    ambience: 'dust',
    backdrop: 'desert',
  },
  {
    id: 'fcab',
    name: 'ESTACION DEL FCAB',
    from: 220,
    to: 283,
    earth: 'desert',
    rockTop: 13,
    profile: { base: 10, amp: 0.7, f1: 17, f2: 5, phase: 2.3, clamp: [9, 10] },
    decor: { trees: 0.06, treeGap: 8, plants: 0.24, rocks: 0.1 },
    ambience: 'dust',
    backdrop: 'desert',
  },
  {
    id: 'huanchaca',
    name: 'RUINAS DE HUANCHACA',
    from: 284,
    to: 347,
    earth: 'desert',
    rockTop: 12,
    profile: { base: 10, amp: 0.9, f1: 13, f2: 5.7, phase: 0.7, clamp: [9, 10] },
    decor: { trees: 0.04, treeGap: 9, plants: 0.2, rocks: 0.16 },
    ambience: 'dust',
    backdrop: 'desert',
  },
  {
    id: 'hills',
    name: 'CERROS DE LA COSTA',
    from: 348,
    to: 415,
    earth: 'desert',
    rockTop: 11,
    profile: { base: 8, amp: 1.4, f1: 11, f2: 5, phase: 1.9, clamp: [7, 10] },
    decor: { trees: 0.03, treeGap: 10, plants: 0.18, rocks: 0.2 },
    ambience: 'wind',
    backdrop: 'desert',
  },
  {
    id: 'portada',
    name: 'LA PORTADA',
    from: 416,
    to: 471,
    earth: 'sand',
    rockTop: 13,
    profile: { base: 10, amp: 0.8, f1: 12, f2: 6, phase: 2.9, clamp: [10, 11] },
    decor: { trees: 0, treeGap: 99, plants: 0.26, rocks: 0.18 },
    ambience: 'spray',
    backdrop: 'coast',
  },
];

export const BIOME_IDS: readonly BiomeId[] = BIOMES.map((b) => b.id);

/** Zona de un identificador guardado (actual o de V9); null si no existe. */
export function normalizeBiomeId(value: unknown): BiomeId | null {
  if (typeof value !== 'string') return null;
  if ((BIOME_IDS as readonly string[]).includes(value)) return value as BiomeId;
  return LEGACY_BIOME_IDS[value] ?? null;
}

/** Compatibilidad: zonas por columna (id, from, to). */
export type BiomeZone = Pick<BiomeDef, 'id' | 'from' | 'to'>;
export const BIOME_ZONES: readonly BiomeZone[] = BIOMES;

const byId = new Map<BiomeId, BiomeDef>(BIOMES.map((b) => [b.id, b]));
export const biomeDef = (id: BiomeId): BiomeDef => byId.get(id)!;

/**
 * Medio ancho (px) del cruce entre dos zonas: la decoración pasa de una a la
 * otra a lo largo de 512 px de caminata, sin cortes. Junto al desierto
 * central la banda entera cae del lado de la zona vecina.
 */
export const BIOME_BAND = 256;

/** Límites de la zona en px del mundo: [izquierda, derechaExclusive). */
export function biomeSpan(id: BiomeId): [number, number] {
  const b = biomeDef(id);
  return [b.from * TILE_SIZE, (b.to + 1) * TILE_SIZE];
}

/** Zona de una columna del mundo (fuera de rango: la más cercana). */
export function biomeAtColumn(column: number): BiomeId {
  if (column < BIOMES[0]!.from) return BIOMES[0]!.id;
  for (const b of BIOMES) if (column <= b.to) return b.id;
  return BIOMES[BIOMES.length - 1]!.id;
}

/** Zona de un punto x del mundo (px). */
export const biomeAtX = (x: number): BiomeId =>
  biomeAtColumn(Math.floor(x / TILE_SIZE));

/** Banda de cruce [desde, hasta) en px del borde entre la zona i y la i+1. */
export function crossingBand(i: number, half = BIOME_BAND): [number, number] {
  const border = BIOMES[i + 1]!.from * TILE_SIZE;
  if (BIOMES[i]!.id === 'desert') return [border, border + half * 2];
  if (BIOMES[i + 1]!.id === 'desert') return [border - half * 2, border];
  return [border - half, border + half];
}

/**
 * Mezcla de zonas en un punto x: índice de la zona izquierda `a` y fracción
 * `t` (0..1) de la zona siguiente `a + 1`. Nunca hay más de dos zonas a la
 * vez; fuera de las bandas de cruce `t` vale 0 (zona pura).
 */
export interface BiomeBlend {
  a: number;
  t: number;
}

export function biomeBlend(x: number, half = BIOME_BAND): BiomeBlend {
  for (let i = 0; i < BIOMES.length - 1; i++) {
    const [lo, hi] = crossingBand(i, half);
    if (x < lo) return { a: i, t: 0 };
    if (x < hi) return { a: i, t: (x - lo) / (hi - lo) };
  }
  return { a: BIOMES.length - 1, t: 0 };
}

/**
 * Peso de presencia de cada zona (mismo orden que BIOMES) en un punto x:
 * suman 1 y a lo sumo dos son distintos de cero.
 */
export function biomeWeights(x: number, half = BIOME_BAND): number[] {
  const { a, t } = biomeBlend(x, half);
  const w = BIOMES.map(() => 0);
  w[a] = 1 - t;
  if (t > 0) w[a + 1] = t;
  return w;
}

/**
 * Recorrido del centro de la cámara (px) durante el que una zona pesa algo:
 * desde el comienzo de su banda izquierda hasta el final de la derecha.
 */
export function biomePresence(id: BiomeId, half = BIOME_BAND): [number, number] {
  const i = BIOME_IDS.indexOf(id);
  const [left, right] = biomeSpan(id);
  const lo = i > 0 ? crossingBand(i - 1, half)[0] : left;
  const hi = i < BIOMES.length - 1 ? crossingBand(i, half)[1] : right;
  return [Math.min(lo, left), Math.max(hi, right)];
}

/** Hash entero estable (el mismo criterio que TerrainVisuals). */
const hash = (column: number, seed: number) =>
  ((column * 73856093) ^ (seed * 19349663)) >>> 0;

/** Fracción estable 0..1 de una columna para un canal dado. */
export const columnNoise = (column: number, channel: number): number =>
  (hash(column, channel) % 1000) / 1000;

/**
 * Zona «tramada» de una columna: en la banda de cruce cada columna toma una
 * de las dos zonas según su ruido estable contra la fracción `t`. Así la
 * costra y la arena (o los cactus y las matas de playa) se entremezclan unos
 * bloques antes del cambio en vez de dibujar una franja dura.
 */
export function ditheredBiome(
  column: number,
  half: number,
  channel = 5,
  row?: number,
): BiomeId {
  const { a, t } = biomeBlend(column * TILE_SIZE + 8, half);
  if (t <= 0) return BIOMES[a]!.id;
  // Con fila, el ruido es por bloques de 2 × 2 celdas: terrones mezclados
  // en vez de columnas enteras de un mismo suelo.
  const noise =
    row === undefined
      ? columnNoise(column, channel)
      : columnNoise(
          Math.floor(column / 2) * 7919 + Math.floor(row / 2) * 104729,
          channel,
        );
  return BIOMES[noise < t ? a + 1 : a]!.id;
}

/**
 * Familia visual del suelo. El cruce de suelo es corto (±4 bloques alrededor
 * del borde): la tierra cambia de verdad en el borde. Sin `row` decide la
 * cubierta de la superficie (por columna); con `row`, cada bloque de tierra
 * se mezcla por separado, así el cruce bajo el suelo son manchas y no franjas
 * verticales.
 */
export function earthGroup(column: number, row?: number, half = 64): EarthGroup {
  return biomeDef(ditheredBiome(column, half, 5, row)).earth;
}

/**
 * Fila donde empieza la roca en cada zona: en los Cerros de la Costa sube
 * casi a la superficie (crestas de roca viva), en Huanchaca y en la Mano del
 * Desierto un poco antes que en el desierto central (siempre 13).
 */
export function rockTopRow(column: number): number {
  return biomeDef(biomeAtColumn(column)).rockTop;
}

/** Validación geométrica (la usan las pruebas). */
export function biomesAreContiguous(): boolean {
  for (let i = 1; i < BIOMES.length; i++)
    if (BIOMES[i]!.from !== BIOMES[i - 1]!.to + 1) return false;
  return (
    BIOMES[0]!.from === WORLD_FIRST_COLUMN &&
    biomeDef('desert').from === -40 &&
    biomeDef('desert').to === 139 &&
    BIOMES[BIOMES.length - 1]!.to === WORLD.columns - 1
  );
}
