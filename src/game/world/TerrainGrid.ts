import { TILE_SIZE, WORLD } from '../config/constants';

export enum Block {
  Air = -1,
  Dirt = 0,
  Rock = 1,
  Bedrock = 2,
}
export interface Cell {
  column: number;
  row: number;
}
export interface Point {
  x: number;
  y: number;
}

/** Fuente de verdad independiente del render y de las imágenes de fondo. */
export class TerrainGrid {
  readonly cells: Block[][];

  constructor(
    readonly columns: number = WORLD.columns,
    readonly rows: number = WORLD.rows,
  ) {
    this.cells = Array.from({ length: rows }, () =>
      Array<Block>(columns).fill(Block.Air),
    );
  }

  contains(column: number, row: number): boolean {
    return (
      Number.isInteger(column) &&
      Number.isInteger(row) &&
      column >= 0 &&
      row >= 0 &&
      column < this.columns &&
      row < this.rows
    );
  }

  get(column: number, row: number): Block {
    return this.cells[row]?.[column] ?? Block.Bedrock;
  }

  set(column: number, row: number, block: Block): void {
    if (!this.contains(column, row))
      throw new RangeError('Celda fuera del mundo');
    this.cells[row]![column] = block;
  }

  isSolid(column: number, row: number): boolean {
    return this.get(column, row) !== Block.Air;
  }

  isExposed(column: number, row: number): boolean {
    return [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ].some(([dx, dy]) => this.get(column + dx!, row + dy!) === Block.Air);
  }

  static worldToCell(x: number, y: number): Cell {
    return {
      column: Math.floor(x / TILE_SIZE),
      row: Math.floor(y / TILE_SIZE),
    };
  }

  static center({ column, row }: Cell): Point {
    return { x: (column + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
  }
}

export function createInitialTerrain(): TerrainGrid {
  const grid = new TerrainGrid();
  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      const hill = column >= 18 && row >= 6;
      if (row < WORLD.surfaceRow && !hill) continue;
      const protectedEdge =
        row === grid.rows - 1 || column === 0 || column === grid.columns - 1;
      grid.set(
        column,
        row,
        protectedEdge ? Block.Bedrock : row < 13 ? Block.Dirt : Block.Rock,
      );
    }
  }
  for (let row = 8; row <= 9; row++) {
    for (let column = 18; column <= 25; column++)
      grid.set(column, row, Block.Air);
  }
  return grid;
}
