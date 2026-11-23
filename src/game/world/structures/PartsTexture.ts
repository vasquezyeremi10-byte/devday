import Phaser from 'phaser';
import { cssColor } from '../../config/palette';

/** Pincel en coordenadas locales de una pieza: rectángulos enteros y opacos. */
export interface Brush {
  rect(x: number, y: number, w: number, h: number, color: number): void;
  px(x: number, y: number, color: number): void;
  /** Línea de 1 px con escalones enteros (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, color: number): void;
  /** Patrón de tablero (dithering) en un rectángulo: sombras sin alfa parcial. */
  dither(
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    phase?: number,
  ): void;
}

export interface Part {
  name: string;
  w: number;
  h: number;
  draw(b: Brush): void;
}

/**
 * Dibuja piezas independientes en una textura canvas y registra un frame por
 * pieza. Cada componente sigue siendo intercambiable (no es una imagen única).
 */
export function buildParts(
  scene: Phaser.Scene,
  key: string,
  parts: Part[],
): void {
  if (scene.textures.exists(key)) return;
  const width = 256;
  let x = 0;
  let y = 0;
  let rowH = 0;
  const placed = parts.map((part) => {
    if (x + part.w > width) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    const at = { part, x, y };
    x += part.w + 1;
    rowH = Math.max(rowH, part.h);
    return at;
  });
  const texture = scene.textures.createCanvas(key, width, y + rowH)!;
  const ctx = texture.context;
  ctx.imageSmoothingEnabled = false;
  for (const { part, x: ox, y: oy } of placed) {
    const rect = (
      rx: number,
      ry: number,
      w: number,
      h: number,
      color: number,
    ) => {
      const x0 = Math.max(0, rx);
      const y0 = Math.max(0, ry);
      const x1 = Math.min(part.w, rx + w);
      const y1 = Math.min(part.h, ry + h);
      if (x1 <= x0 || y1 <= y0) return;
      ctx.fillStyle = cssColor(color);
      ctx.fillRect(ox + x0, oy + y0, x1 - x0, y1 - y0);
    };
    const brush: Brush = {
      rect,
      px: (px, py, color) => rect(px, py, 1, 1, color),
      line(x0, y0, x1, y1, color) {
        // Bresenham solo termina con extremos enteros: un extremo fraccionario
        // (p. ej. un punto medio) dejaba el bucle girando para siempre.
        x0 = Math.round(x0);
        y0 = Math.round(y0);
        x1 = Math.round(x1);
        y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0);
        const dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
          rect(x0, y0, 1, 1, color);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) {
            err += dy;
            x0 += sx;
          }
          if (e2 <= dx) {
            err += dx;
            y0 += sy;
          }
        }
      },
      dither(dx, dy, w, h, color, phase = 0) {
        for (let j = 0; j < h; j++)
          for (let i = 0; i < w; i++)
            if ((i + j + phase) % 2 === 0) rect(dx + i, dy + j, 1, 1, color);
      },
    };
    part.draw(brush);
    texture.add(part.name, 0, ox, oy, part.w, part.h);
  }
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}
