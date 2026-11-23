import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import type { TopDownCabinScene } from '../src/game/scenes/TopDownCabinScene';
import type { TopDownScene } from '../src/game/scenes/TopDownScene';
import { CABIN_FRIDGE } from '../src/game/config/topDownCabin';
import { FRIDGE } from '../src/game/config/survival';
import { STACK_MAX } from '../src/game/config/buildMaterials';
import { CYCLE_MS } from '../src/game/systems/DayNightCycle';
import { GameSession } from '../src/game/systems/GameSession';
import { encodeSave, SAVE_KEY } from '../src/game/systems/SaveSystem';
import { createInitialTerrain } from '../src/game/world/Geology';

/**
 * Refrigerador de la cabaña (10 casillas, tipo cofre) y caducidad de
 * alimentos: tres días COMPLETOS del juego (ciclo día + noche), tiempo
 * detenido dentro, vencidos que no se consumen, pilas con varias fechas,
 * traslado con la interfaz y persistencia entre partidas.
 */
declare global {
  interface Window {
    __MINA_GAME__: Phaser.Game;
  }
}

const DAY = CYCLE_MS;
/** El reloj real sigue corriendo entre pasos: se compara con tolerancia (lo exacto vive en las unitarias). */
const near = (actual: number, expected: number, tol = 8000) =>
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
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

/** Avanza el reloj del juego (el mismo `tick` que usa la escena, cuadros de 1 s). */
const advance = (page: Page, ms: number) =>
  scene(
    page,
    (s, ms) => {
      for (let left = ms; left > 0; left -= 1000)
        s.session.dayNight.tick(Math.min(1000, left));
    },
    ms,
  );

/** Clic en coordenadas nativas del juego (480 × 270). */
async function click(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(
    box.x + ((x + 0.5) * box.width) / 480,
    box.y + ((y + 0.5) * box.height) / 270,
  );
  await page.waitForTimeout(90);
}
/** Casillas del panel (ver ui/FridgePanel.ts): inventario a la izquierda, refrigerador a la derecha. */
const carriedSlot = (i: number) => [32 + (i % 4) * 25 + 11, 94 + Math.floor(i / 4) * 26 + 11] as const;
const fridgeSlot = (i: number) => [160 + (i % 5) * 25 + 11, 94 + Math.floor(i / 5) * 26 + 11] as const;
const BUTTON = {
  plus: [108, 197],
  all: [178, 197],
  move: [246, 197],
  discard: [414, 225],
} as const;
const press = (page: Page, [x, y]: readonly [number, number]) => click(page, x, y);

const state = (page: Page) =>
  scene(page, (s) => ({
    open: s.fridge.open,
    used: s.session.fridge.used,
    units: s.session.fridge.units,
    slots: s.session.fridge.slots.map((x) => ({ kind: x.kind, count: x.count, lots: x.lots })),
    food: s.session.food.snapshot(),
    now: s.session.dayNight.totalMs,
    supplies: { ...s.session.supplies },
  }));

/** Entra a la cabaña y camina con A/D hasta el refrigerador. */
async function walkToFridge(page: Page) {
  await scene(page, (s) => s.enterCabin(true));
  await page.keyboard.down('d');
  await expect
    .poll(() => scene(page, (s) => s.cabin.prompt), { timeout: 10_000, intervals: [30] })
    .toBe('[E] ABRIR EL REFRIGERADOR');
  await page.keyboard.up('d');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await expect.poll(() => scene(page, (s) => s.miner.body.blocked.down)).toBe(true);
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
  await scene(page, (s) => {
    s.session.money = 500;
  });
});

