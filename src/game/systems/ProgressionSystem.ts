import { LEVEL_REWARD, MAX_LEVEL, xpForLevel, xpToNext } from '../config/gear';
import type { MineralKey } from '../config/minerals';

/**
 * Etapas tecnológicas. Se desbloquean por logros reales de la partida y nunca
 * retroceden. La ventilación mecánica (etapa 3) aparece antes de que el aire
 * profundo sea imprescindible: las etapas 1 y 2 se completan en zonas
 * superficiales y medias, donde el aire natural alcanza.
 */
export const TIERS = {
  1: { name: 'MINERIA ARTESANAL', goal: 'MINA PEQUENA Y RENTABLE' },
  2: { name: 'MECANIZACION', goal: 'AMPLIAR LA PRODUCCION' },
  3: { name: 'MINERIA INDUSTRIAL', goal: 'OPERACION SUBTERRANEA AVANZADA' },
} as const;
export type Tier = 1 | 2 | 3;

export const UNLOCK = {
  /** Etapa 2: ventas acumuladas o primer oro. */
  mid: { earned: 100 },
  /** Etapa 3: ventas acumuladas y profundidad alcanzada. */
  late: { earned: 450, row: 20 },
} as const;

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** Un mismo punto de sostenimiento no da XP otra vez al cambiar el material. */
export const rewardKey = (key: string): string =>
  key.startsWith('support:') ? key.split(':').slice(0, 2).join(':') : key;

export class ProgressionSystem {
  tier: Tier = 1;
  /** Dinero total obtenido por ventas (no baja al gastar). */
  earned = 0;
  /** Fila más profunda pisada por el minero. */
  deepestRow = 0;
  readonly found = new Set<MineralKey>();
  /** Experiencia total y nivel del minero (independientes de la etapa). */
  xp = 0;
  level = 1;
  /** Claves ya premiadas con experiencia: evita repetir por el mismo hecho. */
  readonly rewarded = new Set<string>();

  get miningSpeedPoints(): number {
    return (this.level - 1) * LEVEL_REWARD.miningPoints;
  }
  get workTimeFactor(): number {
    return Math.max(
      LEVEL_REWARD.minTimeFactor,
      1 / (1 + LEVEL_REWARD.speedPerPoint * this.miningSpeedPoints),
    );
  }
  get xpInLevel(): number {
    return Math.max(0, this.xp - xpForLevel(this.level));
  }
  get xpNeeded(): number {
    return xpToNext(this.level);
  }

  /**
   * Suma experiencia. Con `key`, el mismo hecho solo premia una vez.
   * Devuelve los niveles ganados (0 si ninguno).
   */
  gainXp(amount: number, key?: string): number {
    if (!Number.isFinite(amount) || amount < 1 || this.level >= MAX_LEVEL)
      return 0;
    if (key) {
      key = rewardKey(key);
      if (this.rewarded.has(key)) return 0;
      this.rewarded.add(key);
    }
    this.xp += Math.floor(amount);
    const before = this.level;
    this.level = levelForXp(this.xp);
    return this.level - before;
  }

  /** Avance hacia el siguiente nivel, 0..1. */
  levelProgress(): number {
    return this.xpNeeded ? Math.min(1, this.xpInLevel / this.xpNeeded) : 1;
  }

  /** Devuelve la nueva etapa si se desbloqueó una. */
  update(): Tier | null {
    let next = this.tier;
    if (
      next === 1 &&
      (this.earned >= UNLOCK.mid.earned || this.found.has('gold'))
    )
      next = 2;
    if (
      next === 2 &&
      this.earned >= UNLOCK.late.earned &&
      this.deepestRow >= UNLOCK.late.row
    )
      next = 3;
    if (next === this.tier) return null;
    this.tier = next;
    return next;
  }

  /** Texto de lo que falta para la siguiente etapa. */
  nextGoal(): string {
    if (this.tier === 1)
      return `ETAPA 2: VENDE $${UNLOCK.mid.earned} (LLEVAS $${this.earned}) O HALLA ORO`;
    if (this.tier === 2)
      return `ETAPA 3: VENDE $${UNLOCK.late.earned} Y BAJA A LA FILA ${UNLOCK.late.row}`;
    return 'TODAS LAS ETAPAS DESBLOQUEADAS';
  }
}

/** Logros permanentes de la partida. */
export const ACHIEVEMENTS = {
  primer_dia_seguro: {
    title: 'PRIMER DIA SEGURO',
    text: 'RECIBISTE Y EQUIPASTE TODO TU EPP.',
  },
  minero_preparado: {
    title: 'MINERO PREPARADO',
    text: 'ENTRASTE A LA MINA CON EL EQUIPAMIENTO COMPLETO.',
  },
  prevenir_es_vivir: {
    title: 'PREVENIR ES VIVIR',
    text: 'TU SOSTENIMIENTO EVITO UN COLAPSO INMINENTE.',
  },
  un_susto: {
    title: 'UN SUSTO BAJO TIERRA',
    text: 'SOBREVIVISTE A UN DERRUMBE CERCANO.',
  },
  ingeniero_previsor: {
    title: 'INGENIERO PREVISOR',
    text: 'TRES JORNADAS SIN DERRUMBES CON LA MINA SOSTENIDA.',
  },
  hasta_el_final: {
    title: 'HASTA EL FINAL',
    text: 'LLEGASTE A LA MINERIA INDUSTRIAL EN MODO HARDCORE.',
  },
  no_estamos_solos: {
    title: 'NO ESTAMOS SOLOS',
    text: 'HAS DESCUBIERTO ALGO QUE NO DEBERIA ESTAR BAJO ESTA MONTANA.',
  },
} as const;
export type AchievementId = keyof typeof ACHIEVEMENTS;

export class AchievementSystem {
  readonly unlocked = new Set<AchievementId>();
  /** Códigos usados en la partida: no se ganan logros nuevos (los ya ganados se conservan). */
  constructor(private readonly blocked: () => boolean = () => false) {}
  get disabled(): boolean {
    return this.blocked();
  }
  /** true solo la primera vez: el evento no se repite ni duplica premios. */
  unlock(id: AchievementId): boolean {
    if (this.disabled || this.unlocked.has(id)) return false;
    this.unlocked.add(id);
    return true;
  }
}
