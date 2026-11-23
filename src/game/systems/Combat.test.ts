import { describe, expect, it } from 'vitest';
import {
  AttackTimer,
  GNOME,
  STRIKE_FEEL,
  canHitGnome,
  knockbackVelocity,
  weaponDamage,
} from './Combat';

describe('combate contra gnomo', () => {
  it('cada herramienta en mano tiene fuerza propia', () => {
    expect(
      ['iron', 'tungsten', 'axe', 'shovel', 'drill'].map((kind) =>
        weaponDamage(kind as Parameters<typeof weaponDamage>[0]),
      ),
    ).toEqual([18, 24, 20, 12, 16]);
    expect(weaponDamage(undefined)).toBe(7);
  });

  it('solo alcanza al objetivo cercano frente al minero', () => {
    expect(canHitGnome(100, 100, 1, 125, 100)).toBe(true);
    expect(canHitGnome(100, 100, 1, 65, 100)).toBe(false);
    expect(canHitGnome(100, 100, 1, 125, 130)).toBe(false);
    expect(canHitGnome(100, 100, -1, 78, 100)).toBe(true);
  });
});

describe('cadencia del golpe del minero', () => {
  const cooldown = GNOME.playerAttackMs;

  it('golpea al pulsar y respeta la espera entre golpes', () => {
    const timer = new AttackTimer();
    expect(timer.press(1000)).toBe(true);
    expect(timer.press(1100)).toBe(false);
    // La pulsación de 1100 ya no está dentro del margen al terminar la espera.
    expect(timer.poll(1000 + cooldown)).toBe(false);
    expect(timer.press(1000 + cooldown)).toBe(true);
  });

  it('guarda una pulsación hecha poco antes de poder golpear', () => {
    const timer = new AttackTimer();
    timer.press(0);
    const early = cooldown - STRIKE_FEEL.bufferMs + 20;
    expect(timer.press(early)).toBe(false);
    expect(timer.poll(cooldown - 1)).toBe(false);
    expect(timer.poll(cooldown)).toBe(true);
    // Sale una sola vez y reinicia la espera.
    expect(timer.poll(cooldown + 1)).toBe(false);
    expect(timer.press(cooldown + 10)).toBe(false);
  });

  it('no adelanta la cadencia aunque se pulse sin parar', () => {
    const timer = new AttackTimer();
    let hits = 0;
    for (let t = 0; t < 3000; t += 16) {
      if (timer.press(t) || timer.poll(t)) hits += 1;
    }
    expect(hits).toBeLessThanOrEqual(Math.ceil(3000 / cooldown));
  });

  it('reset olvida la espera y la pulsación guardada', () => {
    const timer = new AttackTimer();
    timer.press(0);
    timer.press(cooldown - 50);
    timer.reset();
    expect(timer.poll(cooldown)).toBe(false);
    expect(timer.press(10)).toBe(true);
  });
});

describe('empuje del minero golpeado', () => {
  it('empieza con toda la fuerza y se apaga solo', () => {
    expect(knockbackVelocity(150, 0)).toBe(150);
    expect(knockbackVelocity(-150, STRIKE_FEEL.knockbackMs / 2)).toBe(-75);
    expect(knockbackVelocity(150, STRIKE_FEEL.knockbackMs)).toBe(0);
    expect(knockbackVelocity(150, -10)).toBe(0);
  });
});
