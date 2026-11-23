import { describe, expect, it } from 'vitest';
import { SUPPLY_KEYS, TOOL_KEYS, TOOLS } from '../config/balance';
import { developerMode } from '../config/developer';
import { MAX_SLOTS, PPE_KEYS, PPE, xpForLevel } from '../config/gear';
import { SPAWN } from '../config/constants';
import { createInitialTerrain, DEFAULT_SEED } from '../world/Geology';
import { GameSession } from './GameSession';
import { encodeSave, decodeSave } from './SaveSystem';

const session = (dev = true) =>
  new GameSession(createInitialTerrain(), DEFAULT_SEED, dev);

describe('consola de desarrollo', () => {
  it('las 24 casillas conservan sus posiciones al guardar y subir de nivel', () => {
    const s = session();
    expect(s.loadout.unlocked).toBe(MAX_SLOTS);
    expect(s.progression.level).toBe(1);
    expect(s.progression.xp).toBe(0);
    expect(s.inventory.capacity).toBe(50);
    expect(s.cart.inventory.capacity).toBe(100);
    expect(s.developer.infiniteMoney).toBe(false);
    expect(s.developer.fullStacks).toBe(false);
    s.supplies.torch = 3;
    s.loadout.sync();
    expect(s.loadout.move(0, MAX_SLOTS - 1)).toBeNull();
    const last = s.loadout.slots[MAX_SLOTS - 1];
    const loaded = decodeSave(encodeSave(s, SPAWN), true)!.session;
    expect(loaded.loadout.unlocked).toBe(MAX_SLOTS);
    expect(loaded.loadout.slots[MAX_SLOTS - 1]).toEqual(last);
    expect(loaded.supplies.torch).toBe(3);
    expect(loaded.loadout.slots.filter(Boolean)).toHaveLength(1);
    loaded.gainXp(xpForLevel(3));
    expect(loaded.loadout.unlocked).toBe(MAX_SLOTS);
    expect(loaded.loadout.slots[MAX_SLOTS - 1]).toEqual(last);
  });

  it('un flag antiguo de mochila no altera la capacidad de una partida', () => {
    const s = session(false);
    expect(s.developer.execute('mochila').changed).toBe(false);
    s.developer.restore({ fullBackpack: true });
    expect(s.loadout.unlocked).toBe(MAX_SLOTS);
    const dev = session();
    const raw = encodeSave(dev, SPAWN);
    expect(decodeSave(raw)!.session.loadout.unlocked).toBe(MAX_SLOTS);
    const data = JSON.parse(raw);
    for (const value of [undefined, 'true', 1, false]) {
      data.developer.fullBackpack = value;
      const restored = decodeSave(JSON.stringify(data), true)!.session;
      expect(restored.loadout.unlocked).toBe(MAX_SLOTS);
    }
  });

  it('exige build de desarrollo y activación explícita; producción rechaza la URL', () => {
    expect(developerMode(true, '?dev=1')).toBe(true);
    for (const search of ['', '?dev=0', '?dev=true'])
      expect(developerMode(true, search)).toBe(false);
    expect(developerMode(false, '?dev=1')).toBe(false);
    const normal = session(false);
    expect(normal.developer.execute('money').changed).toBe(false);
    normal.developer.execute('fullstacks');
    normal.developer.restore({ infiniteMoney: true, fullStacks: true });
    expect(normal.shopUnlocked('tungsten')).toBe(false);
    normal.money = 0;
    expect(normal.buy('iron')).toBe('SALDO INSUFICIENTE');
  });

  it('money alterna compras sin saldo ni descuento, sin desbloquear etapas', () => {
    const s = session();
    s.money = 0;
    s.developer.execute('  MoNeY ');
    expect(s.buy('iron')).toBe('COMPRA REALIZADA');
    expect(s.money).toBe(0);
    expect(s.buy('tungsten')).toBe(`REQUIERE ETAPA ${TOOLS.tungsten.tier}`);
    s.developer.execute('money');
    expect(s.buy('iron')).toBe('SALDO INSUFICIENTE');
    s.money = 500;
    expect(s.buy('iron')).toBe('COMPRA REALIZADA');
    expect(s.money).toBe(500 - TOOLS.iron.price);
  });

  it('fullstacks habilita todo el catálogo sin alterar progreso ni entregar artículos', () => {
    for (const kind of [
      ...TOOL_KEYS,
      ...SUPPLY_KEYS,
      ...PPE_KEYS.filter((k) => PPE[k].price > 0),
    ]) {
      const s = session();
      const before = s.tools.items.length;
      expect(s.developer.execute('fullstacks').changed).toBe(true);
      expect(s.developer.execute('fullstacks').changed).toBe(false);
      expect(s.tools.items.length).toBe(before);
      expect(s.shopUnlocked(kind)).toBe(true);
      s.money = 10000;
      const price = s.priceOf(kind);
      expect(s.buy(kind)).toBe('COMPRA REALIZADA');
      expect(s.money).toBe(10000 - price);
      expect(s.progression.tier).toBe(1);
      expect(s.progression.xp).toBe(0);
      expect(s.achievements.unlocked.size).toBe(0);
    }
  });

  it('conserva capacidad, kit único y comandos desconocidos sin efectos', () => {
    const s = session();
    s.developer.execute('money');
    s.developer.execute('fullstacks');
    s.buy('kit');
    const ppe = s.loadout.ppe.length;
    expect(s.buy('kit')).toBe('YA RECLAMASTE TU KIT DE SEGURIDAD');
    expect(s.loadout.ppe.length).toBe(ppe);
    for (let i = 0; i < MAX_SLOTS + 2 && s.loadout.free() > 0; i++)
      s.buy('tungsten');
    expect(s.buy('tungsten')).toBe('INVENTARIO LLENO: LIBERA UNA CASILLA');
    const before = encodeSave(s, SPAWN);
    expect(s.developer.execute('money extra').changed).toBe(false);
    expect(encodeSave(s, SPAWN)).toBe(before);
  });

  it('persiste flags booleanos, ignora flags fuera de desarrollo y admite saves antiguos', () => {
    const s = session();
    s.developer.execute('money');
    s.developer.execute('fullstacks');
    const raw = encodeSave(s, SPAWN);
    const loaded = decodeSave(raw, true)!.session;
    expect(loaded.developer.infiniteMoney).toBe(true);
    expect(loaded.shopUnlocked('tungsten')).toBe(true);
    expect(decodeSave(raw)!.session.developer.fullStacks).toBe(false);
    loaded.developer.execute('money');
    const again = decodeSave(encodeSave(loaded, SPAWN), true)!.session;
    expect(again.developer.infiniteMoney).toBe(false);
    expect(again.developer.fullStacks).toBe(true);
    const old = JSON.parse(raw);
    delete old.developer;
    expect(
      decodeSave(JSON.stringify(old), true)!.session.developer.fullStacks,
    ).toBe(false);
    old.developer = { infiniteMoney: 'true', fullStacks: 1 };
    expect(
      decodeSave(JSON.stringify(old), true)!.session.developer.infiniteMoney,
    ).toBe(false);
    expect(
      decodeSave(JSON.stringify(old), true)!.session.developer.fullStacks,
    ).toBe(false);
  });
});
