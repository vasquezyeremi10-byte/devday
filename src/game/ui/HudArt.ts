import type Phaser from 'phaser';
import { PALETTE as P } from '../config/palette';
import { buildParts, type Brush, type Part } from '../world/structures/PartsTexture';

/**
 * Íconos originales del HUD V8 (atlas `hud-icons`): moneda, casco, caja de
 * carga, estrella de experiencia y picota de zona. Píxeles enteros de la
 * paleta, contorno de tinta y luz arriba-izquierda.
 */
const PARTS: Part[] = [
  {
    name: 'coin',
    w: 9,
    h: 9,
    draw(b) {
      b.rect(2, 0, 5, 9, P.ink);
      b.rect(0, 2, 9, 5, P.ink);
      b.rect(1, 1, 7, 7, P.ink);
      b.rect(2, 1, 5, 7, P.gold);
      b.rect(1, 2, 7, 5, P.gold);
      b.rect(2, 2, 2, 1, P.cream);
      b.rect(2, 3, 1, 2, P.cream);
      b.rect(6, 4, 1, 3, P.amber);
      b.rect(3, 7, 4, 1, P.amber);
      // Marca acuñada.
      b.rect(4, 3, 1, 3, P.amber);
    },
  },
  // V9: batería de la linterna (9 × 8), `fill` 2 lleno, 1 mitad, 0 vacío.
  ...(['full', 'half', 'empty'] as const).map((kind) => ({
    name: `battery_${kind}`,
    w: 9,
    h: 8,
    draw(b: Brush) {
      // Cuerpo con borna a la derecha y dos celdas interiores.
      b.rect(0, 0, 8, 8, P.ink);
      b.rect(8, 3, 1, 2, P.ink);
      for (let y = 1; y < 7; y++)
        for (let x = 1; x < 7; x++) {
          const left = x < 4;
          const fill = kind === 'full' || (kind === 'half' && left);
          b.px(x, y, fill ? (y === 1 ? P.lime : P.mint) : P.slate);
        }
      // Borna y canto de luz arriba-izquierda.
      if (kind !== 'empty') b.px(8, 3, P.mint);
      b.px(1, 1, P.white);
    },
  })),
  {
    name: 'helmet',
    w: 11,
    h: 9,
    draw(b) {
      b.rect(2, 1, 7, 6, P.ink);
      b.rect(1, 3, 9, 4, P.ink);
      b.rect(0, 6, 11, 3, P.ink);
      b.rect(3, 2, 5, 4, P.gold);
      b.rect(2, 4, 7, 3, P.gold);
      b.rect(1, 7, 9, 1, P.amber);
      b.rect(3, 2, 2, 1, P.cream);
      b.px(2, 4, P.cream);
      // Lámpara frontal.
      b.rect(7, 3, 2, 2, P.white);
      b.px(8, 4, P.cream);
    },
  },
  {
    name: 'crate',
    w: 10,
    h: 9,
    draw(b) {
      b.rect(0, 0, 10, 9, P.ink);
      b.rect(1, 1, 8, 7, P.clay);
      b.rect(1, 1, 8, 1, P.loam);
      b.rect(1, 4, 8, 1, P.earth);
      b.rect(1, 7, 8, 1, P.earth);
      b.line(2, 6, 7, 2, P.earth);
      b.px(1, 1, P.silver);
      b.px(8, 1, P.steel);
      b.px(1, 7, P.steel);
      b.px(8, 7, P.steel);
    },
  },
  {
    name: 'star',
    w: 7,
    h: 7,
    draw(b) {
      b.rect(3, 0, 1, 7, P.gold);
      b.rect(0, 2, 7, 2, P.gold);
      b.rect(1, 4, 5, 1, P.gold);
      b.rect(2, 1, 3, 4, P.gold);
      b.px(1, 5, P.gold);
      b.px(5, 5, P.gold);
      b.px(0, 6, P.amber);
      b.px(6, 6, P.amber);
      b.px(3, 1, P.cream);
      b.px(2, 2, P.cream);
    },
  },
  {
    name: 'pick',
    w: 9,
    h: 9,
    draw(b) {
      b.line(1, 2, 4, 0, P.silver);
      b.line(4, 0, 8, 3, P.steel);
      b.px(4, 1, P.steel);
      b.line(4, 1, 0, 8, P.clay);
      b.px(1, 7, P.loam);
    },
  },
];

export function createHudIcons(scene: Phaser.Scene): void {
  buildParts(scene, 'hud-icons', PARTS);
}

export type HudIcon = 'coin' | 'helmet' | 'crate' | 'star' | 'pick';
export type BatteryIcon = 'battery_full' | 'battery_half' | 'battery_empty';
