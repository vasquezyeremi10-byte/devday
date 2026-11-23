import { describe, expect, it } from 'vitest';
import { CRITTER, CritterBrain, type CritterInput } from './CritterBrain';

const FLAT = { wall: false, step: false, drop: 0 };
const base = (over: Partial<CritterInput> = {}): CritterInput => ({
  dt: 16,
  x: 100,
  grounded: true,
  miner: null,
  left: FLAT,
  right: FLAT,
  ...over,
});
const fixed = (v: number) => () => v;

describe('chinchilla del desierto', () => {
  it('sola, reposa y pasea cerca de su casa a paso lento', () => {
    const brain = new CritterBrain(100, fixed(0.3));
    let maxSpeed = 0;
    let walked = false;
    for (let t = 0; t < 8000; t += 16) {
      const out = brain.tick(base());
      maxSpeed = Math.max(maxSpeed, Math.abs(out.vx));
      if (out.anim === 'hop') walked = true;
      expect(out.visible).toBe(true);
    }
    expect(walked).toBe(true);
    expect(maxSpeed).toBeLessThanOrEqual(CRITTER.walkSpeed);
  });

  it('huye del minero en sentido contrario, más rápido que su carrera', () => {
    const brain = new CritterBrain(100, fixed(0.3));
    const out = brain.tick(base({ miner: { dx: 30, dy: 0 } }));
    expect(brain.state).toBe('flee');
    expect(out.vx).toBe(-CRITTER.runSpeed);
    expect(out.anim).toBe('run');
    expect(CRITTER.runSpeed).toBeGreaterThan(144);
    // Lejos del minero se calma y su casa pasa a ser donde quedó.
    brain.tick(base({ x: 20, miner: { dx: CRITTER.calmX + 10, dy: 0 } }));
    expect(brain.state).toBe('idle');
    expect(brain.home).toBe(20);
  });

  it('no se asusta de un minero en otro nivel (bajo tierra)', () => {
    const brain = new CritterBrain(100, fixed(0.3));
    brain.tick(base({ miner: { dx: 10, dy: 120 } }));
    expect(brain.state).not.toBe('flee');
  });

  it('un escalón no la detiene aunque esté en el aire: lo salta al pisar', () => {
    const brain = new CritterBrain(100, fixed(0.3));
    const step = { wall: true, step: true, drop: 0 };
    brain.tick(base({ miner: { dx: 30, dy: 0 } }));
    const air = brain.tick(base({ miner: { dx: 30, dy: 0 }, left: step, grounded: false }));
    expect(air.visible).toBe(true);
    expect(air.jump).toBe(false);
    const ground = brain.tick(base({ miner: { dx: 30, dy: 0 }, left: step }));
    expect(ground.jump).toBe(true);
    expect(ground.vx).toBe(-CRITTER.runSpeed);
  });

  it('acorralada da media vuelta; si vuelve a quedar acorralada se esconde y sale cuando el minero se fue', () => {
    const brain = new CritterBrain(100, fixed(0.3));
    const wall = { wall: true, step: false, drop: 0 };
    brain.tick(base({ miner: { dx: 30, dy: 0 } }));
    const turn = brain.tick(base({ miner: { dx: 30, dy: 0 }, left: wall }));
    expect(turn.visible).toBe(true);
    expect(turn.facing).toBe(1);
    const out = brain.tick(base({ miner: { dx: 30, dy: 0 }, left: wall, right: wall }));
    expect(out.vanished).toBe(true);
    expect(out.visible).toBe(false);
    // Mientras el minero siga cerca, no sale.
    for (let t = 0; t < CRITTER.hideMs[1] + 2000; t += 50)
      expect(brain.tick(base({ dt: 50, miner: { dx: 40, dy: 0 } })).visible).toBe(false);
    let back = false;
    for (let t = 0; t < CRITTER.hideMs[1] + 2000 && !back; t += 50)
      back = brain.tick(base({ dt: 50, miner: { dx: 400, dy: 0 } })).visible;
    expect(back).toBe(true);
  });

  it('salta escalones de un bloque y, tranquila, no baja barrancos', () => {
    const brain = new CritterBrain(100, fixed(0.1));
    const step = { wall: true, step: true, drop: 0 };
    const pit = { wall: false, step: false, drop: 2 };
    let jumped = false;
    let fell = false;
    for (let t = 0; t < 10000; t += 16) {
      const out = brain.tick(base({ left: step, right: pit }));
      if (out.jump) jumped = true;
      if (out.vx > 0) fell = true;
    }
    expect(jumped).toBe(true);
    expect(fell).toBe(false);
  });
});
