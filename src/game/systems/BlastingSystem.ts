import { materialOf, type Material } from '../config/balance';
import { cellNoise } from '../world/Geology';
import { Block, type Cell, type TerrainGrid } from '../world/TerrainGrid';

/**
 * Tronadura ficticia por bloques. No representa parámetros reales de
 * explosivos ni recomendaciones de seguridad: es una regla de juego.
 */
export const BLAST = {
  /** Mecha de juego: cuenta regresiva inicial (ms). */
  fuseMs: 6000,
  /** Probabilidad de fragmentar cada vecino ortogonal y diagonal. */
  orthogonal: 0.62,
  diagonal: 0.35,
  /** Radio de daño al jugador (px) y daño máximo en el centro. */
  radius: 56,
  maxDamage: 85,
  /** Factor de daño si hay roca entre la carga y el jugador. */
  shielded: 0.3,
  /** Radio (bloques) del golpe a marcos y techos. */
  shockRadius: 3,
} as const;

export interface Charge extends Cell {
  /** Momento (ms de juego) en que explota; null si la mecha no está encendida. */
  endsAt: number | null;
}
export interface BlastResult {
  center: Cell;
  destroyed: Cell[];
  materials: Material[];
  fractured: Cell[];
}

const key = (c: number, r: number) => `${c},${r}`;

export class BlastingSystem {
  /** Barrenos perforados (el bloque sigue en el mundo). */
  readonly drilled = new Set<string>();
  /** Bloques fracturados por una tronadura: se trabajan más rápido. */
  readonly fractured = new Set<string>();
  charges: Charge[] = [];
  blasts = 0;

  constructor(
    readonly grid: TerrainGrid,
    readonly seed: number,
    private readonly protects: (cell: Cell) => boolean,
  ) {}

  /** Bloques indestructibles o protegidos por una regla de juego. */
  destructible(cell: Cell): boolean {
    const block = this.grid.get(cell.column, cell.row);
    return (
      this.grid.contains(cell.column, cell.row) &&
      block !== Block.Air &&
      block !== Block.Bedrock &&
      !this.protects(cell)
    );
  }

  canDrill(cell: Cell): string | null {
    if (!this.destructible(cell)) return 'BLOQUE NO PERFORABLE';
    if (this.grid.get(cell.column, cell.row) === Block.Rubble)
      return 'EL ESCOMBRO NO SE PERFORA';
    if (this.drilled.has(key(cell.column, cell.row)))
      return 'YA ESTA PERFORADO';
    return null;
  }

  drill(cell: Cell): boolean {
    if (this.canDrill(cell)) return false;
    this.drilled.add(key(cell.column, cell.row));
    return true;
  }

  chargeAt(cell: Cell): Charge | undefined {
    return this.charges.find(
      (c) => c.column === cell.column && c.row === cell.row,
    );
  }

  /** Una sola carga por barreno. */
  canCharge(cell: Cell): string | null {
    if (!this.drilled.has(key(cell.column, cell.row)))
      return 'LA DINAMITA REQUIERE UN BARRENO PERFORADO';
    if (this.chargeAt(cell)) return 'ESTE BARRENO YA TIENE CARGA';
    return null;
  }

  charge(cell: Cell): boolean {
    if (this.canCharge(cell)) return false;
    this.charges.push({ ...cell, endsAt: null });
    return true;
  }

  light(cell: Cell, now: number): boolean {
    const charge = this.chargeAt(cell);
    if (!charge || charge.endsAt !== null) return false;
    charge.endsAt = now + BLAST.fuseMs;
    return true;
  }

  /** Cargas cuya mecha terminó. */
  due(now: number): Charge[] {
    return this.charges.filter((c) => c.endsAt !== null && c.endsAt <= now);
  }

  /**
   * Explosión: el bloque de la carga siempre cae; cada vecino de la matriz
   * 3×3 cae según un patrón irregular determinista. Nunca supera 3×3 ni
   * rompe bloques indestructibles. Cada bloque destruido rinde exactamente
   * un material (sin duplicar menas). Los sobrevivientes quedan fracturados.
   */
  explode(charge: Charge): BlastResult {
    this.charges = this.charges.filter((c) => c !== charge);
    const salt = this.seed + ++this.blasts * 7919;
    const picks: { cell: Cell; chance: number; roll: number }[] = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const cell = { column: charge.column + dx, row: charge.row + dy };
        const chance =
          dx === 0 && dy === 0
            ? 1
            : dx === 0 || dy === 0
              ? BLAST.orthogonal
              : BLAST.diagonal;
        picks.push({
          cell,
          chance,
          roll: cellNoise(salt, cell.column, cell.row),
        });
      }
    let chosen = picks.filter((p) => p.roll < p.chance);
    // Nunca un cuadrado perfecto: si cayeran los nueve, una esquina resiste.
    if (chosen.length === 9)
      chosen = chosen.filter(
        (p) =>
          p !==
          picks
            .filter((q) => q.chance === BLAST.diagonal)
            .sort((a, b) => b.roll - a.roll)[0],
      );
    const destroyed: Cell[] = [],
      materials: Material[] = [],
      fractured: Cell[] = [];
    for (const { cell } of chosen) {
      if (!this.destructible(cell)) continue;
      const block = this.grid.get(cell.column, cell.row);
      materials.push(materialOf(block));
      this.grid.set(cell.column, cell.row, Block.Air);
      destroyed.push(cell);
      const k = key(cell.column, cell.row);
      this.drilled.delete(k);
      this.fractured.delete(k);
      // Una carga sin encender en un bloque destruido se pierde, sin cadena.
      this.charges = this.charges.filter(
        (c) => c.column !== cell.column || c.row !== cell.row,
      );
    }
    for (const { cell } of picks)
      if (this.destructible(cell)) {
        this.fractured.add(key(cell.column, cell.row));
        fractured.push(cell);
      }
    return { center: { ...charge }, destroyed, materials, fractured };
  }

  /** Limpia marcas de celdas que ya no son sólidas (excavadas o derrumbadas). */
  forget(cell: Cell): void {
    const k = key(cell.column, cell.row);
    this.drilled.delete(k);
    this.fractured.delete(k);
    this.charges = this.charges.filter(
      (c) => c.column !== cell.column || c.row !== cell.row,
    );
  }

  isDrilled(cell: Cell): boolean {
    return this.drilled.has(key(cell.column, cell.row));
  }
  isFractured(cell: Cell): boolean {
    return this.fractured.has(key(cell.column, cell.row));
  }
}
