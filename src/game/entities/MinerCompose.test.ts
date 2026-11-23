import { describe, expect, it } from 'vitest';
import { REQUIRED_PPE } from '../config/gear';
import { composeLook, HERO_SHEET, PPE_LAYERS } from './MinerCompose';

/** Píxeles RGBA de colores enteros (null = transparente). */
const px = (...colors: (number | null)[]) => {
  const out = new Uint8ClampedArray(colors.length * 4);
  colors.forEach((c, i) => {
    if (c === null) return;
    out.set([(c >> 16) & 255, (c >> 8) & 255, c & 255, 255], i * 4);
  });
  return out;
};

describe('composeLook (EPP visible del minero)', () => {
  it('estampa las capas opacas en orden y deja el resto de la base', () => {
    const base = px(1, 2, null, 4);
    const out = composeLook(base, base, [px(null, 9, 9, null), px(null, null, 7, null)]);
    expect([...out]).toEqual([...px(1, 9, 7, 4)]);
  });

  it('la herramienta (base distinta de la hoja sin herramienta) queda delante', () => {
    const bare = px(1, 2, 3, null);
    const base = px(1, 5, 3, 6); // herramienta en los píxeles 1 y 3
    const vest = px(8, 8, 8, null);
    const out = composeLook(base, bare, [vest]);
    expect([...out]).toEqual([...px(8, 5, 8, 6)]);
  });

  it('sin capas devuelve la base intacta y nunca deja alfa parcial', () => {
    const base = px(1, null, 3);
    const out = composeLook(base, px(1, null, 3), []);
    expect([...out]).toEqual([...base]);
    for (let i = 3; i < out.length; i += 4) expect([0, 255]).toContain(out[i]);
  });

  it('rechaza hojas de distinto tamaño', () => {
    expect(() => composeLook(px(1), px(1, 2), [])).toThrow();
  });

  it('hay una capa por cada pieza visible del EPP obligatorio', () => {
    for (const kind of REQUIRED_PPE)
      if (kind !== 'ear') expect(PPE_LAYERS as readonly string[]).toContain(kind);
    expect(HERO_SHEET).toEqual({ width: 288, height: 192 });
  });
});
