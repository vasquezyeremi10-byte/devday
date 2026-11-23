import { describe, expect, it } from 'vitest';
import { createInitialTerrain } from '../world/Geology';
import { Block, surfaceRow } from '../world/TerrainGrid';
import { GameSession } from './GameSession';
import { onMineWall } from './PlacedLights';

const fresh = () => new GameSession(createInitialTerrain());

/** Cámara de 5 × 3 bloques en la zona reservada (sin yacimientos). */
function chamber(s: GameSession) {
  for (let c = 20; c <= 24; c++)
    for (const r of [12, 13, 14]) s.grid.set(c, r, Block.Air);
}

describe('Antorchas en la muralla de la mina', () => {
  it('se fijan en el centro de una cámara: detrás está la muralla', () => {
    const s = fresh();
    chamber(s);
    // Sin bloque vecino en las cuatro direcciones.
    expect(s.grid.isSolid(21, 13) || s.grid.isSolid(23, 13)).toBe(false);
    expect(s.grid.isSolid(22, 12) || s.grid.isSolid(22, 14)).toBe(false);
    expect(onMineWall({ column: 22, row: 13 })).toBe(true);
    expect(s.lights.check(s.grid, { column: 22, row: 13 })).toBeNull();
    expect(s.lights.install(s.grid, { column: 22, row: 13 }, 'torch')).toBe(
      true,
    );
  });
  it('al aire libre, sobre la superficie, siguen pidiendo un apoyo', () => {
    const s = fresh();
    const column = 60,
      row = surfaceRow(column) - 3;
    expect(onMineWall({ column, row })).toBe(false);
    expect(s.lights.check(s.grid, { column, row })).toMatch(/MURALLA/);
    // Junto al piso sí.
    expect(
      s.lights.check(s.grid, { column, row: surfaceRow(column) - 1 }),
    ).toBeNull();
  });
  it('no se instalan dentro de un bloque ni dos en la misma celda', () => {
    const s = fresh();
    chamber(s);
    expect(s.lights.check(s.grid, { column: 22, row: 16 })).toBe(
      'EXCAVA ANTES DE INSTALAR',
    );
    s.lights.install(s.grid, { column: 22, row: 13 }, 'torch');
    expect(s.lights.check(s.grid, { column: 22, row: 13 })).toBe(
      'YA HAY UNA LUZ AQUI',
    );
  });
});

describe('Rieles con clic derecho', () => {
  it('apuntar al aire o al piso junto al extremo de la vía coloca el tramo', () => {
    const s = fresh();
    const end = Math.max(...s.rails.segments.map((r) => r.column));
    const row = s.rails.at(end)!.row;
    // Abrir la columna siguiente a la altura de la vía (piso sólido debajo).
    s.grid.set(end + 1, row, Block.Air);
    s.grid.set(end + 1, row - 1, Block.Air);
    s.grid.set(end + 1, row + 1, Block.Dirt);
    // Apuntando al bloque de piso: el riel va en la celda de aire de encima.
    expect(s.rails.placementFor({ column: end + 1, row: row + 1 })).toEqual({
      column: end + 1,
      row,
    });
    s.railStock = 1;
    expect(s.build({ column: end + 1, row })).toBe(true);
    expect(s.rails.at(end + 1)?.row).toBe(row);
    expect(s.railStock).toBe(0);
  });
  it('explica por qué no se puede: columna ocupada o lejos de la vía', () => {
    const s = fresh();
    const first = s.rails.segments[0]!;
    expect(s.rails.placementFor(first)).toBe('YA HAY VIA EN ESA COLUMNA');
    expect(s.rails.placementFor({ column: 70, row: 9 })).toMatch(
      /CONTINUAR DESDE UN EXTREMO/,
    );
  });
});
