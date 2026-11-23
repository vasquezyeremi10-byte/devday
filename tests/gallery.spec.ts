import type { MiningScene } from '../src/game/scenes/MiningScene';
import { expect, test, type Page } from '@playwright/test';
import { BALANCE } from '../src/game/config/balance';
import { GameSession } from '../src/game/systems/GameSession';
import {
  decodeSave,
  encodeSave,
  SAVE_KEY,
} from '../src/game/systems/SaveSystem';
import type { GalleryScene } from '../src/game/scenes/GalleryScene';
import type { TopDownScene } from '../src/game/scenes/TopDownScene';
import { createInitialTerrain } from '../src/game/world/Geology';
import { Block } from '../src/game/world/TerrainGrid';
import {
  GALLERY_ENTRY,
  TopDownGallery,
} from '../src/game/world/TopDownGallery';

async function approach(page: Page, x: number, y: number) {
  await page.evaluate(
    ({ x, y }) => {
      const scene = window.__MINA_GAME__.scene.getScene(
        'GalleryScene',
      ) as GalleryScene;
      scene.miner.body.reset(x, y);
      const camera = scene.cameras.main;
      camera.centerOn(x, y);
    },
    { x, y },
  );
}

async function aim(page: Page, column: number, row: number) {
  const p = await page.evaluate(
    ({ column, row }) => {
      const scene = window.__MINA_GAME__.scene.getScene(
        'GalleryScene',
      ) as GalleryScene;
      const camera = scene.cameras.main;
      const bounds = scene.game.canvas.getBoundingClientRect();
      return {
        x:
          bounds.left +
          ((column * 16 + 8 - camera.scrollX) * bounds.width) / camera.width,
        y:
          bounds.top +
          ((row * 16 + 8 - camera.scrollY) * bounds.height) / camera.height,
      };
    },
    { column, row },
  );
  await page.mouse.move(p.x, p.y);
}

const state = (page: Page, column = 19, row = 11) =>
  page.evaluate(
    ({ column, row }) => {
      const scene = window.__MINA_GAME__.scene.getScene(
        'GalleryScene',
      ) as GalleryScene;
      const s = scene.visit.session;
      return {
        block: scene.gallery.grid.get(column, row),
        progress: scene.work.progress,
        duration: s.workMs({ column, row }, scene.gallery.grid),
        known: scene.gallery.visibility.has(column, row),
        lit: scene.view.lit[row * scene.gallery.grid.columns + column],
        x: scene.miner.x,
        y: scene.miner.y,
        energy: s.survival.energy,
        frame: scene.miner.frame.name,
        prop: scene.miner['prop'].visible,
        propDepth: scene.miner['prop'].depth - scene.miner.depth,
        tool: s.tools.current?.kind,
        durability: s.tools.current?.durability,
        items: [...s.inventory.items],
        dug: scene.gallery.dug.size,
        missing: scene.children.list.filter(
          (o) =>
            'texture' in o &&
            (o.texture as { key?: string } | undefined)?.key === '__MISSING',
        ).length,
      };
    },
    { column, row },
  );

async function enter(page: Page) {
  await page.evaluate(() => {
    const camp = window.__MINA_GAME__.scene.getScene(
      'TopDownScene',
    ) as TopDownScene;
    camp.miner.body.reset(672, 306);
  });
  await expect(page.locator('#game-status')).toHaveText('[Z] MINA');
  await page.keyboard.press('z');
  await expect(page.locator('#game-status')).toContainText(
    'VOLVER A SUPERFICIE',
  );
}

