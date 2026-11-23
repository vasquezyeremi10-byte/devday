import { test, expect } from '@playwright/test';
import { GameSession } from '../src/game/systems/GameSession';
import { encodeSave, SAVE_KEY } from '../src/game/systems/SaveSystem';
import { createInitialTerrain } from '../src/game/world/Geology';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import type { GalleryScene } from '../src/game/scenes/GalleryScene';

test('entra desde la ladera, extrae carbón, recarga y repite el cruce con el mismo progreso', async ({
  page,
}) => {
  test.setTimeout(100_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const s = new GameSession(createInitialTerrain());
  s.modeChosen = true;
  s.claimKit();
  s.tools.add('iron');
  const raw = encodeSave(s, { x: 194, y: 148 });
  await page.addInitScript(
    ({ key, raw }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
    },
    { key: SAVE_KEY, raw },
  );
  await page.goto('/?menu=off&intro=off');
  const status = page.locator('#game-status');
  await expect(status).toContainText('Mina lista', { timeout: 40000 });
  await page.keyboard.press('e');
  await page.keyboard.down('d');
  const atDoor = () =>
    page.evaluate(() => {
      const surface = window.__MINA_GAME__.scene.getScene(
        'MiningScene',
      ) as MiningScene;
      return surface.scene.isActive() && surface.interactions?.selected?.label;
    });
  await expect.poll(atDoor).toBe('[E] ENTRAR A LA MINA');
  await page.waitForFunction(() => {
    const surface = window.__MINA_GAME__.scene.getScene(
      'MiningScene',
    ) as MiningScene;
    return surface.scene.isActive() && surface.miner.body.blocked.right;
  });
  await page.keyboard.up('d');
  await page.screenshot({ path: 'docs/screenshots/mine-modes-entrance.png' });
  await page.keyboard.press('e');
  await expect(status).toContainText('[E] SALIR A LA SUPERFICIE', {
    timeout: 15000,
  });
  // Aproximarse al carbón en la pared norte de la estación.
  const col = () =>
    page.evaluate(() =>
      Math.floor(
        (window.__MINA_GAME__.scene.getScene('GalleryScene') as GalleryScene)
          .miner.body.center.x / 16,
      ),
    );
  await page.keyboard.down('a');
  await expect.poll(col, { intervals: [20] }).toBe(13);
  await page.keyboard.up('a');
  await page.keyboard.down('w');
  await page.waitForFunction(() => {
    const miner = (
      window.__MINA_GAME__.scene.getScene('GalleryScene') as GalleryScene
    ).miner;
    return miner.body.blocked.up;
  });
  await page.keyboard.up('w');
  const face = await page.evaluate(() => {
    const mine = window.__MINA_GAME__.scene.getScene(
      'GalleryScene',
    ) as GalleryScene;
    return {
      visible: mine.gallery.visibility.has(13, 10),
      light: mine.view.lit[10 * mine.gallery.grid.columns + 13],
    };
  });
  expect(face.visible).toBe(true);
  expect(face.light).toBeGreaterThan(0.3);
  await page.screenshot({ path: 'docs/screenshots/mine-modes-gallery.png' });
  await page.keyboard.press('Space');
  const cargo = () =>
    page.evaluate(() => {
      const g = window.__MINA_GAME__.scene.getScene(
        'GalleryScene',
      ) as GalleryScene;
      return {
        items: [...g.visit.session.inventory.items],
        xp: g.visit.session.progression.xp,
        dug: g.gallery.dug.size,
        tool: g.visit.session.tools.current?.durability,
        hp: g.visit.session.health.hp,
        money: g.visit.session.money,
      };
    });
  await expect
    .poll(async () => (await cargo()).items, { timeout: 10000 })
    .toEqual(['coal']);
  const mined = await cargo();
  expect(mined.xp).toBeGreaterThan(s.progression.xp);
  await page.keyboard.press('Tab');
  await page.waitForFunction(
    () =>
      (window.__MINA_GAME__.scene.getScene('GalleryScene') as GalleryScene)
        .inventory.open,
  );
  await page.keyboard.press('Tab');
  await page.reload();
  await expect(status).toContainText(/ESPACIO|\[E\]/, { timeout: 40000 });
  await expect.poll(cargo, { timeout: 40000 }).toEqual(mined);
  // Volver a la trampilla desde la pared norte.
  await page.keyboard.down('d');
  await expect.poll(col, { intervals: [20] }).toBe(14);
  await page.keyboard.up('d');
  await expect(status).toContainText('[E] SALIR A LA SUPERFICIE');
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('e');
    await expect.poll(atDoor, { timeout: 30000 }).toBe('[E] ENTRAR A LA MINA');
    const surfaceCargo = await page.evaluate(
      () =>
        (window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene)
          .session.inventory.items,
    );
    expect(surfaceCargo).toEqual(['coal']);
    await page.keyboard.press('e');
    await expect(status).toContainText('[E] SALIR A LA SUPERFICIE', {
      timeout: 20000,
    });
    expect(await cargo()).toEqual(mined);
  }
  expect(errors).toEqual([]);
});
