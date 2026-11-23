import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { createInitialTerrain } from '../world/Geology';
import { Block, TerrainGrid, type Point } from '../world/TerrainGrid';
import { TopDownGallery } from '../world/TopDownGallery';
import {
  GalleryRailway,
  GALLERY_CART_LIMIT,
  GALLERY_CARGO_LIMIT,
} from './GalleryRailway';
import { GameSession } from './GameSession';
import { decodeSave, encodeSave } from './SaveSystem';

const east = { column: 18, row: 13 };
const north = { column: 18, row: 12 };

function move(rail: GalleryRailway, from: Point): Point[] {
  expect(rail.start(from)).toBe(true);
  const path: Point[] = [];
  for (let i = 0; i < 240 && rail.pushing; i++) {
    const player = rail.step(16);
    expect(player).toBeDefined();
    const cart = rail.point;
    expect(rail.has(TerrainGrid.worldToCell(cart.x, cart.y))).toBe(true);
    expect(rail.clear(player!, 4.9, 2.9)).toBe(true);
    expect(
      Math.abs(player!.x - cart.x) >= 10 || Math.abs(player!.y - cart.y) >= 8,
    ).toBe(true);
    path.push(cart);
  }
  expect(rail.pushing).toBe(false);
  return path;
}

describe('transporte top-down', () => {
  it('conecta extremos compatibles, rechaza paredes, cruces y desniveles', () => {
    const { grid, railway: rail } = new TopDownGallery();
    expect(rail.place({ column: 19, row: 13 })).toBe(false);
    expect(rail.place({ column: 15, row: 12 })).toBe(false);
    expect(rail.place({ column: 13, row: 11 })).toBe(false);
    expect(rail.place(east)).toBe(true);
    expect(rail.place(north)).toBe(true);
    expect(rail.connections(east)).toEqual([
      { x: 0, y: -1 },
      { x: -1, y: 0 },
    ]);
    expect(rail.connections(north)).toEqual([{ x: 0, y: 1 }]);
    const grade = new GalleryRailway(grid, (c) => (c.column === 18 ? 2 : 0));
    expect(grade.place(east)).toBe(false);
    const ramp = new GalleryRailway(grid, (c) => (c.column === 18 ? 1 : 0));
    expect(ramp.place(east)).toBe(true);
  });

  it('recorre la curva en ambos sentidos, protege el tramo ocupado y se detiene', () => {
    const { railway: rail } = new TopDownGallery();
    rail.place(east);
    rail.place(north);
    const path = move(rail, { x: 262, y: 216 });
    expect(path.some((p) => p.x === 296 && p.y > 200 && p.y < 216)).toBe(true);
    expect(rail.point).toEqual({ x: 296, y: 200 });
    expect(rail.remove(north)).toBe(false);
    expect(rail.unload()).toBe(0);
    move(rail, { x: 296, y: 182 });
    expect(rail.atStation).toBe(true);
    expect(rail.remove(north)).toBe(true);
    expect(rail.connections(east)).toEqual([{ x: -1, y: 0 }]);
  });

  it('detiene el empuje cuando la vía o la huella quedan obstruidas', () => {
    const { grid, railway: rail } = new TopDownGallery();
    expect(rail.start({ x: 298, y: 216 })).toBe(true);
    grid.set(16, 13, Block.Rock);
    expect(rail.step(16)).toBeUndefined();
    expect(rail.pushing).toBe(false);
    expect(rail.point).toEqual({ x: 280, y: 216 });
  });

  it('agrega la vía inicial a un guardado de Fase 3 sin perder bloques ni carga', () => {
    const s = new GameSession(createInitialTerrain());
    s.gallery = new TopDownGallery();
    s.claimKit();
    s.tools.add('iron');
    expect(s.mineGallery({ x: 296, y: 188 }, { column: 19, row: 11 })).toBe(
      true,
    );
    const v6 = JSON.parse(encodeSave(s, { x: 208, y: 148 }));
    delete v6.gallery.railway;
    const restored = decodeSave(JSON.stringify(v6))!.session;
    expect(restored.gallery?.grid.get(19, 11)).toBe(Block.Air);
    expect(restored.inventory.items).toEqual(['iron']);
    expect(restored.gallery?.railway.segments.size).toBe(4);
    expect(restored.gallery?.railway.point).toEqual({ x: 280, y: 216 });
  });

  it('recupera rieles existentes y guarda tramo, carga y entrega sin duplicar', () => {
    const s = new GameSession(createInitialTerrain());
    const { railway: rail } = (s.gallery = new TopDownGallery());
    s.claimKit();
    s.tools.add('iron');
    s.railStock = 2;
    expect(s.buildGalleryRail(east)).toBe(true);
    expect(s.buildGalleryRail(north)).toBe(true);
    expect(s.removeGalleryRail(north)).toBe(true);
    expect(s.railStock).toBe(1);
    for (let i = 0; i < GALLERY_CARGO_LIMIT; i++) s.inventory.add('coal');
    expect(s.mineGallery({ x: 296, y: 188 }, { column: 19, row: 11 })).toBe(
      false,
    );
    // Una partida anterior puede entrar con más de cuatro bloques. La
    // transferencia conserva lo que no cabe en el carro.
    for (let i = 0; i < GALLERY_CART_LIMIT; i++) s.inventory.add('iron');
    expect(rail.load(s.inventory)).toBe(GALLERY_CART_LIMIT);
    expect(s.inventory.items).toEqual(Array(GALLERY_CARGO_LIMIT).fill('iron'));
    expect(rail.load(s.inventory)).toBe(0);
    expect(rail.start({ x: 298, y: 216 })).toBe(true);
    rail.step(50);
    const player = { x: 208, y: 148 };
    const loaded = decodeSave(encodeSave(s, player))!.session;
    const restored = loaded.gallery!.railway;
    expect(restored.point).toEqual(rail.point);
    expect(restored.inventory.items).toEqual(rail.inventory.items);
    expect(restored.has(north)).toBe(false);
    expect(restored.pushing).toBe(false);
    move(restored, { x: restored.point.x + 18, y: restored.point.y });
    expect(restored.unload()).toBe(GALLERY_CART_LIMIT);
    expect(restored.unload()).toBe(0);
    const stock = decodeSave(encodeSave(loaded, player))!.session;
    const before = encodeSave(stock, player);
    const quote = 4 * BALANCE.sale.coal + (16 + GALLERY_CARGO_LIMIT) * BALANCE.sale.iron;
    expect(stock.quoteCargo(false)).toBe(quote);
    expect(stock.sellCargo(false, () => false)).toBe('ERROR AL GUARDAR LA VENTA');
    expect(encodeSave(stock, player)).toBe(before);
    let after = '';
    expect(stock.sellCargo(false, () => {
      after = encodeSave(stock, player);
      return true;
    })).toBe(quote);
    const sold = decodeSave(after)!.session;
    expect(sold.quoteCargo(false)).toBe(0);
    expect(sold.inventory.items).toEqual([]);
    expect(sold.gallery!.railway.delivered).toEqual([]);
  });
});
