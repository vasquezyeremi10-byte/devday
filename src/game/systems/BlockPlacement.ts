import { BUILD_REACH } from '../config/buildMaterials';
import { TerrainGrid, type Cell, type Point } from '../world/TerrainGrid';
import type { GameSession } from './GameSession';

/** Rectángulo en píxeles del mundo (cuerpo de un personaje, carro…). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (cell: Cell, r: Rect, size: number): boolean => {
  const x = cell.column * size,
    y = cell.row * size;
  return r.x < x + size && r.x + r.w > x && r.y < y + size && r.y + r.h > y;
};

/**
 * Motivo por el que no se puede colocar un bloque en la celda, o `null` si se
 * puede. Es lógica pura: la escena aporta el origen del alcance y los
 * rectángulos de las entidades (minero y carro).
 */
export function placementProblem(
  s: GameSession,
  cell: Cell,
  origin: Point,
  blockers: readonly Rect[],
  tile = 16,
): string | null {
  const g = s.grid;
  if (!g.contains(cell.column, cell.row)) return 'FUERA DEL MUNDO';
  const center = TerrainGrid.center(cell);
  if (Math.hypot(center.x - origin.x, center.y - origin.y) > BUILD_REACH)
    return 'DEMASIADO LEJOS';
  if (g.isSolid(cell.column, cell.row)) return 'ESA CELDA YA ESTA OCUPADA';
  const { column, row } = cell;
  if (
    s.rails.has(column, row) ||
    s.lights.items.some((l) => l.column === column && l.row === row) ||
    s.supports.at(column, row) ||
    s.ventilation.hasDuct(column, row) ||
    s.ventilation.fans.some((f) => f.column === column && f.row === row) ||
    s.blasting.chargeAt(cell)
  )
    return 'HAY UN OBJETO INSTALADO AQUI';
  if (s.trees.trunkAt(cell) >= 0) return 'HAY UN ARBOL AQUI';
  if (
    s.piles.some(
      (p) =>
        p.items.length > 0 &&
        Math.floor(p.x / tile) === column &&
        Math.floor(p.y / tile) === row,
    )
  )
    return 'HAY MATERIAL SUELTO AQUI';
  if (blockers.some((r) => overlaps(cell, r, tile)))
    return 'HAY ALGUIEN EN ESA CELDA';
  const supported = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => g.isSolid(column + dx!, row + dy!));
  return supported ? null : 'NECESITA APOYO: COLOCA JUNTO A UN BLOQUE';
}
