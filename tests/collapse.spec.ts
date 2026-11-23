import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';

/**
 * Derrumbes con física (16 de noviembre de 2026), en el navegador real:
 * advertencia de 10 s, desprendimiento y caída visibles, apilado como
 * escombro, golpe al minero según la velocidad, guardado y rendimiento. Las
 * galerías se excavan como fixture (igual que en v3.spec.ts); el reloj, la
 * caída, las colisiones y el daño son los del juego.
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

/** Excava por fixture y actualiza vista, sistemas y luz como en el juego. */
async function carve(
  page: Page,
  c0: number,
  c1: number,
  r0: number,
  r1: number,
) {
  await scene(
    page,
    (s, [c0, c1, r0, r1]) => {
      const list: { column: number; row: number }[] = [];
      for (let column = c0!; column <= c1!; column++)
        for (let row = r0!; row <= r1!; row++) list.push({ column, row });
      for (const c of list) {
        s.session.grid.set(c.column, c.row, -1);
        s.session.visibility.reveal(c.column, c.row);
      }
      s.session.afterTerrainChange(list);
      for (const c of list) s.terrain.redraw(c);
      s.lighting.terrainChanged();
    },
    [c0, c1, r0, r1],
  );
}

/** Estado del tramo de techo y del piso de una galería. */
const region = (
  page: Page,
  c0: number,
  c1: number,
  roof: number,
  floor: number,
) =>
  scene(
    page,
    (s, [c0, c1, roof, floor]) => {
      const g = s.session.grid;
      const out = { roofAir: [] as number[], rubble: [] as number[], total: 0 };
      for (let c = c0!; c <= c1!; c++) {
        if (g.get(c, roof!) === -1) out.roofAir.push(c);
        if (g.get(c, floor!) === 13) out.rubble.push(c);
      }
      for (let c = c0! - 3; c <= c1! + 3; c++)
        for (let r = roof! - 2; r <= floor! + 1; r++)
          if (g.get(c, r) === 13) out.total++;
      return out;
    },
    [c0, c1, roof, floor],
  );

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await settle(page);
  await page.keyboard.press('1');
  await scene(page, (s) => {
    for (const k of ['helmet', 'boots', 'vest', 'gloves', 'goggles'] as const)
      if (!s.session.loadout.equipped(k)) s.session.loadout.addPPE(k);
    // Las galerías de fixture quedan selladas: el aire viciado no es lo que
    // se prueba aquí (el único daño debe ser el del derrumbe).
    s.session.ventilation.at = () => 1;
  });
});

