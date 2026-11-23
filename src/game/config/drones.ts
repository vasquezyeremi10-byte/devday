/**
 * Pedidos del celular entregados por dron (sin NPC). Los tiempos de vuelo son
 * solo visuales; la espera de 20 s es real (reloj del sistema, se conserva al
 * guardar y cargar).
 */
export const DRONE = {
  /** Espera real entre pagar y el despegue del dron (ms). */
  waitMs: 20_000,
  /** Pedidos pagados que pueden esperar o volar a la vez (cola). */
  maxPending: 3,
  /**
   * Puntos de entrega (x del mundo, centro de la caja) junto a la cabaña, a
   * su izquierda, en el suelo fijo del campamento (y = 160): columnas
   * negativas que no se excavan ni admiten bloques, sin estructuras sólidas.
   * Una caja por punto; con todos ocupados el siguiente dron espera.
   */
  slots: [-392, -408, -424, -508, -524, -540],
  groundY: 160,
  /** Fases del vuelo (ms) y alturas sobre el suelo (px). */
  flight: {
    approachMs: 3600,
    descendMs: 1600,
    dropMs: 700,
    leaveMs: 3000,
    /** Altura de llegada sobre el punto antes de bajar (bajo la franja de avisos del HUD). */
    hover: 44,
    /** Altura y distancia horizontal de entrada y salida. */
    cruise: 130,
    reach: 280,
  },
} as const;

export const DRONE_FLIGHT_MS =
  DRONE.flight.approachMs +
  DRONE.flight.descendMs +
  DRONE.flight.dropMs +
  DRONE.flight.leaveMs;
