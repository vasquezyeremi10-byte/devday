import { describe, expect, it } from 'vitest';
import { SPAWN } from '../config/constants';
import { worldRevFor } from '../config/explore';
import { MINERAL_KEYS } from '../config/minerals';
import { GameSession, pickLevelFor } from '../systems/GameSession';
import { VentilationSystem } from '../systems/VentilationSystem';
import { VisibilitySystem } from '../systems/VisibilitySystem';
import { decodeSave, encodeSave } from '../systems/SaveSystem';
import { ExplorationProgress } from '../systems/ExplorationProgress';
import { materialOf } from '../config/balance';
import { CAVE_FIRST_COLUMN, CAVE_MAX_PATH } from './Caves';
import { CrystalIndex } from './CrystalIndex';
import {
  createInitialTerrain,
  DEFAULT_SEED,
  geologyOf,
  WORLD_REV_EXPLORE,
  WORLD_REV_LEGACY,
} from './Geology';
import {
  Block,
  mineralOf,
  oreBlock,
  TUNNEL,
  type TerrainGrid,
} from './TerrainGrid';

const SEEDS = [
  DEFAULT_SEED,
  ...Array.from({ length: 30 }, (_, i) => 1009 * i + 17),
];

/** Distancias (4-vecinos) por aire desde una celda. */
function reach(grid: TerrainGrid, column: number, row: number) {
  const key = (c: number, r: number) => r * grid.columns + c;
  const dist = new Map<number, number>([[key(column, row), 0]]);
  const queue = [[column, row]] as [number, number][];
  for (let head = 0; head < queue.length; head++) {
    const [c, r] = queue[head]!;
    const d = dist.get(key(c, r))!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const x = c + dx,
        y = r + dy;
      if (!grid.contains(x, y) || grid.isSolid(x, y) || dist.has(key(x, y)))
        continue;
      dist.set(key(x, y), d + 1);
      queue.push([x, y]);
    }
  }
  return { has: (c: number, r: number) => dist.has(key(c, r)), dist, key };
}

