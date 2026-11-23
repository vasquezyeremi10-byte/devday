import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import { INTRO_OBJECTIVES } from '../src/game/config/intro';
import type { MiningScene } from '../src/game/scenes/MiningScene';

/**
 * «La herencia del abuelo»: inicio en la cabaña, diálogo omitible, E para
 * interactuar, herramientas en la bodega, entrada de la mina, primera
 * extracción, tabla suelta, libro y guardado del progreso.
 * Capturas reales del renderizador en docs/screenshots/intro-*.png.
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
            c.id = 'intro-snap';
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
    .locator('#intro-snap')
    .screenshot({ path: `docs/screenshots/${name}.png` });
  await page.evaluate(() => document.getElementById('intro-snap')?.remove());
}

const INTRO_URL = '/?intro=on&menu=off';
const step = (page: Page) => scene(page, (s) => s.session.intro.step);
const dialogOpen = (page: Page) => scene(page, (s) => s.dialog.open);

/** Lleva al minero a un punto de la superficie y espera que pise el suelo. */
async function place(page: Page, x: number, y = 148) {
  await scene(page, (s, p) => s.miner.body.reset(p.x, p.y), { x, y });
  await expect
    .poll(() => scene(page, (s) => s.miner.body.blocked.down))
    .toBe(true);
}

/** Coloca la figura dentro de la cabaña (el recorrido real es A/D). */
const walkInside = (page: Page, x: number) =>
  scene(page, (s, v) => ((s.cabin as unknown as { x: number }).x = v), x);

/** Partida nueva con la secuencia activa: nombre, modo Normal y diálogo inicial. */
async function newGame(page: Page) {
  await page.goto(INTRO_URL);
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  expect(await scene(page, (s) => s.safety.modeOpen)).toBe(true);
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
}

/** Avanza un diálogo con E hasta cerrarlo. */
async function readDialog(page: Page) {
  for (let i = 0; i < 40 && (await dialogOpen(page)); i++) {
    await page.keyboard.press('e');
    await page.waitForTimeout(60);
  }
  await expect.poll(() => dialogOpen(page)).toBe(false);
}

/** Esc omite el diálogo; E se ignora ~250 ms tras cerrar uno, así que se espera. */
async function skipDialog(page: Page) {
  await page.keyboard.press('Escape');
  await expect.poll(() => dialogOpen(page)).toBe(false);
  await page.waitForTimeout(320);
}

const saved = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('mina-cero.save.v6') ?? 'null'),
  );

test.use({ viewport: { width: 1480, height: 900 } });
test.setTimeout(90_000);

test('Nueva partida empieza dentro de la cabaña con un diálogo que se puede omitir', async ({
  page,
}) => {
  await newGame(page);
  const state = await scene(page, (s) => ({
    cabin: s.cabin.open,
    inCabin: s.session.inCabin,
    step: s.session.intro.step,
    dialog: s.dialog.open,
    modal: s.hud.modal,
  }));
  expect(state).toEqual({
    cabin: true,
    inCabin: true,
    step: 'welcome',
    dialog: true,
    modal: false,
  });
  await page.waitForTimeout(900);
  await shot(page, 'intro-cabin-dialog');
  // Esc omite todo el diálogo de una vez y la secuencia sigue.
  await page.keyboard.press('Escape');
  await expect.poll(() => dialogOpen(page)).toBe(false);
  await expect.poll(() => step(page)).toBe('tools');
  expect((await saved(page)).intro.step).toBe('tools');
});

test('E completa la línea y luego pasa de página; el diálogo no mueve la figura', async ({
  page,
}) => {
  await newGame(page);
  const x0 = await scene(page, (s) => s.cabin.puppetX);
  // Con el diálogo abierto, A/D no mueven la figura.
  await page.keyboard.down('d');
  await page.waitForTimeout(300);
  await page.keyboard.up('d');
  expect(await scene(page, (s) => s.cabin.puppetX)).toBe(x0);
  const first = await page.evaluate(() => {
    const s = window.__MINA_GAME__.scene.getScene('MiningScene') as MiningScene;
    return (s.dialog as unknown as { index: number }).index;
  });
  expect(first).toBe(0);
  await page.keyboard.press('e'); // completa la línea
  await page.waitForTimeout(150);
  await page.keyboard.press('e'); // siguiente página
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window.__MINA_GAME__.scene.getScene('MiningScene') as unknown as {
              dialog: { index: number };
            }
          ).dialog.index,
      ),
    )
    .toBe(1);
  await readDialog(page);
  await expect.poll(() => step(page)).toBe('tools');
});

