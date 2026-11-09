export const VIEW = { width: 480, height: 270 } as const;
export const TILE_SIZE = 16;
export const WORLD = { columns: 80, rows: 36, surfaceRow: 10 } as const;
export const PLAYER = {
  speed: 90,
  jumpSpeed: 210,
  gravity: 600,
  reach: 36,
} as const;
export const SPAWN = { x: 208, y: 148 } as const;