describe('Cavernas exploradas (geología rev. 2)', () => {
  it('la rev. 1 no cambia: sin red, sin cristales, sin ventilas', () => {
    const grid = createInitialTerrain(DEFAULT_SEED);
    expect(grid.worldRev).toBe(WORLD_REV_LEGACY);
    expect(geologyOf(DEFAULT_SEED).explore).toBeUndefined();
    expect(grid.vents).toHaveLength(0);
    expect(new CrystalIndex(grid).spots).toHaveLength(0);
  });

  it('la rev. 2 solo cambia el terreno al este de la galería de la bocamina', () => {
    for (const seed of SEEDS.slice(0, 8)) {
      const a = createInitialTerrain(seed, WORLD_REV_LEGACY);
      const b = createInitialTerrain(seed, WORLD_REV_EXPLORE);
      expect(b.worldRev).toBe(WORLD_REV_EXPLORE);
      for (let r = 0; r < a.rows; r++)
        for (let c = 0; c < a.columns; c++)
          if (c <= TUNNEL.toColumn) expect(b.get(c, r)).toBe(a.get(c, r));
    }
  });

  it('es determinista', () => {
    const a = createInitialTerrain(4242, WORLD_REV_EXPLORE);
    const b = createInitialTerrain(4242, WORLD_REV_EXPLORE);
    expect(b.cells).toEqual(a.cells);
  });

  describe.each(SEEDS)('semilla %i', (seed) => {
    const grid = createInitialTerrain(seed, WORLD_REV_EXPLORE);
    const explore = geologyOf(seed, WORLD_REV_EXPLORE).explore!;
    const entrance = explore.entrance;

    it('nace en el muro del fondo de la galería y todo queda conectado', () => {
      expect(CAVE_FIRST_COLUMN).toBe(TUNNEL.toColumn + 1);
      expect(grid.get(TUNNEL.toColumn, 9)).toBe(Block.Air);
      expect(grid.get(entrance.column, entrance.row)).toBe(Block.Air);
      const r = reach(grid, TUNNEL.toColumn, 9);
      for (const [c, rr] of explore.cells) {
        expect(r.has(c, rr)).toBe(true);
        expect(r.dist.get(r.key(c, rr))!).toBeLessThanOrEqual(
          CAVE_MAX_PATH + 2,
        );
      }
    });

    it('tiene salas de formas distintas y pasadizos por los que cabe el minero', () => {
      expect(explore.cells.length).toBeGreaterThan(80);
      expect(explore.chambers.length).toBeGreaterThanOrEqual(3);
      expect(
        new Set(explore.chambers.map((c) => c.kind)).size,
      ).toBeGreaterThanOrEqual(3);
      // Recorrido a pie: solo por celdas con 2 de alto (cabe el minero), desde
      // la galería llega al centro de cada sala.
      const clear = (c: number, r: number) =>
        grid.contains(c, r) &&
        grid.get(c, r) === Block.Air &&
        (grid.get(c, r - 1) === Block.Air || grid.get(c, r + 1) === Block.Air);
      const seen = new Set<number>([
        entrance.row * grid.columns + entrance.column,
      ]);
      const queue: [number, number][] = [[entrance.column, entrance.row]];
      for (let head = 0; head < queue.length; head++) {
        const [c, r] = queue[head]!;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const k = (r + dy) * grid.columns + c + dx;
          if (!seen.has(k) && clear(c + dx, r + dy)) {
            seen.add(k);
            queue.push([c + dx, r + dy]);
          }
        }
      }
      for (const ch of explore.chambers) {
        const inRoom = explore.cells.find(
          ([c, r]) => c === ch.cx && r === ch.cy,
        )!;
        expect(inRoom).toBeDefined();
        expect(seen.has(ch.cy * grid.columns + ch.cx)).toBe(true);
      }
    });

    it('el aire de toda la red es respirable sin ventilador', () => {
      const v = new VentilationSystem(grid);
      v.evaluate();
      for (const [c, r] of explore.cells)
        expect(v.at(c, r)).toBeGreaterThanOrEqual(0.4);
    });

    it('la red empieza sin descubrir: solo se ve la boca, no las salas', () => {
      const v = new VisibilitySystem(grid.columns, grid.rows, grid.first);
      v.initialize(grid);
      const seen = explore.cells.filter(([c, r]) => v.has(c, r));
      expect(seen.length).toBeLessThanOrEqual(8);
      for (const ch of explore.chambers) {
        if (ch.cx > entrance.column + 4)
          expect(v.has(ch.cx, ch.cy)).toBe(false);
      }
      for (const [c, r] of explore.secret.cells)
        expect(v.has(c, r)).toBe(false);
    });
    it('trae cobre, hierro y cristales violeta a la vista', () => {
      const exposed = (block: Block) =>
        [...Array(grid.rows).keys()].flatMap((r) =>
          [...Array(grid.columns).keys()]
            .filter(
              (c) =>
                c >= CAVE_FIRST_COLUMN &&
                grid.get(c, r) === block &&
                grid.isExposed(c, r),
            )
            .map((c) => [c, r]),
        );
      expect(exposed(Block.Iron).length).toBeGreaterThanOrEqual(1);
      expect(exposed(Block.Copper).length).toBeGreaterThanOrEqual(1);
      expect(exposed(Block.Crystal).length).toBeGreaterThanOrEqual(4);
      expect(explore.crystals.length).toBeGreaterThanOrEqual(8);
      expect(explore.vents.length).toBeGreaterThan(0);
    });

    it('hay rocas resistentes que piden picota de tungsteno', () => {
      expect(explore.hardRock.length).toBeGreaterThanOrEqual(8);
      for (const [c, r] of explore.hardRock)
        expect(grid.get(c, r)).toBe(Block.HardRock);
      expect(pickLevelFor(Block.HardRock)).toBe(2);
    });

    it('la cámara secreta está sellada por roca dura y guarda la página', () => {
      const s = explore.secret;
      for (const [c, r] of s.plug) expect(grid.get(c, r)).toBe(Block.HardRock);
      for (const [c, r] of s.cells) expect(grid.get(c, r)).toBe(Block.Air);
      expect(grid.get(s.page.column, s.page.row)).toBe(Block.Air);
      expect(grid.isSolid(s.page.column, s.page.row + 1)).toBe(true);
      // Con el sello puesto, ninguna celda de la cámara se alcanza desde la mina…
      const sealed = reach(grid, TUNNEL.toColumn, 9);
      for (const [c, r] of s.cells) expect(sealed.has(c, r)).toBe(false);
      // …y al romperlo (picota de tungsteno) sí.
      const open = createInitialTerrain(seed, WORLD_REV_EXPLORE);
      for (const [c, r] of s.plug) open.set(c, r, Block.Air);
      const through = reach(open, TUNNEL.toColumn, 9);
      for (const [c, r] of s.cells) expect(through.has(c, r)).toBe(true);
      // Y su aire es respirable (la cámara tiene su propia fisura).
      const v = new VentilationSystem(open);
      v.evaluate();
      for (const [c, r] of s.cells)
        expect(v.at(c, r)).toBeGreaterThanOrEqual(0.4);
    });
  });
});

