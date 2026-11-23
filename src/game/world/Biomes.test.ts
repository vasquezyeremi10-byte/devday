import { describe, expect, it } from 'vitest';
import {
  BIOME_BAND,
  BIOMES,
  biomeAtColumn,
  biomeBlend,
  biomePresence,
  biomesAreContiguous,
  biomeWeights,
  crossingBand,
  ditheredBiome,
  earthGroup,
  LEGACY_BIOME_IDS,
  normalizeBiomeId,
  rockTopRow,
} from '../config/biomes';
import {
  CAMP,
  LEGACY_COLUMNS_V6,
  WEST,
  WORLD,
  WORLD_FIRST_COLUMN,
  WORLD_SPAN,
} from '../config/constants';
import { LANDMARK_SITES, landmarkSpot } from './LandmarkSites';
import { GameSession } from '../systems/GameSession';
import { RegionTracker } from '../systems/RegionTracker';
import { decodeSave, encodeSave } from '../systems/SaveSystem';
import { biomeDecor, DECOR_RANGES } from './BiomeDecor';
import {
  createInitialTerrain,
  DEFAULT_SEED,
  generateWorld,
  WORLD_REV_EXPLORE,
  WORLD_REV_LEGACY,
} from './Geology';
import { Block, mineralOf, surfaceRow } from './TerrainGrid';
import { TREE_COLUMNS } from './Trees';

