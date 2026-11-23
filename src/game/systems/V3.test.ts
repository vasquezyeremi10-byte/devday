import { describe, expect, it } from 'vitest';
import { BALANCE, TOOL_KEYS, TOOLS } from '../config/balance';
import { MINERAL_KEYS } from '../config/minerals';
import {
  createInitialTerrain,
  DEFAULT_SEED,
  generateWorld,
  geologyOf,
  reservedCell,
} from '../world/Geology';
import { Block, TerrainGrid, TUNNEL, surfaceRow } from '../world/TerrainGrid';
import { BLAST, BlastingSystem } from './BlastingSystem';
import { CartSystem } from './CartSystem';
import { GameSession } from './GameSession';
import { GeotechnicalSystem, StabilityState } from './GeotechnicalSystem';
import { HealthSystem } from './HealthSystem';
import { MiningSystem } from './MiningSystem';
import { AchievementSystem, ProgressionSystem } from './ProgressionSystem';
import { RailSystem, railTop } from './RailSystem';
import { decodeSave, encodeSave } from './SaveSystem';
import { SupportSystem } from './SupportSystem';
import { VentilationSystem } from './VentilationSystem';
import { VisibilitySystem } from './VisibilitySystem';

/** Rejilla de prueba: todo sólido salvo el aire indicado. */
function solidGrid(columns = 30, rows = 20, block = Block.Rock): TerrainGrid {
  const g = new TerrainGrid(columns, rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) g.set(c, r, block);
  return g;
}
const dig = (
  g: TerrainGrid,
  c0: number,
  c1: number,
  r0: number,
  r1: number,
) => {
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) g.set(c, r, Block.Air);
};

describe('Geología procedural por semilla', () => {
  it('es reproducible y distinta entre semillas', () => {
    const a = createInitialTerrain(123),
      b = createInitialTerrain(123),
      c = createInitialTerrain(456);
    expect(a.cells).toEqual(b.cells);
    expect(a.cells).not.toEqual(c.cells);
  });
  it('respeta el orden de abundancia y un único mineral alienígena', () => {
    const totals = Object.fromEntries(MINERAL_KEYS.map((k) => [k, 0]));
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, DEFAULT_SEED];
    for (const seed of seeds) {
      const { grid } = generateWorld(seed);
      let alien = 0;
      for (let r = 0; r < grid.rows; r++)
        for (let c = 0; c < grid.columns; c++) {
          const b = grid.get(c, r);
          if (b >= Block.Coal && b <= Block.Alien)
            totals[MINERAL_KEYS[b - Block.Coal]!]!++;
          if (b === Block.Alien) {
            alien++;
            expect(r).toBeGreaterThanOrEqual(30);
          }
        }
      expect(alien).toBe(1);
    }
    expect(totals.coal).toBeGreaterThan(totals.gold!);
    expect(totals.iron).toBeGreaterThan(totals.gold!);
    expect(totals.copper).toBeGreaterThan(totals.gold!);
    expect(totals.gold).toBeGreaterThan(totals.sapphire!);
    expect(totals.emerald! + totals.ruby!).toBeGreaterThan(totals.diamond!);
    expect(totals.diamond).toBeGreaterThan(totals.alien_ore!);
    // Precios en el orden económico pedido.
    const prices = MINERAL_KEYS.map((k) => BALANCE.sale[k]);
    expect([...prices].sort((x, y) => x - y)).toEqual(
      prices.slice().sort((x, y) => x - y),
    );
    expect(BALANCE.sale.coal).toBeLessThan(BALANCE.sale.iron);
    expect(BALANCE.sale.diamond).toBeLessThan(BALANCE.sale.alien_ore);
  });
  it('usa tipos de yacimiento reconocibles y deja libres las zonas reservadas', () => {
    const geo = geologyOf(DEFAULT_SEED);
    const kinds = new Set(geo.deposits.map((d) => d.kind));
    for (const k of [
      'estratificado',
      'veta',
      'diseminado',
      'bolsada',
      'especial',
    ])
      expect(kinds.has(k as never)).toBe(true);
    expect(geo.deposits.find((d) => d.mineral === 'coal')!.kind).toBe(
      'estratificado',
    );
    for (const d of geo.deposits)
      for (const [c, r] of d.cells) expect(reservedCell(c, r)).toBe(false);
    // Carbón, hierro y cobre accesibles en zona poco profunda.
    for (const m of ['coal', 'iron', 'copper'])
      expect(
        geo.deposits.some(
          (d) => d.mineral === m && d.cells.some(([, r]) => r <= 18),
        ),
      ).toBe(true);
  });
});

