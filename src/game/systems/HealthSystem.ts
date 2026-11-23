/** Salud del minero: daño con protección breve, muerte y recuperación. */
export const HEALTH = {
  max: 100,
  /** Protección tras un golpe para no encadenar daño en el mismo instante. */
  invulnerableMs: 600,
  /** Recuperación lenta en aire adecuado (puntos por segundo). */
  regen: 0.5,
} as const;

/** Medios corazones visibles: 5 corazones de 20 HP, medio = 10 HP (redondeo hacia arriba). */
export function heartHalves(hp: number): number {
  return Math.max(0, Math.min(10, Math.ceil(hp / 10)));
}

export type DamageSource =
  | 'derrumbe'
  | 'roca'
  | 'gnomo'
  | 'tronadura'
  | 'aire'
  /** V8: esfuerzo sin energía y desnutrición extrema (daño gradual). */
  | 'agotamiento'
  | 'hambre';
/** Daño continuo: no activa la protección breve ni el empuje. */
const CONTINUOUS: readonly DamageSource[] = ['aire', 'agotamiento', 'hambre'];

export class HealthSystem {
  hp: number = HEALTH.max;
  invulnerableUntil = 0;
  lastSource: DamageSource | null = null;
  lastHitAt = -Infinity;

  get dead(): boolean {
    return this.hp <= 0;
  }

  /**
   * Aplica daño. Los golpes puntuales (derrumbe, roca, tronadura) activan la
   * protección breve; el aire viciado es continuo y no la activa.
   */
  damage(amount: number, now: number, source: DamageSource): number {
    if (this.dead || amount <= 0) return 0;
    const continuous = CONTINUOUS.includes(source);
    if (!continuous && now < this.invulnerableUntil) return 0;
    const taken = Math.min(this.hp, amount);
    this.hp -= taken;
    this.lastSource = source;
    if (!continuous) {
      this.invulnerableUntil = now + HEALTH.invulnerableMs;
      this.lastHitAt = now;
    }
    return taken;
  }

  heal(amount: number): void {
    if (!this.dead) this.hp = Math.min(HEALTH.max, this.hp + amount);
  }

  revive(): void {
    this.hp = HEALTH.max;
    this.invulnerableUntil = 0;
    this.lastSource = null;
    this.lastHitAt = -Infinity;
  }
}
