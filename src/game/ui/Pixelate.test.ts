import { describe, expect, it } from 'vitest';
import {
  areaResample,
  buildPalette,
  countColors,
  quantize,
  removeSpeckles,
  type RgbaImage,
} from '../../../scripts/art/pixelate.mjs';
import { readPng } from '../../../scripts/art/png.mjs';

const image = (w: number, h: number, pixel: (x: number, y: number) => number[]): RgbaImage => {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) data.set(pixel(x, y), (y * w + x) * 4);
  return { width: w, height: h, data };
};
const at = (img: RgbaImage, x: number, y: number) =>
  Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

describe('herramientas de pixelado (scripts/art/pixelate.mjs)', () => {
  it('areaResample promedia exactamente la región cubierta', () => {
    const src = image(4, 2, (x) => (x < 2 ? [0, 0, 0, 255] : [200, 100, 50, 255]));
    const out = areaResample(src, 2, 1);
    expect(at(out, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(at(out, 1, 0)).toEqual([200, 100, 50, 255]);
    const mix = areaResample(image(2, 1, (x) => (x ? [100, 0, 0, 255] : [0, 0, 0, 255])), 1, 1);
    expect(at(mix, 0, 0)).toEqual([50, 0, 0, 255]);
  });

  it('areaResample con factor fraccionario conserva un color uniforme', () => {
    const out = areaResample(image(10, 10, () => [30, 60, 90, 255]), 3, 3);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) expect(at(out, x, y)).toEqual([30, 60, 90, 255]);
  });

  it('areaResample no tiñe con el color de los píxeles transparentes', () => {
    const src = image(2, 1, (x) => (x ? [0, 0, 0, 0] : [200, 0, 0, 255]));
    const out = areaResample(src, 1, 1);
    expect(at(out, 0, 0).slice(0, 3)).toEqual([200, 0, 0]);
    expect(at(out, 0, 0)[3]).toBe(128);
  });

  it('buildPalette devuelve los colores que hay cuando hay pocos', () => {
    const colors = [[200, 30, 30], [30, 200, 30], [30, 30, 200]];
    const img = image(6, 1, (x) => [...colors[x % 3]!, 255]);
    const palette = buildPalette(img, 3);
    expect(palette).toHaveLength(3);
    for (const c of colors) expect(palette.some((p) => p.every((v, i) => Math.abs(v - c[i]!) < 2))).toBe(true);
  });

  it('quantize deja solo colores de la paleta y alfa binario', () => {
    const img = image(8, 8, (x, y) => [x * 30, y * 30, (x + y) * 15, (x + y) % 5 === 0 ? 40 : 255]);
    const palette = buildPalette(img, 6);
    const out = quantize(img, palette);
    const allowed = new Set(palette.map((p) => p.join()));
    for (let i = 0; i < out.data.length; i += 4) {
      expect([0, 255]).toContain(out.data[i + 3]);
      if (out.data[i + 3]) expect(allowed.has([out.data[i], out.data[i + 1], out.data[i + 2]].join())).toBe(true);
    }
    expect(countColors(out)).toBeLessThanOrEqual(6);
  });

  it('removeSpeckles borra un píxel suelto parecido a su entorno y conserva un destello', () => {
    const flat = image(5, 5, () => [100, 100, 100, 255]);
    flat.data.set([104, 100, 100, 255], (2 * 5 + 2) * 4);
    expect(at(removeSpeckles(flat, 2200), 2, 2)).toEqual([100, 100, 100, 255]);
    const star = image(5, 5, () => [20, 20, 60, 255]);
    star.data.set([255, 255, 255, 255], (2 * 5 + 2) * 4);
    expect(at(removeSpeckles(star, 2200), 2, 2)).toEqual([255, 255, 255, 255]);
  });
});

describe('recursos de pixel art ya generados', () => {
  /** Ruta de un recurso de public/assets/ui (sin tipos de Node: vía import.meta.url). */
  const asset = (name: string) =>
    decodeURIComponent(
      new URL(`../../../public/assets/ui/${name}`, import.meta.url).pathname,
    ).replace(/^\/([A-Za-z]:)/, '$1');

  it('el fondo del menú mide 480 × 270 y tiene una paleta limitada, sin tono continuo', () => {
    const bg = readPng(asset('menu-bg.png'));
    expect([bg.width, bg.height]).toEqual([480, 270]);
    // Antes: ~100 000 colores (pintura reducida con suavizado).
    expect(countColors(bg)).toBeLessThanOrEqual(160);
    // Opaco por completo (una sola aserción: una por píxel tardaba segundos).
    let transparent = 0;
    for (let i = 3; i < bg.data.length; i += 4) if (bg.data[i] !== 255) transparent++;
    expect(transparent).toBe(0);
  });

  it('el logo del estudio son 7 cuadros de 212 px con paleta limitada y alfa binario', () => {
    const logo = readPng(asset('studio-logo.png'));
    expect([logo.width, logo.height]).toEqual([212 * 7, 212]);
    expect(countColors(logo)).toBeLessThanOrEqual(80);
    let partial = 0;
    for (let i = 3; i < logo.data.length; i += 4)
      if (logo.data[i] !== 0 && logo.data[i] !== 255) partial++;
    expect(partial).toBe(0);
    // Todos los cuadros comparten paleta: no cambian de color al crecer el zoom.
    const frames = Array.from({ length: 7 }, (_, f) => {
      const set = new Set<number>();
      for (let y = 0; y < 212; y++)
        for (let x = 0; x < 212; x++) {
          const o = (y * logo.width + f * 212 + x) * 4;
          if (logo.data[o + 3]) set.add((logo.data[o]! << 16) | (logo.data[o + 1]! << 8) | logo.data[o + 2]!);
        }
      return set;
    });
    const all = new Set(frames.flatMap((s) => [...s]));
    expect(all.size).toBeLessThanOrEqual(80);
  });
});
