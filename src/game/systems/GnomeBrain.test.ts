import { describe, expect, it } from 'vitest';
import { GNOME_AI } from '../config/gnomeAI';
import {
  GNOME_ANIMATIONS,
  GNOME_IMPACT_FRAME,
  gnomeClipMs,
  gnomeFrameAt,
} from '../config/gnomeAnimations';
import { GnomeBrain, type GnomeInput, type GnomeOutput } from './GnomeBrain';

const FLAT = { wall: false, step: false, drop: 0 };
const base = (over: Partial<GnomeInput> = {}): GnomeInput => ({
  dt: 16,
  x: 100,
  grounded: true,
  seen: null,
  inReach: false,
  left: FLAT,
  right: FLAT,
  ...over,
});

/** Avanza `ms` en pasos de 16 ms y devuelve todas las salidas. */
function run(
  brain: GnomeBrain,
  ms: number,
  over: Partial<GnomeInput> = {},
): GnomeOutput[] {
  const out: GnomeOutput[] = [];
  for (let t = 0; t < ms; t += 16) out.push(brain.tick(base(over)));
  return out;
}

/** Azar fijo para que las pruebas sean deterministas. */
const fixed = (value: number) => () => value;

describe('GnomeBrain: detección y combate', () => {
  it('al ver al minero se alerta, persigue y ataca solo dentro del alcance', () => {
    const brain = new GnomeBrain(100, fixed(0.9));
    brain.tick(base({ seen: 180 }));
    expect(brain.state).toBe('ALERT');
    expect(brain.facing).toBe(1);
    run(brain, gnomeClipMs('alert'), { seen: 180 });
    expect(brain.state).toBe('CHASE');
    const chase = brain.tick(base({ seen: 180 }));
    expect(chase.vx).toBe(GNOME_AI.chaseSpeed);
    expect(chase.animation).toBe('run');
    brain.tick(base({ seen: 130, inReach: true }));
    expect(brain.state).toBe('ATTACK');
  });

  it('el golpe sale una sola vez, exactamente en el cuadro de impacto', () => {
    const brain = new GnomeBrain(100, fixed(0.9));
    run(brain, gnomeClipMs('alert') + 32, { seen: 130 });
    brain.tick(base({ seen: 130, inReach: true }));
    expect(brain.state).toBe('ATTACK');
    const strikes: GnomeOutput[] = [];
    let frames: number[] = [];
    for (let t = 0; t < gnomeClipMs('attack'); t += 8) {
      const out = brain.tick(base({ dt: 8, seen: 130, inReach: true }));
      if (out.animation === 'attack') frames.push(out.frame);
      if (out.strike) strikes.push(out);
    }
    expect(strikes).toHaveLength(1);
    expect(strikes[0]!.frame).toBe(GNOME_IMPACT_FRAME.attack);
    // Antes del golpe solo hubo cuadros de preparación.
    frames = frames.slice(0, frames.indexOf(GNOME_IMPACT_FRAME.attack));
    expect(Math.max(...frames)).toBeLessThan(GNOME_IMPACT_FRAME.attack);
    expect(brain.state).toBe('RECOVER');
  });

  it('si pierde de vista al minero, busca en su última posición y vuelve a lo suyo', () => {
    const brain = new GnomeBrain(100, fixed(0.9));
    run(brain, gnomeClipMs('alert') + 32, { seen: 200 });
    expect(brain.state).toBe('CHASE');
    run(brain, GNOME_AI.lostSightMs + 32);
    expect(brain.state).toBe('SEARCH');
    expect(brain.lastKnown).toBe(200);
    const walking = brain.tick(base());
    expect(walking.vx).toBeGreaterThan(0);
    // Ya en el lugar: mira alrededor, se da vuelta y termina tranquilo.
    const look = run(brain, GNOME_AI.searchMs, { x: 199 });
    expect(look.some((o) => o.animation === 'look')).toBe(true);
    expect(new Set(look.map((o) => o.facing)).size).toBe(2);
    expect(brain.state).toBe('IDLE');
    expect(brain.home).toBe(199);
  });

  it('al volver a ver al minero poco después no repite la alerta', () => {
    const brain = new GnomeBrain(100, fixed(0.9));
    run(brain, gnomeClipMs('alert') + 32, { seen: 200 });
    run(brain, GNOME_AI.lostSightMs + 32);
    expect(brain.state).toBe('SEARCH');
    brain.tick(base({ seen: 160 }));
    expect(brain.state).toBe('CHASE');
  });
});

