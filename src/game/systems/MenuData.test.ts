import { describe, expect, it } from 'vitest';
import { DEVELOPER_SAVE_KEY } from '../config/developer';
import { MENU_SETTINGS_KEY, shouldShowMenu } from '../config/menu';
import { SPAWN } from '../config/constants';
import { createInitialTerrain } from '../world/Geology';
import { GameSession } from './GameSession';
import {
  archiveSave,
  formatPlayTime,
  loadMenuSettings,
  readSavedRaw,
  saveMenuSettings,
  summarizeSave,
  type StorageLike,
} from './MenuData';
import {
  encodeSave,
  LEGACY_SAVE_KEY,
  SAVE_KEY,
  V5_SAVE_KEY,
} from './SaveSystem';

/** Almacenamiento en memoria con la forma mínima de localStorage. */
function memory(initial: Record<string, string> = {}): StorageLike & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const saved = (configure?: (s: GameSession) => void) => {
  const s = new GameSession(createInitialTerrain());
  configure?.(s);
  return encodeSave(s, SPAWN);
};

describe('Arranque del menú', () => {
  it('en producción siempre muestra el menú', () => {
    expect(shouldShowMenu(false, true, '?menu=off')).toBe(true);
    expect(shouldShowMenu(false, false, '')).toBe(true);
  });
  it('en desarrollo un navegador automatizado entra directo a la mina', () => {
    expect(shouldShowMenu(true, true, '')).toBe(false);
    expect(shouldShowMenu(true, false, '')).toBe(true);
  });
  it('?menu=on y ?menu=off mandan sobre el modo automatizado', () => {
    expect(shouldShowMenu(true, true, '?menu=on')).toBe(true);
    expect(shouldShowMenu(true, false, '?menu=off')).toBe(false);
  });
});

describe('Partida guardada y Continuar', () => {
  it('sin datos no hay partida', () => {
    expect(summarizeSave(memory(), false)).toEqual({ state: 'none' });
  });
  it('sin acceso al almacenamiento queda como no disponible', () => {
    expect(summarizeSave(null, false)).toEqual({ state: 'unavailable' });
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => undefined,
    };
    expect(summarizeSave(broken, false)).toEqual({ state: 'unavailable' });
  });
  it('un guardado corrupto se detecta sin tocarlo', () => {
    const storage = memory({ [SAVE_KEY]: '{"version":6,"seed":"x"}' });
    expect(summarizeSave(storage, false)).toEqual({
      state: 'corrupt',
      raw: '{"version":6,"seed":"x"}',
    });
    expect(storage.data[SAVE_KEY]).toBe('{"version":6,"seed":"x"}');
  });
  it('resume nombre, nivel, modalidad y tiempo de una partida válida', () => {
    const raw = saved((s) => {
      s.mineName = 'SAN JOSÉ';
      s.mode = 'hardcore';
      s.stats.playMs = 3_900_000;
    });
    const summary = summarizeSave(memory({ [SAVE_KEY]: raw }), false);
    expect(summary).toMatchObject({
      state: 'ok',
      mineName: 'SAN JOSÉ',
      mode: 'hardcore',
      level: 1,
      playMs: 3_900_000,
      ended: false,
    });
  });
  it('usa la clave actual antes que las anteriores', () => {
    const storage = memory({
      [SAVE_KEY]: 'actual',
      [V5_SAVE_KEY]: 'v5',
      [LEGACY_SAVE_KEY]: 'v2',
    });
    expect(readSavedRaw(storage, false)).toBe('actual');
    delete storage.data[SAVE_KEY];
    expect(readSavedRaw(storage, false)).toBe('v5');
  });
  it('el modo desarrollador solo mira su propia clave', () => {
    const storage = memory({ [SAVE_KEY]: 'normal' });
    expect(readSavedRaw(storage, true)).toBeNull();
    storage.data[DEVELOPER_SAVE_KEY] = 'dev';
    expect(readSavedRaw(storage, true)).toBe('dev');
  });
});

describe('Respaldo antes de una partida nueva', () => {
  it('guarda una copia con marca de tiempo y no toca la original', () => {
    const storage = memory({ [SAVE_KEY]: 'datos' });
    expect(archiveSave(storage, 'datos', false, 1234)).toBe(true);
    expect(storage.data['mina-cero.archive.1234']).toBe('datos');
    expect(storage.data[SAVE_KEY]).toBe('datos');
  });
  it('avisa si el navegador no pudo guardar la copia', () => {
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('cuota');
      },
    };
    expect(archiveSave(full, 'datos', false, 1)).toBe(false);
  });
});

describe('Formato del tiempo de juego', () => {
  it('muestra horas y minutos', () => {
    expect(formatPlayTime(0)).toBe('MENOS DE 1M');
    expect(formatPlayTime(59_999)).toBe('MENOS DE 1M');
    expect(formatPlayTime(45 * 60_000)).toBe('45M');
    expect(formatPlayTime(130 * 60_000)).toBe('2H 10M');
    expect(formatPlayTime(-5)).toBe('MENOS DE 1M');
  });
});

describe('Ajustes del menú', () => {
  it('valores por defecto: con sonido y efectos activos', () => {
    expect(loadMenuSettings(memory(), false)).toEqual({
      muted: false,
      effects: true,
    });
  });
  it('prefers-reduced-motion apaga los efectos si no hay elección guardada', () => {
    expect(loadMenuSettings(memory(), true).effects).toBe(false);
    const chosen = memory({
      [MENU_SETTINGS_KEY]: JSON.stringify({ muted: true, effects: true }),
    });
    expect(loadMenuSettings(chosen, true)).toEqual({
      muted: true,
      effects: true,
    });
  });
  it('un JSON dañado o con tipos incorrectos se ignora', () => {
    expect(
      loadMenuSettings(memory({ [MENU_SETTINGS_KEY]: '{no json' }), false),
    ).toEqual({ muted: false, effects: true });
    expect(
      loadMenuSettings(
        memory({ [MENU_SETTINGS_KEY]: '{"muted":"si","effects":3}' }),
        false,
      ),
    ).toEqual({ muted: false, effects: true });
  });
  it('se guardan y se recuperan', () => {
    const storage = memory();
    expect(saveMenuSettings(storage, { muted: true, effects: false })).toBe(
      true,
    );
    expect(loadMenuSettings(storage, false)).toEqual({
      muted: true,
      effects: false,
    });
    expect(saveMenuSettings(null, { muted: true, effects: false })).toBe(false);
  });
});
