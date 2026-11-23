import { describe, expect, it } from 'vitest';
import { SUPPLY_KEYS } from '../config/balance';
import { FRIDGE, isPerishable, PERISHABLE_KEYS } from '../config/survival';
import { STACK_MAX } from '../config/buildMaterials';
import { createInitialTerrain, DEFAULT_SEED } from '../world/Geology';
import { CYCLE_MS, DAY_MS, DayNightCycle, NIGHT_MS } from './DayNightCycle';
import {
  addLot,
  badge,
  describe as describeFresh,
  formatClock,
  formatDays,
  freeze,
  GAME_DAY_MS,
  shelfLifeMs,
  summarize,
  takeFreshUnit,
  takeSoonest,
  thaw,
  type Lot,
} from './Freshness';
import { GameSession } from './GameSession';
import { decodeSave, encodeSave } from './SaveSystem';

const session = () => {
  const s = new GameSession(createInitialTerrain(DEFAULT_SEED), DEFAULT_SEED);
  s.mode = 'normal';
  s.modeChosen = true;
  s.money = 10_000;
  s.progression.tier = 3;
  return s;
};
/** Avanza el reloj de juego como lo hace la escena: cuadros de hasta 1 s. */
const advance = (s: GameSession, ms: number) => {
  for (let left = ms; left > 0; left -= 1000)
    s.dayNight.tick(Math.min(1000, left));
};
const LIFE = 3 * CYCLE_MS;

describe('reloj de juego y vida útil', () => {
  it('tres días completos del juego son tres ciclos día + noche, no 72 horas', () => {
    expect(GAME_DAY_MS).toBe(DAY_MS + NIGHT_MS);
    expect(GAME_DAY_MS).toBe(600_000);
    expect(shelfLifeMs('cola')).toBe(LIFE);
    expect(shelfLifeMs('cola')).toBe(1_800_000);
    expect(shelfLifeMs('cola')).not.toBe(72 * 3_600_000);
    expect(shelfLifeMs('medkit')).toBe(0);
    expect(shelfLifeMs('iron')).toBe(0);
  });

  it('totalMs avanza con el ciclo sin cambiar su velocidad ni dar la vuelta', () => {
    const c = new DayNightCycle();
    const start = c.totalMs;
    c.tick(1000);
    expect(c.elapsedMs).toBe(start + 1000); // misma velocidad que antes
    for (let i = 0; i < 700; i++) c.tick(1000); // más de un ciclo
    expect(c.totalMs).toBe(start + 701_000);
    expect(c.elapsedMs).toBe((start + 701_000) % CYCLE_MS);
    expect(c.day).toBe(2);
    c.tick(1000, true); // en pausa no avanza
    c.tick(5000); // un cuadro largo se acota a 1 s
    expect(c.totalMs).toBe(start + 702_000);
  });

  it('dormir suma al acumulado el salto de hora', () => {
    const c = new DayNightCycle();
    const before = c.totalMs;
    const { skippedMs } = c.skipToNextPhase();
    expect(c.totalMs).toBe(before + skippedMs);
    const again = c.skipToNextPhase();
    expect(c.totalMs).toBe(before + skippedMs + again.skippedMs);
    expect(c.totalMs % CYCLE_MS).toBeCloseTo(c.elapsedMs, 3);
  });

  it('restaura el acumulado, y sin él (o incoherente) lo reconstruye de la hora', () => {
    const c = new DayNightCycle();
    c.restore(120_000, 2 * CYCLE_MS + 120_000);
    expect(c.totalMs).toBe(2 * CYCLE_MS + 120_000);
    c.restore(120_000);
    expect(c.totalMs).toBe(120_000);
    c.restore(120_000, 2 * CYCLE_MS + 999_999); // otra hora del día
    expect(c.totalMs).toBe(120_000);
    c.restore(0, CYCLE_MS - 0.0001); // dar la vuelta del ciclo
    expect(c.totalMs).toBe(CYCLE_MS - 0.0001);
  });
});

