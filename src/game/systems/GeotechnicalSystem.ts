import {
  Block,
  surfaceRow,
  type Cell,
  type TerrainGrid,
} from '../world/TerrainGrid';
import { SUPPORT, type SupportSystem } from './SupportSystem';

/**
 * Estabilidad simplificada de galerías. Modelo de videojuego: no es una
 * predicción geotécnica real. Cada tramo de techo sin sostener entre dos
 * pilares (o marcos) recibe una puntuación:
 *
 *   carga = luz libre / luz admisible + exceso de altura + daño por tronadura
 *
 * La luz admisible depende del material del techo y baja con la profundidad.
 */
export const GEOTECH = {
  /** Luz libre admisible por material del techo (bloques). */
  span: { dirt: 4, rock: 6, hard: 8 },
  /** Reducción de la luz admisible por fila bajo la superficie (máx. 30 %). */
  depthLoss: 0.012,
  /** Penalización por cada bloque de altura sobre 2. */
  heightLoss: 0.15,
  /** Umbrales de estado. */
  watch: 0.75,
  danger: 1.0,
  imminent: 1.3,
  /**
   * Advertencia antes del desprendimiento: 10 segundos exactos de tiempo de
   * simulación desde que un tramo entra en colapso inminente.
   */
  warningMs: 10_000,
  /** Daño de tronadura: valor sumado y recuperación por segundo. */
  blastDamage: 0.35,
  damageDecay: 0.004,
} as const;

export const StabilityState = {
  Stable: 'ESTABLE',
  Watch: 'VIGILANCIA',
  Danger: 'PELIGRO',
  Imminent: 'COLAPSO INMINENTE',
} as const;
export type StabilityState =
  (typeof StabilityState)[keyof typeof StabilityState];

export interface Span {
  /** Clave estable: fila del techo y primera columna del tramo. */
  key: string;
  roof: number;
  from: number;
  to: number;
  score: number;
  state: StabilityState;
}
export interface Collapse {
  key: string;
  span: Span;
  /** Milisegundos restantes hasta el derrumbe. */
  remaining: number;
  total: number;
}

/** Bloque del techo que se desprendió: ya no está en la cuadrícula. */
export interface Detached extends Cell {
  block: Block;
}

/**
 * Zona que sacude un derrumbe: el tramo y tres bloques a cada lado. Los
 * marcos dentro de ella reciben el golpe (SupportSystem.shock); uno ya
 * gastado puede ceder y dejar sin sostén al tramo vecino.
 */
export function shockZone(span: Span): { center: Cell; radius: number } {
  return {
    center: { column: Math.round((span.from + span.to) / 2), row: span.roof },
    radius: Math.ceil((span.to - span.from) / 2) + 3,
  };
}

/** Orden de gravedad de los estados. */
export const RANK: Record<StabilityState, number> = {
  [StabilityState.Stable]: 0,
  [StabilityState.Watch]: 1,
  [StabilityState.Danger]: 2,
  [StabilityState.Imminent]: 3,
};

export const stateOf = (score: number): StabilityState =>
  score >= GEOTECH.imminent
    ? StabilityState.Imminent
    : score >= GEOTECH.danger
      ? StabilityState.Danger
      : score >= GEOTECH.watch
        ? StabilityState.Watch
        : StabilityState.Stable;

