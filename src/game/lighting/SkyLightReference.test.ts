import { describe, expect, it } from 'vitest';
import { TILE_SIZE, WORLD } from '../config/constants';
import { LIGHTING } from '../config/lighting';
import {
  createInitialTerrain,
  generateWorld,
  rng,
  WORLD_REV_EXPLORE,
} from '../world/Geology';
import { Block, surfaceRow, TerrainGrid } from '../world/TerrainGrid';
import { SkyLightMap } from './LightingZones';

/**
 * Caracterización de la luz natural (auditoría del 16 de noviembre de 2026).
 *
 * `reference` es la propagación tal como estaba escrita antes de optimizar
 * `SkyLightMap.compute`, copiada aquí como oráculo. La prueba exige que el
 * mapa del juego sea idéntico celda por celda (mapa estricto y mapa suave)
 * en el mundo inicial y después de excavar: la optimización no puede cambiar
 * qué se ve, qué se descubre ni en qué zona está el minero.
 */
const PER_TILE = TILE_SIZE / LIGHTING.cell;

/**
 * Mundo desde la columna 0 hasta el borde este (sin el oeste del mundo
 * abierto): las pruebas de esta caracterización sortean columnas desde 0.
 * El mundo completo, con columnas negativas, tiene su propia prueba.
 */
const eastTerrain = (seed: number, rev: number): TerrainGrid =>
  generateWorld(seed, rev, WORLD.columns, 0).grid;

function reference(grid: TerrainGrid): { level: Uint8Array; soft: Uint8Array } {
  const { max, airStep, solidStep, softStep, faceStep } = LIGHTING.sky;
  const w = grid.columns * PER_TILE,
    h = grid.rows * PER_TILE,
    size = w * h;
  const solid = new Uint8Array(size);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      solid[y * w + x] = grid.isSolid(
        Math.floor(x / PER_TILE) + grid.first,
        Math.floor(y / PER_TILE),
      )
        ? 1
        : 0;
  const neighbours = (i: number): number[] => {
    const x = i % w;
    return [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
  };
  const spread = (step: number): Uint8Array => {
    const level = new Uint8Array(size);
    const buckets: number[][] = Array.from({ length: max + 1 }, () => []);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (
          !solid[i] &&
          Math.floor(y / PER_TILE) <
            surfaceRow(Math.floor(x / PER_TILE) + grid.first)
        ) {
          level[i] = max;
          buckets[max]!.push(i);
        }
      }
    for (let l = max; l > 0; l--) {
      const bucket = buckets[l]!;
      while (bucket.length) {
        const i = bucket.pop()!;
        if (level[i] !== l) continue;
        for (const n of neighbours(i)) {
          if (n < 0 || n >= size) continue;
          if (solid[i] && !solid[n]) continue;
          const next = l - (solid[n] ? step : airStep);
          if (next > level[n]!) {
            level[n] = next;
            buckets[next]!.push(n);
          }
        }
      }
    }
    return level;
  };
  const level = spread(solidStep);
  const soft = spread(softStep);
  // Caras de roca que miran a galerías oscuras.
  const face = new Uint8Array(size).fill(255);
  const buckets: number[][] = Array.from({ length: max + 1 }, () => []);
  for (let i = 0; i < size; i++)
    if (!solid[i] && level[i]! < max) {
      face[i] = level[i]!;
      buckets[level[i]!]!.push(i);
    }
  for (let l = 0; l < max; l++) {
    const bucket = buckets[l]!;
    while (bucket.length) {
      const i = bucket.pop()!;
      if (face[i] !== l) continue;
      const next = l + faceStep;
      if (next >= max) continue;
      for (const n of neighbours(i)) {
        if (n < 0 || n >= size || !solid[n]) continue;
        if (next < face[n]!) {
          face[n] = next;
          buckets[next]!.push(n);
        }
      }
    }
  }
  for (let i = 0; i < size; i++)
    if (solid[i]) {
      if (face[i]! < level[i]!) level[i] = face[i]!;
      if (face[i]! < soft[i]!) soft[i] = face[i]!;
    }
  return { level, soft };
}

/** Primera celda distinta (−1 si los mapas son iguales): falla legible. */
const firstDifference = (a: Uint8Array, b: Uint8Array): number => {
  if (a.length !== b.length) return 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
};

