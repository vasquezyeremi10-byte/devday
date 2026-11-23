import { describe, expect, it } from 'vitest';
import { createInitialTerrain } from '../world/Geology';
import { Block, type Cell } from '../world/TerrainGrid';
import { TopDownGallery } from '../world/TopDownGallery';
import { GameSession } from './GameSession';
import { StabilityState } from './GeotechnicalSystem';
import { decodeSave, encodeSave } from './SaveSystem';
import { SUPPORT } from './SupportSystem';

function chamber() {
  const s = new GameSession(createInitialTerrain());
  const g = (s.gallery = new TopDownGallery());
  s.claimKit();
  s.tools.add('iron');
  const cells: Cell[] = [];
  for (let row = 15; row <= 16; row++)
    for (let column = 15; column <= 18; column++) {
      const cell = { column, row };
      g.grid.set(column, row, Block.Air);
      g.dug.add(g.stability.key(cell));
      cells.push(cell);
    }
  g.stability.refresh(cells);
  return { s, g };
}

const support = { column: 17, row: 14 };
const player = { x: 298, y: 211 };
const riskAt = (g: TopDownGallery) =>
  [...g.stability.sectors.values()].find((s) =>
    s.cells.some(({ cell }) => cell.column === 17 && cell.row === 14),
  );

describe('estabilidad del nivel -1', () => {
  it('mantiene estable el acceso y un pasillo estrecho y avisa al ensanchar', () => {
    const g = new TopDownGallery();
    expect(g.stability.sectors.size).toBe(0);
    const cells = [19, 20, 21, 22].map((column) => ({ column, row: 11 }));
    for (const cell of cells) {
      g.grid.set(cell.column, cell.row, Block.Air);
      g.dug.add(g.stability.key(cell));
    }
    g.stability.refresh(cells);
    expect(g.stability.around({ column: 22, row: 11 })).toBeUndefined();
    const { g: wide } = chamber();
    expect(riskAt(wide)?.state).toBe(StabilityState.Imminent);
    expect(riskAt(wide)?.remaining).toBeGreaterThan(0);
  });

  it('valida stock, desbloqueo, espacio y resistencia sin duplicar al desmontar', () => {
    const { s, g } = chamber();
    const initial = riskAt(g)!.score;
    expect(s.buy('wood_beam')).toBe('COMPRA REALIZADA');
    expect(s.buy('steel_beam')).toContain('ETAPA');
    expect(
      s.buildGallerySupport({ column: 16, row: 13 }, 'wood_beam', player),
    ).toBe(false);
    expect(s.buildGallerySupport(support, 'wood_beam', player)).toBe(true);
    expect(s.supplies.wood_beam).toBe(0);
    expect(riskAt(g)?.score ?? 0).toBeLessThan(initial);
    expect(g.stability.at(support)?.durability).toBe(SUPPORT.wood.durability);
    s.progression.tier = 2;
    expect(s.buy('steel_beam')).toBe('COMPRA REALIZADA');
    expect(s.buildGallerySupport(support, 'steel_beam', player)).toBe(true);
    expect(s.supplies.steel_beam).toBe(0);
    expect(riskAt(g)?.remaining).toBeUndefined();
    expect(g.stability.at(support)?.durability).toBe(SUPPORT.steel.durability);
    expect(g.stability.removalRisk(g.stability.at(support)!)).toBe(
      StabilityState.Imminent,
    );
    expect(s.removeGallerySupport(support)).toBe(true);
    expect(s.removeGallerySupport(support)).toBe(false);
    expect(s.salvage.steel_beam).toBe(0.75);
    expect(s.supplies.steel_beam).toBe(0);
    expect(riskAt(g)?.state).toBe(StabilityState.Imminent);
  });

  it('restaura la cuenta exacta y conserva vías enterradas, daño y carga', () => {
    const { s, g } = chamber();
    const railCell = { column: 17, row: 14 };
    expect(g.railway.place(railCell)).toBe(true);
    g.railway.inventory.add('iron');
    const weak = g.stability.plan({ column: 18, row: 16 }, 'wood');
    weak.durability = SUPPORT.wood.shock;
    g.stability.install(weak);
    const risk = riskAt(g)!;
    const original = risk.remaining!;
    expect(g.stability.tick(original - 450)).toEqual([]);
    const save = (session: GameSession) =>
      decodeSave(encodeSave(session, { x: 208, y: 148 }))!.session;
    const restored = save(s);
    const gallery = restored.gallery!;
    expect(riskAt(gallery)?.remaining).toBe(450);
    expect(gallery.stability.tick(449)).toEqual([]);
    expect(gallery.stability.tick(1)).toContain(risk.id);
    const result = gallery.stability.collapse(risk.id, (cell) =>
      gallery.railway.occupies(cell),
    );
    expect(result.filled).toContainEqual(railCell);
    expect(gallery.railway.connections(railCell)).toEqual([]);
    expect(gallery.railway.inventory.items).toEqual(['iron']);
    const reopened = save(restored);
    const next = reopened.gallery!;
    expect(next.railway.has(railCell)).toBe(true);
    expect(next.grid.get(17, 14)).toBe(Block.Rubble);
    expect(next.stability.at(weak)?.durability).toBe(0);
    expect(next.stability.collapsed.has(risk.id)).toBe(true);
    reopened.tools.add('shovel');
    const energy = reopened.survival.energy;
    const stone = reopened.supplies.mat_stone;
    expect(reopened.mineGallery({ x: 280, y: 215 }, railCell)).toBe(true);
    expect(reopened.mineGallery({ x: 280, y: 215 }, railCell)).toBe(false);
    expect(next.grid.get(17, 14)).toBe(Block.Air);
    expect(next.railway.connections(railCell)).toContainEqual({ x: 0, y: -1 });
    expect(reopened.supplies.mat_stone).toBe(stone);
    expect(reopened.survival.energy).toBeLessThan(energy);
  });

  it('un poste roto bajo el desprendimiento no impide que caiga el escombro', () => {
    const { g } = chamber();
    const frame = g.stability.plan(support, 'wood');
    frame.durability = 0;
    g.stability.install(frame);
    const risk = riskAt(g)!;
    g.stability.tick(risk.remaining!);
    const fall = g.stability.collapse(risk.id, () => false);
    expect(fall.filled).toContainEqual(support);
    expect(fall.damaged).toContain(frame);
    expect(g.stability.at(support)).toBeUndefined();
  });
});