/** Tramos de techo sin sostener en galerías excavadas bajo la superficie. */
export function evaluateSpans(
  grid: TerrainGrid,
  supports: SupportSystem,
  damage: Float32Array,
  worked: (column: number, row: number) => boolean = () => true,
  /** Techo reforzado por una estructura (piso de una vía): no se desprende. */
  reinforced: (column: number, row: number) => boolean = () => false,
): Span[] {
  const spans: Span[] = [];
  for (let r = 1; r < grid.rows - 1; r++) {
    // Descarte rápido sin llamadas: un techo exige aire en la fila y sólido
    // encima. Casi todo el mundo (roca maciza o cielo) se descarta aquí.
    const here = grid.cells[r]!,
      above = grid.cells[r - 1]!;
    let c = grid.first;
    while (c < grid.end) {
      const i = c - grid.first;
      if (here[i] !== Block.Air || above[i] === Block.Air) {
        c++;
        continue;
      }
      // Techo: sólido sobre aire excavado bajo la superficie, sin marco.
      // Las cavernas naturales son estables: solo cuenta lo trabajado.
      const roofed = (x: number) =>
        !grid.isSolid(x, r) &&
        worked(x, r) &&
        grid.isSolid(x, r - 1) &&
        grid.get(x, r - 1) !== Block.Bedrock &&
        r - 1 >= surfaceRow(x) &&
        !reinforced(x, r - 1);
      if (!roofed(c) || supports.covers(c, r - 1)) {
        c++;
        continue;
      }
      const from = c;
      let height = 0,
        hurt = 0,
        limitSum = 0;
      while (c < grid.end && roofed(c) && !supports.covers(c, r - 1)) {
        let h = 0;
        while (h < 6 && !grid.isSolid(c, r + h)) h++;
        height = Math.max(height, h);
        hurt = Math.max(hurt, damage[grid.index(c, r - 1)] ?? 0);
        const roof = grid.get(c, r - 1);
        const base =
          roof === Block.Dirt || roof === Block.Rubble
            ? GEOTECH.span.dirt
            : roof === Block.HardRock
              ? GEOTECH.span.hard
              : GEOTECH.span.rock;
        const depth = Math.min(
          0.3,
          Math.max(0, r - 1 - surfaceRow(c)) * GEOTECH.depthLoss,
        );
        limitSum += base * (1 - depth);
        c++;
      }
      const length = c - from,
        limit = limitSum / length;
      const score =
        length / limit + Math.max(0, height - 2) * GEOTECH.heightLoss + hurt;
      spans.push({
        key: `${r - 1}:${from}`,
        roof: r - 1,
        from,
        to: c - 1,
        score,
        state: stateOf(score),
      });
    }
  }
  return spans;
}

/**
 * Gestor de estabilidad: evalúa tramos, abre cuentas regresivas solo cuando
 * un tramo llega a colapso inminente y las cancela si se estabiliza. Nunca
 * genera derrumbes al azar sin señales previas.
 *
 * Ciclo de un derrumbe: el tramo pasa a inminente → advertencia de
 * `GEOTECH.warningMs` (10 s) → `tick` lo entrega → `release` desprende los
 * bloques del techo, que caen con física propia (FallingBlocks) y se asientan
 * como escombro. Mientras caen, la evaluación queda en suspenso
 * (`suspended`): el estado a medio derrumbe no abre advertencias nuevas.
 */
export class GeotechnicalSystem {
  spans: Span[] = [];
  readonly collapses = new Map<string, Collapse>();
  readonly damage: Float32Array;
  /** Derrumbe en curso: `evaluate` no hace nada hasta que todo se asiente. */
  suspended = false;
  /** Queda daño de tronadura por disipar (evita recorrer el mapa en vano). */
  private damaged = false;

  constructor(
    readonly grid: TerrainGrid,
    readonly supports: SupportSystem,
    private readonly worked: (column: number, row: number) => boolean = () =>
      true,
    private readonly reinforced: (
      column: number,
      row: number,
    ) => boolean = () => false,
  ) {
    this.damage = new Float32Array(grid.columns * grid.rows);
  }

  evaluate(): void {
    if (this.suspended) return;
    this.spans = evaluateSpans(
      this.grid,
      this.supports,
      this.damage,
      this.worked,
      this.reinforced,
    );
    const previous = [...this.collapses.values()];
    const active = new Set<string>();
    for (const span of this.spans) {
      if (span.state !== StabilityState.Imminent) continue;
      active.add(span.key);
      const existing = this.collapses.get(span.key);
      if (existing) {
        existing.span = span;
        continue;
      }
      // El mismo techo con otro largo (se ensanchó la galería o cambió un
      // marco) no es un derrumbe nuevo: hereda el tiempo que ya corría. Así
      // seguir excavando no reinicia la advertencia.
      let remaining: number = GEOTECH.warningMs;
      for (const old of previous)
        if (
          old.span.roof === span.roof &&
          old.span.from <= span.to &&
          old.span.to >= span.from
        )
          remaining = Math.min(remaining, old.remaining);
      this.collapses.set(span.key, {
        key: span.key,
        span,
        remaining,
        total: GEOTECH.warningMs,
      });
    }
    // Sostenimiento a tiempo: la cuenta regresiva se cancela.
    for (const key of [...this.collapses.keys()])
      if (!active.has(key)) this.collapses.delete(key);
  }