test('instala, apaga e inspecciona la red y se recupera del aire agotado', async ({
  page,
}) => {
  test.setTimeout(45_000);
  const session = new GameSession(createInitialTerrain());
  session.modeChosen = true;
  session.claimKit();
  session.progression.tier = 3;
  session.money = 200;
  const gallery = (session.gallery = new TopDownGallery());
  for (let column = 19; column <= 32; column++) {
    gallery.grid.set(column, 11, Block.Air);
    gallery.dug.add(gallery.ventilation.key({ column, row: 11 }));
  }
  gallery.ventilation.evaluate();
  expect(session.buy('duct')).toBe('COMPRA REALIZADA');
  expect(session.buy('fan_aux')).toBe('COMPRA REALIZADA');
  session.loadout.assignQuick(0, { type: 'supply', kind: 'duct' });
  session.loadout.assignQuick(1, { type: 'supply', kind: 'fan_aux' });
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, save);
    },
    { key: SAVE_KEY, save: encodeSave(session, { x: 208, y: 148 }) },
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?view=top-down');
  await expect(page.locator('#game-status')).toContainText('CAMPAMENTO');
  await enter(page);
  const status = page.locator('#game-status');
  const airState = () =>
    page.evaluate(() => {
      const s = window.__MINA_GAME__?.scene.getScene('GalleryScene') as
        GalleryScene | undefined;
      if (!s?.gallery) return;
      const air = s.gallery.ventilation;
      const fan = air.fanAt({ column: 17, row: 11 });
      return {
        duct: !!air.ductAt({ column: 16, row: 11 }),
        feed: air.ductAir[air.key({ column: 16, row: 11 })],
        fan: fan?.direction,
        enabled: air.fanAt({ column: 15, row: 11 })?.enabled,
        hp: s.visit.session.health.hp,
        salvage: s.visit.session.salvage.duct,
        texts: s.children.list.flatMap((o) => ('text' in o ? [o.text] : [])),
        inspect: s.children.list.some(
          (o) => o.name === 'gallery-airflow' && 'visible' in o && o.visible,
        ),
      };
    });
  const click = async (column: number, button: 'left' | 'right') => {
    await aim(page, column, 11);
    await page.mouse.down({ button });
    await page.mouse.up({ button });
  };
  await page.keyboard.press('1');
  await approach(page, 250, 195);
  await click(16, 'right');
  await expect.poll(async () => (await airState())?.feed).toBeGreaterThan(90);
  await page.keyboard.press('2');
  await click(17, 'right');
  await expect.poll(async () => (await airState())?.fan).toBe(0);
  await approach(page, 248, 195);
  await expect(status).toContainText('APAGAR VENTILADOR');
  await page.keyboard.press('z');
  await expect.poll(async () => (await airState())?.feed).toBe(0);
  await page.keyboard.press('j');
  await expect.poll(async () => (await airState())?.inspect).toBe(true);
  await page.reload();
  await expect.poll(async () => (await airState())?.enabled).toBe(false);
  expect((await airState())?.fan).toBe(0);
  await page.keyboard.press('x');
  await click(16, 'left');
  await expect.poll(async () => (await airState())?.salvage).toBe(0.75);
  expect((await airState())?.duct).toBe(false);
  await approach(page, 520, 191);
  await expect(status).toContainText('SIN AIRE');
  expect((await airState())?.texts).toContain('AIRE: 0%');
  expect((await airState())?.hp).toBe(100);
  await expect
    .poll(async () => (await airState())?.hp, { timeout: 12_000 })
    .toBe(96);
  await approach(page, 232, 191);
  await expect(status).not.toContainText('SIN AIRE');
  await page.waitForTimeout(1150);
  expect((await airState())?.hp).toBe(96);
  expect((await airState())?.texts).toContain('AIRE: 100%');
  expect(errors).toEqual([]);
});

