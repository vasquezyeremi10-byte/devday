import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import { TORN_PAGE } from '../src/game/config/explore';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import { geologyOf } from '../src/game/world/Geology';
import { Block } from '../src/game/world/TerrainGrid';

/**
 * Primera fase de exploración subterránea (geología rev. 2): cavernas
 * conectadas a la galería, cobre, hierro y cristal violeta, rocas duras,
 * luz violeta con partículas y la cámara secreta con la página del abuelo.
 * Capturas reales del renderizador en docs/screenshots/explore-*.png.
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

async function shot(page: Page, name: string) {
  // Sin avisos ni logros encima: la captura muestra la caverna.
  await scene(page, (s) => {
    s.hud['awardUntil'] = 0;
    s.hud['until'] = 0;
  });
  await page.waitForTimeout(150);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.__MINA_GAME__.renderer.snapshot((image) => {
          const img = image as HTMLImageElement;
          const draw = () => {
            const c = document.createElement('canvas');
            c.id = 'explore-snap';
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
    .locator('#explore-snap')
    .screenshot({ path: `docs/screenshots/${name}.png` });
  await page.evaluate(() => document.getElementById('explore-snap')?.remove());
}

const WORLD_URL = '/?world=2&menu=off';
const settled = (page: Page) =>
  expect.poll(() => scene(page, (s) => s.miner.body.blocked.down)).toBe(true);

/** Partida nueva en el mundo rev. 2, con equipo de seguridad y picota de hierro. */
async function newWorld(page: Page, url = WORLD_URL) {
  await page.goto(url);
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
  await scene(page, (s) => {
    for (const k of ['helmet', 'boots', 'vest', 'gloves', 'goggles'] as const)
      if (!s.session.loadout.equipped(k)) s.session.loadout.addPPE(k);
    s.session.firstDayDone = true;
    s.session.tools.add('iron');
    s.session.loadout.sync();
    s.hud['awardUntil'] = 0;
  });
}

/**
 * Busca en el terreno un bloque `block` a la vista junto a aire con piso, y
 * deja al minero parado en ese aire. Devuelve el bloque y su centro.
 */
const standNextTo = (page: Page, block: number, nth = 0) =>
  scene(
    page,
    (s, arg) => {
      const g = s.session.grid;
      const found: { col: number; row: number; ax: number; ay: number }[] = [];
      for (let r = 9; r <= 28; r++)
        for (let c = 26; c <= 64; c++) {
          if (g.get(c, r) !== arg.block) continue;
          for (const [dx, dy] of [
            [-1, 0],
            [1, 0],
          ] as const) {
            const ax = c + dx,
              ay = r + dy;
            if (
              g.get(ax, ay) === -1 &&
              g.get(ax, ay - 1) === -1 &&
              g.get(ax, ay + 1) !== -1
            )
              found.push({ col: c, row: r, ax, ay });
          }
        }
      const f = found[Math.min(arg.nth, found.length - 1)]!;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          s.session.visibility.reveal(f.col + dx, f.row + dy);
      s.miner.body.reset(f.ax * 16 + 8, f.ay * 16 + 2);
      s.miner.setFlipX(f.ax > f.col);
      s.session.headlamp.restore({ charge: 100, on: false });
      return { ...f, count: found.length };
    },
    { block, nth },
  );

/** Pone el puntero sobre el centro de una celda del mundo. */
async function aimAt(page: Page, col: number, row: number) {
  const view = await scene(page, (s) => ({
    x: s.cameras.main.scrollX,
    y: s.cameras.main.scrollY,
  }));
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(
    box.x + ((col * 16 + 8 - view.x) * box.width) / 480,
    box.y + ((row * 16 + 8 - view.y) * box.height) / 270,
  );
}

test.use({ viewport: { width: 1480, height: 900 } });
test.setTimeout(90_000);

