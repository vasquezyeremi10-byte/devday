import { TILE_SIZE } from '../config/constants';

/** Consulta mínima de colisión: la oclusión sale de TerrainGrid, nunca de fondos. */
export interface SolidQuery {
  isSolid(column: number, row: number): boolean;
}

const EPSILON = 1e-9;

/**
 * Longitud en píxeles que el segmento (x0, y0) → (x1, y1) recorre dentro de
 * tiles sólidos, con un recorrido DDA (Amanatides–Woo) celda por celda.
 * Al pasar justo por una esquina entre dos sólidos en diagonal el rayo se da
 * por bloqueado: la luz no se cuela por rendijas de ancho cero.
 * Se detiene en cuanto supera `limit` para no recorrer roca de más.
 */
export function solidLength(
  grid: SolidQuery,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  limit = Infinity,
): number {
  const dx = x1 - x0,
    dy = y1 - y0,
    length = Math.hypot(dx, dy);
  let column = Math.floor(x0 / TILE_SIZE),
    row = Math.floor(y0 / TILE_SIZE);
  if (length < EPSILON) return 0;
  const stepX = Math.sign(dx),
    stepY = Math.sign(dy);
  const deltaX = dx ? Math.abs(TILE_SIZE / dx) : Infinity,
    deltaY = dy ? Math.abs(TILE_SIZE / dy) : Infinity;
  let maxX =
    dx > 0
      ? ((column + 1) * TILE_SIZE - x0) / dx
      : dx < 0
        ? (column * TILE_SIZE - x0) / dx
        : Infinity;
  let maxY =
    dy > 0
      ? ((row + 1) * TILE_SIZE - y0) / dy
      : dy < 0
        ? (row * TILE_SIZE - y0) / dy
        : Infinity;
  let t = 0,
    solid = 0;
  // Un segmento cruza como mucho |dx|/16 + |dy|/16 + 2 tiles.
  for (let guard = 0; guard < 256; guard++) {
    const next = Math.min(maxX, maxY, 1);
    if (grid.isSolid(column, row)) {
      solid += (next - t) * length;
      if (solid >= limit) return solid;
    }
    if (next >= 1) break;
    t = next;
    if (Math.abs(maxX - maxY) < EPSILON) {
      // Esquina exacta: si ambos vecinos son sólidos, la rendija está cerrada.
      if (
        grid.isSolid(column + stepX, row) &&
        grid.isSolid(column, row + stepY)
      )
        return Infinity;
      column += stepX;
      row += stepY;
      maxX += deltaX;
      maxY += deltaY;
    } else if (maxX < maxY) {
      column += stepX;
      maxX += deltaX;
    } else {
      row += stepY;
      maxY += deltaY;
    }
  }
  return solid;
}

/**
 * Fracción de luz que llega a un punto: 1 en aire despejado, decreciente
 * mientras entra en la cara de un bloque y 0 al superar `penetration` px.
 * Así se ve la superficie del muro pero no los bloques que hay detrás.
 */
export function transmittance(
  grid: SolidQuery,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  penetration: number,
): number {
  const s = solidLength(grid, x0, y0, x1, y1, penetration);
  return s >= penetration ? 0 : 1 - s / penetration;
}
