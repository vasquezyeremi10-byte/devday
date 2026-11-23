import { describe, expect, it } from 'vitest';
import { TOOLS } from '../config/balance';
import { GameSession } from '../systems/GameSession';
import { decodeSave, encodeSave } from '../systems/SaveSystem';
import { createInitialTerrain, WORLD_REV_SOLID } from './Geology';
import { Block } from './TerrainGrid';
import {
  GALLERY_ENTRY,
  galleryVisible,
  TopDownGallery,
} from './TopDownGallery';

const iron = { column: 19, row: 11 };
const origin = { x: 296, y: 188 };

function expedition() {
  const session = new GameSession(createInitialTerrain());
  session.claimKit();
  session.tools.add('iron');
  const gallery = (session.gallery = new TopDownGallery());
  return { session, gallery };
}

describe('nivel -1', () => {
  it('deja libre solo el arranque nuevo y restaura su excavación y la planta anterior', () => {
    const { session, gallery: legacy } = expedition();
    const solid = new TopDownGallery(true);
    expect(
      solid.grid.cells.flat().filter((block) => block === Block.Air),
    ).toHaveLength(15);
    expect(legacy.grid.get(15, 10)).toBe(Block.Air);
    expect(solid.grid.get(15, 10)).toBe(Block.Rock);
    for (const [column, row] of [
      [13, 10],
      [19, 11],
      [16, 7],
      [10, 15],
    ] as const)
      expect(solid.grid.get(column, row)).toBe(legacy.grid.get(column, row));
    session.gallery = solid;
    const wall = { column: 14, row: 10 };
    expect(session.mineGallery(GALLERY_ENTRY, wall)).toBe(true);
    const restored = decodeSave(encodeSave(session, GALLERY_ENTRY))!.session
      .gallery!;
    expect(restored.grid.cells).toEqual(solid.grid.cells);
    const withPreviousGallery = new GameSession(
      createInitialTerrain(undefined, WORLD_REV_SOLID),
    );
    withPreviousGallery.gallery = legacy;
    const restoredLegacy = decodeSave(
      encodeSave(withPreviousGallery, GALLERY_ENTRY),
    )!.session.gallery!;
    expect(restoredLegacy.grid.cells).toEqual(legacy.grid.cells);
  });

  it('reusa el balance de las tres picotas y exige alcance, vista y EPP', () => {
    const { session, gallery } = expedition();
    for (const kind of ['iron', 'tungsten'] as const) {
      session.tools.add(kind);
      expect(session.workMs(iron, gallery.grid)).toBe(TOOLS[kind].workMs);
    }
    expect(session.mineGallery(GALLERY_ENTRY, iron)).toBe(false);
    expect(session.mineGallery(origin, { column: 20, row: 11 })).toBe(false);
    expect(session.mineGallery(origin, { column: 20, row: 10 })).toBe(false);
    const bare = new GameSession(createInitialTerrain());
    bare.gallery = gallery;
    bare.tools.add('iron');
    expect(bare.mineGallery(origin, iron)).toBe(false);
    expect(gallery.grid.get(19, 11)).toBe(Block.Iron);
  });

  it('con carga llena no extrae, desgasta, consume energía ni cobra XP', () => {
    const { session, gallery } = expedition();
    while (session.inventory.fits('iron')) session.inventory.add('iron');
    const durability = session.tools.current!.durability;
    const energy = session.survival.energy;
    expect(session.mineGallery(origin, iron)).toBe(false);
    expect(gallery.grid.get(19, 11)).toBe(Block.Iron);
    expect(gallery.dug.size).toBe(0);
    expect(session.tools.current!.durability).toBe(durability);
    expect(session.survival.energy).toBe(energy);
    expect(session.stats.mined).toBe(0);
  });

  it('guarda la excavación y carga juntas, sin duplicarlas al volver', () => {
    const { session, gallery } = expedition();
    expect(galleryVisible(gallery.grid, origin, { column: 20, row: 11 })).toBe(
      false,
    );
    expect(session.mineGallery(origin, iron)).toBe(true);
    expect(galleryVisible(gallery.grid, origin, { column: 20, row: 11 })).toBe(
      true,
    );
    expect(galleryVisible(gallery.grid, origin, { column: 20, row: 10 })).toBe(
      false,
    );
    expect(session.mineGallery(origin, iron)).toBe(false);
    gallery.position = origin;
    gallery.active = true;
    const lateral = { x: 208, y: 148 };
    const restored = decodeSave(encodeSave(session, lateral))!;
    expect(restored.player).toEqual(lateral);
    expect(restored.session.gallery?.snapshot()).toEqual(gallery.snapshot());
    expect(restored.session.gallery?.grid.get(19, 11)).toBe(Block.Air);
    expect(restored.session.inventory.items).toEqual(['iron']);
    expect(restored.session.mineGallery(origin, iron)).toBe(false);
  });
});

it.each([0, 1, 2, 3])(
  'conecta todas las cámaras de la planta nueva y restaura la variante %i',
  (seed) => {
    const gallery = new TopDownGallery(true, seed);
    const { grid } = gallery;
    const open = new Set<number>();
    const pending = [{ column: 14, row: 11 }];
    while (pending.length) {
      const current = pending.pop()!;
      if (grid.isSolid(current.column, current.row)) continue;
      const index = grid.index(current.column, current.row);
      if (open.has(index)) continue;
      open.add(index);
      for (const [x, y] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const)
        pending.push({ column: current.column + x, row: current.row + y });
    }
    expect(open.size).toBe(
      grid.cells.flat().filter((block) => block === Block.Air).length,
    );
    expect(open.size).toBeGreaterThan(150);
    expect(TopDownGallery.restore(gallery.snapshot())?.grid.cells).toEqual(
      grid.cells,
    );
  },
);
