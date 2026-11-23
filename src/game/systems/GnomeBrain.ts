import { GNOME_AI } from '../config/gnomeAI';
import {
  GNOME_ANIMATIONS,
  GNOME_IMPACT_FRAME,
  gnomeClipMs,
  gnomeFrameAt,
  type GnomeAnimation,
} from '../config/gnomeAnimations';
import type { Probe } from './GnomeSenses';

/**
 * Estados del gnomo. Ciclo de combate IDLE → PATROL → ALERT → CHASE →
 * ATTACK → RECOVER; además MINE, SEARCH, HURT, FLEE y DEATH, y dos de apoyo:
 * LOOK (mirar a ambos lados) y RAGE (enfurecerse al quedar malherido).
 */
export type GnomeState =
  | 'IDLE'
  | 'PATROL'
  | 'ALERT'
  | 'CHASE'
  | 'ATTACK'
  | 'RECOVER'
  | 'MINE'
  | 'SEARCH'
  | 'HURT'
  | 'FLEE'
  | 'DEATH'
  | 'LOOK'
  | 'RAGE';

/** Lo que percibe el gnomo en este fotograma (calculado por GnomeSenses). */
export interface GnomeInput {
  dt: number;
  x: number;
  grounded: boolean;
  /** x del minero si lo ve; null si no. */
  seen: number | null;
  /** La picota alcanzaría al minero si golpeara ahora. */
  inReach: boolean;
  left: Probe;
  right: Probe;
}

export interface GnomeOutput {
  vx: number;
  jump: boolean;
  facing: -1 | 1;
  /** Cuadro de impacto del ataque: la escena comprueba la caja de golpe. */
  strike: boolean;
  /** Cuadro de impacto contra la pared (esquirlas y sonido, sin excavar). */
  mineHit: boolean;
  animation: GnomeAnimation;
  frame: number;
  /** La muerte terminó: retirar el gnomo. */
  done: boolean;
}

const CALM: readonly GnomeState[] = [
  'IDLE',
  'PATROL',
  'LOOK',
  'MINE',
  'SEARCH',
];

const ANIMATION: Record<GnomeState, GnomeAnimation> = {
  IDLE: 'idle',
  PATROL: 'walk',
  ALERT: 'alert',
  CHASE: 'run',
  ATTACK: 'attack',
  RECOVER: 'idle',
  MINE: 'mine',
  SEARCH: 'walk',
  HURT: 'hurt',
  FLEE: 'run',
  DEATH: 'death',
  LOOK: 'look',
  RAGE: 'rage',
};

const between = (random: () => number, [a, b]: readonly [number, number]) =>
  a + (b - a) * random();

/**
 * Máquina de estados pura del gnomo minero: sin Phaser, con reloj propio
 * (la escena le pasa dt y lo detiene en pausa). El cuadro visible sale del
 * mismo reloj, así el golpe ocurre exactamente en el cuadro de impacto.
 */
export class GnomeBrain {
  state: GnomeState = 'IDLE';
  facing: -1 | 1 = 1;
  /** Tiempo en el estado actual. */
  elapsed = 0;
  /** Última posición conocida del minero (o de un ruido). */
  lastKnown: number | null = null;
  home: number;
  enraged = false;
  fled = false;
  private anim: GnomeAnimation = 'idle';
  private animClock = 0;
  private duration = 0;
  private impactSent = false;
  private swingsLeft = 0;
  private unseenMs = 0;
  /** Último instante (reloj propio) en que vio al minero. */
  private lastSeenAt = -Infinity;
  private clock = 0;
  private turned = false;
  private arrived = false;
  private hpRatio = 1;
  /** Instantes (reloj propio) de los aturdimientos recientes. */
  private staggers: number[] = [];
  /** Guardia alzada hasta este instante: los golpes no lo interrumpen. */
  private armorUntil = -Infinity;
  private readonly random: () => number;

  constructor(x: number, random: () => number = Math.random) {
    this.home = x;
    this.random = random;
    this.enter('IDLE');
  }

