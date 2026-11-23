import { expect, test, type Page } from '@playwright/test';
import { GameSession } from '../src/game/systems/GameSession';
import { encodeSave, SAVE_KEY } from '../src/game/systems/SaveSystem';
import type { TopDownScene } from '../src/game/scenes/TopDownScene';
import { createInitialTerrain } from '../src/game/world/Geology';

async function camp(page: Page) {
  const session = new GameSession(createInitialTerrain());
  session.modeChosen = true;
  session.supplies.rail = 1;
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, save);
    },
    { key: SAVE_KEY, save: encodeSave(session, { x: 208, y: 148 }) },
  );
  await page.goto('/?view=top-down');
  await expect(page.locator('#game-status')).toContainText('CAMPAMENTO');
  return session;
}

const place = (page: Page, x: number, y: number) =>
  page.evaluate(
    ({ x, y }) => {
      const scene = window.__MINA_GAME__.scene.getScene(
        'TopDownScene',
      ) as TopDownScene;
      scene.miner.body.reset(x, y);
    },
    { x, y },
  );

test('la bodega deposita, devuelve objetos y conserva el kit', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const session = await camp(page);
  const save = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  const status = page.locator('#game-status');
  await place(page, 424, 267);
  await page.keyboard.down('w');
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene('TopDownScene') as TopDownScene;
    return scene.miner.y;
  })).toBeLessThan(220);
  await page.keyboard.up('w');
  await expect(status).not.toContainText('VENDEDOR');
  await place(page, 552, 298);
  await expect(status).toHaveText('[Z] ABRIR BODEGA');
  await page.keyboard.press('z');
  await expect(status).toHaveText('BODEGA · ALMACENAMIENTO');
  const click = async (x: number, y: number, count = 1) => {
    const box = (await page.locator('canvas').boundingBox())!;
    await page.mouse.click(box.x + x * box.width / 480, box.y + y * box.height / 270, { clickCount: count });
  };
  // El riel es el primer suministro. El casco es el primer objeto del cofre.
  await click(40, 102);
  await click(230, 196);
  await expect.poll(async () => (await save()).supplies.rail).toBe(0);
  await click(260, 102);
  await click(230, 196);
  await expect.poll(async () => (await save()).warehouse.stacks.map((s: {kind: string}) => s.kind))
    .toEqual(['vest', 'boots', 'gloves', 'goggles', 'rail']);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  // Tras retirar el casco, ocupa la primera casilla de la mochila.
  const slot = await page.evaluate(() => {
    const camp = window.__MINA_GAME__.scene.getScene('TopDownScene') as TopDownScene;
    const inventory = camp['inventory']!;
    const i = camp['visit']!.session.loadout.slots.findIndex((ref) => ref?.type === 'ppe');
    return inventory['gridRect'](i);
  });
  await click(slot.x + 8, slot.y + 8, 2);
  await expect.poll(async () => (await save()).v4.loadout.gear.head).toBeTruthy();
  await page.reload();
  await expect(status).toContainText('CAMPAMENTO');
  await place(page, 552, 298);
  await page.keyboard.press('z');
  await expect(status).toHaveText('BODEGA · ALMACENAMIENTO');
  expect((await save()).warehouse.stacks.map((s: {kind: string}) => s.kind)).toEqual(['vest', 'boots', 'gloves', 'goggles', 'rail']);
  expect((await save()).money).toBe(session.money);
  expect(errors).toEqual([]);
});
