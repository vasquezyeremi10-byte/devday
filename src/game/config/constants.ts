export const VIEW = { width: 480, height: 270 } as const;
export const TILE_SIZE = 16;
/**
 * V8: el mundo excavable pasa de 80 a 140 columnas (ampliación derecha). Las
 * partidas anteriores guardaban índices de terreno con 80 columnas
 * (`LEGACY_COLUMNS`); SaveSystem los convierte al cargar.
 *
 * V9: mundo de biomas. El excavable crece a 472 columnas (desierto 0..139,
 * valle, bosque, pinos, montaña y costa; ver config/biomes.ts) y al oeste
 * del campamento se agrega la región de los monolitos, con suelo propio no
 * excavable. Las partidas guardadas antes de V9 usaban 140 columnas
 * (`LEGACY_COLUMNS_V6`); las columnas nuevas se agregan a la derecha, así
 * que ningún índice viejo cambia. Desde V9 la partida guarda su ancho.
 */
export const WORLD = { columns: 472, rows: 36, surfaceRow: 10 } as const;
export const LEGACY_COLUMNS = 80;
/** Ancho con que las partidas V6 guardaban el terreno antes de los biomas. */
export const LEGACY_COLUMNS_V6 = 140;
/**
 * V8: campamento minero a la izquierda de la bodega, en x negativas. Las
 * coordenadas del mundo original no cambian: el campamento ocupa columnas
 * negativas. Desde el mundo abierto se excava como el resto.
 */
export const CAMP = { columns: 40 } as const;
/**
 * V9: Mano del Desierto (antes monolitos) al oeste del campamento
 * (columnas −120..−41).
 */
export const WEST = { columns: 80 } as const;
/**
 * Mundo abierto (18 de noviembre de 2026): cuatro zonas nuevas al oeste de la
 * Mano del Desierto (columnas −760..−121). Desde entonces todo el mundo, del
 * borde oeste al este, es una sola cuadrícula excavable y construible: el
 * campamento y la Mano del Desierto dejaron de ser suelo fijo.
 */
export const FAR_WEST = { columns: 640 } as const;
/** Primera columna del mundo (borde oeste); la columna 0 sigue en la bodega. */
export const WORLD_FIRST_COLUMN = -(
  CAMP.columns +
  WEST.columns +
  FAR_WEST.columns
);
/** Columnas de todo el mundo, del borde oeste al este. */
export const WORLD_SPAN = WORLD.columns - WORLD_FIRST_COLUMN;
/** Borde izquierdo del mundo (px) y ancho total. */
export const WORLD_LEFT = WORLD_FIRST_COLUMN * TILE_SIZE;
export const WORLD_WIDTH = WORLD_SPAN * TILE_SIZE;
export const PLAYER = {
  speed: 90,
  jumpSpeed: 210,
  gravity: 600,
  reach: 36,
} as const;
export const SPAWN = { x: 208, y: 148 } as const;
/** Código `fly`: ventana del doble espacio (ms) y velocidad vertical (px/s). */
export const FLIGHT = { doubleTapMs: 300, speed: 110 } as const;
