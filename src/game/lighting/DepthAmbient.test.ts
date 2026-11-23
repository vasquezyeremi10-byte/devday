import { describe, expect, it } from 'vitest';
import { LIGHTING } from '../config/lighting';
import { depthAmbientColor, depthBand } from './DepthAmbient';

const luma = (c: number) =>
  0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255);

describe('Oscuridad progresiva por profundidad', () => {
  it('arriba conserva el ambiente azul original', () => {
    expect(depthBand(0)).toBe(0);
    expect(depthBand(LIGHTING.depthAmbient.fromRow - 1)).toBe(0);
    expect(depthAmbientColor(10)).toBe(LIGHTING.ramp.neutral[1]);
  });

  it('cada franja es más oscura que la anterior y la última es casi negra', () => {
    const rows = [14, 18, 22, 26, 30].map(depthAmbientColor);
    for (let i = 1; i < rows.length; i++)
      expect(luma(rows[i]!)).toBeLessThan(luma(rows[i - 1]!));
    expect(luma(rows.at(-1)!)).toBeLessThan(20);
  });

  it('sube de a una franja cada `step` filas y se detiene en la última', () => {
    const { fromRow, step, colors } = LIGHTING.depthAmbient;
    expect(depthBand(fromRow)).toBe(0);
    expect(depthBand(fromRow + step)).toBe(1);
    expect(depthBand(fromRow + 2 * step)).toBe(2);
    expect(depthBand(1000)).toBe(colors.length - 1);
  });
});
