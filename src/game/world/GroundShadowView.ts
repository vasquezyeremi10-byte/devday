import Phaser from 'phaser';
import { DEPTH } from '../config/layers';
import { shadowSpans, type SolidAt } from './GroundShadow';

/**
 * Dibujo de la sombra de contacto (world/GroundShadow.ts, puro): franjas de
 * 1–2 px sobre la cara superior del suelo real bajo el minero. Se pinta con
 * mezcla multiplicativa y colores opacos (la misma excepción a la paleta que
 * la luz): oscurece la costra, la arena o la roca que haya debajo sin alfa
 * parcial. Va sobre el terreno y bajo estructuras y personajes.
 */
const CORE = 0x7c7290;
const EDGE = 0xa89fb8;

export class GroundShadowView {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private signature = '';

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add
      .graphics()
      .setDepth(DEPTH.terrain + 4)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  /** Redibuja solo si cambió la posición de los pies o el suelo bajo ellos. */
  update(feetX: number, feetY: number, visible: boolean, solid: SolidAt): void {
    if (!visible) {
      if (this.signature) this.gfx.clear();
      this.signature = '';
      return;
    }
    const spans = shadowSpans(Math.round(feetX), Math.round(feetY), solid);
    const signature = spans.map((s) => `${s.x},${s.y},${s.h}`).join(';');
    if (signature === this.signature) return;
    this.signature = signature;
    const g = this.gfx.clear();
    for (const s of spans) g.fillStyle(s.h === 2 ? CORE : EDGE).fillRect(s.x, s.y, 1, s.h);
  }

  /** Columnas sombreadas del último cuadro (diagnóstico para pruebas). */
  get spans(): string {
    return this.signature;
  }
}
