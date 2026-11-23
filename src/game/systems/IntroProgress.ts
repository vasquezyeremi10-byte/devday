import { INTRO_STEPS, type IntroStep } from '../config/intro';

/** Lo que el tutorial necesita saber del juego para avanzar por sí solo. */
export interface IntroContext {
  /** Tiene una picota y una pala utilizables. */
  hasTools: boolean;
  /** Tiene el equipo de seguridad completo. */
  kitReady: boolean;
  /** Bloques excavados en total (GameSession.stats.mined). */
  mined: number;
}

export interface IntroSnapshot {
  step: IntroStep;
  minedBase: number;
  hintsOff: boolean;
  /** Se leyó el libro: la tabla del piso queda abierta con el libro dentro. */
  completed: boolean;
}

const index = (step: IntroStep) => INTRO_STEPS.indexOf(step);

/**
 * Progreso de «La herencia del abuelo». Es lineal y tolerante: los pasos que
 * dependen de lo que el jugador ya tiene (herramientas, equipo, excavación)
 * se completan solos si ya se cumplieron; el resto avanza por eventos.
 *
 * Un `IntroProgress` nuevo está en `done` (partidas anteriores y pruebas):
 * solo una partida nueva lo inicia con `start()`.
 */
export class IntroProgress {
  step: IntroStep = 'done';
  /** Bloques excavados al llegar a «dig»: la primera extracción es una más. */
  minedBase = 0;
  /** El jugador ocultó la guía (objetivo y flecha); los diálogos siguen. */
  hintsOff = false;
  /**
   * La secuencia se jugó completa. Distingue «terminó» de «nunca hubo» (ambos
   * están en `done`): solo quien la jugó tiene el hueco abierto en el piso.
   */
  completed = false;

  get active(): boolean {
    return this.step !== 'done';
  }

  /** ¿Ya se pasó (o se está en) `step`? */
  reached(step: IntroStep): boolean {
    return index(this.step) >= index(step);
  }

  start(): void {
    this.step = 'welcome';
    this.minedBase = 0;
    this.hintsOff = false;
    this.completed = false;
  }

  private go(from: IntroStep, to: IntroStep): boolean {
    if (this.step !== from) return false;
    this.step = to;
    return true;
  }

  /** Terminó (o se omitió) el diálogo de bienvenida. */
  welcomeDone(): boolean {
    return this.go('welcome', 'tools');
  }
  /** Se abrió el cajón de herramientas. */
  toolsFound(): boolean {
    return this.go('tools', 'kit');
  }
  /** Se inspeccionó la entrada de la mina. */
  mineInspected(minedNow: number): boolean {
    this.minedBase = minedNow;
    return this.go('mine', 'dig');
  }
  /** Se entró a la cabaña de nuevo. */
  cabinEntered(): boolean {
    return this.go('home', 'board');
  }
  /** Se examinó la tabla suelta. */
  boardExamined(): boolean {
    return this.go('board', 'book');
  }
  /** Se leyó la primera página del libro: fin de la secuencia. */
  bookRead(): boolean {
    const ok = this.go('book', 'done');
    if (ok) this.completed = true;
    return ok;
  }

  /** Estado de la tabla suelta del piso según el progreso. */
  get boardState(): 'hidden' | 'loose' | 'open' {
    if (this.step === 'board') return 'loose';
    if (this.step === 'book' || this.completed) return 'open';
    return 'hidden';
  }

  /**
   * Pasos que se completan por el estado del juego. Devuelve el paso nuevo si
   * hubo cambio (puede encadenar varios).
   */
  update(ctx: IntroContext): IntroStep | null {
    const before = this.step;
    for (let guard = 0; guard < INTRO_STEPS.length; guard++) {
      if (this.step === 'tools' && ctx.hasTools) this.step = 'kit';
      else if (this.step === 'kit' && ctx.kitReady) this.step = 'mine';
      else if (this.step === 'dig' && ctx.mined > this.minedBase)
        this.step = 'home';
      else break;
    }
    return this.step === before ? null : this.step;
  }

  /** Sin guía: el jugador la desactiva con T y puede volver a activarla. */
  toggleHints(): boolean {
    this.hintsOff = !this.hintsOff;
    return !this.hintsOff;
  }

  snapshot(): IntroSnapshot {
    return {
      step: this.step,
      minedBase: this.minedBase,
      hintsOff: this.hintsOff,
      completed: this.completed,
    };
  }

  /** Datos ausentes o inválidos = sin tutorial (partidas anteriores). */
  restore(data: unknown): void {
    const d = data as Partial<IntroSnapshot> | null | undefined;
    if (
      !d ||
      typeof d !== 'object' ||
      !INTRO_STEPS.includes(d.step as IntroStep)
    ) {
      this.step = 'done';
      this.minedBase = 0;
      this.hintsOff = false;
      this.completed = false;
      return;
    }
    this.step = d.step as IntroStep;
    this.completed = d.completed === true && this.step === 'done';
    this.minedBase =
      Number.isInteger(d.minedBase) && d.minedBase! >= 0 ? d.minedBase! : 0;
    this.hintsOff = d.hintsOff === true;
  }
}
