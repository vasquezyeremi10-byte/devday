import Phaser from 'phaser';
import { FLIGHT, PLAYER, SPAWN } from '../config/constants';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { SPRINT } from '../config/sprint';
import { STRIKE_FEEL, knockbackVelocity } from '../systems/Combat';

/** Duración de una animación de la lista, en ms (cuadros / fps). */
const animationMs = (key: (typeof MINER_ANIMATIONS)[number]['key']): number => {
  const a = MINER_ANIMATIONS.find((x) => x.key === key)!;
  return Math.round((a.count * 1000) / a.frameRate);
};

/**
 * Animaciones en el orden de la hoja (hero*.png, dibujadas por
 * scripts/art/build-hero.mjs). Empuje activo en V2; correr y cargar en brazos
 * quedan preparados. Las siete poses de pala 47–53 se seleccionan por el
 * progreso real de WorkSystem.
 */
export const MINER_ANIMATIONS = [
  { key: 'miner-idle', start: 0, count: 4, frameRate: 4, repeat: -1 },
  // 6 cuadros de caminata (los cuadros 10–11 repiten 4–5).
  { key: 'miner-walk', start: 4, count: 6, frameRate: 10, repeat: -1 },
  { key: 'miner-rise', start: 12, count: 1, frameRate: 1, repeat: 0 },
  { key: 'miner-apex', start: 13, count: 1, frameRate: 1, repeat: 0 },
  { key: 'miner-fall', start: 14, count: 1, frameRate: 1, repeat: 0 },
  { key: 'miner-land', start: 15, count: 1, frameRate: 1, repeat: 0 },
  { key: 'miner-mine', start: 16, count: 6, frameRate: 18, repeat: 0 },
  { key: 'miner-dig', start: 22, count: 5, frameRate: 15, repeat: 0 },
  { key: 'miner-celebrate', start: 27, count: 4, frameRate: 8, repeat: 0 },
  { key: 'miner-run', start: 31, count: 6, frameRate: 14, repeat: -1 },
  { key: 'miner-push', start: 37, count: 4, frameRate: 8, repeat: -1 },
  { key: 'miner-carry', start: 41, count: 4, frameRate: 10, repeat: -1 },
  { key: 'miner-tired', start: 45, count: 2, frameRate: 2, repeat: -1 },
] as const;
export const MINER_FRAME_COUNT = 54;

