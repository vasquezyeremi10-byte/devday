import { describe, expect, it } from 'vitest';
import { SPAWN } from '../config/constants';
import { createInitialTerrain } from '../world/Geology';
import { Block, TerrainGrid, type Cell } from '../world/TerrainGrid';
import { FALL, FallingBlocks } from './FallingBlocks';
import { GameSession } from './GameSession';
import {
  GEOTECH,
  GeotechnicalSystem,
  shockZone,
  StabilityState,
  type Span,
} from './GeotechnicalSystem';
import { decodeSave, encodeSave } from './SaveSystem';
import { SupportSystem } from './SupportSystem';

/**
 * Derrumbes con física (16 de noviembre de 2026): estabilidad por tramos,
 * advertencia de 10 s, desprendimiento del techo, caída, cadena controlada,
 * obstrucción y guardado. La caída misma se prueba en FallingBlocks.test.ts.
 */
function solidGrid(columns = 40, rows = 24, block = Block.Rock): TerrainGrid {
  const g = new TerrainGrid(columns, rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) g.set(c, r, block);
  return g;
}
const dig = (
  g: TerrainGrid,
  c0: number,
  c1: number,
  r0: number,
  r1: number,
) => {
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) g.set(c, r, Block.Air);
};
const count = (g: TerrainGrid, block: Block) =>
  g.cells.flat().filter((b) => b === block).length;
const solids = (g: TerrainGrid) =>
  g.cells.flat().filter((b) => b !== Block.Air).length;

/** Mundo de prueba: cielo abierto arriba y una galería a 14–15. */
function mine(from: number, to: number) {
  const grid = solidGrid();
  dig(grid, 0, 39, 0, 4);
  dig(grid, from, to, 14, 15);
  const supports = new SupportSystem();
  const geo = new GeotechnicalSystem(grid, supports);
  geo.evaluate();
  return { grid, supports, geo };
}

/** Desprende un tramo y deja caer todo hasta que se asiente. */
function collapse(
  geo: GeotechnicalSystem,
  grid: TerrainGrid,
  span: Span,
): Cell[] {
  const falling = new FallingBlocks();
  geo.suspended = true;
  for (const d of geo.release(span)) falling.add(d, d.block, 100);
  const landed: Cell[] = [];
  for (let i = 0; i < 600 && falling.active; i++)
    landed.push(...falling.step(16, grid).landed.map((l) => l.cell));
  geo.suspended = false;
  geo.evaluate();
  return landed;
}

describe('Estabilidad estructural', () => {
  it('1. un túnel pequeño es estable: nada se desprende', () => {
    const { geo } = mine(10, 12);
    expect(geo.spans.every((s) => s.state === StabilityState.Stable)).toBe(
      true,
    );
    expect(geo.collapses.size).toBe(0);
    expect(geo.tick(60_000)).toHaveLength(0);
  });

  it('un bloque con aire debajo no cae por eso solo', () => {
    // Galería de cinco en roca: tiene techo sobre vacío y sigue firme.
    const { geo, grid } = mine(10, 14);
    const before = solids(grid);
    expect(geo.collapses.size).toBe(0);
    geo.tick(120_000);
    expect(solids(grid)).toBe(before);
  });

  it('2. una galería demasiado ancha entra en colapso inminente', () => {
    const { geo } = mine(8, 19);
    const span = geo.spans.find((s) => s.roof === 13)!;
    expect(span.state).toBe(StabilityState.Imminent);
    expect(geo.collapses.size).toBe(1);
  });

  it('el techo de tierra aguanta menos que el de roca', () => {
    const roofOf = (block: Block) => {
      const grid = solidGrid(40, 24, block);
      dig(grid, 0, 39, 0, 4);
      dig(grid, 10, 15, 14, 15);
      const geo = new GeotechnicalSystem(grid, new SupportSystem());
      geo.evaluate();
      return geo.spans.find((s) => s.roof === 13)!.score;
    };
    expect(roofOf(Block.Dirt)).toBeGreaterThan(roofOf(Block.Rock));
    expect(roofOf(Block.Rock)).toBeGreaterThan(roofOf(Block.HardRock));
  });
});

