import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import type { ToolKind } from '../src/game/config/balance';
import { CART } from '../src/game/config/cart';
import { DEPTH } from '../src/game/config/layers';
import { PALETTE } from '../src/game/config/palette';
import { Block } from '../src/game/world/TerrainGrid';

declare global {
  interface Window {
    __MINA_GAME__: Phaser.Game;
  }
}
const sceneState = (page: Page) =>
  page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    return {
      x: s.miner.x,
      y: s.miner.y,
      bottom: s.miner.body.bottom,
      grounded: s.miner.body.blocked.down,
      scrollX: s.cameras.main.scrollX,
      scrollY: s.cameras.main.scrollY,
      count: s.mining.excavated,
      money: s.session.money,
      inventory: [...s.session.inventory.items],
      dirt: s.session.supplies.mat_dirt,
      cart: [...s.session.cart.inventory.items],
      cartX: s.session.cart.x,
      pushing: s.session.cart.pushing,
      tools: s.session.tools.items.map((t) => ({ ...t })),
      equipped: s.session.tools.current,
      progress: s.work.progress,
      loading: !!s.loading,
      selected: s.interactions.selected?.id,
      rails: s.session.rails.segments.length,
      railStock: s.session.railStock,
      building: !!s.buildCell,
      frame: Number(s.miner.frame.name),
      fps: s.game.loop.actualFps,
    };
  });
/** Luz compuesta del último fotograma: el haz relativo a la lámpara y puntos fijos. */
const lightState = (page: Page, points: [number, number][] = []) =>
  page.evaluate((points) => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    const L = s.lighting,
      o = L.lampOrigin(s.miner);
    return {
      zone: L.zone,
      power: L.lamp.power,
      ahead: L.lightAt(o.x + 24 * (s.miner.flipX ? -1 : 1), o.y + 2),
      behind: L.lightAt(o.x - 24 * (s.miner.flipX ? -1 : 1), o.y + 2),
      head: L.lightAt(o.x, o.y),
      points: points.map(([x, y]) => L.lightAt(x, y)),
    };
  }, points);
async function settle(page: Page) {
  await expect(page.locator('#game-status')).toContainText('Mina lista', { timeout: 20_000 });
  await expect.poll(async () => (await sceneState(page)).grounded).toBe(true);
}
async function moveTo(page: Page, x: number) {
  const start = (await sceneState(page)).x;
  const key = start < x ? 'd' : 'a';
  await page.keyboard.down(key);
  await page.waitForFunction(
    ({ x, right }) => {
      const s = window.__MINA_GAME__.scene.getScene(
        'MiningScene',
      ) as MiningScene;
      return right ? s.miner.x >= x : s.miner.x <= x;
    },
    { x, right: start < x },
    { timeout: 12000 },
  );
  await page.keyboard.up(key);
  await page.waitForTimeout(70);
}
async function aim(page: Page, x: number, y: number) {
  const s = await sceneState(page),
    box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(
    box.x + ((x - s.scrollX) * box.width) / 480,
    box.y + ((y - s.scrollY) * box.height) / 270,
  );
}
async function prepareTool(page: Page, kind: ToolKind, x = 402, y = 148) {
  // Preparación explícita de fixture; las acciones verificadas usan teclado y mouse reales.
  await page.evaluate(
    ({ kind, x, y }) => {
      const s = window.__MINA_GAME__.scene.getScene(
        'MiningScene',
      ) as MiningScene;
      s.session.tools.add(kind);
      s.miner.body.reset(x, y);
    },
    { kind, x, y },
  );
  await settle(page);
  await page.waitForTimeout(100);
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await settle(page);
  // Partida nueva: modalidad Normal y EPP básico de fixture (la compra real
  // del EPP y el control de acceso se prueban en v4.spec.ts).
  await page.keyboard.press('1');
  await page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    for (const k of ['helmet', 'boots', 'vest', 'gloves', 'goggles'] as const)
      if (!s.session.loadout.equipped(k)) s.session.loadout.addPPE(k);
  });
});

