import { describe, expect, it } from 'vitest';
import { PPE_EFFECT } from '../config/gear';
import { Block, TerrainGrid } from '../world/TerrainGrid';
import { FALL, FallingBlocks, impactDamage } from './FallingBlocks';

/** Cuadrícula sólida con una cámara de aire (columnas y filas inclusive). */
function chamber(c0: number, c1: number, r0: number, r1: number): TerrainGrid {
  const g = new TerrainGrid(20, 20);
  for (let r = 0; r < g.rows; r++)
    for (let c = 0; c < g.columns; c++) g.set(c, r, Block.Rock);
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) g.set(c, r, Block.Air);
  return g;
}

/** Desprende el bloque de la cuadrícula y lo entrega a la simulación. */
function detach(
  f: FallingBlocks,
  g: TerrainGrid,
  column: number,
  row: number,
  delay = 0,
) {
  const block = g.get(column, row);
  g.set(column, row, Block.Air);
  return f.add({ column, row }, block, delay);
}

const solids = (g: TerrainGrid) =>
  g.cells.flat().filter((b) => b !== Block.Air).length;

describe('Bloques desprendidos: caída física', () => {
  it('se afloja, cae acelerando y se asienta como escombro sobre el piso', () => {
    const g = chamber(5, 9, 6, 11); // cámara de 6 de alto
    const f = new FallingBlocks();
    const total = solids(g);
    const b = detach(f, g, 7, 5, 100);
    expect(g.get(7, 5)).toBe(Block.Air);
    // Mientras se afloja no se mueve.
    let step = f.step(50, g);
    expect(b.y).toBe(5 * 16);
    expect(step.released).toHaveLength(0);
    step = f.step(50, g);
    expect(step.released).toEqual([b]);
    // Cae: la posición avanza cada paso y la velocidad crece (aceleración).
    const ys = [b.y],
      speeds = [b.vy];
    let landed = step.landed;
    for (let i = 0; i < 200 && !landed.length; i++) {
      landed = f.step(16, g).landed;
      if (!landed.length) {
        ys.push(b.y);
        speeds.push(b.vy);
      }
    }
    expect(ys.length).toBeGreaterThan(10);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
      expect(speeds[i]!).toBeGreaterThanOrEqual(speeds[i - 1]!);
    }
    // El avance por paso crece: no es un movimiento uniforme ni un salto.
    expect(ys[8]! - ys[7]!).toBeGreaterThan(ys[2]! - ys[1]!);
    expect(Math.max(...ys.slice(1).map((y, i) => y - ys[i]!))).toBeLessThan(16);
    // Se asienta en el fondo de la cámara, convertido en escombro.
    expect(landed).toHaveLength(1);
    expect(landed[0]!.cell).toEqual({ column: 7, row: 11 });
    expect(landed[0]!.speed).toBeGreaterThan(200);
    expect(g.get(7, 11)).toBe(Block.Rubble);
    expect(f.active).toBe(false);
    // Un bloque desprendido, un bloque asentado: nada se crea ni se pierde.
    expect(solids(g)).toBe(total);
  });

  it('la velocidad nunca pasa del tope', () => {
    const g = new TerrainGrid(4, 400);
    g.set(1, 399, Block.Rock);
    const f = new FallingBlocks();
    const b = f.add({ column: 1, row: 0 }, Block.Rock);
    for (let i = 0; i < 120; i++) f.step(16, g);
    expect(b.vy).toBe(FALL.maxSpeed);
  });

  it('los bloques de una misma columna se apilan sin encimarse', () => {
    const g = chamber(5, 9, 8, 11);
    const f = new FallingBlocks();
    const low = detach(f, g, 7, 7);
    const high = detach(f, g, 7, 6, 80);
    const cells = [];
    for (let i = 0; i < 300 && f.active; i++) {
      for (const l of f.step(16, g).landed) cells.push(l.cell);
      if (f.blocks.includes(low) && f.blocks.includes(high))
        expect(high.y).toBeLessThanOrEqual(low.y - 16);
    }
    expect(cells).toEqual([
      { column: 7, row: 11 },
      { column: 7, row: 10 },
    ]);
    expect(g.get(7, 11)).toBe(Block.Rubble);
    expect(g.get(7, 10)).toBe(Block.Rubble);
    expect(g.get(7, 9)).toBe(Block.Air);
  });

  it('un bloque con sólido justo debajo queda como escombro en su sitio', () => {
    const g = chamber(5, 9, 8, 9);
    const f = new FallingBlocks();
    detach(f, g, 2, 4, 50); // rodeado de roca
    const landed = [];
    for (let i = 0; i < 20; i++) landed.push(...f.step(16, g).landed);
    expect(landed).toHaveLength(1);
    expect(landed[0]!.cell).toEqual({ column: 2, row: 4 });
    expect(landed[0]!.speed).toBeLessThan(FALL.damage.minSpeed);
    expect(g.get(2, 4)).toBe(Block.Rubble);
  });

  it('un cuadro muy lento no atraviesa el piso', () => {
    const g = chamber(5, 9, 6, 7);
    const f = new FallingBlocks();
    detach(f, g, 6, 5);
    const landed = [];
    for (let i = 0; i < 40; i++) landed.push(...f.step(5000, g).landed);
    expect(landed.map((l) => l.cell)).toEqual([{ column: 6, row: 7 }]);
  });
});

