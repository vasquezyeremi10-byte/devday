import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';

declare global {
  interface Window {
    __MINA_GAME__: Phaser.Game;
  }
}

async function state(page: Page) {
  return page.evaluate(() => {
    const game = window.__MINA_GAME__;
    const scene = game.scene.getScene('MiningScene') as MiningScene;
    return {
      x: scene.miner.x,
      y: scene.miner.y,
      bottom: scene.miner.body.bottom,
      vx: scene.miner.body.velocity.x,
      vy: scene.miner.body.velocity.y,
      grounded: scene.miner.body.blocked.down,
      blockedRight: scene.miner.body.blocked.right,
      scrollX: scene.cameras.main.scrollX,
      scrollY: scene.cameras.main.scrollY,
      count: scene.mining.excavated,
      fps: game.loop.actualFps,
      pointerListeners: scene.input.listenerCount('pointerdown'),
    };
  });
}

async function cell(page: Page, column: number, row: number) {
  return page.evaluate(
    ({ column, row }) => {
      const scene = window.__MINA_GAME__.scene.getScene(
        'MiningScene',
      ) as MiningScene;
      const tile = scene.terrain.layer.getTileAt(column, row);
      return {
        block: scene.mining.grid.get(column, row),
        tile: tile?.index ?? -1,
        collides: tile?.collides ?? false,
      };
    },
    { column, row },
  );
}

async function clickWorld(page: Page, x: number, y: number) {
  const current = await state(page);
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('Canvas ausente');
  await page.mouse.click(
    box.x + ((x - current.scrollX) * box.width) / 480,
    box.y + ((y - current.scrollY) * box.height) / 270,
  );
}

async function centerOnFirstFloorBlock(page: Page) {
  await page.keyboard.down('d');
  // Sin depender de milisegundos: 60 Hz físicos y refresco de pantalla pueden diferir.
  await page.waitForFunction(
    () => {
      const scene = window.__MINA_GAME__.scene.getScene(
        'MiningScene',
      ) as MiningScene;
      return scene.miner.x >= 214;
    },
    undefined,
    { polling: 'raf' },
  );
  await page.keyboard.up('d');
  await expect.poll(async () => (await state(page)).vx).toBe(0);
  expect((await state(page)).x).toBeGreaterThanOrEqual(213);
  expect((await state(page)).x).toBeLessThanOrEqual(219);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await expect.poll(async () => (await state(page)).grounded).toBe(true);
});

