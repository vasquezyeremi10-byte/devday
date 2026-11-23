import { describe, expect, it } from 'vitest';
import { TOOLS } from '../config/balance';
import { SPAWN } from '../config/constants';
import { createInitialTerrain, DEFAULT_SEED } from '../world/Geology';
import { CheatCodes } from './CheatCodes';
import { GameSession } from './GameSession';
import { decodeSave, encodeSave } from './SaveSystem';

const session = () => new GameSession(createInitialTerrain(), DEFAULT_SEED);

describe('códigos de la partida (tecla |)', () => {
  it('gnomo desactiva logros sin cambiar dinero ni vuelo', () => {
    const c = new CheatCodes();
    expect(c.execute(' GnOmO ')).toMatchObject({
      recognized: true,
      changed: true,
    });
    expect(c.achievementsDisabled).toBe(true);
    expect(c.infiniteMoney).toBe(false);
    expect(c.flight).toBe(false);
    expect(c.snapshot()).toEqual({ money: false, fly: false, used: true });
  });
  it('money y fly alternan, sin importar mayúsculas ni espacios', () => {
    const c = new CheatCodes();
    expect(c.achievementsDisabled).toBe(false);
    const on = c.execute('  MoNeY ');
    expect(on).toMatchObject({ recognized: true, changed: true });
    expect(on.message).toContain('LOGROS DESACTIVADOS');
    expect(c.infiniteMoney).toBe(true);
    expect(c.execute('fly').message).not.toContain('LOGROS');
    expect(c.flight).toBe(true);
    c.execute('money');
    c.execute('FLY');
    expect([c.infiniteMoney, c.flight]).toEqual([false, false]);
    // Apagar los códigos no devuelve los logros.
    expect(c.achievementsDisabled).toBe(true);
  });

  it('textos desconocidos no cambian nada ni apagan los logros', () => {
    const c = new CheatCodes();
    for (const text of ['', 'mochila', 'money extra', 'flyy'])
      expect(c.execute(text)).toEqual({
        recognized: false,
        changed: false,
        message: '',
      });
    expect(c.achievementsDisabled).toBe(false);
    expect(c.snapshot()).toBeUndefined();
  });

  it('dinero infinito compra sin descontar y no desbloquea etapas', () => {
    const s = session();
    s.money = 0;
    expect(s.buy('iron')).toBe('SALDO INSUFICIENTE');
    s.cheats.execute('money');
    expect(s.infiniteMoney).toBe(true);
    expect(s.buy('iron')).toBe('COMPRA REALIZADA');
    expect(s.money).toBe(0);
    expect(s.buy('tungsten')).toBe(`REQUIERE ETAPA ${TOOLS.tungsten.tier}`);
    s.cheats.execute('money');
    expect(s.buy('iron')).toBe('SALDO INSUFICIENTE');
  });

  it('desbloquear pasa a la última etapa, sin experiencia, y se guarda', () => {
    const s = session();
    expect(s.buy('tungsten')).toBe(`REQUIERE ETAPA ${TOOLS.tungsten.tier}`);
    const xp = s.progression.xp;
    expect(s.unlockAllTiers()).toEqual({
      changed: true,
      message: 'TODAS LAS ETAPAS DESBLOQUEADAS - LOGROS DESACTIVADOS',
    });
    expect(s.progression.tier).toBe(3);
    expect(s.progression.xp).toBe(xp);
    expect(s.achievements.disabled).toBe(true);
    // Ya no pide etapa: solo falta el dinero.
    expect(s.buy('tungsten')).not.toMatch(/REQUIERE ETAPA/);
    // Las etapas no retroceden aunque falten ventas y profundidad.
    expect(s.progression.update()).toBeNull();
    expect(s.progression.tier).toBe(3);
    // Repetirlo no cambia nada.
    expect(s.unlockAllTiers()).toEqual({
      changed: false,
      message: 'YA TIENES TODAS LAS ETAPAS',
    });
    const loaded = decodeSave(encodeSave(s, SPAWN))!.session;
    expect(loaded.progression.tier).toBe(3);
    expect(loaded.achievements.disabled).toBe(true);
  });

  it('con todas las etapas ganadas jugando, desbloquear no desactiva logros', () => {
    const s = session();
    s.progression.tier = 3;
    expect(s.unlockAllTiers().changed).toBe(false);
    expect(s.achievements.disabled).toBe(false);
  });

  it('un código desactiva los logros nuevos y conserva los ya ganados', () => {
    const s = session();
    expect(s.achievements.unlock('primer_dia_seguro')).toBe(true);
    s.cheats.execute('fly');
    expect(s.achievements.disabled).toBe(true);
    expect(s.achievements.unlock('un_susto')).toBe(false);
    expect([...s.achievements.unlocked]).toEqual(['primer_dia_seguro']);
    s.cheats.execute('fly');
    expect(s.achievements.unlock('un_susto')).toBe(false);
  });

  it('se guarda en la partida normal y sobrevive a recargar', () => {
    const s = session();
    const clean = JSON.parse(encodeSave(s, SPAWN));
    expect(clean.cheats).toBeUndefined();
    expect(
      decodeSave(JSON.stringify(clean))!.session.achievements.disabled,
    ).toBe(false);
    s.cheats.execute('money');
    s.cheats.execute('fly');
    s.cheats.execute('fly');
    const loaded = decodeSave(encodeSave(s, SPAWN))!.session;
    expect(loaded.cheats.infiniteMoney).toBe(true);
    expect(loaded.cheats.flight).toBe(false);
    expect(loaded.achievements.disabled).toBe(true);
    loaded.cheats.execute('money');
    const again = decodeSave(encodeSave(loaded, SPAWN))!.session;
    expect(again.infiniteMoney).toBe(false);
    expect(again.achievements.disabled).toBe(true);
  });

  it('datos inválidos no activan códigos; un código encendido implica sin logros', () => {
    const c = new CheatCodes();
    for (const value of [
      null,
      'x',
      1,
      { money: 'true', fly: 1, used: 'yes' },
    ]) {
      c.restore(value);
      expect([c.infiniteMoney, c.flight, c.achievementsDisabled]).toEqual([
        false,
        false,
        false,
      ]);
    }
    c.restore({ fly: true });
    expect([c.flight, c.achievementsDisabled]).toEqual([true, true]);
  });
});
