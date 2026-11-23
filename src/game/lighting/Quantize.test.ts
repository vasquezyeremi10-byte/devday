import { describe, expect, it } from 'vitest';
import { LIGHTING } from '../config/lighting';
import { pixelLevel, quantize, quantLevel } from './Quantize';

describe('iluminación cuantizada', () => {
  it('reduce la luz a 4 niveles limpios con umbrales crecientes', () => {
    const [t1, t2, t3] = LIGHTING.quantize.thresholds;
    expect(t1).toBeLessThan(t2);
    expect(t2).toBeLessThan(t3);
    expect(quantize(0).level).toBe(0);
    expect(quantize(t1).level).toBe(1);
    expect(quantize(t2).level).toBe(2);
    expect(quantize(t3).level).toBe(3);
    expect(quantize(1).level).toBe(3);
    const levels = new Set<number>();
    for (let v = 0; v <= 1; v += 0.01) levels.add(quantize(v).level);
    expect([...levels].sort()).toEqual([0, 1, 2, 3]);
  });

  it('sin trama, todos los píxeles de una celda comparten nivel', () => {
    const off = { enabled: false, intensity: 1 };
    const seen = new Set<number>();
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) seen.add(pixelLevel(0.69, 0, x, y, off));
    expect([...seen]).toEqual([2]);
  });

  it('la trama Bayer 4×4 es opcional y solo toca el borde superior de la banda', () => {
    const on = { enabled: true, intensity: 0.5 };
    const count = (light: number) => {
      let up = 0;
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) if (pixelLevel(light, 0, x, y, on) === 3) up++;
      return up;
    };
    // Lejos del borde de la banda: limpia. Junto al umbral: patrón ordenado.
    expect(count(0.45)).toBe(0);
    expect(count(0.699)).toBeGreaterThan(0);
    expect(count(0.699)).toBeLessThanOrEqual(8);
    // Con intensidad 0 no hay trama.
    expect(pixelLevel(0.699, 0, 0, 0, { enabled: true, intensity: 0 })).toBe(2);
  });

  it('el nivel sin objeto coincide con quantize en todo el rango', () => {
    for (const v of [-1, 0, Number.NaN, Infinity, 0.1, 0.38, 0.7, 1, 2])
      expect(quantLevel(v)).toBe(quantize(v).level);
    for (let v = -0.05; v <= 1.05; v += 0.001) {
      expect(quantLevel(v)).toBe(quantize(v).level);
      for (const floor of [0, 1])
        expect(pixelLevel(v, floor, 3, 2, { enabled: false, intensity: 0.35 })).toBe(
          Math.max(floor, quantize(v).level),
        );
    }
  });

  it('lo descubierto conserva el ambiente azul (nivel mínimo)', () => {
    expect(pixelLevel(0, LIGHTING.knownLevel, 0, 0)).toBe(1);
    expect(pixelLevel(0, 0, 0, 0)).toBe(0);
  });
});
