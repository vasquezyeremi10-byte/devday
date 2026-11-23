import { TILE_SIZE, WORLD, WORLD_LEFT, WORLD_WIDTH } from '../config/constants';
import { TerrainGrid } from '../world/TerrainGrid';
import type { DeliveryPoint } from './DroneOrders';

/** Busca suelo accesible desde el cielo, con espacio para la caja y el minero. */
export function droneLanding(
  grid: TerrainGrid,
  point: DeliveryPoint,
  occupied: DeliveryPoint[] = [],
  blocked: (x: number, y: number) => boolean = () => false,
): DeliveryPoint {
  let best: DeliveryPoint | undefined;
  let distance = Infinity;
  const left = Math.max(WORLD_LEFT + 16, Math.round(point.x) - 128);
  const right = Math.min(
    WORLD_LEFT + WORLD_WIDTH - 16,
    Math.round(point.x) + 128,
  );
  for (let x = left; x <= right; x += 4) {
    for (let y = 32; y < WORLD.rows * TILE_SIZE - 16; y += 4) {
      const empty = (px: number, py: number) =>
        !grid.isSolid(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE));
      const reachable = [-20, 20].some(
        (dx) =>
          empty(x + dx, y - 24) &&
          empty(x + dx, y - 8) &&
          [0, 8, 16].some((drop) =>
            grid.isSolid(
              Math.floor((x + dx) / TILE_SIZE),
              Math.floor((y + drop) / TILE_SIZE),
            ),
          ),
      );
      // Los laterales y el espacio contiguo permiten abrir la caja con E.
      if (
        !empty(x - 8, y - 13) ||
        !empty(x + 8, y - 13) ||
        !empty(x - 8, y - 1) ||
        !empty(x + 8, y - 1) ||
        !grid.isSolid(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE)) ||
        !reachable ||
        occupied.some((p) => Math.hypot(p.x - x, p.y - y) < 24) ||
        blocked(x, y)
      )
        continue;
      let sky = true;
      for (let scan = 0; scan < y - 13; scan += TILE_SIZE)
        if (!empty(x, scan)) {
          sky = false;
          break;
        }
      if (!sky) continue;
      const score = (x - point.x) ** 2 + (y - point.y) ** 2;
      if (score < distance) {
        distance = score;
        best = { scene: 'MiningScene', x, y };
      }
    }
  }
  // El campamento tiene suelo permanente; cubre partidas con terreno muy alterado.
  return best ?? { scene: 'MiningScene', x: -392, y: 160 };
}
