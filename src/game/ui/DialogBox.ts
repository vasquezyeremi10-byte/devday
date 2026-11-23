import Phaser from 'phaser';
import type { DialogPage } from '../config/intro';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { industrialFrame } from './Frame';
import { pixelText } from './PixelFont';

/** Parte `text` en líneas de a lo sumo `width` caracteres (sin cortar palabras). */
export function wrapText(text: string, width: number): string {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

const CHARS_PER_SECOND = 55;
const FRAME = { x: 14, y: 200, w: 452, h: 58 };

/**
 * Diálogo breve en la parte baja de la pantalla: nombre de quien habla, texto
 * que se escribe de a poco, flecha parpadeante y ayuda de teclas. E, Enter o
 * clic avanzan (el primer pulso completa la línea); Esc omite todo.
 */
export class DialogBox {
  open = false;
  private pages: readonly DialogPage[] = [];
  private index = 0;
  private startedAt = 0;
  private text = '';
  private onDone?: (skipped: boolean) => void;
  private readonly root: Phaser.GameObjects.Container;
  private readonly name: Phaser.GameObjects.BitmapText;
  private readonly body: Phaser.GameObjects.BitmapText;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private readonly counter: Phaser.GameObjects.BitmapText;
  private readonly portrait?: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    options?: { hint: string; manualPointer?: boolean },
  ) {
    const g = scene.add.graphics();
    industrialFrame(g, FRAME.x, FRAME.y, FRAME.w, FRAME.h, {
      accent: P.gold,
      title: 11,
    });
    this.name = pixelText(scene, FRAME.x + 8, FRAME.y + 2, '', P.gold);
    this.body = pixelText(
      scene,
      FRAME.x + (options ? 31 : 10),
      FRAME.y + 17,
      '',
      P.cream,
    ).setLineSpacing(4);
    const hint = pixelText(
      scene,
      FRAME.x + 10,
      FRAME.y + FRAME.h - 10,
      options?.hint ?? '[E] SEGUIR   [ESC] OMITIR',
      P.stone,
    );
    this.counter = pixelText(
      scene,
      FRAME.x + FRAME.w - 30,
      FRAME.y + 2,
      '',
      P.silver,
    );
    this.arrow = scene.add.graphics();
    if (options)
      this.portrait = scene.add
        .image(FRAME.x + 7, FRAME.y + 13, '__DEFAULT')
        .setOrigin(0)
        .setVisible(false);
    this.root = scene.add
      .container(0, 0, [
        g,
        this.name,
        this.body,
        hint,
        this.counter,
        this.arrow,
      ])
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 30)
      .setVisible(false);
    if (!options?.manualPointer)
      scene.input.on('pointerdown', () => {
        if (this.open) this.advance();
      });
    if (this.portrait) this.root.add(this.portrait);
  }

  /** Abre el diálogo; `onDone(true)` si se omitió con Esc. */
  show(
    pages: readonly DialogPage[],
    onDone?: (skipped: boolean) => void,
    portrait?: { texture: string; frame: string },
  ): void {
    if (!pages.length) {
      onDone?.(false);
      return;
    }
    this.pages = pages;
    this.index = 0;
    this.onDone = onDone;
    this.open = true;
    if (portrait)
      this.portrait
        ?.setTexture(portrait.texture, portrait.frame)
        .setVisible(true);
    this.root.setVisible(true).setY(10);
    this.scene.tweens.add({
      targets: this.root,
      y: 0,
      duration: 120,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.root.setY(Math.round(this.root.y)),
    });
    this.load();
  }

  private load(): void {
    const page = this.pages[this.index]!;
    this.name.setText(page.speaker);
    this.text = wrapText(page.text, this.portrait ? 66 : 70);
    this.body.setText('');
    this.startedAt = this.scene.time.now;
    this.counter.setText(
      this.pages.length > 1 ? `${this.index + 1}/${this.pages.length}` : '',
    );
  }

  private get typed(): number {
    return Math.floor(
      ((this.scene.time.now - this.startedAt) / 1000) * CHARS_PER_SECOND,
    );
  }

  /** Completa la línea o pasa a la siguiente página. */
  advance(): void {
    if (!this.open) return;
    if (this.typed < this.text.length) {
      this.startedAt = -1e9;
      this.body.setText(this.text);
      return;
    }
    if (this.index + 1 < this.pages.length) {
      this.index++;
      this.load();
      return;
    }
    this.close(false);
  }

  /** Omite lo que queda del diálogo. */
  skip(): void {
    if (this.open) this.close(true);
  }

  private close(skipped: boolean): void {
    this.open = false;
    this.root.setVisible(false);
    const done = this.onDone;
    this.onDone = undefined;
    done?.(skipped);
  }

  update(now: number): void {
    if (!this.open) return;
    const n = Math.min(this.text.length, Math.max(0, this.typed));
    if (this.body.text.length !== n) this.body.setText(this.text.slice(0, n));
    const g = this.arrow.clear();
    // Flecha «siguiente»: baja y sube un píxel mientras espera.
    if (n >= this.text.length && Math.floor(now / 350) % 2 === 0) {
      const x = FRAME.x + FRAME.w - 14;
      const y = FRAME.y + FRAME.h - 10;
      g.fillStyle(P.gold)
        .fillRect(x, y, 7, 1)
        .fillRect(x + 1, y + 1, 5, 1)
        .fillRect(x + 2, y + 2, 3, 1)
        .fillRect(x + 3, y + 3, 1, 1);
    }
  }
}
