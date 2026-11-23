import { BALANCE, MATERIAL_KG, type Material } from '../config/balance';
import { TILE_SIZE } from '../config/constants';
import {
  Block,
  TerrainGrid,
  type Cell,
  type Point,
} from '../world/TerrainGrid';
import { InventorySystem } from './InventorySystem';

export const GALLERY_CARGO_LIMIT = 4;
export const GALLERY_CART_LIMIT = 20;
export const GALLERY_STATION = { column: 14, row: 13 };
export const CART_RADIUS = 5;
const START = { column: 17, row: 13 };
const SPACING = 18;
const SIDES = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

export class GalleryRailway {
  readonly segments = new Set<number>();
  readonly inventory = new InventorySystem(BALANCE.cartCapacity);
  readonly delivered: Material[] = [];
  private at: number;
  private to: number | null = null;
  private rear: number | null = null;
  private distance = 0;
  private speed = 0;
  pushing = false;
  travelled = 0;

  constructor(
    readonly grid: TerrainGrid,
    private readonly elevation: (cell: Cell) => number = () => 0,
  ) {
    for (let column = GALLERY_STATION.column; column <= START.column; column++)
      this.segments.add(this.key({ column, row: START.row }));
    this.at = this.key(START);
  }

  key({ column, row }: Cell): number {
    return row * this.grid.columns + column;
  }

  cell(index: number): Cell {
    return {
      column: index % this.grid.columns,
      row: Math.floor(index / this.grid.columns),
    };
  }

  private neighbors(cell: Cell, travel = true): number[] {
    if (travel && this.grid.isSolid(cell.column, cell.row)) return [];
    return SIDES.flatMap(([dx, dy]) => {
      const other = { column: cell.column + dx, row: cell.row + dy };
      const id = this.key(other);
      return this.grid.contains(other.column, other.row) &&
        (!travel || !this.grid.isSolid(other.column, other.row)) &&
        this.segments.has(id) &&
        Math.abs(this.elevation(cell) - this.elevation(other)) <= 1
        ? [id]
        : [];
    });
  }

  connections(cell: Cell): Point[] {
    return this.neighbors(cell).map((id) => {
      const other = this.cell(id);
      return { x: other.column - cell.column, y: other.row - cell.row };
    });
  }

  has(cell: Cell): boolean {
    return (
      this.grid.contains(cell.column, cell.row) &&
      this.segments.has(this.key(cell))
    );
  }

  placementProblem(cell: Cell): string | null {
    if (this.grid.isSolid(cell.column, cell.row))
      return 'EXCAVA ANTES DE COLOCAR RIELES';
    if (this.has(cell)) return 'YA HAY VIA';
    const ends = this.neighbors(cell, false);
    if (!this.neighbors(cell).length)
      return 'CONTINUA DESDE UNA VIA. DESNIVEL MAXIMO: UN BLOQUE';
    if (
      ends.length > 2 ||
      ends.some((id) => this.neighbors(this.cell(id), false).length >= 2)
    )
      return 'NO SE PERMITEN CRUCES NI BIFURCACIONES';
    return null;
  }

  place(cell: Cell): boolean {
    if (this.placementProblem(cell)) return false;
    this.segments.add(this.key(cell));
    return true;
  }

  removalProblem(cell: Cell): string | null {
    if (!this.has(cell)) return 'NO HAY VIA';
    if (this.key(cell) === this.key(GALLERY_STATION))
      return 'TRAMO FIJO DE LA ESTACION';
    return this.occupies(cell) ? 'EL CARRITO OCUPA ESE TRAMO' : null;
  }

  occupies(cell: Cell): boolean {
    const center = TerrainGrid.center(cell);
    const p = this.point;
    return (
      this.key(cell) === this.at ||
      this.key(cell) === this.to ||
      (Math.abs(center.x - p.x) < TILE_SIZE / 2 + CART_RADIUS &&
        Math.abs(center.y - p.y) < TILE_SIZE / 2 + CART_RADIUS)
    );
  }