test('las cavernas nacen en el fondo de la galería y se recorren a pie', async ({
  page,
}) => {
  await newWorld(page);
  const info = await scene(page, (s) => ({
    rev: s.session.grid.worldRev,
    gallery: s.session.grid.get(25, 9),
    mouth: s.session.grid.get(26, 9),
    vents: s.session.grid.vents.length,
    crystals: s.lighting.crystals.spots.length,
  }));
  expect(info.rev).toBe(2);
  expect(info.gallery).toBe(-1);
  expect(info.mouth).toBe(-1);
  expect(info.vents).toBeGreaterThan(0);
  expect(info.crystals).toBeGreaterThanOrEqual(8);
  // La red empieza sin descubrir: ningún cristal lejos de la boca se ve aún.
  expect(
    await scene(
      page,
      (s) =>
        s.lighting.crystals.spots.filter(
          (c) => c.column > 30 && s.session.visibility.has(c.column, c.row),
        ).length,
    ),
  ).toBe(0);
  // De pie al final de la galería, caminar con D entra a la caverna y desciende.
  await scene(page, (s) => s.miner.body.reset(25 * 16 + 8, 9 * 16 + 2));
  await settled(page);
  const x0 = await scene(page, (s) => s.miner.x);
  await page.keyboard.down('d');
  await expect
    .poll(() => scene(page, (s) => s.miner.x), { timeout: 10_000 })
    .toBeGreaterThan(x0 + 40);
  await page.keyboard.up('d');
  const inside = await scene(page, (s) => ({
    air: s.session.grid.get(
      Math.floor(s.miner.x / 16),
      Math.floor(s.miner.y / 16),
    ),
    zone: s.lighting.zone,
  }));
  expect(inside.air).toBe(-1);
  await page.waitForTimeout(400);
  await shot(page, 'explore-cave-mouth');
  // Plano de la red (diagnóstico para la documentación): aire en negro, roca
  // en gris, hierro y cobre, roca dura en rojo oscuro y cristales en violeta.
  await page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    const g = s.session.grid;
    const cell = 14;
    const c0 = 24,
      c1 = 64,
      r0 = 6,
      r1 = 30;
    const canvas = document.createElement('canvas');
    canvas.id = 'explore-map';
    canvas.width = (c1 - c0 + 1) * cell;
    canvas.height = (r1 - r0 + 1) * cell;
    canvas.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
    const ctx = canvas.getContext('2d')!;
    const color: Record<number, string> = {
      [-1]: '#06070f',
      0: '#6b493d',
      1: '#4a4f66',
      2: '#222',
      4: '#c9784a',
      5: '#3cb878',
      12: '#8a2f2f',
      14: '#b36dff',
    };
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        ctx.fillStyle = color[g.get(c, r)] ?? '#59607c';
        ctx.fillRect((c - c0) * cell, (r - r0) * cell, cell - 1, cell - 1);
      }
    document.body.appendChild(canvas);
  });
  await page
    .locator('#explore-map')
    .screenshot({ path: 'docs/screenshots/explore-map.png' });
  await page.evaluate(() => document.getElementById('explore-map')?.remove());
});

test('se explora una sala por debajo de otra: más profundo, más oscuro', async ({
  page,
}) => {
  await newWorld(page);
  const seed = await scene(page, (s) => s.session.seed);
  const rooms = geologyOf(seed, 2).explore!.chambers;
  const shallow = rooms[0]!;
  const deep = [...rooms].sort((a, b) => b.cy - a.cy)[0]!;
  expect(deep.cy).toBeGreaterThan(shallow.cy);
  for (const [name, room] of [
    ['explore-cave-hall', shallow],
    ['explore-cave-deep', deep],
  ] as const) {
    await scene(
      page,
      (s, r) => {
        // Como si ya se hubiera explorado alrededor: terreno descubierto.
        for (let dy = -8; dy <= 8; dy++)
          for (let dx = -14; dx <= 14; dx++)
            s.session.visibility.reveal(r.cx + dx, r.cy + dy);
        s.miner.body.reset(r.cx * 16 + 8, r.cy * 16);
        s.session.headlamp.restore({ charge: 100, on: true });
      },
      room,
    );
    await settled(page);
    await page.waitForTimeout(700);
    // La sala más honda ya es zona profunda (la primera aún recibe algo de día).
    if (room === deep)
      expect(await scene(page, (s) => s.lighting.zone)).toBe('deep');
    await shot(page, name);
  }
});

