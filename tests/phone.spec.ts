import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import { SUPPLIES } from '../src/game/config/balance';
import {
  PHONE_CATEGORIES,
  PHONE_LAYOUT,
} from '../src/game/config/phoneShop';

/**
 * Celular (U): abrir, navegar categorías, agregar y quitar productos,
 * cambiar cantidades, totales, saldo, confirmación sin drones (no cobra ni
 * entrega) y cierre sin bloquear el juego.
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

const phone = (page: Page) =>
  scene(page, (s) => ({
    open: s.phone.open,
    screen: s.phone.screen,
    category: s.phone.category,
    row: s.phone.row,
    qty: s.phone.qty,
    lines: s.phone.cart.lines.map((l) => [l.id, l.qty]),
    subtotal: s.phone.cart.subtotal,
    total: s.phone.cart.total,
    toast: s.phone.toast?.lines ?? [],
  }));

/** Una tecla y un respiro: el celular la procesa en el evento del navegador. */
const tap = async (page: Page, key: string, times = 1) => {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(60);
  }
};
/** Clic en coordenadas nativas del juego (480 × 270). */
async function click(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(
    box.x + ((x + 0.5) * box.width) / 480,
    box.y + ((y + 0.5) * box.height) / 270,
  );
  await page.waitForTimeout(80);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await expect
    .poll(() => scene(page, (s) => s.miner.body.blocked.down))
    .toBe(true);
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
});

test('U abre la tienda, se navega, se arma el carrito y U/Esc cierran sin bloquear', async ({
  page,
}, testInfo) => {
  const before = await scene(page, (s) => ({
    money: s.session.money,
    supplies: { ...s.session.supplies },
    tools: s.session.tools.items.length,
    x: s.miner.x,
  }));
  await tap(page, 'u');
  await expect.poll(async () => (await phone(page)).open).toBe(true);
  await page.waitForTimeout(250); // fin de la animación de entrada
  // Abierto, el minero no camina.
  await page.keyboard.down('d');
  await page.waitForTimeout(300);
  await page.keyboard.up('d');
  expect(await scene(page, (s) => s.miner.x)).toBeCloseTo(before.x, 0);
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('celular-tienda.png') });

  // Categorías con ← →, en orden y circulares.
  const labels: string[] = [];
  for (let i = 0; i < PHONE_CATEGORIES.length; i++) {
    labels.push(PHONE_CATEGORIES[(await phone(page)).category]!.label);
    await tap(page, 'ArrowRight');
  }
  expect(labels).toEqual(PHONE_CATEGORIES.map((c) => c.label));
  expect((await phone(page)).category).toBe(0);

  // ILUMINACION: 3 antorchas.
  await tap(page, 'ArrowRight', 3);
  expect((await phone(page)).row).toBe(0);
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('celular-iluminacion.png') });
  await tap(page, 'NumpadAdd', 3);
  await tap(page, 'NumpadSubtract');
  expect((await phone(page)).qty).toBe(3);
  await tap(page, 'Enter');
  let state = await phone(page);
  expect(state.lines).toEqual([['torch', 3]]);
  expect(state.toast[0]).toBe('AGREGADO AL CARRITO:');
  expect(state.qty).toBe(1);

  // ALIMENTOS Y BEBIDAS: bebida cola y completo (provisional) con el ratón.
  await tap(page, 'ArrowLeft', 4); // 3 → 6 (circular)
  expect((await phone(page)).category).toBe(6);
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('celular-alimentos.png') });
  const sc = { x: PHONE_LAYOUT.x + 6, y: PHONE_LAYOUT.y + 18, w: PHONE_LAYOUT.w - 12 };
  // Fila 0 (bebida cola): «+» y AGREGAR.
  await click(page, sc.x + 40, sc.y + 153 + 54);
  await click(page, sc.x + 100, sc.y + 153 + 54);
  // Fila 3 (completo): seleccionar con clic y agregar con Enter.
  await click(page, sc.x + 60, sc.y + 45 + 3 * 18 + 5);
  expect((await phone(page)).row).toBe(3);
  await tap(page, 'Enter');
  state = await phone(page);
  expect(state.lines).toEqual([
    ['torch', 3],
    ['cola', 2],
    ['completo', 1],
  ]);
  const subtotal =
    3 * SUPPLIES.torch.price + 2 * SUPPLIES.cola.price + SUPPLIES.completo.price;
  expect(state.subtotal).toBe(subtotal);
  expect(state.total).toBe(subtotal);

  // Carrito: C, cambiar cantidades y quitar.
  await tap(page, 'c');
  expect((await phone(page)).screen).toBe('cart');
  await tap(page, 'ArrowDown'); // cola
  await tap(page, 'NumpadAdd');
  expect((await phone(page)).lines[1]).toEqual(['cola', 3]);
  await tap(page, 'ArrowLeft', 2);
  expect((await phone(page)).lines[1]).toEqual(['cola', 1]);
  await tap(page, 'ArrowDown'); // completo
  await tap(page, 'Delete');
  state = await phone(page);
  expect(state.lines).toEqual([
    ['torch', 3],
    ['cola', 1],
  ]);
  expect(state.total).toBe(3 * SUPPLIES.torch.price + SUPPLIES.cola.price);
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('celular-carrito.png') });

  // Confirmar: se paga y el pedido espera al dron (los productos aún no llegan).
  const paidTotal = state.total;
  await tap(page, 'Enter');
  state = await phone(page);
  expect(state.toast).toEqual([`PEDIDO PAGADO: $${paidTotal}.`, 'LLEGA EN DRON EN 20 S.']);
  expect(state.lines).toEqual([]);
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('celular-pagado.png') });
  const after = await scene(page, (s) => ({
    money: s.session.money,
    supplies: { ...s.session.supplies },
    tools: s.session.tools.items.length,
    orders: s.session.drones.orders.map((o) => o.items),
  }));
  expect(after).toEqual({
    money: before.money - paidTotal,
    supplies: before.supplies,
    tools: before.tools,
    orders: [
      [
        { kind: 'torch', qty: 3 },
        { kind: 'cola', qty: 1 },
      ],
    ],
  });

  // U cierra; el juego vuelve a responder.
  await tap(page, 'u');
  expect((await phone(page)).open).toBe(false);
  const x0 = await scene(page, (s) => s.miner.x);
  await page.keyboard.down('d');
  await page.waitForTimeout(300);
  await page.keyboard.up('d');
  expect(await scene(page, (s) => s.miner.x)).toBeGreaterThan(x0 + 5);
  // Reabrir conserva el carrito; Esc también cierra.
  await tap(page, 'u');
  await expect
    .poll(() => scene(page, (s) => s.phone.open && !s.phone['sliding']))
    .toBe(true);
  await tap(page, 'Enter'); // un producto más en el carrito
  await tap(page, 'u');
  await tap(page, 'u');
  await expect.poll(async () => (await phone(page)).open).toBe(true);
  expect((await phone(page)).lines).toHaveLength(1);
  await tap(page, 'Escape');
  expect((await phone(page)).open).toBe(false);
});