describe('lotes', () => {
  it('funde lotes iguales y mantiene el orden', () => {
    const lots: Lot[] = [];
    addLot(lots, 50, 2);
    addLot(lots, 10, 1);
    addLot(lots, 50, 3);
    expect(lots).toEqual([
      { t: 10, qty: 1 },
      { t: 50, qty: 5 },
    ]);
  });

  it('retira primero lo que vence antes y consume solo unidades vigentes', () => {
    const lots: Lot[] = [
      { t: 10, qty: 2 },
      { t: 90, qty: 3 },
    ];
    expect(takeSoonest(lots, 3)).toEqual([
      { t: 10, qty: 2 },
      { t: 90, qty: 1 },
    ]);
    expect(lots).toEqual([{ t: 90, qty: 2 }]);
    const mixed: Lot[] = [
      { t: 10, qty: 1 }, // vencida
      { t: 90, qty: 1 },
    ];
    expect(takeFreshUnit(mixed, 50)).toBe(true);
    expect(mixed).toEqual([{ t: 10, qty: 1 }]);
    expect(takeFreshUnit(mixed, 50)).toBe(false);
  });

  it('congelar guarda el tiempo restante y descongelar lo devuelve intacto', () => {
    const lots: Lot[] = [
      { t: 1_000, qty: 2 }, // vence en 400 desde 600
      { t: 5_000, qty: 1 },
    ];
    const frozen = freeze(lots, 600);
    expect(frozen).toEqual([
      { t: 400, qty: 2 },
      { t: 4_400, qty: 1 },
    ]);
    // Pase lo que pase en el reloj, descongelar da ahora + restante.
    expect(thaw(frozen, 999_000)).toEqual([
      { t: 999_400, qty: 2 },
      { t: 1_003_400, qty: 1 },
    ]);
    // Lo vencido no revive al congelarlo.
    expect(freeze([{ t: 100, qty: 1 }], 600)).toEqual([{ t: 0, qty: 1 }]);
    expect(summarize(freeze([{ t: 100, qty: 1 }], 600), 0, true).state).toBe(
      'expired',
    );
  });

  it('presenta días y tiempo restante', () => {
    expect(formatDays(LIFE)).toBe('3');
    expect(formatDays(LIFE - GAME_DAY_MS * 0.6)).toBe('2,4');
    expect(formatDays(1)).toBe('0,1');
    expect(formatClock(90_500)).toBe('1:31');
    const s = summarize(
      [
        { t: 100, qty: 1 },
        { t: 100 + GAME_DAY_MS * 2, qty: 2 },
        { t: 100 + GAME_DAY_MS * 3, qty: 1 },
      ],
      200,
    );
    expect(s).toMatchObject({ count: 4, expired: 1, dates: 2, state: 'fresh' });
    expect(badge(s)).toBe('2D');
    expect(describeFresh(s)).toEqual([
      `VENCE EN 2 DIAS (${formatClock(GAME_DAY_MS * 2 - 100)})`,
      '2 FECHAS DE VENCIMIENTO DISTINTAS',
      '1 VENCIDA(S): NO SE PUEDEN CONSUMIR',
    ]);
    expect(badge(summarize([{ t: 10, qty: 1 }], 50))).toBe('VENC');
  });
});

