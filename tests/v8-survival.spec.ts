import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import { WORLD_LEFT, WORLD_WIDTH } from '../src/game/config/constants';

/**
 * V8: mundo ampliado, campamento minero, cabaña con interior, descanso que
 * cambia la fase del día, energía y alimentación con daño gradual, comida en
 * la bodega y guardado. Capturas reales del renderizador (×3, vecino más
 * cercano) en docs/screenshots/v8-*.png.
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
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.__MINA_GAME__.renderer.snapshot((image) => {
          const img = image as HTMLImageElement;
          const draw = () => {
            const c = document.createElement('canvas');
            c.id = 'v8s-snap';
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
    .locator('#v8s-snap')
    .screenshot({ path: `docs/screenshots/${name}.png` });
  await page.evaluate(() => document.getElementById('v8s-snap')?.remove());
}

/** Lleva al minero a un punto de la superficie y espera que pise el suelo. */
async function place(page: Page, x: number, y = 148) {
  await scene(page, (s, p) => s.miner.body.reset(p.x, p.y), { x, y });
  await expect
    .poll(() => scene(page, (s) => s.miner.body.blocked.down))
    .toBe(true);
}

const setClock = (page: Page, ms: number) =>
  scene(page, (s, value) => s.session.dayNight.restore(value), ms);

test.use({ viewport: { width: 1480, height: 900 } });
test.setTimeout(90_000);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
  await scene(page, (s) => {
    s.session.buy('kit');
    s.session.firstDayDone = true;
    s.hud['awardUntil'] = 0;
  });
});

test('V8: el mundo se extiende a ambos lados y la cámara sigue al minero', async ({
  page,
}) => {
  const bounds = await scene(page, (s) => {
    const b = s.physics.world.bounds;
    const c = s.cameras.main.getBounds();
    return { left: b.x, right: b.right, camLeft: c.x, camRight: c.right };
  });
  // V9: el mundo sigue creciendo hacia ambos lados (monolitos y biomas del este).
  expect(bounds).toEqual({
    left: WORLD_LEFT,
    right: WORLD_LEFT + WORLD_WIDTH,
    camLeft: WORLD_LEFT,
    camRight: WORLD_LEFT + WORLD_WIDTH,
  });
  expect(WORLD_LEFT).toBeLessThan(-640);
  expect(WORLD_LEFT + WORLD_WIDTH).toBeGreaterThan(2240);
  // Campamento a la izquierda: la cámara llega y el minero pisa suelo firme.
  await place(page, -600);
  const left = await scene(page, (s) => ({
    scroll: s.cameras.main.scrollX,
    zone: s.lighting.zone,
    visible: s.cameras.main.worldView.contains(s.miner.x, s.miner.y),
  }));
  expect(left.zone).toBe('surface');
  expect(left.visible).toBe(true);
  // V9 agrega monolitos al oeste: -640 ya no es el límite de la cámara.
  expect(left.scroll).toBeGreaterThan(WORLD_LEFT);
  expect(left.scroll).toBeLessThan(-640);
  // Ampliación derecha: cerro rocoso con terreno excavable y continuidad.
  await place(page, 1700, 40);
  const right = await scene(page, (s) => ({
    scroll: s.cameras.main.scrollX,
    visible: s.cameras.main.worldView.contains(s.miner.x, s.miner.y),
    digable: s.session.grid.get(90, 12),
    edge: s.session.grid.get(79, 14),
  }));
  expect(right.scroll).toBeGreaterThan(1200);
  expect(right.visible).toBe(true);
  expect(right.digable).not.toBe(2); // no es lecho de roca
  expect(right.edge).not.toBe(2); // sin barrera tras la mina original
  await shot(page, 'v8-world-right');
  // Las instalaciones originales siguen en su sitio y funcionan.
  await place(page, 106);
  expect(await scene(page, (s) => s.interactions.selected?.id)).toBe('warehouse');
});

test('V8: campamento, cabaña con Z, interior y salida', async ({ page }) => {
  await setClock(page, 120_000);
  await place(page, -200);
  await shot(page, 'v8-camp-day');
  await place(page, -290);
  await scene(page, (s) => {
    s.miner.setFlipX(true);
  });
  await expect
    .poll(() => scene(page, (s) => s.hud['prompt'].text))
    .toBe('[E] ENTRAR A LA CABAÑA');
  await page.keyboard.press('z');
  await expect.poll(() => scene(page, (s) => s.cabin.open)).toBe(true);
  expect(await scene(page, (s) => s.session.inCabin)).toBe(true);
  expect(await scene(page, (s) => s.hud['zoneText'].text)).toBe('CABAÑA');
  // Caminar con D hacia el casillero y la cama.
  await page.keyboard.down('d');
  await expect
    .poll(() => scene(page, (s) => s.cabin.prompt), { timeout: 10_000 })
    .toBe('[E] DESCANSAR');
  await page.keyboard.up('d');
  await shot(page, 'v8-cabin-interior');
  // Salir: volver a la puerta.
  await page.keyboard.down('a');
  await expect
    .poll(() => scene(page, (s) => s.cabin.prompt), { timeout: 10_000 })
    .toBe('[E] SALIR DE LA CABAÑA');
  await page.keyboard.up('a');
  await page.keyboard.press('z');
  await expect.poll(() => scene(page, (s) => s.cabin.open)).toBe(false);
  expect(await scene(page, (s) => s.miner.visible)).toBe(true);
  // De noche las ventanas y los faroles brillan.
  await setClock(page, 420_000);
  await page.waitForTimeout(300);
  await shot(page, 'v8-camp-night');
});

