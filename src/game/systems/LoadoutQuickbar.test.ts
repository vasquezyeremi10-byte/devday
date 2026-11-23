import { describe, expect, it } from 'vitest';
import { createInitialTerrain } from '../world/Geology';
import { GameSession } from './GameSession';
import { decodeSave, encodeSave } from './SaveSystem';

const fresh = () => new GameSession(createInitialTerrain());
const player = { x: 208, y: 148 };

describe('Acceso rápido', () => {
  it('referencia ejemplares distintos del mismo tipo sin copiar ni cambiar su desgaste', () => {
    const s = fresh(),
      l = s.loadout;
    const a = s.tools.add('iron'),
      b = s.tools.add('iron');
    a.durability = 1;
    l.sync();
    expect(l.assignQuick(0, { type: 'tool', id: a.id })).toBeNull();
    expect(l.assignQuick(1, { type: 'tool', id: b.id })).toBeNull();
    l.move(0, 4);
    l.selectQuick(0);
    expect(s.tools.current).toBe(a);
    s.tools.wear();
    expect(s.tools.current?.durability).toBe(0);
    expect(l.activeQuick).toEqual({ type: 'tool', id: a.id });
    l.selectQuick(1);
    expect(s.tools.current).toBe(b);
    l.assignQuick(3, { type: 'tool', id: b.id });
    expect(l.quickbar[1]).toBeNull();
    expect(l.selectedQuick).toBe(3);
    l.selectQuick(4);
    expect(s.tools.current).toBeUndefined();
    expect(s.tools.items).toEqual([a, b]);
    expect(l.slots.filter(Boolean)).toHaveLength(2);
  });

  it('desvincula consumos y descartes sin recrearlos', () => {
    const s = fresh(),
      l = s.loadout;
    s.supplies.torch = 1;
    const pick = s.tools.add('iron');
    const ppe = l.addPPE('helmet');
    expect(l.assignQuick(0, { type: 'ppe', id: ppe.id })).not.toBeNull();
    expect(l.assignQuick(9, { type: 'tool', id: pick.id })).not.toBeNull();
    l.assignQuick(2, { type: 'supply', kind: 'torch' });
    l.assignQuick(3, { type: 'tool', id: pick.id });
    l.selectQuick(2);
    s.supplies.torch--;
    l.sync();
    expect(l.activeQuick).toBeNull();
    expect(l.quickbar[2]).toBeNull();
    const slot = l.slots.findIndex(
      (r) => r?.type === 'tool' && r.id === pick.id,
    );
    expect(l.discard(slot)).toBeNull();
    expect(l.quickbar[3]).toBeNull();
    expect(s.tools.items).toHaveLength(0);
    s.supplies.torch++;
    l.sync();
    expect(l.quickbar).toEqual(Array(9).fill(null));
  });

  it('migra las seis referencias antiguas a nueve y conserva los bienes', () => {
    const s = fresh();
    const first = s.tools.add('iron'),
      equipped = s.tools.add('iron');
    s.supplies.rail = 2;
    const old = JSON.parse(encodeSave(s, player));
    old.v4.loadout.quickbar = [
      { type: 'tool', kind: 'iron' },
      { type: 'tool', kind: 'diamond' },
      { type: 'tool', kind: 'iron' },
      null,
      null,
      { type: 'supply', kind: 'rail' },
    ];
    delete old.v4.loadout.selectedQuick;
    const loaded = decodeSave(JSON.stringify(old))!.session;
    expect(loaded.tools.items).toEqual([first, equipped]);
    expect(loaded.supplies.rail).toBe(2);
    expect(loaded.loadout.quickbar).toEqual([
      { type: 'tool', id: equipped.id },
      null,
      null,
      null,
      null,
      // Con nueve casillas el riel conserva su lugar original (la sexta).
      { type: 'supply', kind: 'rail' },
      null,
      null,
      null,
    ]);
  });
});