describe('V9: regiones del mundo', () => {
  it('son contiguas, el desierto queda en el centro y cubren todo el mundo', () => {
    expect(biomesAreContiguous()).toBe(true);
    expect(BIOMES[0]!.from).toBe(WORLD_FIRST_COLUMN);
    // Mundo abierto: cuatro zonas nuevas al oeste de la Mano del Desierto.
    expect(biomeAtColumn(-(CAMP.columns + WEST.columns))).toBe('hand');
    expect(biomeAtColumn(-(CAMP.columns + WEST.columns) - 1)).toBe('paranal');
    expect(BIOMES.at(-1)!.to).toBe(WORLD.columns - 1);
    // El campamento, la bodega, la mina y la cabaña siguen en el desierto.
    for (let c = -40; c <= 139; c++) expect(biomeAtColumn(c)).toBe('desert');
    // Mundo considerablemente más grande: más de 3 veces el de V8.
    const width = BIOMES.at(-1)!.to - BIOMES[0]!.from + 1;
    expect(width).toBeGreaterThan(3 * (CAMP.columns + LEGACY_COLUMNS_V6));
    // Y más del doble del mundo de V9 (−120..471).
    expect(width).toBe(WORLD_SPAN);
    expect(width).toBeGreaterThan(2 * (CAMP.columns + WEST.columns + WORLD.columns));
  });

  it('la mezcla nunca junta más de dos biomas y es continua', () => {
    const w0 = BIOMES[0]!.from * 16,
      w1 = (BIOMES.at(-1)!.to + 1) * 16;
    let previous = biomeBlend(w0);
    for (let x = w0; x < w1; x += 4) {
      const weights = biomeWeights(x);
      expect(weights.filter((w) => w > 0).length).toBeLessThanOrEqual(2);
      expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
      const blend = biomeBlend(x);
      // La fracción avanza de a poco (sin saltos de fondo al caminar).
      const before = previous.a + previous.t,
        now = blend.a + blend.t;
      expect(now - before).toBeGreaterThanOrEqual(0);
      expect(now - before).toBeLessThan(0.02);
      previous = blend;
    }
  });

  it('junto al desierto el cruce cae entero del lado del bioma nuevo', () => {
    const desert = BIOMES.findIndex((b) => b.id === 'desert');
    const [l1, h1] = crossingBand(desert - 1);
    const [l2, h2] = crossingBand(desert);
    expect(h1).toBe(-40 * 16);
    expect(h1 - l1).toBe(2 * BIOME_BAND);
    expect(l2).toBe(140 * 16);
    expect(h2 - l2).toBe(2 * BIOME_BAND);
    // Todo el desierto se ve con su fondo puro.
    for (let x = -40 * 16; x < 140 * 16; x += 8)
      expect(biomeBlend(x)).toEqual({ a: desert, t: 0 });
  });

  it('cada bioma tiene un tramo puro y su presencia cubre sus bandas', () => {
    for (let i = 0; i < BIOMES.length; i++) {
      const b = BIOMES[i]!;
      let pure = 0;
      for (let x = b.from * 16; x < (b.to + 1) * 16; x += 16)
        if (biomeBlend(x).t === 0 && biomeBlend(x).a === i) pure += 16;
      expect(pure).toBeGreaterThanOrEqual(480);
      const [lo, hi] = biomePresence(b.id);
      expect(lo).toBeLessThanOrEqual(b.from * 16);
      expect(hi).toBeGreaterThanOrEqual((b.to + 1) * 16);
    }
  });

  it('todo el mundo es desierto: solo cambia a arena en La Portada, con cruce tramado', () => {
    for (let c = BIOMES[0]!.from; c < 410; c++) expect(earthGroup(c), `${c}`).toBe('desert');
    expect(earthGroup(440)).toBe('sand');
    expect(new Set(BIOMES.map((b) => b.earth))).toEqual(new Set(['desert', 'sand']));
    // En la banda del borde cerros–Portada aparecen los dos suelos…
    const groups = new Set<string>();
    for (let c = 412; c < 420; c++)
      for (let r = 10; r < 13; r++) groups.add(earthGroup(c, r));
    expect(groups).toEqual(new Set(['desert', 'sand']));
    // …y bajo la superficie ninguna columna de la banda es de un solo suelo.
    let mixed = 0;
    for (let c = 413; c < 419; c++) {
      const set = new Set<string>();
      for (let r = 10; r < 12 + 8; r++) set.add(earthGroup(c, r));
      if (set.size > 1) mixed++;
    }
    expect(mixed).toBeGreaterThan(2);
    expect(ditheredBiome(60, BIOME_BAND)).toBe('desert');
  });

  it('las zonas nuevas ocupan las mismas columnas que los biomas de V9', () => {
    const v9: Record<string, [number, number]> = {
      monoliths: [-120, -41],
      valley: [140, 219],
      forest: [220, 283],
      pines: [284, 347],
      mountain: [348, 415],
      coast: [416, 471],
    };
    for (const [old, [from, to]] of Object.entries(v9)) {
      const zone = BIOMES.find((b) => b.id === LEGACY_BIOME_IDS[old])!;
      expect([zone.from, zone.to], old).toEqual([from, to]);
    }
    expect(normalizeBiomeId('forest')).toBe('fcab');
    expect(normalizeBiomeId('portada')).toBe('portada');
    expect(normalizeBiomeId('marte')).toBeNull();
  });

  it('el relieve empalma sin escalones y la roca respeta el desierto', () => {
    // Los biomas nuevos (la ladera empinada sobre la bocamina es del desierto).
    const steps = [
      [BIOMES[0]!.from, -40],
      [138, WORLD.columns - 2],
    ] as const;
    for (const [from, to] of steps)
      for (let c = from; c <= to; c++)
        expect(Math.abs(surfaceRow(c + 1) - surfaceRow(c)), `${c}`).toBeLessThanOrEqual(1);
    for (let c = -40; c <= 139; c++) expect(rockTopRow(c)).toBe(13);
    expect(rockTopRow(370)).toBe(11);
  });
});

