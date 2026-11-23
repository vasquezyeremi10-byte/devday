import { describe, expect, it } from 'vitest';
import { VIEW } from '../config/constants';
import { integerZoom, overflowsSlightly } from './IntegerZoom';

/** Píxeles físicos por píxel del juego para un zoom CSS y un DPR. */
const devicePixels = (zoom: number, dpr: number) => zoom * dpr;

describe('Escalado entero en píxeles físicos', () => {
  it('con DPR 1 conserva los zoom enteros de siempre', () => {
    expect(integerZoom(1920, 1080, 3, 1)).toBe(3);
    expect(integerZoom(1000, 600, 3, 1)).toBe(2);
    expect(integerZoom(600, 400, 3, 1)).toBe(1);
    // Estrecha: 1× con desplazamiento, nunca reducción fraccionaria.
    expect(integerZoom(320, 400, 3, 1)).toBe(1);
    expect(integerZoom(4000, 3000, 5, 1)).toBe(5);
  });

  it('con escala de Windows el píxel del juego mide un entero de píxeles reales', () => {
    for (const dpr of [1.25, 1.5, 1.75, 2, 2.25, 3])
      for (const [w, h] of [
        [1536, 730],
        [1280, 600],
        [960, 540],
        [700, 500],
        [2560, 1300],
      ] as const) {
        const zoom = integerZoom(w, h, 3, dpr);
        const px = devicePixels(zoom, dpr);
        expect(Math.abs(px - Math.round(px))).toBeLessThan(1e-9);
        expect(px).toBeGreaterThanOrEqual(1);
        // Cabe en el espacio disponible, salvo el mínimo de pantallas estrechas.
        if (px > Math.max(1, Math.round(dpr))) {
          expect(VIEW.width * zoom).toBeLessThanOrEqual(w + 1e-6);
          expect(VIEW.height * zoom).toBeLessThanOrEqual(h + 1e-6);
        }
      }
  });

  it('125 % en 1536 × 730 CSS usa 3 píxeles físicos (antes 2,5)', () => {
    const zoom = integerZoom(1536, 730, 3, 1.25);
    expect(devicePixels(zoom, 1.25)).toBe(3);
    expect(VIEW.width * zoom).toBe(1152);
  });

  it('con holgura de un píxel no pierde un escalón por una diferencia mínima', () => {
    // 1920 × 1080 al 175 %: 617 px CSS = 1079,75 px físicos (faltan 0,25 para 4×).
    expect(devicePixels(integerZoom(1097, 617, 12, 1.75), 1.75)).toBe(3);
    expect(devicePixels(integerZoom(1097, 617, 12, 1.75, 1), 1.75)).toBe(4);
    // Un píxel menos de ancho o de alto en DPR 1 tampoco baja de 4× a 3×.
    expect(integerZoom(1919, 1080, 12, 1, 1)).toBe(4);
    expect(integerZoom(1920, 1079, 12, 1, 1)).toBe(4);
    expect(integerZoom(1919, 1080, 12, 1)).toBe(3);
  });

  it('la holgura no acepta más de un píxel del juego de diferencia', () => {
    // 4× en alto necesita 1080: con 1070 (10 px de menos) se queda en 3×.
    expect(integerZoom(1920, 1070, 12, 1, 1)).toBe(3);
    // A 4× un píxel del juego mide 4: faltan 4 px o menos.
    expect(integerZoom(1920, 1076, 12, 1, 1)).toBe(4);
    expect(integerZoom(1920, 1075, 12, 1, 1)).toBe(3);
  });

  it('la holgura respeta el tope de escala', () => {
    expect(integerZoom(1919, 1080, 3, 1, 1)).toBe(3);
  });

  it('overflowsSlightly distingue el recorte mínimo de la ventana chica', () => {
    expect(overflowsSlightly(4, 1919, 1080, 1)).toBe(true);
    expect(overflowsSlightly(4, 1920, 1080, 1)).toBe(false);
    // Ventana menor que el juego a 1×: se desplaza, no se recorta.
    expect(overflowsSlightly(1, 320, 400, 1)).toBe(false);
  });

  it('un DPR inválido se trata como 1', () => {
    expect(integerZoom(1000, 600, 3, Number.NaN)).toBe(2);
    expect(integerZoom(1000, 600, 3, 0)).toBe(2);
  });
});
