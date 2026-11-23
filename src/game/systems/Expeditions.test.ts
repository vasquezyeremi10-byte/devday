import { describe, expect, it } from 'vitest';
import {
  createExpeditionState,
  createForgottenDepthsTerrain,
  FORGOTTEN_DEPTHS,
  markExpeditionDug,
  restoreExpeditionState,
} from './Expeditions';
import { Block, TerrainGrid } from '../world/TerrainGrid';

describe('Mundo 1: Las Profundidades Olvidadas', () => {
  it('genera el mismo terreno desde la misma semilla y mantiene un spawn seguro', () => {
    const first = createForgottenDepthsTerrain(createExpeditionState(1234));
    const second = createForgottenDepthsTerrain(createExpeditionState(1234));
    expect(first.cells).toEqual(second.cells);
    const spawn = TerrainGrid.worldToCell(
      FORGOTTEN_DEPTHS.spawn.x,
      FORGOTTEN_DEPTHS.spawn.y - 4,
    );
    expect(first.get(spawn.column, spawn.row)).toBe(Block.Air);
    expect(first.get(spawn.column, spawn.row + 1)).toBe(Block.Bedrock);
  });

  it('persiste solo los bloques retirados sin abrir el lecho de roca', () => {
    const state = createExpeditionState(987);
    const grid = createForgottenDepthsTerrain(state);
    const cell = { column: 16, row: 12 };
    expect(grid.get(cell.column, cell.row)).toBe(Block.Coal);
    grid.set(cell.column, cell.row, Block.Air);
    markExpeditionDug(state, grid, cell);
    const restored = createForgottenDepthsTerrain(state);
    expect(restored.get(cell.column, cell.row)).toBe(Block.Air);
    expect(restored.get(0, 14)).toBe(Block.Bedrock);
  });

  it('descarta un guardado de otro mundo y normaliza las diferencias repetidas', () => {
    expect(restoreExpeditionState({ id: 'otro' }, 1)).toBeUndefined();
    const restored = restoreExpeditionState(
      {
        id: 'forgotten-depths',
        seed: 3,
        dug: [12, 12, -1, 999999],
        position: { x: 40, y: 212 },
        active: true,
      },
      1,
    );
    expect(restored?.dug).toEqual([12]);
    expect(restored?.active).toBe(true);
  });
});
