import { LIGHTING } from '../config/lighting';

/** Umbrales Bayer 4 × 4 (0..15), fijos en coordenadas del mundo. */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * Nivel cuantizado 0..3 de una luz 0..1 (lógica pura, sin Phaser) y su
 * avance 0..1 dentro de la banda, para la trama opcional.
 */
export function quantize(
  light: number,
  thresholds: readonly [number, number, number] = LIGHTING.quantize.thresholds,
): { level: number; frac: number } {
  const [t1, t2, t3] = thresholds;
  if (light >= t3) return { level: 3, frac: 0 };
  if (light >= t2) return { level: 2, frac: (light - t2) / (t3 - t2) };
  if (light >= t1) return { level: 1, frac: (light - t1) / (t2 - t1) };
  return { level: 0, frac: Math.max(0, light) / t1 };
}

/**
 * Solo el nivel 0..3 de `quantize`, sin crear un objeto: la composición de
 * la luz lo pide para miles de celdas en cada fotograma.
 */
export function quantLevel(
  light: number,
  thresholds: readonly [number, number, number] = LIGHTING.quantize.thresholds,
): number {
  return light >= thresholds[2]
    ? 3
    : light >= thresholds[1]
      ? 2
      : light >= thresholds[0]
        ? 1
        : 0;
}

/**
 * Nivel final de un píxel: nunca bajo `floor`; con trama activa, solo el
 * tramo superior de la banda (`intensity` 0..1) sube al nivel siguiente
 * según el umbral Bayer 4 × 4 del píxel del mundo.
 */
export function pixelLevel(
  light: number,
  floor: number,
  x: number,
  y: number,
  dither: { enabled: boolean; intensity: number } = LIGHTING.dither,
): number {
  // Sin trama (lo habitual) el resultado es solo el nivel, sin asignaciones.
  if (!dither.enabled || !(dither.intensity > 0))
    return Math.max(floor, quantLevel(light));
  const q = quantize(light);
  let level = Math.max(floor, q.level);
  if (dither.enabled && dither.intensity > 0 && level === q.level && level < 3) {
    const p = Math.max(0, (q.frac - (1 - dither.intensity)) / dither.intensity) * 0.5;
    if ((BAYER4[(y & 3) * 4 + (x & 3)]! + 0.5) / 16 < p) level++;
  }
  return level;
}
