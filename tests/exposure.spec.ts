import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';

/**
 * Exposición real a la luz: lo que está al aire libre delante de la roca
 * (dintel, techos) no hereda la oscuridad de la ladera; el interior
 * de la montaña sigue oscuro. Incluye capturas de antes y después.
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

/** Recorte del cuadro real (región del mundo) ampliado ×4 a un PNG. */
async function crop(
  page: Page,
  name: string,
  r: { x: number; y: number; w: number; h: number },
) {
  await page.evaluate(
    (r) =>
      new Promise<void>((resolve) => {
        const game = window.__MINA_GAME__;
        const cam = game.scene.getScene('MiningScene').cameras.main;
        game.renderer.snapshot((image) => {
          const img = image as HTMLImageElement;
          const draw = () => {
            const c = document.createElement('canvas');
            c.id = 'exposure-snap';
            c.width = r.w * 4;
            c.height = r.h * 4;
            c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
            const ctx = c.getContext('2d')!;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
              img,
              Math.round(r.x - cam.scrollX),
              Math.round(r.y - cam.scrollY),
              r.w,
              r.h,
              0,
              0,
              c.width,
              c.height,
            );
            document.body.appendChild(c);
            resolve();
          };
          if (img.complete) draw();
          else img.onload = draw;
        });
      }),
    r,
  );
  await page
    .locator('#exposure-snap')
    .screenshot({ path: `docs/screenshots/${name}.png` });
  await page.evaluate(() => document.getElementById('exposure-snap')?.remove());
}

test.use({ viewport: { width: 1000, height: 700 } });

/** Píxeles de prueba (mundo): delante de la ladera y dentro de ella. */
const PROBES = {
  // Dintel de la bocamina delante de la tierra de la columna 19.
  header: { x: 315, y: 100 },
  // Interior de la montaña sin ninguna estructura delante.
  rock: { x: 392, y: 78 },
  // Bodega al sol.
  warehouse: { x: 80, y: 140 },
};
/**
 * ¿Zona a oscuras? Fracción de píxeles cubiertos en un cuadro de 6 × 6 (el
 * ambiente subterráneo mínimo deja un punteado Bayer muy disperso).
 */
const covered = (page: Page) =>
  scene(
    page,
    (s, probes) =>
      Object.fromEntries(
        Object.entries(probes).map(([k, p]) => {
          let n = 0;
          for (let j = -3; j < 3; j++)
            for (let i = -3; i < 3; i++)
              if (s.lighting.darkness.covered(p.x + i, p.y + j)) n++;
          return [k, n / 36 > 0.8];
        }),
      ) as Record<string, boolean>,
    PROBES,
  );

test('estructuras al sol delante de la roca no se oscurecen; la roca sí', async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await settle(page);
  await page.keyboard.press('1');
  await scene(page, (s) => s.miner.body.reset(262, 148));
  await settle(page);
  await page.waitForTimeout(400);
  const region = { x: 228, y: 58, w: 200, h: 112 };
  // Antes: sin exposición, el dintel hereda la oscuridad de la ladera.
  await scene(page, (s) => (s.lighting.surfaceExposure = false));
  await page.waitForTimeout(200);
  const before = await covered(page);
  await crop(page, 'v6-entrance-before', region);
  expect(before.header).toBe(true);
  // Después: corrección activa.
  await scene(page, (s) => (s.lighting.surfaceExposure = true));
  await page.waitForTimeout(200);
  const after = await covered(page);
  await crop(page, 'v6-entrance-after', region);
  expect(after).toEqual({
    header: false,
    rock: true,
    warehouse: false,
  });
  // Con la cámara desplazada y de vuelta, el resultado es el mismo.
  await scene(page, (s) => s.miner.body.reset(700, 148));
  await page.waitForTimeout(500);
  await scene(page, (s) => s.miner.body.reset(262, 148));
  await page.waitForTimeout(500);
  expect(await covered(page)).toEqual(after);
});

test('dentro de la montaña: el casco ilumina, la roca bloquea y nada se revela', async ({
  page,
}) => {
  test.setTimeout(45000);
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await settle(page);
  await page.keyboard.press('1');
  await scene(page, (s) => s.session.buy('kit'));
  // Galería cerrada en la zona reservada; una viga dentro.
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
    s.session.supports.install(s.session.grid, { column: 25, row: 14 }, 'wood');
    s.session.geotech.evaluate();
    s.miner.body.reset(21 * 16 + 8, 14 * 16 + 4);
  });
  await settle(page);
  await page.waitForTimeout(800);
  const r = await scene(page, (s) => {
    const dark = (x: number, y: number) => {
      let n = 0;
      for (let j = -2; j < 2; j++)
        for (let i = -2; i < 2; i++)
          if (s.lighting.darkness.covered(x + i, y + j)) n++;
      return n / 16 > 0.8;
    };
    return {
      nearMiner: dark(s.miner.x + 12, s.miner.y - 6),
      // Viga lejos del casco: dentro de la mina queda oscura (sin sol).
      farBeam: dark(25 * 16 + 2, 14 * 16 + 8),
      // Roca maciza encima de la galería.
      rockAbove: dark(23 * 16 + 8, 11 * 16 + 8),
    };
  });
  expect(r).toEqual({ nearMiner: false, farBeam: true, rockAbove: true });
});
