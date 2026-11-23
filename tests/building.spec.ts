import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';

/**
 * V11: recolección y construcción con entrada real (clic izquierdo para
 * excavar, picar, talar y desarmar; clic derecho para colocar; teclas 1 a 9).
 * Las posiciones del minero y las menas de roca se preparan como fixture
 * (igual que en el resto de la batería); cada acción verificada es real.
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
const cell = (column: number, row: number): Cell => ({ column, row });
const grid = (cols: number[], rows: number[]) =>
  rows.flatMap((row) => cols.map((column) => cell(column, row)));

/** Mueve el ratón sobre una celda (coordenadas del mundo → pantalla). */
async function aimCell(page: Page, c: Cell, dy = 8) {
  const cam = await scene(page, (s) => ({
    x: s.cameras.main.scrollX,
    y: s.cameras.main.scrollY,
  }));
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(
    box.x + ((c.column * 16 + 8 - cam.x) * box.width) / 480,
    box.y + ((c.row * 16 + dy - cam.y) * box.height) / 270,
  );
}

/**
 * Coloca al minero en una celda de aire con suelo, vecina al objetivo, desde
 * donde se pueda actuar: dentro del alcance al colocar o con tiro libre
 * (`ready`) al excavar. Es la preparación del fixture; la acción es real.
 */
