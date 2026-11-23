import { expect, test, type Page } from '@playwright/test';
import type { MiningScene } from '../src/game/scenes/MiningScene';

const scene = <T>(page: Page, fn: (s: MiningScene) => T) =>
  page.evaluate((source) => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene');
    return new Function('s', `return (${source})(s);`)(s);
  }, fn.toString()) as Promise<T>;

async function coords(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  return [
    box.x + (x * box.width) / 480,
    box.y + (y * box.height) / 270,
  ] as const;
}

async function point(page: Page, x: number, y: number) {
  await page.mouse.move(...(await coords(page, x, y)), { steps: 6 });
}

async function drag(page: Page, from: number[], to: number[]) {
  await point(page, from[0]!, from[1]!);
  await page.mouse.down();
  await point(page, to[0]!, to[1]!);
  await page.mouse.up();
}

const visibleItems = (page: Page, from: 'inventory' | 'hud') =>
  from === 'inventory'
    ? scene(page, (s) =>
        s.inventory['quickbar']['cells'].map(({ icon, count, number }) => ({
          icon: icon.visible ? icon.texture.key + '/' + icon.frame.name : null,
          count: count.visible ? count.text : null,
          number: number.text,
        })),
      )
    : scene(page, (s) =>
        s.hud['quickbar']['cells'].map(({ icon, count, number }) => ({
          icon: icon.visible ? icon.texture.key + '/' + icon.frame.name : null,
          count: count.visible ? count.text : null,
          number: number.text,
        })),
      );

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
});

test('arrastre, nueve teclas, equipo exacto y distribución persistente', async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const ids = await scene(page, (s) => {
    const a = s.session.tools.add('iron');
    a.durability = 7;
    const b = s.session.tools.add('shovel');
    const c = s.session.tools.add('drill');
    s.session.supplies.torch = 2;
    s.session.supplies.wood_beam = 3;
    s.session.buy('kit');
    s.session.firstDayDone = true;
    s.session.loadout.sync();
    return [a.id, b.id, c.id];
  });
  // Barra compacta del inventario: nueve casillas de 20 px cada 22 px.
  const quick = (i: number) => [172 + 22 * i, 196];
  await page.keyboard.press('Tab');
  await expect.poll(() => scene(page, (s) => s.inventory.open)).toBe(true);
  const unlocked = await scene(page, (s) => s.session.loadout.unlocked);
  expect(unlocked).toBe(24);
  // La perforadora está equipada; también se puede arrastrar desde el personaje.
  const positions = [
    [172, 74],
    [194, 74],
    [82, 172],
    [238, 74],
    [216, 74],
  ];
  for (let i = 0; i < 5; i++) await drag(page, positions[i]!, quick(i));
  const snapshot = () => scene(page, (s) => s.session.loadout.quickbar);
  const pad = <T>(items: T[]) => [
    ...items,
    ...Array(9 - items.length).fill(null),
  ];
  const layout = pad([
    ...ids.map((id) => ({ type: 'tool', id })),
    { type: 'supply', kind: 'torch' },
    { type: 'supply', kind: 'wood_beam' },
  ]);
  expect(await snapshot()).toEqual(layout);
  const shown = await visibleItems(page, 'inventory');
  expect(shown.map((q) => q.number)).toEqual([
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
  ]);
  expect(shown.map((q) => q.count)).toEqual([
    null,
    null,
    null,
    '2',
    '3',
    null,
    null,
    null,
    null,
  ]);
  expect(shown.slice(0, 5).every((q) => q.icon)).toBe(true);
  expect(shown.slice(5).every((q) => !q.icon)).toBe(true);
  await page.mouse.move(4, 4);
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('inventario-2x.png') });
  await page.keyboard.press('Tab');
  await expect.poll(() => scene(page, (s) => s.inventory.open)).toBe(false);
  expect(await visibleItems(page, 'hud')).toEqual(shown);

  for (let i = 0; i < 5; i++) {
    await page.keyboard.press(String(i + 1));
    await expect
      .poll(() => scene(page, (s) => s.session.loadout.selectedQuick))
      .toBe(i);
    expect(
      await scene(page, (s) => ({
        id: s.session.tools.equipped,
        supply: s.hud.activeSupply,
      })),
    ).toEqual({
      id: ids[i] ?? 0,
      supply: i === 3 ? 'torch' : i === 4 ? 'wood_beam' : null,
    });
    if (i === 1)
      expect(await scene(page, (s) => s.miner.texture.key)).toContain(
        'miner-shovel',
      );
    if (i === 2)
      expect(await scene(page, (s) => s['drillTool'].visible)).toBe(true);
  }
  // La sexta casilla está vacía: manos libres. La quinta vuelve a la viga.
  await page.keyboard.press('6');
  expect(await scene(page, (s) => s.session.loadout.selectedQuick)).toBe(5);
  await page.keyboard.press('5');
  expect(await scene(page, (s) => s.session.loadout.selectedQuick)).toBe(4);
  await page
    .locator('canvas')
    .screenshot({ path: testInfo.outputPath('hud-2x.png') });
  await point(page, 116, 250);
  await expect
    .poll(() => scene(page, (s) => s.hud['quickTip'].text))
    .toContain('DURABILIDAD: 7/');
  await point(page, 209, 250);
  await expect
    .poll(() => scene(page, (s) => s.hud['quickTip'].text))
    .toContain('CANTIDAD: 2');
  await page.keyboard.press('g');
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  expect(await snapshot()).toEqual(layout);
  expect(await scene(page, (s) => s.hud.activeSupply)).toBe('wood_beam');
  expect(
    await scene(page, (s) => s.session.tools.items.map((t) => t.id)),
  ).toEqual(ids);
  expect(await scene(page, (s) => s.session.tools.items[0]?.durability)).toBe(
    7,
  );

  await page.keyboard.press('Tab');
  await expect.poll(() => scene(page, (s) => s.inventory.open)).toBe(true);
  await drag(page, quick(0), quick(4));
  expect(await snapshot()).toEqual(
    pad([layout[4], layout[1], layout[2], layout[3], layout[0]]),
  );
  await page.mouse.click(...(await coords(page, 260, 196)), {
    button: 'right',
  });
  // El menú quita solo la referencia, no el objeto real.
  await point(page, 310, 201);
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.press('Tab');
  await page.keyboard.press('5');
  await expect
    .poll(() => scene(page, (s) => s.session.loadout.selectedQuick))
    .toBe(4);
  expect((await snapshot())[4]).toBeNull();
  expect(
    await scene(page, (s) => [
      s.session.tools.equipped,
      s.session.tools.items.length,
    ]),
  ).toEqual([0, 3]);
});

