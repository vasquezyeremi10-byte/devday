import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';

/** Nombre persistente de la partida y bocamina libre de carteles. */
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

/** Textos visibles del mundo (BitmapText) que contienen `needle`. */
const worldText = (page: Page, needle: string) =>
  scene(
    page,
    (s, n) =>
      s.children.list.some(
        (o) =>
          o.type === 'BitmapText' &&
          (o as unknown as { text: string; visible: boolean }).visible &&
          (o as unknown as { text: string }).text === n,
      ),
    needle,
  );

test('al iniciar se nombra la mina (máx. 10) y se conserva sin cartel', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  expect(await scene(page, (s) => s.safety.modeOpen)).toBe(true);
  // Letras que en el juego son atajos (H, M, F, R, Z) solo escriben.
  await page.keyboard.type('hmfrz');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace');
  // Más de 10 caracteres: el resto se ignora.
  await page.keyboard.type('cobre sur del norte');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(100);
  expect(
    await scene(page, (s) => ({
      name: s.safety.mineName,
      mute: s.sound.mute,
      help: s.hud.helpOpen,
      surface: s.miner.y < 160,
    })),
  ).toEqual({ name: 'COBRE SUR', mute: false, help: false, surface: true });
  await page.locator('canvas').screenshot({
    path: testInfo.outputPath('nombre-mina.png'),
  });
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.safety.modeOpen)).toBe(false);
  const name = await scene(page, (s) => s.session.mineName);
  expect(name.length).toBeLessThanOrEqual(10);
  expect(await worldText(page, name)).toBe(false);
  await scene(page, (s) => s.miner.body.reset(262, 148));
  await page.waitForTimeout(500);
  await page.locator('canvas').screenshot({
    path: testInfo.outputPath('entrada-sin-cartel.png'),
  });
  // Persistencia: el nombre sigue identificando la partida al recargar.
  await scene(page, (s) => s.save());
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  expect(await scene(page, (s) => s.session.mineName)).toBe(name);
  expect(await worldText(page, name)).toBe(false);
});

test('sin escribir nada la mina se llama MINA CERO', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await page.keyboard.press('2');
  await expect
    .poll(() => scene(page, (s) => s.session.mineName))
    .toBe('MINA CERO');
  expect(await scene(page, (s) => s.session.mode)).toBe('hardcore');
});

test('no quedan piezas, animación ni luces del cartel; el portal conserva sus faroles', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await page.keyboard.press('1');
  expect(
    await scene(page, (s) => ({
      frames: s.textures
        .get('mine')
        .getFrameNames()
        .filter((name) => /mine_sign|sign_leg|sign_glow/.test(name)),
      animation: s.anims.exists('mine-sign'),
      lights: s.scenery.lights.map((light) => light.kind),
      intact: [
        'headwall',
        'portal_header',
        'portal_post',
        'sign_hazard',
        'sign_helmet',
        'portal_lantern_',
        'mine_lamp_',
      ].every((name) =>
        s.children.list.some(
          (o) =>
            'texture' in o &&
            'frame' in o &&
            (o as Phaser.GameObjects.Image).texture.key === 'mine' &&
            String((o as Phaser.GameObjects.Image).frame.name).startsWith(name),
        ),
      ),
    })),
  ).toEqual({
    frames: [],
    animation: false,
    // V7 añade la ventana de la bodega (luz decorativa solo de noche).
    // V8 suma 7 luces del campamento (farol, 2 ventanas, brasero, 3 postes).
    lights: [
      ...['decor', 'decor', 'decor', 'decor', 'torch', 'torch'],
      ...Array(7).fill('decor'),
    ],
    intact: true,
  });
});