describe('V9: geología del mundo ampliado', () => {
  it('las columnas 0..138 no cambian al agregar los biomas (partidas guardadas)', () => {
    for (const seed of [DEFAULT_SEED, 1, 987654321])
      for (const rev of [WORLD_REV_LEGACY, WORLD_REV_EXPLORE]) {
        const v8 = generateWorld(seed, rev, LEGACY_COLUMNS_V6).grid;
        const v9 = generateWorld(seed, rev).grid;
        // La 139 era el muro derecho del mundo V8 (lecho de roca): ya no.
        for (let r = 0; r < WORLD.rows; r++)
          for (let c = 0; c < LEGACY_COLUMNS_V6 - 1; c++)
            expect(v9.get(c, r), `${seed}/${rev} (${c}, ${r})`).toBe(v8.get(c, r));
        expect(v8.get(LEGACY_COLUMNS_V6 - 1, 15)).toBe(Block.Bedrock);
        expect(v9.get(LEGACY_COLUMNS_V6 - 1, 15)).not.toBe(Block.Bedrock);
      }
  });

  it('los biomas tienen yacimientos enterrados, nunca a la vista', () => {
    const { grid, geology } = generateWorld(DEFAULT_SEED);
    const east = geology.deposits.filter((d) =>
      d.cells.some(([c]) => c >= LEGACY_COLUMNS_V6),
    );
    expect(east.length).toBeGreaterThan(20);
    for (const d of east)
      for (const [c, r] of d.cells) {
        expect(r).toBeGreaterThan(
          Math.max(surfaceRow(c - 1), surfaceRow(c), surfaceRow(c + 1)),
        );
        expect(mineralOf(grid.get(c, r))).toBe(d.mineral);
      }
    // La misma semilla da siempre el mismo mundo.
    const again = generateWorld(DEFAULT_SEED).grid;
    for (let r = 0; r < WORLD.rows; r++)
      for (let c = 0; c < WORLD.columns; c += 3) expect(again.get(c, r)).toBe(grid.get(c, r));
  });
});

