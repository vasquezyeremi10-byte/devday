import Phaser from 'phaser';
import { GNOME_AI } from '../config/gnomeAI';
import {
  GNOME_BODY,
  GNOME_HURTBOX,
  GNOME_SHEET,
  gnomeSheetFrame,
} from '../config/gnomeAnimations';
import { GNOME_STRIKE_BOX } from '../config/gnomeFrames';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { GNOME } from '../systems/Combat';
import { GnomeBrain } from '../systems/GnomeBrain';
import {
  canSee,
  probeAhead,
  strikeConnects,
  strikeRect,
  type Rect,
  type SolidAt,
} from '../systems/GnomeSenses';

/** Lo que el gnomo necesita del mundo; la escena aplica las consecuencias. */
export interface GnomeWorld {
  solid: SolidAt;
  /** Hurtbox del minero (su cuerpo físico). */
  player: Rect;
  /** Cuadro de impacto del ataque: la escena decide si hay daño. */
  strike(box: Rect, chest: { x: number; y: number }): void;
  /** Cuadro de impacto contra la roca: esquirlas y sonido. */
  mineHit(x: number, y: number): void;
  /** Aterrizaje o caída del cuerpo: polvo. */
  dust(x: number, y: number): void;
}

/** Duración del destello al recibir un golpe (relleno opaco, sin alfa). */
const FLASH_MS = 70;

/**
 * Gnomo minero animado: sprite de la hoja `gnome` (64 × 48), cuerpo físico
 * independiente del dibujo y cerebro puro (GnomeBrain). El cuadro visible lo
 * elige el cerebro con su propio reloj, igual que el instante del golpe.
 */
export class GnomeBoss {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly brain: GnomeBrain;
  hp: number = GNOME.hp;
  /** La muerte terminó y el sprite ya no existe. */
  gone = false;
  private readonly bar: Phaser.GameObjects.Graphics;
  private flashMs = 0;
  private airMs = 0;
  private destroyed = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.physics.add.sprite(x, y, GNOME_SHEET.key, 0);
    this.sprite
      .setDepth(DEPTH.characters + 1)
      .setSize(GNOME_BODY.width, GNOME_BODY.height)
      .setOffset(GNOME_BODY.offsetX, GNOME_BODY.offsetY)
      .setDragX(420)
      .setCollideWorldBounds(true);
    this.brain = new GnomeBrain(x);
    this.bar = scene.add.graphics().setDepth(DEPTH.worldUi);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get dead(): boolean {
    return this.brain.dead;
  }

  private get body(): Phaser.Physics.Arcade.Body {
    return this.sprite.body as Phaser.Physics.Arcade.Body;
  }

  /** Zona que recibe golpes, en el mundo. */
  hurtbox(): Rect {
    const c = this.body.center;
    return {
      x: c.x - GNOME_HURTBOX.width / 2,
      y: c.y + GNOME_HURTBOX.dy - GNOME_HURTBOX.height / 2,
      width: GNOME_HURTBOX.width,
      height: GNOME_HURTBOX.height,
    };
  }

  /** Pecho: origen de la línea de visión de sus golpes. */
  chest(): { x: number; y: number } {
    const c = this.body.center;
    return { x: c.x, y: c.y - 2 };
  }

  /** Detiene el avance (ventanas abiertas: el gnomo no actúa). */
  freeze(): void {
    if (!this.destroyed) this.sprite.setVelocityX(0);
  }

  update(dtMs: number, world: GnomeWorld): void {
    if (this.destroyed) return;
    const body = this.body;
    const brain = this.brain;
    const bodyRect: Rect = {
      x: body.x,
      y: body.y,
      width: body.width,
      height: body.height,
    };
    const facing = brain.facing;
    const eye = { x: body.center.x + facing * 3, y: body.y + 2 };
    const playerX = world.player.x + world.player.width / 2;
    const toward: -1 | 1 = playerX < body.center.x ? -1 : 1;
    const seen =
      !brain.dead && canSee(world.solid, eye, facing, world.player)
        ? playerX
        : null;
    const reachBox = strikeRect(
      GNOME_STRIKE_BOX.attack,
      this.sprite.x,
      this.sprite.y,
      toward,
    );
    const inReach =
      seen !== null &&
      strikeConnects(world.solid, this.chest(), reachBox, world.player);
    const out = brain.tick({
      dt: dtMs,
      x: body.center.x,
      grounded: body.blocked.down,
      seen,
      inReach,
      left: probeAhead(world.solid, bodyRect, -1),
      right: probeAhead(world.solid, bodyRect, 1),
    });
    if (out.done) {
      this.destroy();
      return;
    }
    // Movimiento: herido o muerto, el empuje se frena solo (arrastre).
    if (brain.state !== 'HURT' && !brain.dead) this.sprite.setVelocityX(out.vx);
    if (out.jump && body.blocked.down)
      this.sprite.setVelocityY(GNOME_AI.jumpVelocity);
    this.sprite.setFlipX(out.facing < 0);
    this.sprite.setFrame(gnomeSheetFrame(out.animation, out.frame));

    if (out.strike)
      world.strike(
        strikeRect(
          GNOME_STRIKE_BOX.attack,
          this.sprite.x,
          this.sprite.y,
          out.facing,
        ),
        this.chest(),
      );
    if (out.mineHit) {
      const r = strikeRect(
        GNOME_STRIKE_BOX.mine,
        this.sprite.x,
        this.sprite.y,
        out.facing,
      );
      world.mineHit(out.facing > 0 ? r.x + r.width : r.x, r.y + r.height / 2);
    }
    // Polvo al aterrizar tras un salto o una caída.
    if (!body.blocked.down) this.airMs += dtMs;
    else {
      if (this.airMs > 160) world.dust(body.center.x, body.bottom);
      this.airMs = 0;
    }

    this.flashMs = Math.max(0, this.flashMs - dtMs);
    if (this.flashMs > 0)
      this.sprite.setTint(P.cream).setTintMode(Phaser.TintModes.FILL);
    else this.sprite.clearTint();

    this.bar.clear();
    if (brain.dead) return;
    // Barra de salud justo encima de la punta del gorro.
    const bx = Math.round(body.center.x) - 9;
    const by =
      Math.round(this.sprite.y) -
      GNOME_SHEET.frameHeight / 2 +
      GNOME_SHEET.originY -
      6;
    this.bar.fillStyle(P.ink).fillRect(bx, by, 18, 4);
    this.bar
      .fillStyle(brain.enraged ? P.gold : P.red)
      .fillRect(bx + 1, by + 1, Math.ceil((16 * this.hp) / GNOME.hp), 2);
  }

  /**
   * Golpe recibido desde `fromX`. Devuelve true si lo mata. Un gnomo muerto
   * sigue en escena mientras cae y se disuelve, pero ya no recibe golpes.
   */
  hit(damage: number, fromX: number): boolean {
    if (this.dead || this.destroyed) return false;
    this.hp = Math.max(0, this.hp - damage);
    // Con la guardia alzada pierde salud pero no lo empuja ni lo interrumpe.
    if (this.brain.hurt(fromX, this.body.center.x, this.hp / GNOME.hp)) {
      const away = this.body.center.x < fromX ? -1 : 1;
      this.sprite.setVelocityX(away * GNOME_AI.knockback);
      if (this.body.blocked.down) this.sprite.setVelocityY(-60);
    }
    this.flashMs = FLASH_MS;
    return this.hp <= 0;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.gone = true;
    this.bar.destroy();
    this.sprite.destroy();
  }
}
