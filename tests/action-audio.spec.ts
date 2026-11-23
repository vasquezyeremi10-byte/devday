import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';

const actions = (page: Page) =>
  page.evaluate(() => {
    const game = window.__MINA_GAME__;
    const scene = game.scene.getScene('MiningScene') as MiningScene;
    const cart = game.sound.get('sfx-cart-rolling');
    return {
      grounded: scene.miner.body.blocked.down,
      selected: scene.interactions.selected?.id,
      pushing: scene.session.cart.pushing,
      rolling: cart?.isPlaying ?? false,
      mine: (scene as unknown as { inMine: () => boolean }).inMine(),
      echo: Boolean(Reflect.get(Reflect.get(scene, 'footsteps'), 'echo')),
      clips: scene.registry.get('action-audio-test') as {
        key: string;
        volume: number;
      }[],
    };
  });

test('los pasos, el consumo y el carro suenan al ejecutar cada acción', async ({
  page,
}) => {
  test.setTimeout(75_000);
  await page.goto('/?menu=off&intro=off');
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  await page.keyboard.press('1');
  await page.locator('canvas').click({ position: { x: 10, y: 10 } });
  await expect.poll(async () => (await actions(page)).grounded).toBe(true);
  await page.evaluate(() => {
    const game = window.__MINA_GAME__;
    const clips: { key: string; volume: number }[] = [];
    game.registry.set('action-audio-test', clips);
    const manager = game.sound as Phaser.Sound.WebAudioSoundManager;
    const add = manager.add.bind(manager);
    manager.add = (key: string, config?: Phaser.Types.Sound.SoundConfig) => {
      if (
        key.startsWith('sfx-step-') ||
        key.startsWith('sfx-jump-') ||
        key === 'sfx-eat' ||
        key === 'sfx-drink'
      )
        clips.push({ key, volume: config?.volume ?? 1 });
      return add(key, config);
    };
    const scene = game.scene.getScene('MiningScene') as MiningScene;
    scene.miner.body.reset(112, 148);
  });

  await page.keyboard.down('a');
  await expect
    .poll(async () =>
      (await actions(page)).clips.some(
        ({ key, volume }) =>
          key.startsWith('sfx-step-dirt-') && volume === 0.28,
      ),
    )
    .toBe(true);
  await page.keyboard.up('a');
  await page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene(
      'MiningScene',
    ) as MiningScene;
    scene.miner.body.reset(112, 148);
  });
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('a');
  await expect
    .poll(async () =>
      (await actions(page)).clips.some(
        ({ key, volume }) =>
          key.startsWith('sfx-step-dirt-') && Math.abs(volume - 0.35) < 0.001,
      ),
    )
    .toBe(true);
  await page.keyboard.up('a');
  await page.keyboard.up('ShiftLeft');

  await page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene(
      'MiningScene',
    ) as MiningScene;
    for (const kind of [
      'helmet',
      'boots',
      'vest',
      'gloves',
      'goggles',
    ] as const)
      if (!scene.session.loadout.equipped(kind))
        scene.session.loadout.addPPE(kind);
    scene.miner.body.reset(22 * 16, 148);
  });
  await page.keyboard.down('d');
  await expect
    .poll(async () =>
      (await actions(page)).clips.some(({ key }) =>
        key.startsWith('sfx-step-metal-'),
      ),
    )
    .toBe(true);
  expect((await actions(page)).mine).toBe(true);
  expect((await actions(page)).echo).toBe(true);
  await page.keyboard.up('d');
  await expect.poll(async () => (await actions(page)).grounded).toBe(true);
  await page.keyboard.press('Space');
  await expect
    .poll(async () =>
      (await actions(page)).clips.some(({ key }) =>
        key.startsWith('sfx-jump-hu-'),
      ),
    )
    .toBe(true);

  await page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene(
      'MiningScene',
    ) as MiningScene;
    scene.session.survival.energy = 50;
    scene.session.survival.hunger = 20;
    scene.session.receive('sandwich');
    scene.session.receive('cola');
    scene.consumeFood('sandwich');
    scene.consumeFood('cola');
    scene.consumeFood('cola'); // Sin unidades: el rechazo es silencioso.
    scene.miner.body.reset(230, 148);
  });
  expect(
    (await actions(page)).clips
      .map(({ key }) => key)
      .filter(
        (key) => !key.startsWith('sfx-step-') && !key.startsWith('sfx-jump-'),
      ),
  ).toEqual(['sfx-eat', 'sfx-drink']);

  await expect.poll(async () => (await actions(page)).selected).toBe('cart');
  await page.keyboard.press('e');
  await expect.poll(async () => (await actions(page)).pushing).toBe(true);
  expect((await actions(page)).rolling).toBe(false);
  await page.keyboard.down('d');
  await expect.poll(async () => (await actions(page)).rolling).toBe(true);
  await page.keyboard.up('d');
  await expect.poll(async () => (await actions(page)).rolling).toBe(false);
});
