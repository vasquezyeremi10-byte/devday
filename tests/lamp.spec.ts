import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import { LIGHTING } from '../src/game/config/lighting';

/**
 * V9/V12: luz del casco (radial desde V12, como una antorcha en la mano),
 * interruptor, batería (0 %, aviso, reemplazo), compra en la bodega y
 * persistencia de la carga entre recargas de la página.
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

/** Luz compuesta del último fotograma delante y detrás del minero. */
const beam = (page: Page) =>
  scene(page, (s) => {
    const o = s.lighting.lampOrigin(s.miner);
    return {
      zone: s.lighting.zone,
      power: s.lighting.lamp.power,
      ahead: s.lighting.lightAt(o.x + 24 * (s.miner.flipX ? -1 : 1), o.y + 2),
      behind: s.lighting.lightAt(o.x - 24 * (s.miner.flipX ? -1 : 1), o.y + 2),
      charge: s.session.headlamp.charge,
      on: s.session.headlamp.on,
      message: s.hud['message'].text,
    };
  });

/** Galería profunda excavada y minero dentro de ella, mirando a la derecha. */
async function deepGallery(page: Page) {
  await scene(page, (s) => {
    // Estado conocido de la linterna para toda la prueba.
    s.session.headlamp.restore({ charge: 100, on: true });
    s.session.supplies.battery = 0;
    for (let c = 30; c <= 44; c++)
      for (const r of [22, 23]) {
        s.session.grid.set(c, r, -1);
        s.terrain.remove({ column: c, row: r });
      }
    s.lighting.terrainChanged();
    s.miner.body.reset(34 * 16 + 8, 23 * 16 + 4);
    s.miner.setFlipX(false);
    // Excavar la galería en bloque deja el techo inestable (derrumbe a los
    // ~10 s) y el aire viciado (daño tras 6 s): se desactivan para que no
    // interrumpan la prueba.
    s.session.geotech.evaluate = () => {};
    s.session.geotech.tick = () => [];
    s.session.ventilation.at = () => 1;
  });
  await expect.poll(async () => (await beam(page)).zone).toBe('deep');
  await expect.poll(async () => (await beam(page)).power).toBe(1);
}

/** Devuelve al minero al interior de la galería excavada por deepGallery. */
const backToGallery = (page: Page) =>
  scene(page, (s) => {
    s.miner.body.reset(34 * 16 + 8, 23 * 16 + 4);
    s.miner.setFlipX(false);
  });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await page.keyboard.press('1');
  await scene(page, (s) => {
    for (const k of ['helmet', 'boots', 'vest', 'gloves', 'goggles'] as const)
      if (!s.session.loadout.equipped(k)) s.session.loadout.addPPE(k);
    s.session.firstDayDone = true;
  });
});

test('V12: luz radial del casco, interruptor y encendido', async ({
  page,
}) => {
  await deepGallery(page);
  // Luz radial: delante y detrás reciben lo mismo, mire a donde mire.
  let state = await beam(page);
  expect(state.ahead).toBeGreaterThan(0.8);
  expect(state.behind).toBeGreaterThan(0.8);
  expect(Math.abs(state.ahead - state.behind)).toBeLessThan(0.06);
  // Sin devolver el sprite: Playwright intentaría serializar todo el grafo de Phaser.
  await scene(page, (s) => {
    s.miner.setFlipX(true);
  });
  state = await beam(page);
  expect(state.ahead).toBeGreaterThan(0.8);
  expect(state.behind).toBeGreaterThan(0.8);
  expect(Math.abs(state.ahead - state.behind)).toBeLessThan(0.06);
  // Interruptor: apagar con L y volver a encender.
  await page.keyboard.press('l');
  await expect.poll(async () => (await beam(page)).power).toBe(0);
  expect((await beam(page)).message).toContain('LINTERNA APAGADA');
  await page.keyboard.press('l');
  await expect.poll(async () => (await beam(page)).power).toBe(1);
  // Sin casco no hay lámpara; al volver a equiparlo, el haz regresa.
  await scene(page, (s) => s.session.loadout.unequip('head'));
  await expect.poll(async () => (await beam(page)).power).toBe(0);
  await scene(page, (s) => {
    const item = s.session.loadout.ppe.find((p) => p.kind === 'helmet')!;
    s.session.loadout.gear.head = item.id;
    s.session.loadout.sync();
  });
  // Sin casco el control de acceso lo sacó de la mina: vuelve a la galería.
  await backToGallery(page);
  await expect.poll(async () => (await beam(page)).power).toBe(1);
});

