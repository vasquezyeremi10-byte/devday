import type { Point } from '../world/TerrainGrid';

export const CABIN_ROOM = { x: 128, y: 64, w: 224, h: 144 };
export const CABIN_DOOR = { x: 240, y: 201 };
export const CABIN_BEDSIDE = { x: 183, y: 125 };
export const CABIN_PORTAL = { x: 304, y: 280 };
export const CABIN_PORCH = { x: CABIN_PORTAL.x, y: CABIN_PORTAL.y + 10 };
export const CABIN_BED = { x: 157, y: 128 };
export const CABIN_LOCKER = { x: 308, y: 115 };
export const CABIN_BOARD = { x: 211, y: 164 };
export const CABIN_FURNITURE = [
  { x: 144, y: 100, w: 25, h: 41 }, // Cama
  { x: 171, y: 99, w: 16, h: 13 }, // Velador
  { x: 293, y: 91, w: 30, h: 17 }, // Casillero
  { x: 271, y: 139, w: 37, h: 24 }, // Mesa
  { x: 309, y: 146, w: 13, h: 14 }, // Silla
  { x: 144, y: 173, w: 17, h: 17 }, // Estufa
  { x: 199, y: 89, w: 36, h: 12 }, // Estante
  { x: 326, y: 114, w: 22, h: 30 }, // Refrigerador (contra el muro de la derecha)
] as const;
/** Donde se para el minero para abrir el refrigerador (frente a su puerta). */
export const CABIN_FRIDGE = { x: 337, y: 152 };

export interface TopDownCabinSave {
  inside: boolean;
  position: Point;
}

export function validCabinPosition(p: Point): boolean {
  const { x, y, w, h } = CABIN_ROOM;
  return (
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x >= x + 5 &&
    p.x <= x + w - 5 &&
    p.y >= y + 26 &&
    p.y <= y + h &&
    !CABIN_FURNITURE.some(
      (f) =>
        p.x + 5 > f.x &&
        p.x - 5 < f.x + f.w &&
        p.y > f.y &&
        p.y - 6 < f.y + f.h,
    )
  );
}
