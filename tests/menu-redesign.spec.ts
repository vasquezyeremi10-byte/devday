import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import { MENU_FX, MENU_LAYOUT } from '../src/game/config/menu';

/** Rediseño del menú: título, botones, ambiente, sonido y transiciones. */
declare global {
  interface Window {
    __MINA_GAME__: Phaser.Game;
  }
}

test.use({ viewport: { width: 1280, height: 800 }, screen: { width: 1920, height: 1080 } });

const MAIN = MENU_LAYOUT.main;

/** Evalúa una función sobre MenuScene (miembros privados incluidos). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const menu = <T>(page: Page, fn: (s: any) => T) =>
  page.evaluate(
    ({ source }) =>
      new Function('s', `return (${source})(s);`)(
        window.__MINA_GAME__.scene.getScene('MenuScene'),
      ),
    { source: fn.toString() },
  ) as Promise<T>;

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function openMenu(page: Page) {
  await page.goto('/?menu=on&splash=off');
  await expect
    .poll(() => menu(page, (s) => s.sys.isActive() && s.busy === false), { timeout: 20_000 })
    .toBe(true);
}

/** Centro de un botón principal en píxeles de la página. */
async function buttonPoint(page: Page, i: number) {
  const box = (await page.locator('#game canvas').boundingBox())!;
  const z = box.width / 480;
  return {
    x: box.x + (MAIN.x + MAIN.w / 2) * z,
    y: box.y + (MAIN.y + i * MAIN.pitch + MAIN.h / 2) * z,
  };
}

test('título: revela las tres líneas del logotipo y escribe el subtítulo', async ({
  page,
}, testInfo) => {
  const errors = watchErrors(page);
  await page.goto('/?menu=on&splash=off');
  await expect
    .poll(() => menu(page, (s) => !!s.title), { timeout: 20_000 })
    .toBe(true);
  // Durante la aparición hay líneas aún ocultas o el subtítulo incompleto.
  const early = await menu(page, (s) => ({
    lines: s.title.lines.filter((l: { visible: boolean }) => l.visible).length,
    subtitle: s.title.subtitle.text,
  }));
  expect(early.lines < 3 || early.subtitle.length < MENU_FX.subtitle.length).toBe(true);
  await expect.poll(() => menu(page, (s) => s.title.revealed), { timeout: 10_000 }).toBe(true);
  const done = await menu(page, (s) => ({
    lines: s.title.lines.map((l: Phaser.GameObjects.Image) => ({
      texture: l.texture.key,
      y: l.y,
      height: l.height,
      visible: l.visible,
    })),
    subtitle: s.title.subtitle.text,
    subtitleTop: s.title.subtitle.y,
    subtitleBottom: s.title.subtitle.y + s.title.subtitle.height,
  }));
  expect(done.lines).toHaveLength(3);
  for (const line of done.lines) {
    expect(line.texture).toBe('menu-title-veta');
    expect(line.visible).toBe(true);
  }
  expect(done.lines[0].y).toBe(MENU_FX.titleY);
  expect(done.lines[1].height).toBeGreaterThan(done.lines[0].height);
  expect(done.lines[1].height).toBeGreaterThan(done.lines[2].height);
  expect(done.lines[2].y + done.lines[2].height).toBeLessThan(done.subtitleTop);
  expect(done.subtitleBottom).toBeLessThan(MAIN.y);
  expect(done.subtitle).toBe('PARA SALVAR SU AMOR, DEBERÁ OLVIDARLO.');
  await expect(page).toHaveTitle('Hasta que la veta nos separe');
  await page.locator('#game canvas').screenshot({ path: testInfo.outputPath('menu-veta.png') });
  await page.setViewportSize({ width: 1536, height: 960 });
  await expect.poll(() => menu(page, (s) => {
    const glow = s.title.shine.graphics;
    return glow.visible && glow.commandBuffer.length > 0;
  }), { timeout: 7000 }).toBe(true);
  await page.locator('#game canvas').screenshot({ path: testInfo.outputPath('menu-veta-destello.png') });
  expect(errors).toEqual([]);
});