describe('GnomeBrain: respeta la geometría de la mina', () => {
  it('salta un escalón de un bloque, se detiene ante una pared alta', () => {
    const brain = new GnomeBrain(100, fixed(0.9));
    run(brain, gnomeClipMs('alert') + 32, { seen: 200 });
    const step = brain.tick(
      base({ seen: 200, right: { wall: true, step: true, drop: 0 } }),
    );
    expect(step.jump).toBe(true);
    const wall = brain.tick(
      base({ seen: 200, right: { wall: true, step: false, drop: 0 } }),
    );
    expect(wall).toMatchObject({ vx: 0, jump: false });
    // En el aire no vuelve a saltar.
    const air = brain.tick(
      base({
        seen: 200,
        grounded: false,
        right: { wall: true, step: true, drop: 0 },
      }),
    );
    expect(air.jump).toBe(false);
  });

  it('no se lanza a una caída grande al perseguir', () => {
    const brain = new GnomeBrain(100, fixed(0.9));
    run(brain, gnomeClipMs('alert') + 32, { seen: 200 });
    const deep = brain.tick(
      base({
        seen: 200,
        right: { wall: false, step: false, drop: GNOME_AI.maxChaseDrop + 1 },
      }),
    );
    expect(deep.vx).toBe(0);
    const shallow = brain.tick(
      base({ seen: 200, right: { wall: false, step: false, drop: 1 } }),
    );
    expect(shallow.vx).toBeGreaterThan(0);
  });

  it('patrullando nunca cae por un borde: se da vuelta', () => {
    const brain = new GnomeBrain(100, fixed(0.5));
    // Reposo y luego patrulla (azar 0,5 → PATROL sin girar).
    run(brain, GNOME_AI.idleMs[1] + 32);
    expect(brain.state).toBe('PATROL');
    const facing = brain.facing;
    const edge = { wall: false, step: false, drop: 2 };
    const out = brain.tick(base(facing > 0 ? { right: edge } : { left: edge }));
    expect(out.vx).toBe(0);
    expect(brain.facing).toBe(-facing);
    expect(brain.state).toBe('IDLE');
  });

  it('ante una pared examina y pica la roca, con un impacto por golpe', () => {
    const brain = new GnomeBrain(100, fixed(0.1));
    const wall = { wall: true, step: false, drop: 0 };
    const out: GnomeOutput[] = [];
    for (let t = 0; t < GNOME_AI.idleMs[1] && brain.state !== 'MINE'; t += 16)
      out.push(brain.tick(base({ right: wall, left: wall })));
    expect(brain.state).toBe('MINE');
    const mining = run(brain, gnomeClipMs('mine') * 3 + 64, {
      right: wall,
      left: wall,
    });
    const hits = mining.filter((o) => o.mineHit);
    expect(hits.length).toBeGreaterThanOrEqual(GNOME_AI.mineSwings[0]);
    expect(hits.every((o) => o.frame === GNOME_IMPACT_FRAME.mine)).toBe(true);
    expect(out.every((o) => !o.strike)).toBe(true);
  });

  it('oye excavar y va a inspeccionar el ruido', () => {
    const brain = new GnomeBrain(100, fixed(0.9));
    brain.hear(40);
    expect(brain.state).toBe('SEARCH');
    const out = brain.tick(base());
    expect(out.vx).toBeLessThan(0);
    expect(out.facing).toBe(-1);
  });
});