describe('Advertencia de 10 segundos', () => {
  it('dura exactamente 10 s de simulación, por grave que sea el tramo', () => {
    expect(GEOTECH.warningMs).toBe(10_000);
    for (const [from, to] of [
      [8, 17],
      [5, 34],
    ] as const) {
      const { geo } = mine(from, to);
      const warning = [...geo.collapses.values()][0]!;
      expect(warning.remaining).toBe(10_000);
      expect(warning.total).toBe(10_000);
      // 9,999 s: todavía no. A los 10 s: se desprende.
      expect(geo.tick(9_999)).toHaveLength(0);
      expect(geo.tick(1)).toHaveLength(1);
    }
  });

  it('cuenta con el tiempo que se le entrega: en pausa no avanza', () => {
    const { geo } = mine(8, 19);
    // 600 cuadros de 16 ms = 9,6 s; la pausa no llama a tick.
    for (let i = 0; i < 600; i++) expect(geo.tick(16)).toHaveLength(0);
    expect([...geo.collapses.values()][0]!.remaining).toBe(400);
    expect(geo.tick(0)).toHaveLength(0);
    expect(geo.tick(400)).toHaveLength(1);
  });

  it('reevaluar o seguir excavando no reinicia el temporizador', () => {
    const { geo, grid } = mine(8, 19);
    geo.tick(6_000);
    for (let i = 0; i < 20; i++) geo.evaluate();
    expect([...geo.collapses.values()][0]!.remaining).toBe(4_000);
    // La galería se ensancha por ambos lados: es el mismo techo.
    dig(grid, 6, 7, 14, 15);
    dig(grid, 20, 21, 14, 15);
    geo.evaluate();
    expect(geo.collapses.size).toBe(1);
    const warning = [...geo.collapses.values()][0]!;
    expect(warning.span.from).toBe(6);
    expect(warning.remaining).toBe(4_000);
  });

  it('4. soportes suficientes antes de los 10 s cancelan el derrumbe', () => {
    const { geo, grid, supports } = mine(8, 19);
    geo.tick(9_000);
    for (const column of [10, 14, 18])
      expect(
        supports.install(grid, { column, row: 15 }, 'wood'),
      ).not.toBeNull();
    geo.evaluate();
    expect(geo.collapses.size).toBe(0);
    const before = solids(grid);
    expect(geo.tick(60_000)).toHaveLength(0);
    expect(solids(grid)).toBe(before);
  });

  it('el acero sostiene más techo que la madera', () => {
    const covered = (kind: 'wood' | 'steel') => {
      const { geo, grid, supports } = mine(8, 19);
      supports.install(grid, { column: 13, row: 15 }, kind);
      geo.evaluate();
      // Largo del mayor tramo que quedó sin sostener.
      return Math.max(
        ...geo.spans.filter((s) => s.roof === 13).map((s) => s.to - s.from + 1),
      );
    };
    expect(covered('steel')).toBeLessThan(covered('wood'));
  });

  it('5. retirar un soporte crítico abre una advertencia nueva de 10 s', () => {
    // Un solo marco de acero sostiene casi toda la galería.
    const { geo, grid, supports } = mine(8, 19);
    supports.install(grid, { column: 13, row: 15 }, 'steel');
    geo.evaluate();
    expect(geo.collapses.size).toBe(0);
    supports.items = [];
    geo.evaluate();
    expect(geo.collapses.size).toBe(1);
    expect([...geo.collapses.values()][0]!.remaining).toBe(10_000);
  });

  it('retirar un soporte que no era crítico no provoca nada', () => {
    const { geo, grid, supports } = mine(8, 19);
    for (const column of [10, 14, 18])
      supports.install(grid, { column, row: 15 }, 'wood');
    geo.evaluate();
    // Sin el del medio quedan tres bloques de techo libre: la roca los aguanta.
    supports.items = supports.items.filter((s) => s.column !== 14);
    geo.evaluate();
    expect(geo.collapses.size).toBe(0);
  });

  it('un soporte que se rompe por desgaste también deja de sostener', () => {
    const { geo, grid, supports } = mine(8, 19);
    supports.install(grid, { column: 13, row: 15 }, 'steel');
    geo.evaluate();
    expect(geo.collapses.size).toBe(0);
    supports.items[0]!.durability = 0;
    geo.evaluate();
    expect(geo.collapses.size).toBe(1);
  });
});