  remove(cell: Cell): boolean {
    return !this.removalProblem(cell) && this.segments.delete(this.key(cell));
  }

  private center(id: number): Point {
    return TerrainGrid.center(this.cell(id));
  }

  private along(a: Point, b: Point, distance: number): Point {
    return {
      x: a.x + ((b.x - a.x) * distance) / TILE_SIZE,
      y: a.y + ((b.y - a.y) * distance) / TILE_SIZE,
    };
  }

  get point(): Point {
    const a = this.center(this.at);
    return this.to === null
      ? a
      : this.along(a, this.center(this.to), this.distance);
  }

  get heading(): Point {
    const a = this.center(this.at);
    if (this.to !== null) {
      const b = this.center(this.to);
      return { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) };
    }
    const b =
      this.rear === null
        ? { x: a.x + TILE_SIZE, y: a.y }
        : this.center(this.rear);
    return { x: Math.sign(a.x - b.x), y: Math.sign(a.y - b.y) };
  }

  get atStation(): boolean {
    return this.distance === 0 && this.at === this.key(GALLERY_STATION);
  }

  get space(): number {
    return GALLERY_CART_LIMIT - this.inventory.items.length;
  }

  load(from: InventorySystem): number {
    return this.pushing ? 0 : from.transferTo(this.inventory, this.space);
  }

  unload(): number {
    if (!this.atStation || this.pushing) return 0;
    const count = this.inventory.items.length;
    this.delivered.push(...this.inventory.items.splice(0));
    return count;
  }

  clear(p: Point, rx: number, ry: number): boolean {
    return [-rx, rx].every((dx) =>
      [-ry, ry].every((dy) => {
        const { column, row } = TerrainGrid.worldToCell(p.x + dx, p.y + dy);
        return !this.grid.isSolid(column, row);
      }),
    );
  }

  private stance(
    at: number,
    to: number,
    rear: number | null,
    distance: number,
  ): Point {
    const here = this.center(at),
      ahead = this.center(to);
    const back = SPACING - distance;
    if (back <= 0 || rear === null) return this.along(here, ahead, -back);
    const behind = this.center(rear);
    if (back <= TILE_SIZE) return this.along(here, behind, back);
    const prior = this.neighbors(this.cell(rear)).find((id) => id !== at);
    return prior === undefined
      ? this.along(here, behind, back)
      : this.along(behind, this.center(prior), back - TILE_SIZE);
  }

  start(
    player: Point,
    playerClear: (p: Point) => boolean = () => true,
  ): boolean {
    if (this.pushing) return false;
    const options =
      this.to === null
        ? this.neighbors(this.cell(this.at)).map((to) => ({
            at: this.at,
            to,
            distance: 0,
          }))
        : [
            { at: this.at, to: this.to, distance: this.distance },
            { at: this.to, to: this.at, distance: TILE_SIZE - this.distance },
          ];
    const ranked = options
      .map((option) => {
        const { at, to, distance } = option;
        const rear =
          this.neighbors(this.cell(at)).find((id) => id !== to) ?? null;
        const stance = this.stance(at, to, rear, distance);
        return {
          ...option,
          rear,
          stance,
          gap: Math.hypot(player.x - stance.x, player.y - stance.y),
        };
      })
      .sort((a, b) => a.gap - b.gap);
    const choice = ranked.find(
      ({ gap, stance }) =>
        gap <= 9 &&
        this.clear(stance, 4.9, 2.9) &&
        playerClear(stance) &&
        this.clear(
          { x: (player.x + stance.x) / 2, y: (player.y + stance.y) / 2 },
          4.9,
          2.9,
        ),
    );
    if (!choice) return false;
    this.at = choice.at;
    this.to = choice.to;
    this.rear = choice.rear;
    this.distance = choice.distance;
    this.pushing = true;
    return true;
  }

  stop(): void {
    this.pushing = false;
    this.speed = 0;
    if (this.distance === 0) this.to = null;
  }

  step(
    dt: number,
    playerClear: (p: Point) => boolean = () => true,
  ): Point | undefined {
    if (!this.pushing || this.to === null) return;
    if (!this.neighbors(this.cell(this.at)).includes(this.to)) {
      this.stop();
      return;
    }
    const seconds = Math.min(50, Math.max(0, dt)) / 1000;
    this.speed = Math.min(
      BALANCE.cartSpeed,
      this.speed + BALANCE.cartAcceleration * seconds,
    );
    const next = Math.min(TILE_SIZE, this.distance + seconds * this.speed);
    const player = this.stance(this.at, this.to, this.rear, next);
    const p = this.along(this.center(this.at), this.center(this.to), next);
    if (
      !this.clear(p, CART_RADIUS, CART_RADIUS) ||
      !this.clear(player, 4.9, 2.9) ||
      !playerClear(player) ||
      (Math.abs(p.x - player.x) < CART_RADIUS + 5 &&
        Math.abs(p.y - player.y) < CART_RADIUS + 3)
    ) {
      this.stop();
      return;
    }
    this.travelled += next - this.distance;
    this.distance = next;
    if (next === TILE_SIZE) {
      this.rear = this.at;
      this.at = this.to;
      this.distance = 0;
      this.to =
        this.neighbors(this.cell(this.at)).find((id) => id !== this.rear) ??
        null;
      if (
        this.to === null ||
        (this.atStation && this.inventory.items.length > 0)
      )
        this.stop();
    }
    return player;
  }

  snapshot() {
    return {
      version: 1,
      segments: [...this.segments].sort((a, b) => a - b),
      at: this.at,
      to: this.to,
      rear: this.rear,
      distance: this.distance,
      pushing: this.pushing,
      items: this.inventory.items,
      delivered: this.delivered,
    };
  }

  restore(raw: unknown): void {
    if (!raw || typeof raw !== 'object') return;
    const data = raw as Partial<ReturnType<GalleryRailway['snapshot']>>;
    if (data.version !== 1) return;
    if (Array.isArray(data.segments)) {
      const valid = data.segments.filter((id) => {
        if (
          !Number.isInteger(id) ||
          id < 0 ||
          id >= this.grid.columns * this.grid.rows
        )
          return false;
        const { column, row } = this.cell(id);
        return (
          !this.grid.isSolid(column, row) ||
          this.grid.get(column, row) === Block.Rubble
        );
      });
      if (valid.includes(this.key(GALLERY_STATION))) {
        const initial = [...this.segments];
        this.segments.clear();
        valid.forEach((id) => this.segments.add(id));
        if (
          valid.some((id) => this.neighbors(this.cell(id), false).length > 2)
        ) {
          this.segments.clear();
          initial.forEach((id) => this.segments.add(id));
        }
      }
    }
    this.at =
      typeof data.at === 'number' && this.segments.has(data.at)
        ? data.at
        : this.key(GALLERY_STATION);
    const linked = this.neighbors(this.cell(this.at));
    this.rear =
      typeof data.rear === 'number' && linked.includes(data.rear)
        ? data.rear
        : null;
    if (
      typeof data.to === 'number' &&
      linked.includes(data.to) &&
      typeof data.distance === 'number' &&
      data.distance > 0 &&
      data.distance < TILE_SIZE
    ) {
      this.to = data.to;
      this.distance = data.distance;
    }
    const materials = (items: unknown) =>
      Array.isArray(items)
        ? items.filter(
            (item): item is Material =>
              typeof item === 'string' && Object.hasOwn(MATERIAL_KG, item),
          )
        : [];
    this.inventory.items.push(
      ...materials(data.items).slice(0, GALLERY_CART_LIMIT),
    );
    this.delivered.push(...materials(data.delivered));
    // La posición se conserva aun a mitad del tramo. Z reanuda el empuje.
    this.pushing = false;
  }
}