describe('alimentos del inventario', () => {
  it('perecederos: los seis alimentos y bebidas; no el botiquín ni las herramientas', () => {
    expect([...PERISHABLE_KEYS].sort()).toEqual(
      [
        'cola',
        'completo',
        'empanada',
        'sandwich',
        'suavecilla',
        'terremoto',
      ].sort(),
    );
    expect(isPerishable('medkit')).toBe(false);
    expect(isPerishable('torch')).toBe(false);
  });

  it('vence exactamente a los tres días del juego y no se puede consumir', () => {
    const s = session();
    s.survival.energy = 10;
    s.survival.hunger = 10;
    const t0 = s.dayNight.totalMs;
    expect(s.buy('sandwich')).toBe('COMPRA REALIZADA');
    expect(s.food.lots('sandwich')).toEqual([{ t: t0 + LIFE, qty: 1 }]);
    advance(s, LIFE - 1000);
    expect(s.eat('sandwich').ok).toBe(true); // queda 1 s: sigue vigente
    s.addSupply('sandwich', 1, t0 + LIFE); // otra unidad con el mismo vencimiento
    advance(s, 1000);
    expect(s.dayNight.totalMs).toBe(t0 + LIFE);
    const r = s.eat('sandwich');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/^VENCIDO/);
    expect(s.supplies.sandwich).toBe(1); // no se gasta
  });

  it('una pila con distintas fechas gasta primero lo que vence antes', () => {
    const s = session();
    s.survival.hunger = 0;
    s.survival.energy = 0;
    const t0 = s.dayNight.totalMs;
    s.buy('empanada');
    s.buy('empanada');
    advance(s, GAME_DAY_MS);
    s.buy('empanada');
    s.buy('empanada');
    expect(s.food.lots('empanada')).toEqual([
      { t: t0 + LIFE, qty: 2 },
      { t: t0 + GAME_DAY_MS + LIFE, qty: 2 },
    ]);
    expect(s.eat('empanada').ok).toBe(true);
    expect(s.food.lots('empanada')).toEqual([
      { t: t0 + LIFE, qty: 1 },
      { t: t0 + GAME_DAY_MS + LIFE, qty: 2 },
    ]);
    // Cuando vence el primer lote, el resto de la pila sigue siendo comestible.
    advance(s, LIFE - GAME_DAY_MS);
    expect(s.eat('empanada').ok).toBe(true);
    expect(s.supplies.empanada).toBe(2);
    expect(s.food.lots('empanada')).toEqual([
      { t: t0 + LIFE, qty: 1 },
      { t: t0 + GAME_DAY_MS + LIFE, qty: 1 },
    ]);
  });

  it('vencidos: se descartan y el registro se ajusta', () => {
    const s = session();
    s.buy('cola');
    advance(s, LIFE);
    expect(s.eat('cola').ok).toBe(false);
    s.loadout.sync();
    const slot = s.loadout.slots.findIndex(
      (r) => r?.type === 'supply' && r.kind === 'cola',
    );
    expect(s.loadout.discard(slot)).toBeNull();
    expect(s.supplies.cola).toBe(0);
    s.syncFood();
    expect(s.food.lots('cola')).toEqual([]);
  });

  it('cantidades cambiadas desde fuera nacen frescas', () => {
    const s = session();
    s.supplies.completo = 4; // como hacen otras partes y las pruebas
    s.syncFood();
    expect(s.food.lots('completo')).toEqual([
      { t: s.dayNight.totalMs + LIFE, qty: 4 },
    ]);
  });

  it('dormir envejece la comida de afuera', () => {
    const s = session();
    s.buy('cola');
    const lots = s.food.lots('cola')[0]!.t - s.dayNight.totalMs;
    s.sleep();
    expect(s.food.lots('cola')[0]!.t - s.dayNight.totalMs).toBeLessThan(lots);
  });
});

/** Llena las casillas libres de la mochila con otros suministros. */
const fillBackpack = (s: GameSession) => {
  for (const kind of SUPPLY_KEYS) {
    if (s.loadout.free() <= 0) break;
    if (isPerishable(kind) || kind === 'medkit') continue;
    s.supplies[kind] = 1;
    s.loadout.sync();
  }
  while (s.loadout.free() > 0) s.tools.add('shovel');
};

