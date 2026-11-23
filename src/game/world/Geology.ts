import {
  LEGACY_COLUMNS,
  LEGACY_COLUMNS_V6,
  WORLD,
  WORLD_FIRST_COLUMN,
} from '../config/constants';
import { biomeAtColumn, rockTopRow } from '../config/biomes';
import { carveCaves, type CaveWorld } from './Caves';
import type { MineralKey } from '../config/minerals';
import {
  Block,
  isOutcrop,
  oreBlock,
  surfaceRow,
  TerrainGrid,
  TUNNEL,
} from './TerrainGrid';

/**
 * Geología procedural reproducible por semilla. Modelo de videojuego, no una
 * predicción geológica real: el mundo se divide en sectores con tendencias
 * propias y cada mineral aparece en el tipo de yacimiento que le corresponde.
 *
 * - estratificado: mantos horizontales de carbón.
 * - veta: cuerpos alargados que cruzan estratos (hierro, oro).
 * - diseminado: concentraciones dispersas en una zona (cobre).
 * - bolsada: núcleos compactos de alto valor (oro, gemas).
 * - especial: chimenea de diamante y el secreto más profundo.
 *
 * La misma semilla genera siempre el mismo mundo; la partida guarda la
 * semilla y solo las diferencias (excavaciones), así que no hay forma de
 * regenerar un sector para obtener minerales nuevos.
 */
export const DEFAULT_SEED = 20261109;
export const SECTOR_WIDTH = 20;
/**
 * Fila donde empieza la roca en el desierto; los biomas V9 tienen la suya
 * (rockTopRow: montaña 11, pinos y monolitos 12) y se usa en strataBlock.
 */
export const ROCK_TOP_ROW = 13;
/** Desde aquí aparece roca dura (requiere tungsteno). */
export const HARD_ROCK_ROW = 26;

export type DepositKind =
  'estratificado' | 'veta' | 'diseminado' | 'bolsada' | 'especial';
export type SectorKind = 'carbonifero' | 'cuprifero' | 'aurifero' | 'gemas';
export interface Deposit {
  kind: DepositKind;
  mineral: MineralKey;
  cells: [number, number][];
}
export interface Geology {
  seed: number;
  sectors: SectorKind[];
  deposits: Deposit[];
  caverns: [number, number][][];
  /** V8: sectores de la ampliación derecha (columnas 80+). */
  extension?: SectorKind[];
  /** Mundo abierto: sectores de las columnas negativas (oeste). */
  west?: SectorKind[];
  /** V10 (rev. 2): cavernas exploradas, cristales y cámara secreta. */
  explore?: CaveWorld;
}

/** Revisión de la geología: 1 = original; 2 = con las cavernas de exploración. */
export const WORLD_REV_LEGACY = 1;
export const WORLD_REV_EXPLORE = 2;
/** Partidas nuevas: subsuelo cerrado salvo el arranque de la bocamina. */
export const WORLD_REV_SOLID = 3;
/** Partidas nuevas: entrada natural de 10 × 3 bloques. */
export const WORLD_REV_ENTRANCE_10 = 4;

const normalizedRev = (rev: number): number =>
  rev >= WORLD_REV_ENTRANCE_10
    ? WORLD_REV_ENTRANCE_10
    : rev >= WORLD_REV_SOLID
      ? WORLD_REV_SOLID
      : rev >= WORLD_REV_EXPLORE
        ? WORLD_REV_EXPLORE
        : WORLD_REV_LEGACY;

