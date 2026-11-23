import { describe, expect, it } from 'vitest';
import {
  CYCLE_MS,
  DAY_MS,
  DayNightCycle,
  MOON_TINT,
  MOON_TINT_SOFT,
  NIGHT_LIGHT,
  NIGHT_MS,
  START_MS,
} from './DayNightCycle';

/** Avanza en pasos de fotograma (60 FPS por defecto). */
const run = (cycle: DayNightCycle, ms: number, step = 1000 / 60) => {
  for (let t = 0; t < ms; t += step) cycle.tick(Math.min(step, ms - t));
};

describe('DayNightCycle V7', () => {
  it('dura 10 minutos: 5 de día y 5 de noche', () => {
    expect(DAY_MS).toBe(300_000);
    expect(NIGHT_MS).toBe(300_000);
    expect(CYCLE_MS).toBe(600_000);
    const c = new DayNightCycle();
    c.restore(0);
    expect(c.phase).toBe('dawn');
    run(c, 60_000);
    expect(c.phase).toBe('day');
    run(c, 200_000);
    expect(c.phase).toBe('sunset');
    run(c, 40_000 + 1);
    expect(c.phase).toBe('night');
    run(c, NIGHT_MS - 2);
    expect(c.phase).toBe('night');
    run(c, 2);
    expect(c.phase).toBe('dawn');
  });

  it('no depende de los FPS', () => {
    const fast = new DayNightCycle(),
      slow = new DayNightCycle();
    run(fast, 123_456, 1000 / 144);
    run(slow, 123_456, 1000 / 30);
    expect(Math.abs(fast.elapsedMs - slow.elapsedMs)).toBeLessThan(1e-6);
  });

  it('una expedición nueva empieza de mañana, con luz plena', () => {
    const c = new DayNightCycle();
    expect(c.elapsedMs).toBe(START_MS);
    expect(c.phase).toBe('day');
    expect(c.daylight).toBe(1);
  });

  it('respeta la pausa y descarta tiempos inválidos', () => {
    const c = new DayNightCycle();
    c.restore(0);
    c.tick(5000, true);
    c.tick(Number.NaN);
    c.tick(-20);
    expect(c.elapsedMs).toBe(0);
    // Un salto enorme (pestaña congelada) no adelanta minutos de golpe.
    c.tick(90_000);
    expect(c.elapsedMs).toBe(1000);
  });

  it('las transiciones son graduales', () => {
    const c = new DayNightCycle();
    c.restore(0);
    let previous = c.daylight;
    let biggest = 0;
    for (let t = 0; t < CYCLE_MS; t += 250) {
      c.restore(t);
      biggest = Math.max(biggest, Math.abs(c.daylight - previous));
      previous = c.daylight;
    }
    expect(biggest).toBeLessThan(0.02);
    c.restore(150_000);
    expect(c.daylight).toBe(1);
    c.restore(450_000);
    expect(c.daylight).toBe(NIGHT_LIGHT);
    expect(c.daylight).toBeGreaterThan(0.3);
  });

  it('el sol sube hasta mediodía, baja y desaparece de noche', () => {
    const c = new DayNightCycle();
    c.restore(10_000);
    const dawn = c.sun;
    c.restore(150_000);
    const noon = c.sun;
    c.restore(290_000);
    const dusk = c.sun;
    expect(noon.y).toBeLessThan(dawn.y);
    expect(dusk.y).toBeGreaterThan(noon.y);
    expect(dusk.x).toBeGreaterThan(noon.x);
    expect(noon.x).toBeGreaterThan(dawn.x);
    expect(c.moon.visible).toBe(false);
    c.restore(400_000);
    expect(c.sun.visible).toBe(false);
    expect(c.moon.visible).toBe(true);
  });

  it('estrellas y aves siguen la hora', () => {
    const c = new DayNightCycle();
    c.restore(150_000);
    expect(c.stars).toBe(0);
    expect(c.birdActivity).toBe(1);
    expect(c.warm).toBe(0);
    c.restore(280_000);
    expect(c.warm).toBeGreaterThan(0.5);
    c.restore(450_000);
    expect(c.stars).toBe(1);
    expect(c.birdActivity).toBeLessThan(0.2);
  });

  it('tinte: blanco de día, cálido al ocaso, azul luna de noche', () => {
    const c = new DayNightCycle();
    c.restore(150_000);
    expect(c.tint()).toBe(0xffffff);
    expect(c.tint(true)).toBe(0xffffff);
    c.restore(450_000);
    expect(c.tint()).toBe(MOON_TINT);
    expect(c.tint(true)).toBe(MOON_TINT_SOFT);
    // Los personajes quedan más claros que el mundo en cada canal.
    for (const shift of [16, 8, 0])
      expect((c.tint(true) >> shift) & 255).toBeGreaterThan(
        (c.tint() >> shift) & 255,
      );
    c.restore(277_500);
    const dusk = c.tint();
    expect((dusk >> 16) & 255).toBeGreaterThan(dusk & 255); // más rojo que azul
    // Cambia en escalones: de 1 200 muestras, pocos valores distintos.
    const seen = new Set<number>();
    for (let t = 0; t < CYCLE_MS; t += 500) {
      c.restore(t);
      seen.add(c.tint());
    }
    expect(seen.size).toBeLessThan(120);
  });

  it('se guarda y se recupera', () => {
    const c = new DayNightCycle();
    run(c, 333_000, 50);
    const copy = new DayNightCycle();
    copy.restore(JSON.parse(JSON.stringify(c.elapsedMs)));
    expect(copy.phase).toBe('night');
    expect(copy.elapsedMs).toBeCloseTo(c.elapsedMs, 6);
    // Partida anterior a V7 (sin reloj) o dato dañado: mañana.
    copy.restore(undefined);
    expect(copy.elapsedMs).toBe(START_MS);
    copy.restore('roto');
    expect(copy.elapsedMs).toBe(START_MS);
    copy.restore(CYCLE_MS + 10);
    expect(copy.elapsedMs).toBe(10);
  });
});