test('nivel -1 comparte equipamiento, excava en cuatro rumbos y conserva el progreso', async ({
  page,
}) => {
  test.setTimeout(80_000);
  const session = new GameSession(createInitialTerrain());
  session.modeChosen = true;
  session.claimKit();
  const tool = session.tools.add('iron');
  session.loadout.assignQuick(0, { type: 'tool', id: tool.id });
  session.tools.equipped = 0;
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, save);
    },
    { key: SAVE_KEY, save: encodeSave(session, { x: 208, y: 148 }) },
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?view=top-down');
  await expect(page.locator('#game-status')).toContainText('CAMPAMENTO');
  await enter(page);
  const initial = await state(page);
  expect(initial.missing).toBe(0);
  expect((await state(page, 20, 10)).known).toBe(false);
  expect((await state(page, 14, 11)).lit).toBeGreaterThan(0);
  expect((await state(page, 17, 11)).lit).toBeGreaterThan(0);
  await page.keyboard.press('f');
  await expect.poll(async () => (await state(page, 17, 11)).lit).toBe(0);
  expect((await state(page, 17, 11)).known).toBe(true);
  await page.keyboard.press('f');
  await page.keyboard.press('Tab');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window.__MINA_GAME__.scene.getScene('GalleryScene') as GalleryScene)
            .inventory.open,
      ),
    )
    .toBe(true);
  await page.keyboard.press('Tab');
  await page.keyboard.press('1');
  await expect.poll(async () => (await state(page)).tool).toBe('iron');

  await approach(page, 296, 188);
  await page.keyboard.down('d');
  await expect.poll(async () => (await state(page)).x).toBeGreaterThan(297);
  await page.keyboard.up('d');
  expect((await state(page)).x).toBeLessThanOrEqual(299.1);

  for (const [x, y, c, r, facing] of [
    [232, 191, 14, 10, 'up'],
    [216, 204, 12, 12, 'left'],
    [264, 236, 16, 15, 'down'],
    [296, 191, 19, 11, 'right'],
  ] as const) {
    await approach(page, x, y);
    await aim(page, c, r);
    await page.mouse.down();
    await expect
      .poll(async () => (await state(page, c, r)).progress)
      .toBeGreaterThan(0.08);
    const partial = await state(page, c, r);
    expect(partial.block).not.toBe(Block.Air);
    expect(partial.duration).toBeGreaterThanOrEqual(1800);
    expect(partial.frame).toMatch(
      new RegExp(`^${facing}-(ready|lift|reach|bend)$`),
    );
    expect(partial.prop).toBe(true);
    expect(Math.sign(partial.propDepth)).toBe(facing === 'up' ? -1 : 1);
    if (facing === 'up') {
      await page.mouse.up();
      await expect.poll(async () => (await state(page, c, r)).prop).toBe(false);
      expect((await state(page, c, r)).frame).toBe('up-idle');
      expect((await state(page, c, r)).block).not.toBe(Block.Air);
      await page.mouse.down();
    }
    await expect
      .poll(async () => (await state(page, c, r)).block)
      .toBe(Block.Air);
    await page.mouse.up();
  }
  const mined = await state(page);
  expect(mined.dug).toBe(4);
  expect(mined.items).toEqual(['iron']);
  expect(mined.durability).toBe(tool.durability - 4);
  expect(mined.energy).toBeLessThan(initial.energy);
  expect((await state(page, 20, 11)).known).toBe(true);
  expect((await state(page, 20, 10)).known).toBe(false);

  await page.keyboard.down('d');
  await expect.poll(async () => (await state(page)).x).toBeGreaterThan(308);
  await page.keyboard.up('d');
  await approach(page, GALLERY_ENTRY.x, GALLERY_ENTRY.y);
  await page.keyboard.press('z');
  await expect(page.locator('#game-status')).toHaveText('[Z] MINA');
  await page.keyboard.press('z');
  await expect(page.locator('#game-status')).toContainText(
    'VOLVER A SUPERFICIE',
  );
  expect((await state(page)).dug).toBe(4);
  await page.reload();
  await expect(page.locator('#game-status')).toContainText(
    'VOLVER A SUPERFICIE',
  );
  expect((await state(page)).items).toEqual(['iron']);
  expect((await state(page)).block).toBe(Block.Air);
  expect(errors).toEqual([]);
});

test('el portal conserva el requisito de EPP', async ({ page }) => {
  const session = new GameSession(createInitialTerrain());
  session.modeChosen = true;
  await page.addInitScript(({ key, save }) => localStorage.setItem(key, save), {
    key: SAVE_KEY,
    save: encodeSave(session, { x: 208, y: 148 }),
  });
  await page.goto('/?view=top-down');
  await expect(page.locator('#game-status')).toContainText('CAMPAMENTO');
  await page.evaluate(() => {
    const camp = window.__MINA_GAME__.scene.getScene(
      'TopDownScene',
    ) as TopDownScene;
    camp.miner.body.reset(672, 306);
  });
  await expect(page.locator('#game-status')).toHaveText('[Z] MINA');
  await page.keyboard.press('z');
  await expect(page.locator('#game-status')).toContainText('EQUIPA EL KIT DE SEGURIDAD');
});

