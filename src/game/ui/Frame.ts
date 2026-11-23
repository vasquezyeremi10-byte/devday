import type Phaser from 'phaser';
import { PALETTE as P } from '../config/palette';

/**
 * Marcos de la interfaz V6, estética industrial: panel azul marino, borde
 * metálico con bisel (luz arriba-izquierda), placas con remaches en las
 * esquinas, franja de acento dorada y sombra discreta de tinta. Solo
 * rectángulos opacos de la paleta: sin alfa parcial ni degradados.
 *
 * (x, y, w, h) es el área interior; el marco ocupa 2 px alrededor y la
 * sombra 2 px más abajo y a la derecha.
 */
export function industrialFrame(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { accent?: number; title?: number; shadow?: boolean } = {},
): void {
  const accent = opts.accent ?? P.gold;
  if (opts.shadow !== false)
    g.fillStyle(P.ink)
      .fillRect(x, y + h + 2, w + 2, 2)
      .fillRect(x + w + 2, y, 2, h + 4);
  g.fillStyle(P.ink).fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle(P.steel).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(P.silver)
    .fillRect(x - 1, y - 1, w + 2, 1)
    .fillRect(x - 1, y - 1, 1, h + 2);
  g.fillStyle(P.stone)
    .fillRect(x - 1, y + h, w + 2, 1)
    .fillRect(x + w, y - 1, 1, h + 2);
  g.fillStyle(P.night).fillRect(x, y, w, h);
  // Bisel interior: sombra arriba-izquierda del panel hundido.
  g.fillStyle(P.ink).fillRect(x, y, w, 1).fillRect(x, y, 1, h);
  if (opts.title) {
    g.fillStyle(P.slate).fillRect(x + 1, y + 1, w - 2, opts.title);
    g.fillStyle(P.stone).fillRect(x + 1, y + 1, w - 2, 1);
    g.fillStyle(accent).fillRect(x + 1, y + 1 + opts.title, w - 2, 1);
  } else g.fillStyle(accent).fillRect(x + 1, y + 1, w - 2, 2);
  // Placas de esquina con remache.
  for (const [cx, cy] of [
    [x + 1, y + h - 5],
    [x + w - 5, y + h - 5],
  ] as const) {
    g.fillStyle(P.slate).fillRect(cx, cy, 4, 4);
    g.fillStyle(P.silver).fillRect(cx + 1, cy + 1, 1, 1);
    g.fillStyle(P.stone).fillRect(cx + 2, cy + 2, 1, 1);
  }
}

/**
 * Placa del HUD V8: módulo con contorno de tinta, bisel metálico (luz
 * arriba-izquierda), interior azul marino con sombra interna, escuadras
 * doradas en las esquinas superiores y remaches abajo. (x, y, w, h) es el
 * interior; el marco ocupa 2 px y la sombra 1 px abajo a la derecha.
 */
export function hudPlate(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number = P.gold,
): void {
  g.fillStyle(P.ink)
    .fillRect(x - 1, y + h + 2, w + 4, 1)
    .fillRect(x + w + 2, y - 1, 1, h + 4);
  g.fillStyle(P.ink).fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle(P.steel).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(P.silver)
    .fillRect(x - 1, y - 1, w + 2, 1)
    .fillRect(x - 1, y - 1, 1, h + 2);
  g.fillStyle(P.stone)
    .fillRect(x - 1, y + h, w + 2, 1)
    .fillRect(x + w, y - 1, 1, h + 2);
  g.fillStyle(P.night).fillRect(x, y, w, h);
  // Sombra interna arriba-izquierda y reflejo de pizarra abajo.
  g.fillStyle(P.ink).fillRect(x, y, w, 1).fillRect(x, y, 1, h);
  g.fillStyle(P.slate).fillRect(x + 1, y + h - 1, w - 1, 1);
  // Escuadras doradas en las esquinas superiores.
  g.fillStyle(accent)
    .fillRect(x - 1, y - 1, 6, 1)
    .fillRect(x - 1, y - 1, 1, 4)
    .fillRect(x + w - 5, y - 1, 6, 1)
    .fillRect(x + w, y - 1, 1, 4);
  g.fillStyle(P.cream).fillRect(x - 1, y - 1, 1, 1);
  // Remaches en las esquinas inferiores del bisel.
  for (const rx of [x - 1, x + w]) {
    g.fillStyle(P.slate).fillRect(rx, y + h - 2, 1, 2);
    g.fillStyle(P.silver).fillRect(rx, y + h - 2, 1, 1);
  }
}

/** Separador vertical hundido entre celdas de un módulo, con remache. */
export function hudSeparator(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  h: number,
): void {
  g.fillStyle(P.ink).fillRect(x, y, 1, h);
  g.fillStyle(P.slate).fillRect(x + 1, y, 1, h);
  const mid = y + Math.floor(h / 2) - 1;
  g.fillStyle(P.stone).fillRect(x, mid, 2, 2);
  g.fillStyle(P.silver).fillRect(x, mid, 1, 1);
}

/** Casilla hundida con bisel (iconos del HUD, ranuras). */
export function slotWell(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  g.fillStyle(P.slate).fillRect(x, y, w, h);
  g.fillStyle(P.night).fillRect(x, y, w, 1).fillRect(x, y, 1, h);
  g.fillStyle(P.stone)
    .fillRect(x, y + h - 1, w, 1)
    .fillRect(x + w - 1, y, 1, h);
}
