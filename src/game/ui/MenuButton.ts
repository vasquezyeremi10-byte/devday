import Phaser from 'phaser';
import { PALETTE as P } from '../config/palette';
import { pixelText } from './PixelFont';

/**
 * Texto con sombra de tinta de 1 px (legible sobre la ilustración). Con
 * `shadow` en falso no dibuja la sombra: sobre un panel oscuro sólido, como
 * el cuerpo de los botones, la sombra solo duplicaba el trazo de 1 px y
 * engrosaba las letras.
 */
export class ShadowText {
  private readonly shadow: Phaser.GameObjects.BitmapText;
  private readonly main: Phaser.GameObjects.BitmapText;
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    value: string,
    color: number,
    shadow = true,
  ) {
    this.shadow = pixelText(scene, x + 1, y + 1, value.toUpperCase(), P.ink);
    this.shadow.setVisible(shadow);
    this.hasShadow = shadow;
    this.main = pixelText(scene, x, y, value.toUpperCase(), color);
  }
  private readonly hasShadow: boolean;
  get objects(): Phaser.GameObjects.BitmapText[] {
    return [this.shadow, this.main];
  }
  setText(value: string): this {
    this.shadow.setText(value.toUpperCase());
    this.main.setText(value.toUpperCase());
    return this;
  }
  setColor(color: number): this {
    this.main.setTint(color);
    return this;
  }
  setPosition(x: number, y: number): this {
    this.shadow.setPosition(x + 1, y + 1);
    this.main.setPosition(x, y);
    return this;
  }
  setVisible(v: boolean): this {
    this.shadow.setVisible(v && this.hasShadow);
    this.main.setVisible(v);
    return this;
  }
  get width(): number {
    return this.main.width;
  }
}

/** Tono oscuro del marco (abajo y a la derecha) para cada color de acento. */
const ACCENT_DARK = new Map<number, number>([
  [P.gold, P.amber],
  [P.red, P.rust],
  [P.mint, P.teal],
]);

/** Piqueta 8 × 7: marca de selección del botón (cabeza de acero, mango de madera). */
const PICK = [
  '.HHHHHH.',
  'H..HH..H',
  '...MM...',
  '...MM...',
  '...MM...',
  '...MM...',
  '...MM...',
];

export interface MenuButtonOptions {
  /** Color de acento del borde al seleccionar. */
  accent?: number;
  onClick: () => void;
  /** El puntero entró: el menú pasa la selección a este botón. */
  onHover?: () => void;
}

/**
 * Botón pixel art del menú. Estados: normal, seleccionado (teclado o
 * cursor) y desactivado. Al seleccionarse se desliza 4 px a la derecha, el
 * rótulo cede lugar a una piqueta, el borde se vuelve dorado y un destello
 * recorre el bisel. Al pulsar baja 1 px. Todo en píxeles enteros: sin
 * transparencias parciales ni degradados.
 */
