import { TILE_SIZE, WORLD } from '../config/constants';
import { BIOMES, type BiomeDef, type BiomeProfile } from '../config/biomes';
import { MINERAL_KEYS, type MineralKey } from '../config/minerals';

/**
 * Tipos de bloque. Las menas van consecutivas en el orden de MINERALS.
 * V3: plata y cuarzo se retiraron (las partidas V2 se migran en SaveSystem).
 */
export enum Block {
  Air = -1,
  Dirt = 0,
  Rock = 1,
  Bedrock = 2,
  Coal = 3,
  Iron = 4,
  Copper = 5,
  Gold = 6,
  Emerald = 7,
  Ruby = 8,
  Sapphire = 9,
  Diamond = 10,
  Alien = 11,
  /** Roca dura profunda: requiere picota de tungsteno o superior. */
  HardRock = 12,
  /** Escombro de un derrumbe: se retira con pala o picota. */
  Rubble = 13,
  /** Cristal violeta misterioso (exploración V10): mena con luz propia. */
  Crystal = 14,
  /** Tablones de madera: solo existen colocados por el jugador (V11). */
  Wood = 15,
}
export const BLOCK_MAX = Block.Wood;

/** Bloque de mena → mineral recolectado; tierra, roca y lecho no rinden mineral. */
export function mineralOf(block: Block): MineralKey | null {
  if (block === Block.Crystal) return 'violet_crystal';
  return block >= Block.Coal && block <= Block.Alien
    ? MINERAL_KEYS[block - Block.Coal]!
    : null;
}
export const oreBlock = (key: MineralKey): Block =>
  key === 'violet_crystal'
    ? Block.Crystal
    : ((Block.Coal + MINERAL_KEYS.indexOf(key)) as Block);
export interface Cell {
  column: number;
  row: number;
}
export interface Point {
  x: number;
  y: number;
}

/** Fuente de verdad independiente del render y de las imágenes de fondo. */
export class TerrainGrid {
  readonly cells: Block[][];
  /** Solo el mundo completo tiene el campamento abierto a su izquierda. */
  private readonly openLeft: boolean;
  /**
   * Revisión de la geología con que se generó (1 = original; 2 = cavernas;
   * 3 = mina sólida; 4 = entrada de 10 × 3). La fija generateWorld; la sesión
   * y el guardado la leen.
   */
  worldRev = 1;
  /** Corrientes naturales de aire (rev. 2): las usa VentilationSystem. */
  readonly vents: Cell[] = [];
  /**
   * Aire de las cavernas naturales (rev. 2), por clave fila × columnas +
   * columna. VisibilitySystem no las da por descubiertas aunque estén
   * conectadas al cielo: se descubren explorándolas.
   */
  readonly caveAir = new Set<number>();

  /**
   * `first`: columna del mundo de la primera columna guardada. El mundo de
   * juego empieza en el borde oeste (WORLD_FIRST_COLUMN, negativa); las
   * cuadrículas de prueba y las de la vista cenital empiezan en 0. Todas las
   * consultas reciben columnas del MUNDO; `cells` guarda la columna
   * `column − first`.
   */
  constructor(
    readonly columns: number = WORLD.columns,
    readonly rows: number = WORLD.rows,
    readonly first: number = 0,
  ) {
    this.cells = Array.from({ length: rows }, () =>
      Array<Block>(columns).fill(Block.Air),
    );
    this.openLeft = columns + first === WORLD.columns && rows === WORLD.rows;
  }

  /** Columna siguiente a la última (borde este, exclusivo). */
  get end(): number {
    return this.first + this.columns;
  }

  /** Índice plano de una celda (fila × columnas + columna local), ≥ 0. */
  index(column: number, row: number): number {
    return row * this.columns + (column - this.first);
  }

  /** Celda de un índice plano (inverso de `index`). */
  cellOf(index: number): Cell {
    return {
      column: (index % this.columns) + this.first,
      row: Math.floor(index / this.columns),
    };
  }

  contains(column: number, row: number): boolean {
    return (
      Number.isInteger(column) &&
      Number.isInteger(row) &&
      column >= this.first &&
      row >= 0 &&
      column < this.end &&
      row < this.rows
    );
  }

  /**
   * Fuera del mundo: lecho indestructible. A la izquierda de una cuadrícula
   * que termina en el borde este del mundo hay cielo abierto sobre la
   * superficie y lecho bajo ella.
   */
  get(column: number, row: number): Block {
    const block =
      column >= this.first ? this.cells[row]?.[column - this.first] : undefined;
    if (block !== undefined) return block;
    return this.openLeft &&
      column < this.first &&
      row >= 0 &&
      row < WORLD.surfaceRow
      ? Block.Air
      : Block.Bedrock;
  }

  set(column: number, row: number, block: Block): void {
    if (!this.contains(column, row))
      throw new RangeError('Celda fuera del mundo');
    this.cells[row]![column - this.first] = block;
  }

  isSolid(column: number, row: number): boolean {
    return this.get(column, row) !== Block.Air;
  }

