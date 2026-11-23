import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import { MENU_LAYOUT, MENU_MAX_SCALE } from '../src/game/config/menu';
import type { MiningScene } from '../src/game/scenes/MiningScene';

/** Menú principal: navegación, guardado, ajustes y adaptación a la ventana. */
declare global {
  interface Window {
    __MINA_GAME__: Phaser.Game;
  }
}

/** Lo que las pruebas leen de MenuScene (miembros privados del juego). */
interface MenuProbe {
  busy: boolean;
  current: string;
  summary: { state: string; mineName?: string };
  settings: { muted: boolean; effects: boolean };
  ambience: unknown;
  title: { shine: { graphics: { visible: boolean } } };
  pages: Record<
    string,
    { focus: number; buttons: { isEnabled: boolean; w: number }[] }
  >;
  info: { main: { text: string } }[];
}

const MENU = '/?menu=on';
const menu = <T>(page: Page, fn: (s: MenuProbe) => T) =>
  page.evaluate(
    ({ source }) => {
      const s = window.__MINA_GAME__.scene.getScene('MenuScene');
      return new Function('s', `return (${source})(s);`)(s);
    },
    { source: fn.toString() },
  ) as Promise<T>;

async function openMenu(page: Page, url = MENU) {
  await page.goto(url);
  await expect
    .poll(() => menu(page, (s) => s.busy === false && !!s.pages.main))
    .toBe(true);
}

/** Clic en coordenadas nativas del juego (480 × 270) sobre el lienzo. */
async function clickGame(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  const zoom = box.width / 480;
  await page.mouse.click(box.x + x * zoom, box.y + y * zoom);
}
const buttonCenter = (i: number) => {
  const m = MENU_LAYOUT.main;
  return [m.x + m.w / 2, m.y + i * m.pitch + m.h / 2] as const;
};
const miningScene = (page: Page) =>
  page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    return {
      active: window.__MINA_GAME__.scene.isActive('MiningScene'),
      modeOpen: s.safety?.modeOpen ?? false,
      modeChosen: s.session?.modeChosen ?? false,
      mineName: s.session?.mineName ?? '',
    };
  });

/** Crea una partida guardada jugando: Nueva partida, nombre y modo Normal. */
async function createSavedGame(page: Page, name: string) {
  await openMenu(page);
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await miningScene(page)).modeOpen, { timeout: 20_000 })
    .toBe(true);
  await page.keyboard.type(name);
  await page.keyboard.press('1');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('mina-cero.save.v6')))
    .not.toBeNull();
}

test('el menú muestra los cuatro botones y oculta el marco de la página', async ({
  page,
}) => {
  await openMenu(page);
  await expect(page.locator('body')).toHaveClass(/in-menu/);
  await expect(page.locator('.masthead')).toBeHidden();
  const buttons = await menu(page, (s) => s.pages.main!.buttons.length);
  expect(buttons).toBe(4);
  // Sin partida guardada, Continuar está desactivado y el foco cae en Nueva partida.
  expect(await menu(page, (s) => s.pages.main!.buttons[1]!.isEnabled)).toBe(
    false,
  );
  expect(await menu(page, (s) => s.pages.main!.focus)).toBe(0);
  expect(await menu(page, (s) => s.summary.state)).toBe('none');
});

test('el teclado navega saltando los botones desactivados', async ({
  page,
}) => {
  await openMenu(page);
  await page.keyboard.press('ArrowDown');
  expect(await menu(page, (s) => s.pages.main!.focus)).toBe(2);
  await page.keyboard.press('KeyS');
  expect(await menu(page, (s) => s.pages.main!.focus)).toBe(3);
  await page.keyboard.press('ArrowDown');
  expect(await menu(page, (s) => s.pages.main!.focus)).toBe(0);
  await page.keyboard.press('ArrowUp');
  expect(await menu(page, (s) => s.pages.main!.focus)).toBe(3);
});

test('el cursor selecciona al pasar y activa con clic', async ({ page }) => {
  await openMenu(page);
  const [x, y] = buttonCenter(3);
  const box = (await page.locator('canvas').boundingBox())!;
  const zoom = box.width / 480;
  await page.mouse.move(box.x + x * zoom, box.y + y * zoom);
  await expect.poll(() => menu(page, (s) => s.pages.main!.focus)).toBe(3);
  await clickGame(page, x, y);
  await expect.poll(() => menu(page, (s) => s.current)).toBe('exitConfirm');
});

test('Configuración alterna el sonido y lo recuerda', async ({ page }) => {
  await openMenu(page);
  await page.keyboard.press('ArrowDown'); // Configuración (Continuar está desactivado)
  await page.keyboard.press('Enter');
  expect(await menu(page, (s) => s.current)).toBe('settings');
  await page.keyboard.press('Enter'); // SONIDO
  expect(await menu(page, (s) => s.settings.muted)).toBe(true);
  expect(await page.evaluate(() => window.__MINA_GAME__.sound.mute)).toBe(true);
  expect(
    JSON.parse(
      (await page.evaluate(() => localStorage.getItem('mina-cero.menu')))!,
    ),
  ).toMatchObject({ muted: true });
  await page.keyboard.press('Escape');
  expect(await menu(page, (s) => s.current)).toBe('main');
  // Recordado al recargar.
  await openMenu(page);
  expect(await menu(page, (s) => s.settings.muted)).toBe(true);
});

