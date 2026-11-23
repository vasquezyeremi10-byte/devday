/** Balance del videojuego. El porcentaje no es una medida física del aire. */
export const GALLERY_AIR = {
  fresh: 100,
  passageLoss: 8,
  ductLoss: 2,
  damageLoss: 5,
  caveInDamage: 60,
  mainIntake: 80,
  mainRadius: 2,
  good: 80,
  adequate: 50,
  critical: 25,
  damageIntervalMs: 1000,
  inspectMs: 6500,
} as const;