test('carga, movimiento, salto, camara y pixel art sin errores', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('requestfailed', (r) => errors.push(r.url()));
  await page.reload();
  await settle(page);
  await expect(page.locator('canvas')).toHaveAttribute('width', '480');
  await expect(page.locator('canvas')).toHaveAttribute('height', '270');
  await page.keyboard.down('Space');
  await page.waitForTimeout(180);
  expect((await sceneState(page)).y).toBeLessThan(140);
  await settle(page);
  await page.waitForTimeout(300);
  expect((await sceneState(page)).bottom).toBeCloseTo(160, 0);
  await page.keyboard.up('Space');
  await moveTo(page, 400);
  expect((await sceneState(page)).scrollX).toBeGreaterThan(100);
  await page.keyboard.down('d');
  await page.waitForTimeout(300);
  await page.keyboard.up('d');
  expect((await sceneState(page)).x).toBeLessThanOrEqual(411);
  await page.keyboard.press('r');
  await settle(page);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v2-game.png' });
  expect(errors).toEqual([]);
});

for (const [kind, ms] of [
  ['iron', 2000],
  ['tungsten', 3500],
] as const) {
  test(`${kind}: tiempo real ${ms}ms, grietas, impactos, una unidad y desgaste`, async ({
    page,
  }) => {
    test.setTimeout(25000);
    await prepareTool(page, kind);
    await aim(page, 424, 152);
    const started = Date.now();
    await page.mouse.down();
    await expect
      .poll(async () => (await sceneState(page)).progress)
      .toBeGreaterThan(0.05);
    const frames = new Set<number>();
    // Muestreo amplio: bajo carga cada lectura puede tardar varios cuadros.
    for (let i = 0; i < 10; i++) {
      frames.add((await sceneState(page)).frame);
      await page.waitForTimeout(45);
    }
    expect(frames.size).toBeGreaterThan(2);
    await page.waitForTimeout(Math.max(0, ms - (Date.now() - started) - 400));
    expect((await sceneState(page)).count).toBe(0);
    await expect
      .poll(async () => (await sceneState(page)).count, {
        timeout: 3000,
        intervals: [50],
      })
      .toBe(1);
    const duration = Date.now() - started;
    expect(duration).toBeGreaterThanOrEqual(ms - 50);
    expect(duration).toBeLessThan(ms + 1500);
    await page.waitForTimeout(200);
    await page.mouse.up();
    const state = await sceneState(page);
    // V11: la tierra excavada se apila como material de construcción.
    expect(state.inventory).toEqual([]);
    expect(state.dirt).toBe(1);
    expect(state.tools[0]!.durability).toBe(
      { iron: 25, tungsten: 50 }[kind] - 1,
    );
    const collision = await page.evaluate(() => {
      const s = window.__MINA_GAME__.scene.getScene(
        'MiningScene',
      ) as MiningScene;
      return [
        s.session.grid.get(26, 9),
        s.terrain.tileAt(26, 9)?.collides ?? false,
      ];
    });
    expect(collision).toEqual([-1, false]);
  });
}

test('cancelacion por soltar, cambiar herramienta, alejarse y carga llena', async ({
  page,
}) => {
  await prepareTool(page, 'tungsten');
  await aim(page, 424, 152);
  await page.mouse.down();
  await page.waitForTimeout(900);
  expect((await sceneState(page)).progress).toBeGreaterThan(0.2);
  await page.mouse.up();
  await expect.poll(async () => (await sceneState(page)).progress).toBe(0);
  expect((await sceneState(page)).tools[0]!.durability).toBe(50);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.keyboard.down('a');
  await page.waitForTimeout(400);
  await page.keyboard.up('a');
  expect((await sceneState(page)).progress).toBe(0);
  await page.mouse.up();
  await prepareTool(page, 'iron');
  await aim(page, 424, 152);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.keyboard.press('3');
  expect((await sceneState(page)).progress).toBeLessThan(0.1);
  await page.mouse.up();
  await page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    s.session.inventory.items.push(...Array(50).fill('stone'));
  });
  await page.mouse.down();
  await page.waitForTimeout(2800);
  await page.mouse.up();
  expect((await sceneState(page)).count).toBe(0);
  expect((await sceneState(page)).inventory).toHaveLength(50);
});

