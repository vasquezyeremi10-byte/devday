import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import { Block, surfaceRow } from '../src/game/world/TerrainGrid';
import { WORLD, WORLD_FIRST_COLUMN } from '../src/game/config/constants';

declare global {
  interface Window {
    __MINA_GAME__: Phaser.Game;
  }
}

test('partida nueva sólida: entrada excavable, guardado y carga', async ({
  page,
}) => {
  await page.goto('/?menu=off');
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  // Todo el mundo abierto, del borde oeste al este: el único hueco bajo la
  // superficie es la entrada de 10 × 3.
  const rows = Array.from({ length: WORLD.columns - WORLD_FIRST_COLUMN }, (_, i) =>
    surfaceRow(i + WORLD_FIRST_COLUMN),
  );
  const initial = await page.evaluate((surfaceRows) => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    const g = s.session.grid;
    let gaps = 0;
    for (let row = 0; row < g.rows; row++)
      for (let column = g.first; column < g.end; column++)
        if (row >= surfaceRows[column - g.first]! && g.get(column, row) === -1)
          gaps++;
    return { rev: g.worldRev, gaps, front: g.get(28, 8) };
  }, rows);
  expect(initial.rev).toBe(4);
  expect(initial.gaps).toBe(30);
  expect(initial.front).not.toBe(Block.Air);
  await page.keyboard.press('1');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = window.__MINA_GAME__.scene.getScene(
          'MiningScene',
        ) as MiningScene;
        return s.session.modeChosen;
      }),
    )
    .toBe(true);
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
    s.session.firstDayDone = true;
    s.miner.body.reset(25 * 16, 8 * 16);
    s.cameras.main.centerOn(25 * 16, 8 * 16);
  });
  await page.waitForTimeout(200);
  await page
    .locator('canvas')
    .first()
    .screenshot({ path: 'docs/screenshots/solid-mine-entrance.png' });
  const dug = await page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    s.session.tools.add('iron');
    s.session.mode = 'normal';
    s.session.modeChosen = true;
    const cell = { column: 28, row: 8 };
    const ok = s.session.mine(s.mining, { x: 27.5 * 16, y: 8.5 * 16 }, cell);
    if (ok) s['terrainChanged']([cell]);
    return { ok, air: s.session.grid.get(28, 8) === -1, saved: s['save']() };
  });
  expect(dug).toEqual({ ok: true, air: true, saved: true });
  await page.waitForTimeout(200);
  await page
    .locator('canvas')
    .first()
    .screenshot({ path: 'docs/screenshots/solid-mine-first-gallery.png' });
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  expect(
    await page.evaluate(() => {
      const s = window.__MINA_GAME__.scene.getScene(
        'MiningScene',
      ) as MiningScene;
      return {
        rev: s.session.grid.worldRev,
        dug: s.session.grid.get(28, 8),
        next: s.session.grid.get(29, 8),
      };
    }),
  ).toMatchObject({ rev: 4, dug: Block.Air });
});