describe('Desprendimiento y caída', () => {
  it('3. sin soportes: el techo del tramo se desprende, cae y obstruye la galería', () => {
    const { geo, grid } = mine(8, 19);
    const total = solids(grid);
    const [due] = geo.tick(10_000);
    const landed = collapse(geo, grid, due!.span);
    // Efecto arco: los dos extremos del tramo quedan colgados.
    expect(landed).toHaveLength(10);
    expect(grid.get(8, 13)).toBe(Block.Rock);
    expect(grid.get(19, 13)).toBe(Block.Rock);
    for (let c = 9; c <= 18; c++) {
      // El techo subió un bloque y el escombro quedó en el piso.
      expect(grid.get(c, 13)).toBe(Block.Air);
      expect(grid.get(c, 15)).toBe(Block.Rubble);
    }
    // 9. La galería quedó obstruida a media altura…
    expect(count(grid, Block.Rubble)).toBe(10);
    // …y nada se creó ni se perdió: cada bloque desprendido es un escombro.
    expect(solids(grid)).toBe(total);
  });

  it('solo se desprende el techo del tramo: nunca fuera de él', () => {
    const { geo, grid } = mine(8, 19);
    const before = grid.cells.map((row) => [...row]);
    const [due] = geo.tick(10_000);
    const detached = geo.release(due!.span);
    for (const d of detached) {
      expect(d.row).toBe(13);
      expect(d.column).toBeGreaterThan(8);
      expect(d.column).toBeLessThan(19);
      expect(d.block).toBe(Block.Rock);
    }
    let changed = 0;
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.columns; c++)
        if (grid.get(c, r) !== before[r]![c]) changed++;
    expect(changed).toBe(detached.length);
  });

  it('el lecho y los bloques protegidos no se desprenden', () => {
    const { geo, grid } = mine(8, 19);
    grid.set(12, 13, Block.Bedrock);
    const [due] = geo.tick(10_000);
    const detached = geo.release(due!.span, (cell) => cell.column === 15);
    expect(detached.some((d) => d.column === 12 || d.column === 15)).toBe(
      false,
    );
    expect(grid.get(12, 13)).toBe(Block.Bedrock);
    expect(grid.get(15, 13)).toBe(Block.Rock);
  });

  it('un techo reforzado (piso de una vía) no forma un tramo inestable', () => {
    const grid = solidGrid();
    dig(grid, 0, 39, 0, 4);
    dig(grid, 8, 19, 14, 15);
    const geo = new GeotechnicalSystem(
      grid,
      new SupportSystem(),
      () => true,
      (column, row) => row === 13 && column >= 8 && column <= 19,
    );
    geo.evaluate();
    expect(geo.collapses.size).toBe(0);
  });

  it('mientras los bloques caen no se abren advertencias nuevas', () => {
    const { geo, grid } = mine(8, 19);
    const [due] = geo.tick(10_000);
    geo.suspended = true;
    geo.release(due!.span);
    geo.evaluate();
    expect(geo.collapses.size).toBe(0);
    geo.suspended = false;
    void grid;
  });

  it('un derrumbe nuevo espera si la simulación de caída está llena', () => {
    const { geo } = mine(8, 19);
    // Sin lugar y con bloques cayendo: queda en cero, esperando.
    expect(geo.tick(10_000, 0, false)).toHaveLength(0);
    expect([...geo.collapses.values()][0]!.remaining).toBe(0);
    expect(geo.tick(16, 4, false)).toHaveLength(0);
    // Con lugar suficiente, sale.
    expect(geo.tick(16, 40, false)).toHaveLength(1);
  });
});

