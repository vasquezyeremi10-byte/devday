/**
 * Fundidos tramados de la introducción y el menú con alfa binario. El
 * umbral sale de una baldosa de ruido de 16 × 16 (cada valor
 * 0..63 aparece cuatro veces, en orden mezclado por una semilla fija), en
 * grupos de 2 × 2 píxeles para que la trama se lea como pixel art y no como
 * estática.
 */
export const DISSOLVE_LEVELS = 64;
const DISSOLVE_TILE = 16;

/** Permutación estable (mulberry32 + Fisher-Yates) de 0..255 → umbral 0..63. */
function noiseTile(seed: number): Uint8Array {
  let a = seed >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const size = DISSOLVE_TILE * DISSOLVE_TILE;
  const order = Array.from({ length: size }, (_, i) => i);
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const tile = new Uint8Array(size);
  order.forEach((cell, rank) => (tile[cell] = Math.floor(rank / 4)));
  return tile;
}

const TILES = {
  night: noiseTile(0x85ebca6b),
  /** Cortinas de la introducción y la entrada del menú (ui/DitherCover). */
  cover: noiseTile(0xc2b2ae35),
};

type DissolveSet = keyof typeof TILES;

/** Umbral 0..63 del grupo de 2 × 2 píxeles que contiene (x, y). */
export const dissolveThreshold = (
  set: DissolveSet,
  x: number,
  y: number,
): number => TILES[set][((y >> 1) & 15) * DISSOLVE_TILE + ((x >> 1) & 15)]!;

/** Nivel 0..64 de una fracción 0..1. */
export const dissolveLevel = (fraction: number): number =>
  Math.max(
    0,
    Math.min(DISSOLVE_LEVELS, Math.round(fraction * DISSOLVE_LEVELS)),
  );

/** Lado (px) de la baldosa de trama: 16 celdas de 2 × 2 píxeles. */
export const COVER_TILE_PX = DISSOLVE_TILE * 2;

/**
 * Máscara de una cortina tramada de nivel 0..64: 1 donde la cortina tapa.
 * Nivel 0 no tapa nada y 64 tapa todo; cada nivel añade píxeles sin quitar
 * los del anterior, así el fundido nunca «parpadea».
 */
export function coverMask(level: number): Uint8Array {
  const mask = new Uint8Array(COVER_TILE_PX * COVER_TILE_PX);
  for (let y = 0; y < COVER_TILE_PX; y++)
    for (let x = 0; x < COVER_TILE_PX; x++)
      mask[y * COVER_TILE_PX + x] = dissolveThreshold('cover', x, y) < level ? 1 : 0;
  return mask;
}