test('V8: dormir de día lleva a la noche y de noche al día, con energía completa', async ({
  page,
}) => {
  await place(page, -290);
  await page.keyboard.press('z');
  await expect.poll(() => scene(page, (s) => s.cabin.open)).toBe(true);
  const before = await scene(page, (s) => {
    s.session.dayNight.restore(100_000);
    s.session.survival.energy = 15;
    s.session.money = 33;
    s.session.inventory.add('coal');
    s.cabin['x'] = 330;
    return { xp: s.session.progression.xp, hunger: s.session.survival.hunger };
  });
  await page.keyboard.press('z');
  // La secuencia pasa por acostarse, dormir y el fundido a negro.
  await expect
    .poll(() => scene(page, (s) => s.cabin.state), { timeout: 6000 })
    .toBe('doze');
  // El cielo no cambia mientras está de pie ni acostado antes del negro.
  expect(await scene(page, (s) => s.session.dayNight.isDay)).toBe(true);
  await shot(page, 'v8-sleeping');
  await expect
    .poll(() => scene(page, (s) => s.cabin.state), { timeout: 6000 })
    .toBe('black');
  await expect
    .poll(() => scene(page, (s) => s.cabin.state), { timeout: 10_000 })
    .toBe('idle');
  const night = await scene(page, (s) => ({
    phase: s.session.dayNight.phase,
    energy: s.session.survival.energy,
    hunger: s.session.survival.hunger,
    money: s.session.money,
    items: s.session.inventory.items.length,
    xp: s.session.progression.xp,
    woke: s.session.survival.lastSleep?.woke,
  }));
  expect(night.phase).toBe('night');
  expect(night.energy).toBe(100);
  expect(night.hunger).toBeLessThan(before.hunger);
  expect([night.money, night.items, night.xp]).toEqual([33, 1, before.xp]);
  expect(night.woke).toBe('night');
  await shot(page, 'v8-cabin-night');
  // De noche: despierta al comienzo del día.
  await scene(page, (s) => {
    s.session.dayNight.restore(400_000);
    s.session.survival.energy = 40;
  });
  await page.keyboard.press('z');
  await expect
    .poll(() => scene(page, (s) => s.session.survival.lastSleep?.woke), {
      timeout: 12_000,
    })
    .toBe('day');
  await expect
    .poll(() => scene(page, (s) => s.cabin.state), { timeout: 10_000 })
    .toBe('idle');
  expect(await scene(page, (s) => s.session.dayNight.isDay)).toBe(true);
  expect(await scene(page, (s) => s.session.survival.energy)).toBe(100);
  // Con hambre extrema no se puede dormir.
  await scene(page, (s) => (s.session.survival.hunger = 0));
  await page.keyboard.press('z');
  await page.waitForTimeout(200);
  expect(await scene(page, (s) => s.cabin.state)).toBe('idle');
  expect(await scene(page, (s) => s.hud['message'].text)).toContain('HAMBRE');
});

test('V8: HUD de cinco energías y cinco alimentos; trabajar los consume', async ({
  page,
}) => {
  const hud = await scene(page, (s) => ({
    bolts: s.hud['bolts'].map((b) => b.frame.name),
    meals: s.hud['meals'].map((b) => b.frame.name),
  }));
  expect(hud.bolts).toEqual(Array(5).fill('bolt_full'));
  expect(hud.meals).toEqual(Array(5).fill('food_full'));
  // Excavar de verdad con la picota gasta energía (4 por bloque) y algo de hambre.
  await place(page, 50 * 16 + 8);
  const dug = await scene(page, (s) => {
    const pick = s.session.tools.add('iron');
    s.session.tools.equipped = pick.id;
    const e0 = s.session.survival.energy,
      h0 = s.session.survival.hunger;
    const cell = { column: 50, row: 10 };
    const ok = s.session.mine(s.mining, s.miner.body.center, cell);
    return {
      ok,
      energy: e0 - s.session.survival.energy,
      hunger: h0 - s.session.survival.hunger,
    };
  });
  expect(dug.ok).toBe(true);
  expect(dug.energy).toBe(4);
  expect(dug.hunger).toBeGreaterThan(0);
  // El hambre baja con el tiempo de juego.
  const h1 = await scene(page, (s) => s.session.survival.hunger);
  await page.waitForTimeout(1500);
  expect(await scene(page, (s) => s.session.survival.hunger)).toBeLessThan(h1);
  // Los íconos se vacían al bajar.
  await scene(page, (s) => {
    s.session.survival.energy = 50;
    s.session.survival.hunger = 30;
  });
  await page.waitForTimeout(800);
  const low = await scene(page, (s) => ({
    bolts: s.hud['bolts'].map((b) => b.frame.name),
    meals: s.hud['meals'].map((b) => b.frame.name),
  }));
  expect(low.bolts).toEqual([
    'bolt_full',
    'bolt_full',
    'bolt_half',
    'bolt_empty',
    'bolt_empty',
  ]);
  expect(low.meals.filter((f) => f === 'food_empty')).toHaveLength(3);
  await shot(page, 'v8-hud-survival');
});

