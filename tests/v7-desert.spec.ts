import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import { DEPTH } from '../src/game/config/layers';

/**
 * V7: bioma del Atacama y ciclo de día y noche. Capturas reales del
 * renderizador (×3 vecino más cercano) en amanecer, mediodía, atardecer y
 * noche, más comprobaciones del reloj, nubes, aves, luces y guardado.
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

/** Fija el reloj ambiental (ms dentro del ciclo de 10 minutos). */
const setClock = (page: Page, ms: number) =>
  scene(page, (s, value) => s.session.dayNight.restore(value), ms);

async function shot(page: Page, name: string) {
  await scene(page, (s) => {
    s.hud['awardUntil'] = 0;
    s.hud['award'].setVisible(false);
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.__MINA_GAME__.renderer.snapshot((image) => {
          const img = image as HTMLImageElement;
          const draw = () => {
            const c = document.createElement('canvas');
            c.id = 'v7-snap';
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
    .locator('#v7-snap')
    .screenshot({ path: `docs/screenshots/${name}.png` });
  await page.evaluate(() => document.getElementById('v7-snap')?.remove());
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
    s.session.loadout.sync();
  });
});

test('V7: cielo, sol, nubes y aves cambian con el reloj', async ({ page }) => {
  test.setTimeout(120000);
  // Amanecer → mediodía → atardecer → noche.
  const phases: [number, string, string][] = [
    [20_000, 'dawn', 'v7-dawn'],
    [150_000, 'day', 'v7-noon'],
    [282_000, 'sunset', 'v7-sunset'],
    [450_000, 'night', 'v7-night'],
  ];
  const suns: { x: number; y: number }[] = [];
  for (const [ms, phase, name] of phases) {
    await setClock(page, ms);
    await page.waitForTimeout(350);
    const state = await scene(page, (s) => ({
      phase: s.session.dayNight.phase,
      sun: s.session.dayNight.sun,
      moon: s.session.dayNight.moon,
    }));
    expect(state.phase).toBe(phase);
    if (phase === 'night') expect(state.moon.visible).toBe(true);
    else {
      expect(state.sun.visible).toBe(true);
      suns.push(state.sun);
    }
    await shot(page, name);
  }
  // El sol recorre el cielo: sube hasta mediodía y vuelve a bajar.
  expect(suns[1]!.y).toBeLessThan(suns[0]!.y);
  expect(suns[2]!.y).toBeGreaterThan(suns[1]!.y);
  expect(suns[2]!.x).toBeGreaterThan(suns[0]!.x);

  // Nubes en movimiento independiente del jugador.
  await setClock(page, 120_000);
  const before = await scene(page, (s) => s.backdrop!.cloudPositions());
  await page.waitForTimeout(1500);
  const after = await scene(page, (s) => s.backdrop!.cloudPositions());
  expect(after.some((x, i) => x !== before[i])).toBe(true);

  // Aves con aleteo real (cambia el cuadro de la hoja).
  await scene(page, (s) => s.backdrop!.spawnBirds(3));
  const frames = new Set<string>();
  for (let i = 0; i < 8; i++) {
    frames.add(
      await scene(page, (s) => s.backdrop!.birdFrames().join(',')),
    );
    await page.waitForTimeout(120);
  }
  expect(frames.size).toBeGreaterThan(1);
  // Para la captura, la bandada se adelanta hasta el centro del cielo.
  await scene(page, (s) => {
    const birds = s.backdrop!['birds'] as { x: number; sprite: { visible: boolean } }[];
    birds
      .filter((b) => b.sprite.visible)
      .forEach((b, i) => (b.x = 150 + i * 18));
  });
  await page.waitForTimeout(200);
  await shot(page, 'v7-birds');
});

test('V7: el ciclo dura 10 minutos, se pausa y se guarda', async ({ page }) => {
  test.setTimeout(60_000);
  // A los cinco minutos empieza la noche y dura cinco minutos.
  await setClock(page, 299_000);
  await expect
    .poll(() => scene(page, (s) => s.session.dayNight.phase), {
      timeout: 4000,
    })
    .toBe('night');
  await setClock(page, 599_000);
  await expect
    .poll(() => scene(page, (s) => s.session.dayNight.phase), {
      timeout: 4000,
    })
    .toBe('dawn');
  // La pausa (inventario abierto) detiene el reloj.
  await setClock(page, 100_000);
  await page.keyboard.press('Tab');
  await expect.poll(() => scene(page, (s) => s.inventory.open)).toBe(true);
  const paused = await scene(page, (s) => s.session.dayNight.elapsedMs);
  await page.waitForTimeout(700);
  expect(await scene(page, (s) => s.session.dayNight.elapsedMs)).toBe(paused);
  await page.keyboard.press('Escape');
  // Guardado y recuperación de la fase.
  await setClock(page, 420_000);
  await scene(page, (s) => s.save());
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  const restored = await scene(page, (s) => ({
    ms: s.session.dayNight.elapsedMs,
    phase: s.session.dayNight.phase,
  }));
  expect(restored.phase).toBe('night');
  expect(restored.ms).toBeGreaterThanOrEqual(420_000);
  expect(restored.ms).toBeLessThan(425_000);
});

test('V7: luces de noche, interior oscuro y HUD intacto', async ({ page }) => {
  test.setTimeout(90000);
  await setClock(page, 450_000);
  // Bodega de noche.
  await scene(page, (s) => s.miner.body.reset(110, 148));
  await settle(page);
  await page.waitForTimeout(500);
  const night = await scene(page, (s) => {
    const all = s.children.list.flatMap((o) =>
      'list' in o ? (o as Phaser.GameObjects.Container).list : [o],
    );
    const tintOf = (match: (o: Phaser.GameObjects.Image) => boolean) => {
      for (const o of all)
        if ('tintTopLeft' in o && 'frame' in o && match(o as Phaser.GameObjects.Image))
          return (o as Phaser.GameObjects.Image).tintTopLeft;
      return -1;
    };
    return {
      open: s.lighting.lightAt(200, 100),
      ground: s.lighting.lightAt(150, 150),
      miner: s.miner.tintTopLeft,
      wall: tintOf((o) => String(o.frame.name) === 'wh_wall'),
      window: tintOf((o) => String(o.frame.name) === 'wh_window'),
      torch: tintOf((o) => o.texture.key === 'torch'),
    };
  });
  // Exterior sin trama: la noche es un tinte parejo, no puntos oscuros.
  expect(night.open).toBe(1);
  expect(night.ground).toBe(1);
  // Mundo azul luna; el minero, más claro; ventana y antorchas, sin tinte.
  expect(night.wall).toBe(0x6c7bbd);
  expect(night.miner).toBe(0xa3b0e4);
  expect(night.window).toBe(0xffffff);
  expect(night.torch).toBe(0xffffff);
  await shot(page, 'v7-night-warehouse');
  await scene(page, (s) => s.miner.body.reset(262, 148));
  await settle(page);
  await page.waitForTimeout(500);
  await shot(page, 'v7-night-entrance');
  // Mediodía: la roca enterrada sigue oscura y el casco funciona en el túnel.
  await setClock(page, 150_000);
  await scene(page, (s) => s.miner.body.reset(18 * 16 + 70, 150));
  await settle(page);
  await page.waitForTimeout(700);
  const noon = await scene(page, (s) => ({
    buried: s.lighting.lightAt(30 * 16 + 8, 20 * 16 + 8),
    lamp: s.lighting.lamp.power,
    darkness: s.lighting.darkness.image.depth,
  }));
  expect(noon.buried).toBeLessThan(0.1);
  expect(noon.lamp).toBeGreaterThan(0);
  // Una sola máscara de oscuridad, siempre bajo la interfaz del mundo y el HUD.
  expect(noon.darkness).toBeLessThan(DEPTH.worldUi);
  await shot(page, 'v7-noon-tunnel');
});
