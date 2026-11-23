import { expect, test, type Page } from '@playwright/test';
import { SPAWN } from '../src/game/config/constants';
import { CABIN_DOOR, CABIN_PORCH } from '../src/game/config/topDownCabin';
import { CAMP_MAP, CAMP_DOORS } from '../src/game/config/topDownCamp';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import type { GalleryScene } from '../src/game/scenes/GalleryScene';
import type { TopDownCabinScene } from '../src/game/scenes/TopDownCabinScene';
import type { TopDownScene } from '../src/game/scenes/TopDownScene';
import { GameSession } from '../src/game/systems/GameSession';
import { encodeSave, SAVE_KEY } from '../src/game/systems/SaveSystem';
import { createInitialTerrain } from '../src/game/world/Geology';
import { TopDownGallery } from '../src/game/world/TopDownGallery';

const mining = <T>(page: Page, fn: (s: MiningScene) => T) =>
  page.evaluate((source) => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene');
    return new Function('s', `return (${source})(s);`)(s) as T;
  }, fn.toString());

async function ready(page: Page) {
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
}

async function deathReady(page: Page, cause: string) {
  await expect(page.locator('#game-status')).toContainText(cause);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const scene = window.__MINA_GAME__.scene.getScene('DeathScene');
        return scene.scene.isActive() && !Reflect.get(scene, 'locked');
      }),
    )
    .toBe(true);
}

async function clickGame(page: Page, x: number, y: number, clickCount = 1) {
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(
    box.x + (box.width * x) / 480,
    box.y + (box.height * y) / 270,
    { clickCount },
  );
}

test('daño, hambre, dos reintentos y volver al menú conservan una pérdida por muerte', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await ready(page);
  await page.keyboard.press('1');
  await expect.poll(() => mining(page, (s) => s.session.modeChosen)).toBe(true);
  const listeners = await mining(page, (s) =>
    s.input.listenerCount('pointerdown'),
  );
  await mining(page, (s) => {
    s.miner.body.reset(174, 148);
    s.session.money = 100;
    s.session.inventory.items.push('coal');
    s.session.cart.inventory.items.push('iron');
    s.session.tools.add('iron');
    s.session.blasting.charges.push({
      column: 80,
      row: 12,
      endsAt: s.time.now + 30_000,
    });
  });
  await page.keyboard.press('x');
  await expect
    .poll(() => mining(page, (s) => s.hud.modes.dismantle))
    .toBe(true);
  await mining(page, (s) => s.session.health.damage(100, s.time.now, 'roca'));
  await deathReady(page, 'CAÍDA DE ROCAS');
  await page.setViewportSize({ width: 500, height: 650 });
  await page
    .locator('canvas')
    .screenshot({ path: info.outputPath('muerte-1x.png') });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page
    .locator('canvas')
    .screenshot({ path: info.outputPath('muerte-3x.png') });
  const sample = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const frame = (now: number) => {
          if (++frames === 60) resolve(now - start);
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
  );
  await info.attach('rendimiento-pantalla-muerte', {
    contentType: 'application/json',
    body: JSON.stringify({ frames: 60, ms: sample, fps: 60_000 / sample }),
  });
  const stopped = () =>
    mining(page, (s) => ({
      paused: s.scene.isPaused(),
      x: s.miner.x,
      time: s.session.stats.playMs,
      hp: s.session.health.hp,
      deaths: s.session.deaths,
      phone: s.phone.open,
    }));
  const before = await stopped();
  expect(before).toMatchObject({
    paused: true,
    x: 174,
    deaths: 1,
    phone: false,
  });
  await page.keyboard.down('d');
  await page.keyboard.press('u');
  await page.keyboard.press('r');
  await clickGame(page, 260, 129);
  await page.waitForTimeout(400);
  await page.keyboard.up('d');
  expect(await stopped()).toEqual(before);

  // La flecha y Tab seleccionan sin enviar las teclas al mundo.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await ready(page);
  expect(
    await mining(page, (s) => ({
      x: s.miner.x,
      money: s.session.money,
      deaths: s.session.deaths,
      cart: s.session.cart.inventory.items,
      items: s.session.inventory.items,
      dismantle: s.hud.modes.dismantle,
      hp: s.session.health.hp,
      listeners: s.input.listenerCount('pointerdown'),
    })),
  ).toEqual({
    x: SPAWN.x,
    money: 90,
    deaths: 1,
    cart: ['iron'],
    items: [],
    dismantle: false,
    hp: 100,
    listeners,
  });

  expect(
    await mining(
      page,
      (s) => s.session.blasting.charges[0]!.endsAt! - s.time.now,
    ),
  ).toBeGreaterThan(28_000);

  // El daño letal sale del reloj de supervivencia, no de una llamada a la pantalla.
  await mining(page, (s) => {
    s.session.health.hp = 0.1;
    s.session.survival.hunger = 0;
    s.session.survival.starvingMs = 60_000;
  });
  await deathReady(page, 'DESNUTRICIÓN');
  await clickGame(page, 150, 184);
  await ready(page);
  expect(
    await mining(page, (s) => [
      s.session.money,
      s.session.deaths,
      s.session.health.hp,
    ]),
  ).toEqual([81, 2, 100]);

  await mining(page, (s) => {
    s.session.health.hp = 0;
    s.session.health.lastSource = 'aire';
  });
  await deathReady(page, 'AIRE IRRESPIRABLE');
  // Hacer clic dos veces no relanza ni penaliza la muerte.
  await clickGame(page, 319, 184, 2);
  await expect(page.locator('#game-status')).toHaveText('Menú principal', {
    timeout: 20_000,
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const scene = window.__MINA_GAME__.scene.getScene('MenuScene');
        return scene.scene.isActive() && !Reflect.get(scene, 'busy');
      }),
    )
    .toBe(true);
  await page.keyboard.press('Enter');
  await ready(page);
  expect(
    await mining(page, (s) => [
      s.session.money,
      s.session.deaths,
      s.session.health.hp,
    ]),
  ).toEqual([73, 3, 100]);
  expect(errors).toEqual([]);
});

