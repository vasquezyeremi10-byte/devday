import { TILE_SIZE } from '../config/constants';
import { Block, type TerrainGrid } from './TerrainGrid';

/** Un cristal violeta del terreno y el punto de aire desde donde ilumina. */
export interface CrystalSpot {
  column: number;
  row: number;
  /** Centro (px del mundo) del aire junto al cristal; null si está encerrado. */
  lx: number | null;
  ly: number | null;
}

/**
 * Lista de los cristales del terreno, para iluminarlos y animar sus
 * partículas sin recorrer toda la cuadrícula cada fotograma. Se reconstruye
 * solo cuando el terreno cambia (excavar puede dejar a la vista un cristal
 * o quitar uno).
 */
export class CrystalIndex {
  spots: CrystalSpot[] = [];

  constructor(private readonly grid: TerrainGrid) {
    this.refresh();
  }

  refresh(): void {
    const g = this.grid;
    const spots: CrystalSpot[] = [];
    for (let row = 0; row < g.rows; row++)
      for (let column = g.first; column < g.end; column++) {
        if (g.get(column, row) !== Block.Crystal) continue;
        const open = (
          [
            [0, -1],
            [-1, 0],
            [1, 0],
            [0, 1],
          ] as const
        ).find(([dx, dy]) => g.get(column + dx, row + dy) === Block.Air);
        spots.push({
          column,
          row,
          lx: open ? (column + open[0] + 0.5) * TILE_SIZE : null,
          ly: open ? (row + open[1] + 0.5) * TILE_SIZE : null,
        });
      }
    this.spots = spots;
  }
}
