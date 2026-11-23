import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';

/**
 * V13: minero rediseñado. EPP visible por piezas (casco, gafas, chaleco,
 * guantes, botas), hoja según la herramienta, animaciones y cuerpo físico
 * intacto.
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

/**
 * Filas del cuadro actual en que la hoja vestida difiere de su hoja base
 * (sin EPP): [primera, última, píxeles distintos].
 */
const dressedRows = (page: Page) =>
  scene(page, (s) => {
    const key = s.miner.texture.key;
    const base = key.split('@')[0]!;
    const frame = s.miner.frame.name;
    const read = (k: string) => {
      const f = s.textures.getFrame(k, frame);
      const c = document.createElement('canvas');
      c.width = 32;
      c.height = 32;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(
        f.source.image as CanvasImageSource,
        f.cutX,
        f.cutY,
        32,
        32,
        0,
        0,
        32,
        32,
      );
      return ctx.getImageData(0, 0, 32, 32).data;
    };
    const a = read(key),
      b = read(base);
    let top = 99,
      bottom = -1,
      count = 0;
    for (let i = 0; i < a.length; i += 4)
      if (
        a[i] !== b[i] ||
        a[i + 1] !== b[i + 1] ||
        a[i + 2] !== b[i + 2] ||
        a[i + 3] !== b[i + 3]
      ) {
        const y = Math.floor(i / 4 / 32);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        count++;
      }
    return { key, top, bottom, count };
  });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await expect
    .poll(() => scene(page, (s) => s.miner.body.blocked.down))
    .toBe(true);
  // Partida nueva: modalidad Normal.
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
});

test('cada pieza de EPP aparece al equiparla y desaparece al quitarla', async ({
  page,
}) => {
  // Partida sin EPP: el minero usa su hoja base.
  await scene(page, (s) => {
    const l = s.session.loadout;
    for (const slot of ['head', 'eyes', 'torso', 'hands', 'feet'] as const)
      l.unequip(slot);
  });
  await expect
    .poll(() => scene(page, (s) => s.miner.texture.key))
    .not.toContain('@');
  // [pieza, ranura, bit, filas del cuadro donde debe verse].
  const pieces = [
    ['helmet', 'head', 1, 4, 11],
    ['goggles', 'eyes', 2, 9, 14],
    ['vest', 'torso', 4, 15, 24],
    ['gloves', 'hands', 8, 9, 31],
    ['boots', 'feet', 16, 25, 31],
  ] as const;
  for (const [kind, slot, bit, from, to] of pieces) {
    await scene(page, (s, k) => s.session.loadout.addPPE(k), kind);
    await expect
      .poll(() => scene(page, (s) => s.miner.texture.key))
      .toMatch(new RegExp(`@${bit}$`));
    const dressed = await dressedRows(page);
    expect(dressed.count, kind).toBeGreaterThan(3);
    expect(dressed.top, kind).toBeGreaterThanOrEqual(from);
    expect(dressed.bottom, kind).toBeLessThanOrEqual(to);
    await page
      .locator('canvas')
      .screenshot({ path: test.info().outputPath(`epp-${kind}.png`) });
    expect(
      await scene(page, (s, sl) => s.session.loadout.unequip(sl), slot),
    ).toBeNull();
    await expect
      .poll(() => scene(page, (s) => s.miner.texture.key))
      .not.toContain('@');
  }
  // Todo el EPP a la vez: máscara 31 y la linterna vuelve con el casco.
  await scene(page, (s) => {
    for (const k of ['helmet', 'goggles', 'vest', 'gloves', 'boots'] as const)
      if (!s.session.loadout.equipped(k)) s.session.loadout.addPPE(k);
  });
  await expect
    .poll(() => scene(page, (s) => s.miner.texture.key))
    .toMatch(/@31$/);
  expect(await scene(page, (s) => s.lighting.helmet)).toBe(true);
  await page
    .locator('canvas')
    .screenshot({ path: test.info().outputPath('epp-completo.png') });
});

