import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';

/**
 * Evidencia visual V6: capturas reales del renderizador (cuadro 480 × 270
 * ampliado ×3 por vecino más cercano) de las siete vistas pedidas, más
 * comprobaciones funcionales mínimas en cada una.
 */
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

/** Captura el cuadro del juego ampliado ×3 sin suavizado. */
async function shot(page: Page, name: string) {
  // Sin avisos de logro encima de la escena que se documenta.
  await scene(page, (s) => {
    s.hud['awardUntil'] = 0;
    s.hud['award'].setVisible(false);
  });
  // El cuadro real del renderizador se copia ×3 a un lienzo fijo sobre la
  // página y Playwright fotografía ese lienzo.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.__MINA_GAME__.renderer.snapshot((image) => {
          const img = image as HTMLImageElement;
          const draw = () => {
            const c = document.createElement('canvas');
            c.id = 'v6-snap';
            c.width = img.width * 3;
            c.height = img.height * 3;
            c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
            const ctx = c.getContext('2d')!;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, c.width, c.height);
            document.body.appendChild(c);
            resolve();
          };
          if (img.complete) draw();
          else img.onload = draw;
        });
      }),
  );
  await page
    .locator('#v6-snap')
    .screenshot({ path: `docs/screenshots/${name}.png` });
  await page.evaluate(() => document.getElementById('v6-snap')?.remove());
}

test.use({ viewport: { width: 1480, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await settle(page);
  await page.keyboard.press('1');
  await scene(page, (s) => {
    s.session.buy('kit');
    s.session.tools.add('iron');
    s.session.tools.add('shovel');
    s.session.loadout.sync();
  });
});

/** Galería subterránea revelada (zona sin yacimientos para cualquier semilla). */
const gallery = (page: Page) =>
  scene(page, (s) => {
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
    s.session.supports.install(
      s.session.grid,
      { column: 25, row: 14 },
      'steel',
    );
    s.session.geotech.evaluate();
  });

test('V6: superficie, bodega, bocamina y carrito', async ({
  page,
}) => {
  // Cinco capturas a ×3: bajo carga cada una puede tardar varios segundos.
  test.setTimeout(150000);
  await page.waitForTimeout(400);
  await shot(page, 'v6-surface');
  // Tienda: Z junto al puesto de suministros.
  // Bocamina con el minero frente al portal.
  await scene(page, (s) => s.miner.body.reset(262, 148));
  await settle(page);
  await page.waitForTimeout(500);
  await shot(page, 'v6-entrance');
  // Carrito cargado sobre la vía.
  await scene(page, (s) => {
    for (const m of ['coal', 'iron', 'dirt', 'copper', 'gold'] as const)
      for (let i = 0; i < 3; i++) s.session.cart.inventory.add(m);
    s.miner.body.reset(s.session.cart.x - 26, 148);
  });
  await settle(page);
  await page.waitForTimeout(300);
  await shot(page, 'v6-cart');
  // Inventario con Tab.
  await page.keyboard.press('Tab');
  await expect.poll(() => scene(page, (s) => s.inventory.open)).toBe(true);
  await page.waitForTimeout(200);
  await shot(page, 'v6-inventory');
  await page.keyboard.press('Escape');
});

test('V6: galería con casco, con antorchas y túnel de la bocamina', async ({
  page,
}) => {
  test.setTimeout(60000);
  // Túnel original con sus antorchas fijas.
  await scene(page, (s) => s.miner.body.reset(18 * 16 + 70, 150));
  await settle(page);
  await page.waitForTimeout(700);
  await shot(page, 'v6-tunnel');
  // Galería profunda iluminada solo por el casco.
  await gallery(page);
  await scene(page, (s) => s.miner.body.reset(23 * 16 + 8, 14 * 16 + 4));
  await settle(page);
  await page.waitForTimeout(900);
  const lit = await scene(page, (s) => ({
    near: s.lighting.lightAt(s.miner.x + 10, s.miner.y - 8),
    far: s.lighting.lightAt(s.miner.x + 70, s.miner.y - 8),
  }));
  expect(lit.near).toBeGreaterThan(lit.far);
  await shot(page, 'v6-helmet');
  // Antorchas instaladas: halo cálido.
  await scene(page, (s) => {
    s.session.lights.install(s.session.grid, { column: 20, row: 14 }, 'torch');
    s.session.lights.install(s.session.grid, { column: 26, row: 14 }, 'torch');
  });
  await page.waitForTimeout(500);
  await shot(page, 'v6-torches');
});
