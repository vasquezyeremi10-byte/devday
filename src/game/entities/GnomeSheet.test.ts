import { describe, expect, it } from 'vitest';
import { readPng } from '../../../scripts/art/png.mjs';
import {
  GNOME_ANIMATIONS,
  GNOME_BODY,
  GNOME_IMPACT_FRAME,
  GNOME_SHEET,
  type GnomeAnimation,
} from '../config/gnomeAnimations';
import { GNOME_STRIKE_BOX } from '../config/gnomeFrames';

const sheet = readPng('public/assets/characters/gnome/gnome.png');
/** Maestro del tamaño en uso: el original limpio (32) o su versión pequeña (24). */
const master = readPng(
  GNOME_SHEET.size === 24 ? 'art/gnome/small.png' : 'art/gnome/master.png',
);
const N = GNOME_SHEET.size;
const FW = GNOME_SHEET.frameWidth;
const FH = GNOME_SHEET.frameHeight;

const alpha = (row: number, col: number, x: number, y: number) =>
  sheet.data[((row * FH + y) * sheet.width + col * FW + x) * 4 + 3]!;
const rgba = (row: number, col: number, x: number, y: number) => {
  const i = ((row * FH + y) * sheet.width + col * FW + x) * 4;
  return Array.from(sheet.data.slice(i, i + 4));
};
/** Fila más baja con píxeles opacos (−1 si el cuadro está vacío). */
function lowest(row: number, col: number): number {
  for (let y = FH - 1; y >= 0; y--)
    for (let x = 0; x < FW; x++) if (alpha(row, col, x, y)) return y;
  return -1;
}

describe('Hoja del gnomo minero', () => {
  const entries = Object.entries(GNOME_ANIMATIONS) as [
    GnomeAnimation,
    (typeof GNOME_ANIMATIONS)[GnomeAnimation],
  ][];

  it('tiene una fila por animación y cuadros de 64 × 48', () => {
    expect(sheet.width).toBe(FW * GNOME_SHEET.columns);
    expect(sheet.height).toBe(FH * entries.length);
  });

  it('usa alfa binario y una paleta reducida', () => {
    const colors = new Set<number>();
    let partial = 0;
    for (let i = 0; i < sheet.data.length; i += 4) {
      const a = sheet.data[i + 3]!;
      if (a !== 0 && a !== 255) partial++;
      if (a)
        colors.add(
          (sheet.data[i]! << 16) |
            (sheet.data[i + 1]! << 8) |
            sheet.data[i + 2]!,
        );
    }
    expect(partial).toBe(0);
    expect(colors.size).toBeLessThanOrEqual(24);
  });

  it('todos los cuadros tienen dibujo y las celdas sobrantes están vacías', () => {
    for (const [, clip] of entries)
      for (let f = 0; f < GNOME_SHEET.columns; f++)
        expect(lowest(clip.row, f) >= 0).toBe(f < clip.count);
  });

  it('los pies quedan siempre en la misma línea (sin saltos de posición)', () => {
    for (const [name, clip] of entries)
      for (let f = 0; f < clip.count; f++) {
        const hop = name === 'alert' && (f === 1 || f === 2);
        const dissolving = name === 'death' && f >= 6;
        if (hop || dissolving) continue;
        expect(lowest(clip.row, f), `${name} ${f}`).toBe(GNOME_SHEET.baseline);
      }
    // El cuerpo físico se apoya en esa misma línea.
    expect(GNOME_BODY.offsetY + GNOME_BODY.height).toBe(
      GNOME_SHEET.baseline + 1,
    );
    expect(GNOME_BODY.offsetX + GNOME_BODY.width / 2).toBe(FW / 2);
  });

  it('el reposo es el PNG original, píxel por píxel y sin reescalar', () => {
    const { row } = GNOME_ANIMATIONS.idle;
    expect(master.width).toBe(N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = (y * N + x) * 4;
        const expected = master.data[i + 3]
          ? Array.from(master.data.slice(i, i + 4))
          : [0, 0, 0, 0];
        const got = rgba(
          row,
          0,
          x + GNOME_SHEET.originX,
          y + GNOME_SHEET.originY,
        );
        expect(got[3] ? got : [0, 0, 0, 0], `${x},${y}`).toEqual(expected);
      }
  });

  it('la caja de golpe es la picota en el cuadro de impacto, delante del cuerpo', () => {
    for (const name of ['attack', 'mine'] as const) {
      const box = GNOME_STRIKE_BOX[name];
      expect(box.x).toBeGreaterThanOrEqual(
        GNOME_BODY.offsetX + GNOME_BODY.width,
      );
      expect(box.x + box.width).toBeLessThanOrEqual(FW);
      const { row } = GNOME_ANIMATIONS[name];
      let inside = 0;
      for (let y = box.y; y < box.y + box.height; y++)
        for (let x = box.x; x < box.x + box.width; x++)
          if (alpha(row, GNOME_IMPACT_FRAME[name], x, y)) inside++;
      expect(inside).toBeGreaterThan(box.width);
      // En el cuadro de preparación la picota aún no está ahí.
      let before = 0;
      for (let y = box.y; y < box.y + box.height; y++)
        for (let x = box.x; x < box.x + box.width; x++)
          if (alpha(row, 2, x, y)) before++;
      expect(before).toBe(0);
    }
  });
});