describe('Fondo, monumentos y decoración del desierto', () => {
  it('no quedan fondos de terceros: todo el fondo se dibuja por código', () => {
    expect(Object.keys(import.meta.glob('/public/assets/biomes/**/*'))).toEqual([]);
  });

  it('una sola cuadrícula cubre todo el mundo y sigue los desniveles del oeste', () => {
    // Mundo abierto: la cuadrícula de la partida va del borde oeste al este;
    // la luz y la física usan este mismo suelo (sin suelos fijos aparte).
    const world = createInitialTerrain();
    expect(world.first).toBe(WORLD_FIRST_COLUMN);
    expect(world.end).toBe(WORLD.columns);
    let uneven = 0;
    for (let c = WORLD_FIRST_COLUMN + 1; c < -40; c++) {
      const top = surfaceRow(c);
      expect(world.isSolid(c, top - 1), `${c}`).toBe(false);
      expect(world.isSolid(c, top), `${c}`).toBe(true);
      if (top !== WORLD.surfaceRow) uneven++;
    }
    expect(uneven).toBeGreaterThan(100);
    // Se excava en cualquier columna: campamento, Mano del Desierto y oeste.
    for (const c of [-20, -60, -500, WORLD_FIRST_COLUMN + 1]) {
      expect(world.contains(c, 14)).toBe(true);
      world.set(c, 14, Block.Air);
      expect(world.isSolid(c, 14)).toBe(false);
    }
    // Los bordes del mundo siguen siendo lecho de roca.
    expect(world.get(WORLD_FIRST_COLUMN, 15)).toBe(Block.Bedrock);
    expect(world.get(WORLD.columns - 1, 15)).toBe(Block.Bedrock);
  });

  it('el oeste tiene yacimientos enterrados y no cambia la geología del este', () => {
    const { grid, geology } = generateWorld(DEFAULT_SEED);
    const west = geology.deposits.filter((d) => d.cells.some(([c]) => c < 0));
    expect(west.length).toBeGreaterThan(60);
    for (const d of west)
      for (const [c, r] of d.cells) {
        expect(c).toBeGreaterThan(WORLD_FIRST_COLUMN);
        expect(r).toBeGreaterThan(Math.max(surfaceRow(c - 1), surfaceRow(c), surfaceRow(c + 1)));
        expect(mineralOf(grid.get(c, r))).toBe(d.mineral);
      }
    // Sin el oeste (cuadrícula desde la columna 0) el este es idéntico.
    const east = generateWorld(DEFAULT_SEED, WORLD_REV_LEGACY, WORLD.columns, 0).grid;
    const full = generateWorld(DEFAULT_SEED, WORLD_REV_LEGACY).grid;
    for (let r = 0; r < WORLD.rows; r++)
      for (let c = 0; c < WORLD.columns; c++) expect(full.get(c, r)).toBe(east.get(c, r));
  });

  it('La Portada es la única zona del paisaje con mar', () => {
    const changes = [];
    for (let i = 0; i < BIOMES.length - 1; i++)
      if (BIOMES[i]!.backdrop !== BIOMES[i + 1]!.backdrop)
        changes.push([BIOMES[i]!.id, BIOMES[i + 1]!.id]);
    expect(changes).toEqual([['hills', 'portada']]);
    expect(BIOMES.filter((b) => b.backdrop === 'coast').map((b) => b.id)).toEqual(['portada']);
  });

  it('cada monumento cabe en su zona, se apoya en suelo parejo y no tapa el campamento', () => {
    expect(LANDMARK_SITES.map((s) => s.biome)).toEqual(['hand', 'pampa', 'fcab', 'huanchaca']);
    for (const site of LANDMARK_SITES) {
      const { column, groundRow } = landmarkSpot(site, site.width);
      const zone = BIOMES.find((b) => b.id === site.biome)!;
      const half = Math.ceil(site.width / 16 / 2);
      expect(column - half, site.key).toBeGreaterThan(zone.from);
      expect(column + half, site.key).toBeLessThan(zone.to);
      // El pie va en el suelo más bajo de su ancho y el desnivel es de un bloque o menos.
      const rows = [];
      for (let c = column - half; c <= column + half; c++) rows.push(surfaceRow(c));
      expect(groundRow).toBe(Math.max(...rows));
      expect(Math.max(...rows) - Math.min(...rows), site.key).toBeLessThanOrEqual(1);
      // Lejos del campamento, la bodega, la mina y la cabaña (−40..139).
      expect(column + half < -40 || column - half > 139, site.key).toBe(true);
    }
  });

  it('la decoración es estable, solo desértica y no pisa lo existente', () => {
    const a = biomeDecor(),
      b = biomeDecor();
    expect(a).toEqual(b);
    const all = [...a.trees, ...a.plants, ...a.rocks];
    for (const [, column] of all) {
      expect(DECOR_RANGES.some(([f, t]) => column >= f && column <= t)).toBe(true);
      expect(column < -40 || column >= 140).toBe(true);
      expect(TREE_COLUMNS).not.toContain(column);
    }
    // Plantas del norte de Chile, además de las rocas del paisaje.
    const DESERT = new Set([
      'copao',
      'copao_joven',
      'copiapoa',
      'cojin_atacameno',
      'cachiyuyo',
      'brea',
      'grama_salada',
      'nolana',
      'desert_rock_small',
      'desert_rock_large',
      'pebble_gray',
      'boulder',
    ]);
    for (const [k, c] of all) expect(DESERT.has(k), `${k} en ${c}`).toBe(true);
    const kinds = (from: number, to: number) =>
      new Set(all.filter(([, c]) => c >= from && c <= to).map(([k]) => k));
    expect(kinds(155, 204)).toContain('grama_salada');
    expect(kinds(155, 204)).toContain('cachiyuyo');
    expect([...kinds(351, 410)].some((k) => k.startsWith('copao'))).toBe(true);
    expect([...kinds(433, 459)].some((k) => k.startsWith('copao'))).toBe(false);
    expect(kinds(430, 459)).toContain('nolana');
    // Árboles separados: nunca dos en columnas vecinas.
    const trees = a.trees.map(([, c]) => c).sort((x, y) => x - y);
    for (let i = 1; i < trees.length; i++)
      expect(trees[i]! - trees[i - 1]!).toBeGreaterThanOrEqual(3);
  });
});

