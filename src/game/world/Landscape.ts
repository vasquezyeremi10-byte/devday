import { BIOMES, biomeDef, type BiomeId } from '../config/biomes';
import { TILE_SIZE, VIEW, WORLD_LEFT } from '../config/constants';

export const LANDSCAPE_STRIP = 512;
export const SEA_TOP = 118;
const COAST = biomeDef('portada').from * TILE_SIZE;

type Planes = readonly [number, number, number, number];
interface Profile {
  lift: Planes;
  relief: number;
  spacing: number;
  plateau: number;
  strata: number;
  salt: number;
}

/** Alturas relativas y rasgos de la roca en los cuatro planos. */
const PROFILES: Record<BiomeId, Profile> = {
  // Mundo abierto: el salar es llano y blanco de sal; el Valle de la Luna,
  // crestas recortadas; Sierra Gorda, lomas mineras; Paranal, cerros altos.
  salar: {
    lift: [10, 22, 20, 10],
    relief: 0.36,
    spacing: 1.5,
    plateau: 0.7,
    strata: 0.25,
    salt: 1,
  },
  moon: {
    lift: [-4, -8, -6, 0],
    relief: 1.3,
    spacing: 0.85,
    plateau: 0.2,
    strata: 1,
    salt: 0.45,
  },
  sierra: {
    lift: [2, 4, 2, 2],
    relief: 0.9,
    spacing: 1.05,
    plateau: 0.45,
    strata: 0.7,
    salt: 0.1,
  },
  paranal: {
    lift: [-6, -14, -12, -2],
    relief: 1.15,
    spacing: 1,
    plateau: 0.3,
    strata: 0.6,
    salt: 0.05,
  },
  hand: {
    lift: [3, 0, 3, 0],
    relief: 0.92,
    spacing: 1.15,
    plateau: 0.78,
    strata: 0.55,
    salt: 0.12,
  },
  desert: {
    lift: [0, 0, 0, 0],
    relief: 1,
    spacing: 1,
    plateau: 0.18,
    strata: 0.5,
    salt: 0.04,
  },
  pampa: {
    lift: [8, 20, 19, 8],
    relief: 0.42,
    spacing: 1.4,
    plateau: 0.6,
    strata: 0.3,
    salt: 1,
  },
  fcab: {
    lift: [3, 9, 6, 5],
    relief: 0.76,
    spacing: 1.05,
    plateau: 0.7,
    strata: 0.76,
    salt: 0.38,
  },
  huanchaca: {
    lift: [-1, 2, -9, -3],
    relief: 1.02,
    spacing: 0.95,
    plateau: 0.33,
    strata: 0.98,
    salt: 0.12,
  },
  hills: {
    lift: [-8, -15, -17, -3],
    relief: 1.22,
    spacing: 0.92,
    plateau: 0.12,
    strata: 0.85,
    salt: 0.03,
  },
  portada: {
    lift: [3, 14, 9, 4],
    relief: 0.66,
    spacing: 1.1,
    plateau: 0.2,
    strata: 0.68,
    salt: 0.55,
  },
};

export interface LandscapePlane {
  key: string;
  factor: number;
  depth: number;
  ridge: readonly [height: number, amplitude: number, spacing: number];
  bottom: number;
  shadeDepth: number;
  /** Extremo en pantalla visto desde el límite costero y largo de la ladera. */
  coast: readonly [edge: number, width: number];
}

export const LANDSCAPE: readonly LandscapePlane[] = [
  {
    key: 'v7-range-far',
    factor: 0.08,
    depth: 0.5,
    ridge: [89, 34, 143],
    bottom: 200,
    shadeDepth: 60,
    coast: [252, 222],
  },
  {
    key: 'v7-range-red',
    factor: 0.18,
    depth: 1,
    ridge: [91, 43, 193],
    bottom: 180,
    shadeDepth: 52,
    coast: [222, 210],
  },
  {
    key: 'v7-range-hills',
    factor: 0.36,
    depth: 1.5,
    ridge: [122, 29, 165],
    bottom: 176,
    shadeDepth: 37,
    coast: [210, 176],
  },
  {
    key: 'v7-range-dunes',
    factor: 0.58,
    depth: 2,
    ridge: [151, 12, 61],
    bottom: 176,
    shadeDepth: 12,
    coast: [261, 150],
  },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

function ridgeAt(
  x: number,
  layer: number,
  plane: LandscapePlane,
  profile: Profile,
): number {
  const [height, amplitude, spacing] = plane.ridge;
  const a = (x * Math.PI * 2) / (spacing * profile.spacing) + layer * 1.11;
  const broad =
    Math.cos(a + Math.sin(a * 0.46) * 0.75) * 0.66 +
    Math.sin(a * 0.57 + 1.7) * 0.28;
  const rock = Math.sin(a * 2.37 + 0.6) * 0.17 + Math.sin(a * 4.9) * 0.05;
  const summit = broad + rock;
  // Las mesetas ganan una cima ancha y baja, con pequeñas ondulaciones.
  const peak = summit - profile.plateau * 0.51 * smooth((summit + 0.08) / 1.12);
  return height + profile.lift[layer]! - peak * amplitude * profile.relief;
}

/** Fronteras proyectadas en este plano. La mezcla se extiende a ambos lados. */
function profileAt(x: number, factor: number): [Profile, Profile, number] {
  const worldX = VIEW.width / 2 + (x - VIEW.width / 2) / factor;
  // Los fondos lentos disponen también de espacio para mezclar el relieve.
  const half = 272 + 16 / factor;
  for (let i = 0; i < BIOMES.length - 1; i++) {
    const next = BIOMES[i + 1]!;
    const edge = next.from * TILE_SIZE;
    if (worldX < edge + half) {
      return [
        PROFILES[BIOMES[i]!.id],
        PROFILES[next.id],
        smooth((worldX - edge + half) / (2 * half)),
      ];
    }
  }
  return [PROFILES.portada, PROFILES.portada, 0];
}

export function landscapeBounds(
  plane: LandscapePlane,
): [first: number, end: number] {
  const first = Math.round(WORLD_LEFT * plane.factor);
  const end =
    Math.round((COAST - VIEW.width / 2) * plane.factor) + plane.coast[0];
  return [first, end];
}

/**
 * Columna del paisaje. Usa coordenadas absolutas del plano para que los
 * fragmentos de textura y ambos lados de cada frontera dibujen el mismo cerro.
 */
export function landscapeColumn(
  plane: LandscapePlane,
  layer: number,
  x: number,
) {
  const [, end] = landscapeBounds(plane);
  const [, coastWidth] = plane.coast;
  const [left, right, t] = profileAt(x, plane.factor);
  const terrain = lerp(
    ridgeAt(x, layer, plane, left),
    ridgeAt(x, layer, plane, right),
    t,
  );
  // La cordillera lejana cubre el horizonte marino hacia el interior.
  const inland = layer === 0 ? Math.min(terrain, SEA_TOP - 3) : terrain;
  const coast = (x - (end - coastWidth)) / coastWidth;
  // Solo baja la cresta. La roca sigue llena hasta la base, de modo que el
  // agua aparece por encima de la ladera y el relieve se hunde al llegar al pie.
  const crest = lerp(inland, plane.bottom + 6, smooth(coast));
  return {
    crest,
    strata: lerp(left.strata, right.strata, t),
    salt: lerp(left.salt, right.salt, t),
  };
}
