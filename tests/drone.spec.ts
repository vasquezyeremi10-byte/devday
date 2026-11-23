import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import { SUPPLIES } from '../src/game/config/balance';
import { DRONE, DRONE_FLIGHT_MS } from '../src/game/config/drones';

/**
 * Pedidos por dron: pagar en el celular, 20 s reales, vuelo visible
 * (aproximación, descenso, entrega y retirada), caja con E, inventario
 * lleno, cola de pedidos y guardar/cargar durante una entrega.
 */
declare global {
  interface Window {
    __MINA_GAME__: Phaser.Game;
  }
}

const scene = <T, A = undefined>(
  page: Page,
  fn: (s: MiningScene, arg: A) => T,
  arg?: A,
) =>
  page.evaluate(
    ({ source, arg }) => {
      const s = window.__MINA_GAME__.scene.getScene('MiningScene');
      return new Function('s', 'arg', `return (${source})(s, arg);`)(s, arg);
    },
    { source: fn.toString(), arg },
  ) as Promise<T>;

const tap = async (page: Page, key: string, times = 1) => {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(60);
  }
};

const state = (page: Page) =>
  scene(page, (s) => ({
    money: s.session.money,
    orders: s.session.drones.orders.map((o) => ({
      id: o.id,
      dueAt: o.dueAt,
      slot: o.slot,
    })),
    boxes: s.session.drones.boxes.map((b) => ({
      id: b.id,
      slot: b.slot,
      items: b.items,
      landing: b.landing,
    })),
    flight: s.droneView.flight,
    torch: s.session.supplies.torch,
    cola: s.session.supplies.cola,
    medkit: s.session.supplies.medkit,
    completo: s.session.supplies.completo,
    toast: s.phone.toast?.lines ?? [],
  }));

/** Llega a la cabaña y espera el suelo. */
async function goToCamp(page: Page, x = -360) {
  await scene(page, (s, x) => s.miner.body.reset(x, 148), x);
  await expect
    .poll(() => scene(page, (s) => s.miner.body.blocked.down))
    .toBe(true);
}

/** Pedido por la interfaz: U, categorías, cantidades, carrito y confirmar. */
async function orderTorchesAndCola(page: Page) {
  await tap(page, 'u');
  await expect.poll(() => scene(page, (s) => s.phone.open)).toBe(true);
  await page.waitForTimeout(250);
  await tap(page, 'ArrowRight', 3); // ILUMINACION: antorcha
  await tap(page, 'NumpadAdd', 2);
  await tap(page, 'Enter');
  await tap(page, 'ArrowLeft', 4); // ALIMENTOS Y BEBIDAS: bebida cola
  await tap(page, 'NumpadAdd');
  await tap(page, 'Enter');
  await tap(page, 'c');
  await tap(page, 'Enter');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await expect
    .poll(() => scene(page, (s) => s.miner.body.blocked.down))
    .toBe(true);
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
  await scene(page, (s) => {
    s.session.money = 200;
  });
});

