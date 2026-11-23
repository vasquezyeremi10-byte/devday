import type Phaser from 'phaser';
import { PPE, REQUIRED_PPE, type PPEKind } from '../config/gear';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import {
  DEFAULT_MINE_NAME,
  MINE_NAME_MAX,
  sanitizeMineName,
} from '../config/mineName';
import { industrialFrame } from './Frame';
import { pixelText } from './PixelFont';

/** Recuadro industrial reutilizable (ui/Frame). */
const frame = (
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
) => industrialFrame(g, x, y, w, h, { accent });

/**
 * Pantallas de seguridad y modalidad: acceso restringido por EPP,
 * selección Normal/Hardcore al crear una mina y confirmación de desmontaje.
 */
export class SafetyScreens {
  private readonly gate: Phaser.GameObjects.Container;
  private readonly gateLines: Phaser.GameObjects.BitmapText[] = [];
  private gateUntil = 0;
  private readonly mode: Phaser.GameObjects.Container;
  private readonly confirmBox: Phaser.GameObjects.Container;
  private readonly confirmText: Phaser.GameObjects.BitmapText;
  confirmOpen = false;
  modeOpen = false;
  /** Nombre que se está escribiendo en la pantalla de nueva expedición. */
  private nameDraft = '';
  private readonly nameField = { x: 184, y: 73, w: 64, h: 13 };
  private readonly nameText: Phaser.GameObjects.BitmapText;
  private readonly namePlaceholder: Phaser.GameObjects.BitmapText;
  private readonly nameCount: Phaser.GameObjects.BitmapText;
  /** Botones (coordenadas de pantalla) para el clic. */
  readonly buttons = {
    normal: { x: 70, y: 112, w: 160, h: 60 },
    hardcore: { x: 250, y: 112, w: 160, h: 60 },
    cancel: { x: 110, y: 150, w: 100, h: 16 },
    proceed: { x: 230, y: 150, w: 140, h: 16 },
  };