async function standNear(page: Page, c: Cell, mode: 'place' | 'mine') {
  const ok = await scene(
    page,
    (s, t) => {
      const g = s.session.grid;
      const spots: [number, number][] = [];
      for (const dy of [0, -1, 1, 2, -2])
        for (const dx of [-1, 1, 0, -2, 2]) spots.push([dx, dy]);
      for (const [dx, dy] of spots) {
        const col = t.cell.column + dx,
          row = t.cell.row + dy;
        if (
          g.isSolid(col, row) ||
          g.isSolid(col, row - 1) ||
          !g.isSolid(col, row + 1) ||
          (dx === 0 && dy === 0)
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
  // La cámara sigue al minero: esperar a que reencuadre.
  await page.waitForTimeout(150);
}

/** Mantiene el clic izquierdo sobre una celda hasta que quede vacía. */
async function dig(page: Page, c: Cell, timeout = 9000) {
  await standNear(page, c, 'mine');
  await aimCell(page, c);
  await page.mouse.down();
  try {
    await expect
      .poll(
        () =>
          scene(page, (s, t) => !s.session.grid.isSolid(t.column, t.row), c),
        { timeout, intervals: [80] },
      )
      .toBe(true);
  } finally {
    await page.mouse.up();
  }
}

/** Clic derecho sobre la celda: coloca el bloque elegido. */
async function place(page: Page, c: Cell) {
  await standNear(page, c, 'place');
  await aimCell(page, c);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(50);
  await page.mouse.up({ button: 'right' });
  const solid = () =>
    scene(page, (s, t) => s.session.grid.isSolid(t.column, t.row), c);
  try {
    await expect.poll(solid, { timeout: 4000 }).toBe(true);
  } catch (error) {
    const why = await scene(
      page,
      (s, t) => ({
        problem: s.session.placeBlock(
          t,
          'mat_dirt',
          s.miner.body.center,
          s['entityRects'](),
        ),
        active: s.hud.activeSupply,
        stock: s.session.supplies.mat_dirt,
        body: [s.miner.x, s.miner.y],
        target: s['target'](),
        rects: s['entityRects'](),
      }),
      c,
    );
    throw new Error(
      `no se colocó ${c.column},${c.row}: ${JSON.stringify(why)}`,
      { cause: error },
    );
  }
}

const stock = (page: Page) =>
  scene(page, (s) => ({
    dirt: s.session.supplies.mat_dirt,
    stone: s.session.supplies.mat_stone,
    wood: s.session.supplies.mat_wood,
  }));

/** Elige un material con la tecla de su casilla de la barra rápida. */
async function pick(page: Page, kind: string) {
  const index = await scene(
    page,
    (s, k) =>
      s.session.loadout.quickbar.findIndex(
        (q) => q?.type === 'supply' && q.kind === k,
      ),
    kind,
  );
  expect(index, `${kind} no está en la barra rápida`).toBeGreaterThanOrEqual(0);
  await page.keyboard.press(String(index + 1));
  await expect.poll(() => scene(page, (s) => s.hud.activeSupply)).toBe(kind);
}

/** Pone la herramienta en la barra rápida y la elige con su tecla. */
async function hold(page: Page, kind: string) {
  const index = await scene(
    page,
    (s, k) => {
      const l = s.session.loadout;
      const t = s.session.tools.items.find((x) => x.kind === k)!;
      let i = l.quickbar.findIndex((q) => q?.type === 'tool' && q.id === t.id);
      if (i < 0) {
        i = l.quickbar.indexOf(null);
        l.assignQuick(i, { type: 'tool', id: t.id });
      }
      return i;
    },
    kind,
  );
  await page.keyboard.press(String(index + 1));
  await expect
    .poll(() => scene(page, (s) => s.session.tools.current?.kind))
    .toBe(kind);
}

const refill = (page: Page) =>
  scene(page, (s) => {
    s.session.survival.energy = 100;
    s.session.survival.hunger = 100;
  });

const blocksAre = (page: Page, cells: Cell[], solid: boolean) =>
  scene(
    page,
    (s, list) => list.every((c) => s.session.grid.isSolid(c.column, c.row)),
    cells,
  ).then((all) => (solid ? all : !all));

const noneSolid = (page: Page, cells: Cell[]) =>
  scene(
    page,
    (s, list) => list.every((c) => !s.session.grid.isSolid(c.column, c.row)),
    cells,
  );

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await settle(page);
  await page.keyboard.press('1');
  await scene(page, (s) => {
    s.session.buy('kit');
    s.session.firstDayDone = true;
    s.session.tools.add('axe');
    s.session.tools.add('iron');
    s.session.tools.add('shovel');
    // Trabajo más rápido: la prueba no espera a ritmo humano.
    s.session.progression.level = 30;
    s.session.loadout.sync();
  });
});

test('recolectar, construir una escalera y subirla; muro, árbol, casa, desarmar y guardar', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await refill(page);

  // 1. Excavar 10 bloques de tierra y recuperarlos (clic izquierdo con pala).
  const dirt = [64, 65, 66, 67, 68, 69, 71, 72, 73, 74].map((c) => cell(c, 10));
  for (const c of dirt) await dig(page, c);
  expect(await stock(page)).toEqual({ dirt: 10, stone: 0, wood: 0 });
  // La carga minera (4) no se llena con material de construcción.
  expect(await scene(page, (s) => s.session.inventory.items)).toEqual([]);
  // La barra rápida muestra el ícono y la cantidad.
  const slot = await scene(page, (s) =>
    s.session.loadout.quickbar.findIndex(
      (q) => q?.type === 'supply' && q.kind === 'mat_dirt',
    ),
  );
  expect(slot).toBeGreaterThanOrEqual(0);
  await expect
    .poll(() =>
      scene(
        page,
        (s, i) => {
          const c = s.hud['quickbar']['cells'][i]!;
          return [c.icon.visible, c.count.text];
        },
        slot,
      ),
    )
    .toEqual([true, '10']);

  // 2. Colocar esos 10 bloques como escalera (clic derecho): 1+2+3+4.
  await refill(page);
  await pick(page, 'mat_dirt');
  // Elegir tierra no suelta la herramienta en mano.
  expect(await scene(page, (s) => s.session.tools.current?.kind)).toBe(
    'shovel',
  );
  const stairs = [58, 59, 60, 61].flatMap((column, k) =>
    Array.from({ length: k + 1 }, (_, h) => cell(column, 9 - h)),
  );
  for (const c of stairs) await place(page, c);
  expect(stairs).toHaveLength(10);
  expect((await stock(page)).dirt).toBe(0);
  expect(await scene(page, (s) => s.session.placed.size)).toBe(10);
  await page.waitForTimeout(250);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v11-escalera.png' });

  // 3. Subir por la escalera sin atravesarla (teclado real: D y espacio).
  await scene(page, (s) => {
    s.miner.body.reset(57 * 16 + 8, 9 * 16 + 4);
    s.miner.setVelocity(0, 0);
  });
  await settle(page);
  await page.waitForTimeout(150);
  await page.keyboard.down('d');
  let penetrated = false;
  let top = false;
  for (let i = 0; i < 160 && !top; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(60);
    const st = await scene(page, (s) => {
      const b = s.miner.body,
        g = s.session.grid;
      let inside = false;
      for (const x of [b.left + 1, b.right - 1])
        for (const y of [b.top + 1, b.bottom - 1])
          if (g.isSolid(Math.floor(x / 16), Math.floor(y / 16))) inside = true;
      return { inside, x: s.miner.x, bottom: b.bottom, down: b.blocked.down };
    });
    penetrated ||= st.inside;
    top = st.x >= 61 * 16 + 4 && st.down && Math.abs(st.bottom - 6 * 16) <= 1;
  }
  await page.keyboard.up('d');
  expect(penetrated, 'el minero atravesó un bloque').toBe(false);
  expect(top, 'el minero no llegó a la cima de la escalera').toBe(true);
  await page.waitForTimeout(200);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v11-escalera-cima.png' });

  // 4. Extraer piedra (clic izquierdo con picota) y construir un muro.
  const rocks = [75, 76, 77, 79, 80, 81].map((c) => cell(c, 10));
  await scene(
    page,
    (s, list) => {
      for (const c of list) {
        s.session.grid.set(c.column, c.row, 1);
        s.terrain.redraw(c);
      }
    },
    rocks,
  );
  await hold(page, 'iron');
  await refill(page);
  for (const c of rocks) await dig(page, c);
  expect(await stock(page)).toEqual({ dirt: 0, stone: 6, wood: 0 });
  expect(await scene(page, (s) => s.session.inventory.items)).toEqual([]);
  await pick(page, 'mat_stone');
  const wall = grid([89, 90, 91], [9, 8]);
  for (const c of wall) await place(page, c);
  expect((await stock(page)).stone).toBe(0);
  expect(await blocksAre(page, wall, true)).toBe(true);

  // 5. Talar un árbol con el hacha y obtener madera.
  await hold(page, 'axe');
  // El bloque elegido sigue activo: la barra marca la herramienta.
  expect(await scene(page, (s) => s.hud.activeSupply)).toBe('mat_stone');
  // El hacha no tiene hoja propia: el minero usa la del pico (nunca la
  // textura de reemplazo de Phaser, el cuadro verde con diagonal).
  await expect
    .poll(() => scene(page, (s) => s.miner.texture.key))
    .not.toContain('MISSING');
  await scene(page, (s) => {
    s.miner.body.reset(47 * 16 + 8, 9 * 16 + 4);
    s.miner.setVelocity(0, 0);
  });
  await settle(page);
  await page.waitForTimeout(150);
  await aimCell(page, cell(48, 9));
  await page.mouse.down();
  await expect
    .poll(() => scene(page, (s) => s.session.trees.felled.has(0)), {
      timeout: 9000,
      intervals: [80],
    })
    .toBe(true);
  // Sigue el clic: el árbol ya talado no vuelve a dar madera.
  await page.waitForTimeout(1200);
  await page.mouse.up();
  expect((await stock(page)).wood).toBe(8);
  expect(await scene(page, (s) => s.session.trees.standing(0))).toBe(false);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v11-arbol-talado.png' });

  // 6. Casa pequeña con los tres materiales (muros de tierra y piedra, techo
  // de madera). La madera es la talada; tierra y piedra se completan.
  await scene(page, (s) => {
    s.session.addMaterial('mat_dirt', 2);
    s.session.addMaterial('mat_stone', 2);
  });
  const house = {
    dirt: [cell(82, 9), cell(82, 8)],
    stone: [cell(86, 9), cell(86, 8)],
    wood: [82, 83, 84, 85, 86].map((c) => cell(c, 7)),
  };
  const before = await stock(page);
  expect(before).toEqual({ dirt: 2, stone: 2, wood: 8 });
  await refill(page);
  await pick(page, 'mat_dirt');
  for (const c of house.dirt) await place(page, c);
  await pick(page, 'mat_stone');
  for (const c of house.stone) await place(page, c);
  await pick(page, 'mat_wood');
  for (const c of house.wood) await place(page, c);
  const all = [...house.dirt, ...house.stone, ...house.wood];
  expect(await stock(page)).toEqual({ dirt: 0, stone: 0, wood: 3 });
  expect(await scene(page, (s) => s.session.placed.size)).toBe(25);
  await page.waitForTimeout(250);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v11-casa.png' });

  // 8. Guardar, salir y volver: nada se pierde.
  const builtAll = [...stairs, ...wall, ...all];
  const player = await scene(page, (s) => ({ x: s.miner.x, y: s.miner.y }));
  await page.keyboard.press('g');
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  expect(await blocksAre(page, builtAll, true)).toBe(true);
  expect(await scene(page, (s) => s.session.placed.size)).toBe(25);
  expect(await stock(page)).toEqual({ dirt: 0, stone: 0, wood: 3 });
  expect(await noneSolid(page, dirt)).toBe(true);
  expect(await noneSolid(page, rocks)).toBe(true);
  expect(await scene(page, (s) => s.session.trees.standing(0))).toBe(false);
  expect(await scene(page, (s) => s.session.trees.standing(1))).toBe(true);
  const back = await scene(page, (s) => ({ x: s.miner.x, y: s.miner.y }));
  expect(
    Math.abs(back.x - player.x),
    JSON.stringify({ player, back }),
  ).toBeLessThan(20);
  expect(Math.abs(back.y - player.y)).toBeLessThan(20);

  // 7. Destruir lo construido y recuperarlo: la casa vuelve a su inventario.
  await settle(page);
  await hold(page, 'iron');
  await refill(page);
  const wear = await scene(
    page,
    (s) => s.session.tools.items.find((t) => t.kind === 'iron')!.durability,
  );
  const order = [
    ...house.wood.slice(1, 4),
    cell(82, 8),
    cell(86, 8),
    cell(82, 7),
    cell(86, 7),
    cell(82, 9),
    cell(86, 9),
  ];
  for (const c of order) await dig(page, c);
  expect(await noneSolid(page, all)).toBe(true);
  expect(await stock(page)).toEqual({ dirt: 2, stone: 2, wood: 8 });
  // Desarmar lo construido no gasta la herramienta ni da experiencia.
  expect(
    await scene(
      page,
      (s) => s.session.tools.items.find((t) => t.kind === 'iron')!.durability,
    ),
  ).toBe(wear);
  expect(await scene(page, (s) => s.session.placed.size)).toBe(16);
  expect(await blocksAre(page, [...stairs, ...wall], true)).toBe(true);
});

test('vista previa, colocación rechazada (lejos, sobre el minero) y permitida junto a la bodega', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await scene(page, (s) => {
    s.session.addMaterial('mat_dirt', 40);
    s.session.addMaterial('mat_wood', 6);
    s.miner.body.reset(64 * 16 + 8, 9 * 16 + 4);
    s.miner.setVelocity(0, 0);
  });
  await settle(page);
  await page.waitForTimeout(150);
  await pick(page, 'mat_dirt');
  // Vista previa sobre una celda libre y alcanzable: tablero del material.
  await aimCell(page, cell(65, 9));
  await expect
    .poll(() => scene(page, (s) => s['selection'].commandBuffer.length))
    .toBeGreaterThan(100);
  await expect
    .poll(() => scene(page, (s) => s.hud['action'].text))
    .toContain('COLOCAR TIERRA');
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v11-vista-previa.png' });
  // Inventario con la barra de nueve casillas.
  await page.keyboard.press('Tab');
  await expect.poll(() => scene(page, (s) => s.inventory.open)).toBe(true);
  await page.mouse.move(4, 4);
  await page.waitForTimeout(200);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v11-inventario.png' });
  await page.keyboard.press('Tab');
  await expect.poll(() => scene(page, (s) => s.inventory.open)).toBe(false);
  await aimCell(page, cell(65, 9));
  // Fuera de alcance: se ve en rojo y no se coloca ni se gasta.
  await aimCell(page, cell(72, 9));
  await expect
    .poll(() => scene(page, (s) => s.hud['action'].text))
    .toContain('DEMASIADO LEJOS');
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(100);
  expect(await scene(page, (s) => s.session.grid.isSolid(72, 9))).toBe(false);
  expect((await stock(page)).dirt).toBe(40);
  // Sobre el propio minero: no.
  const mine = await scene(page, (s) => ({
    column: Math.floor(s.miner.x / 16),
    row: Math.floor((s.miner.y - 4) / 16),
  }));
  await aimCell(page, mine);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(100);
  expect(
    await scene(page, (s, c) => s.session.grid.isSolid(c.column, c.row), mine),
  ).toBe(false);
  expect((await stock(page)).dirt).toBe(40);
  // Ya no hay zonas protegidas: junto a la bodega también se coloca.
  await scene(page, (s) => {
    s.miner.body.reset(8 * 16 + 8, 9 * 16 + 4);
    s.miner.setVelocity(0, 0);
  });
  await settle(page);
  await page.waitForTimeout(150);
  await aimCell(page, cell(9, 9));
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(100);
  expect(await scene(page, (s) => s.session.grid.isSolid(9, 9))).toBe(true);
  expect((await stock(page)).dirt).toBe(39);
});

test('F enciende y apaga la linterna del casco; G guarda; 1 a 9 eligen', async ({
  page,
}) => {
  await scene(page, (s) => {
    s.session.headlamp.on = true;
    s.session.headlamp.charge = 100;
  });
  await page.keyboard.press('f');
  await expect
    .poll(() => scene(page, (s) => s.session.headlamp.on))
    .toBe(false);
  await page.keyboard.press('f');
  await expect.poll(() => scene(page, (s) => s.session.headlamp.on)).toBe(true);
  // La L de siempre sigue funcionando como alias.
  await page.keyboard.press('l');
  await expect
    .poll(() => scene(page, (s) => s.session.headlamp.on))
    .toBe(false);
  await page.keyboard.press('l');
  await page.keyboard.press('g');
  await expect
    .poll(() => scene(page, (s) => s.hud['message'].text))
    .toContain('PARTIDA GUARDADA');
  // Las nueve casillas responden a su tecla.
  for (let i = 1; i <= 9; i++) {
    await page.keyboard.press(String(i));
    await expect
      .poll(() => scene(page, (s) => s.session.loadout.selectedQuick))
      .toBe(i - 1);
  }
});
