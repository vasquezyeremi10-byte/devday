import { describe, expect, it } from 'vitest';
import { GNOME_STRIKE_BOX } from '../config/gnomeFrames';
import {
  canSee,
  lineOfSight,
  probeAhead,
  rectsOverlap,
  strikeConnects,
  strikeRect,
  type SolidAt,
} from './GnomeSenses';

/** Mapa de celdas sólidas a partir de texto ('#' roca, '.' aire). */
function map(rows: string[]): SolidAt {
  return (column, row) => rows[row]?.[column] === '#' || row >= rows.length;
}

// Suelo en la fila 6 (y = 96..112). Un cuerpo de 12 × 18 apoyado: y = 78.
const body = (x: number) => ({ x, y: 78, width: 12, height: 18 });

describe('GnomeSenses: línea de visión', () => {
  const world = map([
    '..........',
    '..........',
    '..........',
    '.....#....',
    '..........',
    '..........',
    '##########',
  ]);
  it('ve a través del aire y no a través de la roca', () => {
    expect(lineOfSight(world, 8, 40, 150, 40)).toBe(true);
    expect(lineOfSight(world, 8, 56, 150, 56)).toBe(false);
  });
  it('un objetivo metido en la roca no es visible', () => {
    expect(lineOfSight(world, 8, 56, 88, 56)).toBe(false);
  });
  it('vista larga hacia delante, corta hacia atrás, bloqueada por roca', () => {
    const target = { x: 120, y: 80, width: 10, height: 18 };
    const open = map([
      '.'.repeat(30),
      '.'.repeat(30),
      '.'.repeat(30),
      '.'.repeat(30),
      '.'.repeat(30),
      '.'.repeat(30),
      '#'.repeat(30),
    ]);
    expect(canSee(open, { x: 20, y: 82 }, 1, target)).toBe(true);
    expect(canSee(open, { x: 20, y: 82 }, -1, target)).toBe(false);
    const behind = { x: 0, y: 80, width: 10, height: 18 };
    expect(canSee(open, { x: 30, y: 82 }, 1, behind)).toBe(true);
    const walled = map([
      '....#.....',
      '....#.....',
      '....#.....',
      '....#.....',
      '....#.....',
      '....#.....',
      '##########',
    ]);
    expect(canSee(walled, { x: 20, y: 82 }, 1, { ...target, x: 100 })).toBe(
      false,
    );
  });
});

describe('GnomeSenses: lo que hay delante', () => {
  it('detecta un escalón de un bloque que se puede saltar', () => {
    const world = map([
      '........',
      '........',
      '........',
      '........',
      '........',
      '...#....',
      '########',
    ]);
    const p = probeAhead(world, body(34), 1);
    expect(p).toEqual({ wall: true, step: true, drop: 0 });
  });
  it('una pared de dos bloques no es escalón', () => {
    const world = map([
      '........',
      '........',
      '........',
      '........',
      '...#....',
      '...#....',
      '########',
    ]);
    expect(probeAhead(world, body(34), 1)).toMatchObject({
      wall: true,
      step: false,
    });
  });
  it('mide la caída delante de los pies', () => {
    const world = map([
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '##..####',
      '##..####',
      '########',
    ]);
    expect(probeAhead(world, body(18), 1)).toEqual({
      wall: false,
      step: false,
      drop: 2,
    });
    expect(probeAhead(world, body(70), -1)).toEqual({
      wall: false,
      step: false,
      drop: 0,
    });
  });
});

describe('GnomeSenses: golpe de la picota', () => {
  it('la caja de golpe queda delante del gnomo en ambos sentidos', () => {
    const right = strikeRect(GNOME_STRIKE_BOX.attack, 100, 50, 1);
    const left = strikeRect(GNOME_STRIKE_BOX.attack, 100, 50, -1);
    expect(right.x).toBeGreaterThan(100);
    expect(left.x + left.width).toBeLessThan(100);
    // Simétricas respecto del centro del sprite.
    expect(right.x - 100).toBe(100 - (left.x + left.width));
    expect(right.y).toBe(left.y);
  });
  it('no golpea a través de la roca ni fuera de su alcance', () => {
    const open = map([
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '##########',
    ]);
    const strike = { x: 50, y: 80, width: 6, height: 10 };
    const player = { x: 52, y: 78, width: 10, height: 18 };
    expect(strikeConnects(open, { x: 40, y: 85 }, strike, player)).toBe(true);
    expect(
      strikeConnects(open, { x: 40, y: 85 }, strike, { ...player, x: 80 }),
    ).toBe(false);
    const wall = map([
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '...#......',
      '##########',
    ]);
    expect(
      strikeConnects(
        wall,
        { x: 40, y: 85 },
        { ...strike, x: 60 },
        { ...player, x: 62 },
      ),
    ).toBe(false);
    expect(rectsOverlap(strike, player)).toBe(true);
  });
});
