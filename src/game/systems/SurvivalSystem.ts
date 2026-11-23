import { FOODS, SURVIVAL, type FoodKind } from '../config/survival';

/** Unidades visibles (0..5) de un valor en puntos: cero solo si es cero real. */
export const unitsOf = (points: number): number =>
  Math.max(0, Math.min(SURVIVAL.units, Math.ceil(points / SURVIVAL.unit)));
/** Medias unidades (0..10) para íconos llenos, a medias o vacíos. */
export const halvesOf = (points: number): number =>
  Math.max(
    0,
    Math.min(SURVIVAL.units * 2, Math.ceil(points / (SURVIVAL.unit / 2))),
  );

export const ENERGY_STATE = [
  'AGOTAMIENTO EXTREMO',
  'AGOTADO',
  'CANSADO',
  'CANSANCIO MODERADO',
  'BUEN ESTADO',
  'DESCANSADO',
] as const;
export const HUNGER_STATE = [
  'DESNUTRICION EXTREMA',
  'HAMBRE INTENSA',
  'HAMBRE MODERADA',
  'HAMBRE LEVE',
  'SUFICIENTE',
  'ALIMENTADO',
] as const;

/** Último descanso registrado (tiempo jugado y hora del reloj al despertar). */
export interface SleepRecord {
  playMs: number;
  clockMs: number;
  /** Fase a la que se despertó. */
  woke: 'day' | 'night';
}

export interface SurvivalSnapshot {
  energy: number;
  hunger: number;
  starvingMs: number;
  sleeps: number;
  lastSleep: SleepRecord | null;
  pendingDamage?: { agotamiento: number; hambre: number };
}

export interface Activity {
  /** Caminando sobre el suelo. */
  walking: boolean;
  /** Empujando el carro con carga y en movimiento. */
  pushingLoaded: boolean;
}

/**
 * Energía y alimentación del minero (lógica pura, sin Phaser). No es una
 * segunda barra de salud: el daño que provocan se entrega a HealthSystem a
 * través de `takeDamage`, con su causa.
 *
 * - Los esfuerzos gastan energía; sin energía, el esfuerzo cuesta salud.
 * - El hambre baja con el tiempo y un poco más con el esfuerzo.
 * - Con alimentación en cero, tras una gracia, se pierde salud de a poco y
 *   se detiene al volver a comer.
 * - Dormir recupera toda la energía pero gasta el hambre del tiempo dormido.
 */
export class SurvivalSystem {
  energy: number = SURVIVAL.max;
  hunger: number = SURVIVAL.max;
  /** Tiempo continuo con alimentación en cero. */
  starvingMs = 0;
  sleeps = 0;
  lastSleep: SleepRecord | null = null;
  /** Daño pendiente por causa; la escena lo aplica a la salud. */
  private owed = { agotamiento: 0, hambre: 0 };

  get energyUnits(): number {
    return unitsOf(this.energy);
  }
  get hungerUnits(): number {
    return unitsOf(this.hunger);
  }
  get energyState(): string {
    return ENERGY_STATE[this.energyUnits]!;
  }
  get hungerState(): string {
    return HUNGER_STATE[this.hungerUnits]!;
  }
  get exhausted(): boolean {
    return this.energy <= 0;
  }
  get starving(): boolean {
    return this.hunger <= 0;
  }
  /** La salud solo se recupera sola con energía y alimentación. */
  get regenAllowed(): boolean {
    return !this.exhausted && !this.starving;
  }
  /** Movilidad: un poco más lento con una unidad o menos de energía. */
  get speedFactor(): number {
    if (this.exhausted) return SURVIVAL.exhaustedSpeed;
    return this.energyUnits <= 1 ? SURVIVAL.tiredSpeed : 1;
  }

  /**
   * Esfuerzo: gasta energía y algo de hambre. Lo que no alcanza a pagar la
   * energía se convierte en daño por agotamiento (nunca muerte inmediata).
   */
  exert(points: number): void {
    if (!(points > 0)) return;
    const paid = Math.min(this.energy, points);
    this.energy -= paid;
    this.owed.agotamiento +=
      (points - paid) * SURVIVAL.exhaustionDamagePerPoint;
    this.hunger = Math.max(
      0,
      this.hunger - points * SURVIVAL.hungerPerEffort,
    );
  }

  /** Paso de tiempo de juego (sin pausa ni pestaña oculta). */
  tick(dtMs: number, activity: Activity): void {
    if (!(dtMs > 0)) return;
    const seconds = dtMs / 1000;
    if (activity.pushingLoaded) this.continuous(SURVIVAL.cartPerSecond * seconds);
    else if (activity.walking)
      this.continuous(SURVIVAL.walkPerSecond * seconds);
    const fedMs = (this.hunger / SURVIVAL.hungerPerSecond) * 1000;
    this.hunger = Math.max(0, this.hunger - SURVIVAL.hungerPerSecond * seconds);
    if (this.starving) {
      const before = this.starvingMs;
      this.starvingMs += Math.max(0, dtMs - fedMs);
      const hurting = Math.max(
        0,
        this.starvingMs - Math.max(before, SURVIVAL.starveGraceMs),
      );
      this.owed.hambre += (hurting / 1000) * SURVIVAL.starveDamagePerSecond;
    } else this.starvingMs = 0;
  }

