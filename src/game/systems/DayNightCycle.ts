/**
 * Reloj ambiental V7 (lógica pura, sin Phaser). Solo avanza con tiempo de
 * simulación autorizado (`tick`), nunca por fotogramas: a 30 o 144 FPS el
 * ciclo dura lo mismo, y con pausa o pestaña oculta no avanza.
 *
 * Ciclo de 10 minutos: 5 de día (amanecer, día pleno, atardecer) y 5 de
 * noche. Sol, luna, cielo, estrellas, fauna, faroles y luz exterior leen el
 * mismo reloj, así que siempre están sincronizados.
 */
export const DAY_MS = 300_000;
export const NIGHT_MS = 300_000;
export const CYCLE_MS = DAY_MS + NIGHT_MS;
export const HALF_CYCLE_MS = DAY_MS;
/** Amanecer y atardecer: 45 s cada uno, dentro de los 5 minutos de día. */
export const TWILIGHT_MS = 45_000;
/** Luz exterior de noche (luna): oscura, nunca negra. */
export const NIGHT_LIGHT = 0.42;
/**
 * Hora de una expedición nueva (y de partidas anteriores a V7, sin reloj):
 * mañana ya iluminada, para no empezar a oscuras.
 */
export const START_MS = 60_000;

export type DayPhase = 'dawn' | 'day' | 'sunset' | 'night';

/** Tinte de luna (mundo) y versión más suave para personajes. */
export const MOON_TINT = 0x6c7bbd;
export const MOON_TINT_SOFT = 0xa3b0e4;
/** Tinte cálido del ocaso y del amanecer en su punto máximo. */
export const DUSK_TINT = 0xffb38a;
export const DAWN_TINT = 0xffc0c4;
/** Niveles de tinte: cambia en escalones, no en cada fotograma. */
export const TINT_STEPS = 16;