test('un pedido de varios productos: pago, 20 s reales, vuelo, caja y E', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await goToCamp(page);
  const before = await state(page);
  await orderTorchesAndCola(page);
  const total = 3 * SUPPLIES.torch.price + 2 * SUPPLIES.cola.price;
  let st = await state(page);
  expect(st.toast[0]).toBe(`PEDIDO PAGADO: $${total}.`);
  expect(st.money).toBe(before.money - total);
  expect(st.orders).toHaveLength(1);
  expect(st.torch).toBe(before.torch); // nada se entrega al pagar
  const placedAt = st.orders[0]!.dueAt - DRONE.waitMs;
  // El pago quedó guardado junto con el pedido.
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('mina-cero.save.v6')!),
  );
  expect(saved.drones.orders).toHaveLength(1);
  expect(saved.money).toBe(st.money);
  await tap(page, 'u');
  // Cuenta regresiva en el HUD.
  await expect
    .poll(() => scene(page, (s) => s.droneView['plateText'].text as string))
    .toMatch(/^PEDIDO \d+ EN 0:\d\d/);
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('dron-cuenta-regresiva.png') });
  // Despega a los 20 s reales (medido con el reloj de la página).
  await expect
    .poll(async () => (await state(page)).flight, {
      timeout: 25_000,
      intervals: [50],
    })
    .not.toBeNull();
  st = await state(page);
  const waited = st.flight!.launchedWall - placedAt;
  expect(waited).toBeGreaterThanOrEqual(DRONE.waitMs);
  expect(waited).toBeLessThan(DRONE.waitMs + 400);
  await testInfo.attach('espera-real-ms', {
    body: String(waited),
    contentType: 'text/plain',
  });

  // Animación: muestras de posición, cuadros de las hélices y fases.
  const samples: {
    y: number;
    x: number;
    frame: string;
    carried: boolean;
    visible: boolean;
  }[] = [];
  let shot = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < DRONE_FLIGHT_MS + 800) {
    const p = await scene(page, (s) => {
      const d = s.droneView['drone'] as Phaser.GameObjects.Sprite;
      return {
        x: d.x,
        y: d.y,
        frame: String(d.frame.name),
        carried: (s.droneView['carried'] as Phaser.GameObjects.Image).visible,
        visible: d.visible,
      };
    });
    samples.push(p);
    const elapsed = Date.now() - t0;
    if (shot === 0 && elapsed > DRONE.flight.approachMs - 600) {
      shot++;
      await page
        .locator('canvas')
        .screenshot({ path: testInfo.outputPath('dron-llegando.png') });
    } else if (
      shot === 1 &&
      elapsed > DRONE.flight.approachMs + DRONE.flight.descendMs - 300
    ) {
      shot++;
      await page
        .locator('canvas')
        .screenshot({ path: testInfo.outputPath('dron-entrega.png') });
    }
    await page.waitForTimeout(60);
  }
  const flying = samples.filter((p) => p.visible);
  expect(new Set(flying.map((p) => p.frame)).size).toBeGreaterThanOrEqual(3);
  const lowest = Math.max(...flying.map((p) => p.y));
  const landIndex = flying.findIndex((p) => p.y === lowest);
  expect(flying[0]!.y).toBeLessThan(lowest - 50); // llega alto
  expect(flying[0]!.x).toBeLessThan(flying[landIndex]!.x - 100); // desde la izquierda
  expect(flying.slice(0, landIndex).every((p) => p.carried)).toBe(true);
  expect(flying.at(-1)!.carried).toBe(false); // se va sin la caja
  expect(flying.at(-1)!.y).toBeLessThan(lowest - 20); // y sube al irse
  expect(samples.at(-1)!.visible).toBe(false); // terminó el vuelo
  st = await state(page);
  expect(st.flight).toBeNull();
  expect(st.orders).toEqual([]);
  expect(st.boxes).toHaveLength(1);
  const slotX = st.boxes[0]!.landing?.x ?? DRONE.slots[st.boxes[0]!.slot]!;

  // Recoger con E.
  await goToCamp(page, slotX + 12);
  await expect
    .poll(() => scene(page, (s) => s.interactions.selected?.id))
    .toBe(`drone-box-${st.boxes[0]!.id}`);
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('dron-caja.png') });
  await tap(page, 'e');
  st = await state(page);
  expect(await scene(page, (s) => s.droneBox.open)).toBe(true);
  expect(st.torch).toBe(before.torch);
  await tap(page, 'ArrowRight', 2);
  await tap(page, 'Enter');
  await tap(page, 'ArrowRight');
  await tap(page, 'Enter');
  st = await state(page);
  expect(st.torch).toBe(before.torch + 3);
  expect(st.cola).toBe(before.cola + 2);
  expect(st.boxes).toEqual([]);
});