test('advertencia de 10 s, desprendimiento con caída acelerada, escombro y guardado', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Minero en el extremo de la galería: ese bloque de techo no se desprende.
  await scene(page, (s) => s.miner.body.reset(50 * 16 + 8, 15 * 16 + 4));
  await carve(page, 50, 61, 14, 15);
  await settle(page);
  const start = await scene(page, (s) => {
    const c = [...s.session.geotech.collapses.values()][0]!;
    return {
      remaining: c.remaining,
      total: c.total,
      n: s.session.geotech.collapses.size,
    };
  });
  expect(start.n).toBe(1);
  expect(start.total).toBe(10_000);
  expect(start.remaining).toBeGreaterThan(9_300);
  expect(start.remaining).toBeLessThanOrEqual(10_000);
  await expect
    .poll(() => scene(page, (s) => s.hud.alarmText))
    .toMatch(/DERRUMBE EN: (10|9) SEGUNDOS/);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/collapse-warning.png' });

  // Reloj real desde el aviso hasta el desprendimiento, y muestreo por cuadro
  // de un bloque mientras cae.
  const run = await page.evaluate(
    () =>
      new Promise<{
        waited: number;
        loosening: number;
        samples: { y: number; vy: number }[];
        peak: number;
      }>((resolve) => {
        const s = window.__MINA_GAME__.scene.getScene(
          'MiningScene',
        ) as MiningScene;
        const t0 = performance.now();
        // Lo que ya corrió de la advertencia antes de empezar a medir.
        const remaining = [...s.session.geotech.collapses.values()][0]!
          .remaining;
        let waited = 0,
          loosening = 0,
          peak = 0,
          tracked = -1;
        const samples: { y: number; vy: number }[] = [];
        const tick = () => {
          const blocks = s.session.falling.blocks;
          if (!waited && blocks.length) {
            waited = performance.now() - t0 + (10_000 - remaining);
            // El bloque del centro: el primero en soltarse.
            tracked = [...blocks].sort((a, b) => a.delay - b.delay)[0]!.id;
          }
          if (waited) {
            peak = Math.max(peak, blocks.length);
            const b = blocks.find((x) => x.id === tracked);
            if (b) {
              if (b.delay > 0) loosening++;
              else samples.push({ y: b.y, vy: b.vy });
            }
            if (!blocks.length)
              return resolve({ waited, loosening, samples, peak });
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  // 10 segundos: ni antes ni mucho después (margen de cuadros y de muestreo).
  expect(run.waited).toBeGreaterThan(9_700);
  expect(run.waited).toBeLessThan(10_900);
  expect(run.peak).toBe(10);
  // Primero se afloja en su sitio; después cae de verdad, sin saltos.
  expect(run.loosening).toBeGreaterThan(2);
  expect(run.samples.length).toBeGreaterThan(6);
  for (let i = 1; i < run.samples.length; i++) {
    expect(run.samples[i]!.y).toBeGreaterThan(run.samples[i - 1]!.y);
    expect(run.samples[i]!.vy).toBeGreaterThanOrEqual(run.samples[i - 1]!.vy);
    expect(run.samples[i]!.y - run.samples[i - 1]!.y).toBeLessThan(16);
  }
  // Acelera: el último tramo es más rápido que el primero.
  const last = run.samples[run.samples.length - 1]!;
  expect(last.vy).toBeGreaterThan(run.samples[0]!.vy + 60);

  // Asentado: el techo subió un bloque y el escombro obstruye el piso.
  const after = await region(page, 50, 61, 13, 15);
  expect(after.roofAir).toEqual([51, 52, 53, 54, 55, 56, 57, 58, 59, 60]);
  expect(after.rubble).toEqual([51, 52, 53, 54, 55, 56, 57, 58, 59, 60]);
  expect(after.total).toBe(10);
  const state = await scene(page, (s) => ({
    hp: s.session.health.hp,
    suspended: s.session.geotech.suspended,
    view: s.fallingView.counts,
    collides: !!s.terrain.tileAt(55, 15)?.collides,
    frame: s.terrain.tileAt(55, 15)?.index ?? -1,
    open: s.terrain.tileAt(55, 13) === null,
  }));
  expect(state.hp).toBe(100);
  expect(state.suspended).toBe(false);
  expect(state.view.live).toBe(0);
  expect(state.view.pooled).toBe(10);
  expect(state.collides).toBe(true);
  expect(state.open).toBe(true);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/collapse-settled.png' });

  // El escombro se despeja con la pala, como cualquier bloque.
  await scene(page, (s) => {
    s.session.tools.add('shovel');
    s.session.loadout.sync();
    s.session.loadout.equipToolKind('shovel');
  });
  const box = (await page.locator('canvas').boundingBox())!;
  const cam = await scene(page, (s) => ({
    x: s.cameras.main.scrollX,
    y: s.cameras.main.scrollY,
  }));
  await page.mouse.move(
    box.x + ((51 * 16 + 8 - cam.x) * box.width) / 480,
    box.y + ((15 * 16 + 8 - cam.y) * box.height) / 270,
  );
  const stone = await scene(page, (s) => s.session.supplies.mat_stone);
  await page.mouse.down();
  await expect
    .poll(() => scene(page, (s) => s.session.grid.isSolid(51, 15)), {
      timeout: 9_000,
    })
    .toBe(false);
  await page.mouse.up();
  expect(await scene(page, (s) => s.session.supplies.mat_stone)).toBe(
    stone + 1,
  );

  // Guardar y recargar: el mundo queda como lo dejó el derrumbe.
  expect(await scene(page, (s) => s.save())).toBe(true);
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  const loaded = await region(page, 50, 61, 13, 15);
  expect(loaded.roofAir).toEqual(after.roofAir);
  expect(loaded.rubble).toEqual([52, 53, 54, 55, 56, 57, 58, 59, 60]);
  expect(errors).toEqual([]);
});

test('un soporte suficiente antes de los 10 s cancela el derrumbe', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await scene(page, (s) => s.miner.body.reset(208, 148));
  await carve(page, 50, 61, 14, 15);
  await page.waitForTimeout(4_000);
  const mid = await scene(
    page,
    (s) => [...s.session.geotech.collapses.values()][0]!.remaining,
  );
  expect(mid).toBeLessThan(6_500);
  expect(mid).toBeGreaterThan(5_000);
  await scene(page, (s) => {
    s.session.supports.install(
      s.session.grid,
      { column: 55, row: 15 },
      'steel',
    );
    s.session.geotech.evaluate();
  });
  expect(await scene(page, (s) => s.session.geotech.collapses.size)).toBe(0);
  // Pasados los 10 s no cae nada.
  await page.waitForTimeout(7_000);
  const after = await region(page, 50, 61, 13, 15);
  expect(after.roofAir).toEqual([]);
  expect(after.total).toBe(0);
  expect(await scene(page, (s) => s.session.falling.active)).toBe(false);
  // Retirar ese soporte crítico abre una advertencia nueva, completa.
  await scene(page, (s) => {
    s.session.supports.items = s.session.supports.items.filter(
      (x) => x.column !== 55,
    );
    s.session.geotech.evaluate();
  });
  const again = await scene(
    page,
    (s) => [...s.session.geotech.collapses.values()][0]!.remaining,
  );
  expect(again).toBeGreaterThan(9_300);
});

test('el bloque que cae sobre el minero lo golpea una vez, según su velocidad, y se parte', async ({
  page,
}) => {
  test.setTimeout(60_000);
  // Galería de tres bloques de alto: el techo cae desde más arriba.
  await carve(page, 62, 73, 14, 16);
  await scene(page, (s) => s.miner.body.reset(67 * 16 + 8, 16 * 16 + 4));
  await settle(page);
  await scene(page, (s) => {
    [...s.session.geotech.collapses.values()][0]!.remaining = 300;
  });
  await expect
    .poll(() => scene(page, (s) => s.session.falling.active))
    .toBe(true);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/collapse-falling.png' });
  await expect
    .poll(() => scene(page, (s) => s.session.falling.active), {
      timeout: 8_000,
    })
    .toBe(false);
  const hit = await scene(page, (s) => ({
    hp: s.session.health.hp,
    dead: s.session.health.dead,
    source: s.session.health.lastSource,
    under: s.session.grid.get(67, 16),
    left: s.session.grid.get(66, 16),
    right: s.session.grid.get(68, 16),
    grounded: s.miner.body.blocked.down,
    x: s.miner.x,
  }));
  // Un solo golpe (≈190 px/s con casco): fuerte, pero no letal con salud plena.
  expect(hit.dead).toBe(false);
  expect(hit.source).toBe('derrumbe');
  expect(hit.hp).toBeGreaterThan(35);
  expect(hit.hp).toBeLessThan(60);
  // No queda enterrado: el bloque se partió; a los lados sí hay escombro.
  expect(hit.under).toBe(-1);
  expect(hit.left).toBe(13);
  expect(hit.right).toBe(13);
  expect(hit.grounded).toBe(true);
  const total = await region(page, 62, 73, 13, 16);
  expect(total.total).toBe(9);
});

test('guardar en plena caída: al recargar los bloques quedan asentados', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await scene(page, (s) => s.miner.body.reset(208, 148));
  // Cámara alta: los bloques tardan en llegar al piso.
  await carve(page, 50, 61, 14, 19);
  await scene(page, (s) => {
    [...s.session.geotech.collapses.values()][0]!.remaining = 200;
  });
  await expect
    .poll(() => scene(page, (s) => s.session.falling.blocks.length))
    .toBe(10);
  const saved = await scene(page, (s) => {
    const ok = s.save();
    const data = JSON.parse(localStorage.getItem('mina-cero.save.v6')!);
    return { ok, falling: data.falling?.length ?? 0, version: data.version };
  });
  expect(saved.ok).toBe(true);
  expect(saved.version).toBe(6);
  expect(saved.falling).toBeGreaterThan(0);
  // Se recarga con ese guardado (el cierre de la página puede reescribirlo
  // con menos bloques en el aire: el resultado asentado es el mismo).
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  const loaded = await region(page, 50, 61, 13, 19);
  expect(loaded.roofAir).toEqual([51, 52, 53, 54, 55, 56, 57, 58, 59, 60]);
  // Un escombro por columna, sobre el primer piso que encontró (una caverna
  // natural bajo la cámara puede dejarlo más abajo).
  const columns = await scene(page, (s) => {
    const out: number[] = [];
    for (let c = 50; c <= 61; c++) {
      let n = 0;
      for (let r = 13; r < 35; r++) if (s.session.grid.get(c, r) === 13) n++;
      out.push(n);
    }
    return out;
  });
  expect(columns).toEqual([0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0]);
  expect(await scene(page, (s) => s.session.falling.active)).toBe(false);
});

test('rendimiento: decenas de bloques desprendidos a la vez sin perder fluidez', async ({
  page,
}) => {
  test.setTimeout(90_000);
  // Galería de 98 de ancho y 5 de alto, en roca profunda; el minero mira.
  await carve(page, 150, 247, 20, 24);
  // En el extremo del tramo: ese bloque de techo queda colgado.
  await scene(page, (s) => s.miner.body.reset(150 * 16 + 8, 24 * 16 + 4));
  await page.waitForTimeout(600);
  const run = await page.evaluate(
    () =>
      new Promise<{ frames: number[]; peak: number; live: number; ms: number }>(
        (resolve) => {
          const s = window.__MINA_GAME__.scene.getScene(
            'MiningScene',
          ) as MiningScene;
          // Todos los tramos a la vez (una caverna natural puede partir el
          // techo en más de uno; la simulación admite hasta 96 bloques).
          for (const warning of s.session.geotech.collapses.values())
            warning.remaining = 100;
          const frames: number[] = [];
          let last = performance.now(),
            started = 0,
            peak = 0,
            live = 0;
          const tick = () => {
            const now = performance.now();
            const n = s.session.falling.blocks.length;
            if (n && !started) started = now;
            if (started) {
              frames.push(now - last);
              peak = Math.max(peak, n);
              live = Math.max(live, s.fallingView.counts.live);
              if (!n) return resolve({ frames, peak, live, ms: now - started });
            }
            last = now;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        },
      ),
  );
  expect(run.peak).toBeGreaterThanOrEqual(80);
  expect(run.peak).toBeLessThanOrEqual(96);
  expect(run.live).toBe(run.peak);
  const sorted = [...run.frames].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  console.log(
    `DERRUMBE ${run.peak} bloques: ${run.frames.length} cuadros en ${Math.round(run.ms)} ms, mediana ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`,
  );
  // Fluido: la mediana se mantiene sobre 40 FPS aun en la máquina de pruebas.
  expect(median).toBeLessThan(25);
  expect(p95).toBeLessThan(60);
  const after = await scene(page, (s) => {
    let rubble = 0;
    for (let c = 150; c <= 247; c++)
      for (let r = 19; r <= 33; r++)
        if (s.session.grid.get(c, r) === 13) rubble++;
    return {
      rubble,
      view: s.fallingView.counts,
      suspended: s.session.geotech.suspended,
    };
  });
  // Cada bloque desprendido es un escombro; las imágenes volvieron a la reserva.
  expect(after.rubble).toBe(run.peak);
  expect(after.view).toEqual({ live: 0, pooled: run.peak });
  expect(after.suspended).toBe(false);
});
