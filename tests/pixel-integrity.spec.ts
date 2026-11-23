import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';

/**
 * Nitidez del pixel art. Se mide sobre capturas en píxeles físicos:
 *  1. el lienzo lógico de 480 × 270 se pinta con un factor ENTERO de píxeles
 *     físicos y cada píxel del juego es un bloque uniforme (sin columnas de 2
 *     y de 3 px alternadas ni mezcla de vecinos);
 *  2. el contenido tiene pocos colores distintos: una ilustración de tono
 *     continuo reducida con suavizado (el defecto original del fondo del menú:
 *     ~100 000 colores) deja miles, el pixel art de verdad unos cientos.
 */
declare global {
  interface Window {
    __MINA_GAME__: Phaser.Game;
  }
}

interface Report {
  /** Tamaño de la captura en píxeles físicos. */
  width: number;
  height: number;
  /** Píxeles físicos por píxel del juego esperados. */
  factor: number;
  /** Bloques del juego completos dentro de la captura. */
  totalBlocks: number;
  /** Bloques cuyos píxeles físicos no son todos iguales. */
  badBlocks: number;
  /** Colores distintos en la imagen lógica (un píxel por bloque). */
  logicalColors: number;
}

/**
 * Analiza una captura PNG (base64) dentro de la página. `factor` es el número
 * de píxeles físicos por píxel del juego que debe tener el lienzo; si el borde
 * se recorta una fracción de píxel (holgura de un píxel del juego), solo se
 * cuentan los bloques completos.
 */
async function analyse(page: Page, base64: string, factor: number): Promise<Report> {
  return page.evaluate(
    async ({ b64, f }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const cv = document.createElement('canvas');
      cv.width = bitmap.width;
      cv.height = bitmap.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0);
      const { width, height } = cv;
      const data = ctx.getImageData(0, 0, width, height).data;
      const colors = new Set<number>();
      let bad = 0;
      let total = 0;
      for (let gy = 0; gy < 270 && (gy + 1) * f <= height; gy++)
        for (let gx = 0; gx < 480 && (gx + 1) * f <= width; gx++) {
          total++;
          const base = (gy * f * width + gx * f) * 4;
          colors.add((data[base]! << 16) | (data[base + 1]! << 8) | data[base + 2]!);
          let same = true;
          for (let dy = 0; dy < f && same; dy++)
            for (let dx = 0; dx < f; dx++) {
              const i = ((gy * f + dy) * width + gx * f + dx) * 4;
              if (
                data[i] !== data[base] ||
                data[i + 1] !== data[base + 1] ||
                data[i + 2] !== data[base + 2]
              ) {
                same = false;
                break;
              }
            }
          if (!same) bad++;
        }
      return { width, height, factor: f, totalBlocks: total, badBlocks: bad, logicalColors: colors.size };
    },
    { b64: base64, f: factor },
  );
}

async function openMenu(page: Page) {
  await page.goto('/?menu=on&splash=off');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const m = window.__MINA_GAME__?.scene.getScene('MenuScene') as unknown as
            | { busy: boolean; pages?: object }
            | undefined;
          return !!m && m.busy === false && !!m.pages;
        }),
      { timeout: 20_000 },
    )
    .toBe(true);
  // Que el título termine de aparecer y el ambiente no dependa del cuadro.
  await page.waitForTimeout(2500);
}

/** Entra a la mina (el navegador automatizado salta el menú) y crea la partida. */
async function enterGame(page: Page) {
  await page.goto('/?splash=off');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const s = window.__MINA_GAME__?.scene.getScene('MiningScene') as unknown as
            | { safety?: { modeOpen: boolean } }
            | undefined;
          return s?.safety?.modeOpen ?? false;
        }),
      { timeout: 20_000 },
    )
    .toBe(true);
  await page.keyboard.type('NITIDEZ');
  await page.keyboard.press('1');
  await page.waitForTimeout(2500);
}

/**
 * Capturas para comparar antes y después (docs/screenshots/pixel-<etiqueta>-*).
 * Solo se ejecuta con PIXEL_LABEL=before|after.
 */
