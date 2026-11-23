import {
  BIOME_BAND,
  biomeDef,
  columnNoise,
  ditheredBiome,
  type BiomeId,
} from '../config/biomes';
import { WORLD, WORLD_FIRST_COLUMN } from '../config/constants';
import type { FloraPart } from './structures/Flora';

/**
 * Decoración de las zonas del desierto (V9; solo desierto desde el 18 de
 * noviembre de 2026): flora del norte de Chile y rocas por columna, elegidas con
 * ruido estable por columna (sin semilla ni azar al cargar), así cada zona
 * se ve igual cada vez que se vuelve a ella. En las bandas de cruce cada
 * columna toma una de las dos zonas para mezclar las poblaciones en el borde.
 *
 * El desierto central (columnas −40..139) conserva su decoración hecha a
 * mano en world/Scenery.ts; aquí solo se generan la Mano del Desierto y el
 * este.
 */
export type DecorEntry = readonly [FloraPart, number, number];

export interface BiomeDecorSet {
  trees: DecorEntry[];
  plants: DecorEntry[];
  rocks: DecorEntry[];
}

const KINDS: Record<
  BiomeId,
  { trees: FloraPart[]; plants: FloraPart[]; rocks: FloraPart[] }
> = {
  salar: {
    trees: ['cachiyuyo'],
    plants: ['grama_salada', 'grama_salada', 'cojin_atacameno'],
    rocks: ['pebble_gray', 'desert_rock_small', 'pebble_gray'],
  },
  moon: {
    trees: ['brea'],
    plants: ['cojin_atacameno', 'brea', 'grama_salada'],
    rocks: ['boulder', 'desert_rock_large', 'desert_rock_small', 'boulder'],
  },
  sierra: {
    trees: ['copao_joven', 'brea'],
    plants: ['cachiyuyo', 'brea', 'copiapoa'],
    rocks: ['desert_rock_small', 'desert_rock_large', 'pebble_gray'],
  },
  paranal: {
    trees: ['copao', 'copao_joven'],
    plants: ['copiapoa', 'cachiyuyo', 'nolana'],
    rocks: ['desert_rock_large', 'boulder', 'desert_rock_small'],
  },
  hand: {
    trees: ['copao_joven', 'copao'],
    plants: ['copiapoa', 'cachiyuyo', 'brea'],
    rocks: ['desert_rock_small', 'desert_rock_large', 'desert_rock_small'],
  },
  desert: {
    trees: ['brea', 'cachiyuyo'],
    plants: ['grama_salada', 'cachiyuyo', 'cojin_atacameno'],
    rocks: ['desert_rock_small', 'desert_rock_large'],
  },
  pampa: {
    trees: ['cachiyuyo'],
    plants: ['grama_salada', 'cachiyuyo', 'grama_salada'],
    rocks: ['desert_rock_small', 'pebble_gray', 'desert_rock_small'],
  },
  fcab: {
    trees: ['brea', 'cachiyuyo'],
    plants: ['cachiyuyo', 'brea', 'grama_salada'],
    rocks: ['desert_rock_small', 'pebble_gray'],
  },
  huanchaca: {
    trees: ['cachiyuyo', 'copao_joven'],
    plants: ['brea', 'copiapoa', 'cachiyuyo'],
    rocks: ['desert_rock_large', 'desert_rock_small', 'boulder'],
  },
  hills: {
    trees: ['copao', 'copao_joven'],
    plants: ['copiapoa', 'nolana', 'cachiyuyo'],
    rocks: ['boulder', 'desert_rock_large', 'pebble_gray', 'desert_rock_small'],
  },
  portada: {
    trees: [],
    plants: ['nolana', 'grama_salada', 'nolana'],
    rocks: ['pebble_gray', 'boulder', 'pebble_gray'],
  },
};

/** Columnas con decoración generada: del borde oeste a la Mano del Desierto y el este. */
export const DECOR_RANGES: readonly (readonly [number, number])[] = [
  [WORLD_FIRST_COLUMN + 2, biomeDef('hand').to - 1],
  [biomeDef('pampa').from, WORLD.columns - 3],
];

const pick = <T>(list: readonly T[], column: number, channel: number): T =>
  list[Math.floor(columnNoise(column, channel) * list.length)]!;

/** Desplazamiento entero −4..4 px dentro de la celda. */
const offset = (column: number, channel: number) =>
  Math.floor(columnNoise(column, channel) * 9) - 4;

export function biomeDecor(): BiomeDecorSet {
  const set: BiomeDecorSet = { trees: [], plants: [], rocks: [] };
  for (const [from, to] of DECOR_RANGES) {
    let lastTree = -Infinity;
    for (let column = from; column <= to; column++) {
      const biome = ditheredBiome(column, BIOME_BAND, 11);
      const rule = biomeDef(biome).decor;
      const kinds = KINDS[biome];
      if (
        kinds.trees.length &&
        columnNoise(column, 21) < rule.trees &&
        column - lastTree >= rule.treeGap
      ) {
        set.trees.push([pick(kinds.trees, column, 22), column, offset(column, 23)]);
        lastTree = column;
        // Bajo un árbol no se amontona nada más.
        continue;
      }
      if (columnNoise(column, 31) < rule.rocks)
        set.rocks.push([pick(kinds.rocks, column, 32), column, offset(column, 33)]);
      else if (columnNoise(column, 41) < rule.plants)
        set.plants.push([pick(kinds.plants, column, 42), column, offset(column, 43)]);
    }
  }
  return set;
}