describe('Derrumbes en cadena', () => {
  it('7. el arco se angosta en cada etapa y la bóveda se estabiliza sola', () => {
    const { geo, grid } = mine(8, 19);
    const total = solids(grid);
    const widths: number[] = [];
    for (let stage = 0; stage < 12 && geo.collapses.size; stage++) {
      // Cada etapa tiene su propia advertencia completa de 10 s.
      const warning = [...geo.collapses.values()][0]!;
      expect(warning.remaining).toBe(10_000);
      expect(geo.tick(9_999)).toHaveLength(0);
      const [due] = geo.tick(1);
      widths.push(collapse(geo, grid, due!.span).length);
    }
    // Cada desprendimiento abarca menos que el anterior y la cadena termina.
    expect(widths.length).toBeGreaterThan(1);
    for (let i = 1; i < widths.length; i++)
      expect(widths[i]!).toBeLessThan(widths[i - 1]!);
    expect(geo.collapses.size).toBe(0);
    expect(geo.spans.some((s) => s.state === StabilityState.Imminent)).toBe(
      false,
    );
    // No arrastró el mapa: el daño quedó sobre la galería original.
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.columns; c++)
        if (c < 8 || c > 19)
          expect(grid.get(c, r)).toBe(r <= 4 ? Block.Air : Block.Rock);
    expect(solids(grid)).toBe(total);
    // Quedó lejos de la superficie: la bóveda se cerró antes.
    for (let c = 0; c < grid.columns; c++)
      expect(grid.get(c, 5)).toBe(Block.Rock);
  });

  it('el golpe del derrumbe debilita los marcos vecinos y puede hacerlos ceder', () => {
    const { geo, grid, supports } = mine(8, 30);
    // Marcos de madera sosteniendo la mitad derecha; la izquierda, sin nada.
    for (const column of [22, 26, 30])
      supports.install(grid, { column, row: 15 }, 'wood');
    geo.evaluate();
    const left = [...geo.collapses.values()][0]!.span;
    expect(left.to).toBeLessThan(22);
    const before = supports.items.map((s) => s.durability);
    collapse(geo, grid, geo.tick(10_000)[0]!.span);
    const zone = shockZone(left);
    supports.shock(zone.center, zone.radius);
    // Solo el marco vecino (a tres bloques) recibe el golpe; los lejanos, no.
    expect(supports.items[0]!.durability).toBeLessThan(before[0]!);
    expect(supports.items[2]!.durability).toBe(before[2]!);
    // Un marco ya gastado cede con el golpe: el tramo vecino queda sin sostén
    // y abre su propia advertencia (no se derrumba de inmediato).
    supports.items[0]!.durability = 30;
    supports.shock(zone.center, zone.radius);
    expect(supports.items[0]!.durability).toBe(0);
    geo.evaluate();
    const chained = [...geo.collapses.values()];
    expect(chained.length).toBeGreaterThan(0);
    expect(chained.every((c) => c.remaining === 10_000)).toBe(true);
  });
});

