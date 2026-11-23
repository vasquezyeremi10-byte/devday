import { PALETTE as P } from './palette';

/**
 * Tabla central de minerales, en el orden económico del juego (ficticio, no
 * precios reales de materias primas). `pick` es el nivel mínimo de picota
 * (1 hierro, 2 tungsteno; la picota de diamante se retiró en V13); `chips` son los colores de las
 * partículas al romper el bloque. Precios en balance.ts (BALANCE.sale).
 */
export const MINERALS = [
  {
    key: 'coal',
    label: 'CARBON',
    rarity: 'MUY ABUNDANTE',
    pick: 1,
    chips: [P.ink, P.night, P.steel],
  },
  {
    key: 'iron',
    label: 'HIERRO',
    rarity: 'ABUNDANTE',
    pick: 1,
    chips: [P.rust, P.umber, P.clay],
  },
  {
    key: 'copper',
    label: 'COBRE',
    rarity: 'ABUNDANTE A MODERADO',
    pick: 1,
    chips: [P.clay, P.peach, P.mint],
  },
  {
    key: 'gold',
    label: 'ORO',
    rarity: 'POCO FRECUENTE',
    pick: 1,
    chips: [P.gold, P.cream, P.amber],
  },
  {
    key: 'emerald',
    label: 'ESMERALDA',
    rarity: 'RARA',
    pick: 2,
    chips: [P.mint, P.teal, P.pine],
  },
  {
    key: 'ruby',
    label: 'RUBI',
    rarity: 'RARA',
    pick: 2,
    chips: [P.red, P.peach, P.rust],
  },
  {
    key: 'sapphire',
    label: 'ZAFIRO',
    rarity: 'MUY RARA',
    pick: 2,
    chips: [P.blue, P.mist, P.sky],
  },
  {
    key: 'diamond',
    label: 'DIAMANTE',
    rarity: 'EXTREMADAMENTE RARO',
    pick: 2,
    chips: [P.white, P.mist, P.silver],
  },
  {
    key: 'alien_ore',
    label: 'MINERAL DESCONOCIDO',
    rarity: '???',
    pick: 2,
    chips: [P.mint, P.peach, P.white],
  },
  // V10: cristal de las cavernas. Va al final para no mover los índices de las
  // demás menas (el bloque Block.Crystal se resuelve aparte en TerrainGrid).
  {
    key: 'violet_crystal',
    label: 'CRISTAL VIOLETA',
    rarity: 'MISTERIOSO',
    pick: 1,
    chips: [P.plum, P.duskViolet, P.mauve],
  },
] as const;

export type MineralKey = (typeof MINERALS)[number]['key'];
export const MINERAL_KEYS: readonly MineralKey[] = MINERALS.map((m) => m.key);
export const mineralInfo = (key: MineralKey) =>
  MINERALS.find((m) => m.key === key)!;