  get dead(): boolean {
    return this.state === 'DEATH';
  }

  /** Ruido de excavación cercano: si está tranquilo, va a inspeccionarlo. */
  hear(x: number): void {
    if (!CALM.includes(this.state)) return;
    this.lastKnown = x;
    if (this.state !== 'SEARCH') this.enter('SEARCH');
  }

  /** Guardia alzada: los golpes le quitan salud sin interrumpirlo. */
  get armored(): boolean {
    return this.clock < this.armorUntil;
  }

  /**
   * Recibe un golpe dado desde `fromX` estando en `x`; `hpRatio` es la salud
   * que le queda (0–1). Devuelve true si el golpe lo aturde (se vuelve hacia
   * el agresor y entra en HURT o DEATH); con la guardia alzada solo pierde
   * salud y sigue con lo suyo, salvo que el golpe lo mate, lo enfurezca o lo
   * haga huir.
   */
  hurt(fromX: number, x: number, hpRatio: number): boolean {
    if (this.dead) return false;
    this.lastKnown = fromX;
    const turning =
      (hpRatio <= GNOME_AI.fleeHpRatio && !this.fled) ||
      (hpRatio <= GNOME_AI.rageHpRatio && !this.enraged);
    this.hpRatio = hpRatio;
    if (hpRatio > 0 && this.armored && !turning) return false;
    this.face(fromX - x);
    if (hpRatio <= 0) {
      this.enter('DEATH');
      return true;
    }
    const { hits, windowMs, armorMs } = GNOME_AI.poise;
    this.staggers = this.staggers.filter((t) => this.clock - t <= windowMs);
    this.staggers.push(this.clock);
    if (this.staggers.length >= hits) {
      this.staggers = [];
      this.armorUntil = this.clock + armorMs;
    }
    this.enter('HURT');
    return true;
  }

  /** Orienta hacia una x relativa a la posición del gnomo. */
  private face(dx: number): void {
    if (dx) this.facing = dx < 0 ? -1 : 1;
  }

  private enter(state: GnomeState): void {
    this.state = state;
    this.elapsed = 0;
    this.impactSent = false;
    this.turned = false;
    this.arrived = false;
    this.unseenMs = 0;
    switch (state) {
      case 'IDLE':
        this.duration = between(this.random, GNOME_AI.idleMs);
        break;
      case 'PATROL':
        this.duration = between(this.random, GNOME_AI.patrolMs);
        break;
      case 'SEARCH':
        this.duration = GNOME_AI.searchMs;
        break;
      case 'FLEE':
        this.duration = GNOME_AI.fleeMs;
        break;
      case 'RECOVER':
        this.duration = this.enraged
          ? GNOME_AI.rageRecoverMs
          : GNOME_AI.recoverMs;
        break;
      case 'LOOK':
        this.duration = gnomeClipMs('look');
        break;
      case 'MINE':
        this.swingsLeft = Math.round(between(this.random, GNOME_AI.mineSwings));
        this.duration = gnomeClipMs('mine');
        break;
      default:
        this.duration = gnomeClipMs(ANIMATION[state]);
    }
    this.play(ANIMATION[state]);
  }

  private play(anim: GnomeAnimation): void {
    this.anim = anim;
    this.animClock = 0;
  }

  /**
   * Avanza hacia `dir` respetando la mina: salta escalones de un bloque si se
   * le permite, se detiene ante paredes y ante caídas mayores que `maxDrop`.
   * Devuelve la velocidad y si quedó bloqueado.
   */
  private move(
    input: GnomeInput,
    dir: -1 | 1,
    speed: number,
    canJump: boolean,
    maxDrop: number,
  ): { vx: number; jump: boolean; blocked: boolean } {
    this.facing = dir;
    const probe = dir < 0 ? input.left : input.right;
    if (probe.wall) {
      if (canJump && probe.step && input.grounded)
        return { vx: dir * speed, jump: true, blocked: false };
      return { vx: 0, jump: false, blocked: !probe.step || !canJump };
    }
    if (probe.drop > maxDrop) return { vx: 0, jump: false, blocked: true };
    return { vx: dir * speed, jump: false, blocked: false };
  }