describe('Derrumbes en la partida: recursos y guardado', () => {
  /** Partida con una galería ancha excavada bajo el cerro. */
  function session() {
    const s = new GameSession(createInitialTerrain());
    s.mode = 'normal';
    s.modeChosen = true;
    const cells: Cell[] = [];
    for (let column = 50; column <= 61; column++)
      for (const row of [14, 15]) {
        s.grid.set(column, row, Block.Air);
        s.visibility.reveal(column, row);
        cells.push({ column, row });
      }
    s.afterTerrainChange(cells);
    return s;
  }
  const fall = (s: GameSession) => {
    const landed: Cell[] = [];
    for (let i = 0; i < 600 && s.falling.active; i++)
      landed.push(...s.falling.step(16, s.grid).landed.map((l) => l.cell));
    s.geotech.suspended = false;
    s.afterTerrainChange(landed);
    return landed;
  };
  const detach = (s: GameSession) => {
    const [due] = s.geotech.tick(10_000);
    const detached = s.geotech.release(due!.span, (c) => s.protected(c));
    s.geotech.suspended = true;
    for (const d of detached) s.falling.add(d, d.block, 120);
    s.afterTerrainChange(detached);
    return detached;
  };

  it('9. el escombro obstruye y se despeja con pala: un bloque, una unidad', () => {
    const s = session();
    expect(s.geotech.collapses.size).toBe(1);
    const detached = detach(s);
    const landed = fall(s);
    expect(landed).toHaveLength(detached.length);
    const cell = landed[0]!;
    expect(s.grid.get(cell.column, cell.row)).toBe(Block.Rubble);
    // El escombro es terreno normal: bloquea y rinde una unidad de piedra.
    expect(s.storageProblem(Block.Rubble)).toBeNull();
    s.tools.add('shovel');
    expect(s.toolProblem(Block.Rubble)).toBeNull();
    const before = s.supplies.mat_stone;
    s.grid.set(cell.column, cell.row, Block.Air);
    s.addMaterial('mat_stone');
    expect(s.supplies.mat_stone).toBe(before + 1);
  });

  it('10. guardar y cargar después de un derrumbe conserva el escombro y el techo caído', () => {
    const s = session();
    const detached = detach(s);
    const landed = fall(s);
    const raw = encodeSave(s, SPAWN);
    expect(JSON.parse(raw).falling).toBeUndefined();
    const back = decodeSave(raw)!;
    expect(back).not.toBeNull();
    for (const d of detached)
      expect(back.session.grid.get(d.column, d.row)).toBe(Block.Air);
    for (const c of landed)
      expect(back.session.grid.get(c.column, c.row)).toBe(Block.Rubble);
    // Idempotente: volver a guardar lo cargado da el mismo guardado.
    expect(encodeSave(back.session, back.player)).toBe(raw);
  });

  it('guardar durante la advertencia: al cargar la cuenta recomienza completa', () => {
    const s = session();
    s.geotech.tick(7_000);
    const data = JSON.parse(encodeSave(s, SPAWN));
    expect(data.collapses[0].remaining).toBe(3_000);
    const back = decodeSave(JSON.stringify(data))!.session;
    // Nunca se derrumba al abrir la partida: vuelven los 10 s.
    expect([...back.geotech.collapses.values()][0]!.remaining).toBe(10_000);
    expect(back.falling.active).toBe(false);
  });

  it('guardar en plena caída: al cargar, cada bloque queda asentado como escombro', () => {
    const s = session();
    const total = solids(s.grid);
    const detached = detach(s);
    for (let i = 0; i < 12; i++) s.falling.step(16, s.grid);
    expect(s.falling.active).toBe(true);
    // En el aire: la cuadrícula tiene menos bloques que antes.
    expect(solids(s.grid)).toBeLessThan(total);
    const raw = encodeSave(s, SPAWN);
    expect(JSON.parse(raw).falling.length).toBe(s.falling.blocks.length);
    const back = decodeSave(raw)!.session;
    expect(back.falling.active).toBe(false);
    expect(back.geotech.suspended).toBe(false);
    // Nada se perdió ni se duplicó: los mismos bloques, ahora escombro.
    expect(solids(back.grid)).toBe(total);
    expect(count(back.grid, Block.Rubble)).toBe(detached.length);
    for (const d of detached) {
      expect(back.grid.get(d.column, d.row)).toBe(Block.Air);
      expect(back.grid.get(d.column, 15)).toBe(Block.Rubble);
    }
    // Y esa partida vuelve a guardarse sin bloques pendientes.
    expect(JSON.parse(encodeSave(back, SPAWN)).falling).toBeUndefined();
  });

  it('una partida anterior (sin el dato) carga igual', () => {
    const s = session();
    const data = JSON.parse(encodeSave(s, SPAWN));
    delete data.falling;
    expect(decodeSave(JSON.stringify(data))).not.toBeNull();
    data.falling = 'corrupto';
    expect(decodeSave(JSON.stringify(data))).not.toBeNull();
  });

  it('11. rendimiento: evaluar el mundo real y simular el máximo de bloques', () => {
    const s = session();
    let t0 = performance.now();
    for (let i = 0; i < 40; i++) s.geotech.evaluate();
    const evaluate = (performance.now() - t0) / 40;
    // Sin daño de tronadura, avanzar las cuentas no recorre el mapa.
    t0 = performance.now();
    for (let i = 0; i < 5000; i++) s.geotech.tick(0);
    const tick = (performance.now() - t0) / 5000;
    const grid = solidGrid(120, 40);
    dig(grid, 2, 110, 12, 30);
    const falling = new FallingBlocks();
    for (let c = 2; c < 2 + FALL.maxActive; c++) {
      grid.set(c, 11, Block.Air);
      falling.add({ column: c, row: 11 }, Block.Rock, (c * 53) % 400);
    }
    t0 = performance.now();
    let steps = 0;
    for (; steps < 800 && falling.active; steps++) falling.step(16, grid);
    const step = (performance.now() - t0) / steps;
    expect(falling.active).toBe(false);
    // Márgenes holgados para no depender de la máquina.
    expect(evaluate).toBeLessThan(8);
    expect(tick).toBeLessThan(0.05);
    expect(step).toBeLessThan(2);
  });
});
