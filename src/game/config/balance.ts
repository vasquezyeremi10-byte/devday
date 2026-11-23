import { Block, mineralOf } from '../world/TerrainGrid';
import type { MineralKey } from './minerals';

/** Unidades: bloques, milisegundos y monedas enteras. Balance V3. */
export const BALANCE = {
  /**
   * V5: el EPP básico es gratuito (kit de la bodega). Alcanza para picota y
   * pala (25) con margen para rieles, vigas y antorchas.
   */
  initialMoney: 50,
  /** Carga por peso: 50 kg encima del minero y 100 kg en el carro (≈ 1 kg por bloque). */
  personalCapacity: 50,
  cartCapacity: 100,
  /**
   * Pala: 2 s por unidad de material suelto. Rige al palear tierra o
   * escombro, recoger pilas y cargar el carro (2 s por bloque).
   */
  shovelMs: 2000,
  interactionRadius: 32,
  cartSpeed: 55,
  cartAcceleration: 100,
  cartBrake: 160,
  /** Pendiente: factor de velocidad al subir y al bajar una rampa. */
  cartUphill: 0.7,
  cartDownhill: 1.25,
  railRow: 9,
  railStart: 10,
  railEnd: 24,
  cartStartX: 252,
  floorY: 160,
  /**
   * Precio de venta por bloque, en el orden económico del juego (ficticio).
   * Tierra y piedra pagan poco; el mineral alienígena es el secreto.
   */
  sale: {
    dirt: 2,
    stone: 3,
    coal: 5,
    iron: 8,
    copper: 11,
    gold: 30,
    emerald: 60,
    ruby: 65,
    sapphire: 85,
    diamond: 160,
    alien_ore: 600,
    violet_crystal: 35,
  },
  /** Precios V2 de minerales retirados, para liquidar partidas antiguas. */
  legacySale: { silver: 18, quartz: 15 } as Record<string, number>,
  /** Muerte (Normal): dinero perdido y bloques transportados que se conservan. */
  death: { moneyFraction: 0.1, keepItems: 0 },
} as const;

/** Multiplicadores de trabajo de bloques especiales (los estándar son 1). */
export const BLOCK_WORK = {
  hardRock: 1.4,
  rubble: 0.6,
  /** Bloque fracturado por una tronadura cercana. */
  fractured: 0.5,
  /** Bloque colocado por el jugador: se retira rápido y sin desgastar la herramienta. */
  placed: 0.25,
} as const;

export const TOOLS = {
  iron: {
    grams: 2_400,
    label: 'PICOTA DE HIERRO',
    type: 'pick',
    level: 1,
    tier: 1,
    price: 15,
    durability: 25,
    /** 2 s por bloque estándar (ajuste pedido el 10 de noviembre de 2026). */
    workMs: 2000,
    icon: 0,
  },
  tungsten: {
    grams: 3_000,
    label: 'PICOTA DE TUNGSTENO',
    type: 'pick',
    level: 2,
    tier: 2,
    price: 45,
    durability: 50,
    workMs: 3500,
    icon: 1,
  },
  shovel: {
    grams: 1_800,
    label: 'PALA BASICA',
    type: 'shovel',
    level: 1,
    tier: 1,
    price: 10,
    durability: 40,
    workMs: BALANCE.shovelMs,
    icon: 3,
  },
  /** Construcción V11: tala árboles y desarma lo construido en madera. */
  axe: {
    grams: 1_600,
    label: 'HACHA BASICA',
    type: 'axe',
    level: 1,
    tier: 1,
    price: 8,
    durability: 60,
    workMs: 1500,
    icon: 5,
  },
  drill: {
    grams: 8_500,
    label: 'PERFORADORA MANUAL',
    type: 'drill',
    level: 1,
    tier: 2,
    price: 60,
    durability: 30,
    workMs: 2500,
    icon: 4,
  },
} as const;
export type ToolKind = keyof typeof TOOLS;
export const TOOL_KEYS = Object.keys(TOOLS) as ToolKind[];
/** Descripción de cada herramienta (bodega y celular). */
export const TOOL_DESC: Record<ToolKind, string> = {
  iron: 'CARBON, HIERRO, COBRE Y ORO. NO ROMPE ROCA DURA.',
  tungsten: 'ROCA DURA, GEMAS, DIAMANTE Y MINERAL DESCONOCIDO.',
  shovel: 'TIERRA, ESCOMBRO Y MATERIAL SUELTO. 2 S POR UNIDAD.',
  axe: 'TALA ARBOLES Y DESARMA LO CONSTRUIDO EN MADERA.',
  drill: 'PERFORA UN BARRENO EN 2,5 S. NO EXTRAE EL BLOQUE.',
};

