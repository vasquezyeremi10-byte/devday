import { TILE_SIZE } from '../config/constants';

/** ¿Hay un bloque sólido en esta celda del mundo? */
export type SolidAt = (column: number, row: number) => boolean;

/**
 * Sombra de contacto de un personaje sobre el suelo real (lógica pura, sin
 * Phaser). En vista lateral, la sombra es una franja de 1–2 px sobre la cara
 * superior del suelo que hay justo debajo de cada columna de píxeles del
 * personaje:
 *
 * - Cada columna busca su propio suelo hacia abajo, así la sombra baja al
 *   nivel inferior junto a un escalón, sube a un bloque más alto y se corta
 *   sobre un hueco (nunca flota en el aire).
 * - Sobre las esquinas redondeadas de un bloque con vecino más bajo no se
 *   dibuja (esos píxeles del bloque son transparentes).
 * - Con el personaje en el aire, la sombra se achica y desaparece pasados
 *   `maxDrop` px.
 */
export const GROUND_SHADOW = {
  /** Ancho (px) de la sombra con los pies en el suelo. */
  width: 12,
  /** Altura (px) sobre el suelo a la que la sombra desaparece. */
  maxDrop: 48,
  /** Píxeles de la esquina redondeada de la superficie (sin sombra). */
  corner: 2,
} as const;

export interface ShadowSpan {
  /** Columna de píxel del mundo. */
  x: number;
  /** Primera fila de píxel sombreada (la cara superior del suelo). */
  y: number;
  /** Filas sombreadas: 2 en el centro, 1 en los extremos. */
  h: number;
}

/** Fila de la cara superior del primer suelo bajo `fromY` en la columna. */
function groundBelow(
  solid: SolidAt,
  column: number,
  fromY: number,
  maxDrop: number,
): number | null {
  // Se acepta un suelo que asome hasta 2 px sobre los pies (pisada en curso).
  const first = Math.floor((fromY - 2) / TILE_SIZE);
  const last = Math.floor((fromY + maxDrop) / TILE_SIZE);
  for (let row = Math.max(0, first); row <= last; row++) {
    if (!solid(column, row)) continue;
    // Solo la cara superior: con un bloque encima, es pared, no suelo.
    if (row > 0 && solid(column, row - 1)) return null;
    return row * TILE_SIZE;
  }
  return null;
}

/**
 * Franjas de sombra bajo un personaje con los pies en (`feetX`, `feetY`)
 * (centro y borde inferior del cuerpo, px del mundo).
 */
export function shadowSpans(
  feetX: number,
  feetY: number,
  solid: SolidAt,
  options: { width?: number; maxDrop?: number } = {},
): ShadowSpan[] {
  const width = options.width ?? GROUND_SHADOW.width;
  const maxDrop = options.maxDrop ?? GROUND_SHADOW.maxDrop;
  const spans: ShadowSpan[] = [];
  const left = Math.round(feetX - width / 2);
  for (let x = left; x < left + width; x++) {
    const column = Math.floor(x / TILE_SIZE);
    const top = groundBelow(solid, column, feetY, maxDrop);
    if (top === null) continue;
    const drop = Math.max(0, top - feetY);
    if (drop > maxDrop) continue;
    // Más lejos del suelo, más chica: a `maxDrop` queda en un 40 %.
    const half = (width / 2) * (1 - (0.6 * drop) / maxDrop);
    const offset = Math.abs(x + 0.5 - feetX);
    if (offset > half) continue;
    // Esquina redondeada: el vecino de ese lado tiene el suelo más abajo.
    const row = top / TILE_SIZE;
    const inTile = x - column * TILE_SIZE;
    if (
      (inTile < GROUND_SHADOW.corner && !solid(column - 1, row)) ||
      (inTile >= TILE_SIZE - GROUND_SHADOW.corner && !solid(column + 1, row))
    )
      continue;
    spans.push({ x, y: top, h: offset < half - 2 ? 2 : 1 });
  }
  return spans;
}