/** PRNG mulberry32: entero de 32 bits → secuencia determinista en [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash estable 0..1 de una celda para una semilla (sin estado). */
export function cellNoise(seed: number, x: number, y: number): number {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Celdas sin yacimientos ni cavernas: superficie natural y cerro, el pozo de
 * la columna 13 y el entorno de la bocamina donde se aprende a excavar.
 */
export function reservedCell(column: number, row: number): boolean {
  if (row <= WORLD.surfaceRow) return true;
  if (column === 13) return true;
  return column >= 14 && column <= 28 && row <= 15;
}

const cache = new Map<string, Geology>();

/** Terreno inicial completo de una semilla (
ev = revisión de la geología). */
export function createInitialTerrain(
  seed: number = DEFAULT_SEED,
  rev: number = WORLD_REV_LEGACY,
): TerrainGrid {
  return generateWorld(seed, rev).grid;
}

let pristine: { key: string; grid: TerrainGrid } | null = null;

/**
 * Terreno inicial de una semilla **solo para consultarlo** (comparar contra él
 * lo excavado, contar lo descubierto). A diferencia de `createInitialTerrain`
 * no genera el mundo en cada llamada: guarda el último y lo entrega
 * congelado, así que escribir en él lanza un error en vez de corromper la
 * referencia. Quien necesite un terreno para jugar usa `createInitialTerrain`.
 */
export function pristineTerrain(
  seed: number = DEFAULT_SEED,
  rev: number = WORLD_REV_LEGACY,
): TerrainGrid {
  const key = `${seed}:${normalizedRev(rev)}`;
  if (pristine?.key !== key) {
    const grid = generateWorld(seed, rev).grid;
    for (const row of grid.cells) Object.freeze(row);
    Object.freeze(grid.cells);
    pristine = { key, grid };
  }
  return pristine.grid;
}

/** Yacimientos generados para una semilla (para pruebas y depuración). */
export function geologyOf(
  seed: number = DEFAULT_SEED,
  rev: number = WORLD_REV_LEGACY,
): Geology {
  return cache.get(`${seed}:${rev}`) ?? generateWorld(seed, rev).geology;
}

/** Estrato natural de una celda (sin yacimientos); `edge` = lecho de roca. */
export function strataBlock(
  seed: number,
  column: number,
  row: number,
  edge: boolean,
): Block {
  if (edge) return Block.Bedrock;
  if (row >= rockTopRow(column) || isOutcrop(column, row)) {
    const hard =
      row >= HARD_ROCK_ROW &&
      (row >= HARD_ROCK_ROW + 4 ||
        cellNoise(seed, column >> 2, row >> 1) < 0.5);
    return hard ? Block.HardRock : Block.Rock;
  }
  return Block.Dirt;
}

/**
 * Mundo V8: las 80 columnas originales se generan exactamente como antes
 * (misma semilla → mismos yacimientos, así las partidas guardadas siguen
 * calzando) y se agregan columnas a la derecha con su propia geología. Los
 * antiguos muros de lecho de las columnas 0 y 79 pasan a ser terreno normal:
 * el mundo continúa hacia el campamento y hacia la ampliación.
 */
export function generateWorld(
  seed: number,
  rev: number = WORLD_REV_LEGACY,
  /**
   * Borde este del mundo (columna siguiente a la última). Solo las pruebas
   * usan otro valor (140 = el mundo V8): así comprueban que agregar biomas a
   * la derecha no cambia nada de lo que ya existía, base de que las partidas
   * guardadas sigan calzando.
   */
  columns: number = WORLD.columns,
  /**
   * Primera columna (borde oeste). Desde el mundo abierto el terreno empieza
   * en WORLD_FIRST_COLUMN: campamento, Mano del Desierto y las zonas del
   * oeste se excavan como el resto.
   */
  first: number = WORLD_FIRST_COLUMN,
): {
  grid: TerrainGrid;
  geology: Geology;
} {
  const legacy = generateLegacy(seed);
  const grid = new TerrainGrid(columns - first, WORLD.rows, first);
  // Lecho de roca: el fondo, el borde este y, en el mundo abierto, el oeste
  // (una cuadrícula desde la columna 0 conserva su columna 0 como en V8).
  const edge = (column: number, row: number) =>
    row === grid.rows - 1 ||
    column === grid.end - 1 ||
    (column === grid.first && grid.first < 0);
  for (let row = 0; row < grid.rows; row++)
    for (let column = grid.first; column < grid.end; column++) {
      if (row < surfaceRow(column)) continue;
      const bottom = row === grid.rows - 1;
      const old =
        column >= 0 && column < LEGACY_COLUMNS
          ? legacy.grid.get(column, row)
          : undefined;
      const block =
        old !== undefined && !(old === Block.Bedrock && !bottom)
          ? old
          : strataBlock(seed, column, row, edge(column, row));
      grid.set(column, row, block);
    }
  // La galería de la bocamina se conserva tal cual (aire en la cuadrícula
  // antigua, que la copia ya respetó).
  // V8 (columnas 80..139): mismo flujo aleatorio y mismo ancho de entonces,
  // así sus yacimientos no cambian aunque el mundo haya crecido.
  const extension = extendGeology(
    grid,
    rng((seed ^ 0x85ebca6b) >>> 0),
    LEGACY_COLUMNS,
    LEGACY_COLUMNS_V6,
    () => SECTOR_KINDS,
  );
  // V9 (columnas 140+): geología de los biomas con un flujo propio. Mismos
  // tipos de yacimiento y minerales; solo el relieve inclina el sector.
  const biomes = extendGeology(
    grid,
    rng((seed ^ 0x3c6ef372) >>> 0),
    LEGACY_COLUMNS_V6,
    grid.end,
    biomeSectorKinds,
  );
  // Mundo abierto (columnas negativas): campamento, Mano del Desierto y las
  // zonas del oeste ganan yacimientos con su propio flujo aleatorio. Antes
  // eran suelo fijo sin minerales; nada al este de la columna 0 cambia.
  const west =
    grid.first < 0
      ? extendGeology(
          grid,
          rng((seed ^ 0x9e3779b9) >>> 0),
          grid.first + 1,
          0,
          biomeSectorKinds,
        )
      : { sectors: [], deposits: [], caverns: [] };
  const geology: Geology = {
    ...legacy.geology,
    deposits: [
      ...legacy.geology.deposits,
      ...extension.deposits,
      ...biomes.deposits,
      ...west.deposits,
    ],
    caverns: [
      ...legacy.geology.caverns,
      ...extension.caverns,
      ...biomes.caverns,
      ...west.caverns,
    ],
    extension: [...extension.sectors, ...biomes.sectors],
    west: west.sectors,
  };
  grid.worldRev = normalizedRev(rev);
  if (grid.worldRev >= WORLD_REV_EXPLORE) {
    // Flujo aleatorio propio: no altera ningún yacimiento de la rev. 1.
    geology.explore = carveCaves(grid, rng((seed ^ 0xca7e5eed) >>> 0));
    // Las cavernas pueden haber vaciado parte de un yacimiento: registrar lo real.
    geology.deposits = geology.deposits
      .map((d) => ({
        ...d,
        cells: d.cells.filter(
          ([x, y]) => grid.get(x, y) === oreBlock(d.mineral),
        ),
      }))
      .filter((d) => d.cells.length);
  }
  if (grid.worldRev >= WORLD_REV_SOLID) {
    // La rev. 2 determina los mismos yacimientos y cristales. Se cierran sus
    // huecos después de generarlos, sin alterar el flujo aleatorio existente.
    const entranceDepth = grid.worldRev >= WORLD_REV_ENTRANCE_10 ? 10 : 6;
    for (let row = 0; row < grid.rows; row++)
      for (let column = grid.first; column < grid.end; column++) {
        const entrance =
          column >= TUNNEL.fromColumn &&
          column < TUNNEL.fromColumn + entranceDepth &&
          row >= TUNNEL.topRow &&
          row <= TUNNEL.bottomRow;
        if (entrance && grid.worldRev >= WORLD_REV_ENTRANCE_10) {
          grid.set(column, row, Block.Air);
          continue;
        }
        if (row < surfaceRow(column) || grid.get(column, row) !== Block.Air)
          continue;
        if (!entrance)
          grid.set(
            column,
            row,
            strataBlock(seed, column, row, edge(column, row)),
          );
      }
    grid.caveAir.clear();
    grid.vents.length = 0;
    geology.caverns = [];
    if (geology.explore) {
      geology.explore.cells = [];
      geology.explore.secret.tunnel = [];
      geology.explore.secret.cells = [];
      geology.explore.vents = [];
    }
  }
  if (columns === WORLD.columns && first === WORLD_FIRST_COLUMN)
    cache.set(`${seed}:${grid.worldRev}`, geology);
  return { grid, geology };
}

const SECTOR_KINDS: readonly SectorKind[] = [
  'carbonifero',
  'cuprifero',
  'aurifero',
  'gemas',
];

/**
 * V9: tendencia de los sectores según la zona donde empiezan. Los Cerros de
 * la Costa favorecen cobre y oro; la pampa, el FCAB y Huanchaca, mantos de
 * carbón y cobre; La Portada y el resto, cualquiera. Son las mismas columnas
 * y tendencias de los biomas de V9 a los que reemplazan, así los
 * yacimientos de cada semilla no cambian.
 */
function biomeSectorKinds(column: number): readonly SectorKind[] {
  const biome = biomeAtColumn(column);
  // Zonas del oeste (mundo abierto): Sierra Gorda es cuprífera, el Valle de
  // la Luna guarda gemas, Paranal oro y el salar mantos de carbón.
  if (biome === 'sierra')
    return ['cuprifero', 'cuprifero', 'aurifero', 'carbonifero'];
  if (biome === 'moon') return ['gemas', 'aurifero', 'cuprifero', 'gemas'];
  if (biome === 'paranal')
    return ['aurifero', 'gemas', 'cuprifero', 'aurifero'];
  if (biome === 'salar')
    return ['carbonifero', 'cuprifero', 'carbonifero', 'gemas'];
  if (biome === 'hills')
    return ['cuprifero', 'aurifero', 'aurifero', 'gemas'];
  if (biome === 'pampa' || biome === 'fcab' || biome === 'huanchaca')
    return ['carbonifero', 'carbonifero', 'cuprifero', 'aurifero'];
  return SECTOR_KINDS;
}

/**
 * Geología de una ampliación a la derecha (columnas `first`..`limit`−1):
 * sectores de 20 columnas con mantos, vetas, cobre diseminado, bolsadas y
 * cavernas. Cada ampliación usa su propio flujo aleatorio y su propio ancho
 * (`limit` hace de borde, como lo hacía el ancho del mundo en V8), así una
 * ampliación nueva nunca altera las anteriores.
 */
function extendGeology(
  grid: TerrainGrid,
  random: () => number,
  first: number,
  limit: number,
  kindsFor: (column: number) => readonly SectorKind[],
): {
  sectors: SectorKind[];
  deposits: Deposit[];
  caverns: [number, number][][];
} {
  const int = (a: number, b: number) => a + Math.floor(random() * (b - a + 1));
  const sectors: SectorKind[] = [];
  for (let start = first; start + 10 < limit; start += SECTOR_WIDTH) {
    const kinds = kindsFor(start);
    sectors.push(kinds[int(0, kinds.length - 1)]!);
  }
  const span = (i: number) => {
    const from = first + i * SECTOR_WIDTH;
    return [from, Math.min(limit - 3, from + SECTOR_WIDTH - 1)] as const;
  };
  // Nunca a ras de suelo ni a la vista desde una ladera vecina (los biomas
  // tienen superficies de la fila 7 a la 11; en V8 todas eran ≤ 10).
  const buried = (column: number, row: number) =>
    row >
    Math.max(
      surfaceRow(column - 1),
      surfaceRow(column),
      surfaceRow(column + 1),
    );
  const deposits: Deposit[] = [];
  const place = (d: Deposit, column: number, row: number) => {
    if (
      column < first ||
      column > limit - 2 ||
      row >= grid.rows - 1 ||
      reservedCell(column, row) ||
      !buried(column, row)
    )
      return;
    const host = grid.get(column, row);
    if (host !== Block.Dirt && host !== Block.Rock && host !== Block.HardRock)
      return;
    grid.set(column, row, oreBlock(d.mineral));
    d.cells.push([column, row]);
  };
  const add = (kind: DepositKind, mineral: MineralKey) => {
    const d: Deposit = { kind, mineral, cells: [] };
    deposits.push(d);
    return d;
  };
  sectors.forEach((sector, i) => {
    const [from, to] = span(i);
    // Manto de carbón (dos en un sector carbonífero).
    for (let n = sector === 'carbonifero' ? 2 : 1; n > 0; n--) {
      const d = add('estratificado', 'coal');
      const length = int(5, 10);
      let row = int(11, 18);
      const start = int(from, Math.max(from, to - length));
      for (let c = start; c < start + length; c++) {
        if ((c - start) % 4 === 3 && random() < 0.35)
          row = Math.max(11, Math.min(19, row + (random() < 0.5 ? -1 : 1)));
        place(d, c, row);
        if (random() < 0.5) place(d, c, row + 1);
      }
    }
    // Vetas de hierro en diagonal.
    for (let n = 0; n < 2; n++) {
      const d = add('veta', 'iron');
      let c = int(from, to),
        row = int(12, 24);
      const dx = random() < 0.5 ? 1 : -1;
      for (let k = int(5, 9); k > 0; k--) {
        place(d, c, row);
        c += dx;
        row += random() < 0.45 ? 1 : 0;
      }
    }
    // Cobre diseminado.
    for (let n = sector === 'cuprifero' ? 2 : 1; n > 0; n--) {
      const d = add('diseminado', 'copper');
      const cx = int(from + 3, to - 3),
        cy = int(13, 24);
      for (let y = cy - 2; y <= cy + 2; y++)
        for (let x = cx - 3; x <= cx + 3; x++)
          if (
            ((x - cx) / 3.5) ** 2 + ((y - cy) / 2.5) ** 2 <= 1 &&
            random() < 0.3
          )
            place(d, x, y);
    }
    // Oro en vetas finas profundas (más en el aurífero).
    for (
      let n = sector === 'aurifero' ? 2 : random() < 0.5 ? 1 : 0;
      n > 0;
      n--
    ) {
      const d = add('veta', 'gold');
      let c = int(from, to),
        row = int(18, 30);
      for (let k = int(3, 6); k > 0; k--) {
        place(d, c, row);
        c += random() < 0.5 ? 1 : -1;
        row += random() < 0.5 ? 1 : 0;
      }
    }
    // Gemas: bolsadas profundas en el sector de gemas.
    if (sector === 'gemas')
      for (const mineral of ['emerald', 'ruby', 'sapphire'] as MineralKey[]) {
        const d = add('bolsada', mineral);
        const c = int(from + 1, to - 2),
          row = int(26, 33);
        for (let y = 0; y < 2; y++)
          for (let x = 0; x < 2; x++)
            if (random() < 0.6) place(d, c + x, row + y);
        if (!d.cells.length) place(d, c, row);
      }
  });
  // Una caverna sellada por sector.
  const caverns: [number, number][][] = [];
  sectors.forEach((_, i) => {
    const [from, to] = span(i);
    const cx = int(from + 4, to - 4),
      cy = int(18, 30),
      rx = int(2, 3);
    const cells: [number, number][] = [];
    for (let y = cy - 1; y <= cy + 1; y++)
      for (let x = cx - rx; x <= cx + rx; x++)
        if (
          ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / 1.5) ** 2 <= 1 &&
          !reservedCell(x, y) &&
          x < limit - 2 &&
          grid.get(x, y) !== Block.Bedrock
        ) {
          grid.set(x, y, Block.Air);
          cells.push([x, y]);
        }
    caverns.push(cells);
  });
  for (const d of deposits)
    d.cells = d.cells.filter(
      ([x, y]) => grid.get(x, y) === oreBlock(d.mineral),
    );
  return { sectors, deposits: deposits.filter((d) => d.cells.length), caverns };
}

