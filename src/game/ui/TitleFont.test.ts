import { describe, expect, it } from 'vitest';
import {
  EXTRUDE,
  GLYPH_H,
  GLYPH_W,
  LETTER_FRAME_H,
  LETTER_FRAME_W,
  glyphShape,
  hasGlyph,
  rasterLetter,
  titleWidth,
} from './TitleFont';

const draw = (char: string): string[] =>
  Array.from({ length: GLYPH_H }, (_, y) =>
    Array.from({ length: GLYPH_W }, (_, x) => (glyphShape(char)(x, y) ? '#' : '.')).join(''),
  );

describe('tipografía del título (rejilla de 1 px)', () => {
  it('cada letra de DEEPKIN tiene su glifo', () => {
    for (const c of 'DEEPKIN') expect(hasGlyph(c)).toBe(true);
    expect(hasGlyph('Z')).toBe(false);
  });

  it('las letras llenan su caja de 18 × 22 con esquinas talladas', () => {
    for (const c of 'DEPKIN') {
      const rows = draw(c);
      expect(rows).toHaveLength(GLYPH_H);
      // Ningún píxel en la esquina superior izquierda tallada.
      expect(rows[0]![0]).toBe('.');
      // Y la letra ocupa todo el alto.
      expect(rows[0]!.includes('#') && rows[GLYPH_H - 1]!.includes('#')).toBe(true);
    }
  });

  it('el tronco de las letras tiene 5 px de ancho y es continuo', () => {
    for (const c of 'DEPKN') {
      const rows = draw(c);
      // En la fila central el tronco izquierdo ocupa las 5 primeras columnas.
      expect(rows[GLYPH_H / 2 + 3]!.slice(0, 5)).toBe('#####');
    }
  });

  it('la E tiene tres barras y la I dos con tronco central', () => {
    const e = draw('E');
    const barRows = e.filter((r) => r.slice(10, 14) === '####').length;
    expect(barRows).toBeGreaterThan(8);
    const i = draw('I');
    expect(i[0]!.includes('#')).toBe(true);
    expect(i[GLYPH_H / 2]!.indexOf('#')).toBe((GLYPH_W - 6) / 2);
  });

  it('la letra rasterizada es opaca: contorno de tinta, cara con luz y relieve', () => {
    const r = rasterLetter('D');
    expect([r.width, r.height]).toEqual([LETTER_FRAME_W, LETTER_FRAME_H]);
    const colors = new Set(r.pixels.flat().filter(Boolean));
    expect(colors).toEqual(new Set(['ink', 'cream', 'gold', 'amber', 'ochre', 'rust', 'ember']));
    // La primera fila con cara tiene luz; el borde exterior es tinta.
    expect(r.pixels[1]!.includes('cream')).toBe(true);
    expect(r.pixels[0]!.includes('ink')).toBe(true);
    // El relieve termina EXTRUDE px bajo la cara.
    const lastFaceRow = GLYPH_H;
    expect(r.pixels[lastFaceRow + EXTRUDE]!.includes('ember')).toBe(true);
    expect(r.face.length).toBeGreaterThan(100);
  });

  it('todos los píxeles de la cara quedan dentro del cuadro', () => {
    for (const c of 'DEPKIN') {
      const r = rasterLetter(c);
      for (const [x, y] of r.face) {
        expect(x).toBeGreaterThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(1);
        expect(x).toBeLessThan(LETTER_FRAME_W - 1);
        expect(y).toBeLessThan(LETTER_FRAME_H - 1 - EXTRUDE);
      }
    }
  });

  it('el título de 7 letras mide 138 px, dentro de la columna de botones (144)', () => {
    expect(titleWidth(7)).toBe(138);
    expect(titleWidth(7)).toBeLessThanOrEqual(144);
  });
});
