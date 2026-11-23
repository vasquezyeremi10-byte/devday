import { describe, expect, it } from 'vitest';
import { LEGACY_COLUMNS, WORLD, WORLD_SPAN } from '../config/constants';
import { SURVIVAL } from '../config/survival';
import { createInitialTerrain, DEFAULT_SEED } from '../world/Geology';
import { Block, TerrainGrid, TUNNEL } from '../world/TerrainGrid';
import { CYCLE_MS, DAY_MS, DayNightCycle } from './DayNightCycle';
import { GameSession } from './GameSession';
import { decodeSave, encodeSave } from './SaveSystem';
import { halvesOf, SurvivalSystem, unitsOf } from './SurvivalSystem';

const session = () => {
  const s = new GameSession(createInitialTerrain(DEFAULT_SEED), DEFAULT_SEED);
  s.mode = 'normal';
  s.modeChosen = true;
  return s;
};

describe('V8: energía y alimentación', () => {
  it('cinco unidades de 20 puntos; cero solo con cero real', () => {
    expect(unitsOf(100)).toBe(5);
    expect(unitsOf(81)).toBe(5);
    expect(unitsOf(80)).toBe(4);
    expect(unitsOf(1)).toBe(1);
    expect(unitsOf(0)).toBe(0);
    expect(halvesOf(50)).toBe(5);
    expect(halvesOf(55)).toBe(6);
  });

  it('picar gasta 4 puntos: se excavan 25 bloques antes del agotamiento', () => {
    const s = new SurvivalSystem();
    let blocks = 0;
    while (!s.exhausted) {
      s.exert(SURVIVAL.effort.pick);
      blocks++;
    }
    expect(blocks).toBe(25);
    expect(s.takeDamage().agotamiento).toBe(0);
    // Sin energía, el esfuerzo cuesta salud de a poco (no muerte inmediata).
    s.exert(SURVIVAL.effort.pick);
    expect(s.takeDamage().agotamiento).toBe(
      SURVIVAL.effort.pick * SURVIVAL.exhaustionDamagePerPoint,
    );
  });

  it('caminar consume lento y quieto no consume energía', () => {
    const s = new SurvivalSystem();
    s.tick(60_000, { walking: false, pushingLoaded: false });
    expect(s.energy).toBe(100);
    s.tick(60_000, { walking: true, pushingLoaded: false });
    expect(s.energy).toBeCloseTo(100 - SURVIVAL.walkPerSecond * 60);
    expect(s.energyUnits).toBe(5);
  });

  it('el hambre baja más lento que la energía y daña tras la gracia', () => {
    const s = new SurvivalSystem();
    s.tick(4 * 60_000, { walking: false, pushingLoaded: false });
    expect(s.hungerUnits).toBe(4);
    s.hunger = 0.001;
    s.tick(1000, { walking: false, pushingLoaded: false });
    expect(s.starving).toBe(true);
    s.tick(SURVIVAL.starveGraceMs - 1000, { walking: false, pushingLoaded: false });
    expect(s.takeDamage().hambre).toBe(0);
    s.tick(10_000, { walking: false, pushingLoaded: false });
    // La fracción inicial de alimento retrasa unos milisegundos el daño.
    expect(s.takeDamage().hambre).toBeCloseTo(
      (10 - 0.001 / SURVIVAL.hungerPerSecond) * SURVIVAL.starveDamagePerSecond,
    );
    expect(s.regenAllowed).toBe(false);
    // Comer detiene la pérdida de salud.
    s.consume('empanada');
    s.tick(10_000, { walking: false, pushingLoaded: false });
    expect(s.takeDamage().hambre).toBe(0);
    expect(s.starvingMs).toBe(0);
  });

  it('dormir recupera la energía pero gasta el hambre del tiempo dormido', () => {
    const s = new SurvivalSystem();
    s.energy = 10;
    s.sleep(DAY_MS, { playMs: 0, clockMs: DAY_MS, woke: 'night' });
    expect(s.energy).toBe(100);
    expect(s.hunger).toBeCloseTo(100 - (DAY_MS / 1000) * SURVIVAL.hungerPerSecond);
    expect(s.lastSleep?.woke).toBe('night');
    s.hunger = 0;
    expect(s.canSleep()).toMatch(/HAMBRE/);
  });

  it('los alimentos no superan el máximo ni se gastan si no sirven', () => {
    const g = session();
    g.supplies.cola = 2;
    g.supplies.sandwich = 1;
    expect(g.eat('cola').ok).toBe(false);
    g.survival.energy = 90;
    const drink = g.eat('cola');
    expect(drink).toEqual({ ok: true, message: '+0.5 ENERGIA' });
    expect(g.survival.energy).toBe(100);
    expect(g.supplies.cola).toBe(1);
    g.survival.hunger = 30;
    expect(g.eat('sandwich').message).toBe('+3 ALIMENTACION');
    expect(g.survival.hunger).toBe(90);
    expect(g.eat('sandwich').ok).toBe(false);
  });

  it('la bodega vende los tres alimentos al precio indicado', () => {
    const g = session();
    g.money = 25;
    expect(g.buy('cola')).toBe('COMPRA REALIZADA');
    expect(g.buy('empanada')).toBe('COMPRA REALIZADA');
    expect(g.buy('sandwich')).toBe('COMPRA REALIZADA');
    expect(g.money).toBe(0);
    expect([g.supplies.cola, g.supplies.empanada, g.supplies.sandwich]).toEqual([
      1, 1, 1,
    ]);
  });
});

