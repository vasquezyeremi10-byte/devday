import { expect, test, type Page } from '@playwright/test';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import type { GnomeBoss } from '../src/game/entities/GnomeBoss';

const state = (page: Page) =>
  page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    const g = Reflect.get(s, 'gnome') as GnomeBoss | null;
    return {
      hp: s.session.health.hp,
      boss: g?.hp ?? 0,
      brain: g?.brain.state ?? null,
      frame: g ? Number(g.sprite.frame.name) : -1,
      texture: g?.sprite.texture.key ?? null,
      disabled: s.session.achievements.disabled,
    };
  });

/** Deja al gnomo frente al minero, con los pies en el mismo suelo. */
const placeGnome = (page: Page) =>
  page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    s.miner.body.reset(22 * 16, 148);
    s.miner.setFlipX(false);
    const g = Reflect.get(s, 'gnome') as GnomeBoss | null;
    g?.sprite.body?.reset(s.miner.x + 20, s.miner.y - 9);
  });

test('gnomo invocado: alerta, persigue, golpea con su picota, recibe golpes y muere animado', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/?menu=off&intro=off');
  // Con el servidor recién iniciado la primera carga compila todo en frío.
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  await page.keyboard.press('1');
  await page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    for (const kind of [
      'helmet',
      'boots',
      'vest',
      'gloves',
      'goggles',
    ] as const)
      if (!s.session.loadout.equipped(kind)) s.session.loadout.addPPE(kind);
    s.miner.body.reset(22 * 16, 148);
    s.session.tools.add('axe');
  });
  await page.keyboard.press('|');
  await page.keyboard.type('gnomo');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).boss).toBe(90);
  const first = await state(page);
  expect(first.disabled).toBe(true);
  expect(first.texture).toBe('gnome');

  // Lo ve (aparece mirándolo): alerta y luego persecución o ataque.
  const seen = new Set<string>();
  const frames = new Set<number>();
  await expect
    .poll(
      async () => {
        const s = await state(page);
        if (s.brain) seen.add(s.brain);
        frames.add(s.frame);
        return s.hp;
      },
      { timeout: 8000, intervals: [50] },
    )
    .toBeLessThan(100);
  expect(seen.has('ALERT')).toBe(true);
  expect(seen.has('ATTACK')).toBe(true);
  // Cuadros de la hoja realmente distintos (no un sprite estático).
  expect(frames.size).toBeGreaterThan(4);
  await page
    .locator('canvas')
    .first()
    .screenshot({ path: 'docs/screenshots/gnome-combat.png' });

  // Golpes del minero con el hacha: 20 de daño cada uno.
  await placeGnome(page);
  await page
    .locator('canvas')
    .first()
    .screenshot({ path: 'docs/screenshots/gnome-size.png' });
  await page.keyboard.press('j');
  await expect.poll(async () => (await state(page)).boss).toBe(70);
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(380);
    await placeGnome(page);
    await page.keyboard.press('j');
  }
  await expect.poll(async () => (await state(page)).boss).toBe(0);
  // Muere con su animación: cae, el cuerpo queda un momento y se disuelve.
  expect((await state(page)).brain).toBe('DEATH');
  await page.waitForTimeout(900);
  await page
    .locator('canvas')
    .first()
    .screenshot({ path: 'docs/screenshots/gnome-death.png' });
  await expect
    .poll(async () => (await state(page)).brain, { timeout: 4000 })
    .toBe(null);
});