for (const owner of [
  'TopDownScene',
  'TopDownCabinScene',
  'GalleryScene',
] as const) {
  test(`${owner}: muerte por hambre y reaparición en el campamento`, async ({
    page,
  }) => {
    test.setTimeout(50_000);
    const session = new GameSession(createInitialTerrain());
    session.modeChosen = true;
    session.claimKit();
    session.money = 100;
    if (owner === 'TopDownCabinScene')
      session.topDownCabin = { inside: true, position: CABIN_DOOR };
    if (owner === 'GalleryScene') {
      session.gallery = new TopDownGallery();
      session.gallery.active = true;
    }
    await page.addInitScript(({ raw, key }) => localStorage.setItem(key, raw), {
      raw: encodeSave(session, SPAWN),
      key: SAVE_KEY,
    });
    await page.goto('/?view=top-down');
    await expect
      .poll(
        () =>
          page.evaluate(
            (key) => window.__MINA_GAME__.scene.isActive(key),
            owner,
          ),
        { timeout: 20_000 },
      )
      .toBe(true);
    await page.evaluate((key) => {
      const scene = window.__MINA_GAME__.scene.getScene(key) as
        TopDownScene | TopDownCabinScene | GalleryScene;
      const visit = Reflect.get(scene, 'visit') as { session: GameSession };
      visit.session.health.hp = 0.1;
      visit.session.survival.hunger = 0;
      visit.session.survival.starvingMs = 60_000;
    }, owner);
    await deathReady(page, 'DESNUTRICIÓN');
    await page.keyboard.press('Enter');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const game = window.__MINA_GAME__;
          return (
            game.scene.isActive('TopDownScene') &&
            !game.scene.isActive('DeathScene')
          );
        }),
      )
      .toBe(true);
    const state = await page.evaluate(() => {
      const camp = window.__MINA_GAME__.scene.getScene(
        'TopDownScene',
      ) as TopDownScene;
      const visit = Reflect.get(camp, 'visit') as { session: GameSession };
      return {
        x: camp.miner.x,
        hp: visit.session.health.hp,
        deaths: visit.session.deaths,
        money: visit.session.money,
      };
    });
    const x =
      owner === 'TopDownCabinScene'
        ? CABIN_PORCH.x
        : owner === 'GalleryScene'
          ? CAMP_DOORS.find((door) => door.id === 'mine')!.x
          : CAMP_MAP.spawnX;
    expect(state).toEqual({ x, hp: 100, deaths: 1, money: 90 });
  });
}

test('Hardcore cenital: al recargar sigue terminada y se puede volver al menú', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const session = new GameSession(createInitialTerrain());
  session.mode = 'hardcore';
  session.modeChosen = true;
  await page.addInitScript(
    ({ raw, key }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
    },
    { raw: encodeSave(session, SPAWN), key: SAVE_KEY },
  );
  await page.goto('/?view=top-down');
  await expect(page.locator('#game-status')).toContainText('CAMPAMENTO', {
    timeout: 20_000,
  });
  await page.evaluate(() => {
    const camp = window.__MINA_GAME__.scene.getScene('TopDownScene');
    const visit = Reflect.get(camp, 'visit') as { session: GameSession };
    visit.session.health.damage(100, camp.time.now, 'roca');
  });
  await deathReady(page, 'CAÍDA DE ROCAS');
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Has muerto', {
    timeout: 20_000,
  });
  await deathReady(page, 'CAÍDA DE ROCAS');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('#game-status')).toHaveText('Menú principal', {
    timeout: 20_000,
  });
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).v4.ended.cause,
      SAVE_KEY,
    ),
  ).toBe('CAÍDA DE ROCAS');
});
