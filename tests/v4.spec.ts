import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';

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

async function settle(page: Page) {
  await expect
    .poll(() => scene(page, (s) => s.miner.body.blocked.down))
    .toBe(true);
}
async function moveTo(page: Page, x: number, timeout = 12000) {
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
    { timeout },
  );
  await page.keyboard.up(key);
  await page.waitForTimeout(70);
}
/** Punto de pantalla (480 × 270) → posición del mouse en la página. */
async function screen(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  return {
    x: box.x + (x * box.width) / 480,
    y: box.y + (y * box.height) / 270,
  };
}
const giveEPP = (page: Page) =>
  scene(page, (s) => {
    for (const k of ['helmet', 'boots', 'vest', 'gloves', 'goggles'] as const)
      if (!s.session.loadout.equipped(k)) s.session.loadout.addPPE(k);
  });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await settle(page);
});

test('sin EPP no se entra; el kit de la bodega permite entrar', async ({
  page,
}) => {
  test.setTimeout(40000);
  // Partida nueva: elegir modalidad.
  expect(await scene(page, (s) => s.safety.modeOpen)).toBe(true);
  await page.keyboard.press('1');
  expect(
    await scene(page, (s) => [s.session.mode, s.session.money] as const),
  ).toEqual(['normal', 50]);
  // Intentar cruzar la bocamina sin EPP: se bloquea y se muestra qué falta.
  await page.keyboard.down('d');
  await page.waitForTimeout(1800);
  await page.keyboard.up('d');
  const blocked = await scene(page, (s) => ({
    x: s.miner.x,
    gate: s.safety.gateVisible,
  }));
  expect(blocked.x).toBeLessThan(290);
  expect(blocked.gate).toBe(true);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v4-access-denied.png' });
  // Tampoco saltando ni apareciendo dentro: vuelve a la posición segura.
  await scene(page, (s) => s.miner.body.reset(360, 148));
  await page.waitForTimeout(150);
  expect(await scene(page, (s) => s.miner.x)).toBeLessThan(290);
  await moveTo(page, 106);
  await page.keyboard.press('e');
  await expect.poll(() => scene(page, (s) => s.warehouse.open)).toBe(true);
  await scene(page, (s) => {
    const { warehouse, loadout } = s.session;
    for (let i = 0; i < 5; i++) warehouse.withdraw(s.session, 0, 1);
    loadout.slots.forEach((ref, i) => {
      if (ref?.type === 'ppe') loadout.equipFromSlot(i);
    });
    s.session.buy('iron');
    s.session.buy('shovel');
  });
  await page.keyboard.press('Escape');
  await expect
    .poll(() => scene(page, (s) => s.hud['equipment'].text))
    .toBe('5/5');
  const bought = await scene(page, (s) => ({
    money: s.session.money,
    missing: s.session.loadout.missing(),
    tools: s.session.tools.items.map((t) => t.kind),
    hud: s.hud['equipment'].text as string,
  }));
  expect(bought.money).toBe(25);
  expect(bought.missing).toEqual([]);
  expect(bought.tools).toEqual(['iron', 'shovel']);
  // HUD V8: rótulo «EPP» fijo sobre el valor.
  expect(bought.hud).toBe('5/5');
  await page.waitForTimeout(200);
  await moveTo(page, 340);
  const inside = await scene(page, (s) => ({
    x: s.miner.x,
    ach: [...s.session.achievements.unlocked],
    texture: s.miner.texture.key,
  }));
  expect(inside.x).toBeGreaterThanOrEqual(340);
  expect(inside.ach).toEqual(['primer_dia_seguro', 'minero_preparado']);
  // V13: con las cinco piezas equipadas la hoja es la vestida (máscara 31),
  // nunca la textura de reemplazo de Phaser.
  expect(inside.texture).toMatch(/^miner(-[a-z]+)?@31$/);
  expect(inside.texture).not.toContain('MISSING');
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v4-equipped-in-mine.png' });
});

