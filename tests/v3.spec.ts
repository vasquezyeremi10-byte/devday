import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import { TerrainFrame } from '../src/game/world/TerrainVisuals';

declare global {
  interface Window {
    __MINA_GAME__: Phaser.Game;
  }
}

/** Ejecuta código en la escena (preparación de fixtures y lectura de estado). */
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
async function moveTo(page: Page, x: number) {
  const start = await scene(page, (s) => s.miner.x);
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
async function pointAt(page: Page, x: number, y: number) {
  const cam = await scene(page, (s) => ({
    x: s.cameras.main.scrollX,
    y: s.cameras.main.scrollY,
  }));
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(
    box.x + ((x - cam.x) * box.width) / 480,
    box.y + ((y - cam.y) * box.height) / 270,
  );
}
async function rightClick(page: Page, x: number, y: number) {
  await pointAt(page, x, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(80);
}
/** Excava por fixture y actualiza vista, sistemas y luz como en el juego. */
async function carve(page: Page, cells: [number, number][]) {
  await scene(
    page,
    (s, cells) => {
      const list = cells.map(([column, row]) => ({ column, row }));
      for (const c of list) {
        s.session.grid.set(c.column, c.row, -1);
        s.session.visibility.reveal(c.column, c.row);
      }
      s.session.afterTerrainChange(list);
      for (const c of list) s.terrain.redraw(c);
      s.lighting.terrainChanged();
    },
    cells,
  );
}
const range = (c0: number, c1: number, r0: number, r1: number) => {
  const out: [number, number][] = [];
  for (let c = c0; c <= c1; c++)
    for (let r = r0; r <= r1; r++) out.push([c, r]);
  return out;
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await settle(page);
  // Modalidad Normal y EPP básico de fixture: el acceso se prueba en v4.spec.ts.
  await page.keyboard.press('1');
  await scene(page, (s) => {
    for (const k of ['helmet', 'boots', 'vest', 'gloves', 'goggles'] as const)
      if (!s.session.loadout.equipped(k)) s.session.loadout.addPPE(k);
  });
});

test('la entrada de la bocamina permanece estable aun con marcos antiguos rotos', async ({
  page,
}) => {
  await scene(page, (s) => {
    s.miner.body.reset(20 * 16 + 8, 9 * 16 + 4);
    for (const support of s.session.supports.items)
      if (support.fixed) support.durability = 0;
    s.session.geotech.evaluate();
  });
  await expect
    .poll(() => scene(page, (s) => s.hud.stripText))
    .toContain('TECHO ESTABLE');
  const state = await scene(page, (s) => ({
    collapses: s.session.geotech.collapses.size,
    air: Array.from({ length: 3 }, (_, i) =>
      Array.from({ length: 8 }, (_, j) => s.session.grid.get(18 + j, 7 + i)),
    ),
  }));
  expect(state.collapses).toBe(0);
  expect(state.air.flat().every((block) => block === -1)).toBe(true);
});

test('subsuelo oculto: sin menas ni cavernas visibles desde la superficie', async ({
  page,
}) => {
  const hidden = await scene(
    page,
    (s, ore) => {
      let ores = 0,
        leaked = 0;
      const g = s.session.grid;
      for (let r = 0; r < g.rows; r++)
        for (let c = g.first; c < g.end; c++) {
          const b = g.get(c, r);
          if (b < 3 || b > 11) continue;
          ores++;
          const index = s.terrain.tileAt(c, r)?.index ?? -1;
          if (index >= ore.first && index <= ore.first + 8) leaked++;
        }
      return {
        ores,
        leaked,
        deep: s.lighting.lightAt(208, 260),
        revealedDeep: s.session.visibility.has(13, 20),
      };
    },
    { first: TerrainFrame.OreFirst },
  );
  expect(hidden.ores).toBeGreaterThan(40);
  expect(hidden.leaked).toBe(0);
  expect(hidden.deep).toBe(0);
  expect(hidden.revealedDeep).toBe(false);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v3-hidden-subsoil.png' });
});

test('rampas de un bloque: perfil continuo, rechazo de dos y carro que sube', async ({
  page,
}) => {
  test.setTimeout(40000);
  // Escalón de un bloque al fondo de la galería y otro de dos más allá.
  await carve(page, [...range(26, 27, 6, 8), ...range(28, 28, 4, 6)]);
  const rails = await scene(page, (s) => {
    s.session.supplies.rail = 3;
    const ok = [
      s.session.build({ column: 25, row: 9 }),
      s.session.build({ column: 26, row: 8 }),
      s.session.build({ column: 27, row: 8 }),
    ];
    const r = s.session.rails;
    const end = r.ends().find((e) => e.column === 28);
    return {
      ok,
      mid: r.railY(25 * 16 + 8),
      low: r.railY(24 * 16 + 8),
      high: r.railY(27 * 16 + 8),
      slope: r.slopeAt(25 * 16 + 8),
      far: end?.target,
    };
  });
  expect(rails.ok).toEqual([true, true, true]);
  expect(rails.low).toBe(156);
  expect(rails.high).toBe(140);
  expect(rails.mid).toBe(148);
  expect(rails.slope).toBe(-1);
  expect(rails.far).toBe('DESNIVEL MAYOR A UN BLOQUE');
  // Empuje real: el carro sube la rampa y el minero sube el escalón detrás.
  await scene(page, (s) => {
    s.session.cart.x = 360;
    s.miner.body.reset(338, 148);
  });
  await settle(page);
  await page.keyboard.press('c');
  await expect
    .poll(() => scene(page, (s) => s.session.cart.pushing))
    .toBe(true);
  await page.keyboard.down('d');
  await page.waitForFunction(
    () =>
      (window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene)
        .session.cart.x >=
      26 * 16 + 8,
    undefined,
    { timeout: 8000 },
  );
  await page.waitForTimeout(400);
  const up = await scene(page, (s) => ({
    x: s.session.cart.x,
    y: s.session.cart.y,
    angle: s.session.cart.contact().angle,
    pushing: s.session.cart.pushing,
  }));
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v3-ramp.png' });
  await page.keyboard.up('d');
  expect(up.x).toBeGreaterThan(26 * 16);
  expect(up.y).toBeLessThan(156);
  expect(up.pushing).toBe(true);
});

test('sostenimiento: aviso de derrumbe, vigas con clic derecho y derrumbe local', async ({
  page,
}) => {
  test.setTimeout(60000);
  // Galería de 9 bloques bajo el cerro, sin vigas.
  await carve(page, [...range(30, 38, 13, 14)]);
  await scene(page, (s) => {
    s.miner.body.reset(31 * 16 + 8, 14 * 16 + 4);
    s.session.supplies.wood_beam = 2;
    s.hud.activeSupply = 'wood_beam';
  });
  await settle(page);
  await page.waitForTimeout(400);
  const before = await scene(page, (s) => ({
    collapses: s.session.geotech.collapses.size,
    alarm: s.hud.alarmText,
  }));
  expect(before.collapses).toBe(1);
  expect(before.alarm).toContain('DERRUMBE EN:');
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v3-collapse-warning.png' });
  await rightClick(page, 32 * 16 + 8, 14 * 16 + 8);
  await expect
    .poll(() => scene(page, (s) => s.session.supports.items.length))
    .toBe(3);
  await scene(page, (s) => s.miner.body.reset(35 * 16 + 8, 14 * 16 + 4));
  await settle(page);
  await rightClick(page, 36 * 16 + 8, 14 * 16 + 8);
  await expect
    .poll(() => scene(page, (s) => s.session.supports.items.length))
    .toBe(4);
  const after = await scene(page, (s) => ({
    supports: s.session.supports.items.length,
    collapses: s.session.geotech.collapses.size,
    stock: s.session.supplies.wood_beam,
  }));
  expect(after.supports).toBe(4);
  expect(after.stock).toBe(0);
  expect(after.collapses).toBe(0);
  // Otra galería sin sostener: el derrumbe ocurre solo al terminar la cuenta.
  await carve(page, [...range(50, 59, 14, 15)]);
  const t0 = await scene(page, (s) => {
    const c = [...s.session.geotech.collapses.values()][0]!;
    c.remaining = 1500;
    return c.span;
  });
  // El techo se desprende, cae y se asienta (derrumbes con física).
  await expect
    .poll(() => scene(page, (s) => s.session.falling.active), { timeout: 6_000 })
    .toBe(true);
  await expect
    .poll(() => scene(page, (s) => s.session.falling.active), { timeout: 8_000 })
    .toBe(false);
  const rubble = await scene(
    page,
    (s, span) => {
      let n = 0,
        outside = 0;
      for (let c = 40; c < 70; c++)
        for (let r = 10; r < 20; r++)
          if (s.session.grid.get(c, r) === 13) {
            n++;
            if (c < span.from || c > span.to) outside++;
          }
      return { n, outside };
    },
    t0,
  );
  expect(rubble.n).toBeGreaterThan(0);
  expect(rubble.outside).toBe(0);
});

test('tronadura: barreno, carga, mecha de 6 s, ≤3×3 irregular, sin duplicar', async ({
  page,
}) => {
  test.setTimeout(45000);
  await carve(page, [...range(30, 33, 13, 14)]);
  await scene(page, (s) => {
    s.session.progression.tier = 2;
    const drill = s.session.tools.add('drill');
    s.session.loadout.assignQuick(4, { type: 'tool', id: drill.id });
    s.session.supplies.dynamite = 2;
    s.session.supplies.fuse = 1;
    s.session.supports.install(s.session.grid, { column: 31, row: 14 }, 'wood');
    s.session.geotech.evaluate();
    s.miner.body.reset(32 * 16 + 8, 14 * 16 + 4);
    s.miner.setFlipX(false);
  });
  await settle(page);
  // Perforar con la herramienta 5 y el mouse mantenido 2,5 s.
  await page.keyboard.press('5');
  await pointAt(page, 34 * 16 + 8, 14 * 16 + 8);
  await page.mouse.down();
  await expect
    .poll(() => scene(page, (s) => s.session.blasting.drilled.size), {
      timeout: 5000,
    })
    .toBe(1);
  await page.mouse.up();
  const solidAround = await scene(page, (s) => {
    let n = 0;
    for (let c = 33; c <= 35; c++)
      for (let r = 13; r <= 15; r++) if (s.session.grid.isSolid(c, r)) n++;
    return { n, block: s.session.grid.get(34, 14) };
  });
  expect(solidAround.block).not.toBe(-1);
  await page.keyboard.press('q');
  await expect
    .poll(() => scene(page, (s) => s.hud.activeSupply))
    .toBe('dynamite');
  await rightClick(page, 34 * 16 + 8, 14 * 16 + 8);
  await rightClick(page, 34 * 16 + 8, 14 * 16 + 8);
  const lit = await scene(page, (s) => ({
    charges: s.session.blasting.charges.length,
    lit: s.session.blasting.charges[0]?.endsAt !== null,
    dynamite: s.session.supplies.dynamite,
    fuse: s.session.supplies.fuse,
    alarm: s.hud.alarmText,
  }));
  expect(lit).toMatchObject({ charges: 1, lit: true, dynamite: 1, fuse: 0 });
  expect(lit.alarm).toContain('ALEJATE DE LA ZONA DE TRONADURA');
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v3-fuse.png' });
  await moveTo(page, 30 * 16 + 8);
  await expect
    .poll(() => scene(page, (s) => s.session.blasting.blasts), {
      timeout: 9000,
    })
    .toBe(1);
  const result = await scene(page, (s) => {
    let n = 0;
    for (let c = 33; c <= 35; c++)
      for (let r = 13; r <= 15; r++) if (s.session.grid.isSolid(c, r)) n++;
    const pile = s.session.piles[s.session.piles.length - 1]!;
    return { solid: n, pile: pile.items.length, hp: s.session.health.hp };
  });
  const destroyed = solidAround.n - result.solid;
  expect(destroyed).toBeGreaterThan(0);
  expect(destroyed).toBeLessThan(9);
  expect(result.pile).toBe(destroyed);
  expect(result.hp).toBeGreaterThan(0);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v3-after-blast.png' });
});

test('ventilacion: aire peligroso daña con aviso y la superficie recupera', async ({
  page,
}) => {
  test.setTimeout(40000);
  // Pozo y galería larga y profunda: aire viciado al fondo. Pilares cada 4
  // bloques en la fila superior: el techo es estable y solo cuenta el aire.
  await carve(page, [
    ...range(13, 13, 10, 31),
    ...range(14, 60, 31, 31),
    ...range(14, 60, 30, 30).filter(([c]) => c % 4 !== 0),
  ]);
  await scene(page, (s) => {
    s.miner.body.reset(58 * 16 + 8, 31 * 16 + 4);
    s.session.ventilation.evaluate();
  });
  await settle(page);
  const air = await scene(page, (s) => s.session.ventilation.at(58, 31));
  expect(air).toBeLessThan(0.2);
  await expect
    .poll(() => scene(page, (s) => s.hud.alarmText))
    .toMatch(/AIRE|EMERGENCIA/);
  await page.waitForTimeout(7500);
  // La captura va antes de la lectura: tomarla entre la lectura y la tecla R
  // dejaba casi medio segundo más de aire viciado y el margen era de 1 punto.
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v3-bad-air.png' });
  const hurt = await scene(page, (s) => ({
    hp: s.session.health.hp,
    speed: s.miner.speedFactor,
  }));
  expect(hurt.hp).toBeLessThan(100);
  expect(hurt.speed).toBeLessThan(1);
  await page.keyboard.press('r');
  await page.waitForTimeout(1500);
  const safe = await scene(page, (s) => ({
    hp: s.session.health.hp,
    speed: s.miner.speedFactor,
  }));
  expect(safe.speed).toBe(1);
  // Puede quedar un cuadro de daño entre la lectura y la tecla R.
  expect(safe.hp).toBeGreaterThan(hurt.hp - 1);
  expect(await scene(page, (s) => s.hud.alarmText)).toBe('');
});

test('mineral desconocido: evento y logro una sola vez, guardado', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await scene(page, (s) => {
    s.session.tools.add('tungsten');
    s.session.grid.set(26, 9, 11);
    s.session.visibility.reveal(26, 9);
    s.terrain.redraw({ column: 26, row: 9 });
    s.miner.body.reset(402, 148);
  });
  await settle(page);
  await pointAt(page, 424, 152);
  await page.mouse.down();
  await expect
    .poll(
      () =>
        scene(page, (s) =>
          s.session.achievements.unlocked.has('no_estamos_solos'),
        ),
      { timeout: 6000 },
    )
    .toBe(true);
  await page.mouse.up();
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v3-secret.png' });
  // Un segundo intento no repite el evento ni el premio.
  const second = await scene(page, (s) =>
    s.session.achievements.unlock('no_estamos_solos'),
  );
  expect(second).toBe(false);
  await page.keyboard.press('g');
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', { timeout: 20_000 });
  expect(
    await scene(page, (s) =>
      s.session.achievements.unlocked.has('no_estamos_solos'),
    ),
  ).toBe(true);
});

test('persistencia V3: vigas, luces, suministros y etapa tras recargar', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await carve(page, [...range(30, 33, 13, 14)]);
  await scene(page, (s) => {
    const se = s.session;
    se.progression.tier = 2;
    se.supplies.torch = 2;
    se.supports.install(se.grid, { column: 31, row: 14 }, 'steel');
    se.lights.install(se.grid, { column: 32, row: 14 }, 'torch');
  });
  await page.keyboard.press('g');
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', { timeout: 20_000 });
  const loaded = await scene(page, (s) => ({
    tier: s.session.progression.tier,
    torch: s.session.supplies.torch,
    supports: s.session.supports.items.map((x) => x.kind),
    lights: s.session.lights.items.length,
    air: s.session.grid.get(31, 14),
  }));
  expect(loaded).toEqual({
    tier: 2,
    torch: 2,
    supports: ['wood', 'wood', 'steel'],
    lights: 1,
    air: -1,
  });
});