describe('V8: dormir cambia la fase del ciclo', () => {
  it('de día despierta al comienzo de la noche y de noche al amanecer', () => {
    const d = new DayNightCycle();
    d.elapsedMs = 100_000;
    expect(d.skipToNextPhase()).toEqual({ skippedMs: DAY_MS - 100_000, woke: 'night' });
    expect(d.phase).toBe('night');
    expect(d.phaseProgress).toBe(0);
    d.elapsedMs = DAY_MS + 120_000;
    expect(d.skipToNextPhase().woke).toBe('day');
    expect(d.elapsedMs).toBe(0);
    expect(d.isDay).toBe(true);
    d.tick(1000);
    expect(d.elapsedMs).toBe(1000);
    expect(CYCLE_MS).toBe(600_000);
  });

  it('dormir no toca dinero, inventario, experiencia ni estadísticas', () => {
    const g = session();
    g.money = 77;
    g.inventory.add('coal');
    g.stats.playMs = 12_345;
    const xp = g.progression.xp;
    g.survival.energy = 5;
    const r = g.sleep();
    expect(r.woke).toBe('night');
    expect(g.money).toBe(77);
    expect(g.inventory.items).toEqual(['coal']);
    expect(g.progression.xp).toBe(xp);
    expect(g.stats.playMs).toBe(12_345);
    expect(g.survival.energy).toBe(100);
  });
});

describe('V8: mundo ampliado', () => {
  it('las 80 columnas originales no cambian y los muros de lecho se abren', () => {
    const grid = createInitialTerrain(DEFAULT_SEED);
    // Mundo abierto: la cuadrícula llega del borde oeste al borde este.
    expect(grid.columns).toBe(WORLD_SPAN);
    expect(grid.end).toBe(WORLD.columns);
    // Bocamina y galería intactas.
    for (let c = TUNNEL.fromColumn; c <= TUNNEL.toColumn; c++)
      expect(grid.get(c, TUNNEL.bottomRow)).toBe(Block.Air);
    // Sin barrera artificial tras la columna 79.
    for (const c of [0, LEGACY_COLUMNS - 1, LEGACY_COLUMNS])
      expect(grid.get(c, 15)).not.toBe(Block.Bedrock);
    expect(grid.get(WORLD.columns - 1, 15)).toBe(Block.Bedrock);
    expect(grid.get(50, WORLD.rows - 1)).toBe(Block.Bedrock);
  });

  it('el campamento tiene cielo sobre la superficie y su suelo se excava', () => {
    const grid = createInitialTerrain(DEFAULT_SEED);
    expect(grid.get(-5, 9)).toBe(Block.Air);
    expect(grid.contains(-5, 10)).toBe(true);
    expect([Block.Dirt, Block.Rock]).toContain(grid.get(-5, 10));
    grid.set(-5, 10, Block.Air);
    expect(grid.isSolid(-5, 10)).toBe(false);
    // Cuadrículas de prueba conservan el borde sólido.
    expect(new TerrainGrid(10, 10).get(-1, 0)).toBe(Block.Bedrock);
  });

  it('guardar y cargar conserva energía, hambre, último descanso y pabellón', () => {
    const g = session();
    g.survival.energy = 37;
    g.survival.hunger = 52;
    g.sleep();
    g.survival.energy = 61;
    g.supplies.empanada = 3;
    g.inCabin = true;
    const raw = encodeSave(g, { x: -300, y: 148 });
    expect(JSON.parse(raw).version).toBe(6);
    const back = decodeSave(raw)!;
    expect(back.player).toEqual({ x: -300, y: 148 });
    expect(back.session.survival.energy).toBe(61);
    expect(back.session.survival.hunger).toBeCloseTo(g.survival.hunger, 1);
    expect(back.session.survival.lastSleep?.woke).toBe('night');
    expect(back.session.supplies.empanada).toBe(3);
    expect(back.session.inCabin).toBe(true);
    expect(back.session.dayNight.elapsedMs).toBe(DAY_MS);
  });

  it('una partida V5 (80 columnas) se migra conservando excavaciones', () => {
    const g = session();
    g.grid.set(30, 14, Block.Air);
    g.grid.set(70, 20, Block.Air);
    g.visibility.reveal(30, 14);
    const v6 = JSON.parse(encodeSave(g, { x: 208, y: 148 }));
    // Reconstruir el formato V5: índices con 80 columnas y sin datos V8.
    const v5 = { ...v6, version: 5 };
    delete v5.v8;
    delete v5.left;
    v5.terrain = v6.terrain.map(([i, b]: [number, number]) => [
      Math.floor(i / v6.columns) * LEGACY_COLUMNS + (i % v6.columns) + v6.left,
      b,
    ]);
    const bytes = new Uint8Array(Math.ceil((LEGACY_COLUMNS * WORLD.rows) / 8));
    for (let r = 0; r < WORLD.rows; r++)
      for (let c = 0; c < LEGACY_COLUMNS; c++)
        if (g.visibility.has(c, r)) {
          const i = r * LEGACY_COLUMNS + c;
          bytes[i >> 3]! |= 1 << (i & 7);
        }
    v5.revealed = btoa(String.fromCharCode(...bytes));
    const back = decodeSave(JSON.stringify(v5))!;
    expect(back).not.toBeNull();
    expect(back.migrated).toMatch(/MUNDO AMPLIADO/);
    expect(back.session.grid.get(30, 14)).toBe(Block.Air);
    expect(back.session.grid.get(70, 20)).toBe(Block.Air);
    expect(back.session.visibility.has(30, 14)).toBe(true);
    expect(back.session.survival.energy).toBe(100);
    expect(back.session.survival.hunger).toBe(100);
  });
});
