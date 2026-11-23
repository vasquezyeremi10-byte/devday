import { GALLERY_AIR as AIR } from '../config/galleryAir';
import {
  Block,
  type Cell,
  type Point,
  type TerrainGrid,
} from '../world/TerrainGrid';
import { VENTILATION, type FanKind } from './VentilationSystem';

export type GalleryAirSupply = 'duct' | FanKind;
export const isGalleryAirSupply = (kind: string): kind is GalleryAirSupply =>
  kind === 'duct' || kind === 'fan_aux' || kind === 'fan_main';
export const AIR_SOURCE = { column: 14, row: 11 };
export const ENTRY_FAN = { column: 15, row: 11 };
const CARDINAL = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
] as const;

export interface GalleryDuct extends Cell {
  integrity: number;
}
export interface GalleryFan extends Cell {
  kind: FanKind;
  direction: number;
  enabled: boolean;
  fixed?: boolean;
}

const offset = (cell: Cell, direction: Point, sign = 1): Cell => ({
  column: cell.column + direction.x * sign,
  row: cell.row + direction.y * sign,
});

export class GalleryVentilation {
  readonly ducts = new Map<number, GalleryDuct>();
  readonly fans = new Map<number, GalleryFan>();
  readonly running = new Set<number>();
  readonly ductAir: Uint8Array;
  readonly quality: Uint8Array;
  readonly flowX: Int8Array;
  readonly flowY: Int8Array;
  private readonly natural: Uint8Array;
  private exposureMs = 0;
  revision = 0;

  constructor(readonly grid: TerrainGrid) {
    const size = grid.columns * grid.rows;
    this.natural = new Uint8Array(size);
    this.quality = new Uint8Array(size);
    this.ductAir = new Uint8Array(size);
    this.flowX = new Int8Array(size);
    this.flowY = new Int8Array(size);
    this.fans.set(this.key(ENTRY_FAN), {
      ...ENTRY_FAN,
      kind: 'fan_main',
      direction: 0,
      enabled: true,
      fixed: true,
    });
  }

  key(cell: Cell): number {
    return cell.row * this.grid.columns + cell.column;
  }

  private cell(key: number): Cell {
    return {
      column: key % this.grid.columns,
      row: Math.floor(key / this.grid.columns),
    };
  }

  at(cell: Cell): number {
    return this.open(cell) ? this.quality[this.key(cell)]! : 0;
  }

  private open(cell: Cell): boolean {
    return (
      this.grid.contains(cell.column, cell.row) &&
      !this.grid.isSolid(cell.column, cell.row)
    );
  }

  fanAt(cell: Cell): GalleryFan | undefined {
    return this.grid.contains(cell.column, cell.row)
      ? this.fans.get(this.key(cell))
      : undefined;
  }

  ductAt(cell: Cell): GalleryDuct | undefined {
    return this.grid.contains(cell.column, cell.row)
      ? this.ducts.get(this.key(cell))
      : undefined;
  }

  direction(fan: GalleryFan): Point {
    return CARDINAL[fan.direction]!;
  }

  check(cell: Cell, kind: GalleryAirSupply): string | null {
    if (!this.open(cell)) return 'EXCAVA ANTES DE INSTALAR';
    if (this.key(cell) === this.key(AIR_SOURCE))
      return 'TOMA DE AIRE PROTEGIDA';
    const duct = this.ductAt(cell);
    if (
      this.fanAt(cell) ||
      (duct && (kind !== 'duct' || duct.integrity === 100))
    )
      return 'YA HAY UN EQUIPO AQUI';
    if (
      kind === 'fan_main' &&
      Math.abs(cell.column - AIR_SOURCE.column) +
        Math.abs(cell.row - AIR_SOURCE.row) >
        AIR.mainRadius
    )
      return 'EL VENTILADOR PRINCIPAL VA JUNTO A LA TOMA';
    return null;
  }

  install(cell: Cell, kind: GalleryAirSupply, facing: Point): boolean {
    if (this.check(cell, kind)) return false;
    if (kind === 'duct')
      this.ducts.set(this.key(cell), { ...cell, integrity: 100 });
    else {
      const direction = Math.max(
        0,
        CARDINAL.findIndex((d) => d.x === facing.x && d.y === facing.y),
      );
      this.fans.set(this.key(cell), {
        ...cell,
        kind,
        direction,
        enabled: true,
      });
    }
    this.evaluate();
    return true;
  }