  constructor(private readonly scene: Phaser.Scene) {
    const t = (x: number, y: number, s: string, c: number) =>
      pixelText(scene, x, y, s, c);
    // Acceso restringido.
    const gg = scene.add.graphics();
    frame(gg, 0, 0, 236, 96, P.red);
    const title = t(8, 6, 'ACCESO RESTRINGIDO - EPP INCOMPLETO', P.red);
    for (let i = 0; i < REQUIRED_PPE.length; i++)
      this.gateLines.push(t(14, 20 + i * 11, '', P.cream));
    const foot = t(8, 80, 'NO PUEDES INGRESAR A LA MINA.', P.gold);
    this.gate = scene.add
      .container(122, 60, [gg, title, ...this.gateLines, foot])
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 25)
      .setVisible(false);
    // Confirmación de desmontaje peligroso.
    const cg = scene.add.graphics();
    const bt = this.buttons;
    frame(cg, 100, 92, 280, 82, P.red);
    frame(cg, bt.cancel.x, bt.cancel.y, bt.cancel.w, bt.cancel.h, P.mint);
    frame(cg, bt.proceed.x, bt.proceed.y, bt.proceed.w, bt.proceed.h, P.red);
    this.confirmText = t(110, 100, '', P.cream).setLineSpacing(3);
    this.confirmBox = scene.add
      .container(0, 0, [
        cg,
        this.confirmText,
        t(bt.cancel.x + 8, bt.cancel.y + 4, 'CANCELAR [ESC]', P.mint),
        t(bt.proceed.x + 6, bt.proceed.y + 4, 'RETIRAR IGUAL [ENTER]', P.red),
      ])
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 35)
      .setVisible(false);
    // Selección de modalidad.
    const mg = scene.add.graphics();
    mg.fillStyle(P.ink).fillRect(0, 0, 480, 270);
    frame(mg, 50, 50, 380, 160, P.gold);
    const b = this.buttons;
    frame(mg, b.normal.x, b.normal.y, b.normal.w, b.normal.h, P.mint);
    frame(mg, b.hardcore.x, b.hardcore.y, b.hardcore.w, b.hardcore.h, P.red);
    // Campo del nombre de la mina (hasta 10 caracteres).
    const field = this.nameField;
    frame(mg, field.x, field.y, field.w, field.h, P.gold);
    this.nameText = t(field.x + 3, field.y + 3, '', P.white);
    this.namePlaceholder = t(
      field.x + 3,
      field.y + 3,
      DEFAULT_MINE_NAME,
      P.stone,
    );
    this.nameCount = t(field.x + field.w + 8, field.y + 3, '', P.silver);
    this.mode = scene.add
      .container(0, 0, [
        mg,
        t(150, 58, 'NUEVA EXPEDICION', P.gold),
        t(70, field.y + 3, 'NOMBRE DE TU MINA:', P.cream),
        this.namePlaceholder,
        this.nameText,
        this.nameCount,
        t(110, 97, 'ELIGE LA MODALIDAD. NO SE PUEDE CAMBIAR.', P.silver),
        t(b.normal.x + 8, b.normal.y + 8, '[1] NORMAL', P.mint),
        t(b.normal.x + 8, b.normal.y + 22, 'REAPARECES EN SUPERFICIE', P.cream),
        t(b.normal.x + 8, b.normal.y + 32, 'PIERDES LA CARGA Y 10% $', P.cream),
        t(b.normal.x + 8, b.normal.y + 42, 'RECOMENDADO', P.silver),
        t(b.hardcore.x + 8, b.hardcore.y + 8, '[2] HARDCORE', P.red),
        t(b.hardcore.x + 8, b.hardcore.y + 22, 'UNA SOLA VIDA', P.cream),
        t(
          b.hardcore.x + 8,
          b.hardcore.y + 32,
          'MORIR TERMINA LA MINA',
          P.cream,
        ),
        t(b.hardcore.x + 8, b.hardcore.y + 42, 'PARA EXPERTOS', P.silver),
        t(111, 183, 'ESCRIBE EL NOMBRE Y PULSA 1 O 2, O HAZ CLIC', P.silver),
        t(123, 195, 'LETRAS Y ESPACIOS. RETROCESO BORRA.', P.stone),
      ])
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 40)
      .setVisible(false);
  }

  /** Confirmación antes de retirar un soporte crítico. */
  showConfirm(lines: string[] | null): void {
    this.confirmOpen = !!lines;
    this.confirmBox.setVisible(!!lines);
    if (lines) this.confirmText.setText(lines.join('\n'));
  }

  /** Muestra qué EPP falta durante unos segundos. */
  showGate(equipped: (kind: PPEKind) => boolean): void {
    REQUIRED_PPE.forEach((kind, i) => {
      const ok = equipped(kind);
      this.gateLines[i]!.setText(
        `${PPE[kind].short.padEnd(18, ' ')}${ok ? '✓' : '✕'}`,
      ).setTint(ok ? P.mint : P.red);
    });
    this.gate.setVisible(true);
    this.gateUntil = this.scene.time.now + 3500;
  }

  showMode(v: boolean): void {
    this.modeOpen = v;
    this.mode.setVisible(v);
    if (v) {
      this.nameDraft = '';
      this.refreshName(0);
    }
  }

  /** Agrega un carácter válido al nombre (máximo 10). */
  typeName(c: string): void {
    if (this.nameDraft.length >= MINE_NAME_MAX) return;
    // Sin espacio inicial ni dos espacios seguidos.
    if (c === ' ' && (!this.nameDraft || this.nameDraft.endsWith(' '))) return;
    this.nameDraft += c;
    this.refreshName(this.scene.time.now);
  }
  eraseName(): void {
    this.nameDraft = this.nameDraft.slice(0, -1);
    this.refreshName(this.scene.time.now);
  }
  /** Nombre final: lo escrito, normalizado, o MINA CERO si quedó vacío. */
  get mineName(): string {
    return sanitizeMineName(this.nameDraft);
  }
  private refreshName(now: number): void {
    const cursor = Math.floor(now / 400) % 2 === 0 ? '_' : ' ';
    const full = this.nameDraft.length >= MINE_NAME_MAX;
    this.nameText.setText(this.nameDraft + (full ? '' : cursor));
    this.namePlaceholder.setVisible(!this.nameDraft);
    this.nameCount
      .setText(`${this.nameDraft.length}/${MINE_NAME_MAX}`)
      .setTint(full ? P.gold : P.silver);
  }

  update(now: number): void {
    if (now > this.gateUntil) this.gate.setVisible(false);
    // Cursor parpadeante del campo de nombre.
    if (this.modeOpen) this.refreshName(now);
  }

  get gateVisible(): boolean {
    return this.gate.visible;
  }
}