test('V8: agotamiento y hambre extremos quitan salud de a poco', async ({
  page,
}) => {
  await place(page, 208);
  // Agotamiento: esforzarse sin energía cuesta salud, sin muerte inmediata.
  await scene(page, (s) => {
    s.session.survival.energy = 0;
    s.session.effort('pick');
  });
  await expect
    .poll(() => scene(page, (s) => s.session.health.hp))
    .toBeLessThan(100);
  const hp = await scene(page, (s) => s.session.health.hp);
  expect(hp).toBeGreaterThan(90);
  expect(await scene(page, (s) => s.miner.speedFactor)).toBeLessThan(1);
  // Desnutrición prolongada: daño gradual que se detiene al comer.
  await scene(page, (s) => {
    s.session.survival.energy = 100;
    s.session.survival.hunger = 0;
    s.session.survival.starvingMs = 60_000;
  });
  await page.waitForTimeout(2000);
  const starving = await scene(page, (s) => s.session.health.hp);
  expect(starving).toBeLessThan(hp);
  await scene(page, (s) => {
    s.session.supplies.empanada = 1;
    s.consumeFood('empanada');
  });
  const fed = await scene(page, (s) => s.session.health.hp);
  await page.waitForTimeout(1500);
  expect(await scene(page, (s) => s.session.health.hp)).toBeGreaterThanOrEqual(
    fed,
  );
  expect(await scene(page, (s) => s.session.survival.starving)).toBe(false);
});

test('V8: la comida chilena se consume desde barra e inventario', async ({
  page,
}) => {
  await scene(page, (s) => {
    for (const kind of ['cola', 'cola', 'sandwich', 'empanada', 'empanada'] as const)
      s.session.receive(kind);
  });
  // Barra rápida: la tecla del alimento lo come (no cambia lo equipado).
  await scene(page, (s) => {
    s.session.loadout.assignQuick(4, { type: 'supply', kind: 'cola' });
    s.session.survival.energy = 50;
    s.session.survival.hunger = 20;
  });
  await page.keyboard.press('5');
  await expect
    .poll(() => scene(page, (s) => s.session.survival.energy))
    .toBe(70);
  expect(await scene(page, (s) => s.session.supplies.cola)).toBe(1);
  await shot(page, 'v8-eating');
  // Inventario: USAR un sándwich (+3) sin pasar de cinco unidades.
  const used = await scene(page, (s) => {
    const msg = s.inventory.onUse?.('sandwich');
    return { msg, hunger: s.session.survival.hunger };
  });
  expect(used.msg).toBe('+3 ALIMENTACION');
  expect(used.hunger).toBeGreaterThan(75);
  expect(used.hunger).toBeLessThanOrEqual(100);
  await scene(page, (s) => (s.session.survival.hunger = 99));
  const capped = await scene(page, (s) => {
    s.inventory.onUse?.('empanada');
    return s.session.survival.hunger;
  });
  expect(capped).toBe(100);
});

test('V8: energía, hambre, comida, cabaña y hora se guardan y recuperan', async ({
  page,
}) => {
  await place(page, -290);
  await page.keyboard.press('z');
  await expect.poll(() => scene(page, (s) => s.cabin.open)).toBe(true);
  await scene(page, (s) => {
    s.session.survival.energy = 43;
    s.session.survival.hunger = 57;
    s.session.supplies.empanada = 4;
    s.session.dayNight.restore(350_000);
    s.save();
  });
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  const back = await scene(page, (s) => ({
    energy: Math.round(s.session.survival.energy),
    hunger: Math.round(s.session.survival.hunger),
    empanadas: s.session.supplies.empanada,
    inCabin: s.session.inCabin,
    open: s.cabin.open,
    night: s.session.dayNight.phase,
    key: localStorage.getItem('mina-cero.save.v6') !== null,
  }));
  expect(back).toEqual({
    energy: 43,
    hunger: 57,
    empanadas: 4,
    inCabin: true,
    open: true,
    night: 'night',
    key: true,
  });
});