test('en la cabaña se puede caminar y E interactúa con los objetos', async ({
  page,
}) => {
  await newGame(page);
  await skipDialog(page);
  // Caminar de verdad con D.
  const x0 = await scene(page, (s) => s.cabin.puppetX);
  await page.keyboard.down('d');
  await expect
    .poll(() => scene(page, (s) => s.cabin.puppetX))
    .toBeGreaterThan(x0 + 20);
  await page.keyboard.up('d');
  // Cada objeto muestra su indicación con [E] y responde con una frase breve.
  const objects: [number, string, string][] = [
    [132, '[E] VER EL CALENDARIO', 'CALENDARIO'],
    [190, '[E] MIRAR LA ESTUFA', 'ESTUFA'],
    [240, '[E] MIRAR LA VENTANA', 'CERRO'],
    [310, '[E] REVISAR LA REPISA', 'RADIO'],
  ];
  for (const [x, prompt, note] of objects) {
    await walkInside(page, x);
    await expect.poll(() => scene(page, (s) => s.cabin.prompt)).toBe(prompt);
    await page.keyboard.press('e');
    await expect
      .poll(() => scene(page, (s) => s.hud['message'].text))
      .toContain(note);
  }
  // Z sigue funcionando como alias: junto a la cama descansar se ofrece con [E].
  await walkInside(page, 342);
  await expect
    .poll(() => scene(page, (s) => s.cabin.prompt))
    .toBe('[E] DESCANSAR');
  // La tabla del piso no existe todavía.
  await walkInside(page, 270);
  expect(await scene(page, (s) => s.cabin.board)).toBe('hidden');
  expect(await scene(page, (s) => s.cabin.action())).toBeNull();
});

test('secuencia completa: bodega, mina, primera extracción, tabla suelta y libro', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await newGame(page);
  await skipDialog(page);
  await expect.poll(() => step(page)).toBe('tools');
  // La guía muestra una sola línea de objetivo.
  await expect
    .poll(() => scene(page, (s) => s['guide']['shown']))
    .toBe(INTRO_OBJECTIVES.tools);

  // Salir por la puerta (E).
  await walkInside(page, 58);
  await expect
    .poll(() => scene(page, (s) => s.cabin.prompt))
    .toBe('[E] SALIR DE LA CABAÑA');
  await page.keyboard.press('e');
  await expect.poll(() => scene(page, (s) => s.cabin.open)).toBe(false);

  // Bodega: el cajón de herramientas gana al acceso del almacén y a lo cercano.
  await place(page, 90);
  await expect
    .poll(() => scene(page, (s) => s.interactions.selected?.id))
    .toBe('toolbox');
  expect(
    await scene(page, (s) => s.session.tools.items.map((t) => t.kind)),
  ).toEqual([]);
  await page.keyboard.press('e');
  await expect.poll(() => dialogOpen(page)).toBe(true);
  await shot(page, 'intro-toolbox');
  await skipDialog(page);
  await expect
    .poll(() =>
      scene(page, (s) => ({
        kinds: s.session.tools.items.map((t) => t.kind).sort(),
        equipped: s.session.tools.current?.kind,
        step: s.session.intro.step,
      })),
    )
    .toEqual({ kinds: ['iron', 'shovel'], equipped: 'iron', step: 'kit' });
  // El cajón ya no se puede volver a abrir.
  await expect
    .poll(() =>
      scene(page, (s) => s.interactions.objects.get('toolbox')!.enabled),
    )
    .toBe(false);

  // El paso del tutorial usa la misma bodega que una partida antigua.
  await place(page, 106);
  await expect.poll(() => scene(page, (s) => s.interactions.selected?.id)).toBe('warehouse');
  await page.keyboard.press('e');
  await expect.poll(() => scene(page, (s) => s.warehouse.open)).toBe(true);
  await scene(page, (s) => {
    const { warehouse, loadout } = s.session;
    for (let i = 0; i < 5; i++) {
      const kind = warehouse.stacks[0]!.kind;
      const error = warehouse.withdraw(s.session, 0, 1);
      if (error) throw new Error(error);
      const slot = loadout.slots.findIndex((item) =>
        item?.type === 'ppe' && loadout.ppeById(item.id)?.kind === kind,
      );
      loadout.equipFromSlot(slot);
    }
  });
  await page.keyboard.press('Escape');
  await expect.poll(() => scene(page, (s) => s.warehouse.open)).toBe(false);
  await expect.poll(() => step(page)).toBe('mine');

  // Entrada de la mina: inspeccionarla con E aunque haya material suelto cerca.
  await place(page, 284);
  await expect
    .poll(() => scene(page, (s) => s.interactions.selected?.id))
    .toBe('mine-entrance');
  await page.keyboard.press('e');
  await expect.poll(() => dialogOpen(page)).toBe(true);
  await skipDialog(page);
  await expect.poll(() => step(page)).toBe('dig');

  // Primera extracción real: mantener el clic con la picota.
  await place(page, 402);
  const box = (await page.locator('canvas').boundingBox())!;
  const view = await scene(page, (s) => ({
    x: s.cameras.main.scrollX,
    y: s.cameras.main.scrollY,
  }));
  await page.mouse.move(
    box.x + ((424 - view.x) * box.width) / 480,
    box.y + ((152 - view.y) * box.height) / 270,
  );
  await page.mouse.down();
  await expect.poll(() => step(page), { timeout: 10_000 }).toBe('home');
  await page.mouse.up();
  expect(
    await scene(page, (s) => s.session.stats.mined),
  ).toBeGreaterThanOrEqual(1);

  // Volver a la cabaña: la tabla cruje y se suelta.
  await place(page, -290);
  await scene(page, (s) => {
    s.miner.setFlipX(true);
  });
  await expect
    .poll(() => scene(page, (s) => s.interactions.selected?.id))
    .toBe('cabin');
  await page.keyboard.press('e');
  await expect.poll(() => scene(page, (s) => s.cabin.open)).toBe(true);
  await expect.poll(() => step(page)).toBe('board');
  await expect.poll(() => dialogOpen(page)).toBe(true);
  await skipDialog(page);
  await expect.poll(() => scene(page, (s) => s.cabin.board)).toBe('loose');
  await walkInside(page, 270);
  await expect
    .poll(() => scene(page, (s) => s.cabin.prompt))
    .toBe('[E] EXAMINAR LA TABLA');
  await page.waitForTimeout(500);
  await shot(page, 'intro-loose-board');

  // Examinar la tabla: aparece el libro y se lee su primera página.
  await page.keyboard.press('e');
  await expect.poll(() => step(page)).toBe('book');
  await expect.poll(() => dialogOpen(page)).toBe(true);
  await page.keyboard.press('Escape'); // omitir no se salta el libro
  await expect.poll(() => scene(page, (s) => s.book.open)).toBe(true);
  await page.waitForTimeout(1300);
  await shot(page, 'intro-book');
  await expect.poll(() => scene(page, (s) => s.book['footer'].visible)).toBe(true);
  await page.keyboard.press('e');
  await expect.poll(() => scene(page, (s) => s.book.open)).toBe(false);
  await page.waitForTimeout(320);
  await expect.poll(() => step(page)).toBe('done');
  expect(await scene(page, (s) => s.session.intro.completed)).toBe(true);
  expect(await scene(page, (s) => s.cabin.board)).toBe('open');
  await scene(page, (s) => {
    s.hud['awardUntil'] = 0;
  });
  await page.waitForTimeout(400);
  await shot(page, 'intro-board-open');
  // Se puede releer el libro con E.
  await expect
    .poll(() => scene(page, (s) => s.cabin.prompt))
    .toBe('[E] LEER EL LIBRO');
  await page.keyboard.press('e');
  await expect.poll(() => scene(page, (s) => s.book.open)).toBe(true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await expect.poll(() => scene(page, (s) => s.book.open)).toBe(false);
});