test('cristal violeta: luz violeta, partículas y se recolecta en el inventario', async ({
  page,
}) => {
  await newWorld(page);
  const t = await standNextTo(page, Block.Crystal);
  expect(t.count).toBeGreaterThanOrEqual(1);
  await settled(page);
  await page.waitForTimeout(700);
  // El cristal descubierto tiñe de violeta lo que alumbra y suelta partículas.
  const glow = await scene(
    page,
    (s, at) => ({
      violet: s.lighting.darkness.violet.reduce((a, b) => a + b, 0),
      motes: (
        s['crystalMotes'] as unknown as {
          g: { commandBuffer: unknown[] };
        }
      ).g.commandBuffer.length,
      lit: s.lighting.lightAt(at.ax * 16 + 8, at.ay * 16 + 8),
    }),
    t,
  );
  expect(glow.violet).toBeGreaterThan(10);
  expect(glow.motes).toBeGreaterThan(0);
  // Muy por encima del ambiente subterráneo (0,04): la luz es del cristal.
  expect(glow.lit).toBeGreaterThan(0.12);
  await shot(page, 'explore-crystal-glow');
  // Se excava con la picota de hierro y entra al inventario de siempre.
  await aimAt(page, t.col, t.row);
  await page.mouse.down();
  await expect
    .poll(() => scene(page, (s) => [...s.session.inventory.items]), {
      timeout: 8000,
    })
    .toEqual(['violet_crystal']);
  await page.mouse.up();
  const after = await scene(
    page,
    (s, at) => ({
      cell: s.session.grid.get(at.col, at.row),
      found: s.mining.discovered.violet_crystal,
      xp: s.session.progression.found.has('violet_crystal'),
      message: s.hud['message'].text,
    }),
    t,
  );
  expect(after.cell).toBe(-1);
  expect(after.found).toBe(1);
  expect(after.xp).toBe(true);
  expect(after.message).toContain('CRISTAL VIOLETA');
});

test('cobre y hierro a la vista en las paredes, con la picota de hierro', async ({
  page,
}) => {
  // La semilla es aleatoria y en la mitad de los mundos no hay cobre o hierro
  // junto a aire con piso dentro del alcance de la prueba: se sortea otro mundo.
  for (let attempt = 0; attempt < 12; attempt++) {
    if (attempt > 0) {
      // El mundo anterior quedó guardado: se borra desde una página sin juego
      // (el código fuente servido por Vite) para que el siguiente sea nuevo.
      await page.goto('/src/main.ts');
      await page.evaluate(() => localStorage.clear());
    }
    await newWorld(page);
    const ok = await scene(page, (s) => {
      const g = s.session.grid;
      const reachable = (block: number) => {
        for (let r = 9; r <= 28; r++)
          for (let c = 26; c <= 64; c++) {
            if (g.get(c, r) !== block) continue;
            for (const dx of [-1, 1]) {
              const ax = c + dx;
              if (
                g.get(ax, r) === -1 &&
                g.get(ax, r - 1) === -1 &&
                g.get(ax, r + 1) !== -1
              )
                return true;
            }
          }
        return false;
      };
      return reachable(4) && reachable(5);
    });
    if (ok) break;
  }
  for (const [block, mineral] of [
    [Block.Iron, 'iron'],
    [Block.Copper, 'copper'],
  ] as const) {
    const t = await standNextTo(page, block);
    expect(t.count).toBeGreaterThanOrEqual(1);
    await settled(page);
    await scene(page, (s) => s.session.inventory.items.splice(0));
    await aimAt(page, t.col, t.row);
    await page.mouse.down();
    await expect
      .poll(() => scene(page, (s) => [...s.session.inventory.items]), {
        timeout: 8000,
      })
      .toEqual([mineral]);
    await page.mouse.up();
  }
});

test('roca resistente: la picota de hierro no la rompe y la de tungsteno sí', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await newWorld(page);
  const t = await standNextTo(page, Block.HardRock);
  await settled(page);
  const problem = await scene(page, (s) => s.session.toolProblem(12));
  expect(problem).toContain('TUNGSTENO');
  // Con la de hierro el trabajo ni empieza.
  await aimAt(page, t.col, t.row);
  await page.mouse.down();
  await page.waitForTimeout(1500);
  expect(await scene(page, (s) => s.work.progress)).toBe(0);
  expect(
    await scene(page, (s, at) => s.session.grid.get(at.col, at.row), t),
  ).toBe(Block.HardRock);
  await page.mouse.up();
  // Con la de tungsteno se rompe (más lento que la roca común).
  await scene(page, (s) => s.session.tools.add('tungsten'));
  expect(await scene(page, (s) => s.session.toolProblem(12))).toBeNull();
  await page.mouse.down();
  await expect
    .poll(() => scene(page, (s, at) => s.session.grid.get(at.col, at.row), t), {
      timeout: 15_000,
    })
    .toBe(Block.Air);
  await page.mouse.up();
});

