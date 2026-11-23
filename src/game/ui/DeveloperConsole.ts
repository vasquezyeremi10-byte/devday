import type Phaser from 'phaser';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { industrialFrame } from './Frame';
import { pixelText } from './PixelFont';

/**
 * Consola de la tecla | para códigos (money, fly, gnomo, desbloquear), disponible en toda partida;
 * en modo desarrollador suma sus comandos. Entrada nativa por carácter:
 * reconoce | con Shift, AltGr o Ctrl+Alt.
 */
export class DeveloperConsole {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly line: Phaser.GameObjects.BitmapText;
  private readonly output: Phaser.GameObjects.BitmapText;
  private buffer = '';
  private readonly captured = new Set<string>();
  open = false;

  constructor(
    scene: Phaser.Scene,
    private readonly execute: (command: string) => string,
    private readonly onToggle: (open: boolean) => void,
    developer = false,
  ) {
    const bg = scene.add.graphics();
    industrialFrame(bg, 0, 0, 440, 92, { title: 16 });
    this.line = pixelText(scene, 10, 68, '> |', P.cream);
    this.output = pixelText(
      scene,
      10,
      45,
      developer
        ? 'MONEY / FLY / GNOMO / DESBLOQUEAR / FULLSTACKS'
        : 'MONEY / FLY / GNOMO / DESBLOQUEAR - LOS CODIGOS DESACTIVAN LOGROS',
      P.mint,
    );
    this.panel = scene.add
      .container(20, 62, [
        bg,
        pixelText(
          scene,
          10,
          6,
          developer ? 'CONSOLA DE DESARROLLADOR' : 'CODIGOS',
          P.gold,
        ),
        pixelText(scene, 10, 25, 'ENTER: EJECUTAR  | / ESC: CERRAR', P.silver),
        this.output,
        this.line,
      ])
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 100)
      .setVisible(false);
    // Captura antes de Phaser: las letras nunca llegan a los atajos del juego.
    window.addEventListener('keydown', this.keyDown, true);
    window.addEventListener('keyup', this.keyUp, true);
    scene.events.once('shutdown', () => {
      window.removeEventListener('keydown', this.keyDown, true);
      window.removeEventListener('keyup', this.keyUp, true);
      this.captured.clear();
      this.panel.destroy();
    });
  }

  private consume(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  private keyUp = (e: KeyboardEvent): void => {
    if (this.open || this.captured.has(e.code)) this.consume(e);
    this.captured.delete(e.code);
  };

  private keyDown = (e: KeyboardEvent): void => {
    // Una tecla sostenida al cerrar debe soltarse antes de volver al juego.
    if (!this.open && this.captured.has(e.code)) {
      this.consume(e);
      return;
    }
    const target = e.target as HTMLElement | null;
    if (
      !this.open &&
      target &&
      (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName) ||
        target.isContentEditable)
    )
      return;
    if (!this.open && e.key !== '|') return;
    this.consume(e);
    this.captured.add(e.code);
    if (e.isComposing) return;
    if (e.key === '|' || e.key === 'Escape') {
      if (!e.repeat) {
        this.open = !this.open;
        this.buffer = '';
        this.panel.setVisible(this.open);
        this.onToggle(this.open);
      }
    } else if (e.key === 'Enter') {
      if (!e.repeat && this.buffer.trim()) {
        this.output.setText(this.execute(this.buffer));
        this.buffer = '';
      }
    } else if (e.key === 'Backspace') this.buffer = this.buffer.slice(0, -1);
    else if (
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      /^[a-zA-Z0-9 -]$/.test(e.key) &&
      this.buffer.length < 64
    )
      this.buffer += e.key;
    this.line.setText(`> ${this.buffer.toUpperCase()}|`);
  };
}
