import { describe, expect, it } from 'vitest';
import { PLAYER } from '../config/constants';
import { Block, createInitialTerrain, TerrainGrid } from '../world/TerrainGrid';
import { MiningSystem } from './MiningSystem';

describe('Terreno y excavación', () => {
  it('genera suelo, entrada transitable, roca y límites protegidos', () => {
    const grid = createInitialTerrain();
    expect(grid.get(13, 9)).toBe(Block.Air);
    expect(grid.get(13, 10)).toBe(Block.Dirt);
    expect(grid.get(18, 8)).toBe(Block.Air);
    expect(grid.get(25, 9)).toBe(Block.Air);
    expect(grid.get(26, 9)).toBe(Block.Dirt);
    expect(grid.get(30, 20)).toBe(Block.Rock);
    expect(grid.get(30, 35)).toBe(Block.Bedrock);
  });

  it('convierte bordes y coordenadas negativas con floor', () => {
    expect(TerrainGrid.worldToCell(-0.1, 16)).toEqual({ column: -1, row: 1 });
    expect(TerrainGrid.worldToCell(15.99, 31.99)).toEqual({
      column: 0,
      row: 1,
    });
  });

  it('rechaza coordenadas inválidas y no crea celdas accidentales', () => {
    const grid = new TerrainGrid(4, 4);
    expect(() => grid.set(4, 0, Block.Dirt)).toThrow(RangeError);
    expect(grid.contains(0.5, 0)).toBe(false);
    expect(
      new MiningSystem(grid).inspect({ x: 0, y: 0 }, { column: -1, row: 0 }),
    ).toBe('outside');
  });

  it('excava una sola vez y deja vacío el bloque', () => {
    const grid = createInitialTerrain();
    const mining = new MiningSystem(grid);
    const target = { column: 13, row: 10 };
    expect(mining.dig({ x: 216, y: 151 }, target)).toBe('ready');
    expect(grid.get(13, 10)).toBe(Block.Air);
    expect(mining.dig({ x: 216, y: 151 }, target)).toBe('empty');
    expect(mining.excavated).toBe(1);
  });

  it('acepta el alcance exacto y rechaza un punto más allá', () => {
    const grid = new TerrainGrid(8, 8);
    grid.set(4, 4, Block.Rock);
    const mining = new MiningSystem(grid);
    expect(
      mining.inspect({ x: 72 - PLAYER.reach, y: 72 }, { column: 4, row: 4 }),
    ).toBe('ready');
    expect(
      mining.inspect(
        { x: 72 - PLAYER.reach - 0.01, y: 72 },
        { column: 4, row: 4 },
      ),
    ).toBe('far');
  });

  it('no cambia un bloque lejano', () => {
    const grid = createInitialTerrain();
    const mining = new MiningSystem(grid);
    expect(mining.dig({ x: 208, y: 151 }, { column: 40, row: 20 })).toBe('far');
    expect(grid.get(40, 20)).toBe(Block.Rock);
    expect(mining.excavated).toBe(0);
  });

  it('protege el lecho aun dentro del alcance', () => {
    const grid = new TerrainGrid(4, 4);
    grid.set(1, 1, Block.Bedrock);
    expect(
      new MiningSystem(grid).dig({ x: 8, y: 24 }, { column: 1, row: 1 }),
    ).toBe('protected');
    expect(grid.get(1, 1)).toBe(Block.Bedrock);
  });

  it('impide excavar a través de otro bloque aunque el objetivo esté expuesto', () => {
    const grid = new TerrainGrid(5, 5);
    grid.set(2, 2, Block.Rock);
    grid.set(3, 2, Block.Rock);
    const mining = new MiningSystem(grid);
    expect(mining.inspect({ x: 24, y: 40 }, { column: 3, row: 2 })).toBe(
      'occluded',
    );
    expect(mining.dig({ x: 24, y: 40 }, { column: 2, row: 2 })).toBe('ready');
    expect(mining.inspect({ x: 24, y: 40 }, { column: 3, row: 2 })).toBe(
      'ready',
    );
  });

  it('rechaza bloques totalmente rodeados', () => {
    const grid = new TerrainGrid(5, 5);
    for (let row = 1; row < 4; row++)
      for (let column = 1; column < 4; column++)
        grid.set(column, row, Block.Dirt);
    expect(
      new MiningSystem(grid).inspect({ x: 24, y: 40 }, { column: 2, row: 2 }),
    ).toBe('occluded');
  });

  it('regenerar restaura el terreno sin compartir arrays con la partida anterior', () => {
    const grid = createInitialTerrain();
    grid.set(13, 10, Block.Air);
    expect(createInitialTerrain().get(13, 10)).toBe(Block.Dirt);
  });
});
