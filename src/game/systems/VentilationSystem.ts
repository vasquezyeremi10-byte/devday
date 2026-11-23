import { surfaceRow, type Cell, type TerrainGrid } from '../world/TerrainGrid';

/**
 * Circulación de aire simplificada (modelo de juego). El aire limpio entra
 * por el cielo abierto y avanza por galerías conectadas; cada bloque recorrido
 * le quita calidad, más a mayor profundidad. Ductos conectados a un
 * ventilador funcionando llevan aire limpio lejos de la entrada. Las
 * tronaduras contaminan el aire de forma temporal. No hay un "corte" de
 * oxígeno a una profundidad fija: la calidad depende del recorrido real.
 */
export const VENTILATION = {
  /** Pérdida de calidad por bloque de recorrido y extra por fila de profundidad. */
  step: 0.012,
  depthStep: 0.0013,
  fans: {
    fan_aux: { range: 12, boost: 0.35, minIntake: 0.45 },
    fan_main: { range: 30, boost: 1, minIntake: 0 },
  },
  /** Contaminación de una tronadura y su disipación por segundo. */
  blast: { amount: 0.6, radius: 6, decay: 0.02 },
  /** Cada ocupante consume un poco de aire de su celda (trabajadores futuros). */
  occupant: 0.03,
  thresholds: { adequate: 0.6, poor: 0.4, dangerous: 0.2 },
  /** Calidad del aire que traen las corrientes naturales de las cavernas. */
  naturalVent: 0.85,
  /** Efectos sobre el jugador: margen antes del daño y daño por segundo. */
  exposure: {
    graceMs: 6000,
    damage: { dangerous: 1.5, emergency: 4 },
    slow: { dangerous: 0.8, emergency: 0.6 },
  },
} as const;

export const AirState = {
  Adequate: 'ADECUADA',
  Poor: 'DEFICIENTE',
  Dangerous: 'AIRE PELIGROSO',
  Emergency: 'EMERGENCIA AMBIENTAL',
} as const;
export type AirState = (typeof AirState)[keyof typeof AirState];

export const airStateOf = (q: number): AirState =>
  q >= VENTILATION.thresholds.adequate
    ? AirState.Adequate
    : q >= VENTILATION.thresholds.poor
      ? AirState.Poor
      : q >= VENTILATION.thresholds.dangerous
        ? AirState.Dangerous
        : AirState.Emergency;

export type FanKind = 'fan_aux' | 'fan_main';
export interface Fan extends Cell {
  id: number;
  kind: FanKind;
}
export interface FanStatus {
  id: number;
  kind: FanKind;
  running: boolean;
  ducts: number;
  reason: string;
}

export class VentilationSystem {
  readonly quality: Float32Array;
  readonly pollution: Float32Array;
  ducts: Cell[] = [];
  fans: Fan[] = [];
  nextId = 1;
  status: FanStatus[] = [];
  private readonly natural: Float32Array;

  constructor(readonly grid: TerrainGrid) {
    const size = grid.columns * grid.rows;
    this.quality = new Float32Array(size);
    this.pollution = new Float32Array(size);
    this.natural = new Float32Array(size);
  }

  private index(c: number, r: number): number {
    return this.grid.index(c, r);
  }

  at(column: number, row: number): number {
    if (!this.grid.contains(column, row)) return 0;
    return this.quality[this.index(column, row)]!;
  }

  hasDuct(column: number, row: number): boolean {
    return this.ducts.some((d) => d.column === column && d.row === row);
  }

  /** Instalación de equipos: solo en aire, apoyados en un sólido cercano. */
  check(cell: Cell, kind: 'duct' | FanKind): string | null {
    const g = this.grid;
    if (g.isSolid(cell.column, cell.row)) return 'EXCAVA ANTES DE INSTALAR';
    if (
      this.hasDuct(cell.column, cell.row) ||
      this.fans.some((f) => f.column === cell.column && f.row === cell.row)
    )
      return 'YA HAY UN EQUIPO AQUI';
    if (kind === 'fan_main' && cell.row >= surfaceRow(cell.column))
      return 'EL VENTILADOR PRINCIPAL VA EN SUPERFICIE';
    if (kind !== 'duct' && !g.isSolid(cell.column, cell.row + 1))
      return 'EL VENTILADOR NECESITA PISO';
    return null;
  }

  install(cell: Cell, kind: 'duct' | FanKind): boolean {
    if (this.check(cell, kind)) return false;
    if (kind === 'duct') this.ducts.push({ ...cell });
    else this.fans.push({ ...cell, id: this.nextId++, kind });
    return true;
  }

  /** Retira equipos enterrados por un derrumbe (quedan obstruidos). */
  prune(): void {
    this.ducts = this.ducts.filter((d) => !this.grid.isSolid(d.column, d.row));
    this.fans = this.fans.filter((f) => !this.grid.isSolid(f.column, f.row));
  }