test('construye la curva, transporta mineral, guarda y vende desde el celular', async ({
  page,
}) => {
  test.setTimeout(70_000);
  const session = new GameSession(createInitialTerrain());
  session.modeChosen = true;
  session.claimKit();
  session.tools.add('iron');
  expect(session.buy('rail')).toBe('COMPRA REALIZADA');
  expect(session.buy('rail')).toBe('COMPRA REALIZADA');
  session.loadout.assignQuick(0, { type: 'supply', kind: 'rail' });
  const before = session.money;
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, save);
    },
    { key: SAVE_KEY, save: encodeSave(session, { x: 208, y: 148 }) },
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?view=top-down');
  await expect(page.locator('#game-status')).toContainText('CAMPAMENTO');
  await enter(page);
  const transport = () =>
    page.evaluate(() => {
      const scene = window.__MINA_GAME__.scene.getScene(
        'GalleryScene',
      ) as GalleryScene;
      const rail = scene.gallery.railway;
      return {
        point: rail.point,
        pushing: rail.pushing,
        items: [...rail.inventory.items],
        delivered: [...rail.delivered],
        stock: scene.visit.session.railStock,
        cargo: [...scene.visit.session.inventory.items],
        corner: rail.connections({ column: 18, row: 13 }),
        north: rail.has({ column: 18, row: 12 }),
      };
    });
  const status = page.locator('#game-status');

  await approach(page, 296, 191);
  await aim(page, 19, 11);
  await page.mouse.down();
  await expect.poll(async () => (await state(page)).block).toBe(Block.Air);
  await page.mouse.up();
  expect((await transport()).cargo).toEqual(['iron']);

  await page.keyboard.press('1');
  await approach(page, 296, 203);
  await aim(page, 18, 13);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await expect.poll(async () => (await transport()).stock).toBe(1);
  await approach(page, 296, 187);
  await aim(page, 18, 12);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await expect
    .poll(async () => (await transport()).corner)
    .toEqual([
      { x: 0, y: -1 },
      { x: -1, y: 0 },
    ]);

  await approach(page, 262, 219);
  await expect(status).toContainText('CARGAR CARRITO');
  await page.keyboard.press('z');
  await expect(status).toContainText('CARRITO: 1/20');
  expect((await transport()).cargo).toEqual([]);
  await expect(status).toContainText('EMPUJAR CARRITO');
  await page.keyboard.press('z');
  await expect
    .poll(async () => (await transport()).point)
    .toEqual({ x: 296, y: 200 });
  expect((await transport()).pushing).toBe(false);
  await page.reload();
  await expect(status).toContainText('CARRITO: 1/20');
  expect((await transport()).point).toEqual({ x: 296, y: 200 });
  expect((await transport()).items).toEqual(['iron']);

  await page.keyboard.press('x');
  await aim(page, 18, 12);
  await page.mouse.down();
  await page.mouse.up();
  expect((await transport()).north).toBe(true);
  await page.keyboard.press('x');
  await approach(page, 296, 185);
  await expect(status).toContainText('EMPUJAR CARRITO');
  await page.keyboard.press('z');
  await expect(status).toContainText('DESCARGAR');
  expect((await transport()).point).toEqual({ x: 232, y: 216 });
  await page.keyboard.press('z');
  await expect
    .poll(async () => (await transport()).delivered)
    .toEqual(['iron']);
  expect((await transport()).items).toEqual([]);

  await approach(page, 296, 185);
  await page.keyboard.press('x');
  await aim(page, 18, 12);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(async () => (await transport()).stock).toBe(1);
  expect((await transport()).north).toBe(false);
  await approach(page, GALLERY_ENTRY.x, GALLERY_ENTRY.y);
  await expect(status).toContainText('VOLVER A SUPERFICIE');
  await page.keyboard.press('z');
  await expect(status).toHaveText('[Z] MINA');
  await page.getByRole('button', { name: 'Volver al juego lateral' }).click();
  await expect(status).toContainText('Mina lista', { timeout: 20_000 });
  await page.keyboard.press('u');
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    return scene.phone.open;
  })).toBe(true);
  await page.waitForTimeout(250);
  await page.keyboard.press('v');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    return scene.phone.toast?.lines[0];
  })).toBe('VENTA COMPLETADA');
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key)!,
    SAVE_KEY,
  );
  const final = decodeSave(raw)!.session;
  expect(final.money).toBe(before + BALANCE.sale.iron);
  expect(final.gallery!.railway.delivered).toEqual([]);
  expect(final.gallery!.railway.has({ column: 18, row: 12 })).toBe(false);
  expect(errors).toEqual([]);
});

