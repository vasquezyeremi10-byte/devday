import { PLAYER } from '../config/constants';
import {
  Block,
  TerrainGrid,
  type Cell,
  type Point,
} from '../world/TerrainGrid';

export type MiningResult =
  'ready' | 'outside' | 'empty' | 'protected' | 'far' | 'occluded';

export class MiningSystem {
  excavated = 0;
  constructor(readonly grid: TerrainGrid) {}

  inspect(origin: Point, target: Cell): MiningResult {
    const { column, row } = target;
    if (!this.grid.contains(column, row)) return 'outside';
    const block = this.grid.get(column, row);
    if (block === Block.Air) return 'empty';
    if (block === Block.Bedrock) return 'protected';
    const center = TerrainGrid.center(target);
    const distance = Math.hypot(center.x - origin.x, center.y - origin.y);
    if (distance > PLAYER.reach) return 'far';
    if (!this.grid.isExposed(column, row)) return 'occluded';
    // Muestreo subpíxel: la línea nunca salta una celda sólida intermedia.
    const steps = Math.ceil(distance * 2);
    for (let i = 0; i < steps; i++) {
      const cell = TerrainGrid.worldToCell(
        origin.x + ((center.x - origin.x) * i) / steps,
        origin.y + ((center.y - origin.y) * i) / steps,
      );
      if (cell.column === column && cell.row === row) break;
      if (this.grid.isSolid(cell.column, cell.row)) return 'occluded';
    }
    return 'ready';
  }

  dig(origin: Point, target: Cell): MiningResult {
    const result = this.inspect(origin, target);
    if (result === 'ready') {
      this.grid.set(target.column, target.row, Block.Air);
      this.excavated++;
    }
    return result;
  }
}