test('HUD compacto, etiqueta contextual y escala entera en cuatro ventanas', async ({
  page,
}, testInfo) => {
  test.setTimeout(50000);
  await scene(page, (s) => {
    const pick = s.session.tools.add('iron');
    s.session.loadout.assignQuick(0, { type: 'tool', id: pick.id });
    s.session.supplies.torch = 3;
    s.session.loadout.assignQuick(3, { type: 'supply', kind: 'torch' });
    s.session.buy('kit');
    s.session.firstDayDone = true;
    s.session.gainXp(75);
    s.miner.body.reset(500, 150);
  });
  await page.keyboard.press('1');
  await expect
    .poll(() => scene(page, (s) => s.hud['prompt'].visible))
    .toBe(false);
  expect(await scene(page, (s) => s.hud['message'].text)).not.toContain(
    'CLIC: TRABAJAR',
  );
  await scene(page, (s) => s.miner.body.reset(106, 150));
  await expect
    .poll(() => scene(page, (s) => s.hud['prompt'].text))
    .toBe('[E] INTERACTUAR');
  await page.keyboard.press('h');
  await expect.poll(() => scene(page, (s) => s.hud.helpOpen)).toBe(true);
  expect(await scene(page, (s) => s.hud['prompt'].visible)).toBe(false);
  await page.keyboard.press('h');

  for (const [width, height, scale] of [
    [390, 650, 1],
    [1280, 800, 2],
    [1920, 540, 2],
    [1920, 1080, 3],
  ] as const) {
    await page.setViewportSize({ width, height });
    const canvas = page.locator('canvas');
    await expect
      .poll(async () => (await canvas.boundingBox())?.width)
      .toBe(480 * scale);
    expect((await canvas.boundingBox())?.height).toBe(270 * scale);
    expect(
      await scene(page, (s) => ({
        center: s.hud['quickbar'].x + 138,
        heartCount: s.hud['hearts'].length,
        leftFree: !s.hud.blocksWorld(80, 248),
        rightFree: !s.hud.blocksWorld(400, 248),
      })),
    ).toEqual({ center: 240, heartCount: 5, leftFree: true, rightFree: true });
    if (width === 390) {
      const viewport = page.locator('.game-viewport');
      await viewport.evaluate((el) => (el.scrollLeft = el.scrollWidth));
      expect(await viewport.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      await viewport.screenshot({
        path: testInfo.outputPath('hud-390x650.png'),
      });
      await point(page, 209, 251);
      await expect
        .poll(() => scene(page, (s) => s.hud['quickTip'].text))
        .toContain('CANTIDAD: 3');
      await point(page, 100, 110);
      await viewport.evaluate((el) => (el.scrollLeft = 0));
    } else if (scale === 3)
      await canvas.screenshot({
        path: testInfo.outputPath(`hud-${width}x${height}.png`),
      });
  }
});
