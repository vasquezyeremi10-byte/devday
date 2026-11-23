import { Block, TerrainGrid, type Cell, type Point } from '../world/TerrainGrid';

/** Identificador estable: permite sumar mundos sin acoplar las escenas. */
export const FORGOTTEN_DEPTHS_ID = 'forgotten-depths' as const;
export const EXPEDITION_SCENE = 'ExpeditionScene';

export interface ExpeditionState {
  id: typeof FORGOTTEN_DEPTHS_ID;
  /** Semilla propia: los futuros pisos no dependen de las acciones del jugador. */
  seed: number;
  /** Diferencias contra el plano base, expresadas con índices de la expedición. */
  dug: number[];
  position: Point;
  active: boolean;
}

/** Contrato de Mundo 1. Los próximos mundos se registran con el mismo esquema. */
export const FORGOTTEN_DEPTHS = {
  id: FORGOTTEN_DEPTHS_ID,
  name: 'LAS PROFUNDIDADES OLVIDADAS',
  columns: 64,
  rows: 28,
  spawn: { x: 88, y: 212 },
  returnPortal: { x: 40, y: 212 },
} as const;

const mixSeed = (seed: number) =>
  (Math.imul(seed ^ 0x6d2b79f5, 0x45d9f3b) ^ 0x27d4eb2d) >>> 0;

export function createExpeditionState(seed: number): ExpeditionState {
  return {
    id: FORGOTTEN_DEPTHS_ID,
    seed: mixSeed(seed),
    dug: [],
    position: { ...FORGOTTEN_DEPTHS.spawn },
    active: true,
  };
}

/** Recupera solo datos válidos; los guardados anteriores simplemente no tenían expedición. */
export function restoreExpeditionState(
  value: unknown,
  sessionSeed: number,
): ExpeditionState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<ExpeditionState>;
  if (raw.id !== FORGOTTEN_DEPTHS_ID || !Number.isInteger(raw.seed))
    return undefined;
  const validPoint =
    raw.position &&
    Number.isFinite(raw.position.x) &&
    Number.isFinite(raw.position.y);
  const max = FORGOTTEN_DEPTHS.columns * FORGOTTEN_DEPTHS.rows;
  const dug = Array.isArray(raw.dug)
    ? [...new Set(raw.dug.filter((key) => Number.isInteger(key) && key >= 0 && key < max))].sort(
        (a, b) => a - b,
      )
    : [];
  return {
    id: FORGOTTEN_DEPTHS_ID,
    seed: raw.seed ?? mixSeed(sessionSeed),
    dug,
    position: validPoint
      ? { x: raw.position!.x, y: raw.position!.y }
      : { ...FORGOTTEN_DEPTHS.spawn },
    active: raw.active === true,
  };
}

export function snapshotExpedition(state: ExpeditionState): ExpeditionState {
  return {
    id: state.id,
    seed: state.seed,
    dug: [...new Set(state.dug)].sort((a, b) => a - b),
    position: { x: Math.round(state.position.x), y: Math.round(state.position.y) },
    active: state.active,
  };
}

/** Marca una sola celda retirada, sin duplicarla en el guardado. */
export function markExpeditionDug(
  state: ExpeditionState,
  grid: TerrainGrid,
  cell: Cell,
): void {
  const key = grid.index(cell.column, cell.row);
  if (!state.dug.includes(key)) state.dug.push(key);
}

/**
 * Plano inicial de Mundo 1. Es determinista y deliberadamente pequeño: una
 * cámara segura, una bajada y dos cámaras minables. La API no presupone que
 * los mundos futuros tengan esta forma ni este tamaño.
 */
export function createForgottenDepthsTerrain(state: ExpeditionState): TerrainGrid {
  const { columns, rows } = FORGOTTEN_DEPTHS;
  const grid = new TerrainGrid(columns, rows);
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) grid.set(column, row, Block.Rock);

  // Límite inviolable y un suelo inicial que no puede desaparecer bajo el spawn.
  for (let column = 0; column < columns; column++) {
    grid.set(column, 0, Block.Bedrock);
    grid.set(column, rows - 1, Block.Bedrock);
  }
  for (let row = 0; row < rows; row++) {
    grid.set(0, row, Block.Bedrock);
    grid.set(columns - 1, row, Block.Bedrock);
  }
  for (let column = 1; column <= 12; column++) grid.set(column, 14, Block.Bedrock);

  const carve = (fromColumn: number, toColumn: number, topRow: number, bottomRow: number) => {
    for (let row = topRow; row <= bottomRow; row++)
      for (let column = fromColumn; column <= toColumn; column++)
        if (grid.get(column, row) !== Block.Bedrock) grid.set(column, row, Block.Air);
  };
  // Zona de llegada y corredor horizontal sin peligro.
  carve(1, 30, 11, 13);
  // Primera cavidad baja; obliga a explorar a distinta altura, no a caminar recto.
  carve(30, 43, 10, 18);
  carve(43, 61, 7, 17);
  // Repisas naturales dentro de las cámaras, con rutas superiores e inferiores.
  for (let column = 32; column <= 37; column++) grid.set(column, 17, Block.Rock);
  for (let column = 47; column <= 54; column++) grid.set(column, 14, Block.Rock);
  for (let column = 54; column <= 59; column++) grid.set(column, 11, Block.Rock);

  // Menas básicas visibles, no escondidas detrás de una pared imposible.
  for (const [column, row, block] of [
    [16, 12, Block.Coal],
    [21, 12, Block.Copper],
    [27, 12, Block.Iron],
    [34, 16, Block.Coal],
    [39, 16, Block.Copper],
    [46, 13, Block.Iron],
    [50, 13, Block.Gold],
    [57, 10, Block.Crystal],
  ] as const)
    grid.set(column, row, block);

  for (const key of state.dug) {
    const cell = grid.cellOf(key);
    if (grid.contains(cell.column, cell.row) && grid.get(cell.column, cell.row) !== Block.Bedrock)
      grid.set(cell.column, cell.row, Block.Air);
  }
  return grid;
}
