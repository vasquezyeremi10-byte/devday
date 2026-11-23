import { describe, expect, it } from 'vitest';
import { MAX_SLOTS, PPE, REQUIRED_PPE, xpForLevel } from '../config/gear';
import { createInitialTerrain } from '../world/Geology';
import { applyDismantle, planDismantle, structureAt } from './DismantleSystem';
import { GameSession } from './GameSession';
import { heartHalves } from './HealthSystem';
import { decodeSave, encodeSave } from './SaveSystem';

const fresh = () => new GameSession(createInitialTerrain());

describe('Inventario por casillas y niveles', () => {
  it('empieza con las 24 casillas y subir de nivel no cambia su capacidad', () => {
    const s = fresh();
    expect(s.loadout.unlocked).toBe(MAX_SLOTS);
    s.gainXp(xpForLevel(3));
    expect(s.progression.level).toBe(3);
    expect(s.loadout.unlocked).toBe(MAX_SLOTS);
    expect(s.levelEvents.at(-1)).toEqual({ level: 3, count: 2 });
  });
  it('la misma acción no premia experiencia dos veces', () => {
    const s = fresh();
    s.gainXp(10, 'support:5,5:wood');
    s.gainXp(10, 'support:5,5:wood');
    expect(s.progression.xp).toBe(10);
  });
  it('la última casilla acepta objetos y movimientos desde el inicio', () => {
    const s = fresh();
    s.supplies.torch = 2;
    s.loadout.sync();
    const i = s.loadout.slots.findIndex((r) => r?.type === 'supply');
    expect(s.loadout.move(i, MAX_SLOTS - 1)).toBeNull();
    expect(s.loadout.slots[MAX_SLOTS - 1]).toEqual({
      type: 'supply',
      kind: 'torch',
    });
  });
  it('mover no duplica y equipar intercambia con la ranura', () => {
    const s = fresh();
    s.tools.add('iron');
    s.tools.add('shovel');
    s.loadout.sync();
    const count = () => s.loadout.slots.filter(Boolean).length;
    const before = count();
    const i = s.loadout.slots.findIndex((r) => r?.type === 'tool');
    expect(s.loadout.move(i, 5)).toBeNull();
    expect(count()).toBe(before);
    // Equipar la picota desde la casilla 5: la pala pasa a esa casilla.
    expect(s.loadout.equipFromSlot(5)).toBeNull();
    expect(s.tools.current!.kind).toBe('iron');
    const ref = s.loadout.slots[5]!;
    expect(
      ref.type === 'tool' && s.tools.items.find((t) => t.id === ref.id)!.kind,
    ).toBe('shovel');
  });
  it('la carga minera (50 kg) es independiente de las casillas', () => {
    const s = fresh();
    s.gainXp(xpForLevel(8));
    expect(s.loadout.unlocked).toBe(MAX_SLOTS);
    s.inventory.items.push(...Array(50).fill('coal'));
    expect(s.inventory.full).toBe(true);
    expect(s.loadout.free()).toBe(MAX_SLOTS);
  });
});

