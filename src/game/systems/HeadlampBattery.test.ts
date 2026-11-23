import { describe, expect, it } from 'vitest';
import { LIGHTING } from '../config/lighting';
import { SUPPLIES } from '../config/balance';
import { createInitialTerrain, DEFAULT_SEED } from '../world/Geology';
import { GameSession } from './GameSession';
import { HeadlampBattery } from './HeadlampBattery';

const session = () =>
  new GameSession(createInitialTerrain(DEFAULT_SEED), DEFAULT_SEED);

/** Consumo en ms para bajar de 100 a 0 (15 min de uso efectivo). */
const DURATION = LIGHTING.battery.durationMs;

describe('Batería de la linterna del casco', () => {
  it('dura 15 minutos de uso efectivo y consume por delta (sin importar los FPS)', () => {
    const b = new HeadlampBattery();
    // 15 min en un solo paso o en pasos de 16 ms: mismo resultado.
    b.tick(DURATION, true);
    expect(b.charge).toBe(0);
    const step = new HeadlampBattery();
    for (let t = 0; t < DURATION; t += 16) step.tick(16, true);
    expect(step.charge).toBeCloseTo(0, 4);
    // La mitad del tiempo gasta la mitad de la carga.
    const half = new HeadlampBattery();
    half.tick(DURATION / 2, true);
    expect(half.charge).toBeCloseTo(50, 4);
  });

  it('solo gasta con el haz encendido; pausa y menús no consumen', () => {
    const b = new HeadlampBattery();
    b.tick(60_000, false);
    expect(b.charge).toBe(100);
    // La escena no llama tick con el juego pausado: un tick de 0 no hace nada.
    b.tick(0, true);
    expect(b.charge).toBe(100);
    b.tick(60_000, true);
    expect(b.charge).toBeCloseTo(100 - (60_000 / DURATION) * 100, 4);
  });

  it('avisa una sola vez al cruzar 20% y una sola vez al llegar a 0%', () => {
    const b = new HeadlampBattery();
    b.tick((1 - LIGHTING.battery.warnAt / 100) * DURATION, true);
    expect(b.low).toBe(true);
    expect(b.takeLowNotice()).toBe(true);
    expect(b.takeLowNotice()).toBe(false);
    // Seguir bajando dentro del umbral no repite el aviso.
    b.tick(10_000, true);
    expect(b.takeLowNotice()).toBe(false);
    b.tick(DURATION, true);
    expect(b.empty).toBe(true);
    expect(b.takeDrainedNotice()).toBe(true);
    expect(b.takeDrainedNotice()).toBe(false);
  });

  it('con 0% la linterna queda fuera de servicio hasta reemplazarla', () => {
    const b = new HeadlampBattery();
    b.tick(DURATION + 10_000, true);
    expect(b.empty).toBe(true);
    b.tick(60_000, true); // sin carga no sigue gastando ni se vuelve negativa
    expect(b.charge).toBe(0);
  });

  it('el reemplazo consume exactamente un repuesto y devuelve el 100%', () => {
    const s = session();
    s.supplies.battery = 2;
    s.headlamp.tick(DURATION / 2, true);
    expect(s.headlamp.charge).toBeCloseTo(50, 4);
    expect(s.replaceHeadlamp()).toContain('BATERIA REEMPLAZADA');
    expect(s.supplies.battery).toBe(1);
    expect(s.headlamp.charge).toBe(100);
    expect(s.headlamp.empty).toBe(false);
  });

  it('sin repuestos muestra el mensaje y no toca la carga', () => {
    const s = session();
    s.headlamp.tick(DURATION / 4, true);
    expect(s.replaceHeadlamp()).toContain('NO TIENES BATERIAS');
    expect(s.headlamp.charge).toBeCloseTo(75, 4);
  });

  it('con la carga llena no desperdicia un repuesto (sin dobles cambios)', () => {
    const s = session();
    s.supplies.battery = 3;
    expect(s.replaceHeadlamp()).toContain('AUN ESTA CARGADA');
    expect(s.supplies.battery).toBe(3);
    expect(s.headlamp.charge).toBe(100);
  });

  it('el interruptor manual alterna y se conserva en el guardado', () => {
    const s = session();
    expect(s.toggleHeadlamp()).toBe('LINTERNA APAGADA');
    expect(s.headlamp.on).toBe(false);
    expect(s.toggleHeadlamp()).toBe('LINTERNA ENCENDIDA');
    s.headlamp.tick(DURATION / 2, true);
    const snapshot = s.headlamp.snapshot();
    const restored = new HeadlampBattery();
    restored.restore(snapshot);
    expect(restored.charge).toBeCloseTo(50, 2);
    expect(restored.on).toBe(true);
    // Datos corruptos o ausentes: carga completa, como las partidas antiguas.
    restored.restore(undefined);
    expect(restored.charge).toBe(100);
    restored.restore({ charge: 999, on: 'no' });
    expect(restored.charge).toBe(100);
    expect(restored.on).toBe(true);
  });

  it('la tienda vende BATERIA DE CASCO a 10 monedas en ILUMINACION', () => {
    expect(SUPPLIES.battery.price).toBe(10);
    expect(SUPPLIES.battery.category).toBe('ILUMINACION');
    const s = session();
    s.money = SUPPLIES.battery.price;
    expect(s.buy('battery')).toBe('COMPRA REALIZADA');
    expect(s.supplies.battery).toBe(1);
    // Sin saldo no hay compra.
    expect(s.buy('battery')).toBe('SALDO INSUFICIENTE');
    expect(s.supplies.battery).toBe(1);
  });
});