  /**
   * Estado que tendría el techo si se retirara un marco: peor tramo que
   * queda bajo el techo de ese marco dentro de su alcance. No modifica nada.
   */
  simulateWithout(supportId: number): {
    before: StabilityState;
    after: StabilityState;
  } {
    const target = this.supports.items.find((s) => s.id === supportId);
    if (!target)
      return { before: StabilityState.Stable, after: StabilityState.Stable };
    const reach = SUPPORT[target.kind].reach;
    const worst = (spans: Span[]) =>
      spans
        .filter(
          (s) =>
            s.roof === target.roof &&
            s.to >= target.column - reach - 1 &&
            s.from <= target.column + reach + 1,
        )
        .reduce<StabilityState>(
          (acc, s) => (RANK[s.state] > RANK[acc] ? s.state : acc),
          StabilityState.Stable,
        );
    const without = Object.assign(
      Object.create(Object.getPrototypeOf(this.supports)),
      {
        ...this.supports,
        items: this.supports.items.filter((s) => s.id !== supportId),
      },
    ) as SupportSystem;
    return {
      before: worst(this.spans),
      after: worst(
        evaluateSpans(
          this.grid,
          without,
          this.damage,
          this.worked,
          this.reinforced,
        ),
      ),
    };
  }

  /**
   * Avanza las cuentas con tiempo de simulación; devuelve los tramos que
   * deben desprenderse ahora. `room` es cuántos bloques más admite la
   * simulación de caída: un tramo que no cabe espera en cero (sin perder su
   * turno) hasta que haya lugar. Sin nada cayendo, el primero siempre sale.
   */
  tick(ms: number, room = Infinity, idle = true): Collapse[] {
    const due: Collapse[] = [];
    for (const collapse of this.collapses.values()) {
      collapse.remaining = Math.max(0, collapse.remaining - ms);
      if (collapse.remaining > 0) continue;
      const size = collapse.span.to - collapse.span.from + 1;
      if (size > room && !(idle && !due.length)) continue;
      room -= size;
      due.push(collapse);
    }
    for (const c of due) this.collapses.delete(c.key);
    if (this.damaged) {
      // Solo mientras quede daño de tronadura: el resto del tiempo no se
      // recorre el mapa.
      const step = (GEOTECH.damageDecay * ms) / 1000;
      let any = false;
      for (let i = 0; i < this.damage.length; i++)
        if (this.damage[i]! > 0) {
          this.damage[i] = Math.max(0, this.damage[i]! - step);
          if (this.damage[i]! > 0) any = true;
        }
      this.damaged = any;
    }
    return due;
  }

  /** Daño de tronadura en el techo cercano (radio en bloques). */
  shake(center: Cell, radius: number): void {
    this.damaged = true;
    for (let r = center.row - radius; r <= center.row + radius; r++)
      for (let c = center.column - radius; c <= center.column + radius; c++)
        if (this.grid.contains(c, r)) {
          const i = this.grid.index(c, r);
          this.damage[i] = Math.min(1, this.damage[i]! + GEOTECH.blastDamage);
        }
  }

  /**
   * Desprendimiento: los bloques del techo del tramo se sueltan y salen de
   * la cuadrícula (los devuelve para que caigan con FallingBlocks). Es local:
   * solo el techo del tramo, nunca fuera de él.
   *
   * Efecto arco: en un tramo de tres o más bloques los dos extremos quedan
   * colgados de la roca firme de los costados. El hueco que deja el
   * desprendimiento es más angosto que la galería, así que cada derrumbe
   * sucesivo abarca menos y la bóveda se estabiliza sola: un derrumbe no
   * arrastra el mapa. `keep` protege bloques que no deben caer; `max` limita
   * cuántos se sueltan (del centro hacia afuera).
   */
  release(
    span: Span,
    keep: (cell: Cell) => boolean = () => false,
    max = Infinity,
  ): Detached[] {
    const inset = span.to - span.from + 1 >= 3 ? 1 : 0;
    const middle = (span.from + span.to) / 2;
    const columns: number[] = [];
    for (let c = span.from + inset; c <= span.to - inset; c++) columns.push(c);
    columns.sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle) || a - b);
    const out: Detached[] = [];
    for (const column of columns) {
      if (out.length >= max) break;
      const cell = { column, row: span.roof };
      const block = this.grid.get(column, span.roof);
      if (
        !this.grid.contains(column, span.roof) ||
        block === Block.Air ||
        block === Block.Bedrock ||
        keep(cell)
      )
        continue;
      this.grid.set(column, span.roof, Block.Air);
      out.push({ ...cell, block });
    }
    return out;
  }

  /** Estado del tramo más comprometido alrededor de una celda. */
  around(cell: Cell, radius = 3): Span | undefined {
    return this.spans
      .filter(
        (s) =>
          s.roof >= cell.row - radius - 1 &&
          s.roof <= cell.row + radius &&
          s.to >= cell.column - radius &&
          s.from <= cell.column + radius,
      )
      .sort((a, b) => b.score - a.score)[0];
  }
}