  /** Esfuerzo continuo (caminar, empujar): sin hambre extra por esfuerzo. */
  private continuous(points: number): void {
    const paid = Math.min(this.energy, points);
    this.energy -= paid;
    this.owed.agotamiento +=
      (points - paid) * SURVIVAL.exhaustionDamagePerPoint;
  }

  /** Daño acumulado desde la última consulta, por causa. */
  takeDamage(wholePoints = false): { agotamiento: number; hambre: number } {
    if (wholePoints) {
      const agotamiento = Math.floor(this.owed.agotamiento + 1e-9);
      const hambre = Math.floor(this.owed.hambre + 1e-9);
      this.owed.agotamiento = Math.max(0, this.owed.agotamiento - agotamiento);
      this.owed.hambre = Math.max(0, this.owed.hambre - hambre);
      return { agotamiento, hambre };
    }
    const owed = this.owed;
    this.owed = { agotamiento: 0, hambre: 0 };
    return owed;
  }

  /** ¿El alimento serviría ahora? null si sí; si no, el motivo. */
  canConsume(kind: FoodKind): string | null {
    const f = FOODS[kind];
    // Curaciones (botiquín): la salud la comprueba GameSession.eat.
    if (!f.energy && !f.hunger) return null;
    const useful =
      (f.energy > 0 && this.energy < SURVIVAL.max) ||
      (f.hunger > 0 && this.hunger < SURVIVAL.max);
    if (useful) return null;
    return f.drink ? 'TIENES TODA TU ENERGIA' : 'ESTAS SATISFECHO';
  }

  /** Aplica un alimento sin superar el máximo; devuelve lo recuperado. */
  consume(kind: FoodKind): { energy: number; hunger: number } {
    const f = FOODS[kind];
    const energy = Math.min(f.energy, SURVIVAL.max - this.energy);
    const hunger = Math.min(f.hunger, SURVIVAL.max - this.hunger);
    this.energy += energy;
    this.hunger += hunger;
    if (!this.starving) this.starvingMs = 0;
    return { energy, hunger };
  }

  /** Con hambre extrema no se puede dormir: primero hay que comer. */
  canSleep(): string | null {
    return this.starving
      ? 'TIENES DEMASIADA HAMBRE PARA DORMIR. COME ALGO PRIMERO'
      : null;
  }

  /**
   * Descanso: energía completa. El tiempo dormido sí gasta alimentación
   * (al ritmo normal), así que dormir seguido no evita tener que comer.
   */
  sleep(skippedMs: number, record: SleepRecord): void {
    this.energy = SURVIVAL.max;
    const cost =
      (Math.max(0, skippedMs) / 1000) * SURVIVAL.hungerPerSecond;
    this.hunger = Math.max(0, this.hunger - cost);
    this.starvingMs = 0;
    this.owed.agotamiento = 0;
    this.sleeps++;
    this.lastSleep = { ...record };
  }

  snapshot(): SurvivalSnapshot {
    return {
      energy: Math.round(this.energy * 100) / 100,
      hunger: Math.round(this.hunger * 100) / 100,
      starvingMs: Math.round(this.starvingMs),
      sleeps: this.sleeps,
      lastSleep: this.lastSleep,
      pendingDamage: { ...this.owed },
    };
  }

  /** Datos guardados; lo ausente o inválido queda en su valor inicial. */
  restore(data: unknown): void {
    const d = (data ?? {}) as Partial<SurvivalSnapshot>;
    const points = (v: unknown) =>
      typeof v === 'number' && Number.isFinite(v)
        ? Math.max(0, Math.min(SURVIVAL.max, v))
        : SURVIVAL.max;
    this.energy = points(d.energy);
    this.hunger = points(d.hunger);
    this.owed = {
      agotamiento: this.pendingPoints(d.pendingDamage?.agotamiento),
      hambre: this.pendingPoints(d.pendingDamage?.hambre),
    };
    this.starvingMs =
      typeof d.starvingMs === 'number' && Number.isFinite(d.starvingMs)
        ? Math.max(0, Math.min(1e9, d.starvingMs))
        : 0;
    if (this.hunger > 0) this.starvingMs = 0;
    this.sleeps =
      Number.isInteger(d.sleeps) && (d.sleeps as number) >= 0
        ? (d.sleeps as number)
        : 0;
    const l = d.lastSleep;
    this.lastSleep =
      l &&
      Number.isFinite(l.playMs) &&
      Number.isFinite(l.clockMs) &&
      (l.woke === 'day' || l.woke === 'night')
        ? { playMs: l.playMs, clockMs: l.clockMs, woke: l.woke }
        : null;
  }

  private pendingPoints(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(SURVIVAL.max, value))
      : 0;
  }
}