test('inventario lleno: lo que no cabe queda en la caja hasta liberar espacio', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await goToCamp(page);
  // Pedido de varios productos con la espera ya cumplida (los 20 s se miden aparte).
  await scene(page, (s) => {
    const o = s.session.drones.place(
      [
        { kind: 'medkit', qty: 2 },
        { kind: 'completo', qty: 1 },
      ],
      60,
      Date.now() - 20_000,
    );
    s.session.money -= 60;
    // Llenar las casillas libres con suministros distintos.
    const kinds = [
      'rail',
      'wood_beam',
      'battery',
      'dynamite',
      'fuse',
      'duct',
      'lamp',
      'empanada',
    ];
    for (const k of kinds) {
      if (s.session.loadout.free() <= 0) break;
      s.session.supplies[k as 'rail'] = 1;
      s.session.loadout.sync();
    }
    while (s.session.loadout.free() > 0) s.session.tools.add('shovel');
    return o.id;
  });
  expect(await scene(page, (s) => s.session.loadout.free())).toBe(0);
  await expect
    .poll(async () => (await state(page)).boxes.length, {
      timeout: DRONE_FLIGHT_MS + 3000,
    })
    .toBe(1);
  const box = (await state(page)).boxes[0]!;
  await goToCamp(page, DRONE.slots[box.slot]! + 12);
  await expect
    .poll(() => scene(page, (s) => s.interactions.selected?.id))
    .toBe(`drone-box-${box.id}`);
  await tap(page, 'e');
  let st = await state(page);
  expect(await scene(page, (s) => s.droneBox.open)).toBe(true);
  expect(st.medkit).toBe(0);
  expect(st.boxes[0]!.items).toEqual([
    { kind: 'medkit', qty: 2 },
    { kind: 'completo', qty: 1 },
  ]);
  await tap(page, 'Enter');
  expect(await scene(page, (s) => s.droneBox['message'])).toContain(
    'INVENTARIO LLENO',
  );
  await tap(page, 'Escape');
  // La bodega no ve productos pendientes; depositar una unidad real libera espacio.
  await goToCamp(page, -130);
  await scene(page, (s) => s.warehouse.show(s.session));
  expect(
    await scene(page, (s) =>
      s.session.warehouse
        .carried(s.session)
        .some((x) => x.kind === 'medkit' || x.kind === 'completo'),
    ),
  ).toBe(false);
  await scene(page, (s) =>
    s.session.warehouse.deposit(
      s.session,
      { type: 'supply', kind: 'rail', count: 1 },
      1,
    ),
  );
  await scene(page, (s) => s.warehouse.close());
  await goToCamp(page, DRONE.slots[box.slot]! + 12);
  await tap(page, 'e');
  await tap(page, 'ArrowRight');
  await tap(page, 'Enter');
  st = await state(page);
  expect(st.medkit).toBe(2);
  expect(st.boxes[0]!.items).toEqual([{ kind: 'completo', qty: 1 }]);
  await scene(page, (s) => {
    s.session.warehouse.deposit(
      s.session,
      { type: 'supply', kind: 'wood_beam', count: 1 },
      1,
    );
  });
  await tap(page, 'Enter');
  st = await state(page);
  expect(st.completo).toBe(1);
  expect(st.boxes).toEqual([]);
});

test('el dron entrega donde se confirmó el pedido aunque el minero se aleje', async ({
  page,
}) => {
  test.setTimeout(70_000);
  await goToCamp(page, -500);
  await orderTorchesAndCola(page);
  const destination = await scene(
    page,
    (s) => s.session.drones.orders[0]!.destination,
  );
  expect(destination).toEqual({ scene: 'MiningScene', x: -500, y: 160 });
  await tap(page, 'u');
  await goToCamp(page, -650);
  await expect
    .poll(async () => (await state(page)).boxes.length, {
      timeout: DRONE.waitMs + DRONE_FLIGHT_MS + 5000,
    })
    .toBe(1);
  const box = (await state(page)).boxes[0]!;
  expect(box.landing).toEqual(destination);
  expect(box.landing!.x).not.toBe(-650);
  await page.keyboard.press('g');
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  const loaded = (await state(page)).boxes[0]!;
  expect(loaded.landing).toEqual(destination);
  expect(loaded.items).toEqual(box.items);
});

test('retirar una unidad de una pila y recargar conserva exactamente el resto', async ({
  page,
}) => {
  test.setTimeout(55_000);
  await goToCamp(page, -500);
  const before = await state(page);
  await scene(page, (s) => {
    s.session.drones.place([{ kind: 'torch', qty: 3 }], 6, Date.now() - 20_000);
  });
  await expect
    .poll(async () => (await state(page)).boxes.length, {
      timeout: DRONE_FLIGHT_MS + 4000,
    })
    .toBe(1);
  const box = (await state(page)).boxes[0]!;
  await goToCamp(page, DRONE.slots[box.slot]! + 12);
  await expect
    .poll(() => scene(page, (s) => s.interactions.selected?.id))
    .toBe(`drone-box-${box.id}`);
  await tap(page, 'e');
  await tap(page, 'Enter');
  let current = await state(page);
  expect(current.torch).toBe(before.torch + 1);
  expect(current.boxes[0]!.items).toEqual([{ kind: 'torch', qty: 2 }]);
  await tap(page, 'Escape');
  await tap(page, 'g');
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  current = await state(page);
  expect(current.torch).toBe(before.torch + 1);
  expect(current.boxes).toHaveLength(1);
  expect(current.boxes[0]!.items).toEqual([{ kind: 'torch', qty: 2 }]);
});

