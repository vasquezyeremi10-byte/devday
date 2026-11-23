import { LIGHTING } from '../config/lighting';

/**
 * Oscuridad progresiva: franja (0..n-1) del ambiente subterráneo de una fila
 * del mundo. Por encima de `fromRow` es la franja 0 (el azul original); luego
 * cambia cada `step` filas hasta la última franja (casi negro). Pura.
 */
export function depthBand(row: number): number {
  const { fromRow, step, colors } = LIGHTING.depthAmbient;
  if (row < fromRow) return 0;
  return Math.min(colors.length - 1, Math.floor((row - fromRow) / step));
}

/** Color 0xRRGGBB del ambiente descubierto en una fila del mundo. */
export const depthAmbientColor = (row: number): number =>
  LIGHTING.depthAmbient.colors[depthBand(row)]!;