export class MenuButton {
  readonly container: Phaser.GameObjects.Container;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: ShadowText;
  private readonly anim = { t: 0 };
  private tween?: Phaser.Tweens.Tween;
  private focused = false;
  private pressed = false;
  private enabled = true;
  private live = true;
  private blocked = false;
  private lastKey = '';
  private readonly accent: number;
  /** Desplazamiento horizontal de la entrada tras la introducción (px). */
  private enterOffset = 0;
  private enterTween?: Phaser.Tweens.Tween;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    readonly w: number,
    readonly h: number,
    text: string,
    private readonly options: MenuButtonOptions,
  ) {
    this.accent = options.accent ?? P.gold;
    this.g = scene.add.graphics();
    // Sin sombra: el cuerpo es un panel oscuro sólido y la sombra de 1 px
    // duplicaba el trazo de la fuente.
    this.label = new ShadowText(
      scene,
      12,
      Math.floor((h - 7) / 2),
      text,
      P.cream,
      false,
    );
    this.container = scene.add.container(x, y, [
      this.g,
      ...this.label.objects,
    ]);
    // La zona de clic no se desplaza con la animación: el borde no «tiembla».
    this.zone = scene.add
      .zone(x, y, w + 6, h + 2)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.zone.on('pointerover', () => options.onHover?.());
    this.zone.on('pointerdown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.refresh(true);
    });
    this.zone.on('pointerup', () => {
      if (!this.pressed) return;
      this.pressed = false;
      this.refresh(true);
      this.activate();
    });
    this.zone.on('pointerout', () => {
      if (!this.pressed) return;
      this.pressed = false;
      this.refresh(true);
    });
    this.refresh(true);
  }

  /** Pulsación por teclado o clic completo. */
  activate(): void {
    if (this.enabled && this.live && !this.blocked) this.options.onClick();
  }

  /** Breve hundimiento visual al confirmar con el teclado (120 ms). */
  pulse(): void {
    if (!this.enabled || !this.live) return;
    this.pressed = true;
    this.refresh(true);
    this.scene.time.delayedCall(120, () => {
      if (!this.container.active) return;
      this.pressed = false;
      this.refresh(true);
    });
  }

  setDepth(depth: number): this {
    this.container.setDepth(depth);
    this.zone.setDepth(depth);
    return this;
  }

  setText(text: string): this {
    this.label.setText(text);
    return this;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    if (this.zone.input)
      this.zone.input.cursor = enabled ? 'pointer' : 'default';
    if (!enabled) this.setFocused(false);
    this.refresh(true);
    return this;
  }

  /**
   * Bloquea el clic y el teclado sin ocultar el botón (un diálogo abierto lo
   * deja visible debajo del tramado).
   */
  setBlocked(blocked: boolean): this {
    this.blocked = blocked;
    if (this.zone.input) this.zone.input.enabled = this.live && !blocked;
    if (blocked) {
      this.pressed = false;
      this.setFocused(false);
    }
    return this;
  }

  /** Muestra u oculta el botón y activa o desactiva su zona de clic. */
  setLive(live: boolean): this {
    this.live = live;
    this.container.setVisible(live);
    if (this.zone.input) this.zone.input.enabled = live && !this.blocked;
    if (!live) {
      this.pressed = false;
      this.focused = false;
      this.anim.t = 0;
      this.tween?.stop();
    }
    this.refresh(true);
    return this;
  }

  setFocused(focused: boolean): this {
    if (this.focused === focused) return this;
    this.focused = focused;
    this.tween?.stop();
    this.tween = this.scene.tweens.add({
      targets: this.anim,
      t: focused ? 1 : 0,
      duration: focused ? 150 : 110,
      ease: focused ? 'Cubic.easeOut' : 'Sine.easeIn',
      onUpdate: () => this.refresh(),
      onComplete: () => this.refresh(true),
    });
    return this;
  }

  /** Coloca el botón fuera de su sitio (a la izquierda) para la entrada. */
  setEnterOffset(offset: number): this {
    this.enterTween?.stop();
    this.enterOffset = Math.round(offset);
    this.refresh(true);
    return this;
  }

  /** Desliza el botón desde su desplazamiento de entrada hasta su sitio. */
  slideIn(duration: number): this {
    const state = { v: this.enterOffset };
    this.enterTween?.stop();
    this.enterTween = this.scene.tweens.add({
      targets: state,
      v: 0,
      duration,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.enterOffset = Math.round(state.v);
        this.refresh(true);
      },
      onComplete: () => this.setEnterOffset(0),
    });
    return this;
  }

  /** Cada fotograma: solo se redibuja si hay destello o animación en curso. */
  update(time: number): void {
    if (!this.live) return;
    if (this.focused && this.enabled) this.refresh(false, time);
  }

  destroy(): void {
    this.tween?.stop();
    this.enterTween?.stop();
    this.container.destroy();
    this.zone.destroy();
  }

  private refresh(force = false, time = this.scene.time.now): void {
    const t = this.anim.t;
    const slide = Math.round(t * 4);
    const press = this.pressed ? 1 : 0;
    // Piqueta: sube y baja un píxel cada 420 ms mientras está seleccionada.
    const bob = this.focused && t > 0.99 ? Math.floor(time / 420) % 2 : 0;
    // Destello: recorre el bisel durante 640 ms y descansa 900 ms.
    const cycle = time % 1540;
    const glint =
      this.focused && cycle < 640
        ? Math.floor((cycle / 640) * (this.w - 14))
        : -1;
    const key = `${slide}|${press}|${bob}|${glint}|${this.focused}|${this.enabled}|${Math.round(t * 8)}|${this.enterOffset}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;

    this.container.setPosition(this.x + slide + this.enterOffset, this.y + press);
    this.label.setPosition(
      12 + Math.round(t * 8),
      Math.floor((this.h - 7) / 2) + (press ? 1 : 0),
    );
    this.label.setColor(
      !this.enabled ? P.steel : this.focused || t > 0 ? P.gold : P.cream,
    );
    this.drawFace(t, glint, bob);
  }

  private drawFace(t: number, glint: number, bob: number): void {
    const { g, w, h } = this;
    const on = this.enabled && (this.focused || t > 0.2);
    g.clear();
    // Capa 1: contorno de tinta de 1 px con las cuatro esquinas recortadas.
    g.fillStyle(P.ink).fillRect(1, 0, w - 2, h).fillRect(0, 1, w, h - 2);
    // Capa 2: marco metálico de 1 px dentro del contorno. Luz arriba a la
    // izquierda y sombra abajo a la derecha; las esquinas (1,1)… quedan de
    // tinta y forman el chaflán.
    const light = on ? this.accent : this.enabled ? P.steel : P.stone;
    const dark = on ? (ACCENT_DARK.get(this.accent) ?? P.amber) : this.enabled ? P.stone : P.slate;
    g.fillStyle(light).fillRect(2, 1, w - 4, 1).fillRect(1, 2, 1, h - 4);
    g.fillStyle(dark).fillRect(2, h - 2, w - 4, 1).fillRect(w - 2, 2, 1, h - 4);
    // Capa 3: cuerpo sólido (sin trama) con un solo filete de luz arriba.
    g.fillStyle(on ? P.slate : P.night).fillRect(2, 2, w - 4, h - 4);
    g.fillStyle(on ? P.stone : this.enabled ? P.slate : P.night).fillRect(2, 2, w - 4, 1);
    // Destello deslizante sobre el bisel superior.
    if (glint >= 0 && on) g.fillStyle(P.white).fillRect(4 + glint, 1, 8, 1);
    // Piqueta de selección.
    if (t > 0.5 && this.enabled) {
      const px = 6;
      const py = Math.floor((h - PICK.length) / 2) + bob;
      PICK.forEach((row, ry) =>
        [...row].forEach((c, rx) => {
          if (c === '.') return;
          g.fillStyle(c === 'H' ? P.silver : P.amber).fillRect(
            px + rx,
            py + ry,
            1,
            1,
          );
          if (c === 'H' && ry === 0)
            g.fillStyle(P.white).fillRect(px + rx, py + ry, 1, 1);
        }),
      );
    }
  }
}
