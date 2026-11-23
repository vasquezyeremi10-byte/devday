export const DEPTH = {
  background: 0,
  terrain: 100,
  structures: 200,
  characters: 300,
  machines: 400,
  foreground: 500,
  /** Oscuridad dinámica: cubre todo el mundo, nunca el HUD. */
  lighting: 700,
  /** Indicaciones del mundo que deben leerse a oscuras (selección, progreso). */
  worldUi: 800,
  ui: 1000,
} as const;
export type LayerName = keyof typeof DEPTH;
