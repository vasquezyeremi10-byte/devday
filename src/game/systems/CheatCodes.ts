/**
 * Códigos de la partida (tecla |). Disponibles para cualquier jugador:
 * `money` (dinero infinito), `fly` (vuelo con doble espacio), `gnomo` (invoca
 * al gnomo minero) y `desbloquear` (todas las etapas tecnológicas; lo aplica
 * GameSession.unlockAllTiers). Usar un código desactiva los logros de la
 * partida para siempre, aunque luego se apague.
 */
export const CHEAT_CODES = ['money', 'fly', 'gnomo', 'desbloquear'] as const;
export type CheatCode = (typeof CHEAT_CODES)[number];

export interface CheatResult {
  /** El texto era un código de esta lista (aunque no cambiara nada). */
  recognized: boolean;
  changed: boolean;
  message: string;
}

export class CheatCodes {
  private money = false;
  private fly = false;
  /** Se activó algún código alguna vez en esta partida: sin logros. */
  private used = false;

  get infiniteMoney(): boolean {
    return this.money;
  }

  get flight(): boolean {
    return this.fly;
  }

  get achievementsDisabled(): boolean {
    return this.used;
  }

  execute(input: string): CheatResult {
    const code = input.trim().toLowerCase();
    if (!(CHEAT_CODES as readonly string[]).includes(code))
      return { recognized: false, changed: false, message: '' };
    const first = !this.used;
    if (code === 'desbloquear') {
      this.used = true;
      return {
        recognized: true,
        changed: true,
        message: first
          ? 'TODAS LAS ETAPAS DESBLOQUEADAS - LOGROS DESACTIVADOS'
          : 'TODAS LAS ETAPAS DESBLOQUEADAS',
      };
    }
    if (code === 'gnomo') {
      this.used = true;
      return {
        recognized: true,
        changed: true,
        message: first
          ? 'GNOMO MINERO INVOCADO - LOGROS DESACTIVADOS'
          : 'GNOMO MINERO INVOCADO',
      };
    }
    let on: boolean;
    if (code === 'money') on = this.money = !this.money;
    else on = this.fly = !this.fly;
    if (on) this.used = true;
    const label =
      code === 'money'
        ? `DINERO INFINITO: ${on ? 'ACTIVADO' : 'DESACTIVADO'}`
        : `VUELO: ${on ? 'ACTIVADO (2 X ESPACIO)' : 'DESACTIVADO'}`;
    return {
      recognized: true,
      changed: true,
      message: on && first ? `${label} - LOGROS DESACTIVADOS` : label,
    };
  }

  /** Sin datos mientras nunca se usó un código (guardado igual que antes). */
  snapshot(): { money: boolean; fly: boolean; used: true } | undefined {
    return this.used
      ? { money: this.money, fly: this.fly, used: true }
      : undefined;
  }

  restore(value: unknown): void {
    this.money = this.fly = this.used = false;
    if (!value || typeof value !== 'object') return;
    const v = value as Record<string, unknown>;
    this.used = v.used === true;
    // Un código encendido implica logros desactivados aunque falte la marca.
    this.money = v.money === true;
    this.fly = v.fly === true;
    if (this.money || this.fly) this.used = true;
  }
}
