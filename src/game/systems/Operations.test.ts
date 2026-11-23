import { describe, expect, it } from 'vitest';
import { BALANCE, TOOLS, type ToolKind } from '../config/balance';
import { CART } from '../config/cart';
import { createInitialTerrain } from '../world/Geology';
import { Block, TerrainGrid } from '../world/TerrainGrid';
import { GameSession } from './GameSession';
import { InteractionSystem } from './InteractionSystem';
import { InventorySystem } from './InventorySystem';
import { MiningSystem } from './MiningSystem';
import { decodeSave, encodeSave } from './SaveSystem';
import { WorkSystem } from './WorkSystem';

describe('Trabajo real, cancelacion y desgaste', () => {
  for (const kind of ['iron', 'tungsten'] as ToolKind[]) {
    for (const fps of [15, 30, 60, 144])
      it(`${kind}: ${TOOLS[kind].workMs}ms a ${fps} FPS`, () => {
        const work = new WorkSystem(),
          start = 1234,
          duration = TOOLS[kind].workMs;
        expect(work.advance('block', start, duration)).toBe(false);
        for (let t = 1000 / fps; t < duration - 0.001; t += 1000 / fps)
          expect(work.advance('block', start + t, duration)).toBe(false);
        expect(work.advance('block', start + duration, duration)).toBe(true);
        expect(work.advance('block', start + duration * 2, duration)).toBe(
          false,
        );
      });
  }
  it('cambiar objetivo o cancelar reinicia el progreso sin consumir durabilidad', () => {
    const work = new WorkSystem();
    work.advance('a', 0, 10000);
    work.advance('a', 5000, 10000);
    expect(work.progress).toBe(0.5);
    work.advance('b', 5000, 10000);
    expect(work.progress).toBe(0);
    work.cancel();
    work.advance('b', 20000, 10000);
    expect(work.progress).toBe(0);
  });
  it('extraccion atomica, capacidad 50 kg, herramienta rota y pala sobre roca', () => {
    const grid = new TerrainGrid(12, 12),
      s = new GameSession(grid),
      mining = new MiningSystem(grid);
    const cell = { column: 5, row: 5 },
      origin = { x: 88, y: 64 };
    grid.set(5, 5, Block.Rock);
    s.tools.add('shovel');
    expect(s.mine(mining, origin, cell)).toBe(false);
    expect(s.tools.current!.durability).toBe(TOOLS.shovel.durability);
    const tool = s.tools.add('iron');
    tool.durability = 1;
    expect(s.mine(mining, origin, cell)).toBe(true);
    expect(tool.durability).toBe(0);
    // V11: la roca rinde piedra apilable, no una casilla de la carga minera.
    expect(s.inventory.items).toEqual([]);
    expect(s.supplies.mat_stone).toBe(1);
    expect(s.mine(mining, origin, cell)).toBe(false);
    grid.set(5, 5, Block.Rock);
    expect(s.mine(mining, origin, cell)).toBe(false);
    s.tools.add('iron');
    // La carga minera (50 kg) sigue limitando las menas.
    s.inventory.items.push(...Array(50).fill('dirt'));
    grid.set(5, 5, Block.Coal);
    expect(s.mine(mining, origin, cell)).toBe(false);
    expect(grid.get(5, 5)).toBe(Block.Coal);
    expect(s.tools.current!.durability).toBe(TOOLS.iron.durability);
  });
  it('estados exactos de desgaste y cambio entre repuestos', () => {
    const s = new GameSession(createInitialTerrain()),
      t = s.tools.add('iron');
    expect(s.tools.state()).toBe('BUENA');
    t.durability = 10;
    expect(s.tools.state()).toBe('DESGASTADA');
    t.durability = 4;
    expect(s.tools.state()).toBe('POR ROMPER');
    t.durability = 0;
    expect(s.tools.state()).toBe('ROTA');
    const other = s.tools.add('iron');
    expect(s.tools.equip('iron')).toBe(true);
    expect(s.tools.current).toBe(other);
  });
});