  isExposed(column: number, row: number): boolean {
    return [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ].some(([dx, dy]) => this.get(column + dx!, row + dy!) === Block.Air);
  }

  static worldToCell(x: number, y: number): Cell {
    return {
      column: Math.floor(x / TILE_SIZE),
      row: Math.floor(y / TILE_SIZE),
    };
  }

  static center({ column, row }: Cell): Point {
    return { x: (column + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
  }
}

/**
 * Perfil del cerro: primera fila sólida por columna. La ladera izquierda es
 * empinada sobre la bocamina; la derecha baja con pendiente suave al valle.
 */
const HILL_PROFILE: readonly (readonly [number, number])[] = [
  [18, 6],
  [19, 5],
  [20, 5],
  [21, 4],
  [22, 4],
  [23, 3],
  [24, 3],
  [25, 2],
  [26, 2],
  [27, 2],
  [28, 3],
  [29, 3],
  [30, 3],
  [31, 4],
  [32, 4],
  [33, 5],
  [34, 5],
  [35, 5],
  [36, 6],
  [37, 6],
  [38, 6],
  [39, 7],
  [40, 7],
  [41, 8],
  [42, 8],
  [43, 8],
  [44, 9],
  [45, 9],
  [46, 9],
  // V8, ampliación derecha: cerro rocoso con cumbre de roca viva…
  [94, 9],
  [95, 9],
  [96, 8],
  [97, 8],
  [98, 7],
  [99, 6],
  [100, 6],
  [101, 5],
  [102, 5],
  [103, 4],
  [104, 4],
  [105, 4],
  [106, 5],
  [107, 5],
  [108, 6],
  [109, 6],
  [110, 6],
  [111, 7],
  [112, 7],
  [113, 8],
  [114, 8],
  [115, 9],
  [116, 9],
  // …y una meseta baja cerca del borde, con espacio plano entre ambos.
  [127, 9],
  [128, 8],
  [129, 8],
  [130, 8],
  [131, 8],
  [132, 8],
  [133, 9],
];

/**
 * V9: relieve de los biomas nuevos (config/biomes.ts). Senos compuestos
 * (deterministas, sin estado) con un fundido de 8 columnas en los bordes de
 * cada zona, para que la superficie empalme sin escalones con el desierto
 * (superficie llana, fila 10) y con el bioma vecino. El desierto, el
 * campamento y el cerro de la mina no cambian: no tienen perfil propio.
 */
const biomeHill = (column: number, z: BiomeDef, p: BiomeProfile): number => {
  // Fundido en los bordes: 8 columnas de empalme con la zona vecina; los
  // extremos del mundo no empalman con nada (la costa llega hasta el borde
  // este y la primera zona del oeste, hasta el borde oeste).
  const toEdge = z.to === WORLD.columns - 1 ? Infinity : z.to - column;
  const fromEdge = z.from === BIOMES[0]!.from ? Infinity : column - z.from;
  const fade = Math.max(0, Math.min(1, Math.min(fromEdge, toEdge) / 8));
  const wave =
    Math.sin(column / p.f1 + p.phase) * 0.7 +
    Math.sin(column / p.f2 + p.phase * 1.7) * 0.5;
  // Hacia el borde de base distinta (montaña en la fila 8) se empalma con 10.
  const base = WORLD.surfaceRow + (p.base - WORLD.surfaceRow) * fade;
  const row = base + p.amp * fade * wave;
  return Math.round(Math.max(p.clamp[0], Math.min(p.clamp[1], row)));
};
const BIOME_HILL_ROWS: readonly (readonly [number, number])[] = BIOMES.flatMap(
  (z) => {
    const rows: (readonly [number, number])[] = [];
    if (z.profile)
      for (let c = z.from; c <= z.to; c++)
        rows.push([c, biomeHill(c, z, z.profile)] as const);
    return rows;
  },
);
const HILL_ROWS = new Map([...HILL_PROFILE, ...BIOME_HILL_ROWS]);
/** Galería horizontal excavada en la base del cerro. */
export const TUNNEL = {
  fromColumn: 18,
  toColumn: 25,
  topRow: 7,
  bottomRow: 9,
} as const;
/** Afloramientos de roca en la cumbre y la ladera, sin cubierta vegetal. */
const OUTCROPS = new Set([
  '25,2',
  '26,2',
  '27,2',
  '26,3',
  '27,3',
  '37,6',
  '38,6',
  '38,7',
  // V8: roca viva del cerro de la ampliación y de la meseta.
  '102,5',
  '103,4',
  '104,4',
  '105,4',
  '103,5',
  '104,5',
  '105,5',
  '104,6',
  '109,6',
  '110,6',
  '110,7',
  '130,8',
  '131,8',
  '131,9',
]);

/** Fila de superficie natural de una columna, antes de cualquier excavación. */
export function surfaceRow(column: number): number {
  return HILL_ROWS.get(column) ?? WORLD.surfaceRow;
}

/** Afloramiento de roca en la superficie natural (sin cubierta vegetal). */
export const isOutcrop = (column: number, row: number): boolean =>
  OUTCROPS.has(`${column},${row}`);
