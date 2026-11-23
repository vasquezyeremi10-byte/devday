/**
 * Sprint: mantener Shift izquierdo multiplica la velocidad horizontal del
 * minero. Se aplica sobre la velocidad normal (y sobre la reducción por aire
 * viciado o cansancio, que sigue mandando). No consume energía nueva: la
 * mecánica de cansancio existente (SurvivalSystem) ya frena al minero.
 */
export const SPRINT = {
  /** Veces la velocidad normal al correr. */
  factor: 1.6,
  /** `KeyboardEvent.code` del Shift que activa el sprint (solo el izquierdo). */
  code: 'ShiftLeft',
} as const;
