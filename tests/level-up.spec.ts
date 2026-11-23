import { expect, test, type Page } from '@playwright/test';
import type { MiningScene } from '../src/game/scenes/MiningScene';

const scene = <T>(page: Page, fn: (s: MiningScene) => T) =>
  page.evaluate((source) => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene');
    return new Function('s', `return (${source})(s);`)(s);
  }, fn.toString()) as Promise<T>;

async function point(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(
    box.x + (x * box.width) / 480,
    box.y + (y * box.height) / 270,
  );
}

test('el cobre completa la barra y activa haz, estrellas y recompensas sin frenar al minero', async ({
  page,
}, testInfo) => {
  test.setTimeout(50000);
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
  await scene(page, (s) => {
    const pick = s.session.tools.add('iron');
    s.session.loadout.assignQuick(0, { type: 'tool', id: pick.id });
    s.session.buy('kit');
    s.session.firstDayDone = true;
    s.miner.body.reset(30, 148);
    s.session.grid.set(2, 10, 5); // Fuera de los cimientos protegidos y de la vía.
    s.terrain.redraw({ column: 2, row: 10 });
    s.session.gainXp(75);
  });
  await page.keyboard.press('1');
  const xp = () => scene(page, (s) => s.hud['xpValue'].text);
  await expect.poll(xp).toBe('75 / 100 XP');
  await expect.poll(() => scene(page, (s) => s.hud['xpFill'])).toBe(0.75);
  await point(page, 155, 13);
  await expect
    .poll(() => scene(page, (s) => s.hud['xpTip'].text))
    .toContain('FALTAN 25 XP');
  await scene(page, (s) => s.session.gainXp(20));
  await expect.poll(xp).toBe('95 / 100 XP');
  const before = await scene(page, (s) => ({
    money: s.session.money,
    time: s.session.workMs({ column: 2, row: 10 }),
    hidden: s.session.visibility.has(58, 30),
    lights: s.session.lights.items.length,
  }));
  expect(before.hidden).toBe(false);
  const target = await scene(page, (s) => ({
    x: 40 - s.cameras.main.scrollX,
    y: 168 - s.cameras.main.scrollY,
  }));
  await point(page, target.x, target.y);
  await expect
    .poll(() =>
      scene(page, (s) => ({
        cursor: s['target'](),
        inspect: s['mining'].inspect(s.miner.body.center, s['target']()),
        protected: s.session.protected(s['target']()),
      })),
    )
    .toEqual({
      cursor: { column: 2, row: 10 },
      inspect: 'ready',
      protected: false,
    });
  // La barra llena dura ~200 ms: se registra su máximo en cada cuadro en vez
  // de sondear (el sondeo podía perder la ventana según la carga del equipo).
  await scene(page, (s) => {
    const w = window as unknown as {
      __xpMax: number;
      __fx: { beam: number; stars: boolean; title: boolean };
    };
    w.__xpMax = 0;
    w.__fx = { beam: 0, stars: false, title: false };
    s.events.on('postupdate', () => {
      w.__xpMax = Math.max(w.__xpMax, s.hud['xpFill'] ?? 0);
      const fx = s['levelUp'];
      // Un mismo cuadro con el haz completo, estrellas y título.
      if (fx['beamHeight'] === 96 && fx['starCount'] > 0 && fx['title'].visible)
        w.__fx = { beam: 96, stars: true, title: true };
    });
  });
  await page.mouse.down();
  await expect
    .poll(() => scene(page, (s) => s.session.progression.level))
    .toBe(2);
  await page.mouse.up();
  await expect.poll(xp).toBe('5 / 255 XP');
  expect(await scene(page, (s) => s['levelUp']['xp'].text)).toBe('+10 XP');
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __xpMax: number }).__xpMax),
    )
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __fx: object }).__fx,
      ),
    )
    .toEqual({ beam: 96, stars: true, title: true });
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('nivel-haz.png') });
  const x = await scene(page, (s) => s.miner.x);
  await page.keyboard.down('a');
  await expect.poll(() => scene(page, (s) => s.miner.x)).toBeLessThan(x - 6);
  await page.keyboard.up('a');
  await expect
    .poll(() =>
      scene(page, (s) => ({
        gold: s['levelUp']['gold'].text,
        speed: s['levelUp']['speed'].text,
        visible: s['levelUp']['gold'].visible && s['levelUp']['speed'].visible,
      })),
    )
    .toEqual({
      gold: '+25 DE ORO',
      speed: '+1 VELOCIDAD DE MINADO',
      visible: true,
    });
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('nivel-premios.png') });
  const result = () =>
    scene(page, (s) => ({
      money: s.session.money,
      time: s.session.workMs({ column: 2, row: 10 }),
      points: s.session.progression.miningSpeedPoints,
      hidden: s.session.visibility.has(58, 30),
      lights: s.session.lights.items.length,
      cargo: s.session.inventory.items,
    }));
  const gained = {
    money: before.money + 25,
    time: Math.round(before.time / 1.02),
    points: 1,
    hidden: false,
    lights: before.lights,
    cargo: ['copper'],
  };
  expect(await result()).toEqual(gained);
  await expect.poll(() => scene(page, (s) => s.hud['xpFill'])).toBe(5 / 255);
  await page.keyboard.press('g');
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  expect(await result()).toEqual(gained);
  await expect.poll(xp).toBe('5 / 255 XP');
  expect(await scene(page, (s) => s['levelUp']['gold'].visible)).toBe(false);
});

test('el haz se recorta al techo mientras el minero empuja el carro', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
  await scene(page, (s) => {
    s.session.buy('kit');
    s.session.firstDayDone = true;
    s.miner.body.reset(345, 148);
    s.session.cart.x = 365;
  });
  await expect
    .poll(() => scene(page, (s) => s.miner.body.blocked.down))
    .toBe(true);
  await page.keyboard.press('c');
  await expect
    .poll(() => scene(page, (s) => s.session.cart.pushing))
    .toBe(true);
  const before = await scene(page, (s) => ({
    x: s.session.cart.x,
    hidden: s.session.visibility.has(58, 30),
    lights: s.session.lights.items.length,
  }));
  await scene(page, (s) => s.session.gainXp(100));
  await page.keyboard.down('d');
  await expect
    .poll(() => scene(page, (s) => s['levelUp']['beamHeight']), {
      intervals: [30, 50, 80],
    })
    .toBeGreaterThan(0);
  expect(await scene(page, (s) => s['levelUp']['beamHeight'])).toBeLessThan(96);
  expect(await scene(page, (s) => s.hud['award'].visible)).toBe(false);
  await expect
    .poll(() => scene(page, (s) => s.session.cart.x))
    .toBeGreaterThan(before.x + 4);
  await page.keyboard.up('d');
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('nivel-galeria.png') });
  expect(
    await scene(page, (s) => ({
      pushing: s.session.cart.pushing,
      hidden: s.session.visibility.has(58, 30),
      lights: s.session.lights.items.length,
    })),
  ).toEqual({ pushing: true, hidden: before.hidden, lights: before.lights });
});
