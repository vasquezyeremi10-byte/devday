/**
 * Balance V8 de supervivencia: energía (cansancio) y alimentación. Todo en
 * puntos enteros de 0 a 100; cada unidad visible del HUD vale 20 puntos.
 * Ajustar aquí: ningún otro archivo repite estos números.
 */
export const SURVIVAL = {
  max: 100,
  unit: 20,
  units: 5,
  /** Energía por esfuerzo completado (un bloque, una palada, un barreno…). */
  effort: {
    /** Picar un bloque con picota. */
    pick: 4,
    /** Palear tierra o escombro, recoger una pila o cargar el carro. */
    shovel: 3,
    /** Perforar un barreno. */
    drill: 5,
    /** Colocar una estructura (riel, viga, luz, ducto, carga). */
    build: 2,
    /** V11: colocar o retirar un bloque de construcción. */
    place: 1,
    /** V11: un hachazo a un árbol. */
    chop: 1,
  },
  /** Energía por segundo caminando (≈ 20 min de caminata continua). */
  walkPerSecond: 0.08,
  /** Energía por segundo empujando el carro con carga y en movimiento. */
  cartPerSecond: 0.25,
  /** Hambre por segundo de juego: una unidad cada 4 minutos. */
  hungerPerSecond: 20 / 240,
  /** Hambre adicional por punto de energía gastado en esfuerzos. */
  hungerPerEffort: 0.2,
  /** Tiempo con alimentación en cero antes de perder salud. */
  starveGraceMs: 20_000,
  /** Salud por segundo mientras dura la desnutrición extrema. */
  starveDamagePerSecond: 0.5,
  /** Salud perdida por cada punto de esfuerzo hecho sin energía. */
  exhaustionDamagePerPoint: 1,
  /** Movilidad con una unidad o menos y con agotamiento extremo. */
  tiredSpeed: 0.9,
  exhaustedSpeed: 0.8,
  /** Recordatorio de los avisos críticos mientras persisten (ms). */
  reminderMs: 90_000,
} as const;

/**
 * Alimentos y bebidas (V8) y consumibles que se usan igual. Efecto en puntos:
 * energía y alimentación sobre SURVIVAL.max, `heal` sobre HEALTH.max (100, 20
 * por corazón). Los cuatro últimos llegan por el celular (dron); sus valores
 * son PROVISIONALES, en la escala de la comida de la bodega.
 */
export const FOODS = {
  cola: { energy: 20, hunger: 0, heal: 0, drink: true, shelfDays: 3 },
  sandwich: { energy: 0, hunger: 60, heal: 0, drink: false, shelfDays: 3 },
  empanada: { energy: 0, hunger: 40, heal: 0, drink: false, shelfDays: 3 },
  completo: { energy: 0, hunger: 40, heal: 0, drink: false, shelfDays: 3 },
  suavecilla: { energy: 20, hunger: 0, heal: 0, drink: false, shelfDays: 3 },
  terremoto: { energy: 20, hunger: 0, heal: 0, drink: true, shelfDays: 3 },
  /** Botiquín: no alimenta, recupera 2 corazones. No caduca. */
  medkit: { energy: 0, hunger: 0, heal: 40, drink: false, shelfDays: 0 },
} as const;
export type FoodKind = keyof typeof FOODS;
export const FOOD_KEYS = Object.keys(FOODS) as FoodKind[];
export const isFood = (kind: string): kind is FoodKind =>
  Object.hasOwn(FOODS, kind);

/**
 * Caducidad: `shelfDays` son días COMPLETOS del juego (cada uno, un ciclo
 * día + noche de DayNightCycle: 10 min de simulación), no horas reales; 0 =
 * no caduca. Fuera del refrigerador el tiempo corre; dentro, se detiene.
 */
export type PerishableKind = {
  [K in FoodKind]: (typeof FOODS)[K]['shelfDays'] extends 0 ? never : K;
}[FoodKind];
export const PERISHABLE_KEYS = FOOD_KEYS.filter(
  (k) => FOODS[k].shelfDays > 0,
) as PerishableKind[];
export const isPerishable = (kind: string): kind is PerishableKind =>
  isFood(kind) && FOODS[kind].shelfDays > 0;

/** Refrigerador de la cabaña: casillas y tipos que admite. */
export const FRIDGE = { slots: 10 } as const;
