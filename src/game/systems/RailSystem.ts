import { BALANCE } from '../config/balance';
import { CART } from '../config/cart';
import { TILE_SIZE } from '../config/constants';
import type { Cell, TerrainGrid } from '../world/TerrainGrid';

export interface Rail extends Cell {
  kind: 'track';
}

/** Altura de la cabeza del riel apoyado en el piso de la celda (column,row). */
export const railTop = (row: number): number => (row + 1) * TILE_SIZE - 4;

/**
 * Vía de un solo hilo: a lo sumo un tramo por columna. Tramos vecinos pueden
 * diferir en un bloque de altura; la rampa ocupa la columna más baja del par,
 * pegada al escalón, y sube 16 px en 16 px de forma continua. Un tramo nunca
 * puede quedar más bajo que sus dos vecinos (un pozo de un bloque).
 */
export class RailSystem {
  segments: Rail[] = Array.from(
    { length: BALANCE.railEnd - BALANCE.railStart + 1 },
    (_, i) => ({
      column: BALANCE.railStart + i,
      row: BALANCE.railRow,
      kind: 'track',
    }),
  );
  constructor(readonly grid: TerrainGrid) {}

  at(column: number): Rail | undefined {
    return this.segments.find((s) => s.column === column);
  }
  has(column: number, row?: number): boolean {
    const s = this.at(column);
    return !!s && (row === undefined || s.row === row);
  }
  /** Aire para la vía y el carro, apoyada sobre un sólido. */
  supported(column: number, row: number): boolean {
    return (
      this.grid.contains(column, row + 1) &&
      !this.grid.isSolid(column, row) &&
      !this.grid.isSolid(column, row - 1) &&
      this.grid.isSolid(column, row + 1)
    );
  }
  /** Dos tramos consecutivos y transitables. */
  private linked(a: Rail | undefined, b: Rail | undefined): boolean {
    return (
      !!a &&
      !!b &&
      Math.abs(a.row - b.row) <= 1 &&
      this.supported(a.column, a.row) &&
      this.supported(b.column, b.row)
    );
  }

  /**
   * Celda donde continuaría la vía desde el tramo `from` hacia `column`,
   * eligiendo la fila del piso real. Devuelve la celda o el motivo del rechazo.
   */
  resolve(from: Rail, column: number): Cell | string {
    if (this.at(column)) return 'YA HAY VIA EN ESA COLUMNA';
    const g = this.grid;
    for (const row of [from.row, from.row - 1, from.row + 1]) {
      if (!this.supported(column, row)) continue;
      const cell = { column, row };
      const reason = this.pitReason(cell, from);
      return reason ?? cell;
    }
    for (let row = from.row - 3; row <= from.row + 3; row++)
      if (this.supported(column, row)) return 'DESNIVEL MAYOR A UN BLOQUE';
    if (g.isSolid(column, from.row)) return 'EXCAVA ANTES DE COLOCAR RIELES';
    return 'VIA SIN SOPORTE: NECESITA PISO';
  }

  private pitReason(cell: Cell, from: Rail): string | null {
    const dir = cell.column > from.column ? 1 : -1;
    const beyond = this.at(cell.column + dir);
    const behind = this.at(from.column - dir);
    if (beyond && cell.row > from.row && beyond.row < cell.row)
      return 'NO SE PERMITE UN POZO DE UN BLOQUE';
    if (cell.row < from.row && behind && behind.row < from.row)
      return 'NO SE PERMITE UN POZO DE UN BLOQUE';
    return null;
  }

  canPlace(cell: Cell): boolean {
    for (const dir of [-1, 1]) {
      const from = this.at(cell.column - dir);
      if (!from) continue;
      const result = this.resolve(from, cell.column);
      if (
        typeof result !== 'string' &&
        result.row === cell.row &&
        result.column === cell.column
      )
        return true;
    }
    return false;
  }

  /** Extremos de la red con la celda donde se construiría (o el motivo). */
  ends(): { from: Rail; column: number; target: Cell | string }[] {
    const out: { from: Rail; column: number; target: Cell | string }[] = [];
    for (const s of this.segments)
      for (const d of [-1, 1]) {
        const column = s.column + d;
        if (this.at(column) || !this.grid.contains(column, s.row)) continue;
        out.push({ from: s, column, target: this.resolve(s, column) });
      }
    return out;
  }

  /**
   * Celda donde quedaría un riel al apuntar a `cell` (la celda de aire o el
   * bloque de piso bajo ella), o el motivo por el que no se puede.
   */
  placementFor(cell: Cell): Cell | string {
    for (const row of [cell.row, cell.row - 1, cell.row + 1]) {
      const c = { column: cell.column, row };
      if (this.canPlace(c)) return c;
    }
    if (this.at(cell.column)) return 'YA HAY VIA EN ESA COLUMNA';
    const from = this.at(cell.column - 1) ?? this.at(cell.column + 1);
    if (!from)
      return 'LA VIA DEBE CONTINUAR DESDE UN EXTREMO: APUNTA JUNTO AL ULTIMO RIEL';
    const result = this.resolve(from, cell.column);
    return typeof result === 'string'
      ? result
      : 'APUNTA A LA ALTURA DEL PISO DE LA VIA';
  }

  place(cell: Cell): boolean {
    if (!this.canPlace(cell)) return false;
    this.segments.push({ ...cell, kind: 'track' });
    return true;
  }

  /** Intervalo conectado desde la posición del carro. No cruza huecos ni paredes. */
  bounds(x: number): { min: number; max: number } {
    const column = Math.floor(x / TILE_SIZE);
    const here = this.at(column);
    if (!here || !this.supported(here.column, here.row))
      return { min: x, max: x };
    let left = here,
      right = here;
    while (this.linked(this.at(left.column - 1), left))
      left = this.at(left.column - 1)!;
    while (this.linked(right, this.at(right.column + 1)))
      right = this.at(right.column + 1)!;
    return {
      min: left.column * TILE_SIZE + CART.railMargin,
      max: (right.column + 1) * TILE_SIZE - CART.railMargin,
    };
  }

  /** Alturas en los bordes izquierdo y derecho de un tramo (rampa o plano). */
  private edges(s: Rail): [number, number] {
    const flat = railTop(s.row);
    const left = this.at(s.column - 1),
      right = this.at(s.column + 1);
    return [
      left && left.row === s.row - 1 ? railTop(left.row) : flat,
      right && right.row === s.row - 1 ? railTop(right.row) : flat,
    ];
  }

  /** Altura de la cabeza del riel en x (perfil continuo). */
  railY(x: number): number {
    const column = Math.floor(x / TILE_SIZE);
    const s = this.at(column);
    if (!s) {
      const near = this.at(column - 1) ?? this.at(column + 1);
      return near ? railTop(near.row) : railTop(BALANCE.railRow);
    }
    const [l, r] = this.edges(s);
    const t = (x - column * TILE_SIZE) / TILE_SIZE;
    return l + (r - l) * t;
  }

  /** Pendiente dy/dx del perfil en x: −1 sube a la derecha, +1 baja. */
  slopeAt(x: number): number {
    const s = this.at(Math.floor(x / TILE_SIZE));
    if (!s) return 0;
    const [l, r] = this.edges(s);
    return (r - l) / TILE_SIZE;
  }

  /** El piso bajo una vía y el escalón de una rampa no se pueden excavar. */
  protects(cell: Cell): boolean {
    return this.segments.some(
      (s) => s.column === cell.column && s.row + 1 === cell.row,
    );
  }
}
