import { describe, expect, it } from 'vitest';
import { BALANCE, MATERIAL_KG } from '../config/balance';
import { createInitialTerrain } from '../world/Geology';
import { Block } from '../world/TerrainGrid';
import { GameSession } from './GameSession';
import { InventorySystem } from './InventorySystem';
import { MiningSystem } from './MiningSystem';
import { decodeSave, encodeSave } from './SaveSystem';

const fresh = () => new GameSession(createInitialTerrain());

describe('Carga por peso (kg)', () => {
  it('50 kg encima del minero y 100 kg en el carro; cada bloque pesa 1 kg', () => {
    const s = fresh();
    expect(s.inventory.capacity).toBe(50);
    expect(s.cart.inventory.capacity).toBe(100);
    expect(BALANCE.personalCapacity).toBe(50);
    expect(BALANCE.cartCapacity).toBe(100);
    for (const kg of Object.values(MATERIAL_KG)) expect(kg).toBe(1);
  });

  it('se llena por peso: el bloque 51 no entra y el peso se informa', () => {
    const inv = new InventorySystem(50);
    for (let i = 0; i < 50; i++) expect(inv.add('coal')).toBe(true);
    expect(inv.weight).toBe(50);
    expect(inv.full).toBe(true);
    expect(inv.add('gold')).toBe(false);
    expect(inv.items).toHaveLength(50);
  });

  it('transferir al carro respeta los 100 kg', () => {
    const s = fresh();
    s.inventory.items.push(...Array(50).fill('coal'));
    s.cart.inventory.items.push(...Array(70).fill('stone'));
    expect(s.inventory.transferTo(s.cart.inventory)).toBe(30);
    expect(s.cart.inventory.weight).toBe(100);
    expect(s.inventory.weight).toBe(20);
  });

  it('con 50 kg no se extrae más mena y avisa en kg', () => {
    const s = fresh();
    const mining = new MiningSystem(s.grid);
    s.tools.add('iron');
    s.grid.set(60, 10, Block.Coal);
    s.inventory.items.push(...Array(49).fill('dirt'));
    expect(s.storageProblem(Block.Coal)).toBeNull();
    expect(s.mine(mining, { x: 968, y: 136 }, { column: 60, row: 10 })).toBe(
      true,
    );
    expect(s.inventory.weight).toBe(50);
    s.grid.set(61, 10, Block.Coal);
    expect(s.storageProblem(Block.Coal)).toBe('CARGA LLENA - 50/50 KG');
    expect(s.mine(mining, { x: 984, y: 136 }, { column: 61, row: 10 })).toBe(
      false,
    );
    expect(s.grid.get(61, 10)).toBe(Block.Coal);
  });

  it('el guardado acepta hasta 50 kg encima y 100 kg en el carro, no más', () => {
    const s = fresh();
    s.inventory.items.push(...Array(50).fill('coal'));
    s.cart.inventory.items.push(...Array(100).fill('iron'));
    const raw = encodeSave(s, { x: 208, y: 148 });
    const r = decodeSave(raw)!;
    expect(r.session.inventory.weight).toBe(50);
    expect(r.session.cart.inventory.weight).toBe(100);
    const over = JSON.parse(raw);
    over.inventory.push('coal');
    expect(decodeSave(JSON.stringify(over))).toBeNull();
    const overCart = JSON.parse(raw);
    overCart.cart.items.push('coal');
    expect(decodeSave(JSON.stringify(overCart))).toBeNull();
  });
});
