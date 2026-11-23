import { TILE_SIZE } from '../config/constants';
import { solidLength } from '../lighting/LightOcclusion';
import {
  Block,
  TerrainGrid,
  type Cell,
  type Point,
} from '../world/TerrainGrid';
import { GEOTECH, RANK, StabilityState, stateOf } from './GeotechnicalSystem';
import { SUPPORT, type SupportKind } from './SupportSystem';

// Parámetros de juego: la luz libre se mide en planta, a una cota fija.
const SECTOR = 4;
const REACH = 5;
const WORK_LOAD = 0.13;
const SUPPORT_RELIEF = { wood: 0.64, steel: 1.08 } as const;
type Axis = 'x' | 'y';
export type GallerySupportSupply = 'wood_beam' | 'steel_beam';
export const isGallerySupportSupply = (
  kind: string,
): kind is GallerySupportSupply =>
  kind === 'wood_beam' || kind === 'steel_beam';
export const supportKind = (kind: GallerySupportSupply): SupportKind =>
  kind === 'wood_beam' ? 'wood' : 'steel';

export interface GallerySupport extends Cell {
  kind: SupportKind;
  axis: Axis;
  durability: number;
}

interface RiskCell {
  cell: Cell;
  score: number;
}

export interface GalleryRisk {
  id: number;
  score: number;
  state: StabilityState;
  cells: RiskCell[];
  remaining?: number;
}

export class GalleryStability {
  readonly supports = new Map<number, GallerySupport>();
  readonly rubble = new Set<number>();
  readonly collapsed = new Set<number>();
  readonly sectors = new Map<number, GalleryRisk>();
  private readonly sectorColumns: number;

  constructor(
    readonly grid: TerrainGrid,
    private readonly dug: ReadonlySet<number>,
    private readonly protectedCell: (cell: Cell) => boolean,
  ) {
    this.sectorColumns = Math.ceil(grid.columns / SECTOR);
  }

  key({ column, row }: Cell): number {
    return row * this.grid.columns + column;
  }

  private cell(key: number): Cell {
    return {
      column: key % this.grid.columns,
      row: Math.floor(key / this.grid.columns),
    };
  }

  at(cell: Cell): GallerySupport | undefined {
    return this.supports.get(this.key(cell));
  }

  check(cell: Cell, kind: SupportKind): string | null {
    if (this.grid.isSolid(cell.column, cell.row))
      return 'EXCAVA ANTES DE INSTALAR';
    if (this.protectedCell(cell)) return 'ACCESO PROTEGIDO';
    const prior = this.at(cell);
    if (prior && (prior.kind !== 'wood' || kind !== 'steel'))
      return 'YA HAY UN MARCO AQUI';
    return null;
  }

  plan(cell: Cell, kind: SupportKind): GallerySupport {
    const axis =
      this.at(cell)?.axis ??
      (this.span(cell, 1, 0).width >= this.span(cell, 0, 1).width ? 'x' : 'y');
    return { ...cell, axis, kind, durability: SUPPORT[kind].durability };
  }

  /** Las vigas pasan sobre el minero; solo los postes tienen huella. */
  static posts(support: GallerySupport): Point[] {
    const { x, y } = TerrainGrid.center(support);
    return [-6, 6].map((offset) => ({
      x: x + (support.axis === 'y' ? offset : 0),
      y: y + (support.axis === 'x' ? offset : 0),
    }));
  }

  clear(point: Point, support?: GallerySupport): boolean {
    const nearby = support
      ? [support]
      : [...this.supports.values()].filter((s) => {
          const p = TerrainGrid.center(s);
          return (
            Math.abs(p.x - point.x) < TILE_SIZE &&
            Math.abs(p.y - point.y) < TILE_SIZE
          );
        });
    return nearby.every((s) =>
      GalleryStability.posts(s).every(
        (post) =>
          Math.abs(point.x - post.x) >= 6.5 ||
          Math.abs(point.y - post.y) >= 4.5,
      ),
    );
  }

  install(support: GallerySupport): void {
    this.supports.set(this.key(support), support);
    this.refresh([support]);
  }

  remove(cell: Cell): GallerySupport | undefined {
    const support = this.at(cell);
    if (!support) return;
    this.supports.delete(this.key(cell));
    this.refresh([cell]);
    return support;
  }

