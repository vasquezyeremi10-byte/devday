import { FOODS, isPerishable, type PerishableKind } from '../config/survival';
import { CYCLE_MS } from './DayNightCycle';

/**
 * Caducidad de alimentos y bebidas (lógica pura, sin Phaser).
 *
 * Una pila puede mezclar unidades con distintos vencimientos, así que se
 * guarda por LOTES: `{ t, qty }`. Mientras el alimento está fuera del
 * refrigerador `t` es el instante de vencimiento en tiempo de juego
 * (`DayNightCycle.totalMs`, que avanza con el ciclo y al dormir); dentro del
 * refrigerador `t` es el TIEMPO RESTANTE, que no cambia. Al retirar el lote
 * vuelve a ser `ahora + restante`: el tiempo no se reinicia ni se pierde.
 * Un día del juego es un ciclo día + noche (`CYCLE_MS` = 10 min), no 24 horas.
 */
export interface Lot {
  t: number;
  qty: number;
}

/** Vida útil total de un producto (ms de tiempo de juego); 0 = no caduca. */
export const shelfLifeMs = (kind: string): number =>
  isPerishable(kind) ? FOODS[kind].shelfDays * CYCLE_MS : 0;

/** Un día completo del juego (ms). */
export const GAME_DAY_MS = CYCLE_MS;

const byTime = (a: Lot, b: Lot) => a.t - b.t;
const total = (lots: readonly Lot[]) => lots.reduce((n, l) => n + l.qty, 0);
export const lotsTotal = total;
export const cloneLots = (lots: readonly Lot[]): Lot[] =>
  lots.map((l) => ({ ...l }));

/** Suma `qty` unidades con vencimiento `t` (funde lotes iguales, ordenado). */
export function addLot(lots: Lot[], t: number, qty: number): void {
  if (!(qty > 0) || !Number.isFinite(t)) return;
  const same = lots.find((l) => l.t === t);
  if (same) same.qty += qty;
  else {
    lots.push({ t, qty });
    lots.sort(byTime);
  }
}
export function addLots(lots: Lot[], more: readonly Lot[]): void {
  for (const l of more) addLot(lots, l.t, l.qty);
}

/** Quita `qty` unidades, las que vencen antes primero; devuelve lo quitado. */
export function takeSoonest(lots: Lot[], qty: number): Lot[] {
  const taken: Lot[] = [];
  let left = Math.min(qty, total(lots));
  while (left > 0 && lots.length) {
    const lot = lots[0]!;
    const n = Math.min(lot.qty, left);
    taken.push({ t: lot.t, qty: n });
    lot.qty -= n;
    left -= n;
    if (!lot.qty) lots.shift();
  }
  return taken;
}

/** ¿Vencido? Corriendo: `t <= ahora`; congelado: no queda tiempo. */
export const isExpired = (t: number, now: number, frozen = false): boolean =>
  frozen ? t <= 0 : t <= now;
/** Tiempo restante (ms) de un lote; nunca negativo. */
export const remainingMs = (t: number, now: number, frozen = false): number =>
  Math.max(0, frozen ? t : t - now);

export const expiredQty = (lots: readonly Lot[], now: number, frozen = false) =>
  lots.reduce((n, l) => n + (isExpired(l.t, now, frozen) ? l.qty : 0), 0);
export const freshQty = (lots: readonly Lot[], now: number, frozen = false) =>
  total(lots) - expiredQty(lots, now, frozen);

/** Lote vigente que vence antes (undefined si no queda ninguno fresco). */
export function soonestFresh(
  lots: readonly Lot[],
  now: number,
  frozen = false,
): Lot | undefined {
  return lots.find((l) => !isExpired(l.t, now, frozen));
}

/** Consume UNA unidad vigente (la que vence antes). false si todo venció. */
export function takeFreshUnit(lots: Lot[], now: number, frozen = false): boolean {
  const i = lots.findIndex((l) => !isExpired(l.t, now, frozen));
  if (i < 0) return false;
  const lot = lots[i]!;
  lot.qty -= 1;
  if (!lot.qty) lots.splice(i, 1);
  return true;
}

/** Corriendo → congelado (entra al refrigerador): vencimiento → restante. */
export function freeze(lots: readonly Lot[], now: number): Lot[] {
  const out: Lot[] = [];
  for (const l of lots) addLot(out, remainingMs(l.t, now), l.qty);
  return out;
}
/** Congelado → corriendo (sale del refrigerador): restante → vencimiento. */
export function thaw(lots: readonly Lot[], now: number): Lot[] {
  const out: Lot[] = [];
  for (const l of lots) addLot(out, now + Math.max(0, l.t), l.qty);
  return out;
}

/**
 * Ajusta un conjunto de lotes a la cantidad real de la pila: lo que sobra se
 * quita (primero lo que vence antes) y lo que falta entra como producto
 * recién hecho. `fresh` es el valor de `t` de una unidad nueva.
 */
export function fitLots(lots: Lot[], count: number, fresh: number): void {
  const have = total(lots);
  if (have > count) takeSoonest(lots, have - count);
  else if (have < count) addLot(lots, fresh, count - have);
}

