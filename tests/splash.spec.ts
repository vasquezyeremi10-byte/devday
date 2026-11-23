import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import { SPLASH } from '../src/game/config/splash';
import { buildTimeline } from '../src/game/systems/SplashTimeline';

/** Introducción del estudio antes del menú: secuencia, sonido, omitir y escalado. */
declare global {
  interface Window {
    __MINA_GAME__: Phaser.Game;
  }
}

interface IntroProbe {
  elapsed: number;
  running: boolean;
  leaving: boolean;
  trace: { at: number; event: string }[];
  logo: { visible: boolean; frame: { name: string | number }; displayWidth: number; displayHeight: number };
  cover: { coverage: number };
}

const URL = '/?menu=on&splash=on';
const TIMELINE = buildTimeline(SPLASH);
const STUDIO = TIMELINE.items.find((i) => i.kind === 'logo')!;
const BLACK = TIMELINE.items.find((i) => i.kind === 'black')!;

const intro = <T>(page: Page, fn: (s: IntroProbe) => T) =>
  page.evaluate(
    ({ source }) => {
      const s = window.__MINA_GAME__.scene.getScene('StudioIntroScene');
      return new Function('s', `return (${source})(s);`)(s);
    },
    { source: fn.toString() },
  ) as Promise<T>;

const state = (page: Page) =>
  page.evaluate(() => {
    const g = window.__MINA_GAME__;
    const m = g.scene.getScene('MenuScene') as unknown as {
      busy: boolean;
      entering: boolean;
      current: string;
      music: { isPlaying: boolean; volume: number } | null;
    };
    return {
      intro: g.scene.isActive('StudioIntroScene'),
      menu: g.scene.isActive('MenuScene'),
      busy: m.busy,
      entering: m.entering,
      current: m.current,
      music: m.music ? { playing: m.music.isPlaying, volume: m.music.volume } : null,
      impact: g.sound.getAll('sfx-intro-impact').filter((s) => s.isPlaying).length,
      ambience: g.sound.getAll('sfx-intro-ambience').filter((s) => s.isPlaying).length,
    };
  });

/** Abre el juego; si el audio pide una pulsación, la da (con un clic). */
async function start(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await expect
    .poll(() => page.evaluate(() => window.__MINA_GAME__?.scene.isActive('StudioIntroScene') ?? false), {
      timeout: 20_000,
    })
    .toBe(true);
  if (!(await intro(page, (s) => s.running))) {
    const box = (await page.locator('canvas').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await expect.poll(() => intro(page, (s) => s.running)).toBe(true);
  return errors;
}

const waitElapsed = (page: Page, ms: number) =>
  expect
    .poll(() => intro(page, (s) => s.elapsed), { timeout: 20_000, intervals: [50] })
    .toBeGreaterThanOrEqual(ms);

test('la introducción completa: texto, logotipo con su golpe, negro y menú', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const before = await page.goto(URL).then(() =>
    page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())),
  );
  const errors = await start(page);
  // Escena 1: el texto aparece tras la pausa.
  await waitElapsed(page, SPLASH.opening.pause + SPLASH.opening.in + 100);
  expect(
    await page.evaluate(() => {
      const s = window.__MINA_GAME__.scene.getScene('StudioIntroScene') as unknown as {
        text: { visible: boolean };
      };
      return s.text.visible;
    }),
  ).toBe(true);
  // Escena 2: el logotipo, nítido y sin deformar, con el golpe en su primera trama.
  await waitElapsed(page, STUDIO.start + SPLASH.studio.in + 200);
  const logo = await intro(page, (s) => ({
    visible: s.logo.visible,
    w: s.logo.displayWidth,
    h: s.logo.displayHeight,
    cover: s.cover.coverage,
  }));
  expect(logo).toEqual({ visible: true, w: 212, h: 212, cover: 0 });
  await page.locator('canvas').screenshot({ path: 'docs/screenshots/splash-studio-logo.png' });
  const trace = await intro(page, (s) => s.trace);
  const impact = trace.find((t) => t.event === `sound:${SPLASH.studio.sound}`)!;
  // Un fotograma de margen: el sonido sale en el paso que cruza el inicio.
  expect(impact.at).toBeGreaterThanOrEqual(STUDIO.start);
  expect(impact.at).toBeLessThanOrEqual(STUDIO.start + 100);
  // Escena 4: negro con ambiente y entrada al menú.
  await expect.poll(() => state(page).then((s) => s.menu), { timeout: 20_000 }).toBe(true);
  const events = (await page.evaluate(() =>
    (window.__MINA_GAME__.scene.getScene('StudioIntroScene') as unknown as IntroProbe).trace.map(
      (t) => t.event,
    ),
  )) as string[];
  expect(events).toEqual([
    'begin',
    `sound:${SPLASH.studio.sound}`,
    `sound:${SPLASH.transition.ambience}`,
    'finish',
    'menu:cinematic',
  ]);
  // La música entra baja y sube hasta su volumen; el menú queda utilizable.
  await expect.poll(() => state(page).then((s) => s.entering), { timeout: 10_000 }).toBe(false);
  await expect
    .poll(() => state(page).then((s) => s.music?.volume ?? 0), { timeout: 10_000 })
    .toBeCloseTo(0.5, 2);
  await expect.poll(() => state(page).then((s) => s.ambience), { timeout: 10_000 }).toBe(0);
  await page.locator('canvas').screenshot({ path: 'docs/screenshots/splash-menu.png' });
  // La introducción no toca las partidas guardadas.
  expect(
    await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())),
  ).toBe(before);
  expect(errors).toEqual([]);
});

