import { expect, test, type Page } from '@playwright/test';
import { CABIN_BEDSIDE, CABIN_DOOR } from '../src/game/config/topDownCabin';
import { DAY_MS } from '../src/game/systems/DayNightCycle';
import { GameSession } from '../src/game/systems/GameSession';
import { encodeSave, SAVE_KEY } from '../src/game/systems/SaveSystem';
import type { TopDownCabinScene } from '../src/game/scenes/TopDownCabinScene';
import type { TopDownScene } from '../src/game/scenes/TopDownScene';
import { createInitialTerrain } from '../src/game/world/Geology';

const status = (page: Page) => page.locator('#game-status');
const inspect = (page: Page) =>
  page.evaluate(() => {
    const s = window.__MINA_GAME__?.scene.getScene(
      'TopDownCabinScene',
    ) as TopDownCabinScene;
    if (!s?.scene?.isActive() || !s.miner) return null;
    const session = s.visit.session;
    return {
      x: s.miner.x,
      y: s.miner.y,
      bodyLeft: s.miner.body.left,
      visible: s.miner.visible,
      time: session.dayNight.elapsedMs,
      day: session.dayNight.isDay,
      energy: session.survival.energyUnits,
      hunger: session.survival.hunger,
      hp: session.health.hp,
      sleeps: session.survival.sleeps,
      tools: session.tools.items.length,
      money: session.money,
    };
  });

const moveCabin = (page: Page, p: { x: number; y: number }) =>
  page.evaluate(({ x, y }) => {
    const cabin = window.__MINA_GAME__.scene.getScene(
      'TopDownCabinScene',
    ) as TopDownCabinScene;
    cabin.miner.body.reset(x, y);
  }, p);

test('cabaña cenital: caminar, dormir en ambas fases, recargar y salir', async ({
  page,
}) => {
  test.setTimeout(45_000);
  const session = new GameSession(createInitialTerrain());
  session.modeChosen = true;
  session.survival.energy = 22;
  session.survival.hunger = 70;
  session.health.hp = 63;
  session.money = 132;
  session.tools.add('iron');
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, save);
    },
    { key: SAVE_KEY, save: encodeSave(session, { x: 208, y: 148 }) },
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?view=top-down');
  await expect(status(page)).toContainText('CAMPAMENTO');
  await page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene(
      'TopDownScene',
    ) as TopDownScene;
    scene.miner.body.reset(304, 289);
  });
  await expect(status(page)).toHaveText('[Z] ENTRAR A LA CABAÑA');
  await page.keyboard.press('z');
  await expect(status(page)).toHaveText('[Z] SALIR');
  expect(await inspect(page)).toMatchObject({
    ...CABIN_DOOR,
    day: true,
    hp: 63,
    money: 132,
    tools: 1,
  });
  await page.keyboard.down('w');
  await expect.poll(async () => (await inspect(page))?.y).toBeLessThan(188);
  await page.keyboard.up('w');
  await moveCabin(page, CABIN_BEDSIDE);
  await expect(status(page)).toHaveText('[Z] DORMIR');
  await page.keyboard.down('a');
  await expect
    .poll(async () => (await inspect(page))?.bodyLeft)
    .toBeLessThanOrEqual(170);
  await page.waitForTimeout(150);
  expect((await inspect(page))!.bodyLeft).toBeGreaterThanOrEqual(169);
  await page.keyboard.up('a');
  await moveCabin(page, CABIN_BEDSIDE);

  const before = (await inspect(page))!;
  await page.keyboard.press('z');
  await expect(status(page)).toContainText('DESCANSANDO');
  await page.keyboard.press('z');
  await expect.poll(async () => (await inspect(page))?.visible).toBe(false);
  expect((await inspect(page))?.time).toBeLessThan(before.time + 120);
  await expect(status(page)).toContainText('ENERGÍA RESTAURADA');
  expect(await inspect(page)).toMatchObject({
    day: false,
    energy: 5,
    hp: 63,
    sleeps: 1,
  });
  const night = (await inspect(page))!;
  expect(night.time).toBeGreaterThanOrEqual(DAY_MS);
  expect(night.time).toBeLessThan(DAY_MS + 500);
  expect(night.hunger).toBeLessThan(before.hunger);

  await page.reload();
  await expect(status(page)).toHaveText('[Z] DORMIR');
  expect(await inspect(page)).toMatchObject({
    ...CABIN_BEDSIDE,
    day: false,
    energy: 5,
    hp: 63,
    sleeps: 1,
    money: 132,
    tools: 1,
  });
  await page.keyboard.press('z');
  await expect(status(page)).toContainText('ENERGÍA RESTAURADA');
  expect(await inspect(page)).toMatchObject({
    day: true,
    energy: 5,
    hp: 63,
    sleeps: 2,
  });
  expect((await inspect(page))!.time).toBeLessThan(500);
  await moveCabin(page, CABIN_DOOR);
  await expect(status(page)).toHaveText('[Z] SALIR');
  await page.keyboard.press('z');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const scene = window.__MINA_GAME__.scene.getScene(
          'TopDownScene',
        ) as TopDownScene;
        return scene.scene.isActive()
          ? { x: scene.miner.x, y: scene.miner.y }
          : null;
      }),
    )
    .toEqual({ x: 304, y: 290 });
  const raw = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    SAVE_KEY,
  );
  expect(raw.topDownCabin.inside).toBe(false);
  expect(raw.dayNightMs).toBeLessThan(3500);
  await page.reload();
  await expect(status(page)).toHaveText('[Z] ENTRAR A LA CABAÑA');
  const reloaded = await page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene(
      'TopDownScene',
    ) as TopDownScene;
    return { x: scene.miner.x, y: scene.miner.y };
  });
  expect(reloaded).toEqual({ x: 304, y: 290 });
  expect(errors).toEqual([]);
});

test('la primera visita sin partida usa la elección de modo existente', async ({
  page,
}) => {
  await page.goto('/?view=top-down');
  await expect(status(page)).toContainText('CAMPAMENTO');
  await page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene(
      'TopDownScene',
    ) as TopDownScene;
    scene.miner.body.reset(304, 289);
  });
  await expect(status(page)).toHaveText('[Z] ENTRAR A LA CABAÑA');
  await page.keyboard.press('z');
  await expect(status(page)).toContainText('Mina lista', { timeout: 20_000 });
  await page.keyboard.press('1', { delay: 75 });
  await expect(status(page)).toHaveText('[Z] SALIR');
  expect(await inspect(page)).toMatchObject({
    ...CABIN_DOOR,
    hp: 100,
    sleeps: 0,
  });
});
