import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import { GAME_MAX_SCALE } from '../src/game/config/menu';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import { integerZoom } from '../src/game/systems/IntegerZoom';

/** Partida a ventana completa, F11, pantalla completa y menú de pausa. */
declare global {
  interface Window {
    __MINA_GAME__: Phaser.Game;
  }
}

// Pantalla más grande que la ventana: así la ventana no parece la pantalla
// completa del navegador (en headless la pantalla mide lo mismo que la vista).
test.use({ viewport: { width: 1280, height: 720 }, screen: { width: 1920, height: 1080 } });

const SAVE = 'mina-cero.save.v6';

const game = <T>(page: Page, fn: (g: Phaser.Game) => T) =>
  page.evaluate(
    ({ source }) => new Function('g', `return (${source})(g);`)(window.__MINA_GAME__),
    { source: fn.toString() },
  ) as Promise<T>;

const mining = (page: Page) =>
  page.evaluate(() => {
    const g = window.__MINA_GAME__;
    const s = g.scene.getScene('MiningScene') as MiningScene;
    return {
      active: g.scene.isActive('MiningScene'),
      paused: g.scene.isPaused('MiningScene'),
      pause: g.scene.isActive('PauseScene'),
      menu: g.scene.isActive('MenuScene'),
      x: Math.round(s.miner?.x ?? 0),
      clock: (s.session as unknown as { clock?: { elapsed?: number } })?.clock?.elapsed ?? null,
      inventory: (s as unknown as { inventory?: { open: boolean } }).inventory?.open ?? false,
    };
  });

/** Menú → Nueva partida → nombre → Normal: queda la mina lista para jugar. */
async function newGame(page: Page) {
  await page.goto('/?menu=on&splash=off');
  await expect
    .poll(() =>
      game(page, (g) => {
        const m = g.scene.getScene('MenuScene') as unknown as { busy: boolean; pages?: object };
        return g.scene.isActive('MenuScene') && m.busy === false && !!m.pages;
      }),
    )
    .toBe(true);
  await page.keyboard.press('Enter');
  await expect
    .poll(
      () =>
        game(page, (g) => {
          const s = g.scene.getScene('MiningScene') as unknown as { safety?: { modeOpen: boolean } };
          return s.safety?.modeOpen ?? false;
        }),
      { timeout: 20_000 },
    )
    .toBe(true);
  await page.keyboard.type('PRUEBA');
  await page.keyboard.press('1');
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), SAVE)).not.toBeNull();
}

/** Tamaño y posición del lienzo frente a la ventana. */
const layout = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector('#game canvas')!.getBoundingClientRect();
    const doc = document.documentElement;
    return {
      zoom: window.__MINA_GAME__.scale.zoom,
      x: c.x,
      y: c.y,
      w: c.width,
      h: c.height,
      vw: window.innerWidth,
      vh: window.innerHeight,
      scrollW: doc.scrollWidth,
      scrollH: doc.scrollHeight,
      bg: getComputedStyle(document.body).backgroundColor,
      chrome: ['.masthead', '.expedition', '.game-caption', '.page-footer', '#restart'].filter(
        (s) => document.querySelector(s)!.getBoundingClientRect().height > 0,
      ),
    };
  });

function expectFilled(l: Awaited<ReturnType<typeof layout>>) {
  expect(l.zoom).toBe(integerZoom(l.vw, l.vh, GAME_MAX_SCALE, 1, 1));
  expect(Number.isInteger(l.zoom)).toBe(true);
  expect([l.w, l.h]).toEqual([480 * l.zoom, 270 * l.zoom]);
  // Centrado: bandas iguales a cada lado (±1 px).
  expect(Math.abs(l.x - (l.vw - l.x - l.w))).toBeLessThanOrEqual(1);
  expect(Math.abs(l.y - (l.vh - l.y - l.h))).toBeLessThanOrEqual(1);
  // Sin desplazamiento de página ni interfaz web alrededor.
  expect(l.scrollW).toBeLessThanOrEqual(l.vw);
  expect(l.scrollH).toBeLessThanOrEqual(l.vh);
  expect(l.chrome).toEqual([]);
  expect(l.bg).toBe('rgb(0, 0, 0)');
}