const lerp = (a: number, b: number, t: number) => {
  const ch = (shift: number) =>
    Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => {
  const v = clamp01(t);
  return v * v * (3 - 2 * v);
};

/** Recorrido de un astro sobre la vista de 480 × 270 (p de 0 a 1). */
const arc = (p: number) => ({
  x: Math.round(28 + p * 424),
  y: Math.round(137 - Math.sin(p * Math.PI) * 96),
});

export class DayNightCycle {
  elapsedMs = START_MS;
  /**
   * Tiempo de juego acumulado (ms), que nunca da la vuelta: avanza con el
   * mismo `tick` y con el salto de dormir, así que un «día del juego» son
   * exactamente `CYCLE_MS` (10 min de reloj de simulación) y la caducidad de
   * los alimentos se mide contra él, no contra horas reales. No cambia la
   * velocidad del ciclo.
   */
  totalMs = START_MS;

  /** Avanza el reloj; `paused` respeta la pausa real del juego. */
  tick(dtMs: number, paused = false): void {
    if (!paused && Number.isFinite(dtMs) && dtMs > 0) {
      const step = Math.min(dtMs, 1000);
      this.elapsedMs = (this.elapsedMs + step) % CYCLE_MS;
      this.totalMs += step;
    }
  }

  /**
   * Recupera el reloj guardado; sin valor válido, empieza en la mañana. El
   * acumulado (`total`) debe ser coherente con la hora del día; sin él (o con
   * uno incoherente) se reconstruye a partir de la hora.
   */
  restore(value: unknown, total?: unknown): void {
    this.elapsedMs =
      typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? value % CYCLE_MS
        : START_MS;
    // Coherente = la misma hora del día (con tolerancia de 1 ms, también al
    // dar la vuelta del ciclo).
    const gap =
      typeof total === 'number' && Number.isFinite(total)
        ? Math.abs((total % CYCLE_MS) - this.elapsedMs)
        : Infinity;
    const ok =
      typeof total === 'number' &&
      total >= this.elapsedMs &&
      (gap < 1 || Math.abs(gap - CYCLE_MS) < 1);
    this.totalMs = ok ? (total as number) : this.elapsedMs;
  }

  /** Día del juego en curso (1 = el primero). */
  get day(): number {
    return Math.floor(this.totalMs / CYCLE_MS) + 1;
  }

  /** ¿Es de día (amanecer, día pleno o atardecer)? */
  get isDay(): boolean {
    return this.elapsedMs < DAY_MS;
  }

  /**
   * V8, dormir: adelanta el reloj al comienzo de la fase opuesta (de día, al
   * anochecer; de noche, al amanecer) y devuelve los milisegundos saltados.
   * El ciclo sigue normal desde la nueva hora.
   */
  skipToNextPhase(): { skippedMs: number; woke: 'day' | 'night' } {
    if (this.isDay) {
      const skippedMs = DAY_MS - this.elapsedMs;
      this.elapsedMs = DAY_MS;
      this.totalMs += skippedMs;
      return { skippedMs, woke: 'night' };
    }
    const skippedMs = CYCLE_MS - this.elapsedMs;
    this.elapsedMs = 0;
    this.totalMs += skippedMs;
    return { skippedMs, woke: 'day' };
  }

  /** 0..1 a lo largo del ciclo completo. */
  get progress(): number {
    return this.elapsedMs / CYCLE_MS;
  }

  get phase(): DayPhase {
    const t = this.elapsedMs;
    return t < TWILIGHT_MS
      ? 'dawn'
      : t < DAY_MS - TWILIGHT_MS
        ? 'day'
        : t < DAY_MS
          ? 'sunset'
          : 'night';
  }

  /** Avance 0..1 dentro de la fase actual. */
  get phaseProgress(): number {
    const t = this.elapsedMs;
    switch (this.phase) {
      case 'dawn':
        return t / TWILIGHT_MS;
      case 'day':
        return (t - TWILIGHT_MS) / (DAY_MS - 2 * TWILIGHT_MS);
      case 'sunset':
        return (t - DAY_MS + TWILIGHT_MS) / TWILIGHT_MS;
      default:
        return (t - DAY_MS) / NIGHT_MS;
    }
  }

  /** Luz exterior (NIGHT_LIGHT..1); transiciones suaves, nunca de golpe. */
  get daylight(): number {
    const phase = this.phase,
      p = this.phaseProgress;
    const range = 1 - NIGHT_LIGHT;
    if (phase === 'dawn') return NIGHT_LIGHT + range * smooth(p);
    if (phase === 'sunset') return 1 - range * smooth(p);
    return phase === 'day' ? 1 : NIGHT_LIGHT;
  }

  /** 0 noche, 1 día pleno: dirige paletas del cielo, estrellas y fauna. */
  get sunStrength(): number {
    return (this.daylight - NIGHT_LIGHT) / (1 - NIGHT_LIGHT);
  }

  /** Intensidad de los tonos cálidos (rosado al amanecer, naranja al ocaso). */
  get warm(): number {
    const phase = this.phase;
    return phase === 'dawn' || phase === 'sunset'
      ? Math.sin(Math.PI * this.phaseProgress)
      : 0;
  }

  /** Estrellas visibles 0..1: aparecen al anochecer y se van al amanecer. */
  get stars(): number {
    return clamp01((0.55 - this.sunStrength) / 0.55);
  }

  /** Actividad de aves 0..1: plena de día, casi nula de noche. */
  get birdActivity(): number {
    return this.phase === 'night' ? 0.08 : 0.25 + 0.75 * this.sunStrength;
  }

  /**
   * Tinte multiplicativo del exterior según la hora, en escalones de
   * 1/TINT_STEPS: blanco de día, cálido en el crepúsculo y azul luna de
   * noche. `soft` es la versión de los personajes (siempre se distinguen).
   */
  tint(soft = false): number {
    const q = (v: number) => Math.round(v * TINT_STEPS) / TINT_STEPS;
    const night = q(1 - this.sunStrength),
      warm = q(this.warm);
    const moon = soft ? MOON_TINT_SOFT : MOON_TINT;
    const glow = this.phase === 'sunset' ? DUSK_TINT : DAWN_TINT;
    // Primero se enfría hacia la luna; el tono cálido se suma en el crepúsculo.
    const base = lerp(0xffffff, moon, night);
    return lerp(base, soft ? lerp(glow, 0xffffff, 0.5) : glow, warm * 0.6);
  }

  /** Sol: sale por la izquierda al amanecer y se oculta al final del atardecer. */
  get sun(): { x: number; y: number; visible: boolean } {
    const p = this.elapsedMs / DAY_MS;
    return { ...arc(Math.min(1, p)), visible: p < 1 };
  }

  /** Luna: cruza el cielo durante los 5 minutos de noche. */
  get moon(): { x: number; y: number; visible: boolean } {
    const p = (this.elapsedMs - DAY_MS) / NIGHT_MS;
    return { ...arc(clamp01(p)), visible: p >= 0 };
  }
}