test('rotura real y pala incapaz de romper roca', async ({ page }) => {
  await prepareTool(page, 'tungsten');
  await page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    s.session.tools.current!.durability = 1;
  });
  await aim(page, 424, 152);
  await page.mouse.down();
  await expect
    .poll(async () => (await sceneState(page)).count, { timeout: 5000 })
    .toBe(1);
  await page.mouse.up();
  expect((await sceneState(page)).equipped!.durability).toBe(0);
  await aim(page, 424, 136);
  await page.mouse.down();
  await page.waitForTimeout(2800);
  await page.mouse.up();
  expect((await sceneState(page)).count).toBe(1);
  await prepareTool(page, 'shovel', 408, 194);
  // Cuerpo en un hueco de fixture para verificar roca con alcance real.
  await page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    for (const r of [11, 12])
      for (const c of [24, 25]) {
        s.session.grid.set(c, r, -1);
        s.terrain.remove({ column: c, row: r });
      }
    s.miner.body.reset(400, 196);
  });
  await settle(page);
  await aim(page, 408, 216);
  await page.mouse.down();
  await page.waitForTimeout(1700);
  await page.mouse.up();
  expect((await sceneState(page)).count).toBe(1);
  expect((await sceneState(page)).equipped!.durability).toBe(40);
});