test('el progreso del tutorial se guarda y se retoma al recargar', async ({
  page,
}) => {
  await newGame(page);
  await skipDialog(page);
  await walkInside(page, 58);
  await expect
    .poll(() => scene(page, (s) => s.cabin.prompt))
    .toBe('[E] SALIR DE LA CABAÑA');
  await page.keyboard.press('e');
  await expect.poll(() => scene(page, (s) => s.cabin.open)).toBe(false);
  await place(page, 90);
  await expect
    .poll(() => scene(page, (s) => s.interactions.selected?.id))
    .toBe('toolbox');
  await page.keyboard.press('e');
  await expect.poll(() => dialogOpen(page)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => step(page)).toBe('kit');
  await page.keyboard.press('t');
  await expect
    .poll(() => scene(page, (s) => s.session.intro.hintsOff))
    .toBe(true);
  await scene(page, (s) => s.save());
  expect((await saved(page)).intro).toMatchObject({
    step: 'kit',
    hintsOff: true,
  });

  await page.goto(INTRO_URL);
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  const back = await scene(page, (s) => ({
    step: s.session.intro.step,
    hintsOff: s.session.intro.hintsOff,
    kinds: s.session.tools.items.map((t) => t.kind).sort(),
    dialog: s.dialog.open,
    guide: s['guide']['shown'],
  }));
  expect(back).toEqual({
    step: 'kit',
    hintsOff: true,
    kinds: ['iron', 'shovel'],
    dialog: false,
    guide: '',
  });
  // T vuelve a mostrar la guía.
  await page.keyboard.press('t');
  await expect
    .poll(() => scene(page, (s) => s['guide']['shown']))
    .toBe(INTRO_OBJECTIVES.kit);
});

test('recargar durante el diálogo inicial lo retoma', async ({ page }) => {
  await newGame(page);
  await expect.poll(() => dialogOpen(page)).toBe(true);
  await page.goto(INTRO_URL);
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  await expect.poll(() => dialogOpen(page)).toBe(true);
  await expect.poll(() => step(page)).toBe('welcome');
  expect(await scene(page, (s) => s.cabin.open)).toBe(true);
});

test('una partida guardada sin secuencia no la inicia ni muestra la tabla', async ({
  page,
}) => {
  await page.goto('/?menu=off');
  await expect(page.locator('#game-status')).toContainText('Mina lista', {
    timeout: 20_000,
  });
  await page.keyboard.press('1');
  await expect.poll(() => scene(page, (s) => s.session.modeChosen)).toBe(true);
  // El navegador automatizado no activa la secuencia: partida «de siempre».
  await expect.poll(() => step(page)).toBe('done');
  expect(await scene(page, (s) => s.cabin.open)).toBe(false);
  expect(await scene(page, (s) => s.cabin.board)).toBe('hidden');
  await expect.poll(() => dialogOpen(page)).toBe(false);
});
