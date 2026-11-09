export const DEPTH = {
  background: 0,
  terrain: 100,
  structures: 200,
  characters: 300,
  machines: 400,
  foreground: 500,
  ui: 1000,
} as const;
export type LayerName = keyof typeof DEPTH;
