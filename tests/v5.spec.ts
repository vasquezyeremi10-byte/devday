import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';

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
/** Mueve el mouse a un punto del mundo (coordenadas de juego). */
async function pointWorld(page: Page, x: number, y: number) {
  const cam = await scene(page, (s) => ({
    x: s.cameras.main.scrollX,
    y: s.cameras.main.scrollY,
  }));
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(
    box.x + ((x - cam.x) * box.width) / 480,
    box.y + ((y - cam.y) * box.height) / 270,
  );
}
async function clickWorld(page: Page, x: number, y: number) {
  await pointWorld(page, x, y);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(80);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await settle(page);
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
  // Kit gratuito reclamado por la vía de juego (sin compra).
  await scene(page, (s) => s.session.buy('kit'));
});

test('Tab abre y cierra el inventario; Esc cierra; tooltip con datos reales', async ({
  page,
}) => {
  await scene(page, (s) => {
    s.session.tools.add('iron');
    s.session.tools.add('shovel');
    s.session.loadout.sync();
  });
  await page.keyboard.press('Tab');
  await expect.poll(() => scene(page, (s) => s.inventory.open)).toBe(true);
  // Tab no movió el foco del navegador fuera del juego.
  expect(
    await page.evaluate(() => document.activeElement?.tagName ?? ''),
  ).not.toBe('BUTTON');
  await page.keyboard.press('Tab');
  await expect.poll(() => scene(page, (s) => s.inventory.open)).toBe(false);
  await page.keyboard.press('Tab');
  await expect.poll(() => scene(page, (s) => s.inventory.open)).toBe(true);
  // Cursor sobre la primera casilla (una herramienta): tooltip con nombre y durabilidad.
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(
    box.x + ((162 + 10) * box.width) / 480,
    box.y + ((64 + 10) * box.height) / 270,
  );
  await page.waitForTimeout(150);
  const tip = await scene(page, (s) =>
    (
      s.inventory as unknown as { texts: { visible: boolean; text: string }[] }
    ).texts
      .filter((t) => t.visible)
      .map((t) => t.text)
      .join(' | '),
  );
  expect(tip).toMatch(/PICOTA DE HIERRO|PALA BASICA/);
  expect(tip).toContain('DURABILIDAD');
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v5-inventory-tooltip.png' });
  await page.keyboard.press('Escape');
  await expect.poll(() => scene(page, (s) => s.inventory.open)).toBe(false);
});

test('cinco corazones: bajan con el daño y la muerte llega a 0 HP', async ({
  page,
}) => {
  const frames = () =>
    scene(page, (s) =>
      (
        s.hud as unknown as { hearts: { frame: { name: string } }[] }
      ).hearts.map((h) => h.frame.name.replace('heart_', '')),
    );
  expect(await frames()).toEqual(['full', 'full', 'full', 'full', 'full']);
  await scene(page, (s) => s.session.health.damage(30, s.time.now, 'roca'));
  await page.waitForTimeout(100);
  expect(await frames()).toEqual(['full', 'full', 'full', 'half', 'empty']);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v5-hearts.png' });
  await scene(page, (s) =>
    s.session.health.damage(200, s.time.now + 5000, 'roca'),
  );
  await expect.poll(() => scene(page, (s) => s.session.deaths)).toBe(1);
  expect(await scene(page, (s) => s.session.health.hp)).toBe(100);
});