test('abrir con E, guardar, conservar sin que corra el tiempo, vencer y retirar', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  // Una pila de sándwiches con DOS fechas (la mitad compró hace un día), cola y empanadas.
  await scene(page, (s) => {
    s.session.addSupply('sandwich', 2);
    s.session.addSupply('cola', 3);
  });
  await advance(page, DAY);
  await scene(page, (s) => {
    s.session.addSupply('sandwich', 3);
    s.session.addSupply('empanada', 2);
  });
  const lots0 = (await state(page)).food.sandwich!;
  expect(lots0.map((l) => l.qty)).toEqual([2, 3]);
  near(lots0[1]!.t - lots0[0]!.t, DAY); // dos fechas, un día de diferencia

  await walkToFridge(page);
  await page.keyboard.press('e');
  await expect.poll(() => scene(page, (s) => s.fridge.open)).toBe(true);
  await page.locator('canvas').screenshot({ path: testInfo.outputPath('refrigerador-abierto.png') });

  // Inventario del panel: cola (0), sándwich (1), empanada (2). Guardar todos los sándwiches.
  await press(page, carriedSlot(1));
  await press(page, BUTTON.all);
  await press(page, BUTTON.move);
  let st = await state(page);
  expect(st.slots).toHaveLength(1);
  expect(st.slots[0]).toMatchObject({ kind: 'sandwich', count: 5 });
  // Dentro guarda el TIEMPO RESTANTE de cada fecha: 2 y 3 días.
  expect(st.slots[0]!.lots.map((l) => l.qty)).toEqual([2, 3]);
  near(st.slots[0]!.lots[0]!.t, 2 * DAY);
  near(st.slots[0]!.lots[1]!.t, 3 * DAY);
  expect(st.supplies.sandwich).toBe(0);
  // Tres colas con el botón «+» (1 → 3).
  await press(page, carriedSlot(0));
  await press(page, BUTTON.plus);
  await press(page, BUTTON.plus);
  await press(page, BUTTON.move);
  st = await state(page);
  expect(st.slots.map((x) => [x.kind, x.count])).toEqual([
    ['sandwich', 5],
    ['cola', 3],
  ]);
  await page.locator('canvas').screenshot({ path: testInfo.outputPath('refrigerador-con-comida.png') });
  // Con el panel abierto el reloj del juego no corre (ventana modal).
  const frozenAt = (await state(page)).now;
  await page.waitForTimeout(1200);
  expect((await state(page)).now).toBe(frozenAt);

  await page.keyboard.press('Escape');
  await expect.poll(() => scene(page, (s) => s.fridge.open)).toBe(false);
  // El juego sigue respondiendo: la figura camina.
  const x0 = await scene(page, (s) => s.cabin.puppetX);
  await page.keyboard.down('a');
  await page.waitForTimeout(250);
  await page.keyboard.up('a');
  expect(await scene(page, (s) => s.cabin.puppetX)).toBeLessThan(x0);

  // Pasan cuatro días del juego: afuera vence todo, adentro nada cambia.
  const before = await state(page);
  await advance(page, 4 * DAY);
  st = await state(page);
  expect(st.slots).toEqual(before.slots);
  const spoiled = await scene(page, (s) => s.consumeFood('empanada'));
  expect(spoiled).toMatch(/^VENCIDO/);
  expect((await state(page)).supplies.empanada).toBe(2);

  // Retirar: el tiempo restante continúa, no se reinicia.
  await scene(page, (s) => {
    s.cabin['x'] = 158;
  });
  await page.keyboard.press('e');
  await expect.poll(() => scene(page, (s) => s.fridge.open)).toBe(true);
  await press(page, fridgeSlot(0)); // sándwiches
  await press(page, BUTTON.all);
  await press(page, [246, 197]);
  st = await state(page);
  expect(st.supplies.sandwich).toBe(5);
  expect(st.food.sandwich!.map((l) => l.qty)).toEqual([2, 3]);
  near(st.food.sandwich![0]!.t - st.now, 2 * DAY);
  near(st.food.sandwich![1]!.t - st.now, 3 * DAY);
  expect(st.slots.map((x) => x.kind)).toEqual(['cola']);

  // Tirar lo vencido de lo que se lleva (las empanadas) desde el panel.
  await press(page, BUTTON.discard);
  st = await state(page);
  expect(st.supplies.empanada).toBe(0);
  await page.locator('canvas').screenshot({ path: testInfo.outputPath('refrigerador-retirado.png') });

  // Persiste: el guardado trae refrigerador, lotes y el reloj acumulado.
  const raw = await page.evaluate(() => JSON.parse(localStorage.getItem('mina-cero.save.v6')!));
  expect(raw.fridge.slots).toHaveLength(1);
  near(raw.dayNightTotalMs, st.now);
  expect(raw.food.sandwich).toHaveLength(2);
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', { timeout: 30_000 });
  const after = await state(page);
  expect(after.slots).toEqual(st.slots);
  expect(after.food).toEqual(st.food);
  near(after.now, st.now, 60_000);
  // Tras recargar sigue detenido adentro y corriendo afuera.
  await advance(page, DAY);
  const later = await state(page);
  expect(later.slots).toEqual(st.slots);
  near(later.food.sandwich![0]!.t - later.now, st.food.sandwich![0]!.t - st.now - DAY, 60_000);
});

