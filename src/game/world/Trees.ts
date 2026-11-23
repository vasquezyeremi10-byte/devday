import { TREE } from '../config/buildMaterials';
import { TILE_SIZE } from '../config/constants';
import { surfaceRow, type Cell } from './TerrainGrid';

/**
 * Algarrobos de la superficie (V11). Posiciones fijas sobre terreno llano,
 * lejos de la bodega, la bocamina y los cactus. Lógica pura: el dibujo y las
 * animaciones viven en TreeView.
 */
export const TREE_COLUMNS: readonly number[] = [48, 56, 62, 70, 78, 87, 122];

/** Celda del suelo sobre la que crece el árbol. */
export const treeGround = (index: number): Cell => ({
  column: TREE_COLUMNS[index]!,
  row: surfaceRow(TREE_COLUMNS[index]!),
});

/** Punto del tronco, donde se golpea (px del mundo). */
export const treeTrunk = (index: number) => {
  const g = treeGround(index);
  return { x: g.column * TILE_SIZE + TILE_SIZE / 2, y: g.row * TILE_SIZE - 12 };
};

/** Zona del árbol que el cursor puede apuntar (tronco y copa). */
export const treeBounds = (index: number) => {
  const g = treeGround(index);
  const x = g.column * TILE_SIZE + TILE_SIZE / 2;
  return { x: x - 14, y: g.row * TILE_SIZE - 46, w: 28, h: 46 };
};

/**
 * Estado de los árboles: cuáles siguen en pie y cuántos hachazos recibieron.
 * `felled` se guarda en la partida (un árbol talado o arrancado no reaparece).
 */
export class TreeState {
  readonly felled = new Set<number>();
  /** Golpes recibidos por árbol aún en pie (solo en memoria). */
  private readonly hits = new Map<number, number>();

  get count(): number {
    return TREE_COLUMNS.length;
  }

  standing(index: number): boolean {
    return index >= 0 && index < TREE_COLUMNS.length && !this.felled.has(index);
  }

  hitsOf(index: number): number {
    return this.hits.get(index) ?? 0;
  }

  /**
   * Un hachazo. Devuelve la madera obtenida cuando el árbol cae (una sola
   * vez: el árbol ya talado no responde) o 0 mientras resiste.
   */
  hit(index: number): { fell: boolean; wood: number; hits: number } {
    if (!this.standing(index)) return { fell: false, wood: 0, hits: 0 };
    const hits = this.hitsOf(index) + 1;
    if (hits < TREE.hp) {
      this.hits.set(index, hits);
      return { fell: false, wood: 0, hits };
    }
    this.hits.delete(index);
    this.felled.add(index);
    return { fell: true, wood: TREE.wood, hits };
  }

  /** El suelo se excavó: el árbol cae sin dar madera. */
  uproot(index: number): boolean {
    if (!this.standing(index)) return false;
    this.hits.delete(index);
    this.felled.add(index);
    return true;
  }

  /** Árbol en pie cuyo tronco ocupa la celda (impide colocar bloques). */
  trunkAt({ column, row }: Cell): number {
    const i = TREE_COLUMNS.indexOf(column);
    if (i < 0 || !this.standing(i)) return -1;
    const ground = treeGround(i).row;
    return row < ground && row >= ground - 3 ? i : -1;
  }

  /** Árbol en pie bajo un punto del mundo, o -1. */
  at(x: number, y: number): number {
    for (let i = 0; i < TREE_COLUMNS.length; i++) {
      if (!this.standing(i)) continue;
      const b = treeBounds(i);
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return i;
    }
    return -1;
  }

  snapshot(): number[] {
    return [...this.felled].sort((a, b) => a - b);
  }

  restore(data: unknown): void {
    this.felled.clear();
    this.hits.clear();
    if (!Array.isArray(data)) return;
    for (const i of data)
      if (Number.isInteger(i) && i >= 0 && i < TREE_COLUMNS.length)
        this.felled.add(i);
  }
}
