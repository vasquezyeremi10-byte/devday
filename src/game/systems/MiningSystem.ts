import { PLAYER } from '../config/constants';
import { MINERAL_KEYS, type MineralKey } from '../config/minerals';
import {
  Block,
  mineralOf,
  TerrainGrid,
  type Cell,
  type Point,
} from '../world/TerrainGrid';

export type MiningResult =
  'ready' | 'outside' | 'empty' | 'protected' | 'far' | 'occluded';

export class MiningSystem {
  excavated = 0;
  /** Hallazgos acumulados, nunca un inventario transferible ni vendible. */
  readonly discovered: Record<MineralKey, number> = Object.fromEntries(
    MINERAL_KEYS.map((key) => [key, 0]),
  ) as Record<MineralKey, number>;
  /** Último bloque retirado con éxito; lo usan los efectos visuales. */
  lastBlock: Block = Block.Air;
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
      this.lastBlock = this.grid.get(target.column, target.row);
      this.grid.set(target.column, target.row, Block.Air);
      this.excavated++;
      const mineral = mineralOf(this.lastBlock);
      if (mineral) this.discovered[mineral]++;
    }
    return result;
  }
}