test('inventario: 24 casillas libres, arrastrar sin duplicar, equipar y guardar', async ({
  page,
}) => {
  test.setTimeout(40000);
  await page.keyboard.press('1');
  await giveEPP(page);
  await scene(page, (s) => {
    s.session.tools.add('shovel');
    s.session.tools.add('iron');
    s.session.supplies.torch = 2;
    s.session.loadout.sync();
  });
  await page.keyboard.press('Tab');
  await expect.poll(() => scene(page, (s) => s.inventory.open)).toBe(true);
  const before = await scene(page, (s) => ({
    unlocked: s.session.loadout.unlocked,
    slots: s.session.loadout.slots.slice(0, 6),
  }));
  expect(before.unlocked).toBe(24);
  // Casillas del panel: x = 162 + 22·col, y = 64 + 22·fila (centro +10).
  const cell = (i: number) =>
    screen(page, 162 + (i % 6) * 22 + 10, 64 + Math.floor(i / 6) * 22 + 10);
  // Arrastrar la casilla 0 a la 4.
  const a = await cell(0),
    b = await cell(4);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  const moved = await scene(page, (s) => s.session.loadout.slots.slice(0, 6));
  expect(moved[4]).toEqual(before.slots[0]);
  expect(moved.filter(Boolean)).toHaveLength(
    before.slots.filter(Boolean).length,
  );
  // Ninguna casilla muestra candado ni requisito de nivel.
  const freeCell = await cell(8);
  await page.mouse.move(freeCell.x, freeCell.y);
  await page.waitForTimeout(100);
  const texts = await scene(page, (s) =>
    (
      s.inventory as unknown as { texts: { visible: boolean; text: string }[] }
    ).texts
      .filter((t) => t.visible)
      .map((t) => t.text)
      .join(' '),
  );
  expect(texts).not.toContain('CASILLA BLOQUEADA');
  expect(texts).not.toContain('SE DESBLOQUEA EN EL');
  // Doble clic en la herramienta de la casilla 4: se equipa (intercambio).
  const equippedBefore = await scene(page, (s) => s.session.tools.equipped);
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(60);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(100);
  const equippedAfter = await scene(page, (s) => s.session.tools.equipped);
  expect(equippedAfter).not.toBe(equippedBefore);
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v4-inventory.png' });
  // Persistencia tras guardar y recargar.
  const saved = await scene(page, (s) => ({
    slots: s.session.loadout.slots.slice(0, 6),
    equipped: s.session.tools.equipped,
    gear: s.session.loadout.gear,
  }));
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  const loaded = await scene(page, (s) => ({
    slots: s.session.loadout.slots.slice(0, 6),
    equipped: s.session.tools.equipped,
    gear: s.session.loadout.gear,
    mode: s.safety.modeOpen,
  }));
  expect(loaded).toEqual({ ...saved, mode: false });
});

