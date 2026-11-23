import { describe, expect, it } from 'vitest';
import { ExposureMap, type SurfaceShape } from './ExposureMap';

/** Mundo 64 × 32: roca a la derecha de x = 32. */
const solid = (x: number) => x >= 32;
const rect = (x: number, y: number, w: number, h: number): SurfaceShape => ({
  x,
  y,
  w,
  h,
  opaque: () => true,
});

describe('ExposureMap', () => {
  it('un letrero mitad al aire y mitad sobre roca toma la luz del aire', () => {
    const map = new ExposureMap(64, 32);
    map.rebuild([rect(20, 8, 24, 8)], (x) => solid(x));
    // Sol a la izquierda (aire = 1), roca oscura (0).
    map.update((x) => (solid(x) ? 0 : 1));
    expect(map.at(40, 10)).toBe(1); // parte sobre la roca: iluminada
    expect(map.at(24, 10)).toBe(-1); // parte sobre aire: usa su celda
    expect(map.at(50, 10)).toBe(-1); // roca sin estructura delante
  });
  it('dentro de una galería oscura la estructura queda oscura', () => {
    const map = new ExposureMap(64, 32);
    map.rebuild([rect(28, 8, 8, 8)], (x) => solid(x));
    map.update(() => 0.02);
    expect(map.at(33, 10)).toBeCloseTo(0.02);
  });
  it('la luz cambia cada cuadro (noche futura, faroles, casco)', () => {
    const map = new ExposureMap(64, 32);
    map.rebuild([rect(24, 8, 16, 8)], (x) => solid(x));
    map.update(() => 0.3);
    expect(map.at(36, 10)).toBeCloseTo(0.3);
    map.update(() => 0.9);
    expect(map.at(36, 10)).toBeCloseTo(0.9);
  });
  it('respeta la silueta: los píxeles transparentes no tapan la roca', () => {
    const map = new ExposureMap(64, 32);
    map.rebuild([{ ...rect(24, 8, 16, 8), opaque: (i) => i < 12 }], (x) =>
      solid(x),
    );
    map.update(() => 1);
    expect(map.at(34, 10)).toBe(1);
    expect(map.at(38, 10)).toBe(-1);
  });
  it('al excavar se reconstruye: lo que era roca pasa a usar su celda', () => {
    const map = new ExposureMap(64, 32);
    const shapes = [rect(20, 8, 24, 8)];
    map.rebuild(shapes, (x) => solid(x));
    expect(map.at(40, 10)).not.toBe(-1);
    map.rebuild(shapes, () => false);
    expect(map.at(40, 10)).toBe(-1);
  });
});
