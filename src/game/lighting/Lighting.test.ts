import { describe, expect, it } from 'vitest';
import { HEADLAMP_RANGE, LIGHTING } from '../config/lighting';
import { createInitialTerrain } from '../world/Geology';
import { Block, TerrainGrid, TUNNEL } from '../world/TerrainGrid';
import { LAMPS } from '../systems/PlacedLights';
import { HeadlampLight, squareFalloff, squareReach } from './HeadlampLight';
import { solidLength, transmittance } from './LightOcclusion';
import { classifyZone, LightZone, SkyLightMap } from './LightingZones';

const at = (column: number, row: number) => ({
  x: column * 16 + 8,
  y: row * 16 + 8,
});

describe('Oclusión por tiles sólidos', () => {
  const grid = new TerrainGrid(8, 4);
  grid.set(2, 0, Block.Rock);
  it('mide la roca atravesada por el rayo', () => {
    expect(solidLength(grid, 8, 8, 56, 8)).toBeCloseTo(16);
    expect(solidLength(grid, 8, 8, 36, 8)).toBeCloseTo(4);
    expect(solidLength(grid, 8, 40, 56, 40)).toBe(0);
  });
  it('ilumina la cara del muro pero no el bloque de detrás', () => {
    const p = LIGHTING.headlamp.penetration;
    expect(transmittance(grid, 8, 8, 34, 8, p)).toBeCloseTo(1 - 2 / p);
    grid.set(3, 0, Block.Rock);
    expect(transmittance(grid, 8, 8, 56, 8, p)).toBe(0);
  });
  it('no se cuela por la esquina entre dos sólidos en diagonal', () => {
    const g = new TerrainGrid(4, 4);
    g.set(1, 0, Block.Rock);
    g.set(0, 1, Block.Rock);
    expect(solidLength(g, 8, 8, 24, 24)).toBe(Infinity);
    expect(transmittance(g, 8, 8, 24, 24, 14)).toBe(0);
  });
});

describe('Luz natural y zonas', () => {
  const grid = createInitialTerrain();
  const sky = new SkyLightMap(grid.columns, grid.rows);
  sky.compute(grid);
  it('la superficie está iluminada y las capas subterráneas ocultas', () => {
    expect(sky.at(100, 40)).toBe(1);
    // Solo la cara expuesta recibe luz del día; un bloque más abajo, nada.
    expect(sky.at(100, 161)).toBeGreaterThan(0.7);
    expect(sky.at(100, 160 + 16 + 2)).toBe(0);
  });
  it('la luz del día entra solo en parte en la bocamina', () => {
    const mouth = at(TUNNEL.fromColumn, 8),
      middle = at(TUNNEL.fromColumn + 2, 8),
      back = at(TUNNEL.toColumn, 8);
    const [a, b, c] = [mouth, middle, back].map((p) => sky.at(p.x, p.y));
    expect(a).toBeGreaterThan(b!);
    expect(b).toBeGreaterThan(c!);
    expect(a).toBeLessThan(1);
    expect(c).toBe(0);
  });
  it('no atraviesa el cerro: el techo de la galería se ve oscuro desde dentro', () => {
    const ceiling = TUNNEL.topRow * 16 - 2;
    expect(sky.at(TUNNEL.toColumn * 16 + 8, ceiling)).toBeLessThan(0.15);
  });
  it('una losa de un bloque no deja pasar luz a una cámara sellada', () => {
    const g = createInitialTerrain();
    g.set(5, 11, Block.Air);
    g.set(6, 11, Block.Air);
    const m = new SkyLightMap(g.columns, g.rows);
    m.compute(g);
    expect(m.at(88, 11 * 16 + 8)).toBe(0);
    expect(m.at(88, 10 * 16 + 14)).toBeLessThan(0.2);
    // Al excavar la losa, la luz entra en el nuevo hueco.
    g.set(5, 10, Block.Air);
    m.compute(g);
    expect(m.at(88, 11 * 16 + 8)).toBeGreaterThan(0.5);
  });
  it('clasifica superficie, entrada, galería y profundidad', () => {
    expect(classifyZone(1, 9)).toBe(LightZone.Surface);
    expect(classifyZone(0.4, 9)).toBe(LightZone.Entrance);
    expect(classifyZone(0, 12)).toBe(LightZone.Gallery);
    expect(classifyZone(0, LIGHTING.ambient.deepRow)).toBe(LightZone.Deep);
  });
});

describe('Luz radial del casco y antorcha 5×5', () => {
  const origin = { x: 100, y: 95 },
    body = { x: 100, y: 100 };
  it('el casco ilumina en círculo alrededor de la lámpara y se apaga con la distancia', () => {
    const lamp = new HeadlampLight();
    lamp.update(LIGHTING.headlamp.fadeMs / 2, true, origin, body, 1);
    expect(lamp.power).toBeCloseTo(0.5);
    lamp.update(LIGHTING.headlamp.fadeMs, true, origin, body, 1);
    expect(lamp.power).toBe(1);
    // Luz plena a menos de un bloque de la lámpara, en cualquier dirección.
    for (const [dx, dy] of [
      [0, 0],
      [12, 0],
      [-12, 0],
      [0, 12],
      [0, -12],
    ])
      expect(lamp.light(100 + dx!, 95 + dy!)).toBe(1);
    // Simétrica: igual delante, detrás, arriba y abajo a la misma distancia.
    const ring = [
      lamp.light(100 + 48, 95),
      lamp.light(100 - 48, 95),
      lamp.light(100, 95 + 48),
      lamp.light(100, 95 - 48),
    ];
    for (const v of ring) {
      expect(v).toBeCloseTo(ring[0]!, 9);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    }
    // Decae de forma continua y es redonda (la diagonal alcanza menos).
    const at = (d: number) => lamp.light(100 + d, 95);
    expect(at(32)).toBeGreaterThan(at(48));
    expect(at(48)).toBeGreaterThan(at(64));
    expect(at(64)).toBeGreaterThan(at(90));
    expect(at(90)).toBeGreaterThan(0);
    expect(lamp.light(100 + 80, 95 + 80)).toBe(0);
    expect(lamp.light(100 + HEADLAMP_RANGE + 1, 95)).toBe(0);
    lamp.update(1000, false, origin, body, 1);
    expect(lamp.power).toBe(0);
    expect(lamp.light(100, 95)).toBe(0);
  });
  it('mirar a la izquierda o a la derecha no cambia la luz', () => {
    const right = new HeadlampLight(),
      left = new HeadlampLight();
    right.update(LIGHTING.headlamp.fadeMs, true, origin, body, 1);
    left.update(LIGHTING.headlamp.fadeMs, true, origin, body, -1);
    for (const [x, y] of [
      [140, 95],
      [60, 95],
      [100, 150],
      [120, 70],
    ])
      expect(left.light(x!, y!)).toBe(right.light(x!, y!));
  });
  it('la antorcha ilumina 5×5 bloques y se desvanece 1,5 bloques', () => {
    expect(squareFalloff(40, 40, 5, 1.5)).toBe(1);
    expect(squareFalloff(-40, 0, 5, 1.5)).toBe(1);
    expect(squareFalloff(52, 0, 5, 1.5)).toBeCloseTo(0.5, 5);
    expect(squareFalloff(0, 64, 5, 1.5)).toBe(0);
    expect(LAMPS.torch.area).toBe(5);
    expect(LAMPS.torch.radius).toBe(squareReach(5, 1.5));
  });
});