test('modo desmontar: X, antorcha, viga crítica con aviso, riel ocupado y guardado', async ({
  page,
}) => {
  test.setTimeout(45000);
  // Galería de 9 bloques en la zona reservada bajo la bocamina (techo de
  // tierra sin yacimientos para cualquier semilla), dos vigas y una antorcha.
  await scene(page, (s) => {
    const cells: { column: number; row: number }[] = [];
    for (let c = 19; c <= 27; c++)
      for (const r of [13, 14]) cells.push({ column: c, row: r });
    for (const c of cells) {
      s.session.grid.set(c.column, c.row, -1);
      s.session.visibility.reveal(c.column, c.row);
    }
    s.session.afterTerrainChange(cells);
    for (const c of cells) s.terrain.redraw(c);
    s.lighting.terrainChanged();
    s.session.supports.install(s.session.grid, { column: 21, row: 14 }, 'wood');
    s.session.supports.install(s.session.grid, { column: 25, row: 14 }, 'wood');
    s.session.lights.install(s.session.grid, { column: 23, row: 14 }, 'torch');
    s.session.geotech.evaluate();
    s.miner.body.reset(22 * 16 + 8, 14 * 16 + 4);
  });
  await settle(page);
  await page.waitForTimeout(300);
  const litBefore = await scene(page, (s) =>
    s.lighting.lightAt(25 * 16 + 8, 13 * 16 + 8),
  );
  await page.keyboard.press('x');
  await expect.poll(() => scene(page, (s) => s.dismantleMode)).toBe(true);
  // Antorcha: amarilla (oscurece), se retira y su luz desaparece.
  await pointWorld(page, 23 * 16 + 8, 14 * 16 + 8);
  await page.waitForTimeout(150);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v5-dismantle-torch.png' });
  await clickWorld(page, 23 * 16 + 8, 14 * 16 + 8);
  await expect
    .poll(() => scene(page, (s) => s.session.lights.items.length))
    .toBe(0);
  await page.waitForTimeout(200);
  const litAfter = await scene(page, (s) =>
    s.lighting.lightAt(25 * 16 + 8, 13 * 16 + 8),
  );
  expect(litAfter).toBeLessThan(litBefore);
  // Viga crítica: aviso con Cancelar / Retirar de todos modos.
  await clickWorld(page, 21 * 16 + 8, 14 * 16 + 8);
  await expect.poll(() => scene(page, (s) => s.safety.confirmOpen)).toBe(true);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v5-support-warning.png' });
  await page.keyboard.press('Escape');
  await expect.poll(() => scene(page, (s) => s.safety.confirmOpen)).toBe(false);
  expect(
    await scene(page, (s) => s.session.supports.at(21, 14) !== undefined),
  ).toBe(true);
  await clickWorld(page, 21 * 16 + 8, 14 * 16 + 8);
  await expect.poll(() => scene(page, (s) => s.safety.confirmOpen)).toBe(true);
  await page.keyboard.press('Enter');
  await expect
    .poll(() => scene(page, (s) => s.session.supports.at(21, 14) === undefined))
    .toBe(true);
  // Se recalcula la estabilidad: el techo deja de estar estable.
  expect(
    await scene(page, (s) =>
      s.session.geotech.spans.some(
        (sp) => sp.roof === 12 && sp.state !== 'ESTABLE',
      ),
    ),
  ).toBe(true);
  // Riel ocupado por el carro: no se retira.
  await page.keyboard.press('x');
  await scene(page, (s) => {
    s.miner.body.reset(s.session.cart.x - 20, 148);
  });
  await settle(page);
  await page.keyboard.press('x');
  const cartColumn = await scene(page, (s) =>
    Math.floor(s.session.cart.x / 16),
  );
  await clickWorld(page, cartColumn * 16 + 8, 9 * 16 + 8);
  expect(
    await scene(
      page,
      (s) =>
        s.session.rails.at(Math.floor(s.session.cart.x / 16)) !== undefined,
    ),
  ).toBe(true);
  // Un riel libre sí se retira y vuelve al inventario.
  const before = await scene(page, (s) => ({
    rails: s.session.rails.segments.length,
    stock: s.session.supplies.rail,
  }));
  await clickWorld(page, (cartColumn - 2) * 16 + 8, 9 * 16 + 8);
  await expect
    .poll(() => scene(page, (s) => s.session.rails.segments.length))
    .toBe(before.rails - 1);
  expect(await scene(page, (s) => s.session.supplies.rail)).toBe(
    before.stock + 1,
  );
  // Persistencia tras guardar y recargar.
  await page.keyboard.press('x');
  await page.keyboard.press('g');
  const saved = await scene(page, (s) => ({
    lights: s.session.lights.items.length,
    supports: s.session.supports.items.length,
    rails: s.session.rails.segments.length,
    kit: s.session.kitClaimed,
  }));
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', { timeout: 20_000 });
  const loaded = await scene(page, (s) => ({
    lights: s.session.lights.items.length,
    supports: s.session.supports.items.length,
    rails: s.session.rails.segments.length,
    kit: s.session.kitClaimed,
  }));
  expect(loaded).toEqual(saved);
});