test('los efectos ambientales se pueden reducir', async ({ page }) => {
  await openMenu(page);
  expect(await menu(page, (s) => s.ambience !== null)).toBe(true);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown'); // EFECTOS AMBIENTALES
  await page.keyboard.press('Enter');
  expect(await menu(page, (s) => s.settings.effects)).toBe(false);
});

test('prefers-reduced-motion arranca sin efectos animados', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openMenu(page);
  expect(await menu(page, (s) => s.settings.effects)).toBe(false);
  expect(await menu(page, (s) => s.ambience)).toBeNull();
  expect(await menu(page, (s) => s.title.shine.graphics.visible)).toBe(false);
});

test('Nueva partida entra a la mina sin el marco de la página', async ({
  page,
}) => {
  await openMenu(page);
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await miningScene(page)).modeOpen, { timeout: 20_000 })
    .toBe(true);
  await expect(page.locator('body')).not.toHaveClass(/in-menu/);
  // Modo inmersivo: la partida muestra solo el lienzo (ver immersive.spec.ts).
  await expect(page.locator('body')).toHaveClass(/immersive/);
  await expect(page.locator('.masthead')).toBeHidden();
  expect(
    await page.evaluate(() => window.__MINA_GAME__.scene.isActive('MenuScene')),
  ).toBe(false);
});

test('Continuar recupera la partida guardada con su nombre', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await createSavedGame(page, 'cobre');
  await openMenu(page);
  expect(await menu(page, (s) => s.summary.state)).toBe('ok');
  expect(await menu(page, (s) => s.summary.mineName)).toBe('COBRE');
  expect(await menu(page, (s) => s.pages.main!.buttons[1]!.isEnabled)).toBe(
    true,
  );
  // El foco inicial es Continuar.
  expect(await menu(page, (s) => s.pages.main!.focus)).toBe(1);
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await miningScene(page)).modeChosen, { timeout: 20_000 })
    .toBe(true);
  const game = await miningScene(page);
  expect(game.modeChosen).toBe(true);
  expect(game.modeOpen).toBe(false);
  expect(game.mineName).toBe('COBRE');
});

test('Nueva partida con guardado pide confirmación y respalda la actual', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await createSavedGame(page, 'norte');
  await openMenu(page);
  await page.keyboard.press('ArrowUp'); // Nueva partida
  await page.keyboard.press('Enter');
  expect(await menu(page, (s) => s.current)).toBe('newConfirm');
  // Cancelar no toca nada.
  await page.keyboard.press('Escape');
  expect(await menu(page, (s) => s.current)).toBe('main');
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((k) => k.includes('.archive.')).length,
    ),
  ).toBe(0);
  // Confirmar: copia de respaldo y mina nueva (pantalla de nombre y modo).
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await miningScene(page)).modeOpen, { timeout: 20_000 })
    .toBe(true);
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.filter((k) => k.includes('.archive.'))).toHaveLength(1);
  // La partida anterior sigue en su sitio hasta que se elija el modo de la nueva.
  expect(keys).toContain('mina-cero.save.v6');
});

test('un guardado ilegible desactiva Continuar y se respalda al empezar', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('mina-cero.save.v6'))
      localStorage.setItem('mina-cero.save.v6', '{"version":6,"seed":"x"}');
  });
  await openMenu(page);
  expect(await menu(page, (s) => s.summary.state)).toBe('corrupt');
  expect(await menu(page, (s) => s.pages.main!.buttons[1]!.isEnabled)).toBe(
    false,
  );
  await page.keyboard.press('Enter'); // Nueva partida
  expect(await menu(page, (s) => s.current)).toBe('newConfirm');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await miningScene(page)).modeOpen, { timeout: 20_000 })
    .toBe(true);
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((k) => k.includes('.archive.')).length,
    ),
  ).toBe(1);
});

test('Salir pide confirmación y avisa si el navegador no cierra la pestaña', async ({
  page,
}) => {
  await openMenu(page);
  await page.keyboard.press('ArrowUp'); // Salir (envuelve desde Nueva partida)
  expect(await menu(page, (s) => s.pages.main!.focus)).toBe(3);
  await page.keyboard.press('Enter');
  expect(await menu(page, (s) => s.current)).toBe('exitConfirm');
  await page.keyboard.press('Escape');
  expect(await menu(page, (s) => s.current)).toBe('main');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => menu(page, (s) => s.current)).toBe('exitInfo');
});

test('el lienzo se adapta a la ventana con escala entera y centrado', async ({
  page,
}) => {
  await openMenu(page);
  for (const [width, height, zoom] of [
    [1920, 1080, 4],
    [1280, 800, 2],
    [1366, 600, 2],
    [800, 600, 1],
    [3840, 2160, MENU_MAX_SCALE],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(async () => (await page.locator('canvas').boundingBox())?.width)
      .toBe(480 * zoom);
    const box = (await page.locator('canvas').boundingBox())!;
    expect(box.height).toBe(270 * zoom);
    // Centrado horizontal y vertical.
    expect(Math.abs(box.x - (width - box.x - box.width))).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(box.y - (height - box.y - box.height))).toBeLessThanOrEqual(
      1,
    );
  }
});

test('en una ventana más estrecha que 480 px conserva 1× y se desplaza', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openMenu(page);
  const box = (await page.locator('canvas').boundingBox())!;
  expect(box.width).toBe(480);
  const scrolls = await page.evaluate(() => {
    const el = document.querySelector('.game-viewport')!;
    return el.scrollWidth > el.clientWidth;
  });
  expect(scrolls).toBe(true);
});
