/**
 * Hoja del gnomo minero (scripts/art/build-gnome.mjs, `npm run art:gnome`).
 * El maestro se coloca sin reescalar dentro de cuadros de 64 × 48: el margen
 * deja sitio a la picota levantada y al cuerpo caído.
 */
export const GNOME_SHEET = {
  key: 'gnome',
  url: 'assets/characters/gnome/gnome.png',
  frameWidth: 64,
  frameHeight: 48,
  columns: 8,
  /**
   * Lado del maestro: 24 = versión pequeña retocada (art/gnome/small.png);
   * 32 = original limpio (art/gnome/master.png, con origen 21, 14).
   */
  size: 24,
  /** Esquina del maestro dentro de cada cuadro. */
  originX: 23,
  originY: 21,
  /** Última fila de píxeles de los pies: el suelo de todas las poses. */
  baseline: 44,
} as const;

/**
 * Animaciones en el orden de las filas de la hoja. `loop` indica si el clip
 * se repite; los demás terminan y el cerebro decide el estado siguiente.
 */
export const GNOME_ANIMATIONS = {
  idle: { row: 0, count: 8, fps: 6, loop: true },
  idleBlink: { row: 1, count: 8, fps: 6, loop: true },
  walk: { row: 2, count: 8, fps: 10, loop: true },
  run: { row: 3, count: 8, fps: 12, loop: true },
  attack: { row: 4, count: 8, fps: 12, loop: false },
  hurt: { row: 5, count: 4, fps: 10, loop: false },
  death: { row: 6, count: 8, fps: 10, loop: false },
  alert: { row: 7, count: 6, fps: 8, loop: false },
  rage: { row: 8, count: 6, fps: 10, loop: false },
  mine: { row: 9, count: 8, fps: 10, loop: false },
  look: { row: 10, count: 6, fps: 6, loop: true },
} as const;

export type GnomeAnimation = keyof typeof GNOME_ANIMATIONS;

/** Cuadro (índice cero) en que la picota toca: ahí, y solo ahí, hay daño. */
export const GNOME_IMPACT_FRAME = { attack: 4, mine: 4 } as const;

/** El cuerpo caído permanece en este cuadro de la muerte antes de disolverse. */
export const GNOME_DEATH_HOLD = { frame: 5, ms: 900 } as const;

/**
 * Cuerpo físico (colisión con la mina) en coordenadas del cuadro: centrado en
 * x = 32 para que el volteo no lo desplace y apoyado en la línea de los pies.
 * El gorro queda fuera: es solo dibujo. Con 17 px de alto no cabe por huecos
 * de un bloque (el gorro atravesaría la roca).
 */
export const GNOME_BODY = {
  width: 10,
  height: 17,
  offsetX: 27,
  offsetY: 28,
} as const;

/**
 * Zona que recibe golpes (hurtbox), relativa al centro del cuerpo físico:
 * cubre cuerpo y cara, un poco más alta que el cuerpo de colisión.
 */
export const GNOME_HURTBOX = { width: 12, height: 20, dy: -2 } as const;

/** Duración de un clip en ms (la muerte incluye la pausa del cuerpo caído). */
export function gnomeClipMs(name: GnomeAnimation): number {
  const clip = GNOME_ANIMATIONS[name];
  const base = (clip.count * 1000) / clip.fps;
  return name === 'death' ? base + GNOME_DEATH_HOLD.ms : base;
}

/** Cuadro del clip tras `elapsed` ms; los clips sin bucle quedan en el último. */
export function gnomeFrameAt(name: GnomeAnimation, elapsed: number): number {
  const clip = GNOME_ANIMATIONS[name];
  const step = 1000 / clip.fps;
  let t = Math.max(0, elapsed);
  if (name === 'death') {
    const holdStart = (GNOME_DEATH_HOLD.frame + 1) * step;
    if (t >= holdStart) t = Math.max(holdStart - 1, t - GNOME_DEATH_HOLD.ms);
  }
  const frame = Math.floor(t / step);
  return clip.loop ? frame % clip.count : Math.min(clip.count - 1, frame);
}

/** Índice del cuadro en la hoja completa. */
export const gnomeSheetFrame = (name: GnomeAnimation, frame: number): number =>
  GNOME_ANIMATIONS[name].row * GNOME_SHEET.columns + frame;