describe('Vías con rampas de un bloque', () => {
  /** Piso escalonado: filas de piso por columna. */
  function stepped(floors: number[]): TerrainGrid {
    const g = solidGrid(floors.length, 16);
    floors.forEach((floor, c) => dig(g, c, c, 0, floor - 1));
    return g;
  }
  it('sube y baja un bloque con perfil continuo y rechaza dos', () => {
    const g = stepped([10, 10, 9, 9, 10, 10, 8, 8]);
    const rails = new RailSystem(g);
    rails.segments = [{ column: 0, row: 9, kind: 'track' }];
    for (const [column, row] of [
      [1, 9],
      [2, 8],
      [3, 8],
      [4, 9],
      [5, 9],
    ] as const) {
      expect(rails.canPlace({ column, row })).toBe(true);
      rails.place({ column, row });
    }
    // Columna 6 está dos bloques más arriba: prohibido.
    const end = rails.ends().find((e) => e.column === 6)!;
    expect(end.target).toBe('DESNIVEL MAYOR A UN BLOQUE');
    // La rampa vive en la columna baja, pegada al escalón: 16 px en 16 px.
    expect(rails.railY(1 * 16)).toBe(railTop(9));
    expect(rails.railY(2 * 16 - 0.001)).toBeCloseTo(railTop(8), 1);
    expect(rails.railY(2 * 16 + 8)).toBe(railTop(8));
    expect(rails.slopeAt(1 * 16 + 8)).toBe(-1);
    expect(rails.slopeAt(4 * 16 + 8)).toBe(1);
    // Continuidad del perfil en cada borde de columna.
    for (let x = 16; x < 6 * 16; x += 16)
      expect(Math.abs(rails.railY(x - 0.01) - rails.railY(x))).toBeLessThan(
        0.1,
      );
  });
  it('no permite vía suspendida ni dentro de roca sin excavar', () => {
    const g = stepped([10, 10, 13]);
    const rails = new RailSystem(g);
    rails.segments = [{ column: 0, row: 9, kind: 'track' }];
    rails.place({ column: 1, row: 9 });
    expect(rails.ends().find((e) => e.column === 2)!.target).toBe(
      'DESNIVEL MAYOR A UN BLOQUE',
    );
    g.set(2, 12, Block.Air);
    g.set(2, 11, Block.Air);
    g.set(2, 10, Block.Air);
    g.set(2, 9, Block.Air);
    for (let r = 10; r < 16; r++) g.set(2, r, Block.Air);
    expect(rails.ends().find((e) => e.column === 2)!.target).toBe(
      'VIA SIN SOPORTE: NECESITA PISO',
    );
    const rock = stepped([10, 10, 10]);
    rock.set(2, 9, Block.Rock);
    const r2 = new RailSystem(rock);
    r2.segments = [
      { column: 0, row: 9, kind: 'track' },
      { column: 1, row: 9, kind: 'track' },
    ];
    expect(r2.canPlace({ column: 2, row: 9 })).toBe(false);
  });
  it('el carro sube más lento, baja más rápido y apoya ambas ruedas', () => {
    const g = stepped([10, 10, 9, 9, 9, 9]);
    const rails = new RailSystem(g);
    rails.segments = [
      { column: 0, row: 9, kind: 'track' },
      { column: 1, row: 9, kind: 'track' },
      { column: 2, row: 8, kind: 'track' },
      { column: 3, row: 8, kind: 'track' },
    ];
    const cart = new CartSystem(rails);
    cart.pushing = true;
    // Se mantiene el carro sobre la rampa para medir la velocidad objetivo.
    for (let i = 0; i < 40; i++) {
      cart.x = 24;
      cart.step(1, 0.05);
    }
    expect(cart.velocity).toBeCloseTo(
      BALANCE.cartSpeed * BALANCE.cartUphill,
      3,
    );
    cart.velocity = 0;
    for (let i = 0; i < 40; i++) {
      cart.x = 24;
      cart.step(-1, 0.05);
    }
    expect(cart.velocity).toBeCloseTo(
      -BALANCE.cartSpeed * BALANCE.cartDownhill,
      3,
    );
    cart.x = 24;
    const contact = cart.contact();
    expect(contact.angle).toBeLessThan(0);
    expect(contact.y).toBeLessThan(railTop(9));
  });
});

