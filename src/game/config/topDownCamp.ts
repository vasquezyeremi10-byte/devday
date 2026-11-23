import { CABIN_PORTAL } from './topDownCabin';

export const CAMP_MAP = { width: 960, height: 640, spawnX: 480, spawnY: 304 };
export type CampArrival = 'cabin' | 'warehouse' | 'mine';
/** `time`: hora del ciclo; `total`: tiempo de juego acumulado (caducidad de alimentos). */
export type CampVisit = { arrival: CampArrival; time: number; total?: number };
export const CAMP_DOORS = [
  { id: 'cabin', ...CABIN_PORTAL, label: 'CABAÑA', arrival: 'cabin' },
  { id: 'warehouse', x: 552, y: 296, label: 'BODEGA', arrival: 'warehouse' },
  { id: 'mine', x: 672, y: 296, label: 'MINA', arrival: 'mine' },
] as const;