test('circuito real: excavar, cargar, empujar, vender, ampliar y guardar', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    for (const kind of ['iron', 'shovel', 'rail'] as const) s.session.buy(kind);
  });
  expect((await sceneState(page)).money).toBe(20);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  // La picota comprada queda en la mochila al comprar la pala. Vincularla por UI.
  await page.keyboard.press('Tab');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene)
            .inventory.open,
      ),
    )
    .toBe(true);
  const box = (await page.locator('canvas').boundingBox())!;
  const ui = (x: number, y: number) =>
    page.mouse.move(
      box.x + (x * box.width) / 480,
      box.y + (y * box.height) / 270,
      { steps: 5 },
    );
  await ui(172, 74);
  await page.mouse.down();
  await ui(176, 196);
  await page.mouse.up();
  await page.keyboard.press('Tab');
  await moveTo(page, 402);
  await page.keyboard.press('1');
  // La prueba de transporte requiere mena. La veta natural depende de la semilla.
  await page.evaluate((ore) => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    s.session.grid.set(26, 9, ore);
    s.session.visibility.reveal(26, 9);
    s.terrain.redraw({ column: 26, row: 9 });
  }, Block.Copper);
  await aim(page, 424, 152);
  await page.mouse.down();
  await expect
    .poll(async () => (await sceneState(page)).count, { timeout: 13000 })
    .toBe(1);
  await page.mouse.up();
  // Primer tramo libre antes del frente excavado.
  await moveTo(page, 391);
  await expect
    .poll(async () => (await sceneState(page)).selected)
    .toBe('rail-25');
  await page.keyboard.press('z');
  await expect.poll(async () => (await sceneState(page)).building).toBe(true);
  await page.keyboard.down('z');
  await page.waitForTimeout(350);
  await page.keyboard.up('z');
  await expect.poll(async () => (await sceneState(page)).rails).toBe(16);
  expect((await sceneState(page)).railStock).toBe(0);
  await moveTo(page, 264);
  await expect.poll(async () => (await sceneState(page)).selected).toBe('cart');
  await page.keyboard.press('z');
  await expect.poll(async () => (await sceneState(page)).loading).toBe(true);
  const frames = new Set<number>();
  // Carga de 2 s por bloque: una muestra cada 220 ms recorre la animación.
  for (let i = 0; i < 7; i++) {
    frames.add((await sceneState(page)).frame);
    await page.waitForTimeout(220);
  }
  await expect
    .poll(async () => (await sceneState(page)).cart.length, { timeout: 8000 })
    .toBe(1);
  expect(frames.size).toBeGreaterThanOrEqual(4);
  // Cerca de la pila puede seleccionarse recoger; cargar el bloque personal con el carro seleccionado.
  if ((await sceneState(page)).inventory.length) {
    await moveTo(page, 230);
    await page.keyboard.press('z');
    await expect
      .poll(async () => (await sceneState(page)).inventory.length, {
        timeout: 8000,
      })
      .toBe(0);
  }
  await moveTo(page, 278);
  await page.keyboard.press('c');
  await expect.poll(async () => (await sceneState(page)).pushing).toBe(true);
  const before = await sceneState(page);
  await page.keyboard.down('a');
  await page.waitForFunction(
    () =>
      (window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene)
        .session.cart.x <= 187,
    undefined,
    { timeout: 8000 },
  );
  await page.keyboard.up('a');
  await page.keyboard.press('z');
  expect((await sceneState(page)).cartX).toBeLessThan(before.cartX - 40);
  await moveTo(page, 174);
  await page.keyboard.press('u');
  await page.waitForTimeout(250);
  await page.keyboard.press('v');
  await page.keyboard.press('Enter');
  await page.keyboard.press('u');
  await expect
    .poll(async () => (await sceneState(page)).money)
    .toBeGreaterThan(0);
  expect((await sceneState(page)).cart).toHaveLength(0);
  await page.keyboard.press('g');
  const saved = await sceneState(page);
  await page.reload();
  await settle(page);
  const loaded = await sceneState(page);
  expect(loaded.money).toBe(saved.money);
  expect(loaded.tools).toEqual(saved.tools);
  expect(loaded.rails).toBe(16);
  expect(loaded.count).toBe(1);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v2-delivery.png' });
});

test('pala cancelable, carro lleno, retirada limitada y extremos ferroviarios', async ({
  page,
}) => {
  await prepareTool(page, 'shovel', 229, 148);
  await page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    s.session.inventory.items.push('coal', 'stone', 'dirt', 'gold');
  });
  await page.keyboard.press('z');
  await page.waitForTimeout(450);
  await page.keyboard.press('Escape');
  expect((await sceneState(page)).inventory).toHaveLength(4);
  expect((await sceneState(page)).cart).toHaveLength(0);
  expect((await sceneState(page)).equipped!.durability).toBe(40);
  await page.keyboard.press('z');
  await expect
    .poll(async () => (await sceneState(page)).cart.length, { timeout: 8000 })
    .toBe(1);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v2-cart.png' });
  await page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    s.session.cart.inventory.items.push(...Array(99).fill('stone'));
  });
  await page.keyboard.press('z');
  await expect
    .poll(async () => (await sceneState(page)).cart.length, { timeout: 8000 })
    .toBe(100);
  expect((await sceneState(page)).inventory).toHaveLength(3);
  // V5: retirar carga del carro pasa a la tecla V (X es desmontar).
  await page.keyboard.press('v');
  await expect
    .poll(async () => (await sceneState(page)).inventory.length)
    .toBe(50);
  // 100 kg en el carro menos los 47 kg que caben encima del minero.
  expect((await sceneState(page)).cart).toHaveLength(53);
  await page.keyboard.press('c');
  await expect.poll(async () => (await sceneState(page)).pushing).toBe(true);
  await page.keyboard.down('d');
  await page.waitForTimeout(4500);
  await page.keyboard.up('d');
  expect((await sceneState(page)).cartX).toBeLessThanOrEqual(
    25 * 16 - CART.railMargin,
  );
  expect((await sceneState(page)).cartX).toBeGreaterThan(300);
});

