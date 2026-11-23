import { expect, test, type Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { MiningScene } from '../src/game/scenes/MiningScene';
import {
  BIOMES,
  biomeSpan,
  crossingBand,
} from '../src/game/config/biomes';
import { VIEW, WORLD_LEFT, WORLD_WIDTH } from '../src/game/config/constants';
import { PALETTE as P } from '../src/game/config/palette';
import { Block, surfaceRow } from '../src/game/world/TerrainGrid';

/**
 * Mundo de zonas del desierto (V9; solo desierto de Antofagasta desde el 18
 * de noviembre de 2026). Recorre las zonas (de día, de noche y en los
 * cruces) con capturas reales del renderizador, comprueba el empalme de
 * los cerros con La Portada, el fondo dibujado por
 * código, los monumentos, la cámara, el guardado de regiones y que el
 * campamento y la mina sigan donde estaban.
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

async function settle(page: Page) {
  await expect
    .poll(() => scene(page, (s) => s.miner.body.blocked.down), {
      timeout: 8000,
    })
    .toBe(true);
}

/** Lleva al minero a un x del mundo, sobre la superficie natural. */
async function teleport(page: Page, x: number) {
  const y = surfaceRow(Math.floor(x / 16)) * 16 - 14;
  await scene(
    page,
    (s, p) => {
      s.miner.body.reset(p.x, p.y);
      s.cameras.main.centerOn(p.x, p.y);
    },
    { x, y },
  );
  await settle(page);
  // Que la carga por región termine y el compositor vuelva a componer.
  await expect
    .poll(() => scene(page, (s) => !s.load.isLoading()), { timeout: 8000 })
    .toBe(true);
  await page.waitForTimeout(250);
}

const setClock = (page: Page, ms: number) =>
  scene(page, (s, value) => s.session.dayNight.restore(value), ms);

async function shot(page: Page, name: string, scale = 2, path = `docs/screenshots/${name}.png`) {
  await scene(page, (s) => {
    s.hud['awardUntil'] = 0;
    s.hud['award'].setVisible(false);
  });
  await page.evaluate(
    (zoom) =>
      new Promise<void>((resolve) => {
        window.__MINA_GAME__.renderer.snapshot((image) => {
          const img = image as HTMLImageElement;
          const draw = () => {
            const c = document.createElement('canvas');
            c.id = 'v9-snap';
            c.width = img.width * zoom;
            c.height = img.height * zoom;
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
    scale,
  );
  await page
    .locator('#v9-snap')
    .screenshot({ path });
  await page.evaluate(() => document.getElementById('v9-snap')?.remove());
}

const NOON = 150_000;
const NIGHT = 450_000;
const DUSK = 290_000;

/** Centro de cada bioma (px), lejos de sus bandas de cruce. */
const center = (i: number) => {
  const [l, r] = biomeSpan(BIOMES[i]!.id);
  if (BIOMES[i]!.id === 'desert') return 208;
  if (i === BIOMES.length - 1) return r - 300;
  return Math.round((l + r) / 2);
};

test.use({ viewport: { width: 1480, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-status')).toContainText('Mina lista', { timeout: 20_000 });
  await settle(page);
  // Modalidad normal (cierra la ventana de nueva expedición).
  await page.keyboard.press('1');
  await setClock(page, NOON);
});

test('cada zona muestra su paisaje de día y de noche', async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (let i = 0; i < BIOMES.length; i++) {
    const id = BIOMES[i]!.id;
    await teleport(page, center(i));
    const blend = await scene(page, (s) => s.biomeBackdrop.blend());
    expect(blend).toEqual({ left: id, right: null, t: 0 });
    await setClock(page, NOON);
    await page.waitForTimeout(150);
    await shot(page, `v9-${id}-day`);
    if (id !== 'desert') {
      await setClock(page, NIGHT);
      await page.waitForTimeout(150);
      await shot(page, `v9-${id}-night`);
      await setClock(page, NOON);
    }
  }
  await teleport(page, center(BIOMES.findIndex((b) => b.id === 'portada')));
  await setClock(page, DUSK);
  await page.waitForTimeout(150);
  await shot(page, 'v9-portada-dusk');
});

test('flora chilena con píxeles opacos y algarrobos de tonos secos', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const result = await scene(page, (s, greens) => {
    const render = (key: string) => s.textures.get(key) as Phaser.Textures.CanvasTexture;
    const colors = (key: string, name: string, allowDarkGreen = false) => {
      const atlas = render(key);
      const f = atlas.get(name);
      const data = atlas.context.getImageData(f.cutX, f.cutY, f.width, f.height).data;
      const opaque = new Set<number>();
      let binary = true;
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3]!;
        binary &&= alpha === 0 || alpha === 255;
        if (alpha === 255) opaque.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
      }
      const excluded = allowDarkGreen ? greens.slice(1) : greens;
      return { binary, count: opaque.size, vividGreen: excluded.some((color) => opaque.has(color)) };
    };
    return {
      frames: render('flora').getFrameNames(),
      tree: colors('trees', 'tree'),
      treeSpread: colors('trees', 'tree_spread'),
      copao: colors('flora', 'copao', true),
      cushion: colors('flora', 'cojin_atacameno', true),
      nolana: colors('flora', 'nolana'),
    };
  }, [P.pine, P.forest, P.teal, P.mint, P.moss, P.lime]);
  expect(result.frames).toEqual(expect.arrayContaining([
    'copao', 'copao_joven', 'copiapoa', 'cojin_atacameno', 'cachiyuyo', 'cachiyuyo_w',
    'brea', 'brea_w', 'grama_salada', 'grama_salada_w', 'nolana', 'nolana_w',
  ]));
  expect(result.frames).not.toContain('cactus_tall');
  for (const sprite of [result.tree, result.treeSpread, result.copao, result.cushion, result.nolana]) {
    expect(sprite.binary).toBe(true);
    expect(sprite.vividGreen).toBe(false);
    expect(sprite.count).toBeGreaterThanOrEqual(5);
    expect(sprite.count).toBeLessThanOrEqual(6);
  }
  await teleport(page, 58 * 16 + 8);
  await shot(page, 'flora-atacama-interior-1x', 1, testInfo.outputPath('flora-atacama-interior-1x.png'));
  await shot(page, 'flora-atacama-interior', 3);
  await teleport(page, center(BIOMES.findIndex(({ id }) => id === 'hills')));
  await shot(page, 'flora-atacama-costa-1x', 1, testInfo.outputPath('flora-atacama-costa-1x.png'));
  await shot(page, 'flora-atacama-costa', 3);
});

/** Muestras de la cámara y del minero, una por cuadro, durante `frames`. */
const sampleFrames = (page: Page, frames: number) =>
  page.evaluate(
    (n) =>
      new Promise<{ scroll: number[]; x: number[]; dt: number[] }>(
        (resolve) => {
          const s = window.__MINA_GAME__.scene.getScene(
            'MiningScene',
          ) as MiningScene;
          const out = {
            scroll: [] as number[],
            x: [] as number[],
            dt: [] as number[],
          };
          let last = performance.now();
          const tick = () => {
            const now = performance.now();
            out.dt.push(now - last);
            last = now;
            out.scroll.push(s.cameras.main.scrollX);
            out.x.push(s.miner.x);
            if (out.scroll.length >= n) resolve(out);
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        },
      ),
    frames,
  );

test('se cruza la pampa y la costa en ambos sentidos, sin saltos de cámara', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  // Desde el borde este del desierto hacia la pampa (cruce completo).
  // La pampa ondula: se salta cada tanto para subir sus escalones de un bloque.
  const walk = async (key: string, reached: (x: number) => boolean) => {
    const parts: Awaited<ReturnType<typeof sampleFrames>>[] = [];
    await page.keyboard.down(key);
    try {
      for (let i = 0; i < 18; i++) {
        await page.keyboard.press('Space');
        const part = await sampleFrames(page, 20);
        parts.push(part);
        if (reached(part.x.at(-1)!)) break;
      }
    } finally {
      await page.keyboard.up(key);
    }
    return parts;
  };
  const distance = (parts: Awaited<ReturnType<typeof walk>>) =>
    parts.at(-1)!.x.at(-1)! - parts[0]!.x[0]!;
  await teleport(page, 136 * 16);
  const east = await walk('d', (x) => x > 140 * 16 + 70);
  expect(distance(east)).toBeGreaterThan(120);
  expect(east.at(-1)!.x.at(-1)!).toBeGreaterThan(140 * 16 + 40);
  // Y de vuelta hacia el campamento (oeste).
  const west = await walk('a', (x) => x < 140 * 16 - 55);
  expect(-distance(west)).toBeGreaterThan(120);
  expect(west.at(-1)!.x.at(-1)!).toBeLessThan(140 * 16 - 20);

  const [shore] = biomeSpan('portada');
  await teleport(page, shore - 72);
  const toSea = await walk('d', (x) => x > shore + 72);
  expect(toSea.at(-1)!.x.at(-1)!).toBeGreaterThan(shore + 64);
  const toHills = await walk('a', (x) => x < shore - 72);
  expect(toHills.at(-1)!.x.at(-1)!).toBeLessThan(shore - 64);

  const dts: number[] = [];
  for (const part of [...east, ...west, ...toSea, ...toHills]) {
    // La cámara nunca salta: entre dos cuadros seguidos se mueve a lo sumo lo
    // que el minero camina en ese intervalo (90 px/s), con margen de redondeo.
    for (let i = 1; i < part.scroll.length; i++) {
      expect(
        Math.abs(part.scroll[i]! - part.scroll[i - 1]!),
      ).toBeLessThanOrEqual(0.09 * Math.max(16.7, part.dt[i]!) * 1.25 + 2);
      dts.push(part.dt[i]!);
    }
  }
  // Cuadros estables: la mediana de los intervalos queda cerca de 60 fps.
  dts.sort((a, b) => a - b);
  const median = dts[Math.floor(dts.length / 2)]!;
  await testInfo.attach('intervalos-de-cámara', {
    body: JSON.stringify({
      frames: dts.length,
      sampledMs: dts.reduce((total, dt) => total + dt, 0),
      medianMs: median,
    }),
    contentType: 'application/json',
  });
  expect(median).toBeLessThan(25);
});

test('fondo dibujado por código, parallax real y monumentos de Antofagasta', async ({
  page,
}) => {
  // Ya no hay capas CraftPix: ni en memoria ni pedidas a la carga.
  await teleport(page, center(BIOMES.findIndex((b) => b.id === 'fcab')));
  expect(
    await scene(page, (s) =>
      s.textures.getTextureKeys().filter((k) => k.startsWith('biome-') && !k.startsWith('biome-composite')),
    ),
  ).toEqual([]);
  // Parallax real: tras 200 px de cámara, cada cordillera se corrió según su
  // factor (la lejana poco, las dunas más). Se mide el mismo tramo del fondo.
  const positions = () =>
    scene(page, (s) => {
      const out: Record<string, number> = {};
      for (const l of s.biomeBackdrop.stamped()) out[l.key] ??= l.x;
      return out;
    });
  const a = await positions();
  const before = await scene(page, (s) => Math.round(s.cameras.main.scrollX));
  await teleport(page, (await scene(page, (s) => s.miner.x)) + 200);
  const b = await positions();
  const after = await scene(page, (s) => Math.round(s.cameras.main.scrollX));
  const shift = after - before;
  expect(shift).toBeGreaterThan(150);
  const moved = (prefix: string) => {
    const key = Object.keys(a).find((name) => name.startsWith(prefix) && name in b);
    expect(key).toBeDefined();
    return a[key!]! - b[key!]!;
  };
  expect(Math.abs(moved('v7-range-far-') - shift * 0.08)).toBeLessThanOrEqual(1);
  expect(Math.abs(moved('v7-range-dunes-') - shift * 0.58)).toBeLessThanOrEqual(1);
  // Los cuatro monumentos existen, con su textura, en su zona.
  const marks = await scene(page, (s) =>
    s.landmarks.map((l) => ({ key: l.key, biome: l.biome, ok: s.textures.exists(l.key), x: l.x })),
  );
  expect(marks.map((m) => m.biome)).toEqual(['hand', 'pampa', 'fcab', 'huanchaca']);
  for (const m of marks) {
    expect(m.ok).toBe(true);
    const [l, r] = biomeSpan(m.biome);
    expect(m.x).toBeGreaterThan(l);
    expect(m.x).toBeLessThan(r);
  }
  // La Portada aparece en el fondo de la costa y no en el desierto.
  await teleport(page, center(BIOMES.findIndex((b) => b.id === 'portada')));
  expect(
    await scene(page, (s) => s.biomeBackdrop.stamped().some((l) => l.key === 'v7-coast-portada')),
  ).toBe(true);
  await teleport(page, 208);
  expect(
    await scene(page, (s) => s.biomeBackdrop.stamped().some((l) => l.key.startsWith('v7-coast'))),
  ).toBe(false);
});

test('las chinchillas huyen del minero y su sombra sigue el suelo real', async ({ page }) => {
  test.setTimeout(60_000);
  // Una chinchilla de la pampa, tranquila y visible.
  const home = await scene(page, (s) =>
    s.critters.state.findIndex((c) => c.x > 140 * 16 && c.x < 220 * 16),
  );
  expect(home).toBeGreaterThanOrEqual(0);
  const start = await scene(page, (s, i) => s.critters.state[i]!, home);
  await teleport(page, start.x - 150);
  await page.waitForTimeout(600);
  const calm = await scene(page, (s, i) => s.critters.state[i]!, home);
  expect(calm.visible).toBe(true);
  expect(calm.state).not.toBe('flee');
  // El minero se acerca: huye (o se esconde) y se aleja de él.
  await scene(page, (s, c) => s.miner.body.reset(c.x - 40, c.y - 14), calm);
  await expect
    .poll(() => scene(page, (s, i) => s.critters.state[i]!.state, home), { timeout: 3000 })
    .toMatch(/flee|hidden/);
  await page.waitForTimeout(700);
  const after = await scene(page, (s, i) => s.critters.state[i]!, home);
  expect(after.x > calm.x + 20 || after.state === 'hidden').toBe(true);
  // No hay interacción con ella: no aparece entre los objetos interactuables.
  expect(
    await scene(page, (s) => [...s.interactions.objects.keys()].some((id) => /critter|chinchilla/.test(id))),
  ).toBe(false);
  // La sombra del minero está sobre la cara superior de un suelo sólido.
  await teleport(page, 208);
  await page.waitForTimeout(300);
  const shadow = await scene(page, (s) => {
    const spans = s.groundShadow.spans.split(';').filter(Boolean).map((t) => t.split(',').map(Number));
    return spans.map(([x, y]) => ({
      solid: s.worldGround.isSolid(Math.floor(x! / 16), Math.floor(y! / 16)),
      air: !s.worldGround.isSolid(Math.floor(x! / 16), Math.floor(y! / 16) - 1),
    }));
  });
  expect(shadow.length).toBeGreaterThan(6);
  expect(shadow.every((p) => p.solid && p.air)).toBe(true);
});

test('la luz subterránea sigue funcionando bajo las zonas', async ({
  page,
}) => {
  const x = center(BIOMES.findIndex((b) => b.id === 'huanchaca'));
  await teleport(page, x);
  const result = await scene(
    page,
    (s, px) => {
      const t0 = performance.now();
      s.lighting.terrainChanged();
      const ms = performance.now() - t0;
      return {
        ms,
        surface: s.lighting.lightAt(px, 6 * 16),
        deep: s.lighting.lightAt(px, 28 * 16),
      };
    },
    x,
  );
  // De día el cielo ilumina la superficie y el subsuelo profundo queda oscuro.
  expect(result.surface).toBeGreaterThan(0.5);
  expect(result.deep).toBeLessThan(0.2);
  // Recalcular la luz natural del mundo ampliado sigue siendo barato.
  expect(result.ms).toBeLessThan(120);
});

test('guardar y volver al desierto conserva región, construcción y cabaña', async ({
  page,
}) => {
  test.setTimeout(90_000);
  // Un bloque de madera colocado en la pampa y una excavación en el desierto.
  const valleyX = center(BIOMES.findIndex((b) => b.id === 'pampa'));
  const column = Math.floor(valleyX / 16) + 3;
  await teleport(page, valleyX);
  const placed = await scene(
    page,
    (s, p) => {
      let top = 0;
      while (!s.session.grid.isSolid(p.column, top)) top++;
      s.session.grid.set(p.column, top - 1, p.wood);
      s.session.placed.add(s.session.grid.index(p.column, top - 1));
      s.session.grid.set(30, 14, p.air);
      return { row: top - 1, saved: s.save() };
    },
    { column, wood: Block.Wood, air: Block.Air },
  );
  expect(placed.saved).toBe(true);
  const regions = await scene(page, (s) => s.session.regions.snapshot());
  expect(regions.visited).toContain('pampa');
  await page.reload();
  await expect(page.locator('#game-status')).toContainText('Mina lista', { timeout: 20_000 });
  await settle(page);
  const back = await scene(
    page,
    (s, p) => ({
      wood: s.session.grid.get(p.column, p.row),
      dug: s.session.grid.get(30, 14),
      regions: s.session.regions.snapshot(),
      x: s.miner.x,
      cabin: s.cabinSite['lantern'].parentContainer!.x,
    }),
    { column, row: placed.row },
  );
  expect(back.wood).toBe(Block.Wood);
  expect(back.dug).toBe(Block.Air);
  expect(back.regions.visited).toEqual(regions.visited);
  expect(Math.abs(back.x - valleyX)).toBeLessThan(48);
  // La cabaña conserva su posición de siempre (campamento V8).
  expect(back.cabin).toBe(-360);
  // De vuelta al desierto: la cabaña sigue en su lugar y la madera, en la pampa.
  await teleport(page, -360 + 45);
  const desert = await scene(page, (s) => s.biomeBackdrop.blend());
  expect(desert).toEqual({ left: 'desert', right: null, t: 0 });
  await shot(page, 'v9-return-camp');
  await teleport(page, valleyX);
  expect(
    await scene(page, (s, p) => s.session.grid.get(p.column, p.row), {
      column,
      row: placed.row,
    }),
  ).toBe(Block.Wood);
});

test('paisaje continuo en los seis cruces y en las uniones de texturas', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  for (let i = 0; i < BIOMES.length - 1; i++) {
    const [lo, hi] = crossingBand(i);
    await teleport(page, Math.round((lo + hi) / 2));
    // El suelo y la decoración también están cruzando aquí.
    const blend = await scene(page, (s) => s.biomeBackdrop.blend());
    expect(blend.left).toBe(BIOMES[i]!.id);
    expect(blend.right).toBe(BIOMES[i + 1]!.id);
    expect(blend.t).toBeGreaterThan(0);
    expect(blend.t).toBeLessThan(1);
    const name = `cruce-${BIOMES[i]!.id}-${BIOMES[i + 1]!.id}`;
    await shot(page, name, 1, testInfo.outputPath(`${name}.png`));
  }

  // Compara los píxeles reales a ambos lados de cada unión, de día y de noche.
  const seams = await scene(page, (s) => {
    const layers = s.backdrop!.rangeLayers().filter(({ key }) => key.startsWith('v7-range-'));
    const column = (layer: (typeof layers)[number], frame: number, x: number) => {
      const texture = s.textures.get(layer.key) as Phaser.Textures.CanvasTexture;
      const f = texture.get(frame);
      const pixels = texture.context.getImageData(f.cutX + x, f.cutY, 1, f.height).data;
      const alpha = pixels.filter((_byte, index) => index % 4 === 3);
      const first = alpha.findIndex((value) => value === 255);
      return { top: layer.top + first, bottom: layer.top + alpha.lastIndexOf(255), hasRock: first >= 0 };
    };
    return layers.flatMap((left, i) => {
      const right = layers[i + 1];
      if (!right || left.depth !== right.depth) return [];
      return [0, 8, 12].map((frame) => {
        const a = column(left, frame, left.width - 1);
        const b = column(right, frame, 0);
        return left.anchor + left.width === right.anchor && a.hasRock === b.hasRock &&
          Math.abs(a.top - b.top) <= 4 && Math.abs(a.bottom - b.bottom) <= 3;
      });
    });
  });
  expect(seams.length).toBeGreaterThan(30);
  expect(seams).not.toContain(false);
  await shot(page, 'costa-3x', 3, testInfo.outputPath('costa-3x.png'));
  await shot(page, 'v9-cross-hills-portada');

  const [shore] = biomeSpan('portada');
  await teleport(page, shore + 32);
  await setClock(page, NIGHT);
  const coast = await scene(page, (s) => {
    const visible = s.biomeBackdrop.stamped();
    const layers = s.backdrop!.rangeLayers();
    const sea = layers.find(({ key }) => key === 'v7-coast-sea')!;
    const seaX = visible.find(({ key }) => key === sea.key)!.x;
    const ranges = layers.filter(({ key }) => key.startsWith('v7-range-') &&
      visible.some((image) => image.key === key));
    const holes = ranges.flatMap(({ key, frame }) => {
      const tex = s.textures.get(key) as Phaser.Textures.CanvasTexture;
      const f = tex.get(frame);
      const data = tex.context.getImageData(f.cutX, f.cutY, f.width, f.height).data;
      const holes: string[] = [];
      for (let x = 0; x < f.width; x++) {
        let rock = false;
        for (let y = 0; y < f.height; y++) {
          const opaque = data[(y * f.width + x) * 4 + 3] === 255;
          if (rock && !opaque) {
            holes.push(key);
            break;
          }
          rock ||= opaque;
        }
      }
      return holes;
    });
    return { seaX, seaRight: seaX + sea.width, holes };
  });
  expect(coast.seaX).toBeLessThanOrEqual(0);
  expect(coast.seaRight).toBeGreaterThanOrEqual(VIEW.width);
  expect(coast.holes).toEqual([]);
  await shot(page, 'costa-noche-1x', 1, testInfo.outputPath('costa-noche-1x.png'));
  await shot(page, 'costa-noche-3x', 3, testInfo.outputPath('costa-noche-3x.png'));
  await shot(page, 'v9-cross-hills-portada-night');
});


test('la cámara cubre toda la superficie sin NPC ni puesto de ventas', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const end = WORLD_LEFT + WORLD_WIDTH;
  const checkpoints: number[] = [];
  for (let x = WORLD_LEFT + VIEW.width / 2; x < end; x += 400)
    checkpoints.push(Math.min(x, end - VIEW.width / 2));
  checkpoints.push(end - VIEW.width / 2);
  let scannedTo = WORLD_LEFT;
  for (const x of checkpoints) {
    await teleport(page, x);
    const sample = await scene(page, (s) => ({
      left: s.cameras.main.scrollX,
      oldObjects: s.children.list.filter((obj) =>
        ('texture' in obj && /^(salespost|storekeeper|top-npc-.*|luis)$/.test(String((obj as Phaser.GameObjects.Image).texture.key))) ||
        ('text' in obj && /^VENTAS?$/.test(String(obj.text))),
      ).length,
      oldInteractions: [...s.interactions.objects.keys()].filter((id) =>
        ['seller', 'depot', 'luis', 'npc'].includes(id),
      ),
    }));
    expect(sample.oldObjects).toBe(0);
    expect(sample.oldInteractions).toEqual([]);
    expect(sample.left).toBeLessThanOrEqual(scannedTo + 1);
    scannedTo = sample.left + VIEW.width;
  }
  expect(scannedTo).toBeGreaterThanOrEqual(end - 1);
  await teleport(page, 151);
  await page.keyboard.down('d');
  await expect.poll(() => scene(page, (s) => s.miner.x)).toBeGreaterThan(200);
  await page.keyboard.up('d');
  expect(await scene(page, (s) => s.miner.body.bottom)).toBeCloseTo(160);
  await page.locator('canvas').screenshot({ path: testInfo.outputPath('superficie-puesto-retirado.png') });
  expect(errors).toEqual([]);
});
