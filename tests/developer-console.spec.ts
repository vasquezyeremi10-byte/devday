import { expect, test, type Page } from '@playwright/test';
import type { MiningScene } from '../src/game/scenes/MiningScene';

const scene = <T>(page: Page, fn: (s: MiningScene) => T) =>
  page.evaluate(
    (source) =>
      new Function('s', `return (${source})(s);`)(
        window.__MINA_GAME__.scene.getScene('MiningScene'),
      ),
    fn.toString(),
  ) as Promise<T>;

const command = async (page: Page, text: string) => {
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
};

test('las 24 casillas están disponibles y la última se conserva al recargar', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
  expect(await scene(page, (s) => s.session.loadout.unlocked)).toBe(24);
  await scene(page, (s) => {
    s.session.supplies.torch = 3;
    s.session.loadout.sync();
    s.session.loadout.move(0, 23);
    s.save();
  });
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  expect(
    await scene(page, (s) => ({
      slots: s.session.loadout.unlocked,
      last: s.session.loadout.slots[23],
      count: s.session.supplies.torch,
      level: s.session.progression.level,
    })),
  ).toEqual({
    slots: 24,
    last: { type: 'supply', kind: 'torch' },
    count: 3,
    level: 1,
  });
  await page.keyboard.press('Tab');
  await expect.poll(() => scene(page, (s) => s.inventory.open)).toBe(true);
});

test('la pausa conserva las mechas; informa errores de guardado y admite reintentar', async ({
  page,
}) => {
  await page.goto('/?dev=1');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
  await scene(page, (s) => {
    s.session.blasting.charges.push({
      column: 21,
      row: 9,
      endsAt: s.game.loop.time + 3000,
    });
    s.session.health.invulnerableUntil = s.game.loop.time + 3000;
  });
  await page.keyboard.press('|');
  const remaining = await scene(
    page,
    (s) => s.session.blasting.charges[0]!.endsAt! - s.game.loop.time,
  );
  await page.waitForTimeout(3200);
  // Simular cuota agotada solo durante el comando; luego recuperar Storage.
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Object.assign(window, {
      restoreStorage: () => {
        Storage.prototype.setItem = original;
      },
    });
    Storage.prototype.setItem = () => {
      throw new Error('Cuota de prueba');
    };
  });
  await command(page, 'fullstacks');
  const errorVisible = await scene(page, (s) =>
    s.children.list.some((o) => {
      const list = (o as unknown as { list?: { text?: string }[] }).list;
      return list?.some((child) => child.text?.includes('ERROR AL GUARDAR'));
    }),
  );
  expect(errorVisible).toBe(true);
  await page.evaluate(() =>
    (window as unknown as { restoreStorage: () => void }).restoreStorage(),
  );
  await page.keyboard.press('Escape');
  const after = await scene(page, (s) => ({
    fuse: (s.session.blasting.charges[0]?.endsAt ?? 0) - s.game.loop.time,
    protection: s.session.health.invulnerableUntil - s.game.loop.time,
    blasts: s.session.blasting.blasts,
  }));
  expect(after.blasts).toBe(0);
  expect(after.fuse).toBeGreaterThan(remaining - 1000);
  expect(after.protection).toBeGreaterThan(0);
  await page.keyboard.press('g');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('mina-cero.developer.save.v5')!)
            .developer.fullStacks,
      ),
    )
    .toBe(true);
});

test('consola: escritura aislada, AltGr, compras, persistencia y partida normal intacta', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
  await scene(page, (s) => s.save());
  // La tecla | abre los códigos en toda partida; abrir y cerrar no cambia nada.
  await page.keyboard.press('|');
  expect(await scene(page, (s) => s.developerConsole?.open)).toBe(true);
  await page.keyboard.press('Escape');
  expect(await scene(page, (s) => s.developerConsole?.open)).toBe(false);

  await page.goto('/?dev=1');
  await expect(page.locator('#game-status')).toContainText('DESARROLLADOR');
  // pagehide guarda los últimos milisegundos de la partida que acabamos de salir.
  const normalSave = await page.evaluate(() =>
    localStorage.getItem('mina-cero.save.v5'),
  );
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
  await scene(page, (s) => {
    s.session.money = 0;
  });
  await page.waitForTimeout(250);
  // Combinación española: el carácter producido manda, no Digit1/Backslash.
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '|',
        code: 'Digit1',
        ctrlKey: true,
        altKey: true,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keyup', { key: '|', code: 'Digit1', bubbles: true }),
    );
  });
  expect(await scene(page, (s) => s.developerConsole?.open)).toBe(true);
  const before = await scene(page, (s) => ({
    x: s.miner.x,
    y: s.miner.y,
    mute: s.sound.mute,
    tools: s.session.tools.items.length,
    category: s.phone.category,
  }));
  await page.keyboard.down('d');
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await command(page, 'mfrzhqxc');
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(
    box.x + (box.width * 412) / 480,
    box.y + (box.height * 121) / 270,
  );
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {
    button: 'right',
  });
  await page.waitForTimeout(300);
  expect(
    await scene(page, (s) => ({
      x: s.miner.x,
      y: s.miner.y,
      mute: s.sound.mute,
      tools: s.session.tools.items.length,
      category: s.phone.category,
    })),
  ).toEqual(before);
  await page.keyboard.up('d');
  await command(page, 'money');
  await command(page, 'fullstacks');
  expect(
    await scene(page, (s) => [
      s.session.developer.infiniteMoney,
      s.session.developer.fullStacks,
    ]),
  ).toEqual([true, true]);
  await canvas.screenshot({ path: 'docs/screenshots/developer-console.png' });
  await page.keyboard.press('Escape');
  await expect
    .poll(() => scene(page, (s) => s.developerConsole?.open))
    .toBe(false);
  await page.keyboard.press('u');
  await expect.poll(() => scene(page, (s) => s.phone.open)).toBe(true);
  await scene(page, (s) => {
    s.phone.cart.add('tungsten');
    s.phone.confirm();
  });
  expect(
    await scene(page, (s) => s.session.drones.orders[0]?.items[0]?.kind),
  ).toBe('tungsten');
  expect(await scene(page, (s) => s.session.money)).toBe(0);
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  expect(
    await scene(page, (s) => [
      s.session.developer.infiniteMoney,
      s.session.developer.fullStacks,
    ]),
  ).toEqual([true, true]);
  await page.keyboard.press('|');
  await command(page, 'money');
  await page.keyboard.press('|');
  await expect.poll(() => scene(page, (s) => s.scene.isActive())).toBe(true);
  expect(await scene(page, (s) => s.session.buy('iron'))).toBe(
    'SALDO INSUFICIENTE',
  );
  // Reabrir y reiniciar no duplica listeners ni invierte dos veces MONEY.
  // Sin devolver el ScenePlugin: Playwright intentaría serializar la escena.
  await scene(page, (s) => {
    s.scene.restart();
  });
  await expect
    .poll(() => scene(page, (s) => !!s.developerConsole && s.scene.isActive()))
    .toBe(true);
  await page.waitForTimeout(300);
  await page.keyboard.press('|');
  await command(page, 'money');
  expect(await scene(page, (s) => s.session.developer.infiniteMoney)).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  expect(
    await page.evaluate(() => localStorage.getItem('mina-cero.save.v5')),
  ).toBe(normalSave);
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista');
  expect(await scene(page, (s) => s.session.developer.enabled)).toBe(false);
});