describe('Cristal violeta: mena e inventario', () => {
  it('es una mena más del inventario: bloque, mineral y material coinciden', () => {
    expect(mineralOf(Block.Crystal)).toBe('violet_crystal');
    expect(oreBlock('violet_crystal')).toBe(Block.Crystal);
    expect(materialOf(Block.Crystal)).toBe('violet_crystal');
    expect(pickLevelFor(Block.Crystal)).toBe(1);
    for (const key of MINERAL_KEYS) expect(mineralOf(oreBlock(key))).toBe(key);
    // Las menas anteriores conservan su bloque.
    expect(oreBlock('coal')).toBe(Block.Coal);
    expect(oreBlock('alien_ore')).toBe(Block.Alien);
  });

  it('el índice de cristales lista los del terreno y los que tocan aire', () => {
    const grid = createInitialTerrain(DEFAULT_SEED, WORLD_REV_EXPLORE);
    const index = new CrystalIndex(grid);
    expect(index.spots.length).toBeGreaterThanOrEqual(8);
    expect(index.spots.some((s) => s.lx !== null)).toBe(true);
    const spot = index.spots.find((s) => s.lx !== null)!;
    grid.set(spot.column, spot.row, Block.Air);
    index.refresh();
    expect(
      index.spots.some((s) => s.column === spot.column && s.row === spot.row),
    ).toBe(false);
  });
});

describe('Guardado de la exploración', () => {
  const session = (rev: number) =>
    new GameSession(createInitialTerrain(DEFAULT_SEED, rev), DEFAULT_SEED);

  it('guarda la revisión, lo excavado y la página leída', () => {
    const s = session(WORLD_REV_EXPLORE);
    const crystal = geologyOf(DEFAULT_SEED, WORLD_REV_EXPLORE).explore!
      .crystals[0]!;
    s.grid.set(crystal[0], crystal[1], Block.Air);
    s.exploration.readPage();
    const raw = encodeSave(s, SPAWN);
    expect(JSON.parse(raw).worldRev).toBe(WORLD_REV_EXPLORE);
    const back = decodeSave(raw)!;
    expect(back.session.grid.worldRev).toBe(WORLD_REV_EXPLORE);
    expect(back.session.grid.get(crystal[0], crystal[1])).toBe(Block.Air);
    expect(back.session.exploration.pageRead).toBe(true);
  });

  it('una partida anterior gana las cavernas sin perder lo excavado', () => {
    const old = session(WORLD_REV_LEGACY);
    // El jugador ya había excavado un pozo en el cerro.
    for (let r = 12; r < 16; r++) old.grid.set(32, r, Block.Air);
    const data = JSON.parse(encodeSave(old, SPAWN));
    delete data.worldRev;
    delete data.explore;
    const raw = JSON.stringify(data);
    // Sin pedir la revisión nueva, queda como estaba.
    expect(decodeSave(raw)!.session.grid.worldRev).toBe(WORLD_REV_LEGACY);
    // Con la revisión vigente se mejora el mundo y su pozo sigue abierto.
    const upgraded = decodeSave(raw, false, WORLD_REV_EXPLORE)!;
    expect(upgraded.session.grid.worldRev).toBe(WORLD_REV_EXPLORE);
    for (let r = 12; r < 16; r++)
      expect(upgraded.session.grid.get(32, r)).toBe(Block.Air);
    expect(upgraded.session.exploration.pageRead).toBe(false);
    expect(
      geologyOf(DEFAULT_SEED, WORLD_REV_EXPLORE).explore!.cells.length,
    ).toBeGreaterThan(0);
  });

  it('el mapa guardado con una revisión no se reinterpreta con otra', () => {
    const s = session(WORLD_REV_EXPLORE);
    const raw = encodeSave(s, SPAWN);
    // Aun pidiendo rev. 1 por defecto, manda lo guardado.
    expect(
      decodeSave(raw, false, WORLD_REV_LEGACY)!.session.grid.worldRev,
    ).toBe(WORLD_REV_EXPLORE);
  });

  it('ExplorationProgress ignora datos ajenos y marca la página una vez', () => {
    const p = new ExplorationProgress();
    expect(p.readPage()).toBe(true);
    expect(p.readPage()).toBe(false);
    const q = new ExplorationProgress();
    q.restore({ pageRead: 'sí' });
    expect(q.pageRead).toBe(false);
    q.restore(p.snapshot());
    expect(q.pageRead).toBe(true);
  });
});

describe('Revisión del mundo en cada entorno', () => {
  it('las partidas nuevas usan el subsuelo sólido; las revisiones anteriores se pueden forzar en desarrollo', () => {
    expect(worldRevFor(false, true, '?world=1')).toBe(4);
    expect(worldRevFor(true, true, '')).toBe(4);
    expect(worldRevFor(true, false, '')).toBe(4);
    expect(worldRevFor(true, true, '?world=2')).toBe(WORLD_REV_EXPLORE);
    expect(worldRevFor(true, false, '?world=1')).toBe(WORLD_REV_LEGACY);
    expect(worldRevFor(true, false, '?world=3')).toBe(3);
    expect(worldRevFor(true, false, '?world=4')).toBe(4);
  });
});