  toggle(fan: GalleryFan): void {
    fan.enabled = !fan.enabled;
    this.evaluate();
  }

  remove(
    cell: Cell,
  ): { kind: GalleryAirSupply; condition: number } | undefined {
    const fan = this.fanAt(cell),
      duct = this.ductAt(cell);
    if (fan?.fixed || (!fan && !duct)) return;
    this.fans.delete(this.key(cell));
    this.ducts.delete(this.key(cell));
    this.evaluate();
    return fan
      ? { kind: fan.kind, condition: 1 }
      : { kind: 'duct', condition: duct!.integrity / 100 };
  }

  collapse(cells: readonly Cell[]): void {
    for (const cell of cells) {
      const duct = this.ductAt(cell);
      if (duct) duct.integrity = Math.max(0, duct.integrity - AIR.caveInDamage);
    }
    this.evaluate();
  }

  links(cell: Cell): Point[] {
    const duct = this.ductAt(cell);
    if (!this.open(cell) || !duct?.integrity) return [];
    return CARDINAL.filter((d) => {
      const target = offset(cell, d);
      if (!this.open(target)) return false;
      if (this.ductAt(target)?.integrity) return true;
      const fan = this.fanAt(target);
      if (!fan) return false;
      const aim = this.direction(fan);
      return Math.abs(d.x * aim.x + d.y * aim.y) === 1;
    });
  }

  private diffuse(field: Uint8Array, queue: number[]): void {
    for (let head = 0; head < queue.length; head++) {
      const key = queue[head]!;
      const value = field[key]! - AIR.passageLoss;
      if (value <= 0) continue;
      const from = this.cell(key);
      for (const direction of CARDINAL) {
        const to = offset(from, direction),
          index = this.key(to);
        if (!this.open(to) || value <= field[index]!) continue;
        field[index] = value;
        if (!this.ductAir[index]) {
          this.flowX[index] = direction.x;
          this.flowY[index] = direction.y;
        }
        queue.push(index);
      }
    }
  }

  private intake(fan: GalleryFan): number {
    const cell = offset(fan, this.direction(fan), -1);
    if (
      !fan.enabled ||
      !this.open(fan) ||
      !this.open(cell) ||
      !this.open(offset(fan, this.direction(fan)))
    )
      return 0;
    const key = this.key(cell);
    if (fan.kind === 'fan_main')
      return this.natural[key]! >= AIR.mainIntake ? this.natural[key]! : 0;
    const value = Math.max(this.natural[key]!, this.ductAir[key]!);
    return value >= VENTILATION.fans.fan_aux.minIntake * 100 ? value : 0;
  }

  private supply(
    fan: GalleryFan,
    intake: number,
    vents: Map<number, number>,
  ): void {
    this.running.add(this.key(fan));
    const aim = this.direction(fan);
    const first = offset(fan, aim);
    const range = VENTILATION.fans[fan.kind].range;
    // El auxiliar compensa pérdidas, pero cada equipo se activa una sola vez por cálculo.
    const output = Math.min(
      AIR.fresh,
      intake + VENTILATION.fans[fan.kind].boost * 100,
    );
    const emit = (key: number, air: number, dir: Point) => {
      if (air <= (vents.get(key) ?? 0)) return;
      vents.set(key, air);
      if (!this.ductAir[key]) {
        this.flowX[key] = dir.x;
        this.flowY[key] = dir.y;
      }
    };
    if (!this.ductAt(first)?.integrity) {
      emit(this.key(first), output, aim);
      return;
    }
    const queue = [{ cell: first, direction: aim, value: output, depth: 1 }];
    const seen = new Set<number>();
    for (let i = 0; i < queue.length; i++) {
      const { cell, direction, value, depth } = queue[i]!;
      const key = this.key(cell);
      if (seen.has(key)) continue;
      seen.add(key);
      const duct = this.ductAt(cell)!;
      const air = Math.floor(
        value - AIR.ductLoss - AIR.damageLoss * (1 - duct.integrity / 100),
      );
      if (air <= 0) continue;
      if (air > this.ductAir[key]!) {
        this.ductAir[key] = air;
        this.flowX[key] = direction.x;
        this.flowY[key] = direction.y;
      }
      const next = this.links(cell).filter(
        (d) => !!this.ductAt(offset(cell, d))?.integrity,
      );
      if (next.length <= 1 && (depth > 1 || next.length === 0))
        emit(key, air, direction);
      if (depth >= range) continue;
      for (const dir of next)
        queue.push({
          cell: offset(cell, dir),
          direction: dir,
          value: air,
          depth: depth + 1,
        });
    }
  }

