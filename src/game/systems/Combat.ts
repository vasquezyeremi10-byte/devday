import type { ToolKind } from '../config/balance';

export const GNOME = {
  hp: 90,
  speed: 54,
  reach: 24,
  hit: 12,
  attackMs: 1100,
  playerReach: 31,
  playerAttackMs: 360,
} as const;

export const weaponDamage = (tool: ToolKind | undefined): number => {
  switch (tool) {
    case 'tungsten':
      return 24;
    case 'axe':
      return 20;
    case 'iron':
      return 18;
    case 'shovel':
      return 12;
    case 'drill':
      return 16;
    default:
      return 7;
  }
};

/**
 * Respuesta del combate del minero (18 de noviembre de 2026). Todo es
 * visual o de respuesta al control: el daño, el alcance y la cadencia de
 * GNOME no cambian, y el golpe sigue aplicándose al pulsar.
 */
export const STRIKE_FEEL = {
  /** Una pulsación de J hecha hasta este margen antes de poder golpear se guarda. */
  bufferMs: 120,
  /** Temblor de cámara al conectar (más suave que la tronadura). */
  shakeMs: 90,
  shakeIntensity: 0.003,
  /** Destello opaco del minero al recibir un golpe. */
  flashMs: 70,
  /** Empuje horizontal del minero golpeado: se suma al control y se apaga solo. */
  knockback: 150,
  knockbackMs: 200,
} as const;

/**
 * Cadencia del golpe del minero con pulsación guardada: si J llega un poco
 * antes de tiempo, el golpe sale en cuanto termina la espera en vez de
 * perderse. No añade espera: la cadencia sigue siendo `playerAttackMs`.
 */
export class AttackTimer {
  private readyAt = 0;
  private bufferedAt = -Infinity;

  constructor(
    private readonly cooldownMs: number = GNOME.playerAttackMs,
    private readonly bufferMs: number = STRIKE_FEEL.bufferMs,
  ) {}

  /** Pulsación de J: true si el golpe sale ahora; si no, queda guardada. */
  press(now: number): boolean {
    if (now >= this.readyAt) return this.fire(now);
    this.bufferedAt = now;
    return false;
  }

  /** Cada cuadro: true si una pulsación guardada sale ahora. */
  poll(now: number): boolean {
    if (now < this.readyAt || now - this.bufferedAt > this.bufferMs)
      return false;
    return this.fire(now);
  }

  reset(): void {
    this.readyAt = 0;
    this.bufferedAt = -Infinity;
  }

  private fire(now: number): boolean {
    this.readyAt = now + this.cooldownMs;
    this.bufferedAt = -Infinity;
    return true;
  }
}

/** Velocidad del empuje a `elapsedMs` de empezar: cae en línea recta a 0. */
export function knockbackVelocity(
  start: number,
  elapsedMs: number,
  durationMs: number = STRIKE_FEEL.knockbackMs,
): number {
  if (elapsedMs < 0 || elapsedMs >= durationMs) return 0;
  return Math.round(start * (1 - elapsedMs / durationMs));
}

/** Solo recibe el golpe un objetivo cercano, visible y frente al minero. */
export function canHitGnome(
  playerX: number,
  playerY: number,
  facing: -1 | 1,
  targetX: number,
  targetY: number,
): boolean {
  const dx = targetX - playerX;
  return (
    dx * facing >= -4 &&
    Math.abs(dx) <= GNOME.playerReach &&
    Math.abs(targetY - playerY) <= 22
  );
}