test('botones alineados; teclado y ratón navegan con sonido y descripción contextual', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await openMenu(page);
  const layout = await menu(page, (s) =>
    s.pages.main.buttons.map((b: { container: { y: number }; w: number; h: number }) => [
      b.container.y,
      b.w,
      b.h,
    ]),
  );
  layout.forEach(([y, w, h]: number[], i: number) => {
    expect(y).toBe(MAIN.y + i * MAIN.pitch);
    expect([w, h]).toEqual([MAIN.w, MAIN.h]);
  });
  // Sin navegar no hay texto permanente bajo los botones.
  expect(await menu(page, (s) => s.tip.some((o: { visible: boolean }) => o.visible))).toBe(false);
  // Teclado: baja (salta Continuar desactivado), suena el tic y aparece la descripción.
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => menu(page, (s) => s.pages.main.focus)).toBe(2);
  expect(await menu(page, (s) => s.lastSound.has('sfx-ui-move'))).toBe(true);
  await expect
    .poll(() => menu(page, (s) => s.tip.every((o: { visible: boolean }) => o.visible)))
    .toBe(true);
  expect(await menu(page, (s) => s.info[0].objects[1].text)).toBe('CONFIGURACIÓN');
  await page.locator('#game canvas').screenshot({ path: 'docs/screenshots/menu-redesign-focus.png' });
  // La descripción se oculta sola.
  await expect
    .poll(() => menu(page, (s) => s.tip.some((o: { visible: boolean }) => o.visible)), {
      timeout: MENU_FX.tipMs + 3000,
    })
    .toBe(false);
  // Ratón: pasar sobre SALIR lo selecciona.
  const exit = await buttonPoint(page, 3);
  await page.mouse.move(exit.x, exit.y);
  await expect.poll(() => menu(page, (s) => s.pages.main.focus)).toBe(3);
  // Profundidad: el puntero corre las capas cercanas del ambiente unos px.
  await page.mouse.move(5, 5);
  await expect
    .poll(() => menu(page, (s) => [s.ambience.fx.x, s.ambience.fx.y].join(',')), { timeout: 5000 })
    .not.toBe('0,0');
  expect(errors).toEqual([]);
});

test('ambiente animado: cristales, portal y motas cambian con el tiempo', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await openMenu(page);
  const sample = () =>
    menu(page, (s) => ({
      crystals: s.ambience.crystalGlows.map((c: { image: { texture: { key: string } } }) => c.image.texture.key).join(),
      tunnel: s.ambience.tunnel.texture.key,
      motes: s.ambience.motes.map((m: { age: number }) => Math.round(m.age)).join(),
    }));
  const a = await sample();
  const tunnel = new Set([a.tunnel]);
  let b = a;
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(700);
    b = await sample();
    tunnel.add(b.tunnel);
  }
  expect(b.crystals).not.toBe(a.crystals);
  // El túnel respira entre varias densidades.
  expect(tunnel.size).toBeGreaterThan(1);
  expect(b.motes).not.toBe(a.motes);
  // FPS razonables con todo el ambiente activo (headless, sin GPU dedicada).
  expect(await page.evaluate(() => window.__MINA_GAME__.loop.actualFps)).toBeGreaterThan(30);
  expect(errors).toEqual([]);
});

test('Configuración abre y cierra; Salir pide confirmación y avisa', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => menu(page, (s) => s.current)).toBe('settings');
  expect(await menu(page, (s) => s.lastSound.has('sfx-ui-confirm'))).toBe(true);
  await page.locator('#game canvas').screenshot({ path: 'docs/screenshots/menu-redesign-settings.png' });
  await page.keyboard.press('Escape');
  await expect.poll(() => menu(page, (s) => s.current)).toBe('main');
  expect(await menu(page, (s) => s.lastSound.has('sfx-ui-back'))).toBe(true);
  // Salir: confirmación integrada, y como la pestaña no se cierra, el aviso breve.
  const exit = await buttonPoint(page, 3);
  await page.mouse.click(exit.x, exit.y);
  await expect.poll(() => menu(page, (s) => s.current)).toBe('exitConfirm');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => menu(page, (s) => s.current), { timeout: 5000 }).toBe('exitInfo');
  await page.keyboard.press('Enter');
  await expect.poll(() => menu(page, (s) => s.current)).toBe('main');
  expect(errors).toEqual([]);
});