test('V9: batería 0 %, aviso, reemplazo sin y con repuestos', async ({
  page,
}) => {
  await deepGallery(page);
  // Consumo acelerado: el tick puro gasta por tiempo, no por fotogramas.
  await scene(
    page,
    (s, ms) => s.session.headlamp.tick(ms * 0.85, true),
    LIGHTING.battery.durationMs,
  );
  await expect
    .poll(async () => (await beam(page)).message)
    .toContain('BATERIA BAJA');
  await scene(
    page,
    (s, ms) => s.session.headlamp.tick(ms, true),
    LIGHTING.battery.durationMs,
  );
  // Al llegar a 0 % el haz se apaga del todo.
  await expect.poll(async () => (await beam(page)).power).toBe(0);
  await expect
    .poll(async () => (await beam(page)).message)
    .toContain('BATERIA AGOTADA');
  // Reemplazo sin repuestos: mensaje breve y sin cambios.
  await page.keyboard.press('b');
  await expect
    .poll(async () => (await beam(page)).message)
    .toContain('NO TIENES BATERIAS');
  expect((await beam(page)).charge).toBe(0);
  expect((await beam(page)).power).toBe(0);
  await scene(page, (s) => s.session.receive('battery'));
  await page.keyboard.press('Escape');
  // La tienda se cierra con una animación breve; hasta entonces las teclas no rigen.
  await expect.poll(() => scene(page, (s) => s.hud.modal)).toBe(false);
  await backToGallery(page);
  // Reemplazo: consume el repuesto, restaura 100 % y el haz vuelve.
  await page.keyboard.press('b');
  await expect
    .poll(async () => (await beam(page)).message)
    .toContain('BATERIA REEMPLAZADA');
  // Restaura 100 %; el haz ya puede haber gastado una fracción mínima.
  expect((await beam(page)).charge).toBeGreaterThan(99.9);
  expect((await beam(page)).on).toBe(true);
  await expect.poll(async () => (await beam(page)).power).toBe(1);
  // Un segundo cambio con la carga llena no desperdicia el repuesto...
  // (ya no hay repuestos: 1 consumido, 0 restantes tras la compra única).
  expect(await scene(page, (s) => s.session.supplies.battery)).toBe(0);
});

test('V9: indicador del HUD y persistencia de la carga', async ({ page }) => {
  await scene(page, (s) => {
    for (const k of ['helmet', 'boots', 'vest', 'gloves', 'goggles'] as const)
      if (!s.session.loadout.equipped(k)) s.session.loadout.addPPE(k);
    s.session.firstDayDone = true;
  });
  // Cinco íconos de batería en el HUD.
  const frames = () =>
    scene(page, (s) =>
      (
        s.hud as unknown as { batteries: { frame: { name: string } }[] }
      ).batteries.map((i) => i.frame.name),
    );
  expect((await frames()).length).toBe(5);
  // Gasta hasta 40 %: dos íconos llenos y tres vacíos.
  await scene(
    page,
    (s, ms) => s.session.headlamp.tick(ms * 0.6, true),
    LIGHTING.battery.durationMs,
  );
  await expect
    .poll(async () => frames())
    .toEqual([
      'battery_full',
      'battery_full',
      'battery_empty',
      'battery_empty',
      'battery_empty',
    ]);
  // La carga (y el interruptor) sobreviven a un recargo de la página.
  await scene(page, (s) => (s.session.headlamp.on = false));
  await scene(page, (s) => s.save());
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  const restored = await scene(page, (s) => ({
    charge: s.session.headlamp.charge,
    on: s.session.headlamp.on,
  }));
  expect(restored.charge).toBeCloseTo(40, 0);
  expect(restored.on).toBe(false);
});