function expectSame(grid: TerrainGrid, sky: SkyLightMap): void {
  const expected = reference(grid);
  expect(firstDifference(sky.level, expected.level)).toBe(-1);
  expect(firstDifference(sky.soft, expected.soft)).toBe(-1);
}

describe('Luz natural: idéntica a la propagación de referencia', () => {
  it.each([
    ['mundo original', 20261109, 1],
    ['mundo con cavernas', 20261109, WORLD_REV_EXPLORE],
    ['otra semilla con cavernas', 987654321, WORLD_REV_EXPLORE],
  ])('%s', (_name, seed, rev) => {
    const grid = eastTerrain(seed, rev);
    const sky = new SkyLightMap(grid.columns, grid.rows);
    sky.compute(grid);
    expectSame(grid, sky);
  });

  it('mundo abierto: idéntica en todo el mundo, también al excavar en el oeste', () => {
    const grid = createInitialTerrain(20261109, WORLD_REV_EXPLORE);
    expect(grid.first).toBeLessThan(0);
    const sky = new SkyLightMap(grid.columns, grid.rows, surfaceRow, grid.first);
    sky.compute(grid);
    expectSame(grid, sky);
    // Pozo bajo el campamento y otro en el oeste: la actualización por zona
    // coincide con el cálculo de referencia.
    const cells = [];
    for (const column of [-20, -600])
      for (let row = surfaceRow(column); row < surfaceRow(column) + 6; row++) {
        grid.set(column, row, Block.Air);
        cells.push({ column, row });
      }
    sky.update(grid, cells);
    expectSame(grid, sky);
    // La luz entra en el pozo del campamento.
    expect(sky.at(-20 * TILE_SIZE + 8, (surfaceRow(-20) + 2) * TILE_SIZE)).toBeGreaterThan(0);
  });

  it('sigue idéntica tras excavar, derrumbar y construir (recalculada cada vez)', () => {
    const grid = eastTerrain(20261109, WORLD_REV_EXPLORE);
    const sky = new SkyLightMap(grid.columns, grid.rows);
    const random = rng(4242);
    const int = (a: number, b: number) =>
      a + Math.floor(random() * (b - a + 1));
    for (let round = 0; round < 6; round++) {
      // Un pozo desde la superficie, una galería y bloques sueltos.
      const column = int(2, grid.columns - 3);
      for (
        let row = surfaceRow(column);
        row < surfaceRow(column) + int(2, 9);
        row++
      )
        if (grid.get(column, row) !== Block.Bedrock)
          grid.set(column, row, Block.Air);
      const row = int(11, grid.rows - 3);
      for (
        let c = column;
        c < Math.min(grid.columns - 2, column + int(2, 8));
        c++
      )
        if (grid.get(c, row) !== Block.Bedrock) grid.set(c, row, Block.Air);
      // Escombro y un bloque colocado sobre la superficie.
      grid.set(column, surfaceRow(column) + 1, Block.Rubble);
      const high = int(2, grid.columns - 3);
      if (surfaceRow(high) > 1)
        grid.set(high, surfaceRow(high) - 1, Block.Wood);
      sky.compute(grid);
      expectSame(grid, sky);
    }
  });

  it('recalcular sin cambios da el mismo mapa (los búferes se reutilizan)', () => {
    const grid = eastTerrain(20261109, 1);
    // Con una superficie propia cambian las fuentes de luz: la referencia usa
    // `surfaceRow`, así que aquí solo se exige estabilidad entre cálculos.
    const flat = new SkyLightMap(grid.columns, grid.rows, () => 10);
    flat.compute(grid);
    const level = Uint8Array.from(flat.level),
      soft = Uint8Array.from(flat.soft);
    flat.compute(grid);
    expect(firstDifference(flat.level, level)).toBe(-1);
    expect(firstDifference(flat.soft, soft)).toBe(-1);
  });
});

/**
 * `update` recalcula solo la zona que alcanzan los bloques cambiados. Debe
 * dar, celda por celda, lo mismo que calcular el mapa entero (el oráculo), y
 * seguir dándolo cambio tras cambio: un error en el borde de la ventana se
 * acumularía y aparecería aquí.
 */
