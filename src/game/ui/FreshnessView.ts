import type { SupplyKind } from '../config/balance';
import { PALETTE as P } from '../config/palette';
import { isPerishable } from '../config/survival';
import {
  describe,
  formatClock,
  formatDays,
  GAME_DAY_MS,
  summarize,
  type FreshState,
  type FreshSummary,
  type Lot,
} from '../systems/Freshness';
import type { GameSession } from '../systems/GameSession';

/**
 * Cómo se muestra la caducidad: colores por estado e insignias cortas para
 * casillas, y líneas de descripción para tooltips y paneles (el cálculo vive
 * en systems/Freshness.ts).
 */
export const FRESH_COLOR: Record<FreshState, number> = {
  fresh: P.mint,
  soon: P.gold,
  expired: P.red,
};
/** Lo que está en el refrigerador (tiempo detenido). */
export const FROZEN_COLOR = P.mist;

/** Insignia de casilla: «3D» (días que quedan) o ✕ si venció; null sin dato. */
export function slotBadge(
  sum: FreshSummary | undefined,
  frozen = false,
): { text: string; color: number } | null {
  if (!sum || !sum.count) return null;
  if (sum.nextMs === undefined) return { text: '✕', color: P.red };
  return {
    text: `${Math.ceil(sum.nextMs / GAME_DAY_MS)}D`,
    color: frozen ? FROZEN_COLOR : FRESH_COLOR[sum.state],
  };
}

/** Resumen de lo que lleva el minero de un alimento (undefined si no caduca o no lleva). */
export function foodSummary(
  s: GameSession,
  kind: SupplyKind,
): FreshSummary | undefined {
  if (!isPerishable(kind) || s.supplies[kind] < 1) return undefined;
  return summarize(s.food.lots(kind), s.dayNight.totalMs);
}

/** Hasta dos líneas cortas (≤ 24 caracteres) para paneles estrechos. */
export function shortLines(sum: FreshSummary, frozen = false): string[] {
  const lines: string[] = [];
  if (sum.nextMs !== undefined)
    lines.push(
      `${frozen ? 'QUEDAN' : 'VENCE EN'} ${formatDays(sum.nextMs)} D (${formatClock(sum.nextMs)})`,
    );
  const extra: string[] = [];
  if (sum.dates > 1) extra.push(`${sum.dates} FECHAS`);
  if (sum.expired)
    extra.push(sum.nextMs === undefined ? 'VENCIDO' : `${sum.expired} VENCIDA(S)`);
  if (extra.length) lines.push(extra.join(' | '));
  return lines;
}

/** Líneas de tooltip de un alimento del inventario (vacío si no caduca). */
export function foodTooltip(s: GameSession, kind: SupplyKind): string[] {
  s.syncFood();
  const sum = foodSummary(s, kind);
  return sum ? describe(sum) : [];
}

/** Resumen de lotes sueltos (bodega: corre; refrigerador: detenido). */
export const lotsSummary = (
  s: GameSession,
  lots: readonly Lot[] | undefined,
  frozen = false,
): FreshSummary | undefined =>
  lots?.length ? summarize(lots, frozen ? 0 : s.dayNight.totalMs, frozen) : undefined;
