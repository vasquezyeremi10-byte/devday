import { describe, expect, it } from 'vitest';
import { SUPPLY_KEYS } from '../config/balance';
import { DRONE } from '../config/drones';
import { FOODS } from '../config/survival';
import { createInitialTerrain, DEFAULT_SEED } from '../world/Geology';
import { GameSession } from './GameSession';
import { HEALTH } from './HealthSystem';
import { decodeSave, encodeSave } from './SaveSystem';

const session = () => {
  const s = new GameSession(createInitialTerrain(DEFAULT_SEED), DEFAULT_SEED);
  s.mode = 'normal';
  s.modeChosen = true;
  return s;
};
const T0 = 5_000_000;

describe('productos del celular: ítems reales', () => {
  it('botiquín cura 2 corazones y no se gasta con la salud completa', () => {
    const s = session();
    s.supplies.medkit = 2;
    expect(s.eat('medkit')).toEqual({
      ok: false,
      message: 'TU SALUD ESTA COMPLETA',
    });
    expect(s.supplies.medkit).toBe(2);
    s.health.hp = 30;
    expect(s.eat('medkit')).toEqual({ ok: true, message: '+2 CORAZONES' });
    expect(s.health.hp).toBe(30 + FOODS.medkit.heal);
    expect(s.supplies.medkit).toBe(1);
    s.health.hp = HEALTH.max - 10;
    expect(s.eat('medkit').message).toBe('+0.5 CORAZONES');
  });

  it('completo, suavecilla y terremoto alimentan como la comida de la bodega', () => {
    const s = session();
    s.survival.energy = 10;
    s.survival.hunger = 10;
    s.supplies.completo = 1;
    s.supplies.suavecilla = 1;
    s.supplies.terremoto = 1;
    expect(s.eat('completo')).toEqual({ ok: true, message: '+2 ALIMENTACION' });
    expect(s.eat('suavecilla')).toEqual({ ok: true, message: '+1 ENERGIA' });
    expect(s.eat('terremoto')).toEqual({ ok: true, message: '+1 ENERGIA' });
  });
});

describe('recibir del dron', () => {
  it('apila en la casilla existente y rechaza un tipo nuevo con el inventario lleno', () => {
    const s = session();
    s.supplies.torch = 1;
    // Llena todas las casillas libres con suministros distintos.
    for (const kind of SUPPLY_KEYS) {
      if (s.loadout.free() <= 0) break;
      if (kind === 'medkit' || kind === 'torch') continue;
      s.supplies[kind] = 1;
      s.loadout.sync();
    }
    while (s.loadout.free() > 0) s.tools.add('shovel');
    expect(s.loadout.free()).toBe(0);
    expect(s.receive('medkit')).toBe(false);
    expect(s.supplies.medkit).toBe(0);
    expect(s.receive('torch')).toBe(true);
    expect(s.supplies.torch).toBe(2);
  });

  it('la caja entrega lo que cabe y conserva el resto', () => {
    const s = session();
    const o = s.drones.place(
      [
        { kind: 'cola', qty: 2 },
        { kind: 'medkit', qty: 1 },
      ],
      35,
      T0,
    );
    s.drones.launch(o.id);
    s.drones.deliver(o.id);
    let room = 2;
    const r = s.drones.collect(o.id, (kind) => room-- > 0 && s.receive(kind))!;
    expect(r.left).toBe(1);
    expect(s.supplies.cola).toBe(2);
    expect(s.supplies.medkit).toBe(0);
    expect(s.drones.collect(o.id, (kind) => s.receive(kind))!.emptied).toBe(
      true,
    );
    expect(s.supplies.medkit).toBe(1);
  });
  it('abrir y visitar la bodega no incorporan productos de la caja', () => {
    const s = session();
    const o = s.drones.place([{ kind: 'medkit', qty: 2 }], 50, T0);
    s.drones.launch(o.id);
    const box = s.drones.deliver(o.id)!;
    box.opened = true;
    expect(s.warehouse.carried(s).some((item) => item.kind === 'medkit')).toBe(
      false,
    );
    expect(
      s.warehouse.deposit(s, { type: 'supply', kind: 'medkit', count: 2 }, 1),
    ).toBe('CANTIDAD NO DISPONIBLE');
    expect(box.items).toEqual([{ kind: 'medkit', qty: 2 }]);
    const loaded = decodeSave(encodeSave(s, { x: 0, y: 148 }))!.session;
    expect(loaded.drones.boxes[0]!.items).toEqual(box.items);
    expect(
      loaded.warehouse.carried(loaded).some((item) => item.kind === 'medkit'),
    ).toBe(false);
  });
  it('retira solo la cantidad confirmada y conserva una pila pendiente al guardar', () => {
    const s = session();
    const o = s.drones.place([{ kind: 'medkit', qty: 3 }], 75, T0);
    s.drones.launch(o.id);
    s.drones.deliver(o.id);
    expect(
      s.drones.collectLine(o.id, 'medkit', 1, (kind) => s.receive(kind))?.taken,
    ).toBe(1);
    expect(s.supplies.medkit).toBe(1);
    expect(s.drones.boxes[0]!.items).toEqual([{ kind: 'medkit', qty: 2 }]);
    const loaded = decodeSave(encodeSave(s, { x: 0, y: 148 }))!.session;
    expect(loaded.supplies.medkit).toBe(1);
    expect(loaded.drones.boxes[0]!.items).toEqual([{ kind: 'medkit', qty: 2 }]);
  });
});

describe('guardar y cargar durante una entrega', () => {
  it('el pedido pagado y la caja sobreviven sin duplicarse', () => {
    const s = session();
    s.money = 100;
    const a = s.drones.place([{ kind: 'torch', qty: 4 }], 8, T0);
    s.money -= 8;
    s.drones.launch(a.id); // en vuelo al guardar
    const b = s.drones.place([{ kind: 'fuse', qty: 1 }], 3, T0 + 1000);
    s.money -= 3;
    const raw = encodeSave(s, { x: -300, y: 148 });
    const back = decodeSave(raw)!.session;
    expect(back.money).toBe(89);
    expect(back.drones.orders.map((o) => [o.id, o.slot])).toEqual([
      [a.id, null],
      [b.id, null],
    ]);
    // Al cargar despega una vez y entrega una sola caja.
    const due = back.drones.nextLaunch(T0 + DRONE.waitMs)!;
    expect(due.id).toBe(a.id);
    back.drones.launch(due.id);
    back.drones.deliver(due.id);
    const again = decodeSave(encodeSave(back, { x: -300, y: 148 }))!.session;
    expect(again.drones.boxes.map((x) => x.id)).toEqual([a.id]);
    expect(again.drones.orders.map((o) => o.id)).toEqual([b.id]);
    expect(again.money).toBe(89);
  });

  it('una partida sin datos de drones carga sin pedidos ni cajas', () => {
    const s = session();
    const data = JSON.parse(encodeSave(s, { x: 0, y: 148 }));
    delete data.drones;
    const back = decodeSave(JSON.stringify(data))!.session;
    expect(back.drones.orders).toEqual([]);
    expect(back.drones.boxes).toEqual([]);
  });
});
