import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';

/**
 * HUD V8: barra superior en módulos y barra rápida con bandeja. Capturas
 * reales del renderizador (×3, vecino más cercano) y comprobaciones de que
 * la lógica del HUD no cambió.
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

async function point(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(
    box.x + ((x + 0.5) * box.width) / 480,
    box.y + ((y + 0.5) * box.height) / 270,
  );
}

async function shot(page: Page, name: string) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.__MINA_GAME__.renderer.snapshot((image) => {
          const img = image as HTMLImageElement;
          const draw = () => {
            const c = document.createElement('canvas');
            c.id = 'v8-snap';
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
    .locator('#v8-snap')
    .screenshot({ path: `docs/screenshots/${name}.png` });
  await page.evaluate(() => document.getElementById('v8-snap')?.remove());
}

test.use({ viewport: { width: 1480, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
  await scene(page, (s) => {
    s.session.buy('kit');
    s.session.firstDayDone = true;
    const pick = s.session.tools.add('iron');
    pick.durability = Math.round(pick.durability * 0.6);
    const shovel = s.session.tools.add('shovel');
    s.session.supplies.torch = 6;
    s.session.supplies.wood_beam = 12;
    s.session.loadout.assignQuick(0, { type: 'tool', id: pick.id });
    s.session.loadout.assignQuick(1, { type: 'tool', id: shovel.id });
    s.session.loadout.assignQuick(2, { type: 'supply', kind: 'torch' });
    s.session.loadout.assignQuick(3, { type: 'supply', kind: 'wood_beam' });
    s.session.gainXp(60);
    s.session.inventory.add('coal');
    s.session.inventory.add('copper');
    s.hud['awardUntil'] = 0;
  });
});

test('V8: barra superior, bandeja y casilla activa', async ({ page }) => {
  await page.keyboard.press('1');
  await page.mouse.move(2, 2);
  await page.waitForTimeout(500);
  const hud = await scene(page, (s) => ({
    level: s.hud['status'].text as string,
    xp: s.hud['xpValue'].text as string,
    money: s.hud['wallet'].text as string,
    ppe: s.hud['equipment'].text as string,
    cargo: s.hud['cargo'].text as string,
    zone: s.hud['zoneText'].text as string,
    hearts: s.hud['hearts'].length as number,
    selected: s.session.loadout.selectedQuick,
    // Los módulos tapan el mundo; los huecos entre ellos y los lados de la
    // bandeja, no.
    blocks: [
      s.hud.blocksWorld(30, 15),
      s.hud.blocksWorld(240, 15),
      s.hud.blocksWorld(400, 15),
      s.hud.blocksWorld(240, 250),
      // V9: la placa de la batería tapa el mundo; el hueco hasta el módulo
      // central y los lados de la bandeja, no.
      s.hud.blocksWorld(70, 40),
      s.hud.blocksWorld(132, 40),
      s.hud.blocksWorld(80, 248),
      s.hud.blocksWorld(400, 248),
    ],
  }));
  expect(hud.level).toMatch(/^\d+$/);
  expect(hud.xp).toMatch(/^\d+ \/ \d+ XP$/);
  expect(hud.money).toMatch(/^\d+$/);
  expect(hud.ppe).toBe('5/5');
  expect(hud.cargo).toBe('2/50');
  expect(hud.zone).toBe('SUPERFICIE');
  expect(hud.hearts).toBe(5);
  expect(hud.selected).toBe(0);
  expect(hud.blocks).toEqual([
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    false,
  ]);
  await shot(page, 'v8-hud-surface');
  // Tooltip de la barra rápida sobre la bandeja.
  await point(page, 102 + 93 + 14, 244);
  await expect
    .poll(() => scene(page, (s) => s.hud['quickTip'].text))
    .toContain('CANTIDAD: 12');
  await shot(page, 'v8-hud-tooltip');
  // Tooltip de experiencia bajo el módulo central.
  await point(page, 240, 15);
  await expect
    .poll(() => scene(page, (s) => s.hud['xpTip'].text))
    .toContain('EXPERIENCIA TOTAL');
  await shot(page, 'v8-hud-xp');
});

test('V8: galería, corazones bajos y carga llena', async ({ page }) => {
  await scene(page, (s) => {
    s.session.health.hp = 30;
    for (let i = 0; i < 48; i++) s.session.inventory.add('iron');
    s.miner.body.reset(18 * 16 + 70, 150);
  });
  await page.keyboard.press('3');
  await page.mouse.move(2, 2);
  await expect
    .poll(() => scene(page, (s) => s.hud['zoneText'].text))
    .not.toBe('SUPERFICIE');
  await page.waitForTimeout(400);
  expect(await scene(page, (s) => s.hud['cargo'].text)).toBe('50/50');
  await shot(page, 'v8-hud-gallery');
});