test('la hoja sigue a la herramienta en mano y conserva el cuerpo físico', async ({
  page,
}) => {
  const expected = {
    iron: 'miner',
    shovel: 'miner-shovel',
    tungsten: 'miner-tungsten',
    axe: 'miner-axe',
    drill: 'miner-unarmed',
  } as const;
  for (const [kind, sheet] of Object.entries(expected)) {
    await scene(
      page,
      (s, k) => {
        s.session.tools.add(k as never);
        s.session.loadout.equipToolKind(k as never);
      },
      kind,
    );
    await expect
      .poll(() => scene(page, (s) => s.miner.texture.key.split('@')[0]))
      .toBe(sheet);
    expect(
      await scene(page, (s) => s.textures.get(s.miner.texture.key).key),
    ).not.toBe('__MISSING');
  }
  const body = await scene(page, (s) => ({
    w: s.miner.body.width,
    h: s.miner.body.height,
    ox: s.miner.body.offset.x,
    oy: s.miner.body.offset.y,
    frame: s.miner.frame.width,
  }));
  expect(body).toEqual({ w: 10, h: 18, ox: 11, oy: 14, frame: 32 });
});

test('caminar, saltar y reposar usan sus cuadros', async ({ page }) => {
  const frame = () => scene(page, (s) => Number(s.miner.frame.name));
  await page.keyboard.down('d');
  await expect.poll(frame).toBeGreaterThanOrEqual(4);
  const walking = await frame();
  expect(walking).toBeLessThanOrEqual(11);
  const x0 = await scene(page, (s) => s.miner.x);
  await page.waitForTimeout(300);
  await page.keyboard.up('d');
  expect(await scene(page, (s) => s.miner.x)).toBeGreaterThan(x0);
  expect(await scene(page, (s) => s.miner.flipX)).toBe(false);
  await page.keyboard.press('Space');
  await expect.poll(frame).toBeGreaterThanOrEqual(12);
  expect(await frame()).toBeLessThanOrEqual(15);
  await expect
    .poll(() => scene(page, (s) => s.miner.body.blocked.down))
    .toBe(true);
  await expect.poll(frame, { timeout: 3000 }).toBeLessThanOrEqual(3);
  await page.keyboard.down('a');
  await page.waitForTimeout(200);
  await page.keyboard.up('a');
  expect(await scene(page, (s) => s.miner.flipX)).toBe(true);
});

test('sprint: Shift izquierdo corre a 1,6 veces la velocidad y al soltarlo camina', async ({
  page,
}) => {
  const start = await scene(page, (s) => ({ x: s.miner.x, y: s.miner.y }));
  // Cada tramo parte del mismo punto y mide el avance en 400 ms; anota las
  // animaciones vistas (un desnivel puede dar un cuadro en el aire).
  const run = async (keys: string[]) => {
    await scene(page, (s, p) => s.miner.body.reset(p.x, p.y), start);
    await expect
      .poll(() => scene(page, (s) => s.miner.body.blocked.down))
      .toBe(true);
    for (const k of keys) await page.keyboard.down(k);
    const x0 = await scene(page, (s) => s.miner.x);
    const anims = new Set<string>();
    let sprinting = false;
    let speed = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 400) {
      const st = await scene(page, (s) => ({
        sprinting: s.miner.sprinting,
        anim: s.miner.anims.currentAnim?.key ?? '',
        vx: Math.abs(s.miner.body.velocity.x),
      }));
      anims.add(st.anim);
      sprinting ||= st.sprinting;
      speed = Math.max(speed, st.vx);
      await page.waitForTimeout(40);
    }
    const dx = (await scene(page, (s) => s.miner.x)) - x0;
    for (const k of [...keys].reverse()) await page.keyboard.up(k);
    await page.waitForTimeout(150);
    return { dx, speed, sprinting, anims: [...anims] };
  };
  const walk = await run(['d']);
  expect(walk.sprinting).toBe(false);
  expect(walk.anims).toContain('miner-walk');
  expect(walk.anims).not.toContain('miner-run');
  expect(walk.dx).toBeGreaterThan(15);
  // Shift derecho no activa el sprint.
  const right = await run(['d', 'ShiftRight']);
  expect(right.sprinting).toBe(false);
  // Shift izquierdo: corre con su animación de carrera.
  const sprint = await run(['d', 'ShiftLeft']);
  expect(sprint.sprinting).toBe(true);
  expect(sprint.anims).toContain('miner-run');
  // Velocidad del cuerpo (exacta) y avance real (con margen por el muestreo).
  expect(sprint.speed / walk.speed).toBeCloseTo(1.6, 2);
  expect(sprint.dx / walk.dx).toBeGreaterThan(1.3);
  // Al soltar Shift vuelve a caminar.
  const after = await run(['d']);
  expect(after.sprinting).toBe(false);
  expect(after.anims).not.toContain('miner-run');
});