describe('refrigerador', () => {
  it('10 casillas con el límite de apilado normal', () => {
    const s = session();
    expect(s.fridge.capacity).toBe(FRIDGE.slots);
    expect(s.fridge.capacity).toBe(10);
    s.supplies.cola = STACK_MAX + 1;
    const r = s.fridge.deposit(s, 'cola', STACK_MAX + 1);
    expect(r).toEqual({ moved: STACK_MAX + 1 });
    expect(s.fridge.slots.map((x) => x.count)).toEqual([STACK_MAX, 1]);
    // Llena las 10 casillas.
    s.supplies.sandwich = STACK_MAX * 8;
    expect(s.fridge.deposit(s, 'sandwich', STACK_MAX * 8)).toEqual({
      moved: STACK_MAX * 8,
    });
    expect(s.fridge.used).toBe(10);
    expect(s.fridge.free).toBe(0);
    s.supplies.empanada = 5;
    expect(s.fridge.deposit(s, 'empanada', 5)).toEqual({
      error: 'REFRIGERADOR LLENO',
    });
    expect(s.supplies.empanada).toBe(5);
    // Una pila con hueco todavía admite más del mismo tipo.
    s.supplies.cola = 3;
    s.food.reconcile('cola', 3, s.dayNight.totalMs);
    expect(s.fridge.deposit(s, 'cola', 3)).toEqual({ moved: 3 });
    expect(s.fridge.slots[1]!.count).toBe(4);
  });

  it('pasa solo lo que cabe cuando falta espacio', () => {
    const s = session();
    s.supplies.terremoto = STACK_MAX * 11;
    const r = s.fridge.deposit(s, 'terremoto', STACK_MAX * 11);
    expect(r).toEqual({ moved: STACK_MAX * 10 });
    expect(s.supplies.terremoto).toBe(STACK_MAX);
  });

  it('el tiempo de caducidad queda detenido adentro y continúa al sacarlo', () => {
    const s = session();
    s.buy('sandwich');
    advance(s, GAME_DAY_MS); // 1 día afuera: quedan 2
    expect(s.fridge.deposit(s, 'sandwich', 1)).toEqual({ moved: 1 });
    expect(s.supplies.sandwich).toBe(0);
    expect(s.fridge.slots[0]!.lots).toEqual([{ t: 2 * GAME_DAY_MS, qty: 1 }]);
    advance(s, 10 * GAME_DAY_MS); // 10 días adentro: nada cambia
    expect(s.fridge.slots[0]!.lots).toEqual([{ t: 2 * GAME_DAY_MS, qty: 1 }]);
    expect(s.fridge.summary(0)).toMatchObject({
      state: 'fresh',
      nextMs: 2 * GAME_DAY_MS,
    });
    expect(s.fridge.withdraw(s, 0, 1)).toEqual({ moved: 1 });
    expect(s.fridge.used).toBe(0);
    const left = () => s.food.lots('sandwich')[0]!.t - s.dayNight.totalMs;
    expect(left()).toBe(2 * GAME_DAY_MS); // no se reinició (3) ni se perdió
    advance(s, 2 * GAME_DAY_MS - 1000);
    s.survival.hunger = 0;
    expect(s.eat('sandwich').ok).toBe(true);
  });

  it('afuera de nuevo, vence cuando se acaba el tiempo restante', () => {
    const s = session();
    s.buy('cola');
    advance(s, 2 * GAME_DAY_MS);
    s.fridge.deposit(s, 'cola', 1);
    advance(s, 5 * GAME_DAY_MS);
    s.fridge.withdraw(s, 0, 1);
    advance(s, GAME_DAY_MS); // el último día
    expect(s.eat('cola').ok).toBe(false);
    s.syncFood();
    expect(s.food.lots('cola')).toHaveLength(1);
  });

  it('mantiene separadas las fechas de una pila al ir y volver', () => {
    const s = session();
    s.survival.energy = 0;
    s.buy('cola');
    s.buy('cola');
    advance(s, GAME_DAY_MS);
    s.buy('cola');
    s.buy('cola');
    // Se guardan 3: las 2 que vencen antes y 1 de las nuevas.
    expect(s.fridge.deposit(s, 'cola', 3)).toEqual({ moved: 3 });
    expect(s.fridge.slots).toHaveLength(1);
    expect(s.fridge.slots[0]!.lots).toEqual([
      { t: 2 * GAME_DAY_MS, qty: 2 },
      { t: 3 * GAME_DAY_MS, qty: 1 },
    ]);
    expect(s.food.lots('cola')).toEqual([
      { t: s.dayNight.totalMs + 3 * GAME_DAY_MS - 0, qty: 1 },
    ]);
    advance(s, GAME_DAY_MS);
    // Sacar las 3: adentro estuvieron detenidas (2 y 3 días restantes) y la
    // unidad que quedó afuera envejeció 1 día (también le quedan 2): se funden.
    s.fridge.withdraw(s, 0, 3);
    expect(s.supplies.cola).toBe(4);
    const now = s.dayNight.totalMs;
    expect(s.food.lots('cola')).toEqual([
      { t: now + 2 * GAME_DAY_MS, qty: 3 },
      { t: now + 3 * GAME_DAY_MS, qty: 1 },
    ]);
  });

  it('no deja sacar sin casilla libre en la mochila, pero sí apilar en una existente', () => {
    const s = session();
    s.supplies.cola = 1;
    s.supplies.empanada = 1;
    s.fridge.deposit(s, 'cola', 1);
    s.fridge.deposit(s, 'empanada', 1);
    fillBackpack(s);
    expect(s.loadout.free()).toBe(0);
    expect(s.fridge.withdraw(s, 0, 1)).toEqual({
      error: 'MOCHILA LLENA: LIBERA UNA CASILLA',
    });
    expect(s.fridge.used).toBe(2);
    // Si ya llevas ese producto, apila sin casilla nueva.
    s.supplies.empanada = 1;
    s.loadout.sync();
    // (la mochila quedó sin hueco para «empanada»: se vuelve a llenar)
    fillBackpack(s);
    expect(s.fridge.withdraw(s, 1, 1)).toEqual({ moved: 1 });
    expect(s.supplies.empanada).toBe(2);
  });

  it('tira lo vencido', () => {
    const s = session();
    s.buy('cola');
    s.buy('cola');
    advance(s, LIFE - 500);
    s.fridge.deposit(s, 'cola', 1); // le quedaban 500 ms
    advance(s, 2000);
    expect(s.fridge.discardExpired()).toBe(0); // congelado: no venció
    s.food.take('cola', 1); // la otra ya venció afuera
    s.supplies.cola = 0;
    s.supplies.cola = 1;
    s.food.reconcile('cola', 1, s.dayNight.totalMs);
    // Una vencida dentro (llegó vencida al refrigerador).
    s.fridge.slots.push({
      kind: 'sandwich',
      count: 2,
      lots: [{ t: 0, qty: 2 }],
    });
    expect(s.fridge.discardExpired()).toBe(2);
    expect(s.fridge.slots.map((x) => x.kind)).toEqual(['cola']);
  });
});

