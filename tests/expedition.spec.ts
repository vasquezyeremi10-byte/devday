import { expect, test } from '@playwright/test';
import { GameSession } from '../src/game/systems/GameSession';
import { encodeSave, SAVE_KEY } from '../src/game/systems/SaveSystem';
import { createInitialTerrain } from '../src/game/world/Geology';
import { TUNNEL } from '../src/game/world/TerrainGrid';
import { FORGOTTEN_DEPTHS } from '../src/game/systems/Expeditions';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import type { ExpeditionScene } from '../src/game/scenes/ExpeditionScene';

test('la niebla cruza a una expedición lateral, permite extraer y regresar', async ({
  page,
}) => {
  test.setTimeout(70_000);
  const session = new GameSession(createInitialTerrain());
  session.modeChosen = true;
  session.claimKit();
  session.tools.add('iron');
  session.loadout.sync();
  const raw = encodeSave(session, { x: 208, y: 148 });
  await page.addInitScript(
    ({ key, raw }) => localStorage.setItem(key, raw),
    { key: SAVE_KEY, raw },
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?menu=off&intro=off');
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 40_000,
  });
  await page.evaluate((column) => {
    const scene = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    scene.miner.body.reset(column * 16 + 8, 148);
    scene.cameras.main.centerOn(scene.miner.x, scene.miner.y);
  }, TUNNEL.toColumn);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene)
            .interactions.selected?.id,
      ),
    )
    .toBe('mine-entrance');
  await page.keyboard.press('e');
  await expect
    .poll(() => page.evaluate(() => window.__MINA_GAME__.scene.isActive('ExpeditionScene')))
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        () => !Reflect.get(window.__MINA_GAME__.scene.getScene('ExpeditionScene'), 'locked'),
      ),
    )
    .toBe(true);
  const click = await page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene('ExpeditionScene') as ExpeditionScene;
    scene.miner.body.reset(240, 212);
    scene.cameras.main.centerOn(scene.miner.x, scene.miner.y);
    const target = { x: 16 * 16 + 8, y: 12 * 16 + 8 };
    const box = scene.game.canvas.getBoundingClientRect();
    return {
      x: box.left + ((target.x - scene.cameras.main.scrollX) * box.width) / scene.cameras.main.width,
      y: box.top + ((target.y - scene.cameras.main.scrollY) * box.height) / scene.cameras.main.height,
      work: scene.visit.session.workMs({ column: 16, row: 12 }, scene.grid),
    };
  });
  await page.mouse.move(click.x, click.y);
  await page.mouse.down();
  await page.waitForTimeout(click.work + 500);
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const scene = window.__MINA_GAME__.scene.getScene('ExpeditionScene') as ExpeditionScene;
        return {
          block: scene.grid.get(16, 12),
          cargo: [...scene.visit.session.inventory.items],
        };
      }),
    )
    .toEqual({ block: -1, cargo: ['coal'] });
  await page.evaluate(({ x, y }) => {
    const scene = window.__MINA_GAME__.scene.getScene('ExpeditionScene') as ExpeditionScene;
    scene.miner.body.reset(x, y);
    scene.cameras.main.centerOn(x, y);
  }, FORGOTTEN_DEPTHS.returnPortal);
  await page.keyboard.press('e');
  await expect
    .poll(() => page.evaluate(() => window.__MINA_GAME__.scene.isActive('MiningScene')))
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const scene = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
        return {
          active: scene.session.expedition?.active,
          cargo: [...scene.session.inventory.items],
        };
      }),
    )
    .toEqual({ active: false, cargo: ['coal'] });
  expect(errors).toEqual([]);
});