  /** Solo se llama ante cambios de conectividad o del equipo. */
  evaluate(): void {
    this.revision++;
    this.natural.fill(0);
    this.ductAir.fill(0);
    this.flowX.fill(0);
    this.flowY.fill(0);
    this.running.clear();
    const source = this.key(AIR_SOURCE);
    if (this.open(AIR_SOURCE)) {
      this.natural[source] = AIR.fresh;
      this.diffuse(this.natural, [source]);
    }
    const vents = new Map<number, number>();
    const auxiliary = new Set<GalleryFan>();
    for (const fan of this.fans.values()) {
      if (fan.kind === 'fan_aux') auxiliary.add(fan);
      else {
        const intake = this.intake(fan);
        if (intake) this.supply(fan, intake, vents);
      }
    }
    // Se amplía el grafo desde tomas válidas. Un ciclo aislado no arranca.
    while (auxiliary.size) {
      let next: GalleryFan | undefined,
        strength = 0;
      for (const fan of auxiliary) {
        const q = this.intake(fan);
        if (q > strength) {
          next = fan;
          strength = q;
        }
      }
      if (!next) break;
      auxiliary.delete(next);
      this.supply(next, strength, vents);
    }
    this.quality.set(this.natural);
    const queue = this.open(AIR_SOURCE) ? [source] : [];
    for (const [key, air] of vents) {
      if (air <= this.quality[key]!) continue;
      this.quality[key] = air;
      queue.push(key);
    }
    this.diffuse(this.quality, queue);
    for (const key of this.ducts.keys())
      this.quality[key] = Math.max(this.quality[key]!, this.ductAir[key]!);
  }

  exposure(cell: Cell, ms: number): number {
    if (this.at(cell) > 0) {
      this.exposureMs = 0;
      return 0;
    }
    this.exposureMs += ms;
    const wait = VENTILATION.exposure.graceMs;
    if (this.exposureMs < wait + AIR.damageIntervalMs) return 0;
    this.exposureMs -= AIR.damageIntervalMs;
    return VENTILATION.exposure.damage.emergency;
  }

  resetExposure(): void {
    this.exposureMs = 0;
  }

  snapshot() {
    return {
      version: 1,
      ducts: [...this.ducts.values()],
      fans: [...this.fans.values()],
      exposureMs: this.exposureMs,
    };
  }

  restore(raw: unknown): void {
    const data = raw as
      Partial<ReturnType<GalleryVentilation['snapshot']>> | undefined;
    if (data?.version === 1) {
      const valid = (c: Cell) =>
        this.grid.contains(c.column, c.row) &&
        (this.open(c) || this.grid.get(c.column, c.row) === Block.Rubble);
      for (const fan of Array.isArray(data.fans) ? data.fans : []) {
        if (
          !fan ||
          !valid(fan) ||
          !Number.isInteger(fan.direction) ||
          fan.direction < 0 ||
          fan.direction >= CARDINAL.length ||
          (fan.kind !== 'fan_main' && fan.kind !== 'fan_aux')
        )
          continue;
        const key = this.key(fan);
        if (key === this.key(AIR_SOURCE)) continue;
        const fixed = key === this.key(ENTRY_FAN);
        this.fans.set(key, {
          column: fan.column,
          row: fan.row,
          direction: fan.direction,
          kind: fixed ? 'fan_main' : fan.kind,
          enabled: fan.enabled !== false,
          ...(fixed ? { fixed: true } : {}),
        });
      }
      for (const duct of Array.isArray(data.ducts) ? data.ducts : []) {
        if (!duct || !valid(duct) || !Number.isFinite(duct.integrity)) continue;
        const key = this.key(duct);
        if (key !== this.key(AIR_SOURCE) && !this.fans.has(key))
          this.ducts.set(key, {
            column: duct.column,
            row: duct.row,
            integrity: Math.max(0, Math.min(100, duct.integrity)),
          });
      }
      if (
        typeof data.exposureMs === 'number' &&
        Number.isFinite(data.exposureMs)
      )
        this.exposureMs = Math.max(
          0,
          Math.min(
            VENTILATION.exposure.graceMs + AIR.damageIntervalMs,
            data.exposureMs,
          ),
        );
    }
    this.evaluate();
  }
}
