import { describe, expect, it } from 'vitest';
import { DRONE } from '../config/drones';
import { DroneOrders } from './DroneOrders';

const T0 = 1_000_000;

describe('DroneOrders', () => {
  it('un pedido despega exactamente a los 20 s reales', () => {
    const d = new DroneOrders();
    const o = d.place([{ kind: 'torch', qty: 3 }], 6, T0);
    expect(o.dueAt - T0).toBe(DRONE.waitMs);
    expect(d.nextLaunch(T0 + DRONE.waitMs - 1)).toBeNull();
    expect(d.remainingMs(o, T0 + 5000)).toBe(DRONE.waitMs - 5000);
    expect(d.nextLaunch(T0 + DRONE.waitMs)?.id).toBe(o.id);
  });

  it('fusiona líneas repetidas y rechaza pedidos vacíos o inválidos', () => {
    const d = new DroneOrders();
    const o = d.place(
      [
        { kind: 'cola', qty: 2 },
        { kind: 'cola', qty: 1 },
      ],
      15,
      T0,
    );
    expect(o.items).toEqual([{ kind: 'cola', qty: 3 }]);
    expect(() => d.place([], 0, T0)).toThrow();
    expect(() =>
      d.place([{ kind: 'diamond' as never, qty: 1 }], 0, T0),
    ).toThrow();
  });
  it('el pedido, la caja y el guardado no comparten las líneas del carrito', () => {
    const d = new DroneOrders();
    const cart = [{ kind: 'torch' as const, qty: 2 }];
    const o = d.place(cart, 4, T0);
    cart[0]!.qty = 9;
    expect(o.items[0]!.qty).toBe(2);
    d.launch(o.id);
    const box = d.deliver(o.id)!;
    const saved = d.snapshot();
    box.items[0]!.qty = 1;
    expect(saved.boxes[0]!.items[0]!.qty).toBe(2);
    expect(cart[0]!.qty).toBe(9);
  });

  it('un solo dron en el aire; la cola sale por orden de pago', () => {
    const d = new DroneOrders();
    const a = d.place([{ kind: 'torch', qty: 1 }], 2, T0);
    const b = d.place([{ kind: 'fuse', qty: 1 }], 3, T0 + 1000);
    const later = T0 + DRONE.waitMs + 5000;
    expect(d.nextLaunch(later)?.id).toBe(a.id);
    expect(d.launch(a.id)).toBe(0);
    expect(d.nextLaunch(later)).toBeNull(); // b espera a que a termine
    const box = d.deliver(a.id)!;
    expect(box).toMatchObject({
      id: a.id,
      slot: 0,
      items: [{ kind: 'torch', qty: 1 }],
    });
    expect(d.nextLaunch(later)?.id).toBe(b.id);
    expect(d.launch(b.id)).toBe(1); // el punto 0 tiene caja
  });

  it('limita los pedidos pendientes', () => {
    const d = new DroneOrders();
    for (let i = 0; i < DRONE.maxPending; i++) {
      expect(d.canPlace()).toBeNull();
      d.place([{ kind: 'torch', qty: 1 }], 2, T0);
    }
    expect(d.canPlace()).toMatch(/^COLA LLENA/);
  });

  it('con todos los puntos ocupados el dron no despega', () => {
    const d = new DroneOrders();
    for (let i = 0; i < DRONE.slots.length; i++) {
      const o = d.place([{ kind: 'torch', qty: 1 }], 2, T0);
      d.launch(o.id);
      d.deliver(o.id);
    }
    expect(d.boxes).toHaveLength(DRONE.slots.length);
    d.place([{ kind: 'torch', qty: 1 }], 2, T0);
    expect(d.nextLaunch(T0 + DRONE.waitMs)).toBeNull();
    d.collect(d.boxes[2]!.id, () => true);
    expect(d.nextLaunch(T0 + DRONE.waitMs)).not.toBeNull();
    expect(d.freeSlot()).toBe(2);
  });

  it('recoge lo que cabe y deja el resto en la caja', () => {
    const d = new DroneOrders();
    const o = d.place(
      [
        { kind: 'torch', qty: 3 },
        { kind: 'cola', qty: 2 },
      ],
      16,
      T0,
    );
    d.launch(o.id);
    d.deliver(o.id);
    let room = 4;
    const r = d.collect(o.id, () => room-- > 0)!;
    expect(r.taken).toEqual([
      { kind: 'torch', qty: 3 },
      { kind: 'cola', qty: 1 },
    ]);
    expect(r).toMatchObject({ left: 1, emptied: false });
    expect(d.boxes[0]).toMatchObject({
      opened: true,
      items: [{ kind: 'cola', qty: 1 }],
    });
    const again = d.collect(o.id, () => true)!;
    expect(again).toMatchObject({ left: 0, emptied: true });
    expect(d.boxes).toEqual([]);
  });

  it('guardar en vuelo y cargar no duplica: vuelve a despegar una vez', () => {
    const d = new DroneOrders();
    const o = d.place([{ kind: 'medkit', qty: 2 }], 50, T0);
    d.launch(o.id);
    const saved = JSON.parse(JSON.stringify(d.snapshot()));
    const loaded = new DroneOrders();
    loaded.restore(saved);
    expect(loaded.orders).toEqual([
      {
        id: o.id,
        items: [{ kind: 'medkit', qty: 2 }],
        total: 50,
        dueAt: o.dueAt,
        slot: null,
      },
    ]);
    expect(loaded.boxes).toEqual([]);
    const id = loaded.nextLaunch(T0 + DRONE.waitMs)!.id;
    loaded.launch(id);
    loaded.deliver(id);
    expect(loaded.boxes).toHaveLength(1);
    expect(loaded.orders).toEqual([]);
    // Un pedido nuevo no reutiliza el número.
    expect(loaded.place([{ kind: 'torch', qty: 1 }], 2, T0).id).toBe(o.id + 1);
  });

  it('restaura descartando datos dañados, ids y puntos repetidos', () => {
    const d = new DroneOrders();
    d.restore({
      nextId: 2,
      orders: [
        { id: 3, items: [{ kind: 'torch', qty: 1 }], total: 2, dueAt: T0 },
        { id: 3, items: [{ kind: 'torch', qty: 1 }], total: 2, dueAt: T0 },
        { id: 4, items: [{ kind: 'bogus', qty: 1 }], total: 2, dueAt: T0 },
        { id: 5, items: [{ kind: 'torch', qty: 0 }], total: 2, dueAt: T0 },
      ],
      boxes: [
        { id: 6, slot: 1, items: [{ kind: 'cola', qty: 2 }], opened: true },
        { id: 7, slot: 1, items: [{ kind: 'cola', qty: 2 }] },
        { id: 8, slot: 99, items: [{ kind: 'cola', qty: 2 }] },
      ],
    });
    expect(d.orders.map((o) => o.id)).toEqual([3]);
    expect(d.boxes.map((b) => b.id)).toEqual([6]);
    expect(d.nextId).toBe(7);
    d.restore(undefined);
    expect(d.orders).toEqual([]);
    expect(d.boxes).toEqual([]);
  });

  it('cancel deshace un pedido que aún no vuela', () => {
    const d = new DroneOrders();
    const o = d.place([{ kind: 'torch', qty: 1 }], 2, T0);
    d.cancel(o.id);
    expect(d.orders).toEqual([]);
  });
});
