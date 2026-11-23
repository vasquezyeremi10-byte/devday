import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import { worldAudioKey } from '../src/game/config/worldAudio';
import type { MiningScene } from '../src/game/scenes/MiningScene';

const soundState = (page: Page, track: Parameters<typeof worldAudioKey>[0]) =>
  page.evaluate((key) => {
    const sound = window.__MINA_GAME__.sound.get(
      key,
    ) as Phaser.Sound.WebAudioSound | null;
    return { playing: sound?.isPlaying ?? false, volume: sound?.volume ?? 0 };
  }, worldAudioKey(track));

test('la música de partida cambia bajo tierra y se libera al volver al menú', async ({
  page,
}) => {
  test.setTimeout(75_000);
  await page.goto('/?menu=off&intro=off');
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  await page.keyboard.press('1');
  await page.locator('canvas').click({ position: { x: 10, y: 10 } });
  await expect
    .poll(async () => (await soundState(page, 'surface')).volume, {
      timeout: 20_000,
    })
    .toBeGreaterThan(0.2);
  await expect
    .poll(async () => (await soundState(page, 'wind')).playing)
    .toBe(true);

  await page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene(
      'MiningScene',
    ) as MiningScene;
    scene.miner.body.reset(250 * 16 + 8, 66);
    scene.miner.body.enable = false;
  });
  await expect
    .poll(async () => (await soundState(page, 'birds')).volume)
    .toBeGreaterThan(0.2);
  await page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene(
      'MiningScene',
    ) as MiningScene;
    scene.session.dayNight.restore(400_000);
    scene.miner.body.reset(455 * 16 + 8, 66);
  });
  await expect
    .poll(async () => (await soundState(page, 'surf')).volume)
    .toBeGreaterThan(0.2);
  await expect
    .poll(async () => (await soundState(page, 'birds')).playing)
    .toBe(false);

  // Fija los pies en la galería para comprobar el fundido desde un punto estable.
  await page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene(
      'MiningScene',
    ) as MiningScene;
    for (const gear of [
      'helmet',
      'boots',
      'vest',
      'gloves',
      'goggles',
    ] as const) {
      if (!scene.session.loadout.equipped(gear))
        scene.session.loadout.addPPE(gear);
    }
    scene.session.loadout.sync();
    scene.session.firstDayDone = true;
    scene.miner.body.reset(40 * 16 + 8, 14 * 16 + 6);
    scene.miner.body.enable = false;
  });
  await expect
    .poll(async () => (await soundState(page, 'mine')).volume)
    .toBeGreaterThan(0.24);
  await expect
    .poll(async () => (await soundState(page, 'surface')).playing)
    .toBe(false);
  await expect
    .poll(async () => (await soundState(page, 'cave')).playing)
    .toBe(true);

  await page.evaluate(() => {
    window.__MINA_GAME__.scene.pause('MiningScene');
  });
  await expect
    .poll(async () => (await soundState(page, 'mine')).playing)
    .toBe(false);
  await page.evaluate(() => {
    window.__MINA_GAME__.scene.resume('MiningScene');
  });
  await expect
    .poll(async () => (await soundState(page, 'mine')).playing)
    .toBe(true);
  await page.evaluate(() => {
    const game = window.__MINA_GAME__;
    game.scene.stop('MiningScene');
    game.scene.start('MenuScene');
  });
  await expect
    .poll(async () => (await soundState(page, 'mine')).playing)
    .toBe(false);
  await expect
    .poll(async () => (await soundState(page, 'cave')).volume)
    .toBe(0);
});
