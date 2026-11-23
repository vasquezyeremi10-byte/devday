import { expect, test } from 'vitest';
import { PPE } from '../config/gear';
import { STACK_MAX } from '../config/buildMaterials';
import { createInitialTerrain } from '../world/Geology';
import { GameSession } from './GameSession';
import { decodeSave, encodeSave } from './SaveSystem';
import { WAREHOUSE_GRAMS } from './WarehouseStorage';

test('agrupa hasta el tope de la pila, acepta 1000 kg exactos y rechaza exceso sin mover objetos', () => {
  const s = new GameSession(createInitialTerrain());
  const stock = s.warehouse;
  const dirt = { type: 'supply', kind: 'mat_dirt', count: STACK_MAX } as const;
  s.supplies.mat_dirt = STACK_MAX;
  expect(stock.deposit(s, dirt, 500)).toBeUndefined();
  expect(stock.deposit(s, dirt, 499)).toBeUndefined();
  expect(stock.stacks).toEqual([dirt]);
  s.supplies.mat_dirt = 2;
  expect(stock.deposit(s, dirt, 1)).toBeUndefined();
  expect(stock.grams).toBe(WAREHOUSE_GRAMS);
  expect(stock.stacks.map((stack) => stack.count)).toEqual([999, 1]);
  expect(stock.deposit(s, dirt, 1)).toContain('1000 KG');
  expect(s.supplies.mat_dirt).toBe(1);
  expect(stock.withdraw(s, 0, 999)).toBe('PILA AL MAXIMO');
  expect(stock.withdraw(s, 0, 998)).toBeUndefined();
  expect(s.supplies.mat_dirt).toBe(STACK_MAX);
});

test('el guardado conserva peso, desgaste, minerales, comida y kit individual sin duplicados', () => {
  const s = new GameSession(createInitialTerrain());
  s.warehouse.stockKit(s);
  s.warehouse.stockKit(s);
  s.supplies.empanada = 2;
  s.inventory.add('gold');
  const pick = s.tools.add('iron');
  pick.durability = 7;
  for (const item of s.warehouse.carried(s))
    expect(s.warehouse.deposit(s, item, item.count)).toBeUndefined();
  const player = { x: 210, y: 148 };
  const restored = decodeSave(encodeSave(s, player))!.session;
  const stock = restored.warehouse;
  expect(stock.grams).toBe(6340 + PPE.gloves.grams + PPE.goggles.grams);
  expect(stock.stacks).toEqual(s.warehouse.stacks);
  for (const kind of ['helmet', 'vest', 'boots', 'gloves', 'goggles']) {
    const index = stock.stacks.findIndex((item) => item.kind === kind);
    expect(stock.withdraw(restored, index, 1)).toBeUndefined();
    const slot = restored.loadout.slots.findIndex(
      (item) =>
        item?.type === 'ppe' &&
        restored.loadout.ppeById(item.id)?.kind === kind,
    );
    expect(slot).toBeGreaterThanOrEqual(0);
    restored.loadout.equipFromSlot(slot);
  }
  expect(restored.loadout.missing()).toEqual([]);
  const again = decodeSave(encodeSave(restored, player))!.session;
  again.warehouse.stockKit(again);
  expect(again.warehouse.stacks).toHaveLength(3);
  expect(again.loadout.missing()).toEqual([]);
  while (again.warehouse.stacks.length)
    expect(
      again.warehouse.withdraw(again, 0, again.warehouse.stacks[0]!.count),
    ).toBeUndefined();
  expect(again.tools.items[0]?.durability).toBe(7);
  expect(again.inventory.items).toEqual(['gold']);
  expect(again.supplies.empanada).toBe(2);
});

test('mantiene el límite de la mochila minera y respeta kits de partidas antiguas', () => {
  const s = new GameSession(createInitialTerrain());
  s.claimKit();
  s.warehouse.stockKit(s);
  expect(s.warehouse.stacks).toEqual([]);
  s.inventory.add('copper');
  expect(
    s.warehouse.deposit(s, { type: 'mineral', kind: 'copper', count: 1 }, 1),
  ).toBeUndefined();
  for (let i = 0; i < 4; i++) s.inventory.add('gold');
  expect(s.warehouse.withdraw(s, 0, 1, 4)).toBe('CARGA MINERA LLENA');
  expect(s.warehouse.stacks[0]?.count).toBe(1);
});


test('completa guantes y gafas en un guardado anterior con el kit ya retirado', () => {
  const s = new GameSession(createInitialTerrain());
  s.kitClaimed = s.warehouse.kitStocked = true;
  s.loadout.addPPE('gloves');
  const player = { x: 106, y: 148 };
  const loaded = decodeSave(encodeSave(s, player))!.session;
  loaded.warehouse.stockKit(loaded);
  expect(loaded.warehouse.stacks.map(({ kind }) => kind)).toEqual(['goggles']);
  const reopened = decodeSave(encodeSave(loaded, player))!.session;
  reopened.warehouse.stockKit(reopened);
  expect(reopened.warehouse.stacks.map(({ kind }) => kind)).toEqual(['goggles']);
  expect(reopened.money).toBe(s.money);
});