  removalRisk(support: GallerySupport): StabilityState {
    let state: StabilityState = StabilityState.Stable;
    for (const id of this.affected([support])) {
      const before = this.sectors.get(id)?.state ?? StabilityState.Stable;
      const after = this.evaluate(id, this.key(support)).state;
      if (RANK[after] > RANK[before] && RANK[after] > RANK[state])
        state = after;
    }
    return state;
  }

  clearRubble(cell: Cell): void {
    this.rubble.delete(this.key(cell));
    this.refresh([cell]);
  }

  private span(
    cell: Cell,
    dx: number,
    dy: number,
  ): { width: number; strength: number } {
    let width = 1,
      strength = 0;
    for (const direction of [-1, 1]) {
      let block = Block.Rock;
      for (let step = 1; step <= REACH; step++) {
        block = this.grid.get(
          cell.column + dx * direction * step,
          cell.row + dy * direction * step,
        );
        if (block !== Block.Air) break;
        width++;
      }
      strength +=
        block === Block.Dirt
          ? GEOTECH.span.dirt
          : block === Block.HardRock || block === Block.Bedrock
            ? GEOTECH.span.hard
            : GEOTECH.span.rock;
    }
    return { width, strength: strength / 2 };
  }

  private score(cell: Cell, ignored?: number): number {
    let worked = 0;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const near = { column: cell.column + dx, row: cell.row + dy };
        if (
          this.grid.contains(near.column, near.row) &&
          this.dug.has(this.key(near))
        )
          worked++;
      }
    if (!worked) return 0;
    const x = this.span(cell, 1, 0),
      y = this.span(cell, 0, 1);
    const section = x.width <= y.width ? x : y;
    let relief = 0;
    const origin = TerrainGrid.center(cell);
    for (const [key, support] of this.supports) {
      if (key === ignored || support.durability <= 0) continue;
      const dist = Math.hypot(
        cell.column - support.column,
        cell.row - support.row,
      );
      const spec = SUPPORT[support.kind];
      if (dist > spec.reach) continue;
      const target = TerrainGrid.center(support);
      if (
        solidLength(this.grid, origin.x, origin.y, target.x, target.y, 0.001) >=
        0.001
      )
        continue;
      relief = Math.max(
        relief,
        SUPPORT_RELIEF[support.kind] *
          (support.durability / spec.durability) *
          (1 - (0.35 * dist) / spec.reach),
      );
    }
    const load =
      Math.min(worked, 7) * WORK_LOAD * Math.min(1, (section.width - 1) / 2);
    return Math.max(0, section.width / section.strength + load - relief);
  }

  private affected(changed: readonly Cell[]): Set<number> {
    const ids = new Set<number>();
    for (const { column, row } of changed) {
      for (
        let y = Math.floor(Math.max(0, row - REACH) / SECTOR);
        y <= Math.floor(Math.min(this.grid.rows - 1, row + REACH) / SECTOR);
        y++
      )
        for (
          let x = Math.floor(Math.max(0, column - REACH) / SECTOR);
          x <=
          Math.floor(Math.min(this.grid.columns - 1, column + REACH) / SECTOR);
          x++
        )
          ids.add(y * this.sectorColumns + x);
    }
    return ids;
  }

  private evaluate(id: number, ignored?: number): GalleryRisk {
    const x = (id % this.sectorColumns) * SECTOR;
    const y = Math.floor(id / this.sectorColumns) * SECTOR;
    const cells: RiskCell[] = [];
    for (let row = y; row < y + SECTOR; row++)
      for (let column = x; column < x + SECTOR; column++) {
        const cell = { column, row };
        if (!this.grid.isSolid(column, row) && !this.protectedCell(cell)) {
          const score = this.score(cell, ignored);
          if (score >= GEOTECH.watch) cells.push({ cell, score });
        }
      }
    cells.sort((a, b) => b.score - a.score);
    const score = cells[0]?.score ?? 0;
    return { id, score, state: stateOf(score), cells };
  }

  refresh(changed: readonly Cell[]): void {
    for (const id of this.affected(changed)) {
      const next = this.evaluate(id);
      if (next.state === StabilityState.Stable) {
        this.sectors.delete(id);
        continue;
      }
      if (next.state === StabilityState.Imminent) {
        // Misma advertencia que en la vista lateral: 10 s exactos.
        next.remaining = this.sectors.get(id)?.remaining ?? GEOTECH.warningMs;
      }
      this.sectors.set(id, next);
    }
  }

  around(cell: Cell): GalleryRisk | undefined {
    let risk: GalleryRisk | undefined;
    for (const sector of this.sectors.values()) {
      if (
        (!risk || sector.score > risk.score) &&
        sector.cells.some(
          ({ cell: other }) =>
            Math.abs(cell.column - other.column) <= 3 &&
            Math.abs(cell.row - other.row) <= 3,
        )
      )
        risk = sector;
    }
    return risk;
  }

  tick(ms: number): number[] {
    const due: number[] = [];
    for (const sector of this.sectors.values()) {
      if (sector.remaining === undefined) continue;
      sector.remaining = Math.max(0, sector.remaining - ms);
      if (sector.remaining === 0) due.push(sector.id);
    }
    return due;
  }

  collapse(
    id: number,
    occupied: (cell: Cell) => boolean,
  ): { filled: Cell[]; damaged: GallerySupport[] } {
    const sector = this.sectors.get(id);
    if (sector?.remaining !== 0) return { filled: [], damaged: [] };
    const filled = sector.cells
      .filter(
        ({ cell, score }) =>
          score >= GEOTECH.imminent &&
          !this.grid.isSolid(cell.column, cell.row) &&
          !occupied(cell),
      )
      .slice(0, 2)
      .map(({ cell }) => cell);
    const damaged: GallerySupport[] = [];
    if (!filled.length) {
      sector.remaining = GEOTECH.warningMs;
      return { filled, damaged };
    }
    this.collapsed.add(id);
    this.sectors.delete(id);
    for (const cell of filled) {
      const frame = this.at(cell);
      if (frame) {
        frame.durability = 0;
        this.supports.delete(this.key(cell));
        damaged.push(frame);
      }
      this.grid.set(cell.column, cell.row, Block.Rubble);
      this.rubble.add(this.key(cell));
    }
    for (const support of this.supports.values()) {
      if (
        support.durability <= 0 ||
        !filled.some(
          (cell) =>
            Math.abs(cell.column - support.column) <= 2 &&
            Math.abs(cell.row - support.row) <= 2,
        )
      )
        continue;
      support.durability = Math.max(
        0,
        support.durability - SUPPORT[support.kind].shock,
      );
      damaged.push(support);
    }
    this.refresh([...filled, ...damaged]);
    return { filled, damaged };
  }

  snapshot() {
    return {
      version: 1,
      supports: [...this.supports.values()],
      rubble: [...this.rubble],
      collapsed: [...this.collapsed],
      countdowns: [...this.sectors.values()].flatMap((s) =>
        s.remaining === undefined ? [] : [{ id: s.id, remaining: s.remaining }],
      ),
    };
  }

  restore(raw: unknown): void {
    const data = raw as Partial<
      ReturnType<GalleryStability['snapshot']>
    > | null;
    if (data?.version === 1) {
      for (const index of Array.isArray(data.rubble) ? data.rubble : []) {
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= this.grid.rows * this.grid.columns
        )
          continue;
        const cell = this.cell(index);
        if (
          this.grid.isSolid(cell.column, cell.row) ||
          this.protectedCell(cell)
        )
          continue;
        this.rubble.add(index);
        this.grid.set(cell.column, cell.row, Block.Rubble);
      }
      for (const s of Array.isArray(data.supports) ? data.supports : []) {
        if (
          !s ||
          (s.kind !== 'wood' && s.kind !== 'steel') ||
          (s.axis !== 'x' && s.axis !== 'y') ||
          !Number.isFinite(s.durability) ||
          this.check(s, s.kind)
        )
          continue;
        this.supports.set(this.key(s), {
          ...s,
          durability: Math.max(
            0,
            Math.min(s.durability, SUPPORT[s.kind].durability),
          ),
        });
      }
      for (const id of Array.isArray(data.collapsed) ? data.collapsed : [])
        if (
          Number.isInteger(id) &&
          id >= 0 &&
          id < this.sectorColumns * Math.ceil(this.grid.rows / SECTOR)
        )
          this.collapsed.add(id);
    }
    this.refresh([...this.dug].map((index) => this.cell(index)));
    if (data?.version !== 1 || !Array.isArray(data.countdowns)) return;
    for (const saved of data.countdowns) {
      if (!saved || !Number.isFinite(saved.remaining)) continue;
      const risk = this.sectors.get(saved.id);
      if (risk?.remaining !== undefined)
        risk.remaining = Math.min(risk.remaining, Math.max(0, saved.remaining));
    }
  }
}