describe('EPP gratuito, bodega y presupuesto inicial', () => {
  it('el kit de seguridad es gratis, se equipa solo y se reclama una vez', () => {
    const s = fresh();
    expect(s.money).toBe(50);
    expect(s.loadout.complete).toBe(false);
    expect(s.buy('helmet')).toMatch(/GRATIS/);
    expect(s.buy('kit')).toBe('KIT DE SEGURIDAD ENTREGADO Y EQUIPADO');
    expect(s.money).toBe(50);
    expect(s.loadout.complete).toBe(true);
    expect(s.loadout.slots.filter((r) => r?.type === 'ppe')).toHaveLength(0);
    expect(s.buy('kit')).toBe('YA RECLAMASTE TU KIT DE SEGURIDAD');
    expect(s.loadout.ppe).toHaveLength(5);
    expect(s.buy('iron')).toBe('COMPRA REALIZADA');
    expect(s.buy('shovel')).toBe('COMPRA REALIZADA');
    expect(s.money).toBe(25);
    expect(s.buy('ear')).toBe('REQUIERE ETAPA 2');
    expect(REQUIRED_PPE.every((k) => PPE[k].price === 0)).toBe(true);
  });
  it('el kit solo agrega piezas que faltan (sin duplicar)', () => {
    const s = fresh();
    s.loadout.addPPE('helmet');
    s.buy('kit');
    expect(s.loadout.ppe.filter((p) => p.kind === 'helmet')).toHaveLength(1);
    expect(s.loadout.complete).toBe(true);
  });
  it('desequipar exige casilla libre; una compra sin espacio no cobra', () => {
    const s = fresh();
    s.money = 500;
    s.buy('kit');
    s.buy('iron');
    for (const k of ['rail', 'wood_beam', 'torch'] as const) s.buy(k);
    s.tools.add('shovel');
    s.tools.add('iron');
    s.tools.add('shovel');
    s.loadout.sync();
    while (s.loadout.free() > 0) s.tools.add('shovel');
    expect(s.loadout.free()).toBe(0);
    const money = s.money;
    s.progression.tier = 2;
    expect(s.buy('fuse')).toBe('INVENTARIO LLENO: LIBERA UNA CASILLA');
    expect(s.money).toBe(money);
    expect(s.loadout.unequip('head')).toBe(
      'INVENTARIO LLENO: LIBERA UNA CASILLA',
    );
    expect(s.loadout.equipped('helmet')).toBe(true);
    expect(s.buy('torch')).toBe('COMPRA REALIZADA');
    expect(s.supplies.torch).toBe(2);
  });
});

