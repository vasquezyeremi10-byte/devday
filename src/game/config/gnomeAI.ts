/**
 * Comportamiento del gnomo minero (systems/GnomeBrain.ts). Distancias en px
 * del mundo, tiempos en ms y velocidades en px/s. Valores de prueba: el
 * gnomo solo aparece con el código `gnomo` de la consola.
 */
export const GNOME_AI = {
  /** Vista hacia delante, hacia atrás (lo nota de cerca) y en altura. */
  sightAhead: 128,
  sightBehind: 40,
  sightHeight: 72,
  /** Oye excavar al minero hasta esta distancia, aun sin verlo. */
  hearing: 176,
  walkSpeed: 26,
  chaseSpeed: 58,
  fleeSpeed: 66,
  /** Furia: más rápido y con menos pausa entre golpes. */
  rageSpeedFactor: 1.25,
  /** Salto para subir un escalón de un bloque (gravedad 600). */
  jumpVelocity: -190,
  /** Caída máxima (en bloques) que acepta al perseguir; patrullando, ninguna. */
  maxChaseDrop: 3,
  patrolRadius: 80,
  /** Reposo antes de elegir otra actividad. */
  idleMs: [1400, 3200],
  patrolMs: [1800, 3600],
  /** Golpes seguidos contra la pared al minar. */
  mineSwings: [2, 3],
  /** Sin ver al minero durante este tiempo, deja de perseguir y busca. */
  lostSightMs: 700,
  searchMs: 2600,
  recoverMs: 420,
  rageRecoverMs: 240,
  /** Tras perder al minero hace poco, al volver a verlo no repite la alerta. */
  alertMemoryMs: 2500,
  rageHpRatio: 0.6,
  fleeHpRatio: 0.3,
  fleeMs: 1800,
  knockback: 90,
  /**
   * Guardia: tras `hits` aturdimientos en `windowMs`, durante `armorMs` los
   * golpes le quitan salud sin interrumpirlo (ni empujarlo). Evita que golpes
   * cada 360 ms lo dejen aturdido sin responder (su «hurt» dura 400 ms). La
   * guardia cubre el aturdimiento del segundo golpe y un ataque completo.
   */
  poise: { hits: 2, windowMs: 1200, armorMs: 1200 },
} as const;