test('sostiene, confirma desmontaje y despeja una vía tras el derrumbe', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const session = new GameSession(createInitialTerrain());
  session.modeChosen = true;
  session.claimKit();
  session.progression.tier = 2;
  const shovel = session.tools.add('shovel');
  const gallery = (session.gallery = new TopDownGallery());
  const worked = [];
  for (let row = 15; row <= 16; row++)
    for (let column = 15; column <= 18; column++) {
      const cell = { column, row };
      gallery.grid.set(column, row, Block.Air);
      gallery.dug.add(gallery.stability.key(cell));
      worked.push(cell);
    }
  gallery.stability.refresh(worked);
  gallery.railway.inventory.add('iron');
  expect(session.buy('wood_beam')).toBe('COMPRA REALIZADA');
  expect(session.buy('steel_beam')).toBe('COMPRA REALIZADA');
  expect(session.buy('rail')).toBe('COMPRA REALIZADA');
  session.loadout.assignQuick(0, { type: 'tool', id: shovel.id });
  session.loadout.assignQuick(1, { type: 'supply', kind: 'wood_beam' });
  session.loadout.assignQuick(2, { type: 'supply', kind: 'steel_beam' });
  session.loadout.assignQuick(3, { type: 'supply', kind: 'rail' });
  await page.addInitScript(
    ({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, save);
    },
    { key: SAVE_KEY, save: encodeSave(session, { x: 208, y: 148 }) },
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?view=top-down');
  await expect(page.locator('#game-status')).toContainText('CAMPAMENTO');
  await enter(page);
  const inspect = () =>
    page.evaluate(() => {
      const scene = window.__MINA_GAME__.scene.getScene(
        'GalleryScene',
      ) as GalleryScene;
      const cell = { column: 17, row: 14 };
      const { stability, railway, grid } = scene.gallery;
      const s = scene.visit.session;
      const risk = [...stability.sectors.values()].find((entry) =>
        entry.cells.some(
          ({ cell: candidate }) =>
            candidate.column === 17 && candidate.row === 14,
        ),
      );
      return {
        kind: stability.at(cell)?.kind,
        score: risk?.score ?? 0,
        wood: s.supplies.wood_beam,
        steel: s.supplies.steel_beam,
        block: grid.get(17, 14),
        rail: railway.has(cell),
        cargo: [...railway.inventory.items],
        links: railway.connections(cell),
        health: s.health.hp,
        frame: scene.miner.frame.name,
        prop: scene.miner['prop'].visible,
        stone: s.supplies.mat_stone,
        duct: scene.gallery.ventilation.ductAt(cell)?.integrity,
        air: scene.gallery.ventilation.at(cell),
      };
    });
  await approach(page, 296, 215);
  const status = page.locator('#game-status');
  await expect(status).toContainText('COLAPSO EN');
  const initial = await inspect();

  async function clickSupport(button: 'left' | 'right') {
    await aim(page, 17, 14);
    await page.mouse.down({ button });
    await page.mouse.up({ button });
  }

  await page.keyboard.press('2');
  await clickSupport('right');
  await expect.poll(async () => (await inspect()).kind).toBe('wood');
  expect((await inspect()).prop).toBe(true);
  expect((await inspect()).wood).toBe(0);
  expect((await inspect()).score).toBeLessThan(initial.score);
  await page.keyboard.press('3');
  await clickSupport('right');
  await expect.poll(async () => (await inspect()).kind).toBe('steel');
  expect((await inspect()).steel).toBe(0);

  await page.keyboard.press('x');
  await clickSupport('left');
  await expect(status).toContainText('ENTER CONFIRMA');
  expect((await inspect()).kind).toBe('steel');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await inspect()).kind).toBeUndefined();
  await page.keyboard.press('x');
  await page.keyboard.press('4');
  await clickSupport('right');
  await expect.poll(async () => (await inspect()).rail).toBe(true);
  // La cuenta real ya se mostró y la prueba unitaria verifica sus límites.
  // Se acorta únicamente el tramo final para esperar el derrumbe en Edge.
  await page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene(
      'GalleryScene',
    ) as GalleryScene;
    scene.gallery.ventilation.install({ column: 17, row: 14 }, 'duct', {
      x: 1,
      y: 0,
    });
    for (const risk of scene.gallery.stability.sectors.values())
      if (risk.remaining !== undefined)
        risk.remaining = risk.cells.some(
          ({ cell }) => cell.column === 17 && cell.row === 14,
        )
          ? 1600
          : 20_000;
  });
  await expect.poll(async () => (await inspect()).block).toBe(Block.Rubble);
  expect((await inspect()).links).toEqual([]);
  expect((await inspect()).health).toBe(79);
  expect((await inspect()).cargo).toEqual(['iron']);
  await page.reload();
  await expect(status).toContainText('CARRITO: 1/20');
  expect((await inspect()).block).toBe(Block.Rubble);
  expect((await inspect()).rail).toBe(true);
  expect((await inspect()).duct).toBe(40);
  expect((await inspect()).air).toBe(0);

  await approach(page, 298, 235);
  await page.keyboard.down('a');
  await expect.poll(async () => (await state(page)).x).toBeLessThan(297);
  await page.keyboard.up('a');
  expect((await state(page)).x).toBeGreaterThanOrEqual(292.9);
  await page.keyboard.press('1');
  await aim(page, 17, 14);
  await page.mouse.down();
  await expect.poll(async () => (await inspect()).prop).toBe(true);
  await expect.poll(async () => (await inspect()).block).toBe(Block.Air);
  await page.mouse.up();
  expect((await inspect()).links).toContainEqual({ x: 0, y: -1 });
  expect((await inspect()).air).toBeGreaterThan(0);
  expect((await inspect()).stone).toBe(initial.stone);
  expect((await inspect()).cargo).toEqual(['iron']);
  await page.keyboard.down('a');
  await expect.poll(async () => (await state(page)).x).toBeLessThan(284);
  await page.keyboard.up('a');
  expect(errors).toEqual([]);
});