describe('Bloques desprendidos: golpes', () => {
  const player = { x: 7 * 16 + 3, y: 11 * 16 + 14 - 18, w: 10, h: 18 };

  it('el daño crece con la velocidad, tiene tope y el casco lo amortigua', () => {
    expect(impactDamage(0, false)).toBe(0);
    expect(impactDamage(FALL.damage.minSpeed - 1, false)).toBe(0);
    const slow = impactDamage(130, false),
      fast = impactDamage(270, false);
    expect(slow).toBeCloseTo(20 + 130 * 0.3);
    expect(fast).toBeGreaterThan(slow);
    expect(impactDamage(5000, false)).toBe(FALL.damage.max);
    expect(impactDamage(130, true)).toBeCloseTo(slow * PPE_EFFECT.helmetRock);
    expect(impactDamage(Number.NaN, false)).toBe(0);
  });

  it('un bloque que cae sobre el minero lo golpea una sola vez y se parte', () => {
    const g = chamber(5, 9, 6, 11);
    const f = new FallingBlocks();
    const total = solids(g);
    detach(f, g, 7, 5);
    const hits = [];
    for (let i = 0; i < 300 && f.active; i++)
      hits.push(...f.step(16, g, { player }).broken);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.by).toBe('player');
    // Cayó casi cinco bloques: golpe fuerte, pero no deja escombro dentro de él.
    expect(hits[0]!.speed).toBeGreaterThan(200);
    expect(impactDamage(hits[0]!.speed, true)).toBeGreaterThan(40);
    expect(g.get(7, 11)).toBe(Block.Air);
    expect(solids(g)).toBe(total - 1);
  });

  it('un bloque que cae en otra columna no lo toca', () => {
    const g = chamber(5, 9, 6, 11);
    const f = new FallingBlocks();
    detach(f, g, 5, 5);
    const steps = [];
    for (let i = 0; i < 300 && f.active; i++)
      steps.push(f.step(16, g, { player }));
    expect(steps.flatMap((s) => s.broken)).toHaveLength(0);
    expect(g.get(5, 11)).toBe(Block.Rubble);
  });

  it('un bloque que apenas empezó a moverse no daña', () => {
    const g = chamber(5, 9, 6, 7);
    const f = new FallingBlocks();
    detach(f, g, 7, 5);
    // El minero llena la cámara de dos bloques: el techo lo toca casi quieto.
    const tall = { x: 7 * 16 + 3, y: 6 * 16, w: 10, h: 32 };
    const first = f.step(16, g, { player: tall });
    expect(first.broken).toHaveLength(0);
  });

  it('el carro no queda enterrado: el bloque se parte sobre él', () => {
    const g = chamber(5, 9, 6, 11);
    const f = new FallingBlocks();
    detach(f, g, 6, 5);
    const cart = { x: 6 * 16 + 2, y: 11 * 16 + 4, w: 18, h: 12 };
    const broken = [];
    for (let i = 0; i < 300 && f.active; i++)
      broken.push(...f.step(16, g, { cart }).broken);
    expect(broken.map((b) => b.by)).toEqual(['cart']);
    expect(g.get(6, 11)).toBe(Block.Air);
  });
});