test('derrumbe: golpea solo si cae sobre el minero; Normal reaparece', async ({
  page,
}) => {
  test.setTimeout(40000);
  await page.keyboard.press('1');
  await giveEPP(page);
  // Galería de 10 bloques bajo el cerro y otra lejana.
  await scene(page, (s) => {
    const cells: { column: number; row: number }[] = [];
    for (let c = 50; c <= 59; c++)
      for (const r of [14, 15]) cells.push({ column: c, row: r });
    for (const c of cells) {
      s.session.grid.set(c.column, c.row, -1);
      s.session.visibility.reveal(c.column, c.row);
    }
    s.session.afterTerrainChange(cells);
    for (const c of cells) s.terrain.redraw(c);
    s.lighting.terrainChanged();
    s.session.inventory.items.push('coal', 'iron');
    s.session.money = 100;
  });
  // Lejos del tramo: el derrumbe no lo daña.
  await scene(page, (s) => s.miner.body.reset(208, 148));
  await settle(page);
  await scene(page, (s) => {
    const c = [...s.session.geotech.collapses.values()][0]!;
    c.remaining = 300;
  });
  // El techo se desprende y cae (≈1 s); después, todo queda asentado.
  await expect
    .poll(() => scene(page, (s) => s.session.falling.active))
    .toBe(true);
  await expect
    .poll(() => scene(page, (s) => s.session.falling.active), { timeout: 8_000 })
    .toBe(false);
  expect(await scene(page, (s) => s.session.health.hp)).toBe(100);
  // Otra galería; esta vez el minero queda bajo el techo que cae.
  await scene(page, (s) => {
    const cells: { column: number; row: number }[] = [];
    for (let c = 62; c <= 71; c++)
      for (const r of [14, 15]) cells.push({ column: c, row: r });
    for (const c of cells) {
      s.session.grid.set(c.column, c.row, -1);
      s.session.visibility.reveal(c.column, c.row);
    }
    s.session.afterTerrainChange(cells);
    for (const c of cells) s.terrain.redraw(c);
    s.lighting.terrainChanged();
    s.miner.body.reset(66 * 16 + 8, 15 * 16 + 4);
    // Malherido: el golpe del bloque que le cae encima (según su velocidad;
    // ya no es letal por sí solo con salud plena) lo mata.
    s.session.health.hp = 25;
  });
  await settle(page);
  await scene(page, (s) => {
    const c = [...s.session.geotech.collapses.values()].find(
      (x) => x.span.from >= 62,
    )!;
    c.remaining = 200;
  });
  await expect(page.locator('#game-status')).toContainText(
    'APLASTADO POR UN DERRUMBE',
  );
  const after = await scene(page, (s) => ({
    deaths: s.session.deaths,
    x: s.miner.x,
    items: s.session.inventory.items.length,
    money: s.session.money,
    buried: s.session.grid.get(66, 15) === 13,
  }));
  // El bloque se parte sobre él: no queda enterrado dentro del escombro.
  expect(after.buried).toBe(false);
  // Normal: reaparece en superficie, pierde la carga y el 10 % del dinero.
  expect(after.deaths).toBe(1);
  expect(after.x).toBeGreaterThan(900);
  await page.waitForTimeout(450);
  await page.keyboard.press('Enter');
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  expect(await scene(page, (s) => s.miner.x)).toBeLessThan(300);
  expect(after.items).toBe(0);
  expect(after.money).toBe(90);
});

test('Hardcore: una muerte termina la expedición y no se reanuda', async ({
  page,
}) => {
  // Dos cargas completas del juego y una mina nueva: el límite de 30 s
  // quedaba justo (26–28 s ya antes del mundo abierto).
  test.setTimeout(60_000);
  await expect.poll(() => scene(page, (s) => s.safety.modeOpen)).toBe(true);
  await page.keyboard.press('2', { delay: 75 });
  await expect.poll(() => scene(page, (s) => s.session.mode)).toBe('hardcore');
  await giveEPP(page);
  await scene(page, (s) => {
    s.session.health.damage(500, s.time.now, 'tronadura');
  });
  await expect(page.locator('#game-status')).toContainText('Has muerto');
  const end = await scene(page, (s) => s.session.ended);
  expect(end?.cause).toBe('EXPLOSIÓN DE UNA TRONADURA');
  await page
    .locator('canvas')
    .screenshot({ path: 'docs/screenshots/v4-hardcore-end.png' });
  // Recargar no permite seguir jugando: vuelve el resumen.
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Has muerto', {
    timeout: 20_000,
  });
  const x = await scene(page, (s) => s.miner.x);
  // A (no D): en la pantalla de muerte D enfoca «MENÚ PRINCIPAL» si su
  // animación ya terminó, y el Enter de abajo iría al menú. A deja enfocado
  // «REINTENTAR» y comprueba lo mismo: el minero no se mueve.
  await page.keyboard.down('a');
  await page.waitForTimeout(400);
  await page.keyboard.up('a');
  expect(await scene(page, (s) => s.miner.x)).toBeCloseTo(x, 0);
  // Nueva mina: la terminada queda archivada en el historial.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const screen = window.__MINA_GAME__.scene.getScene('DeathScene');
        return screen.scene.isActive() && !Reflect.get(screen, 'locked');
      }),
    )
    .toBe(true);
  await page.keyboard.press('Enter');
  await expect
    .poll(() => scene(page, (s) => s.safety.modeOpen), { timeout: 20_000 })
    .toBe(true);
  const history = await page.evaluate(() => ({
    history: JSON.parse(localStorage.getItem('mina-cero.history') ?? '[]')
      .length,
    archived: Object.keys(localStorage).filter((k) =>
      k.startsWith('mina-cero.archive.'),
    ).length,
  }));
  expect(history).toEqual({ history: 1, archived: 1 });
  expect(await scene(page, (s) => s.session.ended)).toBeNull();
});