test('recursos normalizados, animaciones, escala estrecha y rendimiento local', async ({
  page,
}, testInfo) => {
  const art = await page.evaluate((colors) => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    const bad: string[] = [];
    // V13: el minero y sus capas de EPP vuelven a la paleta de 49 colores.
    const outOfPalette: string[] = [];
    for (const key of [
      'miner',
      'miner-unarmed',
      'miner-shovel',
      'miner-tungsten',
      'miner-axe',
      'miner-ppe',
      'interaction-items',
      'items-v3',
      'world-v3',
      'fan-aux',
      'fan-main',
    ]) {
      const source = s.textures.get(key).getSourceImage() as HTMLImageElement;
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(source, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] !== 0 && data[i + 3] !== 255) {
          bad.push(`${key}: alpha`);
          break;
        }
        if (
          data[i + 3] &&
          !outOfPalette.includes(key) &&
          !(colors as number[]).includes(
            data[i]! * 65536 + data[i + 1]! * 256 + data[i + 2]!,
          )
        ) {
          bad.push(`${key}: palette`);
          break;
        }
      }
    }
    return {
      bad,
      frames: s.textures.get('miner').getFrameNames().length,
      text: s.children.list.filter((o) => o.type === 'Text').length,
    };
  }, Object.values(PALETTE));
  expect(art.bad).toEqual([]);
  expect(art.frames).toBe(54);
  expect(art.text).toBe(0);
  await page.setViewportSize({ width: 390, height: 650 });
  expect((await page.locator('canvas').boundingBox())!.width).toBe(480);
  await page.screenshot({
    path: 'docs/screenshots/v2-narrow.png',
    fullPage: true,
  });
  const timing = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const start = performance.now();
        let frames = 0;
        const tick = () => {
          if (++frames === 120) resolve(performance.now() - start);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  await testInfo.attach('rendimiento-local', {
    body: JSON.stringify({ frames: 120, ms: timing, fps: 120000 / timing }),
    contentType: 'application/json',
  });
  expect(timing).toBeLessThan(15000);
});

test('carro artesanal: mitad del minero, ruedas sobre el riel y empuje Z', async ({
  page,
}) => {
  const geometry = await page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    const cart = s.scenery.cart;
    // Altura visible real del minero: filas con algún píxel opaco en su cuadro.
    const source = s.textures.get('miner').getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    // El minero (V13): cuadros de 32 × 32.
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0, 32, 32, 0, 0, 32, 32);
    const data = ctx.getImageData(0, 0, 32, 32).data;
    let top = 32,
      bottom = 0,
      left = 32,
      right = 0;
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++)
        if (data[(y * 32 + x) * 4 + 3]) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
    return {
      minerHeight: bottom - top + 1,
      minerWidth: right - left + 1,
      bodyWidth: cart.displayWidth,
      bodyHeight: cart.displayHeight,
      bodyTop: cart.y,
      cartY: s.session.cart.y,
      scale: [cart.scaleX, cart.scaleY],
      railTop: (s.session.rails.segments[0]!.row + 1) * 16 - 4,
    };
  });
  // Escala 1: el carro se reduce en su dibujo, no deformando la imagen.
  expect(geometry.scale).toEqual([1, 1]);
  expect(geometry.bodyWidth).toBe(CART.width);
  expect(geometry.bodyHeight).toBe(CART.bodyHeight);
  expect(geometry.bodyTop).toBe(CART.bodyOffset);
  expect(geometry.cartY).toBe(geometry.railTop);
  const ratio = CART.height / geometry.minerHeight;
  // El minero mide unos 16 × 24 px con el pico: el carro es ≈ 40–55 % de su alto.
  expect(ratio).toBeGreaterThanOrEqual(0.4);
  expect(ratio).toBeLessThanOrEqual(0.56);
  expect(CART.width / geometry.minerWidth).toBeGreaterThanOrEqual(1.1);
  expect(CART.width / geometry.minerWidth).toBeLessThanOrEqual(1.8);
  // Última fila de las ruedas sobre la cabeza del riel: ni flota ni se hunde.
  expect(CART.wheelTop + CART.wheelSize - 1).toBe(geometry.railTop);
  expect(CART.bodyTop + CART.height - 1).toBe(geometry.railTop);
  // Empuje real con Z a un costado del carro y avance por la vía.
  await moveTo(page, 230);
  await expect.poll(async () => (await sceneState(page)).selected).toBe('cart');
  await page.keyboard.press('z');
  await expect.poll(async () => (await sceneState(page)).pushing).toBe(true);
  const start = (await sceneState(page)).cartX;
  await page.keyboard.down('d');
  await page.waitForTimeout(900);
  await page.keyboard.up('d');
  const pushed = await sceneState(page);
  expect(pushed.cartX).toBeGreaterThan(start + 15);
  expect(Math.abs(pushed.cartX - CART.pushOffset - pushed.x)).toBeLessThan(4);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v3-cart-push.png' });
  await page.keyboard.press('z');
  await expect.poll(async () => (await sceneState(page)).pushing).toBe(false);
});

