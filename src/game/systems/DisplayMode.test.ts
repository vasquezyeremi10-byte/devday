import { describe, expect, it } from 'vitest';
import { f11Action, looksLikeBrowserFullscreen } from './DisplayMode';

describe('F11 y pantalla completa', () => {
  it('pide la pantalla completa de la aplicación si se puede', () => {
    expect(f11Action({ supported: true, app: false, browser: false })).toBe('enter');
  });
  it('sale si la pidió la aplicación', () => {
    expect(f11Action({ supported: true, app: true, browser: false })).toBe('exit');
  });
  it('deja F11 al navegador si ya está en su pantalla completa o no hay API', () => {
    expect(f11Action({ supported: true, app: false, browser: true })).toBe('browser');
    expect(f11Action({ supported: false, app: false, browser: false })).toBe('browser');
  });
  it('reconoce la pantalla completa del navegador por el tamaño de la ventana', () => {
    const screen = { width: 1920, height: 1080 };
    expect(looksLikeBrowserFullscreen({ width: 1920, height: 1080 }, screen, false)).toBe(true);
    // Redondeo de la escala de Windows: 1 px de margen.
    expect(looksLikeBrowserFullscreen({ width: 1919, height: 1079 }, screen, false)).toBe(true);
    expect(looksLikeBrowserFullscreen({ width: 1920, height: 969 }, screen, false)).toBe(false);
    // Si la pidió la aplicación, no es la del navegador.
    expect(looksLikeBrowserFullscreen({ width: 1920, height: 1080 }, screen, true)).toBe(false);
  });
});