test('la partida ocupa la ventana sin página web y se adapta al redimensionar', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await newGame(page);
  expectFilled(await layout(page));
  await page.locator('#game canvas').screenshot({ path: 'docs/screenshots/immersive-game.png' });
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [1000, 900],
    [800, 600],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => layout(page).then((l) => l.vw)).toBe(width);
    await expect
      .poll(() => layout(page).then((l) => l.zoom))
      .toBe(integerZoom(width, height, GAME_MAX_SCALE, 1, 1));
    expectFilled(await layout(page));
    // La cámara y el HUD siguen en la resolución lógica 480 × 270.
    expect(
      await game(page, (g) => {
        const cam = g.scene.getScene('MiningScene').cameras.main;
        return [cam.width, cam.height];
      }),
    ).toEqual([480, 270]);
  }
});

test('F11 entra y sale de pantalla completa sin reiniciar la partida', async ({ page }) => {
  test.setTimeout(60_000);
  await newGame(page);
  await page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as unknown as { session: object };
    Object.assign(window, { __session: s.session });
  });
  await page.keyboard.press('F11');
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  expectFilled(await layout(page));
  await page.keyboard.press('F11');
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  expectFilled(await layout(page));
  // Misma sesión y misma escena: no se recargó ni se reinició nada.
  expect(
    await page.evaluate(() => {
      const s = window.__MINA_GAME__.scene.getScene('MiningScene') as unknown as { session: object };
      return s.session === (window as unknown as { __session: object }).__session;
    }),
  ).toBe(true);
  expect((await mining(page)).active).toBe(true);
});

test('pausa: Esc abre y cierra, congela la mina, guarda, vuelve al menú y se continúa', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await newGame(page);
  // Esc con el inventario abierto solo lo cierra (no pausa).
  await page.keyboard.press('Tab');
  await expect.poll(() => mining(page).then((m) => m.inventory)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => mining(page).then((m) => m.inventory)).toBe(false);
  expect((await mining(page)).pause).toBe(false);

  await page.keyboard.press('Escape');
  await expect.poll(() => mining(page).then((m) => m.pause)).toBe(true);
  expect((await mining(page)).paused).toBe(true);
  await page.locator('#game canvas').screenshot({ path: 'docs/screenshots/pause-menu.png' });
  // Las teclas de juego no llegan a la mina mientras está en pausa.
  const x = (await mining(page)).x;
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyD');
  expect((await mining(page)).x).toBe(x);
  // Reanudar con Esc: el minero no queda caminando solo.
  await page.keyboard.press('Escape');
  await expect.poll(() => mining(page).then((m) => m.paused)).toBe(false);
  await page.waitForTimeout(300);
  expect((await mining(page)).x).toBe(x);

  // Configuración de la pausa: pantalla completa desde la opción.
  await page.keyboard.press('Escape');
  await expect.poll(() => mining(page).then((m) => m.pause)).toBe(true);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await page.keyboard.press('Escape');

  // Guardar: el guardado cambia y se avisa.
  await page.evaluate((k) => localStorage.removeItem(k), SAVE);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), SAVE)).not.toBeNull();
  const saved = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SAVE))!);
  expect(saved).toBeTruthy();

  // Menú principal y luego Continuar: misma posición.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => mining(page).then((m) => m.menu), { timeout: 10_000 }).toBe(true);
  await expect(page.locator('body')).toHaveClass(/in-menu/);
  await expect
    .poll(() =>
      game(page, (g) => (g.scene.getScene('MenuScene') as unknown as { busy: boolean }).busy),
    )
    .toBe(false);
  await page.keyboard.press('Enter');
  await expect.poll(() => mining(page).then((m) => m.active), { timeout: 20_000 }).toBe(true);
  await expect.poll(() => mining(page).then((m) => m.x)).toBe(x);
  expectFilled(await layout(page));
});