test('Nueva partida y Continuar: fundido a negro y partida a ventana completa', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await openMenu(page);
  // Música y viento de fondo suenan bajo el menú.
  await expect
    .poll(() => menu(page, (s) => s.music?.isPlaying ?? false), { timeout: 10_000 })
    .toBe(true);
  await expect
    .poll(() => menu(page, (s) => Math.round((s.ambientLoop?.volume ?? 0) * 100)), {
      timeout: 5000,
    })
    .toBe(Math.round(MENU_FX.ambience.volume * 100));
  await page.keyboard.press('Enter');
  // El fundido tramado cubre el menú antes de cambiar de escena.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const g = window.__MINA_GAME__;
        return g.scene.isActive('MiningScene') ? 'mina' : 'menu';
      }),
    )
    .toBe('menu');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const s = window.__MINA_GAME__.scene.getScene('MiningScene') as unknown as {
            safety?: { modeOpen: boolean };
          };
          return s.safety?.modeOpen ?? false;
        }),
      { timeout: 20_000 },
    )
    .toBe(true);
  await expect(page.locator('body')).toHaveClass(/immersive/);
  await expect(page.locator('body')).not.toHaveClass(/in-menu/);
  await page.keyboard.type('REDISENO');
  await page.keyboard.press('1');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('mina-cero.save.v6')))
    .not.toBeNull();
  // Volver al menú (pausa) y Continuar recupera la mina guardada.
  await page.keyboard.press('Escape');
  await expect
    .poll(() => page.evaluate(() => window.__MINA_GAME__.scene.isActive('PauseScene')))
    .toBe(true);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect.poll(() => menu(page, (s) => s.sys.isActive() && !s.busy), { timeout: 10_000 }).toBe(true);
  expect(await menu(page, (s) => s.pages.main.focus)).toBe(1);
  await page.keyboard.press('Enter');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const s = window.__MINA_GAME__.scene.getScene('MiningScene') as unknown as {
            session?: { mineName: string };
          };
          return window.__MINA_GAME__.scene.isActive('MiningScene') ? s.session?.mineName : '';
        }),
      { timeout: 20_000 },
    )
    .toBe('REDISENO');
  expect(errors).toEqual([]);
});

test('F11 y varias resoluciones: el menú queda centrado y con escala entera', async ({ page }) => {
  const errors = watchErrors(page);
  await openMenu(page);
  await page.keyboard.press('F11');
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.keyboard.press('F11');
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  for (const [width, height] of [
    [1920, 1080],
    [1024, 768],
    [2560, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(width);
    // Tras salir de F11, Edge actualiza el viewport antes de que el siguiente
    // cuadro de Phaser aplique el zoom y el centrado. Esperar ese cuadro evita
    // leer el lienzo transitoriamente anclado a la esquina.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const c = document.querySelector('#game canvas')!.getBoundingClientRect();
          const zoom = window.__MINA_GAME__.scale.zoom;
          return (
            Number.isInteger(zoom) &&
            c.width === 480 * zoom &&
            c.height === 270 * zoom &&
            Math.abs(c.x - (window.innerWidth - c.x - c.width)) <= 1 &&
            Math.abs(c.y - (window.innerHeight - c.y - c.height)) <= 1
          );
        }),
        { timeout: 5000 },
      )
      .toBe(true);
    const r = await page.evaluate(() => {
      const c = document.querySelector('#game canvas')!.getBoundingClientRect();
      return { zoom: window.__MINA_GAME__.scale.zoom, x: c.x, w: c.width, h: c.height, y: c.y };
    });
    expect(Number.isInteger(r.zoom)).toBe(true);
    expect([r.w, r.h]).toEqual([480 * r.zoom, 270 * r.zoom]);
    expect(Math.abs(r.x - (width - r.x - r.w))).toBeLessThanOrEqual(1);
    expect(Math.abs(r.y - (height - r.y - r.h))).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});
