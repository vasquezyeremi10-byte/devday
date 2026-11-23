import { describe, expect, it } from 'vitest';
import { PLAYER } from '../config/constants';
import { createInitialTerrain } from '../world/Geology';
import {
  Block,
  mineralOf,
  surfaceRow,
  TerrainGrid,
} from '../world/TerrainGrid';
import {
  edgeFrame,
  MACRO_COLUMNS,
  macroFrame,
  materialAt,
  TerrainFrame,
  terrainFrame,
  transitionFrame,
} from '../world/TerrainVisuals';
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

  it('levanta un cerro con bocamina, cumbre rocosa y ladera escalonada', () => {
    const grid = createInitialTerrain();
    // Bocamina: aire frente a la galería y techo de tierra encima.
    expect(grid.get(17, 7)).toBe(Block.Air);
    expect(grid.get(18, 7)).toBe(Block.Air);
    expect(grid.get(18, 6)).toBe(Block.Dirt);
    expect(grid.get(18, 5)).toBe(Block.Air);
    // Cumbre con afloramiento de roca y cielo encima.
    expect(grid.get(26, 1)).toBe(Block.Air);
    expect(grid.get(26, 2)).toBe(Block.Rock);
    // La ladera derecha baja de a una fila hasta el valle.
    for (let column = 27; column < 47; column++)
      expect(
        Math.abs(surfaceRow(column + 1) - surfaceRow(column)),
      ).toBeLessThanOrEqual(1);
    expect(surfaceRow(60)).toBe(10);
    expect(grid.get(60, 9)).toBe(Block.Air);
  });

  it('elige variantes de superficie solo por aspecto, sin alterar el bloque', () => {
    const grid = createInitialTerrain();
    expect(terrainFrame(grid, 18, 6)).toBe(TerrainFrame.GrassLeft);
    expect(terrainFrame(grid, 13, 10)).toBe(TerrainFrame.Grass);
    expect(terrainFrame(grid, 46, 9)).toBe(TerrainFrame.GrassRight);
    // Un afloramiento de la cima es roca (colisión igual) con aspecto de
    // arenisca del desierto, no la roca gris azulada del subsuelo.
    expect(grid.get(26, 2)).toBe(Block.Rock);
    expect(materialAt(grid, 26, 2)).toBe('outcrop');
    expect(materialAt(grid, 26, 20)).not.toBe('outcrop');
    // El piso de la galería no recibe pasto aunque tenga aire encima.
    expect(terrainFrame(grid, 20, 10)).not.toBe(TerrainFrame.Grass);
    expect(terrainFrame(grid, 20, 8)).toBe(-1);
    expect(terrainFrame(grid, 30, 35)).toBeOneOf([
      TerrainFrame.Bedrock,
      TerrainFrame.BedrockAlt,
    ]);
    grid.set(18, 6, Block.Air);
    expect(terrainFrame(grid, 18, 6)).toBe(-1);
  });

  it('apila estratos geológicos y continúa la macrotextura entre bloques', () => {
    const grid = createInitialTerrain();
    expect(materialAt(grid, 13, 11)).toBe('soil');
    // La columna 13 (pozo de prueba) no tiene yacimientos.
    expect(materialAt(grid, 13, 12)).toBe('subsoil');
    expect(materialAt(grid, 13, 13)).toBe('weathered');
    expect(['rock', 'fractured']).toContain(materialAt(grid, 13, 18));
    expect(materialAt(grid, 13, 28)).toBe('deep');
    // Bloques vecinos del mismo material usan ventanas contiguas.
    const left = macroFrame('rock', 4, 17);
    expect(macroFrame('rock', 5, 17)).toBe(left + 1);
    expect(macroFrame('rock', 4 + MACRO_COLUMNS, 17)).toBe(left);
    // Contacto tierra-roca con franja de transición.
    expect(transitionFrame(grid, 13, 13)).toBeGreaterThanOrEqual(
      TerrainFrame.TransitionFirst,
    );
  });

  it('autotile: contorno solo en caras expuestas, recalculado al excavar', () => {
    const grid = createInitialTerrain();
    expect(edgeFrame(grid, 5, 20)).toBe(-1);
    // El piso de la galería tiene aire encima: borde superior (máscara 1).
    expect(edgeFrame(grid, 20, 10)).toBe(TerrainFrame.EdgeFirst + 1);
    // Superficie natural: sin contorno superior sobre el pasto.
    expect(edgeFrame(grid, 5, 10)).toBe(-1);
    grid.set(5, 20, Block.Air);
    expect(edgeFrame(grid, 5, 20)).toBe(-1);
    expect(edgeFrame(grid, 6, 20)).toBe(TerrainFrame.EdgeFirst + 8);
    expect(edgeFrame(grid, 5, 19)).toBe(TerrainFrame.EdgeFirst + 4);
    expect(edgeFrame(grid, 5, 21)).toBe(TerrainFrame.EdgeFirst + 1);
  });

  it('distribuye menas sin tocar superficie, galería ni el pozo de prueba', () => {
    const grid = createInitialTerrain();
    for (let row = 10; row < 35; row++)
      expect(mineralOf(grid.get(13, row))).toBeNull();
    for (let column = 0; column < grid.columns; column++)
      expect(mineralOf(grid.get(column, surfaceRow(column)))).toBeNull();
    let gold: [number, number] | null = null;
    for (let r = 0; r < grid.rows && !gold; r++)
      for (let c = 0; c < grid.columns; c++)
        if (grid.get(c, r) === Block.Gold) {
          gold = [c, r];
          break;
        }
    expect(gold).not.toBeNull();
    expect(terrainFrame(grid, gold![0], gold![1])).toBe(
      TerrainFrame.OreFirst + 3,
    );
    // Oculto: un bloque no descubierto se ve como su estrato, sin mena.
    expect(terrainFrame(grid, gold![0], gold![1], () => false)).not.toBe(
      TerrainFrame.OreFirst + 3,
    );
    expect(materialAt(grid, 30, 25)).toBe('deep');
  });

  it('registra hallazgos solo de minerales realmente extraídos', () => {
    const grid = new TerrainGrid(6, 6);
    grid.set(2, 2, Block.Gold);
    grid.set(3, 2, Block.Dirt);
    const mining = new MiningSystem(grid);
    expect(mining.dig({ x: 24, y: 56 }, { column: 2, row: 2 })).toBe('ready');
    expect(mining.lastBlock).toBe(Block.Gold);
    expect(mining.discovered.gold).toBe(1);
    expect(mining.dig({ x: 24, y: 56 }, { column: 2, row: 2 })).toBe('empty');
    expect(mining.dig({ x: 56, y: 56 }, { column: 3, row: 2 })).toBe('ready');
    expect(mining.lastBlock).toBe(Block.Dirt);
    expect(Object.values(mining.discovered).reduce((a, b) => a + b)).toBe(1);
    expect(mining.excavated).toBe(2);
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