describe('Modo desmontar', () => {
  const gallery = () => {
    const s = fresh();
    for (let c = 30; c <= 38; c++)
      for (const r of [13, 14]) s.grid.set(c, r, -1);
    s.afterTerrainChange([]);
    return s;
  };
  it('una viga crítica pide confirmación y retirarla reabre el riesgo', () => {
    const s = gallery();
    s.supports.install(s.grid, { column: 32, row: 14 }, 'wood');
    s.supports.install(s.grid, { column: 36, row: 14 }, 'wood');
    s.geotech.evaluate();
    expect(s.geotech.collapses.size).toBe(0);
    const id = s.supports.at(32, 14)!.id;
    const plan = planDismantle(s, structureAt(s, { column: 32, row: 14 })!);
    expect(plan.risk).toBe('danger');
    expect(plan.confirm).toBe(true);
    applyDismantle(s, plan);
    expect(s.supports.items.some((x) => x.id === id)).toBe(false);
    // Se recalcula: el techo sin esa viga queda en peligro (señales activas).
    expect(s.geotech.spans.some((sp) => sp.state === 'PELIGRO')).toBe(true);
    // Una galería más ancha sin la viga entra en colapso inminente: cuenta.
    const w = gallery();
    for (let c = 39; c <= 41; c++)
      for (const r of [13, 14]) w.grid.set(c, r, -1);
    w.afterTerrainChange([]);
    w.supports.install(w.grid, { column: 32, row: 14 }, 'wood');
    w.supports.install(w.grid, { column: 39, row: 14 }, 'wood');
    w.geotech.evaluate();
    const before = w.geotech.collapses.size;
    applyDismantle(
      w,
      planDismantle(w, structureAt(w, { column: 39, row: 14 })!),
    );
    expect(w.geotech.collapses.size).toBeGreaterThan(before);
  });
  it('sin peligro real no hay alerta; el entibado de la bocamina no se toca', () => {
    const s = fresh();
    for (let c = 30; c <= 32; c++) s.grid.set(c, 14, -1);
    s.afterTerrainChange([]);
    s.supports.install(s.grid, { column: 31, row: 14 }, 'wood');
    const plan = planDismantle(s, structureAt(s, { column: 31, row: 14 })!);
    expect(plan.risk).toBe('ok');
    expect(plan.confirm).toBe(false);
    const fixedId = s.supports.at(20, 9)!.id;
    const fixed = planDismantle(s, {
      type: 'support',
      id: fixedId,
      cell: { column: 20, row: 9 },
    });
    expect(fixed.risk).toBe('blocked');
  });
  it('recuperación fraccionaria: colocar y desmontar no genera recursos', () => {
    const s = gallery();
    s.supplies.wood_beam = 1;
    for (let i = 0; i < 6; i++) {
      // Colocar gasta una unidad; desmontar devuelve como máximo una.
      if (!s.supplies.wood_beam) break;
      s.supplies.wood_beam--;
      s.supports.install(s.grid, { column: 31, row: 14 }, 'wood');
      applyDismantle(
        s,
        planDismantle(s, structureAt(s, { column: 31, row: 14 })!),
      );
    }
    expect(s.supplies.wood_beam).toBe(0);
    s.supplies.rail = 1;
    const rail = planDismantle(s, structureAt(s, { column: 10, row: 9 })!);
    expect(rail.units).toBe(1);
  });
  it('rieles: ocupado por el carro no se retira; retirar corta la vía', () => {
    const s = fresh();
    const under = Math.floor(s.cart.x / 16);
    expect(
      planDismantle(s, structureAt(s, { column: under, row: 9 })!).risk,
    ).toBe('blocked');
    const plan = planDismantle(s, structureAt(s, { column: 12, row: 9 })!);
    expect(plan.risk).toBe('warn');
    applyDismantle(s, plan);
    expect(s.rails.at(12)).toBeUndefined();
    s.cart.x = 11 * 16 + 8;
    expect(s.rails.bounds(s.cart.x).max).toBe(12 * 16 - 10);
    // Bajo el entibado fijo de la bocamina el riel sí se puede retirar.
    expect(structureAt(s, { column: 20, row: 9 })!.type).toBe('rail');
    expect(s.supplies.rail).toBe(1);
  });
  it('retirar luces y ventilación actualiza esos sistemas', () => {
    const s = fresh();
    s.lights.install(s.grid, { column: 21, row: 9 }, 'torch');
    const version = s.lights.version;
    applyDismantle(
      s,
      planDismantle(s, structureAt(s, { column: 21, row: 9 })!),
    );
    expect(s.lights.items).toHaveLength(0);
    expect(s.lights.version).toBeGreaterThan(version);
    s.ventilation.install({ column: 12, row: 9 }, 'fan_main');
    s.ventilation.install({ column: 13, row: 9 }, 'duct');
    s.ventilation.evaluate();
    expect(s.ventilation.status[0]!.ducts).toBe(1);
    applyDismantle(
      s,
      planDismantle(s, structureAt(s, { column: 13, row: 9 })!),
    );
    expect(s.ventilation.status[0]!.ducts).toBe(0);
    applyDismantle(
      s,
      planDismantle(s, structureAt(s, { column: 12, row: 9 })!),
    );
    expect(s.ventilation.status).toHaveLength(0);
  });
});