test('iluminacion: superficie, bocamina, galeria, giro, muro, excavacion y HUD', async ({
  page,
}) => {
  test.setTimeout(40000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // 1. Superficie con luz natural y lámpara apagada.
  let light = await lightState(page, [[208, 60]]);
  expect(light.zone).toBe('surface');
  expect(light.power).toBe(0);
  expect(light.head).toBe(1);
  expect(light.points[0]).toBe(1);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v3-surface.png' });
  // 2-3. Bocamina: transición y encendido automático.
  await moveTo(page, 316);
  light = await lightState(page);
  expect(light.zone).toBe('entrance');
  // La zona sale de la luz natural; la cabeza ya la ilumina el casco.
  expect(light.head).toBeGreaterThan(0.12);
  await moveTo(page, 376);
  await expect.poll(async () => (await lightState(page)).zone).toBe('gallery');
  await expect.poll(async () => (await lightState(page)).power).toBe(1);
  // 4-5. El casco ilumina en círculo a su alrededor y se apaga de a poco;
  // más allá, oscuridad.
  light = await lightState(page, [
    [376, 200],
    [376 + 34, 140],
  ]);
  expect(light.ahead).toBeGreaterThan(0.6);
  expect(light.behind).toBeGreaterThan(0.6);
  expect(light.points[0]).toBeLessThan(0.1);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v3-gallery-right.png' });
  // 6. Al girar la luz sigue al minero: el cuadro no depende de la dirección.
  await page.keyboard.down('a');
  await page.waitForTimeout(60);
  await page.keyboard.up('a');
  await page.waitForTimeout(80);
  light = await lightState(page);
  expect(light.ahead).toBeGreaterThan(0.6);
  expect(light.behind).toBeGreaterThan(0.6);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v3-gallery-left.png' });
  // 7-8. Vuelve a la derecha frente al muro: la cara se ilumina, el bloque de
  // detrás no.
  await prepareTool(page, 'tungsten');
  await moveTo(page, 403);
  light = await lightState(page, [
    [420, 146],
    [440, 146],
  ]);
  expect(light.points[0]).toBeGreaterThan(0.3);
  expect(light.points[1]).toBeLessThan(0.1);
  // 9. Excavar abre paso a la luz.
  await aim(page, 424, 152);
  await page.mouse.down();
  await expect
    .poll(async () => (await sceneState(page)).count, { timeout: 5000 })
    .toBe(1);
  await page.mouse.up();
  await page.waitForTimeout(100);
  light = await lightState(page, [
    [424, 150],
    // Cara recién expuesta del bloque siguiente, dentro del desvanecido del casco.
    [434, 150],
  ]);
  expect(light.points[0]).toBeGreaterThan(0.6);
  expect(light.points[1]).toBeGreaterThan(0.15);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v3-dug-face.png' });
  // 10. Al alejarse, la luz del casco deja la zona (no es niebla de guerra);
  // ahí solo queda la de las antorchas fijas de la galería.
  const helmetAt = (x: number, y: number) =>
    page.evaluate(
      ({ x, y }) =>
        (
          window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene
        ).lighting.lamp.light(x, y),
      { x, y },
    );
  expect(await helmetAt(424, 150)).toBeGreaterThan(0.5);
  await moveTo(page, 330);
  // A 120 px de la lámpara (alcance radial: 104 px) ya no queda luz del casco.
  expect(await helmetAt(450, 150)).toBe(0);
  // 11. HUD y guía por encima de la oscuridad.
  await page.keyboard.press('h');
  const depths = await page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    return {
      lighting: s.lighting.darkness.image.depth,
      hud: Math.min(
        ...s.children.list
          .filter(
            (o) =>
              'scrollFactorX' in o &&
              (o as unknown as { scrollFactorX: number }).scrollFactorX === 0 &&
              (o as unknown as { depth: number }).depth >= 1000,
          )
          .map((o) => (o as unknown as { depth: number }).depth),
      ),
    };
  });
  expect(depths.lighting).toBe(DEPTH.lighting);
  expect(depths.hud).toBeGreaterThan(depths.lighting);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v3-help-underground.png' });
  await page.keyboard.press('h');
  // 12. Sin franjas al mover la cámara: la oscuridad siempre cubre la vista.
  await page.keyboard.down('d');
  const coverage = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const s = window.__MINA_GAME__.scene.getScene(
          'MiningScene',
        ) as MiningScene;
        let ok = true,
          frames = 0;
        const tick = () => {
          const d = s.lighting.darkness,
            c = s.cameras.main;
          ok &&=
            d.image.x <= Math.floor(c.scrollX) &&
            d.image.y <= Math.floor(c.scrollY) &&
            d.image.x + d.columns * 4 >= Math.ceil(c.scrollX) + 480 &&
            d.image.y + d.rows * 4 >= Math.ceil(c.scrollY) + 270;
          if (++frames === 60) resolve(ok);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.keyboard.up('d');
  expect(coverage).toBe(true);
  expect(errors).toEqual([]);
});