test('impide pedidos sobre el saldo y productos de etapas bloqueadas', async ({
  page,
}) => {
  await tap(page, 'u');
  await expect.poll(async () => (await phone(page)).open).toBe(true);
  await page.waitForTimeout(250);
  // SALUD: 3 botiquines ($75) con $50 de saldo inicial.
  await tap(page, 'NumpadAdd', 2);
  await tap(page, 'Enter');
  expect((await phone(page)).toast).toContain('EL TOTAL SUPERA SALDO.');
  await tap(page, 'c');
  await tap(page, 'Enter');
  const money = await scene(page, (s) => s.session.money);
  const total = 3 * SUPPLIES.medkit.price;
  expect((await phone(page)).toast).toEqual([
    'SALDO INSUFICIENTE.',
    `FALTAN $${total - money}.`,
  ]);
  expect(await scene(page, (s) => s.session.money)).toBe(money);
  // HERRAMIENTAS: la picota de tungsteno exige la etapa 2 y no entra al carrito.
  await tap(page, 'c');
  await tap(page, 'ArrowRight');
  await tap(page, 'ArrowDown');
  await tap(page, 'Enter');
  const state = await phone(page);
  expect(state.toast).toEqual(['PICOTA DE TUNGSTENO', 'REQUIERE ETAPA 2.']);
  expect(state.lines).toEqual([['medkit', 3]]);
  // El catálogo de herramientas no ofrece picota de diamante.
  expect(PHONE_CATEGORIES[1]!.items).toEqual(['iron', 'tungsten', 'shovel', 'axe', 'drill']);
  await tap(page, 'u');
  expect((await phone(page)).open).toBe(false);
});
