import { SUPPLIES } from '../config/balance';
import { STACK_MAX } from '../config/buildMaterials';
import {
  FRIDGE,
  isPerishable,
  PERISHABLE_KEYS,
  type PerishableKind,
} from '../config/survival';
import type { GameSession } from './GameSession';
import {
  addLots,
  cleanLots,
  cloneLots,
  freeze,
  lotsTotal,
  summarize,
  takeSoonest,
  thaw,
  type FreshSummary,
  type Lot,
} from './Freshness';

/**
 * Refrigerador de la cabaña (V13): 10 casillas, cada una una pila de un solo
 * alimento o bebida perecedero con el límite de apilado normal (`STACK_MAX`).
 * Una casilla puede mezclar lotes con distinto vencimiento.
 *
 * Dentro, el tiempo de caducidad está DETENIDO: los lotes guardan el tiempo
 * restante (`Lot.t` en ms), que no cambia mientras pasan los días. Al retirar
 * un producto vuelve a correr con ese mismo tiempo restante.
 */
export interface FridgeSlot {
  kind: PerishableKind;
  count: number;
  /** Tiempo restante por lote (congelado). */
  lots: Lot[];
}

export const FRIDGE_KINDS: readonly PerishableKind[] = PERISHABLE_KEYS;

export class Fridge {
  readonly slots: FridgeSlot[] = [];
  readonly capacity = FRIDGE.slots;

  get used(): number {
    return this.slots.length;
  }
  get free(): number {
    return this.capacity - this.slots.length;
  }
  get units(): number {
    return this.slots.reduce((n, s) => n + s.count, 0);
  }
  /** Unidades de un tipo que aún caben (huecos de sus pilas + casillas libres). */
  roomFor(kind: PerishableKind): number {
    const gaps = this.slots
      .filter((s) => s.kind === kind)
      .reduce((n, s) => n + (STACK_MAX - s.count), 0);
    return gaps + this.free * STACK_MAX;
  }
  summary(index: number): FreshSummary | undefined {
    const slot = this.slots[index];
    return slot && summarize(slot.lots, 0, true);
  }

  /**
   * Inventario → refrigerador. Pasa hasta `amount` unidades (las que vencen
   * antes primero) y devuelve las que realmente pasaron; si no cabe ninguna,
   * el motivo.
   */
  deposit(
    session: GameSession,
    kind: PerishableKind,
    amount: number,
  ): { moved: number } | { error: string } {
    if (!isPerishable(kind) || !Number.isSafeInteger(amount) || amount < 1)
      return { error: 'CANTIDAD NO DISPONIBLE' };
    session.syncFood();
    const have = session.supplies[kind];
    if (have < 1) return { error: 'NO LLEVAS ESE PRODUCTO' };
    const room = this.roomFor(kind);
    if (room < 1) return { error: 'REFRIGERADOR LLENO' };
    const moved = Math.min(amount, have, room);
    const now = session.dayNight.totalMs;
    const lots = freeze(session.food.take(kind, moved), now);
    session.supplies[kind] -= moved;
    this.place(kind, lots);
    session.loadout.sync();
    return { moved };
  }

  /**
   * Refrigerador → inventario: `amount` unidades de una casilla (las que
   * vencen antes primero), con el tiempo restante intacto.
   */
  withdraw(
    session: GameSession,
    index: number,
    amount: number,
  ): { moved: number } | { error: string } {
    const slot = this.slots[index];
    if (!slot || !Number.isSafeInteger(amount) || amount < 1)
      return { error: 'CANTIDAD NO DISPONIBLE' };
    session.syncFood();
    if (!session.loadout.canAccept(slot.kind))
      return { error: 'MOCHILA LLENA: LIBERA UNA CASILLA' };
    const moved = Math.min(amount, slot.count);
    const now = session.dayNight.totalMs;
    const lots = thaw(takeSoonest(slot.lots, moved), now);
    slot.count -= moved;
    if (!slot.count) this.slots.splice(index, 1);
    session.supplies[slot.kind] += moved;
    session.food.addLots(slot.kind, lots);
    session.loadout.sync();
    return { moved };
  }

  /** Tira lo vencido del refrigerador; devuelve cuántas unidades. */
  discardExpired(): number {
    let thrown = 0;
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const slot = this.slots[i]!;
      const before = slot.count;
      slot.lots = slot.lots.filter((l) => l.t > 0);
      slot.count = lotsTotal(slot.lots);
      thrown += before - slot.count;
      if (!slot.count) this.slots.splice(i, 1);
    }
    return thrown;
  }

  /** Reparte lotes en pilas existentes con hueco y, luego, casillas nuevas. */
  private place(kind: PerishableKind, lots: Lot[]): void {
    let left = lotsTotal(lots);
    for (const slot of this.slots) {
      if (slot.kind !== kind || !left) continue;
      const n = Math.min(left, STACK_MAX - slot.count);
      if (!n) continue;
      addLots(slot.lots, takeSoonest(lots, n));
      slot.count += n;
      left -= n;
    }
    while (left > 0 && this.slots.length < this.capacity) {
      const n = Math.min(left, STACK_MAX);
      this.slots.push({ kind, count: n, lots: takeSoonest(lots, n) });
      left -= n;
    }
  }

  snapshot(): { slots: FridgeSlot[] } {
    return {
      slots: this.slots.map((s) => ({ ...s, lots: cloneLots(s.lots) })),
    };
  }

  /** Restaura lo válido: tipo conocido, lotes coherentes con la cantidad y casillas ≤ 10. */
  restore(raw: unknown): void {
    this.slots.length = 0;
    const list = (raw as { slots?: unknown } | null | undefined)?.slots;
    if (!Array.isArray(list)) return;
    for (const entry of list) {
      if (this.slots.length >= this.capacity) break;
      if (!entry || !isPerishable(entry.kind) || !(entry.kind in SUPPLIES))
        continue;
      const lots = cleanLots(entry.lots);
      if (!lots?.length) continue;
      const count = lotsTotal(lots);
      if (count < 1 || count > STACK_MAX || entry.count !== count) continue;
      this.slots.push({ kind: entry.kind, count, lots });
    }
  }
}