describe('Conservacion, comercio y guardado', () => {
  it('el carbon financia la etapa 2; tungsteno exige desbloqueo', () => {
    const s = new GameSession(createInitialTerrain());
    s.money = 30;
    s.buy('iron');
    s.buy('shovel');
    s.buy('rail');
    expect(s.money).toBe(0);
    for (let i = 0; i < 20; i++) {
      s.inventory.add('coal');
      s.sellCargo(false, () => true);
    }
    s.money += 0;
    expect(s.buy('tungsten')).toBe('REQUIERE ETAPA 2');
    expect(s.money).toBe(100);
    expect(s.progression.update()).toBe(2);
    expect(s.buy('tungsten')).toBe('COMPRA REALIZADA');
    for (let i = 0; i < 12; i++) {
      s.inventory.add('iron');
      s.sellCargo(false, () => true);
    }
    expect(s.money).toBe(100 - 45 + 96);
    expect(s.tools.current!.kind).toBe('tungsten');
    expect(s.buy('fan_main')).toBe('REQUIERE ETAPA 3');
  });
  it('los nueve minerales llegan a la carga real una sola vez', () => {
    const grid = new TerrainGrid(12, 12),
      s = new GameSession(grid),
      mining = new MiningSystem(grid);
    s.tools.add('tungsten');
    for (let block = Block.Coal; block <= Block.Alien; block++) {
      grid.set(5, 5, block);
      expect(s.mine(mining, { x: 88, y: 64 }, { column: 5, row: 5 })).toBe(
        true,
      );
      expect(s.inventory.items).toHaveLength(1);
      expect(s.mine(mining, { x: 88, y: 64 }, { column: 5, row: 5 })).toBe(
        false,
      );
      s.sellCargo(false, () => true);
    }
    expect(s.sold).toBe(9);
    expect(s.tools.current!.durability).toBe(TOOLS.tungsten.durability - 9);
  });
  it('compra kit inicial y rechaza saldo insuficiente sin mutacion', () => {
    const s = new GameSession(createInitialTerrain());
    expect(s.money).toBe(50);
    s.money = 30;
    expect(s.buy('iron')).toBe('COMPRA REALIZADA');
    expect(s.buy('shovel')).toBe('COMPRA REALIZADA');
    expect(s.money).toBe(5);
    expect(s.buy('tungsten')).toBe('REQUIERE ETAPA 2');
    expect(s.money).toBe(5);
    expect(s.tools.items).toHaveLength(2);
    expect(s.buy('rail')).toBe('COMPRA REALIZADA');
    expect(s.railStock).toBe(1);
  });
  it('inventarios conservan recursos en transferencias parciales, llenas y consigo mismos', () => {
    const a = new InventorySystem(4, ['coal', 'dirt', 'stone', 'gold']),
      b = new InventorySystem(3, ['copper']);
    expect(a.add('gold')).toBe(false);
    expect(a.transferTo(b)).toBe(2);
    expect(a.items).toEqual(['stone', 'gold']);
    expect(b.items).toEqual(['copper', 'coal', 'dirt']);
    expect(a.transferTo(b)).toBe(0);
    expect(a.transferTo(a)).toBe(0);
  });
  it('pala consume una carga solo al completar un traslado valido', () => {
    const s = new GameSession(createInitialTerrain());
    s.tools.add('shovel');
    s.inventory.items.push('coal');
    expect(s.load()).toBe(true);
    expect(s.inventory.items).toHaveLength(0);
    expect(s.cart.inventory.items).toEqual(['coal']);
    expect(s.load()).toBe(false);
    expect(s.tools.current!.durability).toBe(39);
    s.cart.inventory.items.push(...Array(99).fill('stone'));
    s.inventory.add('dirt');
    expect(s.load()).toBe(false);
    expect(s.tools.current!.durability).toBe(39);
    expect(s.inventory.items).toEqual(['dirt']);
  });
  it('material suelto finito, carga al carro o al inventario y sin duplicacion', () => {
    const s = new GameSession(createInitialTerrain());
    s.tools.add('shovel');
    expect(s.load(1)).toBe(true);
    expect(s.collectPile(1)).toBe(true);
    expect(s.piles[0]!.items).toHaveLength(6);
    expect(
      s.cart.inventory.items.length +
        s.inventory.items.length +
        s.piles[0]!.items.length,
    ).toBe(8);
    s.piles[0]!.items = [];
    expect(s.load(1)).toBe(false);
    expect(s.collectPile(1)).toBe(false);
  });
  it('venta una sola vez y solo incluye el carro solicitado', () => {
    const s = new GameSession(createInitialTerrain());
    s.money = 30;
    s.inventory.add('gold');
    s.cart.inventory.add('coal');
    expect(s.sellCargo(false, () => true)).toBe(30);
    expect(s.cart.inventory.items).toEqual(['coal']);
    expect(s.sellCargo(true, () => true)).toBe(5);
    expect(s.sellCargo(true, () => true)).toBe(0);
    expect(s.money).toBe(65);
    expect(s.progression.earned).toBe(35);
    expect(s.sold).toBe(2);
  });
  it('auxilio evita insolvencia, no entrega repuestos infinitos utilizables', () => {
    const s = new GameSession(createInitialTerrain());
    expect(s.rescue()).toBe(false);
    s.money = 0;
    expect(s.rescue()).toBe(true);
    expect(s.rescue()).toBe(false);
    s.tools.items.forEach((t) => (t.durability = 0));
    expect(s.rescue()).toBe(true);
    expect(s.tools.hasPick()).toBe(true);
  });
  it('guardar y recuperar terreno, herramientas, durabilidad, vias, carga y dinero', () => {
    const s = new GameSession(createInitialTerrain());
    s.buy('iron');
    s.buy('shovel');
    s.buy('rail');
    s.build({ column: 25, row: 9 });
    s.tools.current!.durability = 9;
    s.inventory.add('gold');
    s.cart.inventory.add('coal');
    s.grid.set(26, 9, Block.Air);
    s.cart.x = 260;
    const raw = encodeSave(s, { x: 208, y: 148 }),
      restored = decodeSave(raw)!;
    expect(restored).not.toBeNull();
    expect(encodeSave(restored.session, restored.player)).toBe(raw);
    expect(restored.session.tools.current!.durability).toBe(9);
    expect(restored.session.grid.get(26, 9)).toBe(Block.Air);
  });
  it('rechaza versiones futuras y estados corruptos sin aplicar parcialmente', () => {
    const raw = encodeSave(new GameSession(createInitialTerrain()), {
      x: 208,
      y: 148,
    });
    for (const mutate of [
      (d: Record<string, unknown>) => (d.version = 99),
      (d: Record<string, unknown>) => (d.money = -1),
      (d: Record<string, unknown>) => (d.inventory = ['bogus']),
      (d: Record<string, unknown>) =>
        (d.tools = [{ id: 1, kind: 'bogus', durability: 999 }]),
    ]) {
      const d = JSON.parse(raw);
      mutate(d);
      expect(decodeSave(JSON.stringify(d))).toBeNull();
    }
    expect(decodeSave('{')).toBeNull();
  });
  it('una partida antigua con la picota de diamante carga sin ella', () => {
    const raw = encodeSave(new GameSession(createInitialTerrain()), {
      x: 208,
      y: 148,
    });
    const d = JSON.parse(raw);
    d.tools = [
      { id: 1, kind: 'iron', durability: 10 },
      { id: 2, kind: 'diamond', durability: 90 },
    ];
    d.equipped = 2;
    const loaded = decodeSave(JSON.stringify(d))!.session;
    expect(loaded).toBeTruthy();
    expect(loaded.tools.items.map((t) => t.kind)).toEqual(['iron']);
    expect(loaded.tools.equipped).toBe(0);
  });
});