/** Suministros consumibles o instalables, con nivel tecnológico requerido. */
export const SUPPLIES = {
  // V11: materiales de construcción. No se compran (precio 0, fuera de la
  // bodega): se obtienen excavando, picando y talando, y se colocan con clic
  // derecho. Su lógica vive en config/buildMaterials.ts.
  mat_dirt: {
    grams: 1_000,
    label: 'TIERRA',
    category: 'MATERIALES',
    price: 0,
    tier: 1,
    desc: 'BLOQUE DE TIERRA. CLIC DERECHO: COLOCAR.',
  },
  mat_stone: {
    grams: 1_000,
    label: 'PIEDRA',
    category: 'MATERIALES',
    price: 0,
    tier: 1,
    desc: 'BLOQUE DE PIEDRA. CLIC DERECHO: COLOCAR.',
  },
  mat_wood: {
    grams: 1_000,
    label: 'MADERA',
    category: 'MATERIALES',
    price: 0,
    tier: 1,
    desc: 'TABLONES DE ARBOL TALADO. CLIC DERECHO: COLOCAR.',
  },
  rail: {
    grams: 5_000,
    label: 'RIEL',
    category: 'CONSTRUCCION',
    price: 5,
    tier: 1,
    desc: 'TRAMO DE VIA. ADMITE RAMPAS DE UN BLOQUE.',
  },
  wood_beam: {
    grams: 4_000,
    label: 'VIGA DE MADERA',
    category: 'CONSTRUCCION',
    price: 6,
    tier: 1,
    desc: 'SOSTIENE 2 BLOQUES A CADA LADO. SE DETERIORA.',
  },
  steel_beam: {
    grams: 12_000,
    label: 'VIGA DE ACERO',
    category: 'CONSTRUCCION',
    price: 25,
    tier: 2,
    desc: 'SOSTIENE 4 BLOQUES A CADA LADO. MUY DURADERA.',
  },
  torch: {
    grams: 250,
    label: 'ANTORCHA',
    category: 'ILUMINACION',
    price: 2,
    tier: 1,
    desc: 'ILUMINA 5X5 BLOQUES Y SE APAGA DE A POCO. ARDE 6 MIN.',
  },
  lamp: {
    grams: 2_200,
    label: 'FARO MINERO',
    category: 'ILUMINACION',
    price: 30,
    tier: 2,
    desc: 'ILUMINA UN AREA DE TRABAJO. BATERIA 20 MIN.',
  },
  industrial: {
    grams: 6_000,
    label: 'LUMINARIA INDUSTRIAL',
    category: 'ILUMINACION',
    price: 70,
    tier: 3,
    desc: 'LUZ ELECTRICA DE GALERIA. SIN CONSUMO.',
  },
  // V9: repuesto de la linterna del casco. La carga actual y su consumo
  // viven en systems/HeadlampBattery.ts y config/lighting.ts (battery).
  battery: {
    grams: 150,
    label: 'BATERIA DE CASCO',
    category: 'ILUMINACION',
    price: 10,
    tier: 1,
    desc: 'REPUESTO PARA LA LINTERNA. AL CAMBIARLA, CARGA 100%.',
  },
  dynamite: {
    grams: 500,
    label: 'DINAMITA',
    category: 'TRONADURA',
    price: 12,
    tier: 2,
    desc: 'CARGA FICTICIA PARA UN BARRENO PERFORADO.',
  },
  fuse: {
    grams: 100,
    label: 'MECHA',
    category: 'TRONADURA',
    price: 3,
    tier: 2,
    desc: 'ENCIENDE UNA CARGA. CUENTA REGRESIVA DE 6 S.',
  },
  duct: {
    grams: 2_800,
    label: 'DUCTO',
    category: 'VENTILACION',
    price: 4,
    tier: 3,
    desc: 'LLEVA AIRE DESDE UN VENTILADOR CONECTADO.',
  },
  fan_aux: {
    grams: 22_000,
    label: 'VENTILADOR AUXILIAR',
    category: 'VENTILACION',
    price: 80,
    tier: 3,
    desc: 'IMPULSA AIRE POR 12 DUCTOS.',
  },
  fan_main: {
    grams: 60_000,
    label: 'VENTILADOR PRINCIPAL',
    category: 'VENTILACION',
    price: 200,
    tier: 3,
    desc: 'EN SUPERFICIE: AIRE LIMPIO POR 30 DUCTOS.',
  },
  // V8: alimentos y bebidas. Se consumen (no se instalan); efecto en
  // config/survival.ts (FOODS).
  cola: {
    grams: 350,
    label: 'BEBIDA COLA',
    category: 'ALIMENTOS Y BEBIDAS',
    price: 5,
    tier: 1,
    desc: 'LATA HELADA DE COLA DEL DESIERTO. +1 ENERGIA.',
  },
  sandwich: {
    grams: 300,
    label: 'SANDWICH DE POTITO',
    category: 'ALIMENTOS Y BEBIDAS',
    price: 12,
    tier: 1,
    desc: 'MARRAQUETA CON POTITO, CEBOLLA Y AJI. +3 ALIMENTACION.',
  },
  empanada: {
    grams: 220,
    label: 'EMPANADA DE PINO',
    category: 'ALIMENTOS Y BEBIDAS',
    price: 8,
    tier: 1,
    desc: 'EMPANADA DE HORNO CON PINO, HUEVO Y ACEITUNA. +2 ALIMENTACION.',
  },
  // Productos del celular (llegan por dron; no están en la bodega). Precio y
  // peso PROVISIONALES; efecto en config/survival.ts (FOODS).
  completo: {
    grams: 280,
    label: 'COMPLETO',
    category: 'ALIMENTOS Y BEBIDAS',
    price: 10,
    tier: 1,
    desc: 'PAN CON VIENESA, PALTA, TOMATE Y MAYO. +2 ALIMENTACION.',
  },
  suavecilla: {
    grams: 90,
    label: 'SUAVECILLA',
    category: 'ALIMENTOS Y BEBIDAS',
    price: 3,
    tier: 1,
    desc: 'HELADO DE PALETA DE FRUTILLA Y VAINILLA. +1 ENERGIA.',
  },
  terremoto: {
    grams: 450,
    label: 'TERREMOTO',
    category: 'ALIMENTOS Y BEBIDAS',
    price: 9,
    tier: 1,
    desc: 'PIPEÑO CON HELADO DE PIÑA Y GRANADINA. +1 ENERGIA.',
  },
  medkit: {
    grams: 900,
    label: 'BOTIQUIN',
    category: 'SALUD',
    price: 25,
    tier: 1,
    desc: 'VENDAS, GASA Y ANTISEPTICO. RECUPERA 2 CORAZONES.',
  },
} as const;
export type SupplyKind = keyof typeof SUPPLIES;
export const SUPPLY_KEYS = Object.keys(SUPPLIES) as SupplyKind[];

