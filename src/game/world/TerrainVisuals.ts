import { Block, isOutcrop, mineralOf, surfaceRow, type TerrainGrid } from './TerrainGrid';
import { earthGroup, rockTopRow } from '../config/biomes';

/**
 * Representación geológica del terreno. Todo aquí es solo gráfico: la
 * colisión, la excavación y el inventario dependen únicamente de TerrainGrid.
 *
 * Cada material es una macrotextura continua de 8 × 4 tiles (128 × 64 px).
 * Un bloque toma la ventana que corresponde a su posición en el mundo, así
 * que las piedras y grietas continúan entre bloques vecinos y la cuadrícula
 * no se lee como ladrillos. El patrón solo se repite cada 128 × 64 px.
 */
export const MACRO_COLUMNS = 8;
export const MACRO_ROWS = 4;
const MACRO = MACRO_COLUMNS * MACRO_ROWS;

/** Materiales visuales en el orden en que se apilan en la textura. */
export const MATERIALS = [
  'soil', // suelo superficial: terrones y raíces bajo el pasto
  'subsoil', // material meteorizado: tierra con fragmentos de roca
  'weathered', // roca alterada del contacto tierra-roca
  'rock', // roca competente con vetillas de cuarzo
  'fractured', // zonas de bloques fracturados
  'deep', // roca profunda, más oscura y masiva
  // Afloramiento del desierto: arenisca rojiza expuesta al sol. Antes estas
  // rocas de superficie tomaban la roca gris azulada del subsuelo y se leían
  // como bloques ajenos sobre la arena.
  'outcrop',
  // V9, biomas (agregados al final para no mover ningún índice existente):
  'gravel', // granito de la montaña: roca viva gris clara de la cresta
  'sand', // arena de playa húmeda de la costa
  'forest', // tierra de bosque: marrón oscura con raíces y briznas verdes
] as const;
export type Material = (typeof MATERIALS)[number];

/** Primer frame de la fila de piezas especiales, tras las macrotexturas. */
const SPECIAL = MATERIALS.length * MACRO;
export const TerrainFrame = {
  Bedrock: SPECIAL,
  BedrockAlt: SPECIAL + 1,
  Grass: SPECIAL + 2,
  GrassLeft: SPECIAL + 3,
  GrassRight: SPECIAL + 4,
  GrassPeak: SPECIAL + 5,
  /** 16 bordes de autotile (máscara arriba 1, derecha 2, abajo 4, izquierda 8). */
  EdgeFirst: SPECIAL + 16,
  /** Franjas de transición: tierra sobre roca (4) y roca sobre roca profunda (4). */
  TransitionFirst: SPECIAL + 32,
  /** Cuatro etapas de agrietamiento al golpear un bloque. */
  CrackFirst: SPECIAL + 40,
  /** Nueve menas consecutivas en el orden de MINERALS: carbón … alienígena. */
  OreFirst: SPECIAL + 48,
  Rubble: SPECIAL + 57,
  RubbleAlt: SPECIAL + 58,
  HardRock: SPECIAL + 59,
  HardRockAlt: SPECIAL + 60,
  /** V10: cristal violeta de las cavernas (dos variantes). */
  Crystal: SPECIAL + 61,
  CrystalAlt: SPECIAL + 62,
  /** V11: tablones de madera colocados por el jugador. */
  Wood: SPECIAL + 63,
  // V9, biomas: cuatro variantes de arena de playa (costa) y cuatro de pasto
  // verde (valle, bosque, pinos y monolitos), al final para no mover nada.
  SandTop: SPECIAL + 64,
  SandTopLeft: SPECIAL + 65,
  SandTopRight: SPECIAL + 66,
  SandTopPeak: SPECIAL + 67,
  GreenTop: SPECIAL + 68,
  GreenTopLeft: SPECIAL + 69,
  GreenTopRight: SPECIAL + 70,
  GreenTopPeak: SPECIAL + 71,
} as const;
export const TERRAIN_FRAME_COUNT = SPECIAL + 72;
export const TERRAIN_TEXTURE_COLUMNS = MACRO_COLUMNS;

/**
 * Fila de contacto tierra-roca y comienzo del estrato profundo. El valor
 * exportado es el del desierto (los biomas usan rockTopRow por columna).
 */
export const ROCK_TOP_ROW = 13;
export const DEEP_STRATUM_ROW = 24;

/** Hash entero estable: variación sin aleatoriedad, igual en cada reinicio. */
export const hash = (column: number, row: number) =>
  ((column * 73856093) ^ (row * 19349663)) >>> 0;

const mod = (value: number, size: number) => ((value % size) + size) % size;

/**
 * Material de la tierra según la zona de la columna: todo el mundo es
 * desierto, con su estrato de dos capas (soil y subsoil), salvo la arena
 * húmeda de La Portada, con mezcla tramada en el cruce. Los materiales
 * `forest` y los cuadros verdes de V9 quedan en el atlas sin uso, para no
 * mover ningún índice.
 */
function dirtMaterial(column: number, row: number): Material {
  // En el cruce, cada terrón bajo la cubierta se mezcla por bloques.
  if (earthGroup(column, row) === 'sand') return 'sand';
  return row <= surfaceRow(column) + 1 ? 'soil' : 'subsoil';
}

/** Material base de una celda sólida, sin afloramientos de superficie. */
function stratumMaterial(column: number, row: number, block: Block): Material {
  if (block === Block.Dirt) return dirtMaterial(column, row);
  if (row >= DEEP_STRATUM_ROW) return 'deep';
  if (row === rockTopRow(column)) return 'weathered';
  // La montaña tiene su granito propio desde su contacto hacia abajo.
  if (row > rockTopRow(column) && rockTopRow(column) <= 11) return 'gravel';
  // Zonas fracturadas de 3 × 3 bloques, distribuidas sin patrón regular.
  if (hash(Math.floor(column / 3), Math.floor(row / 3)) % 5 === 0)
    return 'fractured';
  return 'rock';
}

