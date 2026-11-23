import { describe, expect, it } from 'vitest';
import { LEGACY_PALETTE, PALETTE } from './palette';

describe('paleta V7', () => {
  it('tiene 49 colores distintos y opacos de 24 bits', () => {
    const values = Object.values(PALETTE);
    expect(values).toHaveLength(49);
    expect(new Set(values).size).toBe(values.length);
    for (const v of values) expect(v).toBe(v & 0xffffff);
  });

  it('incluye los tonos base de la dirección artística', () => {
    const v6 = [
      0x2d63ac, 0x4693dd, 0xa8d8eb, 0x5a69bb, 0x4979d2, 0x184d39, 0x8ead39,
      0x461f15, 0x5b362d, 0xbe7f1a, 0xf4b341, 0xffe29a, 0x212c48, 0x71829a,
      0x15182b, 0x0d1020,
    ];
    const values: number[] = Object.values(PALETTE);
    for (const color of v6) expect(values).toContain(color);
  });

  it('incluye los siete tonos pedidos para el Atacama', () => {
    const values: number[] = Object.values(PALETTE);
    for (const color of [
      0xd8a66b, 0xba7148, 0x98563f, 0x6b493d, 0x3989d6, 0xf39a52, 0x101b38,
    ])
      expect(values).toContain(color);
  });

  it('cada color histórico tiene un sucesor V6 con el mismo nombre', () => {
    for (const name of Object.keys(LEGACY_PALETTE))
      expect(PALETTE).toHaveProperty(name);
    // El intercambio es inyectivo: dos colores antiguos nunca se funden.
    const next = Object.keys(LEGACY_PALETTE).map(
      (n) => PALETTE[n as keyof typeof PALETTE],
    );
    expect(new Set(next).size).toBe(next.length);
  });
});