export type Material = MineralKey | 'dirt' | 'stone';
export const MATERIAL_LABEL: Record<Material, string> = {
  dirt: 'TIERRA',
  stone: 'PIEDRA',
  coal: 'CARBON',
  iron: 'HIERRO',
  copper: 'COBRE',
  gold: 'ORO',
  emerald: 'ESMERALDA',
  ruby: 'RUBI',
  sapphire: 'ZAFIRO',
  diamond: 'DIAMANTE',
  alien_ore: 'MINERAL DESCONOCIDO',
  violet_crystal: 'CRISTAL VIOLETA',
};
/** Peso aproximado de un bloque de cada material (kg). */
export const MATERIAL_KG: Record<Material, number> = {
  dirt: 1,
  stone: 1,
  coal: 1,
  iron: 1,
  copper: 1,
  gold: 1,
  emerald: 1,
  ruby: 1,
  sapphire: 1,
  diamond: 1,
  alien_ore: 1,
  violet_crystal: 1,
};
/** Peso de una carga con el formato del HUD («12 KG»). */
export const kg = (value: number): string =>
  `${Math.round(value * 10) / 10} KG`;
export function materialOf(block: Block): Material {
  return mineralOf(block) ?? (block === Block.Dirt ? 'dirt' : 'stone');
}