test('cámara secreta: sellada por roca dura, con la página del abuelo y guardado', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await newWorld(page);
  const seed = await scene(page, (s) => s.session.seed);
  const secret = geologyOf(seed, 2).explore!.secret;
  const pageCell = await scene(page, (s) => s['pageCell']);
  expect(pageCell).toEqual(secret.page);
  // Sellada: el sello es roca dura y la cámara no se ve ni se puede leer.
  const sealed = await scene(
    page,
    (s, sec) => ({
      plug: sec.plug.every(
        ([c, r]: number[]) => s.session.grid.get(c!, r!) === 12,
      ),
      chamber: sec.cells.every(
        ([c, r]: number[]) => s.session.grid.get(c!, r!) === -1,
      ),
      enabled: s.interactions.objects.get('torn-page')!.enabled,
      known: s.session.visibility.has(sec.page.column, sec.page.row),
    }),
    secret,
  );
  expect(sealed).toEqual({
    plug: true,
    chamber: true,
    enabled: false,
    known: false,
  });
  // Se rompe con tungsteno (aquí: abrimos el sello como si ya se hubiera picado).
  await scene(
    page,
    (s, sec) => {
      for (const [c, r] of sec.plug) {
        s.session.grid.set(c!, r!, -1);
        s.terrain.remove({ column: c!, row: r! });
      }
      s.lighting.terrainChanged();
      s.session.visibility.reveal(sec.page.column, sec.page.row);
      s.miner.body.reset(sec.page.column * 16 + 8, sec.page.row * 16 - 2);
      s.session.headlamp.restore({ charge: 100, on: true });
    },
    secret,
  );
  await settled(page);
  await expect
    .poll(() => scene(page, (s) => s.interactions.selected?.id))
    .toBe('torn-page');
  await page.waitForTimeout(500);
  await shot(page, 'explore-secret-chamber');
  await page.keyboard.press('e');
  await expect.poll(() => scene(page, (s) => s.dialog.open)).toBe(true);
  expect(TORN_PAGE).toHaveLength(3);
  // Esc omite el diálogo; la pista queda leída y guardada.
  await page.keyboard.press('Escape');
  await expect
    .poll(() => scene(page, (s) => s.session.exploration.pageRead))
    .toBe(true);
  await scene(page, (s) => s.save());
  const savedExplore = await page.evaluate(
    () => JSON.parse(localStorage.getItem('mina-cero.save.v6')!).explore,
  );
  expect(savedExplore).toEqual({ pageRead: true });
  await page.goto(WORLD_URL);
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  expect(await scene(page, (s) => s.session.exploration.pageRead)).toBe(true);
  expect(await scene(page, (s) => s.session.grid.worldRev)).toBe(2);
});

test('una partida anterior gana las cavernas sin perder lo excavado', async ({
  page,
}) => {
  // Partida en el mundo original (rev. 1) con un pozo propio.
  await newWorld(page, '/?world=1&menu=off');
  expect(await scene(page, (s) => s.session.grid.worldRev)).toBe(1);
  expect(await scene(page, (s) => s.lighting.crystals.spots.length)).toBe(0);
  await scene(page, (s) => {
    for (let r = 12; r < 16; r++) s.session.grid.set(32, r, -1);
    s.save();
  });
  // Como un guardado de antes de V10: sin la revisión del mundo. Se quita al
  // cargar la página siguiente (al irse, la actual vuelve a guardar la suya).
  await page.addInitScript(() => {
    const raw = JSON.parse(localStorage.getItem('mina-cero.save.v6') ?? 'null');
    if (!raw) return;
    delete raw.worldRev;
    delete raw.explore;
    localStorage.setItem('mina-cero.save.v6', JSON.stringify(raw));
  });
  await page.goto(WORLD_URL);
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  const upgraded = await scene(page, (s) => ({
    rev: s.session.grid.worldRev,
    crystals: s.lighting.crystals.spots.length,
    shaft: [12, 13, 14, 15].map((r) => s.session.grid.get(32, r)),
  }));
  expect(upgraded.rev).toBe(2);
  expect(upgraded.crystals).toBeGreaterThanOrEqual(8);
  expect(upgraded.shaft).toEqual([-1, -1, -1, -1]);
});

test('la red de cavernas mantiene el rendimiento con cristales en pantalla', async ({
  page,
}) => {
  await newWorld(page);
  await standNextTo(page, Block.Crystal, 3);
  await settled(page);
  await page.waitForTimeout(1500);
  const fps: number[] = [];
  for (let i = 0; i < 6; i++) {
    fps.push(await page.evaluate(() => window.__MINA_GAME__.loop.actualFps));
    await page.waitForTimeout(250);
  }
  expect(Math.max(...fps)).toBeGreaterThan(25);
});
