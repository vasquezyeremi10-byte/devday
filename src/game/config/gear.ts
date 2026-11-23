/**
 * Equipamiento de protección personal (EPP), ranuras, niveles y casillas.
 * Valores de balance del videojuego, centralizados para ajustarlos.
 */

/** Ranuras del panel del personaje. */
export const EQUIP_SLOTS = [
  'head',
  'eyes',
  'torso',
  'hands',
  'feet',
  'tool',
  'accessory',
] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

export const SLOT_LABEL: Record<EquipSlot, string> = {
  head: 'CABEZA',
  eyes: 'OJOS',
  torso: 'TORSO',
  hands: 'MANOS',
  feet: 'PIES',
  tool: 'HERRAMIENTA',
  accessory: 'ACCESORIO',
};

export const PPE = {
  helmet: {
    grams: 650,
    label: 'CASCO MINERO',
    short: 'CASCO',
    slot: 'head',
    price: 0,
    tier: 1,
    required: true,
    desc: 'PROTEGE LA CABEZA. LLEVA LA LAMPARA FRONTAL.',
  },
  goggles: {
    grams: 80,
    label: 'GAFAS DE SEGURIDAD',
    short: 'GAFAS',
    slot: 'eyes',
    price: 0,
    tier: 1,
    required: true,
    desc: 'PROTEGEN LOS OJOS DE ESQUIRLAS Y POLVO.',
  },
  vest: {
    grams: 250,
    label: 'CHALECO REFLECTANTE',
    short: 'CHALECO',
    slot: 'torso',
    price: 0,
    tier: 1,
    required: true,
    desc: 'TE HACE VISIBLE EN LA MINA. OBLIGATORIO.',
  },
  gloves: {
    grams: 150,
    label: 'GUANTES DE SEGURIDAD',
    short: 'GUANTES',
    slot: 'hands',
    price: 0,
    tier: 1,
    required: true,
    desc: 'PROTEGEN LAS MANOS AL TRABAJAR LA ROCA.',
  },
  boots: {
    grams: 1_600,
    label: 'BOTAS DE SEGURIDAD',
    short: 'BOTAS',
    slot: 'feet',
    price: 0,
    tier: 1,
    required: true,
    desc: 'PUNTERA DE ACERO. OBLIGATORIAS EN LA MINA.',
  },
  ear: {
    grams: 240,
    label: 'PROTECTOR AUDITIVO',
    short: 'AUDITIVO',
    slot: 'accessory',
    price: 12,
    tier: 2,
    required: false,
    desc: 'PARA PERFORAR Y TRONAR: -20% DANO DE EXPLOSION.',
  },
} as const;
export type PPEKind = keyof typeof PPE;
export const PPE_KEYS = Object.keys(PPE) as PPEKind[];
/**
 * Precios que tenía el EPP básico en V4 (antes de ser gratuito). Solo se usan
 * para la compensación única de partidas V4 que lo compraron.
 */
export const V4_PPE_PRICE: Record<string, number> = {
  helmet: 20,
  goggles: 10,
  vest: 20,
  gloves: 10,
  boots: 15,
};
/** Conjunto básico obligatorio y gratuito, en orden de la lista de acceso. */
export const REQUIRED_PPE: PPEKind[] = [
  'helmet',
  'boots',
  'vest',
  'gloves',
  'goggles',
];

/** Efectos de juego del EPP (no garantiza inmunidad ante accidentes graves). */
export const PPE_EFFECT = {
  /** El casco reduce el golpe de rocas sueltas, no el aplastamiento. */
  helmetRock: 0.7,
  /** El protector auditivo reduce el daño de una tronadura cercana. */
  earBlast: 0.8,
} as const;

export const MAX_SLOTS = 24;
/** V11: barra rápida de nueve casillas (teclas 1 a 9). */
export const QUICKBAR_SIZE = 9;

export const MAX_LEVEL = 30;
export const XP_CURVE = 2;
export const xpToNext = (level: number): number =>
  level >= MAX_LEVEL ? 0 : Math.round(100 * level ** 1.35);
const thresholds = [0, 0];
for (let level = 1; level < MAX_LEVEL; level++)
  thresholds.push(thresholds[level]! + xpToNext(level));

/** Experiencia total necesaria para alcanzar un nivel. */
export const xpForLevel = (level: number): number =>
  thresholds[Math.max(1, Math.min(MAX_LEVEL, level))]!;

export const LEVEL_REWARD = {
  gold: 25,
  miningPoints: 1,
  speedPerPoint: 0.02,
  minTimeFactor: 0.65,
} as const;

/** Experiencia por acciones verificables (sin repetición abusiva). */
export const XP = {
  block: 2,
  discovery: 25,
  ore: {
    coal: 5,
    iron: 8,
    copper: 10,
    gold: 20,
    emerald: 30,
    ruby: 30,
    sapphire: 30,
    diamond: 30,
    alien_ore: 30,
    violet_crystal: 20,
  },
  /** Por cada 5 monedas de venta. */
  salePer5: 1,
  rail: 3,
  support: 5,
  blast: 5,
  tier: 50,
  quest: 30,
} as const;

/** Una jornada de juego: 10 minutos de partida activa. */
export const DAY_MS = 10 * 60_000;
/** Jornadas sin derrumbes y con sostenimiento para INGENIERO PREVISOR. */
export const ENGINEER_DAYS = 3;
export const ENGINEER_SUPPORTS = 3;
