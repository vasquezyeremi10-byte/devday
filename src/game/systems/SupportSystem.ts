import type { Cell, TerrainGrid } from '../world/TerrainGrid';

/** Parámetros del sostenimiento (modelo de juego, no de diseño real). */
export const SUPPORT = {
  wood: {
    label: 'VIGA DE MADERA',
    /** Bloques de techo sostenidos a cada lado del marco. */
    reach: 2,
    durability: 100,
    /** Desgaste por minuto mientras sostiene un techo. */
    wearPerMinute: 1,
    /** Daño de un derrumbe o tronadura cercanos. */
    shock: 40,
  },
  steel: {
    label: 'VIGA DE ACERO',
    reach: 4,
    durability: 300,
    wearPerMinute: 0.2,
    shock: 12,
  },
  /** Altura máxima de galería que un marco alcanza (bloques). */
  maxHeight: 3,
} as const;
export type SupportKind = 'wood' | 'steel';

export interface Support extends Cell {
  id: number;
  kind: SupportKind;
  durability: number;
  /** Fila del techo que sostiene (primer sólido sobre el marco). */
  roof: number;
  /** Entibado permanente de la bocamina: no se desmonta. */
  fixed?: boolean;
}

/**
 * Marcos de sostenimiento instalados en celdas de galería: poste, sombrero y
 * cuña contra el techo. Un marco roto deja de sostener, pero sigue visible.
 */
export class SupportSystem {
  items: Support[] = [];
  nextId = 1;

  /** Techo de un marco en (column,row): primer sólido hacia arriba, ≤ 3 bloques. */
  static roofOf(grid: TerrainGrid, { column, row }: Cell): number | null {
    for (let h = 1; h <= SUPPORT.maxHeight; h++)
      if (grid.isSolid(column, row - h)) return row - h;
    return null;
  }

  /** Motivo por el que no se puede instalar, o null si es válido. */
  check(grid: TerrainGrid, cell: Cell): string | null {
    if (grid.isSolid(cell.column, cell.row)) return 'EXCAVA ANTES DE INSTALAR';
    if (!grid.isSolid(cell.column, cell.row + 1))
      return 'EL MARCO NECESITA PISO';
    if (SupportSystem.roofOf(grid, cell) === null)
      return 'NO HAY TECHO AL ALCANCE DEL MARCO';
    if (this.at(cell.column, cell.row)) return 'YA HAY UN MARCO AQUI';
    return null;
  }

  at(column: number, row: number): Support | undefined {
    return this.items.find((s) => s.column === column && s.row === row);
  }

  /** Instala o reemplaza (madera por acero) un marco. */
  install(grid: TerrainGrid, cell: Cell, kind: SupportKind): Support | null {
    const old = this.at(cell.column, cell.row);
    if (old) {
      if (old.kind === 'wood' && kind === 'steel') {
        old.kind = 'steel';
        old.durability = SUPPORT.steel.durability;
        return old;
      }
      return null;
    }
    if (this.check(grid, cell)) return null;
    const support: Support = {
      ...cell,
      id: this.nextId++,
      kind,
      durability: SUPPORT[kind].durability,
      roof: SupportSystem.roofOf(grid, cell)!,
    };
    this.items.push(support);
    return support;
  }

  /** Marcos activos que sostienen el techo de la fila `roof` en `column`. */
  covers(column: number, roof: number): boolean {
    return this.items.some(
      (s) =>
        s.durability > 0 &&
        s.roof === roof &&
        Math.abs(s.column - column) <= SUPPORT[s.kind].reach,
    );
  }

  /** Recalcula techos tras excavar o derrumbarse; retira marcos sin piso. */
  refresh(grid: TerrainGrid): void {
    this.items = this.items.filter(
      (s) =>
        !grid.isSolid(s.column, s.row) && grid.isSolid(s.column, s.row + 1),
    );
    for (const s of this.items)
      s.roof = SupportSystem.roofOf(grid, s) ?? s.roof;
  }

  /** Desgaste lento con el tiempo. Devuelve los marcos que se rompieron. */
  age(seconds: number): Support[] {
    const broken: Support[] = [];
    for (const s of this.items) {
      if (s.fixed || s.durability <= 0) continue;
      s.durability = Math.max(
        0,
        s.durability - (SUPPORT[s.kind].wearPerMinute * seconds) / 60,
      );
      if (s.durability <= 0) broken.push(s);
    }
    return broken;
  }

  /** Golpe de un derrumbe o tronadura en un radio (bloques). */
  shock(center: Cell, radius: number, factor = 1): Support[] {
    const broken: Support[] = [];
    for (const s of this.items) {
      if (s.fixed || s.durability <= 0) continue;
      const d = Math.max(
        Math.abs(s.column - center.column),
        Math.abs(s.row - center.row),
      );
      if (d > radius) continue;
      s.durability = Math.max(0, s.durability - SUPPORT[s.kind].shock * factor);
      if (s.durability <= 0) broken.push(s);
    }
    return broken;
  }
}
