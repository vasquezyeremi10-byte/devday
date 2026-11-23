import type { ExpeditionEnd } from './GameSession';
import { DEVELOPER_SAVE_KEY } from '../config/developer';
import { MENU_SETTINGS_KEY } from '../config/menu';
import { sanitizeMineName } from '../config/mineName';
import {
  decodeSave,
  LEGACY_SAVE_KEY,
  SAVE_KEY,
  V3_SAVE_KEY,
  V4_SAVE_KEY,
  V5_SAVE_KEY,
} from './SaveSystem';

/** Subconjunto de Storage que necesita el menú (facilita las pruebas). */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Lee la partida con el mismo orden de claves que MiningScene: la actual y,
 * fuera del modo desarrollador, las versiones anteriores (que se migran al
 * cargar).
 */
export function readSavedRaw(
  storage: StorageLike,
  developer: boolean,
): string | null {
  if (developer) return storage.getItem(DEVELOPER_SAVE_KEY);
  return (
    storage.getItem(SAVE_KEY) ??
    storage.getItem(V5_SAVE_KEY) ??
    storage.getItem(V4_SAVE_KEY) ??
    storage.getItem(V3_SAVE_KEY) ??
    storage.getItem(LEGACY_SAVE_KEY)
  );
}

export type SaveSummary =
  | { state: 'none' }
  /** El navegador no permite leer el almacenamiento local. */
  | { state: 'unavailable' }
  /** Hay datos, pero no pasan la validación del guardado. */
  | { state: 'corrupt'; raw: string }
  | {
      state: 'ok';
      raw: string;
      mineName: string;
      level: number;
      mode: 'normal' | 'hardcore';
      playMs: number;
      /** Hardcore terminado: Continuar muestra el resumen final. */
      ended: boolean;
    };

/** Resumen de la partida guardada, sin modificar nada en el almacenamiento. */
export function summarizeSave(
  storage: StorageLike | null,
  developer: boolean,
): SaveSummary {
  if (!storage) return { state: 'unavailable' };
  let raw: string | null;
  try {
    raw = readSavedRaw(storage, developer);
  } catch {
    return { state: 'unavailable' };
  }
  if (!raw) return { state: 'none' };
  const restored = decodeSave(raw, developer);
  if (!restored) return { state: 'corrupt', raw };
  const s = restored.session;
  return {
    state: 'ok',
    raw,
    mineName: sanitizeMineName(s.mineName),
    level: s.progression.level,
    mode: s.mode,
    playMs: s.stats.playMs,
    ended: s.ended !== null,
  };
}

/**
 * Copia de respaldo de la partida antes de reemplazarla. Devuelve false si el
 * navegador no pudo guardarla (cuota llena): en ese caso no se debe continuar.
 */
export function archiveSave(
  storage: StorageLike,
  raw: string,
  developer: boolean,
  now: number,
): boolean {
  try {
    const prefix = developer ? 'mina-cero.developer' : 'mina-cero';
    storage.setItem(`${prefix}.archive.${now}`, raw);
    return true;
  } catch {
    return false;
  }
}

/** Respalda la partida terminada y registra el resultado Hardcore. */
export function archiveExpedition(
  storage: StorageLike,
  raw: string,
  developer: boolean,
  seed: number,
  end: ExpeditionEnd,
  now: number,
): boolean {
  if (!archiveSave(storage, raw, developer, now)) return false;
  const prefix = developer ? 'mina-cero.developer' : 'mina-cero';
  const key = prefix + '.history';
  try {
    const stored: unknown = JSON.parse(storage.getItem(key) ?? '[]');
    const history: unknown[] = Array.isArray(stored) ? stored : [];
    history.push({ seed, mode: 'hardcore', ...end });
    storage.setItem(key, JSON.stringify(history));
  } catch {
    // La copia de la expedición ya quedó guardada.
  }
  return true;
}

/** «2H 10M», «45M» o «MENOS DE 1M». */
export function formatPlayTime(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return 'MENOS DE 1M';
  const h = Math.floor(minutes / 60);
  return h ? `${h}H ${minutes % 60}M` : `${minutes}M`;
}

export interface MenuSettings {
  /** Sonido silenciado (game.sound.mute). */
  muted: boolean;
  /** Efectos ambientales animados del menú. */
  effects: boolean;
}

/**
 * Los efectos arrancan apagados si el sistema pide menos movimiento
 * (prefers-reduced-motion) y no hay una elección guardada.
 */
export function loadMenuSettings(
  storage: StorageLike | null,
  prefersReducedMotion: boolean,
): MenuSettings {
  const settings: MenuSettings = {
    muted: false,
    effects: !prefersReducedMotion,
  };
  try {
    const raw = JSON.parse(storage?.getItem(MENU_SETTINGS_KEY) ?? '{}');
    if (typeof raw?.muted === 'boolean') settings.muted = raw.muted;
    if (typeof raw?.effects === 'boolean') settings.effects = raw.effects;
  } catch {
    // Sin almacenamiento o JSON inválido: valores por defecto.
  }
  return settings;
}

export function saveMenuSettings(
  storage: StorageLike | null,
  settings: MenuSettings,
): boolean {
  try {
    storage?.setItem(MENU_SETTINGS_KEY, JSON.stringify(settings));
    return !!storage;
  } catch {
    return false;
  }
}