describe('bodega, cajas y guardado', () => {
  it('la bodega guarda las fechas y el tiempo sigue corriendo dentro de ella', () => {
    const s = session();
    s.buy('cola');
    advance(s, GAME_DAY_MS);
    s.buy('cola');
    const stack = s.warehouse
      .carried(s)
      .find((x) => x.type === 'supply' && x.kind === 'cola')!;
    expect(s.warehouse.deposit(s, stack, 2)).toBeUndefined();
    expect(s.supplies.cola).toBe(0);
    const stored = s.warehouse.stacks.find(
      (x) => x.type === 'supply' && x.kind === 'cola',
    )!;
    expect(stored.type === 'supply' && stored.lots).toHaveLength(2);
    advance(s, GAME_DAY_MS); // en la bodega el reloj no se detiene
    const index = s.warehouse.stacks.indexOf(stored);
    expect(s.warehouse.withdraw(s, index, 2)).toBeUndefined();
    const lots = s.food.lots('cola');
    expect(lots.map((l) => l.qty)).toEqual([1, 1]);
    expect(lots[0]!.t - s.dayNight.totalMs).toBe(LIFE - 2 * GAME_DAY_MS);
    expect(lots[1]!.t - s.dayNight.totalMs).toBe(LIFE - GAME_DAY_MS);
  });

  it('la bodega apila las fechas de pilas iguales sin mezclar los tipos', () => {
    const s = session();
    s.buy('cola');
    s.buy('sandwich');
    advance(s, GAME_DAY_MS);
    s.buy('cola');
    for (const stack of s.warehouse.carried(s))
      if (stack.type === 'supply') s.warehouse.deposit(s, stack, stack.count);
    const cola = s.warehouse.stacks.filter(
      (x) => x.type === 'supply' && x.kind === 'cola',
    );
    expect(cola).toHaveLength(1);
    expect(cola[0]!.count).toBe(2);
    expect(cola[0]!.type === 'supply' && cola[0]!.lots).toHaveLength(2);
  });

  it('guarda y carga reloj, lotes, bodega y refrigerador sin reiniciar nada', () => {
    const s = session();
    s.buy('sandwich');
    s.buy('sandwich');
    advance(s, GAME_DAY_MS);
    s.buy('cola');
    s.fridge.deposit(s, 'sandwich', 1);
    s.buy('empanada');
    const stack = s.warehouse
      .carried(s)
      .find((x) => x.type === 'supply' && x.kind === 'empanada')!;
    s.warehouse.deposit(s, stack, 1);
    advance(s, 3 * GAME_DAY_MS);
    const raw = encodeSave(s, { x: 0, y: 148 });
    const back = decodeSave(raw)!.session;
    expect(back.dayNight.totalMs).toBe(s.dayNight.totalMs);
    expect(back.dayNight.elapsedMs).toBe(s.dayNight.elapsedMs);
    expect(back.food.snapshot()).toEqual(s.food.snapshot());
    expect(back.fridge.snapshot()).toEqual(s.fridge.snapshot());
    expect(back.fridge.slots[0]!.lots[0]!.t).toBe(2 * GAME_DAY_MS);
    const wh = back.warehouse.stacks.find(
      (x) => x.type === 'supply' && x.kind === 'empanada',
    )!;
    expect(wh.type === 'supply' && wh.lots).toEqual(
      (
        s.warehouse.stacks.find(
          (x) => x.type === 'supply' && x.kind === 'empanada',
        ) as { lots: Lot[] }
      ).lots,
    );
    // Recargar no revive ni reinicia: la cola de ayer sigue vencida.
    expect(back.eat('sandwich').ok).toBe(false);
    // Y el refrigerador sigue conservando: sale con su tiempo restante.
    expect(back.fridge.withdraw(back, 0, 1)).toEqual({ moved: 1 });
    expect(back.food.lots('sandwich').pop()!.t - back.dayNight.totalMs).toBe(
      2 * GAME_DAY_MS,
    );
  });

  it('una partida anterior sin fechas carga con todo fresco', () => {
    const s = session();
    s.supplies.cola = 2;
    s.warehouse.stacks.push({ type: 'supply', kind: 'empanada', count: 3 });
    const data = JSON.parse(encodeSave(s, { x: 0, y: 148 }));
    delete data.food;
    delete data.fridge;
    delete data.dayNightTotalMs;
    data.warehouse = {
      stacks: [{ type: 'supply', kind: 'empanada', count: 3 }],
    };
    const back = decodeSave(JSON.stringify(data))!.session;
    const now = back.dayNight.totalMs;
    expect(back.food.lots('cola')).toEqual([{ t: now + LIFE, qty: 2 }]);
    const wh = back.warehouse.stacks[0]!;
    expect(wh.type === 'supply' && wh.lots).toEqual([
      { t: now + LIFE, qty: 3 },
    ]);
    expect(back.fridge.slots).toEqual([]);
  });

  it('descarta un refrigerador dañado sin romper la carga', () => {
    const s = session();
    const data = JSON.parse(encodeSave(s, { x: 0, y: 148 }));
    data.fridge = {
      slots: [
        { kind: 'cola', count: 2, lots: [{ t: 5, qty: 2 }] },
        { kind: 'cola', count: 9, lots: [{ t: 5, qty: 2 }] }, // cantidad incoherente
        { kind: 'iron', count: 1, lots: [{ t: 5, qty: 1 }] }, // no es un alimento
        {
          kind: 'cola',
          count: STACK_MAX + 1,
          lots: [{ t: 5, qty: STACK_MAX + 1 }],
        },
        ...Array.from({ length: 20 }, () => ({
          kind: 'sandwich',
          count: 1,
          lots: [{ t: 7, qty: 1 }],
        })),
      ],
    };
    const back = decodeSave(JSON.stringify(data))!.session;
    expect(back.fridge.used).toBe(10);
    expect(back.fridge.slots[0]).toEqual({
      kind: 'cola',
      count: 2,
      lots: [{ t: 5, qty: 2 }],
    });
    expect(back.fridge.slots.every((x) => x.kind !== ('iron' as never))).toBe(
      true,
    );
  });

  it('la comida de una caja del dron envejece desde que cae, no desde que se abre', () => {
    const s = session();
    const o = s.drones.place([{ kind: 'cola', qty: 2 }], 10, 0);
    s.drones.launch(o.id);
    const at = s.dayNight.totalMs;
    const box = s.drones.deliver(o.id, at)!;
    advance(s, 2 * GAME_DAY_MS);
    s.drones.collect(box.id, (kind) =>
      s.receive(kind, box.at + shelfLifeMs(kind)),
    );
    expect(s.food.lots('cola')).toEqual([{ t: at + LIFE, qty: 2 }]);
    expect(s.food.lots('cola')[0]!.t - s.dayNight.totalMs).toBe(GAME_DAY_MS);
    // La caja guarda su hora.
    const o2 = s.drones.place([{ kind: 'cola', qty: 1 }], 5, 0);
    s.drones.launch(o2.id);
    s.drones.deliver(o2.id, s.dayNight.totalMs);
    const back = decodeSave(encodeSave(s, { x: 0, y: 148 }))!.session;
    expect(back.drones.boxes[0]!.at).toBe(s.dayNight.totalMs);
  });
});