describe('Sostenimiento y estabilidad', () => {
  it('la entrada original no se derrumba aunque falle un marco; la galería vecina sí', () => {
    const s = new GameSession(createInitialTerrain());
    const fixed = s.supports.items.filter((support) => support.fixed);
    expect(fixed).toHaveLength(2);
    const durability = fixed.map((support) => support.durability);
    s.supports.age(60 * 200);
    s.supports.shock({ column: 20, row: 9 }, 5, 10);
    expect(fixed.map((support) => support.durability)).toEqual(durability);

    // Simula también un marco roto en una partida anterior.
    for (const support of fixed) support.durability = 0;
    s.geotech.evaluate();
    const inEntrance = (span: { roof: number; from: number; to: number }) =>
      span.roof + 1 >= TUNNEL.topRow &&
      span.roof + 1 <= TUNNEL.bottomRow &&
      span.from <= TUNNEL.toColumn &&
      span.to >= TUNNEL.fromColumn;
    expect(s.geotech.spans.some(inEntrance)).toBe(false);
    expect(
      [...s.geotech.collapses.values()].some((c) => inEntrance(c.span)),
    ).toBe(false);

    const changed = [];
    for (let row = TUNNEL.topRow; row <= TUNNEL.bottomRow; row++)
      for (let column = TUNNEL.toColumn + 1; column <= 35; column++) {
        s.grid.set(column, row, Block.Air);
        changed.push({ column, row });
      }
    s.afterTerrainChange(changed);
    const nearby = [...s.geotech.collapses.values()].find(
      (collapse) => collapse.span.from > TUNNEL.toColumn,
    );
    expect(nearby).toBeDefined();
    expect(s.geotech.spans.some(inEntrance)).toBe(false);
    const due = s.geotech.tick(nearby!.remaining);
    const detached = s.geotech.release(due[0]!.span);
    expect(detached.length).toBeGreaterThan(0);
    expect(detached.every((cell) => cell.column > TUNNEL.toColumn)).toBe(true);
    for (let row = TUNNEL.topRow; row <= TUNNEL.bottomRow; row++)
      for (let column = TUNNEL.fromColumn; column <= TUNNEL.toColumn; column++)
        expect(s.grid.get(column, row)).toBe(Block.Air);
  });

  it('al cargar descarta una cuenta antigua de derrumbe en la entrada', () => {
    const s = new GameSession(createInitialTerrain());
    const data = JSON.parse(encodeSave(s, { x: 20 * 16 + 8, y: 148 }));
    for (const support of data.supports)
      if (support.fixed) support.durability = 0;
    data.collapses = [{ key: '6:18', remaining: 1000 }];
    const loaded = decodeSave(JSON.stringify(data));
    expect(loaded).not.toBeNull();
    expect(loaded!.session.geotech.collapses.size).toBe(0);
    expect(
      loaded!.session.supports.items.filter((support) => support.fixed),
    ).toHaveLength(2);
  });

  it('galería extensa sin vigas: advertencia, cuenta regresiva y derrumbe local', () => {
    const g = solidGrid(30, 20);
    dig(g, 0, 29, 0, 4); // superficie abierta
    dig(g, 5, 14, 14, 15); // galería de 10 de largo y 2 de alto
    const supports = new SupportSystem();
    const geo = new GeotechnicalSystem(g, supports);
    geo.evaluate();
    const span = geo.spans.find((s) => s.roof === 13)!;
    expect(span.state).toBe(StabilityState.Imminent);
    const collapse = geo.collapses.get(span.key)!;
    expect(collapse.remaining).toBe(10_000);
    expect(geo.tick(collapse.remaining - 1)).toHaveLength(0);
    const due = geo.tick(2);
    expect(due).toHaveLength(1);
    const detached = geo.release(due[0]!.span);
    expect(detached.length).toBeGreaterThan(0);
    // Localizado: solo el techo del tramo, nunca fuera de él.
    for (const c of detached) {
      expect(c.row).toBe(13);
      expect(c.column).toBeGreaterThanOrEqual(5);
      expect(c.column).toBeLessThanOrEqual(14);
      expect(g.get(c.column, c.row)).toBe(Block.Air);
    }
  });
  it('vigas instaladas a tiempo cancelan el derrumbe; acero alcanza más', () => {
    const g = solidGrid(30, 20);
    dig(g, 0, 29, 0, 4);
    dig(g, 5, 14, 14, 15);
    const supports = new SupportSystem();
    const geo = new GeotechnicalSystem(g, supports);
    geo.evaluate();
    expect(geo.collapses.size).toBe(1);
    expect(supports.install(g, { column: 7, row: 15 }, 'wood')).not.toBeNull();
    expect(supports.install(g, { column: 12, row: 15 }, 'wood')).not.toBeNull();
    geo.evaluate();
    expect(geo.collapses.size).toBe(0);
    expect(supports.check(g, { column: 3, row: 15 })).toBe(
      'EXCAVA ANTES DE INSTALAR',
    );
    // Reemplazo por acero y golpe de una tronadura.
    expect(supports.install(g, { column: 7, row: 15 }, 'steel')!.kind).toBe(
      'steel',
    );
    const broken = supports.shock({ column: 12, row: 15 }, 2, 3);
    expect(broken.map((s) => s.kind)).toEqual(['wood']);
    geo.evaluate();
    expect(geo.collapses.size).toBeGreaterThanOrEqual(0);
  });
  it('una galería corta en roca es estable y la madera se deteriora', () => {
    const g = solidGrid(20, 20);
    dig(g, 0, 19, 0, 4);
    dig(g, 5, 7, 14, 15);
    const supports = new SupportSystem();
    const geo = new GeotechnicalSystem(g, supports);
    geo.evaluate();
    expect(geo.spans.every((s) => s.state === StabilityState.Stable)).toBe(
      true,
    );
    const wood = supports.install(g, { column: 6, row: 15 }, 'wood')!;
    supports.age(60 * 50);
    expect(wood.durability).toBeCloseTo(50, 0);
  });
});