describe('Bloques desprendidos: guardado y límites', () => {
  it('sin bloques cayendo el guardado no lleva nada', () => {
    expect(new FallingBlocks().snapshot()).toBeUndefined();
  });

  it('guardar en plena caída y cargar deja el escombro donde habría caído', () => {
    const g = chamber(5, 9, 6, 11);
    const f = new FallingBlocks();
    const total = solids(g);
    detach(f, g, 7, 5);
    detach(f, g, 8, 5, 200);
    for (let i = 0; i < 8; i++) f.step(16, g);
    const saved = JSON.parse(JSON.stringify(f.snapshot()));
    expect(saved).toHaveLength(2);
    // Se carga sobre el mismo terreno (los bloques siguen en el aire).
    const loaded = new FallingBlocks();
    loaded.restore(saved, g);
    expect(loaded.blocks).toHaveLength(2);
    const cells = loaded.settle(g);
    expect(cells).toEqual(
      expect.arrayContaining([
        { column: 7, row: 11 },
        { column: 8, row: 11 },
      ]),
    );
    expect(loaded.active).toBe(false);
    expect(g.get(7, 11)).toBe(Block.Rubble);
    expect(g.get(8, 11)).toBe(Block.Rubble);
    expect(solids(g)).toBe(total);
  });

  it('ignora datos inválidos al cargar', () => {
    const g = chamber(5, 9, 6, 11);
    const f = new FallingBlocks();
    f.restore(
      [
        [7, 96, Block.Rock],
        [-1, 96, 1],
        [7, -5, 1],
        [99, 96, 1],
        'x',
        [7, 'a', 1],
        null,
      ],
      g,
    );
    expect(f.blocks).toHaveLength(1);
    f.restore('nada', g);
    expect(f.blocks).toHaveLength(0);
    f.restore(undefined, g);
    expect(f.blocks).toHaveLength(0);
  });

  it('asentar apila los bloques de una misma columna', () => {
    const g = chamber(5, 9, 6, 11);
    const f = new FallingBlocks();
    detach(f, g, 7, 5);
    detach(f, g, 7, 4);
    expect(f.settle(g)).toEqual([
      { column: 7, row: 11 },
      { column: 7, row: 10 },
    ]);
  });

  it('muchos bloques a la vez: cada uno se asienta y la lista queda vacía', () => {
    const g = new TerrainGrid(60, 30);
    for (let r = 0; r < g.rows; r++)
      for (let c = 0; c < g.columns; c++) g.set(c, r, Block.Rock);
    for (let r = 10; r <= 20; r++)
      for (let c = 2; c <= 49; c++) g.set(c, r, Block.Air);
    const f = new FallingBlocks();
    const total = solids(g);
    for (let c = 2; c <= 49; c++)
      for (const r of [9, 8]) detach(f, g, c, r, (c * 37) % 300);
    expect(f.blocks).toHaveLength(FALL.maxActive);
    expect(f.room).toBe(0);
    let landed = 0;
    const t0 = performance.now();
    let steps = 0;
    for (; steps < 600 && f.active; steps++)
      landed += f.step(16, g).landed.length;
    const perStep = (performance.now() - t0) / steps;
    expect(landed).toBe(96);
    expect(f.active).toBe(false);
    expect(solids(g)).toBe(total);
    // Cuenta holgada: 96 bloques simulados cuestan muy por debajo de 1 ms.
    expect(perStep).toBeLessThan(2);
    for (let c = 2; c <= 49; c++) {
      expect(g.get(c, 20)).toBe(Block.Rubble);
      expect(g.get(c, 19)).toBe(Block.Rubble);
    }
  });
});
