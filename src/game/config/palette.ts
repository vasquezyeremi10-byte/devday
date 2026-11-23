/**
 * Paleta V6 «Cielo y socavón»: 40 colores planos, sin alfa parcial.
 *
 * Los 24 nombres históricos conservan su función (tinta, noche, madera,
 * metal…) pero adoptan los tonos de la dirección artística V6: cielo azul
 * intenso, montañas azul violeta, verdes saturados, madera cálida, metales
 * azul acero, luminarias doradas y oscuridad azul marino. Los 16 tonos
 * nuevos cubren cielo, cordilleras, follaje, suelos, rocas sedimentarias y
 * violáceas, y el halo de las antorchas.
 *
 * Subpaletas recomendadas (3–6 colores por objeto):
 * - Cielo: sky, azure, blue, mist, white.
 * - Montañas: violet, cobalt, dusk, indigo, mist (nieve).
 * - Vegetación: pine, forest, teal, mint, moss, lime.
 * - Madera: umber, earth, clay, ochre, amber.
 * - Metal: ink, slate, stone, steel, silver.
 * - Luz: ember, orange, gold, cream, white.
 * - Suelo: umber, earth, soil, loam, sand.
 * - Roca: night, slate, stone, plum, mauve, taupe, khaki.
 *
 * V7 (Atacama) añade 9 tonos: arena, tierra, montaña, roca, cielo, ocaso y
 * noche del desierto, más el rosado del amanecer y el violeta del ocaso.
 * - Desierto: desertSand, desertSoil, desertMountain, desertRock.
 * - Cielo V7: desertSky, desertSunset, dawnPink, duskViolet, desertNight.
 */
export const PALETTE = {
  // Oscuridad y metales (azul acero).
  ink: 0x0d1020,
  night: 0x15182b,
  slate: 0x212c48,
  stone: 0x3e4c6a,
  steel: 0x71829a,
  silver: 0xb4c3d3,
  white: 0xffffff,
  // Luminarias.
  cream: 0xffe29a,
  gold: 0xf4b341,
  amber: 0xe08a1e,
  // Madera y tierra.
  clay: 0x9a5a33,
  earth: 0x5b362d,
  umber: 0x461f15,
  rust: 0x9c3a24,
  red: 0xd9473a,
  peach: 0xf2a06a,
  // Cielo.
  sky: 0x2d63ac,
  blue: 0x4693dd,
  mist: 0xa8d8eb,
  // Vegetación.
  pine: 0x184d39,
  teal: 0x2e7a4a,
  mint: 0x6cbf5a,
  moss: 0x8ead39,
  sand: 0xd9ae72,
  // V6: tonos nuevos.
  azure: 0x3a78c6,
  violet: 0x5a69bb,
  cobalt: 0x4979d2,
  dusk: 0x3e4a8e,
  indigo: 0x2b3466,
  forest: 0x236044,
  lime: 0xb9d25a,
  ochre: 0xbe7f1a,
  soil: 0x7e4a2c,
  loam: 0xa8683a,
  ember: 0x8c3214,
  orange: 0xf07a26,
  plum: 0x4a3a5c,
  mauve: 0x786a8e,
  taupe: 0x6e5e52,
  khaki: 0x9a8670,
  // V7: Atacama, cielo y noche. Los colores históricos se conservan.
  desertSand: 0xd8a66b,
  desertSoil: 0xba7148,
  desertMountain: 0x98563f,
  desertRock: 0x6b493d,
  desertSky: 0x3989d6,
  desertSunset: 0xf39a52,
  desertNight: 0x101b38,
  // V7: rosado del amanecer y violeta del ocaso (cielo, nubes y cerros).
  dawnPink: 0xe48a9a,
  duskViolet: 0x6a4a8c,
} as const;
export type PaletteColor = keyof typeof PALETTE;

/**
 * Paleta histórica de 24 colores (V0.1–V5). Solo la usa la migración de
 * recursos PNG (scripts/art/remap-palette-v6.mjs) y su prueba: cada color
 * antiguo pasa exactamente al tono V6 del mismo nombre.
 */
export const LEGACY_PALETTE = {
  ink: 0x101426,
  night: 0x20243a,
  slate: 0x343c54,
  stone: 0x586078,
  steel: 0x8890a0,
  silver: 0xb8c0c0,
  white: 0xffffff,
  cream: 0xffecb0,
  gold: 0xf8c058,
  amber: 0xd89038,
  clay: 0xb86838,
  earth: 0x804830,
  umber: 0x503028,
  rust: 0x983c30,
  red: 0xd85040,
  peach: 0xf89858,
  sky: 0x385878,
  blue: 0x587ca0,
  mist: 0x88acb8,
  pine: 0x244c50,
  teal: 0x388078,
  mint: 0x70b890,
  moss: 0x687848,
  sand: 0xc8a070,
} as const;

export const cssColor = (color: number): string =>
  `#${color.toString(16).padStart(6, '0')}`;
