import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';

/** Colocación con clic derecho real: antorcha en la muralla y rieles. */
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

async function settle(page: Page) {
  await expect
    .poll(() => scene(page, (s) => s.miner.body.blocked.down))
    .toBe(true);
}

/** Clic derecho sobre un punto del mundo. */
async function rightClickWorld(page: Page, x: number, y: number) {
  const cam = await scene(page, (s) => ({
    x: s.cameras.main.scrollX,
    y: s.cameras.main.scrollY,
  }));
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(
    box.x + ((x - cam.x) * box.width) / 480,
    box.y + ((y - cam.y) * box.height) / 270,
  );
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(60);
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(120);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await settle(page);
  await page.keyboard.press('1');
  await scene(page, (s) => s.session.buy('kit'));
});

test('antorcha en el centro de una cámara: la muralla de la mina la sostiene', async ({
  page,
}) => {
  await scene(page, (s) => {
    const cells: { column: number; row: number }[] = [];
    for (let c = 20; c <= 26; c++)
      for (const r of [12, 13, 14]) cells.push({ column: c, row: r });
    for (const c of cells) {
      s.session.grid.set(c.column, c.row, -1);
      s.session.visibility.reveal(c.column, c.row);
    }
    s.session.afterTerrainChange(cells);
    for (const c of cells) s.terrain.redraw(c);
    s.lighting.terrainChanged();
    s.session.supports.install(s.session.grid, { column: 20, row: 14 }, 'wood');
    s.session.supports.install(s.session.grid, { column: 26, row: 14 }, 'wood');
    s.session.geotech.evaluate();
    s.session.supplies.torch = 1;
    s.session.loadout.assignQuick(3, { type: 'supply', kind: 'torch' });
    s.miner.body.reset(22 * 16 + 8, 14 * 16 + 4);
  });
  await settle(page);
  await page.keyboard.press('4');
  await expect.poll(() => scene(page, (s) => s.hud.activeSupply)).toBe('torch');
  // Celda (23, 13): sin bloque vecino arriba, abajo ni a los lados.
  await rightClickWorld(page, 23 * 16 + 8, 13 * 16 + 8);
  await expect
    .poll(() =>
      scene(page, (s) =>
        s.session.lights.items.some((l) => l.column === 23 && l.row === 13),
      ),
    )
    .toBe(true);
  expect(
    await scene(page, (s) => ({
      stock: s.session.supplies.torch,
      shortcut: s.session.loadout.quickbar[3],
      active: s.hud.activeSupply,
    })),
  ).toEqual({ stock: 0, shortcut: null, active: null });
});

test('rieles con clic derecho junto al extremo de la vía', async ({ page }) => {
  const end = await scene(page, (s) => {
    const column = Math.max(...s.session.rails.segments.map((r) => r.column));
    const row = s.session.rails.at(column)!.row;
    // Abrir la columna siguiente a la altura de la vía.
    const cells = [
      { column: column + 1, row },
      { column: column + 1, row: row - 1 },
    ];
    for (const c of cells) {
      s.session.grid.set(c.column, c.row, -1);
      s.session.visibility.reveal(c.column, c.row);
    }
    s.session.afterTerrainChange(cells);
    for (const c of cells) s.terrain.redraw(c);
    s.lighting.terrainChanged();
    s.session.supplies.rail = 2;
    s.hud.activeSupply = 'rail';
    s.miner.body.reset(column * 16 + 4, row * 16 + 4);
    return { column, row };
  });
  await settle(page);
  // Apuntando al piso bajo la columna nueva.
  await rightClickWorld(
    page,
    (end.column + 1) * 16 + 8,
    (end.row + 1) * 16 + 6,
  );
  await expect
    .poll(() =>
      scene(page, (s, c) => s.session.rails.at(c + 1)?.row, end.column),
    )
    .toBe(end.row);
  expect(await scene(page, (s) => s.session.supplies.rail)).toBe(1);
  // Q recorre también los rieles.
  expect(await scene(page, (s) => s.hud.activeSupply)).toBe('rail');
});
