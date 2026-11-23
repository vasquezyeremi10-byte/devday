import { describe, expect, it } from 'vitest';
import { SPAWN } from '../config/constants';
import { materialOfBlock } from '../config/buildMaterials';
import { MiningSystem } from '../systems/MiningSystem';
import { GameSession } from '../systems/GameSession';
import { decodeSave, encodeSave } from '../systems/SaveSystem';
import {
  createInitialTerrain,
  geologyOf,
  WORLD_REV_EXPLORE,
  WORLD_REV_ENTRANCE_10,
  WORLD_REV_SOLID,
} from './Geology';
import {
  Block,
  mineralOf,
  oreBlock,
  surfaceRow,
  TerrainGrid,
} from './TerrainGrid';

const seeds = [1, 42, 20261109, 987654321];

describe('mina sólida para partidas nuevas', () => {
  it.each(seeds)(
    'sella el subsuelo y conserva los minerales de la semilla %i',
    (seed) => {
      const old = createInitialTerrain(seed, WORLD_REV_EXPLORE);
      const grid = createInitialTerrain(seed, WORLD_REV_ENTRANCE_10);
      expect(grid.worldRev).toBe(WORLD_REV_ENTRANCE_10);
      expect(grid.caveAir.size).toBe(0);
      expect(grid.vents).toHaveLength(0);
      for (let row = 0; row < grid.rows; row++)
        for (let column = 0; column < grid.columns; column++) {
          if (row < surfaceRow(column)) continue;
          const start = column >= 18 && column <= 27 && row >= 7 && row <= 9;
          expect(grid.get(column, row) === Block.Air).toBe(start);
          const mineral = mineralOf(old.get(column, row));
          if (mineral) expect(grid.get(column, row)).toBe(old.get(column, row));
        }
      for (const deposit of geologyOf(seed, WORLD_REV_ENTRANCE_10).deposits)
        for (const [column, row] of deposit.cells)
          expect(grid.get(column, row)).toBe(oreBlock(deposit.mineral));
      expect(geologyOf(seed, WORLD_REV_ENTRANCE_10).caverns).toHaveLength(0);
      expect(grid.get(28, 8)).not.toBe(Block.Air);
    },
  );

  it('permite excavar desde la entrada, actualiza sistemas y restaura la galería', () => {
    const seed = 20261109;
    const grid = createInitialTerrain(seed, WORLD_REV_ENTRANCE_10);
    const session = new GameSession(grid, seed);
    const mining = new MiningSystem(grid);
    const cell = { column: 28, row: 8 };
    session.tools.add('iron');
    const extracted = grid.get(cell.column, cell.row);
    const material = materialOfBlock(extracted);
    const before = material
      ? session.supplies[material]
      : session.inventory.items.length;
    expect(
      session.mine(mining, TerrainGrid.center({ column: 27, row: 8 }), cell),
    ).toBe(true);
    expect(grid.get(28, 8)).toBe(Block.Air);
    if (material) expect(session.supplies[material]).toBe(before + 1);
    else expect(session.inventory.items.length).toBe(before + 1);
    expect(session.stats.mined).toBe(1);
    expect(session.visibility.has(cell.column, cell.row)).toBe(true);
    expect(session.geotech.collapses.size).toBe(0);
    const raw = encodeSave(session, SPAWN);
    expect(JSON.parse(raw).worldRev).toBe(WORLD_REV_ENTRANCE_10);
    const restored = decodeSave(raw);
    expect(restored?.session.grid.get(28, 8)).toBe(Block.Air);
    expect(restored?.session.grid.get(29, 8)).not.toBe(Block.Air);
    expect(restored?.session.grid.worldRev).toBe(WORLD_REV_ENTRANCE_10);
  });

  it('no crea derrumbes espontáneos en terreno intacto', () => {
    for (const seed of seeds) {
      const session = new GameSession(
        createInitialTerrain(seed, WORLD_REV_ENTRANCE_10),
        seed,
      );
      session.geotech.evaluate();
      expect(session.geotech.collapses.size).toBe(0);
    }
  });

  it('conserva la entrada de seis bloques de una partida anterior', () => {
    const seed = 20261109;
    const old = new GameSession(
      createInitialTerrain(seed, WORLD_REV_SOLID),
      seed,
    );
    const restored = decodeSave(encodeSave(old, SPAWN))!.session;
    expect(restored.grid.worldRev).toBe(WORLD_REV_SOLID);
    expect(restored.grid.get(23, 8)).toBe(Block.Air);
    expect(restored.grid.get(24, 8)).not.toBe(Block.Air);
  });
});