  /** Contaminación temporal alrededor de una tronadura. */
  pollute(center: Cell): void {
    const { amount, radius } = VENTILATION.blast;
    for (let r = center.row - radius; r <= center.row + radius; r++)
      for (let c = center.column - radius; c <= center.column + radius; c++) {
        if (!this.grid.contains(c, r)) continue;
        const d = Math.hypot(c - center.column, r - center.row);
        if (d > radius) continue;
        const i = this.index(c, r);
        this.pollution[i] = Math.min(
          1,
          this.pollution[i]! + amount * (1 - d / (radius + 1)),
        );
      }
  }

  /** Disipación de la contaminación con el tiempo. */
  decay(ms: number): boolean {
    let any = false;
    const step = (VENTILATION.blast.decay * ms) / 1000;
    for (let i = 0; i < this.pollution.length; i++)
      if (this.pollution[i]! > 0) {
        this.pollution[i] = Math.max(0, this.pollution[i]! - step);
        any = true;
      }
    return any;
  }

  /** Propagación de aire por galerías conectadas (máximo por celda). */
  private spread(field: Float32Array, seeds: number[]): void {
    const g = this.grid,
      queue = [...seeds];
    // Cola con cabeza móvil: el mundo abierto siembra miles de celdas de cielo.
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head]!;
      const { column: c, row: r } = g.cellOf(i);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const x = c + dx,
          y = r + dy;
        if (!g.contains(x, y) || g.isSolid(x, y)) continue;
        const loss =
          VENTILATION.step +
          Math.max(0, y - surfaceRow(x)) * VENTILATION.depthStep;
        const n = this.index(x, y);
        const next = field[i]! - loss;
        if (next > field[n]! + 1e-6) {
          field[n] = next;
          queue.push(n);
        }
      }
    }
  }

  /** Recalcula la red: aire natural, ventiladores, ductos y contaminación. */
  evaluate(occupants: Cell[] = []): void {
    const g = this.grid;
    this.natural.fill(0);
    const seeds: number[] = [];
    // Cielo abierto: aire pleno. Solo se siembran las celdas de cielo que
    // tocan aire bajo la superficie: entre celdas de cielo (todas en 1) la
    // propagación nunca mejora nada, así que el resultado es el mismo y el
    // mundo abierto no recorre miles de celdas de cielo en cada excavación.
    const below = (x: number, y: number) =>
      g.contains(x, y) && y >= surfaceRow(x) && !g.isSolid(x, y);
    for (let c = g.first; c < g.end; c++) {
      const top = surfaceRow(c);
      for (let r = 0; r < top; r++)
        if (!g.isSolid(c, r)) {
          const i = this.index(c, r);
          this.natural[i] = 1;
          if (
            below(c, r + 1) ||
            below(c - 1, r) ||
            below(c + 1, r) ||
            below(c, r - 1)
          )
            seeds.push(i);
        }
    }
    // Corrientes de aire de las cavernas naturales (geología rev. 2).
    for (const v of g.vents)
      if (g.contains(v.column, v.row) && !g.isSolid(v.column, v.row)) {
        const i = this.index(v.column, v.row);
        this.natural[i] = VENTILATION.naturalVent;
        seeds.push(i);
      }
    this.spread(this.natural, seeds);
    this.quality.set(this.natural);
    // Ductos alimentados: cadena 4-conexa desde cada ventilador.
    this.status = [];
    const fanSeeds: number[] = [];
    for (const fan of this.fans) {
      const spec = VENTILATION.fans[fan.kind];
      const intake = this.natural[this.index(fan.column, fan.row)]!;
      if (intake < spec.minIntake) {
        this.status.push({
          id: fan.id,
          kind: fan.kind,
          running: false,
          ducts: 0,
          reason: 'TOMA DE AIRE VICIADA',
        });
        continue;
      }
      const output = Math.min(
        1,
        fan.kind === 'fan_main' ? 1 : intake + spec.boost,
      );
      const seen = new Set<string>([`${fan.column},${fan.row}`]);
      const frontier: Cell[] = [{ column: fan.column, row: fan.row }];
      let count = 0;
      this.quality[this.index(fan.column, fan.row)] = Math.max(
        this.quality[this.index(fan.column, fan.row)]!,
        output,
      );
      fanSeeds.push(this.index(fan.column, fan.row));
      while (frontier.length && count < spec.range) {
        const cur = frontier.shift()!;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const x = cur.column + dx,
            y = cur.row + dy,
            key = `${x},${y}`;
          if (seen.has(key) || !this.hasDuct(x, y) || count >= spec.range)
            continue;
          seen.add(key);
          count++;
          const i = this.index(x, y);
          this.quality[i] = Math.max(this.quality[i]!, output);
          fanSeeds.push(i);
          frontier.push({ column: x, row: y });
        }
      }
      this.status.push({
        id: fan.id,
        kind: fan.kind,
        running: true,
        ducts: count,
        reason: count ? 'FUNCIONANDO' : 'SIN DUCTOS CONECTADOS',
      });
    }
    if (fanSeeds.length) this.spread(this.quality, fanSeeds);
    for (const o of occupants)
      if (g.contains(o.column, o.row)) {
        const i = this.index(o.column, o.row);
        this.quality[i] = Math.max(0, this.quality[i]! - VENTILATION.occupant);
      }
    for (let i = 0; i < this.quality.length; i++)
      this.quality[i] = Math.max(0, this.quality[i]! - this.pollution[i]!);
  }
}