export function materialAt(
  grid: TerrainGrid,
  column: number,
  row: number,
): Material {
  if (isOutcrop(column, row)) return 'outcrop';
  return stratumMaterial(column, row, grid.get(column, row));
}

/** Ventana de la macrotextura según la posición del bloque en el mundo. */
export function macroFrame(
  material: Material,
  column: number,
  row: number,
): number {
  // El contacto alterado ocupa una sola fila: sin desplazamiento repetiría la
  // misma franja cada 128 px. Cada tramo de 8 bloques toma otra franja.
  const shift =
    material === 'weathered'
      ? hash(Math.floor(column / MACRO_COLUMNS), 7) % MACRO_ROWS
      : 0;
  return (
    MATERIALS.indexOf(material) * MACRO +
    mod(row + shift, MACRO_ROWS) * MACRO_COLUMNS +
    mod(column, MACRO_COLUMNS)
  );
}

/**
 * Aspecto de un bloque no descubierto: la roca o tierra de su estrato, sin
 * revelar mena. Así un bloque oculto no delata lo que contiene.
 */
export function hiddenFrame(column: number, row: number): number {
  const material: Material = isOutcrop(column, row)
    ? 'outcrop'
    : stratumMaterial(
        column,
        row,
        row < rockTopRow(column) ? Block.Dirt : Block.Rock,
      );
  return macroFrame(material, column, row);
}

export function terrainFrame(
  grid: TerrainGrid,
  column: number,
  row: number,
  revealed: (column: number, row: number) => boolean = () => true,
): number {
  const block = grid.get(column, row);
  if (block === Block.Air) return -1;
  if (block === Block.Bedrock)
    return hash(column, row) % 2
      ? TerrainFrame.BedrockAlt
      : TerrainFrame.Bedrock;
  if (block === Block.Rubble)
    return hash(column, row) % 2 ? TerrainFrame.RubbleAlt : TerrainFrame.Rubble;
  // La madera solo existe colocada por el jugador: nunca se oculta.
  if (block === Block.Wood) return TerrainFrame.Wood;
  // Todo bloque no descubierto se ve como su estrato: ni mena ni roca dura.
  if (!revealed(column, row)) return hiddenFrame(column, row);
  if (block === Block.HardRock)
    return hash(column, row) % 2
      ? TerrainFrame.HardRockAlt
      : TerrainFrame.HardRock;
  if (block === Block.Crystal)
    return hash(column, row) % 2
      ? TerrainFrame.CrystalAlt
      : TerrainFrame.Crystal;
  if (mineralOf(block)) return TerrainFrame.OreFirst + block - Block.Coal;
  if (block === Block.Dirt && row === surfaceRow(column)) {
    // Esquinas redondeadas donde la ladera cae hacia un vecino más bajo.
    const left = surfaceRow(column - 1) > row;
    const right = surfaceRow(column + 1) > row;
    // La costra del desierto o la arena de La Portada, según la zona de la
    // columna (con la mezcla tramada del cruce).
    const [plain, leftF, rightF, peak] =
      earthGroup(column) === 'sand'
        ? ([
            TerrainFrame.SandTop,
            TerrainFrame.SandTopLeft,
            TerrainFrame.SandTopRight,
            TerrainFrame.SandTopPeak,
          ] as const)
        : ([
            TerrainFrame.Grass,
            TerrainFrame.GrassLeft,
            TerrainFrame.GrassRight,
            TerrainFrame.GrassPeak,
          ] as const);
    if (left && right) return peak;
    if (left) return leftF;
    if (right) return rightF;
    return plain;
  }
  return macroFrame(materialAt(grid, column, row), column, row);
}

/**
 * Autotile de bordes: contorno en las caras expuestas al aire. La superficie
 * natural no recibe contorno superior para no oscurecer el pasto.
 */
export function edgeFrame(
  grid: TerrainGrid,
  column: number,
  row: number,
  revealed: (column: number, row: number) => boolean = () => true,
): number {
  if (!grid.isSolid(column, row)) return -1;
  // Un hueco no descubierto (caverna sellada) no dibuja contorno: no se delata.
  const open = (dx: number, dy: number) =>
    grid.contains(column + dx, row + dy) &&
    !grid.isSolid(column + dx, row + dy) &&
    revealed(column + dx, row + dy);
  // Solo la fila de pasto natural no lleva contorno superior; un bloque
  // colocado sobre la superficie sí.
  const natural = row === surfaceRow(column);
  const mask =
    (open(0, -1) && !natural ? 1 : 0) |
    (open(1, 0) ? 2 : 0) |
    (open(0, 1) ? 4 : 0) |
    (open(-1, 0) ? 8 : 0);
  return mask ? TerrainFrame.EdgeFirst + mask : -1;
}

/** Franja irregular donde un estrato apoya sobre otro (solo bloques intactos). */
export function transitionFrame(
  grid: TerrainGrid,
  column: number,
  row: number,
): number {
  const block = grid.get(column, row);
  if (block !== Block.Rock) return -1;
  const above = grid.get(column, row - 1);
  const variant = hash(column, row) % 4;
  if (row === rockTopRow(column) && above === Block.Dirt)
    return TerrainFrame.TransitionFirst + variant;
  if (row === DEEP_STRATUM_ROW && above === Block.Rock)
    return TerrainFrame.TransitionFirst + 4 + variant;
  return -1;
}