test('zona profunda: oscuridad total fuera del haz', async ({ page }) => {
  await page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    for (let c = 30; c <= 44; c++)
      for (const r of [22, 23]) {
        s.session.grid.set(c, r, -1);
        s.terrain.remove({ column: c, row: r });
      }
    s.lighting.terrainChanged();
    s.miner.body.reset(34 * 16 + 8, 23 * 16 + 4);
    s.miner.setFlipX(false);
  });
  await settle(page);
  await expect.poll(async () => (await lightState(page)).zone).toBe('deep');
  await expect.poll(async () => (await lightState(page)).power).toBe(1);
  const light = await lightState(page, [
    [34 * 16 + 28, 23 * 16 + 4],
    [34 * 16 + 56, 23 * 16 + 4],
    [31 * 16, 23 * 16 + 4],
    [34 * 16, 26 * 16],
  ]);
  // Luz radial: plena junto al casco, se apaga con la distancia, igual delante
  // y detrás del minero, y oscuridad total bajo el suelo (la roca la corta).
  expect(light.points[0]).toBeGreaterThan(0.8);
  expect(light.points[1]).toBeGreaterThan(0.05);
  expect(light.points[1]).toBeLessThan(light.points[0]!);
  expect(light.points[2]).toBeGreaterThan(0.05);
  expect(Math.abs(light.points[2]! - light.points[1]!)).toBeLessThan(0.2);
  expect(light.points[3]).toBeLessThan(0.05);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v3-deep.png' });
});