test('cansancio, comida y daño cambian la pose sin modificar la huella', async ({
  page,
}) => {
  const session = new GameSession(createInitialTerrain());
  session.modeChosen = true;
  session.claimKit();
  session.supplies.cola = 1;
  session.supplies.empanada = 1;
  session.loadout.sync();
  session.loadout.assignQuick(0, { type: 'supply', kind: 'cola' });
  session.loadout.assignQuick(1, { type: 'supply', kind: 'empanada' });
  session.survival.energy = 0;
  session.survival.hunger = 40;
  await page.addInitScript(({ key, save }) => localStorage.setItem(key, save), {
    key: SAVE_KEY,
    save: encodeSave(session, { x: 208, y: 148 }),
  });
  await page.goto('/?view=top-down');
  await expect(page.locator('#game-status')).toContainText('CAMPAMENTO');
  await enter(page);
  const actor = () =>
    page.evaluate(() => {
      const scene = window.__MINA_GAME__.scene.getScene(
        'GalleryScene',
      ) as GalleryScene;
      const { miner } = scene;
      const { health, survival, supplies } = scene.visit.session;
      return {
        frame: miner.frame.name,
        prop: miner['prop'].visible,
        propKey: miner['propKey'],
        health: health.hp,
        energy: survival.energy,
        cola: supplies.cola,
        empanada: supplies.empanada,
        width: miner.body.width,
        height: miner.body.height,
      };
    });
  await expect
    .poll(async () => (await actor()).frame)
    .toMatch(/-(tired|breath)$/);
  await page.keyboard.press('1');
  await expect
    .poll(async () => (await actor()).propKey)
    .toMatch(/:cola:mouth:true$/);
  expect(await actor()).toMatchObject({
    cola: 0,
    energy: 20,
    width: 10,
    height: 6,
  });
  await expect.poll(async () => (await actor()).prop).toBe(false);
  await page.keyboard.press('2');
  await expect
    .poll(async () => (await actor()).propKey)
    .toMatch(/:empanada:mouth:/);
  expect((await actor()).empanada).toBe(0);
  const hit = await page.evaluate(() => {
    const scene = window.__MINA_GAME__.scene.getScene(
      'GalleryScene',
    ) as GalleryScene;
    scene.visit.session.health.damage(20, scene.time.now, 'roca');
    return new Promise<string>((resolve) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve(scene.miner.frame.name)),
      );
    });
  });
  expect(hit).toMatch(/-(flash|hurt)$/);
  expect(await actor()).toMatchObject({
    health: 80,
    prop: false,
    width: 10,
    height: 6,
  });
  await expect
    .poll(async () => (await actor()).frame)
    .toMatch(/-tired$|-breath$/);
});
