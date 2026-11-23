import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import { WORLD, WORLD_FIRST_COLUMN } from '../src/game/config/constants';
import { surfaceRow } from '../src/game/world/TerrainGrid';

/**
 * Mundo abierto (18 de noviembre de 2026): una sola cuadrícula del borde
 * oeste al este. Se excava y se construye con entrada real (clic izquierdo
 * mantenido y clic derecho) en el campamento, en la Mano del Desierto y en
 * las zonas nuevas del oeste; lo hecho se guarda y vuelve al recargar.
 * Las posiciones del minero se preparan como fixture; cada acción es real.
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

const settle = (page: Page) =>
  expect.poll(() => scene(page, (s) => s.miner.body.blocked.down)).toBe(true);

type Cell = { column: number; row: number };

async function aimCell(page: Page, c: Cell) {
  const cam = await scene(page, (s) => ({
    x: s.cameras.main.scrollX,
    y: s.cameras.main.scrollY,
  }));
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(
    box.x + ((c.column * 16 + 8 - cam.x) * box.width) / 480,
    box.y + ((c.row * 16 + 8 - cam.y) * box.height) / 270,
  );
}

/** Coloca al minero en aire con suelo junto al objetivo (fixture). */
async function standNear(page: Page, c: Cell, mode: 'place' | 'mine') {
  const ok = await scene(
    page,
    (s, t) => {
      const g = s.session.grid;
      for (const dy of [0, -1, 1, 2, -2])
        for (const dx of [-1, 1, 0, -2, 2]) {
          const col = t.cell.column + dx,
            row = t.cell.row + dy;
          if (
            (dx === 0 && dy === 0) ||
            g.isSolid(col, row) ||
            g.isSolid(col, row - 1) ||
            !g.isSolid(col, row + 1)
          )
            continue;
          const origin = { x: col * 16 + 8, y: row * 16 + 8 };
          const reachable =
            t.mode === 'mine'
              ? s.mining.inspect(origin, t.cell) === 'ready'
              : Math.hypot(dx * 16, dy * 16) <= 36;
          if (!reachable) continue;
          s.miner.body.reset(col * 16 + 8, row * 16 + 4);
          s.miner.setVelocity(0, 0);
          return true;
        }
      return false;
    },
    { cell: c, mode },
  );
  expect(ok, `sin sitio para ${mode} ${c.column},${c.row}`).toBe(true);
  await settle(page);
  await page.waitForTimeout(250);
}

/** Mantiene el clic izquierdo sobre la celda hasta que quede vacía. */
async function dig(page: Page, c: Cell) {
  await standNear(page, c, 'mine');
  await aimCell(page, c);
  await page.mouse.down();
  try {
    await expect
      .poll(
        () =>
          scene(page, (s, t) => !s.session.grid.isSolid(t.column, t.row), c),
        { timeout: 9000, intervals: [80] },
      )
      .toBe(true);
  } finally {
    await page.mouse.up();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 30_000,
  });
  await settle(page);
  await page.keyboard.press('1');
  await scene(page, (s) => {
    s.session.buy('kit');
    s.session.firstDayDone = true;
    s.session.tools.add('iron');
    s.session.progression.level = 30;
    s.session.loadout.sync();
  });
});

test('se excava y se construye en el campamento, la Mano del Desierto y el oeste', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const world = await scene(page, (s) => ({
    first: s.session.grid.first,
    end: s.session.grid.end,
  }));
  expect(world).toEqual({ first: WORLD_FIRST_COLUMN, end: WORLD.columns });
  // Picota en la mano (tecla de su casilla en la barra rápida).
  const quick = await scene(page, (s) => {
    const l = s.session.loadout;
    const t = s.session.tools.items.find((x) => x.kind === 'iron')!;
    let i = l.quickbar.findIndex((q) => q?.type === 'tool' && q.id === t.id);
    if (i < 0) {
      i = l.quickbar.indexOf(null);
      l.assignQuick(i, { type: 'tool', id: t.id });
    }
    return i;
  });
  await page.keyboard.press(String(quick + 1));
  await expect
    .poll(() => scene(page, (s) => s.session.tools.current?.kind))
    .toBe('iron');

  // Campamento (antes suelo fijo), Mano del Desierto y Salar de Atacama.
  const spots = [-25, -70, WORLD_FIRST_COLUMN + 40].map((column) => ({
    column,
    row: surfaceRow(column),
  }));
  for (const c of spots) {
    await dig(page, c);
    await dig(page, { column: c.column, row: c.row + 1 });
    if (c.column === -25)
      await page
        .locator('canvas')
        .first()
        .screenshot({ path: 'docs/screenshots/open-world-camp-dig.png' });
  }
  const dirt = await scene(page, (s) => s.session.supplies.mat_dirt);
  expect(dirt).toBeGreaterThan(0);

  // Construcción con clic derecho en el oeste: rellenar el pozo del salar.
  const west = spots[2]!;
  const hole = { column: west.column, row: west.row + 1 };
  const index = await scene(page, (s) =>
    s.session.loadout.quickbar.findIndex(
      (q) => q?.type === 'supply' && q.kind === 'mat_dirt',
    ),
  );
  expect(index).toBeGreaterThanOrEqual(0);
  await page.keyboard.press(String(index + 1));
  await expect.poll(() => scene(page, (s) => s.hud.activeSupply)).toBe(
    'mat_dirt',
  );
  await standNear(page, hole, 'place');
  await aimCell(page, hole);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(50);
  await page.mouse.up({ button: 'right' });
  await expect
    .poll(() =>
      scene(page, (s, t) => s.session.isPlaced(t), hole),
    )
    .toBe(true);
  // Las cordilleras del oeste se dibujan a demanda: al llegar, están a la vista.
  await expect
    .poll(() =>
      scene(page, (s) =>
        s.biomeBackdrop
          .stamped()
          .filter((l) => l.key.startsWith('v7-range')).length,
      ),
    )
    .toBeGreaterThanOrEqual(4);
  await page
    .locator('canvas')
    .first()
    .screenshot({ path: 'docs/screenshots/open-world-west-build.png' });
  // La región nueva se anuncia y queda registrada.
  expect(
    await scene(page, (s) => s.session.regions.snapshot().visited),
  ).toContain('salar');

  // Guardar y recargar: lo excavado y lo construido en columnas negativas vuelve.
  const saved = await scene(page, (s) => s['save']());
  expect(saved).toBe(true);
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 30_000,
  });
  const back = await scene(
    page,
    (s, list) => ({
      dug: list.cells.map((c) => s.session.grid.isSolid(c.column, c.row)),
      placed: s.session.isPlaced(list.hole),
      camp: s.session.grid.isSolid(-25, list.campRow + 1),
    }),
    { cells: spots, hole, campRow: spots[0]!.row },
  );
  expect(back).toEqual({ dug: [false, false, false], placed: true, camp: false });
});