for (const [phase, at, how] of [
  ['apertura', SPLASH.opening.pause + 600, 'Escape'],
  ['logotipo', STUDIO.start + 400, 'Space'],
  ['negro final', BLACK.start + 300, 'click'],
] as const)
  test(`omitir durante ${phase} (${how}) corta todo y entra al menú`, async ({ page }) => {
    test.setTimeout(45_000);
    const errors = await start(page);
    await waitElapsed(page, at);
    if (how === 'click') {
      const box = (await page.locator('canvas').boundingBox())!;
      await page.mouse.click(box.x + 20, box.y + 20);
    } else await page.keyboard.press(how);
    await expect.poll(() => state(page).then((s) => s.menu), { timeout: 5_000 }).toBe(true);
    const s = await state(page);
    expect(s.impact).toBe(0);
    expect(s.ambience).toBe(0);
    const events = await page.evaluate(() =>
      (window.__MINA_GAME__.scene.getScene('StudioIntroScene') as unknown as IntroProbe).trace.map(
        (t) => t.event,
      ),
    );
    // Tras omitir no suena ni aparece nada más de la introducción.
    const skipAt = events.indexOf('skip');
    expect(skipAt).toBeGreaterThan(0);
    expect(events.slice(skipAt)).toEqual(['skip', 'menu:quick']);
    await expect.poll(() => state(page).then((x) => x.busy), { timeout: 5_000 }).toBe(false);
    await expect
      .poll(() => state(page).then((x) => x.music?.playing ?? false), { timeout: 10_000 })
      .toBe(true);
    // El menú funciona: bajar a Configuración (índice 2) y abrirla.
    const focus = () =>
      page.evaluate(
        () =>
          (
            window.__MINA_GAME__.scene.getScene('MenuScene') as unknown as {
              pages: { main: { focus: number } };
            }
          ).pages.main.focus,
      );
    for (let i = 0; i < 4 && (await focus()) !== 2; i++)
      await page.keyboard.press('ArrowDown');
    expect(await focus()).toBe(2);
    await page.keyboard.press('Enter');
    await expect.poll(() => state(page).then((x) => x.current)).toBe('settings');
    expect(errors).toEqual([]);
  });

test('repetir el inicio varias veces no deja errores ni sonidos colgados', async ({ page }) => {
  test.setTimeout(60_000);
  for (let round = 0; round < 3; round++) {
    const errors = await start(page);
    await waitElapsed(page, SPLASH.studio.in + STUDIO.start);
    await page.keyboard.press('Escape');
    await expect.poll(() => state(page).then((s) => s.menu), { timeout: 5_000 }).toBe(true);
    const s = await state(page);
    expect([s.impact, s.ambience]).toEqual([0, 0]);
    expect(errors).toEqual([]);
  }
});

test('el logotipo conserva su forma y el lienzo una escala entera en varias ventanas', async ({
  page,
}) => {
  test.setTimeout(60_000);
  for (const [w, h] of [
    [480, 270],
    [800, 600],
    [1280, 720],
    [1920, 1080],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await start(page);
    await waitElapsed(page, STUDIO.start + SPLASH.studio.in + 100);
    const r = await page.evaluate(() => {
      const canvas = document.querySelector('#game canvas') as HTMLCanvasElement;
      const s = window.__MINA_GAME__.scene.getScene('StudioIntroScene') as unknown as IntroProbe;
      return {
        zoom: window.__MINA_GAME__.scale.zoom,
        cssW: canvas.getBoundingClientRect().width,
        logoW: s.logo.displayWidth,
        logoH: s.logo.displayHeight,
      };
    });
    expect(Number.isInteger(r.zoom)).toBe(true);
    expect(r.logoW).toBe(r.logoH);
    expect(r.logoW).toBe(212);
    await page.keyboard.press('Escape');
    await expect.poll(() => state(page).then((s) => s.menu), { timeout: 5_000 }).toBe(true);
  }
});