test('10 casillas con el límite de apilado y refrigerador lleno', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  expect(FRIDGE.slots).toBe(10);
  await scene(page, (s) => {
    s.session.supplies.cola = 9990; // 10 pilas de 999
    s.session.addSupply('sandwich', 5);
  });
  await walkToFridge(page);
  await page.keyboard.press('e');
  await expect.poll(() => scene(page, (s) => s.fridge.open)).toBe(true);
  await press(page, carriedSlot(0)); // cola
  await press(page, BUTTON.all);
  await press(page, BUTTON.move);
  let st = await state(page);
  expect(st.used).toBe(10);
  expect(st.slots.every((x) => x.kind === 'cola' && x.count === STACK_MAX)).toBe(true);
  expect(st.supplies.cola).toBe(0);
  await page.locator('canvas').screenshot({ path: testInfo.outputPath('refrigerador-lleno.png') });
  // Lleno: no entra nada más y no se cobra ni se pierde.
  await press(page, carriedSlot(0)); // ahora el sándwich es el primero
  await press(page, BUTTON.move);
  expect(await scene(page, (s) => s.fridge['message'] as string)).toBe('REFRIGERADOR LLENO');
  st = await state(page);
  expect(st.supplies.sandwich).toBe(5);
  expect(st.units).toBe(10 * STACK_MAX);
  // Sacar una cola no libera una casilla (la pila sigue con 998): sigue lleno.
  await press(page, fridgeSlot(9));
  await press(page, BUTTON.move);
  st = await state(page);
  expect(st.slots[9]!.count).toBe(STACK_MAX - 1);
  await press(page, carriedSlot(0));
  await press(page, BUTTON.move);
  expect((await state(page)).supplies.sandwich).toBe(5);
});

test('cabaña cenital: abrir con Z y sacar; con el panel abierto el reloj no corre', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const session = new GameSession(createInitialTerrain());
  session.modeChosen = true;
  session.money = 100;
  session.addSupply('cola', 4);
  for (let i = 0; i < 600; i++) session.dayNight.tick(1000); // un día afuera
  session.fridge.deposit(session, 'cola', 4);
  // El guardado de pagehide de la vista lateral termina antes de cargar esta partida.
  await page.addInitScript(
    ({ key, save }) => {
      if (new URLSearchParams(location.search).get('view') === 'top-down')
        localStorage.setItem(key, save);
    },
    { key: SAVE_KEY, save: encodeSave(session, { x: 208, y: 148 }) },
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?view=top-down');
  await expect(page.locator('#game-status')).toContainText('CAMPAMENTO');
  await page.evaluate(() => {
    const top = window.__MINA_GAME__.scene.getScene('TopDownScene') as TopDownScene;
    top.miner.body.reset(304, 289);
  });
  await expect(page.locator('#game-status')).toHaveText('[Z] ENTRAR A LA CABAÑA');
  await page.keyboard.press('z');
  await expect(page.locator('#game-status')).toHaveText('[Z] SALIR');
  const cabin = () =>
    page.evaluate(() => {
      const c = window.__MINA_GAME__.scene.getScene('TopDownCabinScene') as TopDownCabinScene;
      const s = c.visit.session;
      return {
        open: c.fridge.open,
        used: s.fridge.used,
        cola: s.supplies.cola,
        total: s.dayNight.totalMs,
        slot: s.fridge.slots[0] ? { ...s.fridge.slots[0] } : null,
      };
    });
  await page.evaluate((p) => {
    const c = window.__MINA_GAME__.scene.getScene('TopDownCabinScene') as TopDownCabinScene;
    c.miner.body.reset(p.x, p.y);
  }, CABIN_FRIDGE);
  await expect(page.locator('#game-status')).toHaveText('[Z] ABRIR REFRIGERADOR');
  await page.keyboard.press('z');
  await expect.poll(async () => (await cabin()).open).toBe(true);
  await page.locator('canvas').screenshot({ path: testInfo.outputPath('refrigerador-cenital.png') });
  const first = await cabin();
  expect(first.slot).toMatchObject({ kind: 'cola', count: 4 });
  await page.waitForTimeout(1200);
  expect((await cabin()).total).toBe(first.total); // reloj detenido con la ventana abierta
  await press(page, fridgeSlot(0));
  await press(page, BUTTON.all);
  await press(page, BUTTON.move);
  const out = await cabin();
  expect(out).toMatchObject({ used: 0, cola: 4 });
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await cabin()).open).toBe(false);
  expect(errors).toEqual([]);
});

test('el ciclo día/noche conserva su velocidad real', async ({ page }) => {
  const a = await state(page);
  const t0 = Date.now();
  await page.waitForTimeout(3000);
  const b = await state(page);
  const real = Date.now() - t0;
  const game = b.now - a.now;
  expect(game).toBeGreaterThan(real * 0.7);
  expect(game).toBeLessThan(real * 1.3);
});
