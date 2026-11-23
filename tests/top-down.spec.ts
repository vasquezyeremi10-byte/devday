import { expect, test, type Page } from '@playwright/test';
import { PLAYER, VIEW } from '../src/game/config/constants';
import type { TopDownScene } from '../src/game/scenes/TopDownScene';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import { CAMP_DOORS } from '../src/game/config/topDownCamp';

const place = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([x, y]) => {
      const scene = window.__MINA_GAME__.scene.getScene(
        'TopDownScene',
      ) as TopDownScene;
      scene.miner.body.reset(x!, y!);
    },
    [x, y],
  );

const state = (page: Page) =>
  page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene(
      'TopDownScene',
    ) as TopDownScene;
    const { miner } = scene;
    const { body } = miner;
    const camera = scene.cameras.main;
    return {
      x: miner.x,
      y: miner.y,
      depth: miner.depth,
      animation: miner.anims.currentAnim?.key,
      speed: body.velocity.length(),
      upBlocked: body.blocked.up,
      body: {
        top: body.top,
        bottom: body.bottom,
        left: body.left,
        right: body.right,
      },
      gravity: body.allowGravity,
      camera: {
        x: camera.scrollX,
        y: camera.scrollY,
        width: camera.width,
        height: camera.height,
        roundPixels: camera.roundPixels,
      },
    };
  });

test.beforeEach(async ({ page }) => {
  await page.goto('/?view=top-down');
  await expect(page.locator('#game-status')).toContainText('CAMPAMENTO');
});

test('WASD y flechas caminan y conservan la orientación en reposo', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const initial = await state(page);
  const plants = await page.evaluate(() => {
    const camp = window.__MINA_GAME__.scene.getScene('TopDownScene') as TopDownScene;
    return camp.children.list.flatMap((object) => {
      const image = object as Phaser.GameObjects.Image;
      if (image.texture?.key === 'trees' || image.texture?.key === 'flora') return [image.frame.name];
      return [];
    });
  });
  expect(plants).toEqual(expect.arrayContaining([
    'tree', 'tree_spread', 'cachiyuyo', 'brea', 'grama_salada', 'cojin_atacameno',
  ]));
  await page.locator('#game canvas').screenshot({ path: testInfo.outputPath('flora-cenital.png') });
  expect(initial.gravity).toBe(false);
  expect(initial.animation).toBe('top-down-idle-down');
  expect(initial.body.right - initial.body.left).toBe(10);
  expect(initial.body.bottom - initial.body.top).toBe(6);

  for (const [key, direction, axis, sign] of [
    ['w', 'up', 'y', -1],
    ['s', 'down', 'y', 1],
    ['a', 'left', 'x', -1],
    ['d', 'right', 'x', 1],
    ['ArrowUp', 'up', 'y', -1],
    ['ArrowDown', 'down', 'y', 1],
    ['ArrowLeft', 'left', 'x', -1],
    ['ArrowRight', 'right', 'x', 1],
  ] as const) {
    // Cada tecla parte del claro para que un cuadro lento no alcance un sólido.
    await place(page, 472, 430);
    const before = await state(page);
    await page.keyboard.down(key);
    await expect
      .poll(async () => {
        const current = await state(page);
        return (
          sign * (current[axis] - before[axis]) > 6 &&
          current.animation === `top-down-walk-${direction}`
        );
      })
      .toBe(true);
    await page.keyboard.up(key);
    await expect
      .poll(async () => (await state(page)).animation)
      .toBe(`top-down-idle-${direction}`);
  }
  expect(errors).toEqual([]);
});