describe('Ventilación', () => {
  it('buena cerca de la entrada, peor lejos y en profundidad; ductos ayudan', () => {
    const g = createInitialTerrain();
    const v = new VentilationSystem(g);
    // Pozo en la columna 13 hasta la fila 30 y galería larga profunda.
    dig(g, 13, 13, 10, 30);
    dig(g, 14, 40, 29, 30);
    v.evaluate();
    expect(v.at(20, 8)).toBeGreaterThan(0.85);
    expect(v.at(13, 15)).toBeGreaterThan(v.at(13, 29));
    const far = v.at(40, 30);
    expect(far).toBeLessThan(0.4);
    const workFace = v.at(25, 30);
    // Ventilador principal en superficie y ductos por el pozo.
    expect(v.check({ column: 13, row: 20 }, 'fan_main')).toBe(
      'EL VENTILADOR PRINCIPAL VA EN SUPERFICIE',
    );
    expect(v.install({ column: 12, row: 9 }, 'fan_main')).toBe(true);
    for (let r = 9; r <= 30; r++) v.install({ column: 13, row: r }, 'duct');
    for (let c = 14; c <= 22; c++) v.install({ column: c, row: 30 }, 'duct');
    v.evaluate();
    expect(v.status[0]!.running).toBe(true);
    expect(v.at(25, 30)).toBeGreaterThan(workFace + 0.3);
    expect(v.at(40, 30)).toBeGreaterThan(far);
    // Contaminación temporal de una tronadura.
    const before = v.at(20, 30);
    v.pollute({ column: 20, row: 30 });
    v.evaluate();
    expect(v.at(20, 30)).toBeLessThan(before);
    for (let i = 0; i < 40; i++) v.decay(1000);
    v.evaluate();
    expect(v.at(20, 30)).toBeCloseTo(before, 3);
  });
});

