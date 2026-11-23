import type { Probe } from './GnomeSenses';

/**
 * Chinchilla del desierto (18 de noviembre de 2026): decoración en
 * movimiento, sin interacción, sin daño y sin guardado. Cerebro puro (sin
 * Phaser): la escena le pasa dt, su posición, lo que tiene delante y dónde
 * está el minero, y aplica la velocidad y el salto que devuelve.
 *
 * - Tranquila: reposa, olfatea o da saltitos hasta un punto cerca de su casa;
 *   sube escalones de un bloque y no se tira por barrancos.
 * - Asustada: si el minero se acerca, huye en sentido contrario más rápido de
 *   lo que él corre; salta escalones y baja caídas cortas.
 * - Ante una pared alta o una caída grande da media vuelta y pasa corriendo;
 *   si vuelve a quedar acorralada, o tras huir un rato sin perderlo, se
 *   esconde (desaparece con polvo) y vuelve a salir cuando el minero se
 *   alejó.
 */
export const CRITTER = {
  walkSpeed: 22,
  /** Más rápida que el minero corriendo (144 px/s con Shift). */
  runSpeed: 150,
  /** El minero la asusta a esta distancia horizontal y vertical (px). */
  fearX: 64,
  fearY: 40,
  /** Se calma cuando el minero queda a esta distancia horizontal (px). */
  calmX: 160,
  /** Pasea hasta esta distancia de su casa (px). */
  wander: 64,
  idleMs: [900, 2600] as const,
  sniffMs: 1000,
  /** Huida máxima antes de esconderse si no logró alejarse. */
  fleeMs: 3200,
  /** Tiempo escondida antes de volver a asomarse. */
  hideMs: [5000, 10000] as const,
  /** Caída que acepta al huir (bloques); tranquila no baja ninguna. */
  fleeDrop: 3,
  /** Salto para subir un escalón de un bloque (gravedad 600). */
  jumpVelocity: -190,
} as const;

export type CritterState = 'idle' | 'sniff' | 'walk' | 'flee' | 'hidden';
export type CritterAnim = 'idle' | 'sniff' | 'hop' | 'run';

export interface CritterInput {
  dt: number;
  x: number;
  grounded: boolean;
  /** Posición del minero relativa a la chinchilla (px), o null si no está. */
  miner: { dx: number; dy: number } | null;
  left: Probe;
  right: Probe;
}

export interface CritterOutput {
  vx: number;
  jump: boolean;
  facing: -1 | 1;
  anim: CritterAnim;
  visible: boolean;
  /** Recién escondida: la escena suelta un poco de polvo. */
  vanished: boolean;
}

const between = (random: () => number, [a, b]: readonly [number, number]) =>
  a + (b - a) * random();

export class CritterBrain {
  state: CritterState = 'idle';
  facing: -1 | 1 = 1;
  home: number;
  private elapsed = 0;
  private duration = 0;
  private target = 0;
  /** Ya dio media vuelta en esta huida. */
  private turned = false;

  constructor(
    x: number,
    private readonly random: () => number = Math.random,
  ) {
    this.home = x;
    this.facing = random() < 0.5 ? -1 : 1;
    this.enter('idle');
  }

  private enter(state: CritterState): void {
    this.state = state;
    this.elapsed = 0;
    this.turned = false;
    if (state === 'idle') this.duration = between(this.random, CRITTER.idleMs);
    else if (state === 'sniff') this.duration = CRITTER.sniffMs;
    else if (state === 'flee') this.duration = CRITTER.fleeMs;
    else if (state === 'hidden') this.duration = between(this.random, CRITTER.hideMs);
    else {
      this.target = this.home + (this.random() * 2 - 1) * CRITTER.wander;
      this.duration = 6000;
    }
  }

  private scared(input: CritterInput): boolean {
    const m = input.miner;
    return !!m && Math.abs(m.dx) < CRITTER.fearX && Math.abs(m.dy) < CRITTER.fearY;
  }

  tick(input: CritterInput): CritterOutput {
    const dt = Math.min(Math.max(input.dt, 0), 100);
    this.elapsed += dt;
    let vx = 0;
    let jump = false;
    let vanished = false;
    const m = input.miner;

    if (this.state !== 'hidden' && this.state !== 'flee' && this.scared(input)) {
      // Huye hacia el lado contrario al minero (si está encima, al azar).
      this.facing = m!.dx > 0 ? -1 : m!.dx < 0 ? 1 : this.facing;
      this.enter('flee');
    }

    switch (this.state) {
      case 'hidden': {
        const near = !!m && Math.abs(m.dx) < CRITTER.calmX;
        if (this.elapsed >= this.duration) {
          if (near) this.elapsed = this.duration - 1000;
          else {
            this.home = input.x;
            this.enter('idle');
          }
        }
        break;
      }
      case 'flee': {
        const probe = this.facing < 0 ? input.left : input.right;
        // Pared alta o barranco: la primera vez da media vuelta y pasa
        // corriendo; si vuelve a quedar acorralada, se esconde.
        const cornered = (probe.wall && !probe.step) || probe.drop > CRITTER.fleeDrop;
        if (cornered) {
          if (!this.turned) {
            this.turned = true;
            this.facing = this.facing > 0 ? -1 : 1;
          } else {
            this.enter('hidden');
            vanished = true;
            break;
          }
        } else if (probe.wall) {
          // Escalón de un bloque: lo salta en cuanto pisa suelo.
          if (input.grounded) jump = true;
          vx = this.facing * CRITTER.runSpeed;
        } else vx = this.facing * CRITTER.runSpeed;
        const far = !m || Math.abs(m.dx) >= CRITTER.calmX;
        if (far) {
          this.home = input.x;
          this.enter('idle');
          vx = 0;
        } else if (this.elapsed >= this.duration) {
          this.enter('hidden');
          vanished = true;
          vx = 0;
        }
        break;
      }
      case 'walk': {
        const dir: -1 | 1 = this.target < input.x ? -1 : 1;
        this.facing = dir;
        const probe = dir < 0 ? input.left : input.right;
        const arrived = Math.abs(this.target - input.x) < 3;
        if (arrived || this.elapsed >= this.duration) {
          this.enter('idle');
          break;
        }
        if (probe.wall) {
          if (probe.step) {
            if (input.grounded) jump = true;
            vx = dir * CRITTER.walkSpeed;
          } else this.enter('idle');
        } else if (probe.drop > 0) {
          // Tranquila no baja ni un bloque: da la vuelta.
          this.facing = dir > 0 ? -1 : 1;
          this.enter('idle');
        } else vx = dir * CRITTER.walkSpeed;
        break;
      }
      case 'sniff':
        if (this.elapsed >= this.duration) this.enter('idle');
        break;
      case 'idle':
        if (this.elapsed >= this.duration) {
          const roll = this.random();
          if (roll < 0.6) this.enter('walk');
          else if (roll < 0.85) this.enter('sniff');
          else {
            this.facing = this.facing > 0 ? -1 : 1;
            this.enter('idle');
          }
        }
        break;
    }

    const anim: CritterAnim =
      this.state === 'flee'
        ? 'run'
        : this.state === 'walk'
          ? 'hop'
          : this.state === 'sniff'
            ? 'sniff'
            : 'idle';
    return {
      vx,
      jump,
      facing: this.facing,
      anim,
      visible: this.state !== 'hidden',
      vanished,
    };
  }
}
