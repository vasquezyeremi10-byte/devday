import { biomeDef, type BiomeId } from '../config/biomes';
import { TILE_SIZE } from '../config/constants';
import { surfaceRow } from './TerrainGrid';

/**
 * Dónde van los monumentos de Antofagasta (lógica pura, sin Phaser). El
 * dibujo está en world/Landmarks.ts.
 */
export interface LandmarkSite {
  key: string;
  biome: BiomeId;
  /** Columna preferida para el centro. */
  column: number;
  /** Ancho del dibujo (px); Landmarks.ts lo usa para ubicarlo. */
  width: number;
}

export const LANDMARK_SITES: readonly LandmarkSite[] = [
  { key: 'landmark-hand', biome: 'hand', column: -82, width: 72 },
  { key: 'landmark-saltpeter', biome: 'pampa', column: 178, width: 176 },
  { key: 'landmark-fcab', biome: 'fcab', column: 251, width: 200 },
  { key: 'landmark-huanchaca', biome: 'huanchaca', column: 316, width: 256 },
];

/** Cimientos (px) bajo la línea del suelo: los tapan el terreno y la pared. */
export const LANDMARK_BURY = 20;

/**
 * Columna de centro más plana cerca de la preferida, sin salir de la zona
 * (con un bloque de margen), y la fila del suelo más bajo de su ancho: el pie
 * del monumento se apoya ahí, así nunca flota; donde el suelo es más alto,
 * el terreno tapa los cimientos.
 */
export function landmarkSpot(
  site: Pick<LandmarkSite, 'biome' | 'column'>,
  widthPx: number,
): { column: number; groundRow: number } {
  const zone = biomeDef(site.biome);
  const half = Math.ceil(widthPx / TILE_SIZE / 2);
  let best = { column: site.column, groundRow: surfaceRow(site.column), score: Infinity };
  for (let c = zone.from + half + 1; c <= zone.to - half - 1; c++) {
    let lo = Infinity,
      hi = -Infinity;
    for (let k = c - half; k <= c + half; k++) {
      lo = Math.min(lo, surfaceRow(k));
      hi = Math.max(hi, surfaceRow(k));
    }
    const score = (hi - lo) * 100 + Math.abs(c - site.column);
    if (score < best.score) best = { column: c, groundRow: hi, score };
  }
  return { column: best.column, groundRow: best.groundRow };
}