describe('Herramientas, perforación y tronadura', () => {
  it('tiempos por bloque estándar y una sola pala básica', () => {
    expect(TOOLS.iron.workMs).toBe(2000);
    expect(TOOLS.tungsten.workMs).toBe(3500);
    // Palear y cargar el carro: 2 s por bloque.
    expect(TOOLS.shovel.workMs).toBe(2000);
    expect(BALANCE.shovelMs).toBe(2000);
    expect(TOOLS.drill.workMs).toBe(2500);
    expect(TOOL_KEYS.filter((k) => TOOLS[k].type === 'shovel')).toEqual([
      'shovel',
    ]);
  });
  it('roca dura y gemas exigen picota superior', () => {
    const grid = solidGrid(10, 10),
      s = new GameSession(grid);
    s.tools.add('iron');
    expect(s.toolProblem(Block.Coal)).toBeNull();
    expect(s.toolProblem(Block.HardRock)).toMatch(/TUNGSTENO/);
    expect(s.toolProblem(Block.Diamond)).toMatch(/TUNGSTENO/);
    s.tools.add('shovel');
    expect(s.toolProblem(Block.Rubble)).toBeNull();
    expect(s.toolProblem(Block.Rock)).toMatch(/PALA/);
  });
  it('dinamita solo en barreno, una carga, máximo 3×3 irregular y sin duplicar', () => {
    const g = solidGrid(20, 20);
    g.set(10, 10, Block.Gold);
    const b = new BlastingSystem(g, 99, (c) => c.column === 11 && c.row === 11);
    expect(b.canCharge({ column: 10, row: 10 })).toMatch(/BARRENO/);
    expect(b.drill({ column: 10, row: 10 })).toBe(true);
    expect(b.charge({ column: 10, row: 10 })).toBe(true);
    expect(b.charge({ column: 10, row: 10 })).toBe(false);
    expect(b.light({ column: 10, row: 10 }, 0)).toBe(true);
    expect(b.due(BLAST.fuseMs - 1)).toHaveLength(0);
    const [charge] = b.due(BLAST.fuseMs);
    const result = b.explode(charge!);
    expect(result.destroyed.length).toBeGreaterThan(0);
    expect(result.destroyed.length).toBeLessThan(9);
    for (const c of result.destroyed) {
      expect(Math.abs(c.column - 10)).toBeLessThanOrEqual(1);
      expect(Math.abs(c.row - 10)).toBeLessThanOrEqual(1);
    }
    expect(g.get(11, 11)).toBe(Block.Rock); // protegido
    expect(result.materials).toHaveLength(result.destroyed.length);
    expect(result.materials.filter((m) => m === 'gold')).toHaveLength(1);
  });
  it('en muchas explosiones nunca hay un cuadrado perfecto', () => {
    for (let seed = 0; seed < 60; seed++) {
      const g = solidGrid(10, 10);
      const b = new BlastingSystem(g, seed, () => false);
      b.drill({ column: 5, row: 5 });
      b.charge({ column: 5, row: 5 });
      b.light({ column: 5, row: 5 }, 0);
      const r = b.explode(b.due(BLAST.fuseMs)[0]!);
      expect(r.destroyed.length).toBeLessThan(9);
      expect(r.destroyed.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('Salud, progreso, logros y visibilidad', () => {
  it('daño con protección breve, aire continuo y muerte con penalización', () => {
    const h = new HealthSystem();
    expect(h.damage(30, 0, 'roca')).toBe(30);
    expect(h.damage(30, 100, 'roca')).toBe(0);
    expect(h.damage(5, 200, 'aire')).toBe(5);
    const s = new GameSession(createInitialTerrain());
    s.money = 100;
    s.inventory.items.push('coal', 'iron', 'gold', 'dirt');
    s.health.damage(200, 0, 'tronadura');
    expect(s.health.dead).toBe(true);
    const loss = s.die();
    // Normal: pierde los cuatro bloques transportados y el 10 % del dinero.
    expect(loss).toEqual({ money: 10, items: 4 });
    expect(s.money).toBe(90);
    expect(s.inventory.items).toEqual([]);
    expect(s.health.hp).toBe(100);
  });
  it('etapas por progreso real y logro secreto una sola vez', () => {
    const p = new ProgressionSystem();
    expect(p.update()).toBeNull();
    p.found.add('gold');
    expect(p.update()).toBe(2);
    p.earned = 500;
    expect(p.update()).toBeNull();
    p.deepestRow = 21;
    expect(p.update()).toBe(3);
    const a = new AchievementSystem();
    expect(a.unlock('no_estamos_solos')).toBe(true);
    expect(a.unlock('no_estamos_solos')).toBe(false);
  });
  it('desde la superficie no se conocen menas enterradas ni cavernas', () => {
    const { grid, geology } = generateWorld(DEFAULT_SEED);
    const v = new VisibilitySystem(grid.columns, grid.rows, grid.first);
    v.initialize(grid);
    for (const d of geology.deposits)
      for (const [c, r] of d.cells) expect(v.has(c, r)).toBe(false);
    for (const cave of geology.caverns)
      for (const [c, r] of cave) expect(v.has(c, r)).toBe(false);
    expect(v.has(20, 8)).toBe(true);
    expect(v.has(5, surfaceRow(5))).toBe(true);
    const copy = new VisibilitySystem(grid.columns, grid.rows, grid.first);
    expect(copy.decode(v.encode())).toBe(true);
    expect(copy.revealed).toEqual(v.revealed);
  });
});

describe('Guardado V3 y migración', () => {
  it('conserva sistemas nuevos y apaga mechas encendidas al cargar', () => {
    const s = new GameSession(createInitialTerrain());
    s.progression.tier = 2;
    s.supplies.torch = 3;
    s.supplies.fuse = 0;
    const grid = s.grid;
    grid.set(26, 9, Block.Air);
    s.lights.install(grid, { column: 21, row: 9 }, 'torch');
    s.blasting.drill({ column: 26, row: 8 });
    s.blasting.charge({ column: 26, row: 8 });
    s.blasting.light({ column: 26, row: 8 }, 1000);
    s.achievements.unlock('no_estamos_solos');
    s.health.hp = 42;
    const restored = decodeSave(encodeSave(s, { x: 208, y: 148 }))!;
    const r = restored.session;
    expect(r.seed).toBe(s.seed);
    expect(r.lights.items).toHaveLength(1);
    expect(r.blasting.charges[0]!.endsAt).toBeNull();
    expect(r.supplies.fuse).toBe(1);
    expect(r.achievements.unlocked.has('no_estamos_solos')).toBe(true);
    expect(r.health.hp).toBe(42);
    expect(r.progression.tier).toBe(2);
    expect(r.grid.get(26, 9)).toBe(Block.Air);
  });
  it('rechaza crear mena al cargar', () => {
    const s = new GameSession(createInitialTerrain());
    const data = JSON.parse(encodeSave(s, { x: 208, y: 148 }));
    data.terrain = [[5 * 80 + 5, Block.Diamond]];
    expect(decodeSave(JSON.stringify(data))).toBeNull();
  });
  it('migra una partida V2: excavación, plata/cuarzo liquidados y rieles', () => {
    const old = createInitialTerrain();
    // Las partidas V2 guardaban las 80 columnas del mundo original.
    const terrain = old.cells.map((row) => row.slice(0, 80));
    terrain[12]![13] = -1;
    const v2 = {
      version: 2,
      money: 7,
      railStock: 2,
      inventory: ['silver', 'coal'],
      tools: [{ id: 1, kind: 'shovel', durability: 30 }],
      equipped: 1,
      rails: Array.from({ length: 15 }, (_, i) => ({
        column: 10 + i,
        row: 9,
        kind: 'horizontal',
      })),
      cart: { x: 252, items: ['quartz'] },
      terrain,
      piles: [{ id: 1, x: 280, y: 153, material: 'dirt', count: 8 }],
      sold: 3,
      player: { x: 208, y: 148 },
    };
    const r = decodeSave(JSON.stringify(v2))!;
    expect(r).not.toBeNull();
    expect(r.session.money).toBe(7 + 18 + 15);
    expect(r.session.inventory.items).toEqual(['coal']);
    expect(r.session.cart.inventory.items).toEqual([]);
    expect(r.session.supplies.rail).toBe(2);
    expect(r.session.grid.get(13, 12)).toBe(Block.Air);
    expect(r.session.piles[0]!.items).toHaveLength(8);
    expect(r.migrated).toMatch(/MIGRADA/);
  });
});

describe('Mineral alienígena', () => {
  it('se extrae con picota de tungsteno y cuenta una sola unidad', () => {
    const grid = new TerrainGrid(12, 12),
      s = new GameSession(grid),
      mining = new MiningSystem(grid);
    grid.set(5, 5, Block.Alien);
    s.tools.add('iron');
    expect(s.mine(mining, { x: 88, y: 64 }, { column: 5, row: 5 })).toBe(false);
    s.tools.add('tungsten');
    expect(s.mine(mining, { x: 88, y: 64 }, { column: 5, row: 5 })).toBe(true);
    expect(s.inventory.items).toEqual(['alien_ore']);
  });
});