describe('Corazones', () => {
  it('cada corazón vale 20 HP y el medio corazón 10', () => {
    expect(heartHalves(100)).toBe(10);
    expect(heartHalves(90)).toBe(9);
    expect(heartHalves(80)).toBe(8);
    expect(heartHalves(60)).toBe(6);
    expect(heartHalves(1)).toBe(1);
    expect(heartHalves(0)).toBe(0);
  });
});
describe('Guardado V4 y migración', () => {
  it('conserva nivel, casillas, equipo, barra rápida, modo y misión', () => {
    const s = fresh();
    s.mode = 'hardcore';
    s.modeChosen = true;
    s.buy('kit');
    s.buy('iron');
    s.firstDayDone = true;
    s.gainXp(xpForLevel(5));
    s.supplies.rail = 1;
    s.loadout.assignQuick(4, { type: 'supply', kind: 'rail' });
    s.loadout.selectQuick(4);
    s.stats.playMs = 12345;
    const r = decodeSave(encodeSave(s, { x: 208, y: 148 }))!;
    expect(r).not.toBeNull();
    const t = r.session;
    expect(t.mode).toBe('hardcore');
    expect(t.progression.level).toBe(5);
    expect(t.loadout.unlocked).toBe(MAX_SLOTS);
    expect(t.loadout.complete).toBe(true);
    expect(t.loadout.quickbar).toHaveLength(9);
    expect(t.loadout.quickbar[4]).toEqual({ type: 'supply', kind: 'rail' });
    expect(t.loadout.selectedQuick).toBe(4);
    expect(t.firstDayDone).toBe(true);
    expect(t.stats.playMs).toBe(12345);
    expect(encodeSave(t, r.player)).toBe(encodeSave(s, { x: 208, y: 148 }));
  });
  it('una expedición Hardcore terminada no se reanuda como activa', () => {
    const s = fresh();
    s.mode = 'hardcore';
    s.modeChosen = true;
    s.endExpedition('APLASTADO POR UN DERRUMBE');
    const r = decodeSave(encodeSave(s, { x: 208, y: 148 }))!;
    expect(r.session.ended?.cause).toBe('APLASTADO POR UN DERRUMBE');
    expect(r.session.ended?.workers).toBe(0);
  });
  it('una partida V3 recibe el EPP básico y conserva sus bienes', () => {
    const s = fresh();
    s.tools.add('iron');
    s.supplies.torch = 3;
    s.progression.earned = 200;
    const v3 = JSON.parse(encodeSave(s, { x: 208, y: 148 }));
    v3.version = 3;
    delete v3.v4;
    const r = decodeSave(JSON.stringify(v3))!;
    expect(r).not.toBeNull();
    expect(r.migrated).toMatch(/V4/);
    expect(r.session.loadout.complete).toBe(true);
    expect(r.session.mode).toBe('normal');
    expect(r.session.tools.items).toHaveLength(1);
    expect(r.session.supplies.torch).toBe(3);
    expect(r.session.progression.xp).toBeGreaterThan(0);
  });
});

describe('Guardado V5', () => {
  it('conserva kit, recuperación acumulada y estructuras retiradas', () => {
    const s = fresh();
    s.buy('kit');
    s.salvage.wood_beam = 0.5;
    applyDismantle(
      s,
      planDismantle(s, structureAt(s, { column: 12, row: 9 })!),
    );
    const r = decodeSave(encodeSave(s, { x: 208, y: 148 }))!.session;
    expect(r.kitClaimed).toBe(true);
    expect(r.salvage.wood_beam).toBe(0.5);
    // Vía cortada en el medio: se guarda y se recupera igual.
    expect(r.rails.at(12)).toBeUndefined();
    expect(r.rails.at(11)).toBeDefined();
    expect(r.supports.items.filter((x) => x.fixed)).toHaveLength(2);
  });
  it('una partida V4 que compró el EPP lo conserva y recibe $75 una vez', () => {
    const s = fresh();
    s.buy('kit');
    s.money = 10;
    const v4 = JSON.parse(encodeSave(s, { x: 208, y: 148 }));
    v4.version = 4;
    delete v4.v4.kitClaimed;
    const r = decodeSave(JSON.stringify(v4))!;
    expect(r.session.money).toBe(85);
    expect(r.session.kitClaimed).toBe(true);
    expect(r.session.loadout.ppe).toHaveLength(5);
    expect(r.migrated).toMatch(/75/);
    // Guardada ya en V5, no vuelve a compensar.
    const again = decodeSave(encodeSave(r.session, r.player))!;
    expect(again.session.money).toBe(85);
  });
});