const LABEL = (
  globalThis as { process?: { env: Record<string, string | undefined> } }
).process?.env?.PIXEL_LABEL;
for (const size of [
  { w: 1280, h: 720 },
  { w: 1920, h: 1080 },
] as const)
  test(`capturas ${LABEL ?? '(sin etiqueta)'} a ${size.w}×${size.h}`, async ({ browser }) => {
    test.skip(!LABEL, 'Define PIXEL_LABEL=before|after para guardar capturas');
    test.setTimeout(60_000);
    const context = await browser.newContext({ viewport: { width: size.w, height: size.h } });
    const page = await context.newPage();
    await openMenu(page);
    await page.screenshot({ path: `docs/screenshots/pixel-${LABEL}-menu-${size.w}.png` });
    await enterGame(page);
    await page.screenshot({ path: `docs/screenshots/pixel-${LABEL}-game-${size.w}.png` });
    await context.close();
  });

/**
 * Ventanas y escalas de pantalla (DPR) de Windows. `factor` es el escalón
 * entero esperado en píxeles físicos por píxel del juego. El caso 1097 × 617
 * con DPR 1,75 es un monitor de 1920 × 1080 al 175 %: ofrece 1079,75 px
 * físicos de alto y antes bajaba a 3× (75 % de la pantalla) por 0,25 px.
 */
const CASES = [
  { w: 1280, h: 720, dpr: 1, factor: 2 },
  { w: 1920, h: 1080, dpr: 1, factor: 4 },
  { w: 1536, h: 864, dpr: 1.25, factor: 4 },
  { w: 1280, h: 720, dpr: 1.5, factor: 4 },
  { w: 1097, h: 617, dpr: 1.75, factor: 4 },
  { w: 960, h: 540, dpr: 2, factor: 4 },
] as const;

/** Menú: ilustración, título, botones y ambiente. */
const MENU_MAX_COLORS = 1500;

for (const c of CASES) {
  test(`menú nítido a ${c.w}×${c.h} con DPR ${c.dpr}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: c.w, height: c.h },
      deviceScaleFactor: c.dpr,
    });
    const page = await context.newPage();
    await openMenu(page);
    const info = await page.evaluate(() => {
      const canvas = document.querySelector('#game canvas') as HTMLCanvasElement;
      const r = canvas.getBoundingClientRect();
      return {
        attr: [canvas.width, canvas.height],
        css: [r.width, r.height],
        zoom: window.__MINA_GAME__.scale.zoom,
        dpr: window.devicePixelRatio,
        rendering: getComputedStyle(canvas).imageRendering,
      };
    });
    // El factor real en píxeles físicos es zoom CSS × DPR.
    expect(Math.round(info.zoom * info.dpr * 1000) / 1000).toBe(c.factor);
    expect(info.attr).toEqual([480, 270]);
    expect(info.rendering).toBe('pixelated');
    const shot = await page.locator('#game canvas').screenshot();
    const report = await analyse(page, shot.toString('base64'), c.factor);
    console.log(`DIAG ${c.w}x${c.h}@${c.dpr}`, JSON.stringify({ info, report }));
    // Casi todos los bloques cuentan (un recorte de fracción de píxel descarta
    // como mucho la última fila o columna).
    expect(report.totalBlocks).toBeGreaterThan(480 * 270 * 0.98);
    expect(report.badBlocks).toBe(0);
    expect(report.logicalColors).toBeLessThan(MENU_MAX_COLORS);
    await context.close();
  });
}

test('partida nítida a 1920×1080 y al 175 % (1097×617)', async ({ browser }) => {
  test.setTimeout(90_000);
  for (const c of [CASES[1], CASES[4]] as const) {
    const context = await browser.newContext({
      viewport: { width: c.w, height: c.h },
      deviceScaleFactor: c.dpr,
    });
    const page = await context.newPage();
    await enterGame(page);
    const shot = await page.locator('#game canvas').screenshot();
    const report = await analyse(page, shot.toString('base64'), c.factor);
    console.log(`DIAG partida ${c.w}x${c.h}@${c.dpr}`, JSON.stringify(report));
    expect(report.totalBlocks).toBeGreaterThan(480 * 270 * 0.98);
    expect(report.badBlocks).toBe(0);
    // Sin barras de desplazamiento por la fracción de píxel que sobra.
    const scroll = await page.evaluate(() => {
      const v = document.querySelector('.game-viewport') as HTMLElement;
      return { overflow: getComputedStyle(v).overflow, over: v.scrollHeight - v.clientHeight };
    });
    if (c.dpr === 1.75) expect(scroll.overflow).toBe('hidden');
    await context.close();
  }
});