test('carga sin errores, pixel art y captura inicial', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const failed: string[] = [];
  page.on('requestfailed', (request) => failed.push(request.url()));
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await expect.poll(async () => (await state(page)).grounded).toBe(true);
  await expect(page.locator('canvas')).toHaveAttribute('width', '480');
  await expect(page.locator('canvas')).toHaveAttribute('height', '270');
  const box = await page.locator('canvas').boundingBox();
  expect(box?.width).toBe(960);
  expect(
    await page
      .locator('canvas')
      .evaluate((canvas) => getComputedStyle(canvas).imageRendering),
  ).toMatch(/pixelated|crisp-edges/);
  await page.screenshot({
    path: 'docs/screenshots/prototype.png',
    fullPage: true,
  });
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/game.png' });
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test('movimiento horizontal, salto, aterrizaje y no salto automático', async ({
  page,
}) => {
  const start = await state(page);
  await page.keyboard.down('d');
  await page.waitForTimeout(400);
  await page.keyboard.up('d');
  expect((await state(page)).x).toBeGreaterThan(start.x + 25);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowLeft');
  expect((await state(page)).x).toBeLessThan(start.x + 10);
  await page.keyboard.down('Space');
  await page.waitForTimeout(150);
  expect((await state(page)).y).toBeLessThan(start.y - 15);
  await expect.poll(async () => (await state(page)).grounded).toBe(true);
  await page.waitForTimeout(400);
  expect((await state(page)).grounded).toBe(true);
  expect((await state(page)).bottom).toBeCloseTo(160, 0);
  await page.keyboard.up('Space');
  // También debe registrarse una pulsación completa entre frames.
  await page.keyboard.press('w');
  await expect
    .poll(async () => (await state(page)).y)
    .toBeLessThan(start.y - 10);
});

test('excavar suelo elimina colisión y permite caer hasta el próximo bloque', async ({
  page,
}) => {
  await centerOnFirstFloorBlock(page);
  const before = await state(page);
  expect(before.x).toBeGreaterThan(213);
  expect(before.x).toBeLessThan(219);
  await clickWorld(page, 216, 168);
  expect(await cell(page, 13, 10)).toEqual({
    block: -1,
    tile: -1,
    collides: false,
  });
  await expect
    .poll(async () => (await state(page)).bottom)
    .toBeGreaterThan(170);
  await expect.poll(async () => (await state(page)).grounded).toBe(true);
  expect((await state(page)).bottom).toBeCloseTo(176, 0);
  expect((await state(page)).count).toBe(1);
});

test('bloque lejano y cielo no se excavan', async ({ page }) => {
  await clickWorld(page, 456, 200);
  expect((await state(page)).count).toBe(0);
  expect((await cell(page, 28, 12)).block).toBe(0);
  await clickWorld(page, 150, 80);
  expect((await state(page)).count).toBe(0);
});

test('pared sólida, cámara y excavación tras desplazar el mundo', async ({
  page,
}) => {
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(2800);
  await page.keyboard.up('ArrowRight');
  const stopped = await state(page);
  expect(stopped.x).toBeCloseTo(411, 0);
  expect(stopped.scrollX).toBeGreaterThan(100);
  expect(stopped.bottom).toBeCloseTo(160, 0);
  await clickWorld(page, 424, 152);
  expect(await cell(page, 26, 9)).toEqual({
    block: -1,
    tile: -1,
    collides: false,
  });
  await clickWorld(page, 424, 136);
  expect(await cell(page, 26, 8)).toEqual({
    block: -1,
    tile: -1,
    collides: false,
  });
  await page.keyboard.down('d');
  await page.waitForTimeout(400);
  await page.keyboard.up('d');
  expect((await state(page)).x).toBeGreaterThan(420);
  expect((await state(page)).x).toBeLessThanOrEqual(427.1);
  expect((await state(page)).count).toBe(2);
  await page.screenshot({
    path: 'docs/screenshots/excavation.png',
    fullPage: true,
  });
});

test('reinicio restaura terreno y evita listeners duplicados', async ({
  page,
}) => {
  await clickWorld(page, 216, 168);
  expect((await state(page)).count).toBe(1);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('r');
    await expect.poll(async () => (await state(page)).count).toBe(0);
    await expect.poll(async () => (await state(page)).grounded).toBe(true);
    expect((await state(page)).x).toBe(208);
    expect((await state(page)).pointerListeners).toBe(1);
    expect((await cell(page, 13, 10)).collides).toBe(true);
    // Cambiar el estado cada vez para verificar un reinicio real, no el anterior.
    await clickWorld(page, 216, 168);
    expect((await state(page)).count).toBe(1);
  }
  await page.getByRole('button', { name: /Reiniciar mina/ }).click();
  await expect.poll(async () => (await state(page)).count).toBe(0);
  expect((await cell(page, 13, 10)).block).toBe(0);
});

test('descenso, cámara vertical y lecho protegido', async ({ page }) => {
  await centerOnFirstFloorBlock(page);
  for (let row = 10; row < 35; row++) {
    await clickWorld(page, 216, row * 16 + 8);
    await expect
      .poll(async () => (await state(page)).bottom)
      .toBeCloseTo((row + 1) * 16, 0);
    await expect.poll(async () => (await state(page)).grounded).toBe(true);
  }
  const bottom = await state(page);
  expect(bottom.count).toBe(25);
  expect(bottom.scrollY).toBeGreaterThan(300);
  expect(bottom.scrollY).toBeLessThanOrEqual(327);
  expect(bottom.bottom - bottom.scrollY).toBeLessThan(249);
  await clickWorld(page, 216, 568);
  expect((await state(page)).count).toBe(25);
  expect(await cell(page, 13, 35)).toEqual({
    block: 2,
    tile: 2,
    collides: true,
  });
  await page.screenshot({ path: 'docs/screenshots/depth.png', fullPage: true });
});

test('escala 1× y ventana estrecha sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 640 });
  await expect
    .poll(async () => (await page.locator('canvas').boundingBox())?.width)
    .toBe(480);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/logical-resolution.png' });
  await page.setViewportSize({ width: 390, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: 'docs/screenshots/narrow.png',
    fullPage: true,
  });
});

test('muestreo de rendimiento local', async ({ page }, testInfo) => {
  const sample = await page.evaluate(async () => {
    const times: number[] = [];
    let previous = performance.now();
    for (let i = 0; i < 120; i++) {
      const now = await new Promise<number>((resolve) =>
        requestAnimationFrame(resolve),
      );
      times.push(now - previous);
      previous = now;
    }
    return {
      frames: times.length,
      elapsedMs: times.reduce((sum, time) => sum + time, 0),
      meanFps:
        1000 / (times.reduce((sum, time) => sum + time, 0) / times.length),
    };
  });
  await testInfo.attach('frame-sample', {
    body: JSON.stringify(sample),
    contentType: 'application/json',
  });
  expect(sample.meanFps).toBeGreaterThan(20);
});
