import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';

/**
 * Corrección visual (11 de noviembre de 2026). Los «rectángulos verdes con
 * diagonal» son la textura de reemplazo `__MISSING` de Phaser: aparecen
 * cuando un PNG no llega (servidor reiniciado o caído durante la carga) y la
 * escena construye igual el mundo. Estas pruebas comprueban que una carga
 * sana no deja ningún objeto con esa textura, que la depuración de físicas
 * está apagada y que un recurso que falla se reintenta o se informa, nunca
 * se dibuja como cuadro verde.
 */
declare global {
  interface Window {
    __MINA_GAME__: Phaser.Game;
  }
}

/** Objetos de la escena de la mina dibujados con la textura de reemplazo. */
const missingTextures = (page: Page) =>
  page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene');
    const found: string[] = [];
    const visit = (list: Phaser.GameObjects.GameObject[]) => {
      for (const o of list) {
        const t = (o as Phaser.GameObjects.Image).texture;
        if (t && (t.key === '__MISSING' || t.key === '__DEFAULT'))
          found.push(`${o.type}:${t.key}`);
        const inner = (o as Phaser.GameObjects.Container).list;
        if (Array.isArray(inner)) visit(inner);
      }
    };
    visit(s.children.list);
    return found;
  });

test('una carga sana no deja texturas de reemplazo ni depuración de físicas', async ({
  page,
}) => {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error')
      problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  for (const world of ['1', '2']) {
    await page.goto(`/?menu=off&world=${world}`);
    await expect(page.locator('#game-status')).toContainText('Mina lista', {
      timeout: 20_000,
    });
    expect(await missingTextures(page)).toEqual([]);
    const debug = await page.evaluate(() => {
      const s = window.__MINA_GAME__.scene.getScene('MiningScene');
      const w = s.physics.world;
      return { draw: w.drawDebug, bodies: w.bodies.size + w.staticBodies.size };
    });
    // La depuración visual está apagada, pero las colisiones siguen ahí.
    expect(debug.draw).toBe(false);
    expect(debug.bodies).toBeGreaterThan(0);
  }
  // Con DPR 1 el lienzo sigue en múltiplos enteros de 480 × 270.
  const size = await page
    .locator('#game canvas')
    .evaluate((c) => c.getBoundingClientRect().width);
  expect(Number.isInteger(size / 480)).toBe(true);
  expect(problems).toEqual([]);
});

test('si un PNG no llega, se reintenta en vez de pintar cuadros verdes', async ({
  page,
}) => {
  let failures = 1;
  await page.route('**/assets/structures/props.png', (route) =>
    failures-- > 0 ? route.abort('connectionrefused') : route.continue(),
  );
  await page.goto('/?menu=off');
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  expect(failures).toBeLessThan(0);
  expect(await missingTextures(page)).toEqual([]);
});

test('si un PNG nunca llega, avisa del recurso y no construye el mundo', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.route('**/assets/structures/props.png', (route) =>
    route.abort('connectionrefused'),
  );
  await page.goto('/?menu=off');
  await expect(page.locator('#game-status')).toContainText(
    'No se pudieron cargar',
    { timeout: 20_000 },
  );
  expect(errors.some((e) => e.includes('Recursos sin cargar: props'))).toBe(
    true,
  );
  expect(await missingTextures(page)).toEqual([]);
});
