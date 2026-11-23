import { squareReach } from '../lighting/HeadlampLight';
import { surfaceRow, type Cell, type TerrainGrid } from '../world/TerrainGrid';

/**
 * La muralla de la mina (pared del fondo, PlaceholderArt.undergroundWall)
 * cubre cada columna desde su superficie natural hacia abajo.
 */
export const onMineWall = (cell: Cell): boolean =>
  cell.row >= surfaceRow(cell.column);

/** Fuentes de luz que el jugador compra e instala (parámetros de juego). */
export const LAMPS = {
  /** Cuadro de 5 × 5 bloques a plena luz que se apaga de a poco 1,5 bloques más. */
  torch: {
    label: 'ANTORCHA',
    area: 5,
    fade: 1.5,
    radius: squareReach(5, 1.5),
    intensity: 1,
    fuelMs: 6 * 60_000,
  },
  lamp: {
    label: 'FARO MINERO',
    radius: 88,
    intensity: 1,
    fuelMs: 20 * 60_000,
  },
  industrial: {
    label: 'LUMINARIA INDUSTRIAL',
    radius: 112,
    intensity: 1,
    fuelMs: Infinity,
  },
} as const;
export type LampKind = keyof typeof LAMPS;

export interface PlacedLight extends Cell {
  id: number;
  kind: LampKind;
  /** Combustible o batería restante (ms); Infinity sin consumo. */
  fuel: number;
}

/** Antorchas, faros y luminarias instaladas en paredes válidas. */
export class PlacedLights {
  items: PlacedLight[] = [];
  nextId = 1;
  /** Se incrementa al cambiar el conjunto: invalida cachés de luz. */
  version = 0;

  check(grid: TerrainGrid, cell: Cell): string | null {
    if (grid.isSolid(cell.column, cell.row)) return 'EXCAVA ANTES DE INSTALAR';
    if (this.items.some((l) => l.column === cell.column && l.row === cell.row))
      return 'YA HAY UNA LUZ AQUI';
    const wall = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => grid.isSolid(cell.column + dx!, cell.row + dy!));
    // Bajo la superficie natural toda celda excavada tiene detrás la muralla
    // de roca de la mina: ahí también se puede fijar una luz.
    return wall || onMineWall(cell)
      ? null
      : 'COLOCALA EN LA MURALLA DE LA MINA, UNA PARED, PISO O TECHO';
  }

  install(grid: TerrainGrid, cell: Cell, kind: LampKind): boolean {
    if (this.check(grid, cell)) return false;
    this.items.push({
      ...cell,
      id: this.nextId++,
      kind,
      fuel: LAMPS[kind].fuelMs,
    });
    this.version++;
    return true;
  }

  /** Consumo con el tiempo de juego. Devuelve las luces que se apagaron. */
  burn(ms: number): PlacedLight[] {
    const out = this.items.filter((l) => {
      if (l.fuel === Infinity) return false;
      l.fuel -= ms;
      return l.fuel <= 0;
    });
    if (out.length) {
      this.items = this.items.filter((l) => !out.includes(l));
      this.version++;
    }
    return out;
  }

  /** Luces sepultadas por un derrumbe o sin pared quedan fuera. */
  prune(grid: TerrainGrid): void {
    const before = this.items.length;
    this.items = this.items.filter((l) => !grid.isSolid(l.column, l.row));
    if (this.items.length !== before) this.version++;
  }
}