describe('GnomeBrain: daño, furia, huida y muerte', () => {
  it('herido se vuelve hacia el agresor, se enfurece y luego huye', () => {
    const brain = new GnomeBrain(100, fixed(0.9));
    brain.hurt(60, 100, 0.8);
    expect(brain.state).toBe('HURT');
    expect(brain.facing).toBe(-1);
    run(brain, gnomeClipMs('hurt') + 32);
    expect(brain.state).toBe('SEARCH');
    brain.hurt(60, 100, 0.5);
    run(brain, gnomeClipMs('hurt') + 16);
    expect(brain.state).toBe('RAGE');
    expect(brain.enraged).toBe(true);
    run(brain, gnomeClipMs('rage') + 16, { seen: 60 });
    expect(brain.state).toBe('CHASE');
    expect(brain.tick(base({ seen: 60 })).vx).toBe(
      -GNOME_AI.chaseSpeed * GNOME_AI.rageSpeedFactor,
    );
    brain.hurt(60, 100, 0.2);
    run(brain, gnomeClipMs('hurt') + 16, { seen: 60 });
    expect(brain.state).toBe('FLEE');
    expect(brain.tick(base({ seen: 60 })).vx).toBeGreaterThan(0);
  });

  it('golpes seguidos no lo dejan aturdido para siempre: responde', () => {
    // El minero pega cada 360 ms (GNOME.playerAttackMs) pegado al gnomo.
    const brain = new GnomeBrain(100, fixed(0.9));
    run(brain, gnomeClipMs('alert') + 32, { seen: 120 });
    let strikes = 0;
    let staggers = 0;
    for (let t = 0; t < 6000; t += 16) {
      if (t % 368 === 0) {
        brain.hurt(120, 100, 0.9);
        if (brain.state === 'HURT') staggers += 1;
      }
      if (brain.tick(base({ seen: 120, inReach: true })).strike) strikes += 1;
    }
    expect(strikes).toBeGreaterThanOrEqual(2);
    // Sigue acusando golpes: no se vuelve inmune.
    expect(staggers).toBeGreaterThanOrEqual(4);
  });

  it('un golpe suelto lo sigue interrumpiendo, incluso a mitad de su ataque', () => {
    const brain = new GnomeBrain(100, fixed(0.9));
    run(brain, gnomeClipMs('alert') + 32, { seen: 120 });
    brain.tick(base({ seen: 120, inReach: true }));
    expect(brain.state).toBe('ATTACK');
    expect(brain.hurt(120, 100, 0.9)).toBe(true);
    expect(brain.state).toBe('HURT');
  });

  it('con la guardia alzada recibe el daño sin interrumpir su ataque', () => {
    const brain = new GnomeBrain(100, fixed(0.9));
    run(brain, gnomeClipMs('alert') + 32, { seen: 120 });
    brain.hurt(120, 100, 0.9);
    run(brain, 100, { seen: 120 });
    brain.hurt(120, 100, 0.9);
    expect(brain.armored).toBe(true);
    run(brain, gnomeClipMs('hurt') + 16, { seen: 120 });
    brain.tick(base({ seen: 120, inReach: true }));
    expect(brain.state).toBe('ATTACK');
    expect(brain.hurt(120, 100, 0.9)).toBe(false);
    expect(brain.state).toBe('ATTACK');
    // La guardia no impide enfurecerse ni morir.
    expect(brain.hurt(120, 100, 0.5)).toBe(true);
    expect(brain.state).toBe('HURT');
    brain.hurt(120, 100, 0);
    expect(brain.dead).toBe(true);
    // Termina y vuelve a acusar golpes.
    const fresh = new GnomeBrain(100, fixed(0.9));
    fresh.hurt(120, 100, 0.9);
    fresh.hurt(120, 100, 0.9);
    run(fresh, GNOME_AI.poise.armorMs + 16, { seen: 120 });
    expect(fresh.armored).toBe(false);
    expect(fresh.hurt(120, 100, 0.9)).toBe(true);
  });

  it('muere con su animación completa y deja de percibir', () => {
    const brain = new GnomeBrain(100, fixed(0.9));
    brain.hurt(60, 100, 0);
    expect(brain.dead).toBe(true);
    brain.hear(20);
    const out = run(brain, gnomeClipMs('death') - 32, {
      seen: 120,
      inReach: true,
    });
    expect(
      out.every((o) => o.animation === 'death' && !o.strike && o.vx === 0),
    ).toBe(true);
    expect(out.some((o) => o.done)).toBe(false);
    expect(run(brain, 64).some((o) => o.done)).toBe(true);
  });
});

describe('Tiempos de las animaciones', () => {
  it('la muerte sostiene el cuerpo caído antes de disolverse', () => {
    expect(gnomeFrameAt('death', 550)).toBe(5);
    expect(gnomeFrameAt('death', 1400)).toBe(5);
    expect(gnomeFrameAt('death', 1550)).toBe(6);
    expect(gnomeFrameAt('death', 5000)).toBe(7);
  });
  it('los bucles se repiten y los demás quedan en su último cuadro', () => {
    expect(gnomeFrameAt('walk', gnomeClipMs('walk') + 1)).toBe(0);
    expect(gnomeFrameAt('attack', 10_000)).toBe(
      GNOME_ANIMATIONS.attack.count - 1,
    );
  });
});
