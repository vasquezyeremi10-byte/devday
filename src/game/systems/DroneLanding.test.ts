import { describe, expect, it } from 'vitest';
import { createInitialTerrain, DEFAULT_SEED } from '../world/Geology';
import { Block } from '../world/TerrainGrid';
import { droneLanding } from './DroneLanding';

const point = (x: number, y: number) => ({
  scene: 'MiningScene' as const,
  x,
  y,
});
describe('destino de entrega', () => {
  it('conserva la posición del pedido sobre suelo libre', () => {
    const grid = createInitialTerrain(DEFAULT_SEED);
    expect(droneLanding(grid, point(-360, 160))).toEqual(point(-360, 160));
  });
  it('busca suelo libre cercano si el lugar quedó bloqueado', () => {
    const grid = createInitialTerrain(DEFAULT_SEED);
    for (const c of [12, 13])
      for (const r of [8, 9]) grid.set(c, r, Block.Rock);
    const landing = droneLanding(grid, point(200, 160));
    expect(landing.scene).toBe('MiningScene');
    expect(
      grid.isSolid(
        Math.floor(landing.x / 16),
        Math.floor((landing.y - 8) / 16),
      ),
    ).toBe(false);
  });
});