describe('Luz natural: la actualización por zona es idéntica al cálculo completo', () => {
  type Tile = { column: number; row: number };
  type Internals = Record<'rawLevel' | 'rawSoft' | 'face' | 'solid', Uint8Array>;

  /**
   * Además del mapa visible, el estado interno (propagación sin recortar,
   * caras y sólidos) debe quedar igual que tras un cálculo completo: es lo
   * que la próxima actualización toma como borde de su ventana.
   */
  function expectSameState(grid: TerrainGrid, sky: SkyLightMap): void {
    expectSame(grid, sky);
    const twin = new SkyLightMap(grid.columns, grid.rows);
    twin.compute(grid);
    const a = sky as unknown as Internals,
      b = twin as unknown as Internals;
    for (const key of ['solid', 'rawLevel', 'rawSoft', 'face'] as const)
      expect(`${key}: ${firstDifference(a[key], b[key])}`).toBe(`${key}: -1`);
  }

  it('excavar, rellenar y construir, un cambio tras otro', () => {
    const grid = eastTerrain(20261109, WORLD_REV_EXPLORE);
    const sky = new SkyLightMap(grid.columns, grid.rows);
    sky.compute(grid);
    const random = rng(99);
    const int = (a: number, b: number) => a + Math.floor(random() * (b - a + 1));
    const set = (column: number, row: number, block: Block): Tile => {
      grid.set(column, row, block);
      return { column, row };
    };
    // Un pozo que baja desde la superficie y galerías que salen de él.
    const shaft = 60;
    let depth = surfaceRow(shaft);
    const dug: Tile[] = [];
    for (let round = 0; round < 42; round++) {
      const cells: Tile[] = [];
      switch (round % 7) {
        case 0: // el pozo baja un bloque: la luz del día entra más
          cells.push(set(shaft, depth++, Block.Air));
          dug.push(cells[0]!);
          break;
        case 1: {
          // galería horizontal desde el fondo del pozo (varios bloques a la vez)
          const row = depth - 1;
          for (let c = shaft + 1; c <= shaft + int(2, 6); c++) {
            cells.push(set(c, row, Block.Air));
            dug.push({ column: c, row });
          }
          break;
        }
        case 2: {
          // un bloque suelto en la superficie, en cualquier bioma
          const column = int(1, grid.columns - 2);
          cells.push(set(column, surfaceRow(column), Block.Air));
          break;
        }
        case 3: {
          // un bloque construido sobre la superficie: tapa el cielo
          const column = int(1, grid.columns - 2);
          if (surfaceRow(column) > 1)
            cells.push(set(column, surfaceRow(column) - 1, Block.Wood));
          break;
        }
        case 4: {
          // escombro que rellena algo ya excavado
          const cell = dug[int(0, dug.length - 1)]!;
          cells.push(set(cell.column, cell.row, Block.Rubble));
          break;
        }
        case 5: {
          // junto a la bocamina y en los bordes del mundo
          cells.push(set(26, 8, Block.Air));
          cells.push(set(round % 2 ? 0 : grid.columns - 1, 10, Block.Air));
          cells.push(set(int(1, grid.columns - 2), grid.rows - 2, Block.Air));
          break;
        }
        default: {
          // un techo que se desprende: una fila entera de bloques
          const row = int(12, 20),
            from = int(100, 300);
          for (let c = from; c < from + int(4, 14); c++)
            cells.push(set(c, row, Block.Air));
        }
      }
      sky.update(grid, cells);
      expectSameState(grid, sky);
    }
  });

  it('tapar y destapar la boca de una galería larga: el cambio llega lejos', () => {
    // El caso que más alcance exige: la luz del día entra unas veinte celdas
    // por la bocamina; al tapar la boca, toda esa luz desaparece.
    const grid = eastTerrain(20261109, 1);
    const sky = new SkyLightMap(grid.columns, grid.rows);
    sky.compute(grid);
    const mouth = [7, 8, 9].map((row) => ({ column: 18, row }));
    const lit = sky.at(20 * 16 + 8, 8 * 16 + 8);
    expect(lit).toBeGreaterThan(0);
    for (const cell of mouth) grid.set(cell.column, cell.row, Block.Wood);
    sky.update(grid, mouth);
    expectSameState(grid, sky);
    expect(sky.at(20 * 16 + 8, 8 * 16 + 8)).toBe(0);
    // Se destapa de a un bloque: la luz vuelve a entrar, cada vez más.
    for (const cell of mouth) {
      grid.set(cell.column, cell.row, Block.Air);
      sky.update(grid, [cell]);
      expectSameState(grid, sky);
    }
    expect(sky.at(20 * 16 + 8, 8 * 16 + 8)).toBe(lit);
    // Una losa delgada sobre la galería: la cara que da a lo oscuro cambia.
    const slab = { column: 22, row: 6 };
    grid.set(slab.column, slab.row, Block.Air);
    sky.update(grid, [slab]);
    expectSameState(grid, sky);
    grid.set(slab.column, slab.row, Block.Rock);
    sky.update(grid, [slab]);
    expectSameState(grid, sky);
  });

  it('túneles ciegos de cada largo: las caras de roca cambian más allá de la luz', () => {
    // Acantilado a la izquierda (cielo hasta la fila 9) y un túnel ciego que
    // entra en la roca. Al tapar la boca cambia la luz del túnel y, con ella,
    // la cara de la roca que sigue tras su fondo: el alcance máximo.
    const surface = (column: number) => (column < 5 ? 10 : 4);
    const keys = ['level', 'soft', 'rawLevel', 'rawSoft', 'face', 'solid'] as const;
    for (let length = 2; length <= 9; length++) {
      const grid = new TerrainGrid(44, 24);
      for (let row = 0; row < grid.rows; row++)
        for (let column = 0; column < grid.columns; column++)
          if (row >= surface(column)) grid.set(column, row, Block.Rock);
      for (let column = 5; column < 5 + length; column++)
        grid.set(column, 8, Block.Air);
      const sky = new SkyLightMap(grid.columns, grid.rows, surface);
      sky.compute(grid);
      const twin = new SkyLightMap(grid.columns, grid.rows, surface);
      const mouth = { column: 5, row: 8 };
      for (const block of [Block.Rock, Block.Air, Block.Rubble, Block.Air]) {
        grid.set(mouth.column, mouth.row, block);
        sky.update(grid, [mouth]);
        twin.compute(grid);
        const a = sky as unknown as Record<string, Uint8Array>,
          b = twin as unknown as Record<string, Uint8Array>;
        for (const key of keys)
          expect(`${length} ${key}: ${firstDifference(a[key]!, b[key]!)}`).toBe(
            `${length} ${key}: -1`,
          );
      }
    }
  });

  it('sin cambios, o con bloques fuera del mundo, no altera nada', () => {
    const grid = eastTerrain(20261109, 1);
    const sky = new SkyLightMap(grid.columns, grid.rows);
    sky.compute(grid);
    const level = Uint8Array.from(sky.level),
      soft = Uint8Array.from(sky.soft);
    sky.update(grid, []);
    sky.update(grid, [
      { column: -3, row: 5 },
      { column: grid.columns + 2, row: 5 },
      { column: 10, row: grid.rows },
    ]);
    // Avisar de un bloque que no cambió recalcula su zona y da lo mismo.
    sky.update(grid, [{ column: 40, row: 12 }]);
    expect(firstDifference(sky.level, level)).toBe(-1);
    expect(firstDifference(sky.soft, soft)).toBe(-1);
  });

  it('un cambio que abarca casi todo el mapa también coincide', () => {
    const grid = eastTerrain(20261109, 1);
    const sky = new SkyLightMap(grid.columns, grid.rows);
    sky.compute(grid);
    const cells: Tile[] = [];
    for (const column of [3, grid.columns - 4])
      for (const row of [11, grid.rows - 3]) {
        grid.set(column, row, Block.Air);
        cells.push({ column, row });
      }
    sky.update(grid, cells);
    expectSameState(grid, sky);
  });

  it('actualizar la zona cuesta una fracción del cálculo completo', () => {
    const grid = eastTerrain(20261109, WORLD_REV_EXPLORE);
    const sky = new SkyLightMap(grid.columns, grid.rows);
    sky.compute(grid);
    const time = (fn: () => void, n: number) => {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) fn();
      return (performance.now() - t0) / n;
    };
    const full = time(() => sky.compute(grid), 10);
    const cell = { column: 200, row: 14 };
    grid.set(cell.column, cell.row, Block.Air);
    const zone = time(() => sky.update(grid, [cell]), 40);
    expect(zone).toBeLessThan(full / 4);
  });
});