describe('Interaccion y ferrocarril', () => {
  it('elige uno cercano, respeta orientacion, rango y visibilidad', () => {
    const system = new InteractionSystem();
    let calls = 0;
    for (const [id, x] of [
      ['a', 10],
      ['b', 20],
    ] as const)
      system.register({
        id,
        x,
        y: 0,
        radius: 32,
        enabled: true,
        facing: true,
        label: id,
        action: () => calls++,
      });
    expect(system.select({ x: 0, y: 0 }, 1)?.id).toBe('a');
    system.activate();
    expect(calls).toBe(1);
    expect(system.select({ x: 0, y: 0 }, -1)).toBeUndefined();
    expect(system.select({ x: 0, y: 0 }, 1, () => false)).toBeUndefined();
    expect(system.select({ x: 100, y: 0 }, 1)).toBeUndefined();
  });
  it('solo construye conectado, libre, con soporte y stock', () => {
    const s = new GameSession(createInitialTerrain());
    expect(s.build({ column: 25, row: 9 })).toBe(false);
    s.railStock = 2;
    expect(s.build({ column: 25, row: 9 })).toBe(true);
    expect(s.railStock).toBe(1);
    expect(s.build({ column: 25, row: 9 })).toBe(false);
    expect(s.build({ column: 26, row: 9 })).toBe(false);
    s.grid.set(26, 9, Block.Air);
    s.grid.set(26, 8, Block.Air);
    s.grid.set(26, 10, Block.Air);
    expect(s.build({ column: 26, row: 9 })).toBe(false);
    expect(s.build({ column: 7, row: 9 })).toBe(false);
    s.grid.set(26, 10, Block.Dirt);
    expect(s.build({ column: 26, row: 9 })).toBe(true);
  });
  it('carro acelera, frena, queda dentro de vias y no cruza desconexiones', () => {
    const s = new GameSession(createInitialTerrain()),
      cart = s.cart;
    cart.pushing = true;
    cart.step(1, 0.1);
    expect(cart.velocity).toBe(10);
    for (let i = 0; i < 200; i++) cart.step(1, 0.05);
    expect(cart.x).toBe((BALANCE.railEnd + 1) * 16 - CART.railMargin);
    cart.x = 252;
    cart.velocity = 50;
    cart.step(0, 0.1);
    expect(cart.velocity).toBe(34);
    cart.velocity = 0;
    s.rails.segments = s.rails.segments.filter((r) => r.column !== 18);
    for (let i = 0; i < 200; i++) cart.step(1, 0.05);
    expect(cart.x).toBe(18 * 16 - CART.railMargin);
    cart.step(-1, 0.1, () => false);
    expect(cart.pushing).toBe(false);
  });
  it('soportes de vias no se excavan y no atrapan al carro sobre aire', () => {
    const s = new GameSession(createInitialTerrain());
    s.tools.add('iron');
    expect(
      s.mine(
        new MiningSystem(s.grid),
        { x: 216, y: 148 },
        { column: 13, row: 10 },
      ),
    ).toBe(false);
    expect(s.grid.get(13, 10)).toBe(Block.Dirt);
  });
});