export class Miner extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  /** Movilidad reducida por aire viciado (1 = normal). No cambia el cuerpo. */
  speedFactor = 1;
  /** V8: con poca energía, en reposo respira agitado (postura cansada). */
  tired = false;
  /** Código `fly`: permite alternar el vuelo con doble espacio. */
  canFly = false;
  /** Volando: sin gravedad; Espacio/W/↑ sube, S/↓ baja; al tocar suelo bajando, aterriza. */
  flying = false;
  /** Sprint activo en este fotograma (Shift izquierdo y avance horizontal). */
  sprinting = false;
  private sprintHeld = false;
  private readonly sprintKey: Phaser.Input.Keyboard.Key;
  private lastSpaceAt = -Infinity;
  private jumpRequested = false;
  private action: 'celebrate' | 'swing' | null = null;
  private actionUntil = 0;
  /** Empuje horizontal de un golpe recibido (px/s al empezar) y su inicio. */
  private pushStart = 0;
  private pushAt = -Infinity;
  /** Destello opaco al recibir daño y el tinte que había antes (luz de la hora). */
  private flashUntil = 0;
  private flashRestore: number | null = null;
  private landUntil = 0;
  private airborne = false;
  private readonly keys: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    jump: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene) {
    super(scene, SPAWN.x, SPAWN.y, 'miner', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // Cuadros de 32 × 32 (V12–V13). El origen deja los pies del
    // dibujo (borde inferior del cuadro) 12 px bajo la posición del sprite y
    // el cuerpo físico sigue siendo el de siempre: 10 × 18, de x − 5 a x + 5 y
    // de y − 6 a y + 12 (en reposo sobre el suelo, y = suelo − 12).
    this.setDepth(DEPTH.characters)
      .setOrigin(0.5, 0.625)
      .setSize(10, 18)
      .setOffset(11, 14)
      .setCollideWorldBounds(true)
      // El tope horizontal admite el sprint; la velocidad normal sigue igual.
      .setMaxVelocity(PLAYER.speed * SPRINT.factor, 280);
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('El prototipo requiere teclado');
    this.keys = keyboard.addKeys({
      left: 'LEFT',
      right: 'RIGHT',
      jump: 'SPACE',
      a: 'A',
      d: 'D',
      w: 'W',
      up: 'UP',
    }) as Omit<typeof this.keys, 's' | 'down'> as typeof this.keys;
    // Bajar en vuelo; sin captura propia (↓ también elige filas en la bodega).
    this.keys.s = keyboard.addKey('S', false);
    this.keys.down = keyboard.addKey('DOWN', false);
    // Sprint: 'SHIFT' responde a ambos Shift; el evento distingue el izquierdo.
    this.sprintKey = keyboard.addKey('SHIFT', false);
    this.sprintKey.on('down', (_k: unknown, e?: KeyboardEvent) => {
      if (e?.code === SPRINT.code) this.sprintHeld = true;
    });
    this.sprintKey.on('up', (_k: unknown, e?: KeyboardEvent) => {
      if (e?.code === SPRINT.code) this.sprintHeld = false;
    });
    // DOWN conserva pulsaciones que comienzan y terminan entre dos frames.
    // Los Key se destruyen con KeyboardPlugin al cerrar/reiniciar la escena.
    for (const key of [this.keys.jump, this.keys.w, this.keys.up]) {
      key.on('down', () => {
        this.jumpRequested = true;
      });
    }
    // Código `fly`: dos toques de Espacio seguidos alternan el vuelo.
    this.keys.jump.on('down', (_k: unknown, e?: KeyboardEvent) => {
      if (e?.repeat) return;
      const now = scene.time.now;
      if (this.canFly && now - this.lastSpaceAt <= FLIGHT.doubleTapMs) {
        this.setFlying(!this.flying);
        this.lastSpaceAt = -Infinity;
      } else this.lastSpaceAt = now;
    });
    for (const animation of MINER_ANIMATIONS) {
      if (scene.anims.exists(animation.key)) continue;
      scene.anims.create({
        key: animation.key,
        frameRate: animation.frameRate,
        repeat: animation.repeat,
        frames: scene.anims.generateFrameNumbers('miner', {
          start: animation.start,
          end: animation.start + animation.count - 1,
        }),
      });
    }
  }

  /** Festejo al descubrir un mineral; se cancela en cuanto el jugador se mueve. */
  celebrate(): void {
    this.action = 'celebrate';
    this.actionUntil = this.scene.time.now + 500;
    this.play('miner-celebrate');
  }

  /**
   * Golpe con la herramienta en mano (J): picar con picota, hacha o manos y
   * palear con la pala. Solo es dibujo: no frena ni bloquea el movimiento y
   * el daño lo decide la escena al pulsar.
   */
  swing(shovel: boolean): void {
    const key = shovel ? 'miner-dig' : 'miner-mine';
    this.action = 'swing';
    this.actionUntil = this.scene.time.now + animationMs(key);
    this.play(key);
  }

  /** Empuje al recibir un golpe desde un lado (`dir` = hacia dónde sale). */
  knock(dir: -1 | 1): void {
    this.pushStart = dir * STRIKE_FEEL.knockback;
    this.pushAt = this.scene.time.now;
  }

  /** Destello opaco de 70 ms (relleno de color, sin alfa parcial). */
  flash(): void {
    if (this.flashRestore === null) this.flashRestore = this.tint;
    this.flashUntil = this.scene.time.now + STRIKE_FEEL.flashMs;
    this.setTint(P.cream).setTintMode(Phaser.TintModes.FILL);
  }

  /** Termina el destello y devuelve el tinte de la hora (NightTint). */
  private updateFlash(now: number): void {
    if (this.flashRestore === null || now < this.flashUntil) return;
    // Si la luz de la hora cambió durante el destello, conservar la nueva.
    const base = this.tint === P.cream ? this.flashRestore : this.tint;
    this.flashRestore = null;
    this.setTintMode(Phaser.TintModes.MULTIPLY).setTint(base);
  }

  /** Alterna la gravedad del cuerpo; el tamaño y la colisión no cambian. */
  setFlying(on: boolean): void {
    if (on && !this.canFly) return;
    this.flying = on;
    this.body.setAllowGravity(!on);
    if (on) this.setVelocityY(0);
  }

  get direction(): number {
    return (
      Number(this.keys.right.isDown || this.keys.d.isDown) -
      Number(this.keys.left.isDown || this.keys.a.isDown)
    );
  }

  step(blocked = false): void {
    const left = this.keys.left.isDown || this.keys.a.isDown;
    const right = this.keys.right.isDown || this.keys.d.isDown;
    const direction = blocked ? 0 : Number(right) - Number(left);
    // Correr solo con Shift izquierdo mantenido y avance; soltarlo vuelve a caminar.
    this.sprinting =
      !blocked && direction !== 0 && this.sprintHeld && this.sprintKey.isDown;
    const sprint = this.sprinting ? SPRINT.factor : 1;
    const now = this.scene.time.now;
    // El empuje de un golpe se suma al control: el jugador nunca lo pierde.
    const push = knockbackVelocity(this.pushStart, now - this.pushAt);
    this.setVelocityX(
      direction * PLAYER.speed * this.speedFactor * sprint + push,
    );
    this.updateFlash(now);
    if (this.flying && !this.canFly) this.setFlying(false);
    if (this.flying) {
      const up =
        this.keys.jump.isDown || this.keys.w.isDown || this.keys.up.isDown;
      const down = this.keys.s.isDown || this.keys.down.isDown;
      const vertical = blocked ? 0 : Number(down) - Number(up);
      this.setVelocityY(vertical * FLIGHT.speed * this.speedFactor);
      // Bajar hasta tocar el suelo aterriza, como al cerrar el vuelo.
      if (vertical > 0 && this.body.blocked.down) this.setFlying(false);
    } else if (!blocked && this.jumpRequested && this.body.blocked.down) {
      this.setVelocityY(-PLAYER.jumpSpeed);
      this.emit('jump');
    }
    this.jumpRequested = false;
    if (direction !== 0) this.setFlipX(direction < 0);
    const grounded = this.body.blocked.down;
    // Aterrizaje: un frame de rodillas flexionadas, sin frenar el movimiento.
    if (grounded && this.airborne) this.landUntil = now + 100;
    this.airborne = !grounded;
    if (this.action === 'celebrate' && (direction !== 0 || !grounded))
      this.action = null;
    if (this.action && now < this.actionUntil) return;
    this.action = null;
    if (!grounded) {
      const vy = this.body.velocity.y;
      this.play(
        vy < -60 ? 'miner-rise' : vy > 60 ? 'miner-fall' : 'miner-apex',
        true,
      );
    } else if (direction !== 0)
      this.play(this.sprinting ? 'miner-run' : 'miner-walk', true);
    else
      this.play(
        now < this.landUntil
          ? 'miner-land'
          : this.tired
            ? 'miner-tired'
            : 'miner-idle',
        true,
      );
  }
}