describe('V9: guardado del mundo de biomas', () => {
  const player = { x: 260 * 16, y: 140 };

  /** Partida con excavación en el desierto y en el FCAB, y un bloque puesto. */
  function session() {
    const s = new GameSession(createInitialTerrain());
    s.grid.set(30, 14, Block.Air);
    s.grid.set(250, 13, Block.Air);
    const top = surfaceRow(255) - 1;
    s.grid.set(255, top, Block.Wood);
    s.placed.add(s.grid.index(255, top));
    s.regions.enter('pampa');
    s.regions.enter('fcab');
    return { s, top };
  }

  it('guarda región, zonas visitadas, posición, excavación y construcción', () => {
    const { s, top } = session();
    const raw = encodeSave(s, player);
    const data = JSON.parse(raw);
    expect(data.columns).toBe(WORLD_SPAN);
    expect(data.left).toBe(WORLD_FIRST_COLUMN);
    expect(data.regions).toEqual({
      current: 'fcab',
      visited: ['desert', 'pampa', 'fcab'],
    });
    const back = decodeSave(raw)!;
    expect(back).not.toBeNull();
    expect(back.player).toEqual(player);
    expect(back.session.regions.snapshot()).toEqual(data.regions);
    expect(back.session.grid.get(30, 14)).toBe(Block.Air);
    expect(back.session.grid.get(250, 13)).toBe(Block.Air);
    expect(back.session.grid.get(255, top)).toBe(Block.Wood);
    expect(back.session.isPlaced({ column: 255, row: top })).toBe(true);
    // El resto de la zona sale igual de la semilla (no se regenera distinto).
    const fresh = createInitialTerrain(s.seed, s.grid.worldRev);
    for (let r = 0; r < WORLD.rows; r++)
      for (let c = 220; c < 284; c++)
        if (!(c === 250 && r === 13) && !(c === 255 && r === top))
          expect(back.session.grid.get(c, r)).toBe(fresh.get(c, r));
  });

  it('una partida V6 anterior a los biomas (140 columnas) carga igual', () => {
    const { s } = session();
    const data = JSON.parse(encodeSave(s, { x: 208, y: 148 }));
    // Como la guardaba V8: sin ancho, sin regiones, índices de 140 columnas
    // y solo lo que existía en ese mundo.
    const width = data.columns,
      left = data.left;
    delete data.columns;
    delete data.left;
    delete data.regions;
    delete data.revealed;
    data.terrain = data.terrain
      .map(([i, b]: [number, number]) => [Math.floor(i / width), (i % width) + left, b])
      .filter(([, c]: number[]) => c! >= 0)
      .filter(([, c]: number[]) => c! < LEGACY_COLUMNS_V6)
      .map(([r, c, b]: number[]) => [r! * LEGACY_COLUMNS_V6 + c!, b]);
    data.build.placed = [];
    const back = decodeSave(JSON.stringify(data))!;
    expect(back).not.toBeNull();
    expect(back.session.grid.columns).toBe(WORLD_SPAN);
    expect(back.session.grid.first).toBe(WORLD_FIRST_COLUMN);
    expect(back.session.grid.get(30, 14)).toBe(Block.Air);
    expect(back.session.regions.snapshot()).toEqual({
      current: 'desert',
      visited: ['desert'],
    });
    // Los biomas nuevos llegan intactos.
    expect(back.session.grid.get(250, 13)).not.toBe(Block.Air);
  });
});

describe('Regiones visitadas', () => {
  it('una partida con las regiones de V9 las pasa a las zonas del desierto', () => {
    const t = new RegionTracker();
    t.restore({ current: 'forest', visited: ['desert', 'valley', 'forest', 'monoliths', 'coast'] });
    expect(t.snapshot()).toEqual({
      current: 'fcab',
      visited: ['hand', 'desert', 'pampa', 'fcab', 'portada'],
    });
  });

  it('anuncia solo la primera visita y se guarda y restaura', () => {
    const t = new RegionTracker();
    expect(t.has('desert')).toBe(true);
    expect(t.enter('desert')).toBeNull();
    expect(t.enter('pampa')).toBe('pampa');
    expect(t.enter('pampa')).toBeNull();
    expect(t.enter('hand')).toBe('hand');
    const snap = t.snapshot();
    expect(snap).toEqual({
      current: 'hand',
      visited: ['hand', 'desert', 'pampa'],
    });
    const back = new RegionTracker();
    back.restore(JSON.parse(JSON.stringify(snap)));
    expect(back.snapshot()).toEqual(snap);
    // Datos ausentes o corruptos: solo el desierto.
    const empty = new RegionTracker();
    empty.restore({ current: 'marte', visited: ['marte', 3] });
    expect(empty.snapshot()).toEqual({ current: 'desert', visited: ['desert'] });
  });
});
