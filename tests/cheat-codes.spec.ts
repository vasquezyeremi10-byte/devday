import { expect, test, type Page } from '@playwright/test';
import type { MiningScene } from '../src/game/scenes/MiningScene';

const scene = <T>(page: Page, fn: (s: MiningScene) => T) =>
  page.evaluate(
    (source) =>
      new Function('s', `return (${source})(s);`)(
        window.__MINA_GAME__.scene.getScene('MiningScene'),
      ),
    fn.toString(),
  ) as Promise<T>;

const command = async (page: Page, text: string) => {
  await page.keyboard.press('|');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect.poll(() => scene(page, (s) => s.scene.isActive())).toBe(true);
};

test('códigos: money y fly en partida normal, sin logros y guardados', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('| códigos', {
    timeout: 30000,
  });
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
  expect(await scene(page, (s) => s.session.achievements.disabled)).toBe(false);

  // MONEY: compra sin descontar.
  await command(page, 'money');
  expect(
    await scene(page, (s) => {
      s.session.money = 0;
      return [s.session.buy('iron'), s.session.money];
    }),
  ).toEqual(['COMPRA REALIZADA', 0]);
  expect(await scene(page, (s) => s.session.achievements.disabled)).toBe(true);

  // FLY: sin el código, el doble espacio solo salta.
  await page.keyboard.press('Space');
  await page.waitForTimeout(80);
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  expect(await scene(page, (s) => s.miner.flying)).toBe(false);

  await command(page, 'fly');
  await page.waitForTimeout(200);
  const ground = await scene(page, (s) => s.miner.y);
  await page.keyboard.press('Space');
  await page.waitForTimeout(80);
  await page.keyboard.press('Space');
  await expect.poll(() => scene(page, (s) => s.miner.flying)).toBe(true);
  await page.keyboard.down('Space');
  await page.waitForTimeout(500);
  await page.keyboard.up('Space');
  const high = await scene(page, (s) => s.miner.y);
  expect(high).toBeLessThan(ground - 30);
  // Suspendido: sin gravedad no cae.
  await page.waitForTimeout(500);
  expect(
    Math.abs((await scene(page, (s) => s.miner.y)) - high),
  ).toBeLessThan(2);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/cheat-fly.png' });
  // Bajar con S hasta tocar suelo aterriza.
  await page.keyboard.down('s');
  await expect
    .poll(() => scene(page, (s) => s.miner.flying), { timeout: 5000 })
    .toBe(false);
  await page.keyboard.up('s');

  // Persisten en la partida normal (no en la de desarrollo).
  await scene(page, (s) => s.save());
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  expect(
    await scene(page, (s) => [
      s.session.cheats.infiniteMoney,
      s.session.cheats.flight,
      s.session.achievements.disabled,
      s.session.developer.enabled,
    ]),
  ).toEqual([true, true, true, false]);
});

test('código desbloquear: todas las etapas, aviso en el HUD y guardado', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('| códigos', {
    timeout: 30000,
  });
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
  expect(await scene(page, (s) => s.session.progression.tier)).toBe(1);

  await page.keyboard.press('|');
  await page.keyboard.type('desbloquear');
  await page.keyboard.press('Enter');
  await expect
    .poll(() =>
      scene(
        page,
        (s) =>
          (
            Reflect.get(s, 'developerConsole') as unknown as {
              output: { text: string };
            }
          ).output.text,
      ),
    )
    .toBe('TODAS LAS ETAPAS DESBLOQUEADAS - LOGROS DESACTIVADOS');
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/cheat-desbloquear.png' });
  await page.keyboard.press('Escape');
  await expect.poll(() => scene(page, (s) => s.scene.isActive())).toBe(true);
  expect(
    await scene(page, (s) => [
      s.session.progression.tier,
      s.session.achievements.disabled,
      s.session.progression.nextGoal(),
    ]),
  ).toEqual([3, true, 'TODAS LAS ETAPAS DESBLOQUEADAS']);

  // Se conserva al recargar.
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 30000,
  });
  expect(await scene(page, (s) => s.session.progression.tier)).toBe(3);
});