  tick(input: GnomeInput): GnomeOutput {
    const dt = Math.min(Math.max(input.dt, 0), 100);
    this.elapsed += dt;
    this.animClock += dt;
    this.clock += dt;
    const sees = input.seen !== null;
    if (sees) this.lastKnown = input.seen;
    const toPlayer = sees ? input.seen! - input.x : 0;
    let vx = 0;
    let jump = false;
    let strike = false;
    let mineHit = false;
    let done = false;
    const speedFactor = this.enraged ? GNOME_AI.rageSpeedFactor : 1;

    // Ver al minero interrumpe cualquier actividad tranquila.
    if (sees && CALM.includes(this.state)) {
      this.face(toPlayer);
      const remembered = this.clock - this.lastSeenAt <= GNOME_AI.alertMemoryMs;
      this.enter(remembered ? 'CHASE' : 'ALERT');
    }
    if (sees) this.lastSeenAt = this.clock;

    switch (this.state) {
      case 'DEATH':
        done = this.elapsed >= this.duration;
        break;
      case 'HURT':
        if (this.elapsed >= this.duration) {
          if (this.hpRatio <= GNOME_AI.fleeHpRatio && !this.fled) {
            this.fled = true;
            this.enter('FLEE');
          } else if (this.hpRatio <= GNOME_AI.rageHpRatio && !this.enraged) {
            this.enraged = true;
            this.enter('RAGE');
          } else this.enter(sees ? 'CHASE' : 'SEARCH');
        }
        break;
      case 'RAGE':
        if (sees) this.face(toPlayer);
        if (this.elapsed >= this.duration)
          this.enter(sees ? 'CHASE' : 'SEARCH');
        break;
      case 'ALERT':
        if (sees) this.face(toPlayer);
        if (this.elapsed >= this.duration)
          this.enter(sees ? 'CHASE' : 'SEARCH');
        break;
      case 'CHASE': {
        if (!sees) {
          this.unseenMs += dt;
          if (this.unseenMs >= GNOME_AI.lostSightMs) {
            this.enter('SEARCH');
            break;
          }
        } else this.unseenMs = 0;
        if (sees && input.inReach) {
          this.face(toPlayer);
          this.enter('ATTACK');
          break;
        }
        const target = sees ? toPlayer : (this.lastKnown ?? input.x) - input.x;
        if (Math.abs(target) < 4) break;
        const step = this.move(
          input,
          target < 0 ? -1 : 1,
          GNOME_AI.chaseSpeed * speedFactor,
          true,
          GNOME_AI.maxChaseDrop,
        );
        vx = step.vx;
        jump = step.jump;
        break;
      }
      case 'ATTACK':
        if (
          !this.impactSent &&
          this.frameOf('attack') >= GNOME_IMPACT_FRAME.attack
        ) {
          this.impactSent = true;
          strike = true;
        }
        if (this.elapsed >= this.duration) this.enter('RECOVER');
        break;
      case 'RECOVER':
        if (sees) this.face(toPlayer);
        if (this.elapsed >= this.duration) {
          if (sees && input.inReach) this.enter('ATTACK');
          else this.enter(sees ? 'CHASE' : 'SEARCH');
        }
        break;
      case 'FLEE': {
        const from = this.lastKnown ?? input.x - this.facing;
        const away: -1 | 1 = input.x - from < 0 ? -1 : 1;
        const step = this.move(
          input,
          away,
          GNOME_AI.fleeSpeed,
          true,
          GNOME_AI.maxChaseDrop,
        );
        vx = step.vx;
        jump = step.jump;
        // Acorralado o ya lejos: vuelve a enfrentar al minero.
        if (step.blocked || this.elapsed >= this.duration) {
          if (sees) {
            this.face(toPlayer);
            this.enter(input.inReach ? 'ATTACK' : 'CHASE');
          } else this.enter('SEARCH');
        }
        break;
      }
      case 'SEARCH': {
        const target = (this.lastKnown ?? input.x) - input.x;
        if (!this.arrived && Math.abs(target) < 6) this.arrived = true;
        if (!this.arrived) {
          const step = this.move(
            input,
            target < 0 ? -1 : 1,
            GNOME_AI.walkSpeed * 1.4,
            true,
            1,
          );
          vx = step.vx;
          jump = step.jump;
          this.arrived = step.blocked;
        }
        if (this.arrived) {
          // Llegó (o no puede seguir): mira a ambos lados.
          vx = 0;
          if (this.anim !== 'look') this.play('look');
          if (!this.turned && this.animClock >= gnomeClipMs('look') / 2) {
            this.turned = true;
            this.facing = this.facing === 1 ? -1 : 1;
          }
        } else if (this.anim !== 'walk') this.play('walk');
        if (this.elapsed >= this.duration) {
          this.home = input.x;
          this.lastKnown = null;
          this.enter('IDLE');
        }
        break;
      }
      case 'PATROL': {
        const far = input.x - this.home;
        if (
          Math.abs(far) > GNOME_AI.patrolRadius &&
          Math.sign(far) === this.facing
        )
          this.facing = this.facing === 1 ? -1 : 1;
        const probe = this.facing < 0 ? input.left : input.right;
        const step = this.move(
          input,
          this.facing,
          GNOME_AI.walkSpeed,
          false,
          0,
        );
        vx = step.vx;
        if (step.blocked) {
          // Pared delante: a veces la examina y la pica; si no, da la vuelta.
          if (probe.wall && this.random() < 0.5) this.enter('MINE');
          else {
            this.facing = this.facing === 1 ? -1 : 1;
            this.enter('IDLE');
          }
        } else if (this.elapsed >= this.duration) this.enter('IDLE');
        break;
      }
      case 'MINE':
        if (
          !this.impactSent &&
          this.frameOf('mine') >= GNOME_IMPACT_FRAME.mine
        ) {
          this.impactSent = true;
          mineHit = true;
        }
        if (this.elapsed >= this.duration) {
          this.swingsLeft--;
          if (this.swingsLeft > 0) {
            this.elapsed = 0;
            this.impactSent = false;
            this.play('mine');
          } else {
            this.facing = this.facing === 1 ? -1 : 1;
            this.enter('IDLE');
          }
        }
        break;
      case 'LOOK':
        if (!this.turned && this.elapsed >= this.duration / 2) {
          this.turned = true;
          this.facing = this.facing === 1 ? -1 : 1;
        }
        if (this.elapsed >= this.duration) this.enter('IDLE');
        break;
      case 'IDLE': {
        // Cada vuelta del reposo elige respirar o parpadear (no siempre igual).
        if (this.animClock >= gnomeClipMs(this.anim))
          this.play(this.random() < 0.35 ? 'idleBlink' : 'idle');
        if (this.elapsed >= this.duration) {
          const wall = (this.facing < 0 ? input.left : input.right).wall;
          const roll = this.random();
          if (wall && roll < 0.45) this.enter('MINE');
          else if (roll < 0.7) {
            if (this.random() < 0.4) this.facing = this.facing === 1 ? -1 : 1;
            this.enter('PATROL');
          } else this.enter('LOOK');
        }
        break;
      }
    }
    if (this.state === 'RECOVER' && this.animClock >= gnomeClipMs(this.anim))
      this.play(this.random() < 0.35 ? 'idleBlink' : 'idle');
    return {
      vx,
      jump,
      facing: this.facing,
      strike,
      mineHit,
      animation: this.anim,
      frame: gnomeFrameAt(this.anim, this.animClock),
      done,
    };
  }

  private frameOf(anim: GnomeAnimation): number {
    const clip = GNOME_ANIMATIONS[anim];
    return Math.min(
      clip.count - 1,
      Math.floor((this.animClock * clip.fps) / 1000),
    );
  }
}
