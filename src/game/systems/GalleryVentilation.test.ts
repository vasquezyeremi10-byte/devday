import { describe, expect, it } from 'vitest';
import { GameSession } from './GameSession';
import { decodeSave, encodeSave } from './SaveSystem';
import { createInitialTerrain } from '../world/Geology';
import { Block } from '../world/TerrainGrid';
import { TopDownGallery } from '../world/TopDownGallery';
import { ENTRY_FAN } from './GalleryVentilation';
import { VENTILATION } from './VentilationSystem';
import { GALLERY_AIR } from '../config/galleryAir';

const east = { x: 1, y: 0 };
const at = (column: number) => ({ column, row: 11 });
const dig = (g: TopDownGallery, from: number, to: number) => {
  for (let c = from; c <= to; c++) {
    g.grid.set(c, 11, Block.Air);
    g.dug.add(g.ventilation.key(at(c)));
  }
  g.ventilation.evaluate();
};

describe('aire del nivel -1', () => {
  it('pierde calidad por recorrido, no atraviesa roca ni activa un auxiliar aislado', () => {
    const g = new TopDownGallery(),
      air = g.ventilation;
    dig(g, 21, 31);
    expect(air.install(at(22), 'duct', east)).toBe(true);
    expect(air.install(at(23), 'fan_aux', east)).toBe(true);
    expect(air.install(at(24), 'duct', east)).toBe(true);
    expect(air.running.has(air.key(at(23)))).toBe(false);
    expect(air.ductAir[air.key(at(24))]).toBe(0);
    expect(air.at(at(24))).toBe(0);
    dig(g, 19, 20);
    expect(air.at(at(21))).toBeGreaterThan(air.at(at(29)));
    expect(air.install(at(29), 'fan_main', east)).toBe(false);
  });

  it('alimenta el auxiliar con ductos, pierde la red por derrumbe y la recupera al despejar', () => {
    const g = new TopDownGallery(),
      air = g.ventilation;
    dig(g, 19, 31);
    const baseline = air.at(at(31));
    for (let c = 16; c <= 23; c++)
      expect(air.install(at(c), 'duct', east)).toBe(true);
    expect(air.install(at(24), 'fan_aux', east)).toBe(true);
    for (let c = 25; c <= 31; c++)
      expect(air.install(at(c), 'duct', east)).toBe(true);
    expect(air.running.has(air.key(at(24)))).toBe(true);
    expect(air.at(at(31))).toBeGreaterThan(baseline + 50);
    expect(air.links(at(23))).toEqual([east, { x: -1, y: 0 }]);
    air.toggle(air.fanAt(ENTRY_FAN)!);
    expect(air.at(at(31))).toBe(baseline);
    air.toggle(air.fanAt(ENTRY_FAN)!);
    g.grid.set(20, 11, Block.Rubble);
    air.collapse([at(20)]);
    expect(air.ductAt(at(20))?.integrity).toBe(40);
    expect(air.links(at(19))).toEqual([{ x: -1, y: 0 }]);
    expect(air.at(at(31))).toBe(0);
    g.grid.set(20, 11, Block.Air);
    air.evaluate();
    expect(air.at(at(31))).toBeGreaterThan(50);
    expect(air.install(at(20), 'duct', east)).toBe(true);
    expect(air.ductAt(at(20))?.integrity).toBe(100);
  });

  it('consume y recupera suministros existentes y restaura orientación, estado y daños', () => {
    const s = new GameSession(createInitialTerrain()),
      g = (s.gallery = new TopDownGallery());
    const air = g.ventilation;
    s.supplies.duct = 2;
    expect(s.buildGalleryAir(at(16), 'duct', east)).toBe(false);
    s.progression.tier = 3;
    expect(s.buildGalleryAir(at(16), 'duct', east)).toBe(true);
    expect(s.buildGalleryAir(at(16), 'duct', east)).toBe(false);
    expect(s.supplies.duct).toBe(1);
    expect(s.removeGalleryAir(at(16))).toBe(true);
    expect(s.removeGalleryAir(at(16))).toBe(false);
    expect(s.salvage.duct).toBe(0.75);
    expect(s.removeGalleryAir(ENTRY_FAN)).toBe(false);
    expect(s.buildGalleryAir(at(16), 'duct', east)).toBe(true);
    s.supplies.fan_aux = 1;
    expect(s.buildGalleryAir(at(17), 'fan_aux', { x: 0, y: 1 })).toBe(true);
    air.toggle(air.fanAt(at(17))!);
    air.toggle(air.fanAt(ENTRY_FAN)!);
    g.grid.set(16, 11, Block.Rubble);
    g.stability.rubble.add(g.stability.key(at(16)));
    air.collapse([at(16)]);
    const restored = decodeSave(encodeSave(s, { x: 208, y: 148 }))!.session
      .gallery!;
    expect(restored.ventilation.snapshot()).toEqual(air.snapshot());
    expect(restored.grid.get(16, 11)).toBe(Block.Rubble);
    expect(restored.ventilation.at(at(16))).toBe(0);
  });

  it('da margen y aplica daño por pulsos solo con aire agotado', () => {
    const air = new TopDownGallery().ventilation;
    const wait = VENTILATION.exposure.graceMs + GALLERY_AIR.damageIntervalMs;
    expect(air.exposure(at(31), wait - 1)).toBe(0);
    expect(air.exposure(at(31), 1)).toBe(4);
    expect(air.exposure(at(31), 16)).toBe(0);
    expect(air.exposure(at(31), GALLERY_AIR.damageIntervalMs - 16)).toBe(4);
    expect(air.exposure(at(14), 20)).toBe(0);
    expect(air.exposure(at(31), wait - 1)).toBe(0);
  });
});
