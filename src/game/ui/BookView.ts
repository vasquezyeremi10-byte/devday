import Phaser from 'phaser';
import { BOOK_PAGE } from '../config/intro';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { wrapText } from './DialogBox';
import { pixelText } from './PixelFont';

const PANEL = { x: 100, y: 22, w: 280, h: 220 };
/** Las líneas aparecen una a una, como si el texto se fuera leyendo. */
const LINE_MS = 80;

/**
 * Página del libro del abuelo: hoja de pergamino con tapa de cuero, título,
 * texto que aparece línea a línea y ayuda de cierre. E, Enter, clic o Esc
 * cierran; la primera pulsación mientras aparece el texto lo completa.
 */
export class BookView {
  open = false;
  private openedAt = 0;
  private onClose?: () => void;
  private readonly root: Phaser.GameObjects.Container;
  private readonly lines: Phaser.GameObjects.BitmapText[] = [];
  private readonly footer: Phaser.GameObjects.BitmapText;
  private readonly close: Phaser.GameObjects.BitmapText;
  private revealed = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const { x, y, w, h } = PANEL;
    const g = scene.add.graphics();
    // Sombra, tapa de cuero con contorno de tinta y hoja de pergamino.
    g.fillStyle(P.ink).fillRect(x + 3, y + 3, w, h);
    g.fillStyle(P.ink).fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle(P.earth).fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(P.clay)
      .fillRect(x - 1, y - 1, w + 2, 1)
      .fillRect(x - 1, y - 1, 1, h + 2);
    g.fillStyle(P.cream).fillRect(x + 6, y + 6, w - 12, h - 12);
    g.fillStyle(P.sand)
      .fillRect(x + 6, y + h - 8, w - 12, 2)
      .fillRect(x + w - 8, y + 6, 2, h - 12);
    // Costura central y esquineros dorados.
    for (let i = y + 10; i < y + h - 10; i += 6)
      g.fillStyle(P.loam).fillRect(x + 8, i, 1, 3);
    for (const [cx, cy] of [
      [x + 6, y + 6],
      [x + w - 12, y + 6],
      [x + 6, y + h - 12],
      [x + w - 12, y + h - 12],
    ] as const)
      g.fillStyle(P.ochre)
        .fillRect(cx, cy, 6, 6)
        .fillStyle(P.gold)
        .fillRect(cx, cy, 6, 1);
    // Trazo ondulado bajo el título.
    for (let i = 0; i < w - 40; i += 2)
      g.fillStyle(P.rust).fillRect(x + 20 + i, y + 32 + ((i >> 2) % 2), 2, 1);

    const title = pixelText(scene, x + 20, y + 14, BOOK_PAGE.title, P.rust);
    const page = pixelText(
      scene,
      x + w - 20 - BOOK_PAGE.page.length * 6,
      y + 14,
      BOOK_PAGE.page,
      P.clay,
    );
    for (let i = 0; i < BOOK_PAGE.lines.length; i++)
      this.lines.push(
        pixelText(
          scene,
          x + 20,
          y + 42 + i * 10,
          BOOK_PAGE.lines[i]!,
          P.umber,
        ).setVisible(false),
      );
    this.footer = pixelText(
      scene,
      x + 20,
      y + 42 + BOOK_PAGE.lines.length * 10 + 6,
      wrapText(BOOK_PAGE.footer, 38),
      P.clay,
    )
      .setLineSpacing(3)
      .setVisible(false);
    this.close = pixelText(
      scene,
      x + w - 20 - 60,
      y + h - 18,
      '[E] CERRAR',
      P.earth,
    );
    this.root = scene.add
      .container(0, 0, [g, title, page, ...this.lines, this.footer, this.close])
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 32)
      .setVisible(false);
    scene.input.on('pointerdown', () => {
      if (this.open) this.dismiss();
    });
  }

  show(onClose?: () => void): void {
    this.open = true;
    this.onClose = onClose;
    this.openedAt = this.scene.time.now;
    this.revealed = 0;
    for (const line of this.lines) line.setVisible(false);
    this.footer.setVisible(false);
    this.root.setVisible(true).setY(8);
    this.scene.tweens.add({
      targets: this.root,
      y: 0,
      duration: 160,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.root.setY(Math.round(this.root.y)),
    });
  }

  /** Primera pulsación: muestra todo el texto; la siguiente cierra el libro. */
  dismiss(): void {
    if (!this.open) return;
    if (this.revealed < this.lines.length) {
      this.openedAt = -1e9;
      this.update(this.scene.time.now);
      return;
    }
    this.open = false;
    this.root.setVisible(false);
    const done = this.onClose;
    this.onClose = undefined;
    done?.();
  }

  update(now: number): void {
    if (!this.open) return;
    const n = Math.min(
      this.lines.length,
      Math.floor((now - this.openedAt) / LINE_MS),
    );
    if (n !== this.revealed) {
      this.revealed = n;
      this.lines.forEach((line, i) => line.setVisible(i < n));
      this.footer.setVisible(n >= this.lines.length);
    }
    // «[E] CERRAR» solo parpadea cuando ya se puede cerrar.
    this.close.setVisible(
      n >= this.lines.length && Math.floor(now / 500) % 2 === 0,
    );
  }
}