test('cola: dos pedidos seguidos salen de a uno y dejan dos cajas', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await goToCamp(page);
  await scene(page, (s) => {
    const past = Date.now() - 20_000;
    s.session.drones.place([{ kind: 'torch', qty: 1 }], 2, past);
    s.session.drones.place([{ kind: 'fuse', qty: 1 }], 3, past);
  });
  await expect.poll(async () => (await state(page)).flight?.orderId).toBe(1);
  // El segundo espera en tierra mientras vuela el primero.
  expect(
    (await state(page)).orders.filter((o) => o.slot !== null),
  ).toHaveLength(1);
  await expect
    .poll(async () => (await state(page)).boxes.length, {
      timeout: 2 * DRONE_FLIGHT_MS + 4000,
    })
    .toBe(2);
  const st = await state(page);
  expect(new Set(st.boxes.map((b) => b.slot)).size).toBe(2);
  expect(st.orders).toEqual([]);
  // Tercer pedido permitido; cuarto con la cola llena se rechaza en el celular sin cobrar.
  await scene(page, (s) => {
    for (let i = 0; i < 3; i++)
      s.session.drones.place([{ kind: 'torch', qty: 1 }], 2, Date.now());
  });
  const money = (await state(page)).money;
  await tap(page, 'u');
  await expect.poll(() => scene(page, (s) => s.phone.open)).toBe(true);
  await page.waitForTimeout(250);
  await tap(page, 'ArrowRight', 3);
  await tap(page, 'Enter');
  await tap(page, 'c');
  await tap(page, 'Enter');
  const after = await state(page);
  expect(after.toast[0]).toBe(`COLA LLENA: ${DRONE.maxPending} PEDIDOS`);
  expect(after.money).toBe(money);
});

test('guardar y cargar durante la cuenta regresiva y en pleno vuelo', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await goToCamp(page);
  await orderTorchesAndCola(page);
  await tap(page, 'u');
  const paid = await state(page);
  const dueAt = paid.orders[0]!.dueAt;
  // A mitad de la espera: recargar conserva el pedido, el cobro y la hora.
  await page.waitForTimeout(6000);
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  let st = await state(page);
  expect(st.money).toBe(paid.money);
  expect(st.orders).toEqual([{ id: paid.orders[0]!.id, dueAt, slot: null }]);
  await goToCamp(page);
  // Esperar el despegue y guardar en pleno vuelo, antes de soltar la caja.
  await expect
    .poll(async () => (await state(page)).flight, { timeout: 25_000 })
    .not.toBeNull();
  expect((await state(page)).flight!.launchedWall).toBeGreaterThanOrEqual(
    dueAt,
  );
  await page.waitForTimeout(1500);
  await page.keyboard.press('g');
  // Lo guardado en pleno vuelo es el pedido pagado (sin caja todavía).
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = JSON.parse(localStorage.getItem('mina-cero.save.v6')!);
        return [raw.drones.orders.length, raw.drones.boxes.length, raw.money];
      }),
    )
    .toEqual([1, 0, paid.money]);
  expect((await state(page)).boxes).toEqual([]);
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  st = await state(page);
  expect(st.money).toBe(paid.money);
  // Pedido o caja, nunca ambos: la carga puede tardar más que el vuelo.
  expect(st.orders.length + st.boxes.length).toBe(1);
  // Vuelve a despegar enseguida (ya venció) y entrega una sola caja.
  await expect
    .poll(async () => (await state(page)).boxes.length, {
      timeout: DRONE_FLIGHT_MS + 4000,
    })
    .toBe(1);
  await page.waitForTimeout(DRONE.flight.leaveMs + 500);
  st = await state(page);
  expect(st.orders).toEqual([]);
  expect(st.boxes).toHaveLength(1);
  expect(st.boxes[0]!.items).toEqual([
    { kind: 'torch', qty: 3 },
    { kind: 'cola', qty: 2 },
  ]);
  expect(st.money).toBe(paid.money);
  // Recargar con la caja en el suelo no la duplica.
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  expect((await state(page)).boxes).toHaveLength(1);
});