test('normaliza la diagonal y la cámara sigue ambos ejes dentro del mapa', async ({
  page,
}) => {
  const initial = await state(page);
  await page.keyboard.down('d');
  await expect
    .poll(async () => (await state(page)).speed)
    .toBeCloseTo(PLAYER.speed, 2);
  await page.keyboard.down('s');
  await expect
    .poll(async () => (await state(page)).y)
    .toBeGreaterThan(initial.y + 20);
  const moving = await state(page);
  expect(moving.speed).toBeCloseTo(PLAYER.speed, 2);
  expect(moving.camera.x).toBeGreaterThan(initial.camera.x + 10);
  expect(moving.camera.y).toBeGreaterThan(initial.camera.y + 10);
  expect(moving.camera.width).toBe(VIEW.width);
  expect(moving.camera.height).toBe(VIEW.height);
  expect(moving.camera.roundPixels).toBe(true);
  await page.keyboard.up('d');
  await page.keyboard.up('s');
  await page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene(
      'TopDownScene',
    ) as TopDownScene;
    scene.miner.body.reset(955, 640);
  });
  await expect
    .poll(async () => (await state(page)).camera)
    .toMatchObject({
      x: 960 - VIEW.width,
      y: 640 - VIEW.height,
    });
  expect((await state(page)).body.right).toBeLessThanOrEqual(960);
  expect((await state(page)).body.bottom).toBeLessThanOrEqual(640);
});

test('la huella choca con la cabaña y la rodea en diagonal para pasar detrás', async ({
  page,
}) => {
  await place(page, 304, 304);
  await page.keyboard.down('w');
  await expect.poll(async () => (await state(page)).upBlocked).toBe(true);
  const inFront = await state(page);
  expect(inFront.body.top).toBeCloseTo(272);
  expect(inFront.depth).toBeGreaterThan(272);

  await page.keyboard.down('d');
  // Al salir por la esquina, el pie puede subir una vez libre del borde.
  await expect
    .poll(async () => {
      const { body } = await state(page);
      return body.top < 272 && body.left >= 352;
    })
    .toBe(true);
  await page.keyboard.up('d');
  await expect
    .poll(async () => (await state(page)).body.bottom)
    .toBeLessThan(224);
  await page.keyboard.up('w');

  await page.keyboard.down('a');
  await expect.poll(async () => (await state(page)).x).toBeLessThan(335);
  await page.keyboard.up('a');
  expect((await state(page)).depth).toBeLessThan(272);

  // Desde el otro lado, la diagonal que apunta a la esquina también se bloquea.
  await expect.poll(async () => (await state(page)).speed).toBe(0);
  await page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene(
      'TopDownScene',
    ) as TopDownScene;
    scene.miner.body.reset(363, 212);
  });
  await page.keyboard.down('a');
  await page.keyboard.down('s');
  await expect.poll(async () => (await state(page)).x).toBeLessThan(335);
  const behind = await state(page);
  expect(behind.body.bottom).toBeCloseTo(224);
  expect(behind.depth).toBeLessThan(272);
  await page.keyboard.up('a');
  await page.keyboard.up('s');
});

for (const door of CAMP_DOORS.filter(({ id }) => id !== 'cabin')) {
  test(`Z conecta ${door.label} con su destino lateral`, async ({ page }) => {
    await page.keyboard.press('z');
    expect(await page.locator('#game-status').textContent()).toContain(
      'CAMPAMENTO',
    );
    await place(page, door.x, door.y + 2);
    const label = door.id === 'warehouse' ? 'ABRIR BODEGA' : door.label;
    await expect(page.locator('#game-status')).toHaveText(`[Z] ${label}`);
    await page.keyboard.press('z');
    await expect(page.locator('#game-status')).toContainText('Mina lista', {
      timeout: 20_000,
    });
    await page.keyboard.press('1', { delay: 75 });
    await expect
      .poll(() =>
        page.evaluate((arrival) => {
          const scene = window.__MINA_GAME__.scene.getScene(
            'MiningScene',
          ) as MiningScene;
          if (arrival === 'warehouse') return scene.warehouse.open;
          const destination = scene.interactions.objects.get('mine-entrance')!;
          return scene.miner.x === destination.x - 16;
        }, door.arrival),
      )
      .toBe(true);
    await page.getByRole('button', { name: 'Volver al campamento' }).click();
    await expect(page.locator('#game-status')).toContainText('CAMPAMENTO');
  });
}
