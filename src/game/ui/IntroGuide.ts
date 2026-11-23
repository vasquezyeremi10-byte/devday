import Phaser from 'phaser';
import { VIEW } from '../config/constants';
import { INTRO_OBJECTIVES, type IntroStep } from '../config/intro';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { pixelText } from './PixelFont';

/**
 * Guía de la primera secuencia, pensada para no estorbar: una línea de
 * objetivo bajo la barra superior (T la oculta) y una flecha que sube y baja
 * sobre el lugar de interés, tanto en el mundo como dentro de la cabaña.
 */
export class IntroGuide {
  private readonly plate: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.BitmapText;
  private readonly hint: Phaser.GameObjects.BitmapText;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private shown = '';

  constructor(scene: Phaser.Scene) {
    this.plate = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH.ui - 5)
      .setVisible(false);
    this.label = pixelText(scene, 0, 0, '', P.cream)
      .setScrollFactor(0)
      .setDepth(DEPTH.ui - 4)
      .setVisible(false);
    this.hint = pixelText(scene, 0, 0, '[T] OCULTAR GUÍA', P.stone)
      .setScrollFactor(0)
      .setDepth(DEPTH.ui - 4)
      .setVisible(false);
    this.arrow = scene.add.graphics().setDepth(DEPTH.worldUi + 2);
  }

  /**
   * `target` está en coordenadas del mundo. Dentro de la cabaña la flecha la
   * dibuja la propia cabaña y aquí no hay objetivo.
   */
  update(
    now: number,
    step: IntroStep,
    visible: boolean,
    target: { x: number; y: number } | null,
  ): void {
    const text = visible ? INTRO_OBJECTIVES[step] : '';
    if (text !== this.shown) {
      this.shown = text;
      this.plate.clear();
      if (text) {
        const w = text.length * 6 + 14;
        const x = Math.round((VIEW.width - w) / 2);
        const y = 70;
        this.plate
          .fillStyle(P.ink)
          .fillRect(x - 2, y - 2, w + 4, 27)
          .fillStyle(P.gold)
          .fillRect(x - 1, y - 1, w + 2, 1)
          .fillStyle(P.night)
          .fillRect(x - 1, y, w + 2, 24)
          .fillStyle(P.gold)
          .fillRect(x + 3, y + 3, 2, 6)
          .fillStyle(P.slate)
          .fillRect(x + 3, y + 12, w - 6, 1);
        this.label.setText(text).setPosition(x + 9, y + 2);
        this.hint.setPosition(Math.round((VIEW.width - 16 * 6) / 2), y + 15);
      }
      this.label.setVisible(!!text);
      this.hint.setVisible(!!text);
      this.plate.setVisible(!!text);
    }
    // Flecha dorada de 7 × 5 con contorno, que rebota 2 px.
    const a = this.arrow.clear();
    if (!visible || !target) return;
    const bob = Math.floor(now / 220) % 2 ? 2 : 0;
    const x = Math.round(target.x) - 3;
    const y = Math.round(target.y) + bob;
    a.fillStyle(P.ink)
      .fillRect(x - 1, y - 1, 9, 3)
      .fillRect(x, y + 1, 7, 2)
      .fillRect(x + 1, y + 3, 5, 2)
      .fillRect(x + 2, y + 5, 3, 2)
      .fillRect(x + 3, y + 6, 1, 2);
    a.fillStyle(P.gold)
      .fillRect(x, y, 7, 1)
      .fillRect(x + 1, y + 1, 5, 1)
      .fillRect(x + 2, y + 2, 3, 1)
      .fillRect(x + 3, y + 3, 1, 1);
  }
}