/** Generación original de 80 columnas (V3–V7), sin ningún cambio. */
function generateLegacy(seed: number): {
  grid: TerrainGrid;
  geology: Geology;
} {
  const grid = new TerrainGrid(LEGACY_COLUMNS, WORLD.rows);
  const random = rng(seed);
  const int = (a: number, b: number) => a + Math.floor(random() * (b - a + 1));
  // Estratos: tierra arriba, roca desde la fila 13, roca dura en profundidad.
  for (let row = 0; row < grid.rows; row++)
    for (let column = 0; column < grid.columns; column++) {
      if (row < surfaceRow(column)) continue;
      const edge =
        row === grid.rows - 1 || column === 0 || column === grid.columns - 1;
      let block = Block.Dirt;
      if (edge) block = Block.Bedrock;
      else if (row >= ROCK_TOP_ROW || isOutcrop(column, row)) {
        const hard =
          row >= HARD_ROCK_ROW &&
          (row >= HARD_ROCK_ROW + 4 ||
            cellNoise(seed, column >> 2, row >> 1) < 0.5);
        block = hard ? Block.HardRock : Block.Rock;
      }
      grid.set(column, row, block);
    }

  const others: SectorKind[] = ['cuprifero', 'aurifero', 'gemas'];
  for (let i = others.length - 1; i > 0; i--) {
    const j = int(0, i);
    [others[i], others[j]] = [others[j]!, others[i]!];
  }
  const sectors: SectorKind[] = ['carbonifero', ...others];
  const span = (kind: SectorKind) => {
    const start = sectors.indexOf(kind) * SECTOR_WIDTH;
    return [Math.max(1, start), start + SECTOR_WIDTH - 1] as const;
  };
  const anySector = () => sectors[int(0, sectors.length - 1)] as SectorKind;
  const deep = () => sectors[int(1, sectors.length - 1)] as SectorKind;
  const deposits: Deposit[] = [];
  const taken = new Set<string>();
  const place = (deposit: Deposit, column: number, row: number) => {
    const key = `${column},${row}`;
    if (
      column < 1 ||
      column > grid.columns - 2 ||
      row >= grid.rows - 1 ||
      reservedCell(column, row) ||
      taken.has(key)
    )
      return;
    const host = grid.get(column, row);
    if (host !== Block.Dirt && host !== Block.Rock && host !== Block.HardRock)
      return;
    grid.set(column, row, oreBlock(deposit.mineral));
    taken.add(key);
    deposit.cells.push([column, row]);
  };
  const add = (kind: DepositKind, mineral: MineralKey) => {
    const deposit: Deposit = { kind, mineral, cells: [] };
    deposits.push(deposit);
    return deposit;
  };

  // Mantos de carbón: tres en el sector carbonífero y uno por sector.
  const seams: SectorKind[] = [
    'carbonifero',
    'carbonifero',
    'carbonifero',
    ...others,
  ];
  for (const sector of seams) {
    const [from, to] = span(sector);
    const d = add('estratificado', 'coal');
    const length = int(6, 12),
      thickness = int(1, 2);
    let row = int(11, 18);
    const start = int(from, Math.max(from, to - length));
    for (let c = start; c < start + length; c++) {
      if ((c - start) % 4 === 3 && random() < 0.35)
        row = Math.max(11, Math.min(19, row + (random() < 0.5 ? -1 : 1)));
      for (let t = 0; t < thickness; t++) place(d, c, row + t);
    }
  }
  // Vetas de hierro: dos por sector, cruzan estratos en diagonal.
  for (const sector of sectors)
    for (let n = 0; n < 2; n++) {
      const [from, to] = span(sector);
      const d = add('veta', 'iron');
      let c = int(from, to),
        row = int(12, 24);
      const dx = random() < 0.5 ? 1 : -1;
      for (let i = int(6, 11); i > 0; i--) {
        place(d, c, row);
        c += dx;
        row += random() < 0.45 ? 1 : random() < 0.25 ? -1 : 0;
      }
    }
  // Cobre diseminado: una zona por sector y dos más en el cuprífero.
  for (const sector of [...sectors, 'cuprifero', 'cuprifero'] as SectorKind[]) {
    const [from, to] = span(sector);
    const d = add('diseminado', 'copper');
    const cx = int(from + 2, to - 2),
      cy = int(13, 24);
    for (let y = cy - 2; y <= cy + 2; y++)
      for (let x = cx - 3; x <= cx + 3; x++)
        if (
          ((x - cx) / 3.5) ** 2 + ((y - cy) / 2.5) ** 2 <= 1 &&
          random() < 0.3
        )
          place(d, x, y);
  }
  // Oro: vetas finas profundas y una bolsada en el sector aurífero.
  for (const sector of [...others, 'aurifero', 'aurifero'] as SectorKind[]) {
    const [from, to] = span(sector);
    const d = add('veta', 'gold');
    let c = int(from, to),
      row = int(18, 30);
    const dx = random() < 0.5 ? 1 : -1;
    for (let i = int(4, 7); i > 0; i--) {
      place(d, c, row);
      c += dx;
      row += random() < 0.5 ? 1 : 0;
    }
  }
  const pocket = (
    mineral: MineralKey,
    sector: SectorKind,
    rows: [number, number],
    chance: number,
  ) => {
    const [from, to] = span(sector);
    const d = add('bolsada', mineral);
    const c = int(from + 1, to - 2),
      row = int(rows[0], rows[1]);
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++)
        if (random() < chance) place(d, c + x, row + y);
    if (!d.cells.length) place(d, c, row);
  };
  pocket('gold', 'aurifero', [24, 31], 0.8);
  // Gemas: bolsadas profundas, sobre todo en el sector de gemas.
  for (const mineral of ['emerald', 'ruby'] as MineralKey[]) {
    pocket(mineral, 'gemas', [22, 32], 0.7);
    pocket(mineral, 'gemas', [22, 32], 0.7);
    pocket(mineral, deep(), [26, 33], 0.6);
  }
  pocket('sapphire', 'gemas', [27, 33], 0.55);
  if (random() < 0.5) pocket('sapphire', deep(), [28, 33], 0.5);
  // Chimenea de diamante: depósito especial y único.
  {
    const [from, to] = span('gemas');
    const d = add('especial', 'diamond');
    const c = int(from + 1, to - 2);
    for (let row = 28; row <= 33; row++) {
      if (random() < 0.22) place(d, c, row);
      if (random() < 0.12) place(d, c + 1, row);
    }
    if (!d.cells.length) place(d, c, 31);
  }

  // Cavernas selladas: no se ven hasta que la luz las alcanza.
  const caverns: [number, number][][] = [];
  const hollow = (cx: number, cy: number, rx: number, ry: number) => {
    const cells: [number, number][] = [];
    for (let y = cy - ry; y <= cy + ry; y++)
      for (let x = cx - rx; x <= cx + rx; x++)
        if (
          ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 <= 1 &&
          !reservedCell(x, y) &&
          x > 1 &&
          x < grid.columns - 2 &&
          y < grid.rows - 2 &&
          grid.get(x, y) !== Block.Bedrock
        ) {
          grid.set(x, y, Block.Air);
          taken.add(`${x},${y}`);
          cells.push([x, y]);
        }
    caverns.push(cells);
  };
  for (let n = 0; n < 3; n++) {
    const [from, to] = span(anySector());
    hollow(int(from + 3, to - 3), int(18, 30), int(2, 3), 1);
  }
  // El secreto: un único bloque en una cámara mínima, cerca del lecho.
  {
    const [from, to] = span(deep());
    const c = int(from + 3, to - 3),
      row = int(32, 33);
    for (const [x, y] of [
      [c - 1, row],
      [c - 2, row],
      [c - 1, row - 1],
    ] as const) {
      grid.set(x, y, Block.Air);
      taken.add(`${x},${y}`);
    }
    caverns.push([
      [c - 1, row],
      [c - 2, row],
      [c - 1, row - 1],
    ]);
    taken.delete(`${c},${row}`);
    grid.set(c, row, Block.HardRock);
    const d = add('especial', 'alien_ore');
    place(d, c, row);
  }
  // Una caverna puede haber vaciado parte de un yacimiento: registrar lo real.
  for (const d of deposits)
    d.cells = d.cells.filter(
      ([x, y]) => grid.get(x, y) === oreBlock(d.mineral),
    );

  // Galería horizontal excavada en la base del cerro.
  for (let row = TUNNEL.topRow; row <= TUNNEL.bottomRow; row++)
    for (let column = TUNNEL.fromColumn; column <= TUNNEL.toColumn; column++)
      grid.set(column, row, Block.Air);

  const geology = {
    seed,
    sectors,
    deposits: deposits.filter((d) => d.cells.length),
    caverns,
  };
  return { grid, geology };
}

/** Nueva semilla para una partida nueva. */
export function freshSeed(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0]! || DEFAULT_SEED;
}
