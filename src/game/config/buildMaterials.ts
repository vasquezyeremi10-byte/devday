import { Block } from '../world/TerrainGrid';
import { PALETTE as P } from './palette';

/**
 * V11: materiales de construcción. Cada uno es un suministro apilable del
 * inventario (SUPPLIES, categoría MATERIALES) ligado al bloque que se coloca.
 * Para añadir un material nuevo: una entrada en SUPPLIES, otra aquí, el bloque
 * en TerrainGrid y su tile en TerrainArt (más el ícono en V3Art).
 */
export const BUILD_MATERIALS = {
  mat_dirt: { block: Block.Dirt, tint: P.clay },
  mat_stone: { block: Block.Rock, tint: P.steel },
  mat_wood: { block: Block.Wood, tint: P.amber },
} as const;
export type BuildMaterial = keyof typeof BUILD_MATERIALS;
export const BUILD_MATERIAL_KEYS = Object.keys(
  BUILD_MATERIALS,
) as BuildMaterial[];

export const isBuildMaterial = (kind: string): kind is BuildMaterial =>
  Object.hasOwn(BUILD_MATERIALS, kind);

/** Bloque que se coloca con un material. */
export const blockOfMaterial = (kind: BuildMaterial): Block =>
  BUILD_MATERIALS[kind].block;

/**
 * Material que rinde un bloque al retirarlo; `null` si no es de construcción
 * (menas y cristal siguen a la carga minera). La roca dura y el escombro
 * rinden piedra; así nada se multiplica: un bloque retirado, una unidad.
 */
export function materialOfBlock(block: Block): BuildMaterial | null {
  switch (block) {
    case Block.Dirt:
      return 'mat_dirt';
    case Block.Rock:
    case Block.HardRock:
    case Block.Rubble:
      return 'mat_stone';
    case Block.Wood:
      return 'mat_wood';
    default:
      return null;
  }
}

/** Máximo apilable por material (evita desbordes y cantidades absurdas). */
export const STACK_MAX = 999;

/**
 * Alcance de colocación (px, del cuerpo del minero al centro de la celda):
 * tres bloques, un poco más que el de excavación para poder levantar
 * escaleras y pilares sin quedar a medio bloque.
 */
export const BUILD_REACH = 48;

/** Árboles talables de la superficie. */
export const TREE = {
  /** Hachazos para derribar un árbol. */
  hp: 6,
  /** Madera que rinde cada árbol. */
  wood: 8,
  /** Milisegundos entre hachazos mientras se mantiene el clic. */
  hitMs: 420,
  /** Alcance del hachazo (px, del cuerpo del minero al tronco). */
  reach: 44,
} as const;