/** Ordena y valida lotes de un guardado; null si alguno está dañado. */
export function cleanLots(raw: unknown): Lot[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Lot[] = [];
  for (const l of raw) {
    if (
      !l ||
      !Number.isFinite(l.t) ||
      !Number.isSafeInteger(l.qty) ||
      l.qty < 1 ||
      l.qty > 99_999
    )
      return null;
    addLot(out, l.t, l.qty);
  }
  return out;
}

// ------------------------------------------------------------ presentación

export type FreshState = 'fresh' | 'soon' | 'expired';
/** Menos de un día completo restante = «por vencer». */
export const SOON_MS = GAME_DAY_MS;

export function freshState(ms: number, expired: boolean): FreshState {
  return expired ? 'expired' : ms < SOON_MS ? 'soon' : 'fresh';
}

/** Días del juego con una decimal y coma: 3 → «3», 2,4 → «2,4», 0,05 → «0,1». */
export function formatDays(ms: number): string {
  const days = Math.max(0, ms) / GAME_DAY_MS;
  const v = days >= 10 ? Math.round(days) : Math.ceil(days * 10) / 10;
  return String(v).replace('.', ',');
}
/** Tiempo restante como minutos:segundos del reloj de simulación. */
export function formatClock(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface FreshSummary {
  /** Unidades de la pila. */
  count: number;
  expired: number;
  /** Lote vigente que vence antes (undefined si todo venció). */
  nextMs?: number;
  nextQty?: number;
  /** Lotes vigentes con fechas distintas. */
  dates: number;
  state: FreshState;
}

/** Resumen para insignias y descripciones de una pila. */
export function summarize(
  lots: readonly Lot[],
  now: number,
  frozen = false,
): FreshSummary {
  const count = total(lots);
  const expired = expiredQty(lots, now, frozen);
  const next = soonestFresh(lots, now, frozen);
  const nextMs = next ? remainingMs(next.t, now, frozen) : undefined;
  return {
    count,
    expired,
    nextMs,
    nextQty: next?.qty,
    dates: lots.filter((l) => !isExpired(l.t, now, frozen)).length,
    state: next ? freshState(nextMs!, false) : 'expired',
  };
}

/** Insignia corta: «3D», «0,4D» o «VENC». */
export function badge(sum: FreshSummary): string {
  if (sum.nextMs === undefined) return 'VENC';
  return `${formatDays(sum.nextMs)}D`;
}

/** Líneas de descripción (tooltips y paneles). */
export function describe(sum: FreshSummary, frozen = false): string[] {
  const lines: string[] = [];
  if (sum.nextMs !== undefined)
    lines.push(
      `${frozen ? 'CONGELADO: QUEDAN' : 'VENCE EN'} ${formatDays(sum.nextMs)} DIAS (${formatClock(sum.nextMs)})`,
    );
  if (sum.dates > 1) lines.push(`${sum.dates} FECHAS DE VENCIMIENTO DISTINTAS`);
  if (sum.expired)
    lines.push(
      sum.nextMs === undefined
        ? 'VENCIDO: NO SE PUEDE CONSUMIR'
        : `${sum.expired} VENCIDA(S): NO SE PUEDEN CONSUMIR`,
    );
  return lines;
}

// ------------------------------------------------------------ inventario

/**
 * Lotes de lo que el minero lleva encima (vencimiento corriendo). Es un
 * registro paralelo a `session.supplies`: el total de cada tipo debe coincidir
 * con la cantidad; `reconcile` lo corrige si otra parte del código cambió la
 * cantidad directamente.
 */
export class FoodLedger {
  private readonly book = new Map<PerishableKind, Lot[]>();

  lots(kind: PerishableKind): Lot[] {
    let lots = this.book.get(kind);
    if (!lots) this.book.set(kind, (lots = []));
    return lots;
  }
  /** Unidades nuevas (vencen `shelfLife` después de `madeAt`). */
  add(kind: PerishableKind, qty: number, expiresAt: number): void {
    addLot(this.lots(kind), expiresAt, qty);
  }
  addLots(kind: PerishableKind, more: readonly Lot[]): void {
    addLots(this.lots(kind), more);
  }
  take(kind: PerishableKind, qty: number): Lot[] {
    return takeSoonest(this.lots(kind), qty);
  }
  /** Ajusta los lotes a la cantidad real; lo que falta nace fresco ahora. */
  reconcile(kind: PerishableKind, count: number, now: number): void {
    fitLots(this.lots(kind), count, now + shelfLifeMs(kind));
  }
  /** Consume una unidad vigente; false si no queda ninguna. */
  eat(kind: PerishableKind, now: number): boolean {
    return takeFreshUnit(this.lots(kind), now);
  }

  snapshot(): Record<string, Lot[]> {
    const out: Record<string, Lot[]> = {};
    for (const [kind, lots] of this.book)
      if (lots.length) out[kind] = cloneLots(lots);
    return out;
  }
  /** Restaura lo válido; lo dañado se descarta (reconcile lo repone). */
  restore(raw: unknown): void {
    this.book.clear();
    if (!raw || typeof raw !== 'object') return;
    for (const [kind, value] of Object.entries(raw)) {
      if (!isPerishable(kind)) continue;
      const lots = cleanLots(value);
      if (lots) this.book.set(kind, lots);
    }
  }
}
