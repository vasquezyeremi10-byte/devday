import { describe, expect, it } from 'vitest';
import { GROUND_SHADOW, shadowSpans, type SolidAt } from './GroundShadow';

/** Suelo de prueba: superficie en la fila `top(column)`. */
const ground =
  (top: (column: number) => number): SolidAt =>
  (column, row) =>
    row >= top(column);

describe('sombra de contacto sobre el suelo real', () => {
  it('en suelo plano es una franja sobre la cara superior, más gruesa al centro', () => {
    const spans = shadowSpans(40, 160, ground(() => 10));
    expect(spans).toHaveLength(GROUND_SHADOW.width);
    expect(spans.every((s) => s.y === 160)).toBe(true);
    expect(spans.filter((s) => s.h === 2).length).toBeGreaterThan(4);
    expect(spans[0]!.h).toBe(1);
    expect(spans.at(-1)!.h).toBe(1);
  });

  it('junto a un escalón cada columna baja a su propio suelo', () => {
    // Columna 2 (x 32..47) en la fila 10; columna 3 (x 48..) un bloque más abajo.
    const solid = ground((c) => (c <= 2 ? 10 : 11));
    const spans = shadowSpans(46, 160, solid);
    const high = spans.filter((s) => s.x < 48);
    const low = spans.filter((s) => s.x >= 48);
    expect(high.every((s) => s.y === 160)).toBe(true);
    expect(low.length).toBeGreaterThan(0);
    expect(low.every((s) => s.y === 176)).toBe(true);
    // La esquina redondeada del bloque alto no recibe sombra.
    expect(spans.some((s) => s.x === 46 || s.x === 47)).toBe(false);
  });

  it('sobre un pozo profundo la sombra se corta (nunca flota)', () => {
    const solid = ground((c) => (c === 3 ? 30 : 10));
    const spans = shadowSpans(56, 160, solid);
    expect(spans.some((s) => s.x >= 48 && s.x < 64)).toBe(false);
  });

  it('en el aire se achica y desaparece pasada la altura máxima', () => {
    const solid = ground(() => 10);
    const near = shadowSpans(40, 160, solid).length;
    const jump = shadowSpans(40, 160 - 24, solid).length;
    expect(jump).toBeLessThan(near);
    expect(jump).toBeGreaterThan(0);
    expect(shadowSpans(40, 160 - GROUND_SHADOW.maxDrop - 8, solid)).toEqual([]);
  });

  it('una pared no cuenta como suelo', () => {
    // Bajo los pies hay roca con otra roca encima (interior de una pared).
    const solid: SolidAt = (_c, r) => r >= 8;
    expect(shadowSpans(40, 150, solid)).toEqual([]);
  });
});
