import Phaser from 'phaser';
import { VIEW } from '../config/constants';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import type { VisibilitySystem } from '../systems/VisibilitySystem';
import type { CrystalIndex } from '../world/CrystalIndex';

const COLORS = [P.white, P.mauve, P.dawnPink, P.duskViolet, P.mauve];
/** Pelusas por cristal y tope total por fotograma (rendimiento). */
const PER_CRYSTAL = 2;
const MAX_MOTES = 36;
const RISE = 20;

/**
 * Partículas sutiles de los cristales violeta: motas de 1 px que suben y
 * titilan junto a cada cristal descubierto. Un solo Graphics, redibujado cada
 * fotograma con a lo sumo MAX_MOTES rectángulos; solo los cristales dentro de
 * la vista. Opacas y de la paleta (sin alfa parcial). Van sobre la capa de
 * oscuridad: son luz propia.
 */
export class CrystalMotes {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly crystals: CrystalIndex,
    private readonly visibility: VisibilitySystem,
  ) {
    this.g = scene.add.graphics().setDepth(DEPTH.lighting + 1);
  }

  update(
    now: number,
    camera: Phaser.Cameras.Scene2D.Camera,
    enabled: boolean,
  ): void {
    const g = this.g.clear();
    if (!enabled) return;
    const left = camera.scrollX - 16,
      top = camera.scrollY - 16,
      right = camera.scrollX + VIEW.width + 16,
      bottom = camera.scrollY + VIEW.height + 16;
    let drawn = 0;
    for (const s of this.crystals.spots) {
      if (drawn >= MAX_MOTES) break;
      if (s.lx === null || s.ly === null) continue;
      if (s.lx < left || s.lx > right || s.ly < top || s.ly > bottom) continue;
      if (!this.visibility.has(s.column, s.row)) continue;
      const seed = (s.column * 73856093) ^ (s.row * 19349663);
      for (let k = 0; k < PER_CRYSTAL; k++) {
        const phase = ((seed >>> (k * 5)) & 31) + k * 11;
        // Titila: apagada una de cada siete ventanas de 120 ms.
        if (Math.floor(now / 120 + phase) % 7 === 0) continue;
        const t = ((now / 75 + phase * 7) % RISE) / RISE;
        const x = Math.round(
          s.lx + Math.sin(now / 900 + phase) * 4 + (k ? 3 : -3),
        );
        const y = Math.round(s.ly + 6 - t * RISE);
        g.fillStyle(COLORS[(phase + k) % COLORS.length]!).fillRect(
          x,
          y,
          1,
          t < 0.7 && k === 0 ? 2 : 1,
        );
        drawn++;
      }
    }
  }

  destroy(): void {
    this.g.destroy();
  }
}
