import { SUPPLIES, type SupplyKind } from '../config/balance';
import type { Cell } from '../world/TerrainGrid';
import type { GameSession } from './GameSession';
import { RANK, StabilityState } from './GeotechnicalSystem';
import { LAMPS } from './PlacedLights';
import { SUPPORT } from './SupportSystem';

/**
 * Recuperación al desmontar (fracción de una unidad). Parámetros ajustables.
 * Cada estructura se colocó gastando una unidad: como nunca se devuelve más
 * de una, colocar y desmontar en ciclo no genera recursos.
 */
export const RECOVERY: Partial<Record<SupplyKind, number>> = {
  wood_beam: 0.5,
  steel_beam: 0.75,
  torch: 0.5,
  lamp: 0.75,
  industrial: 0.75,
  fan_aux: 0.75,
  fan_main: 0.75,
  duct: 0.75,
  rail: 1,
};

export type Structure =
  | { type: 'support'; id: number; cell: Cell }
  | { type: 'light'; id: number; cell: Cell }
  | { type: 'fan'; id: number; cell: Cell }
  | { type: 'duct'; cell: Cell }
  | { type: 'rail'; cell: Cell };

/** Verde: sin riesgo; amarillo: con consecuencias; rojo: peligroso o bloqueado. */
export type Risk = 'ok' | 'warn' | 'danger' | 'blocked';

export interface DismantlePlan {
  structure: Structure;
  supply: SupplyKind;
  label: string;
  /** Fracción que se recupera según tipo y estado. */
  fraction: number;
  /** Unidades enteras que entrega ahora (con lo acumulado). */
  units: number;
  risk: Risk;
  /** Consecuencias o motivo del bloqueo. */
  notes: string[];
  /** Exige confirmación explícita ("retirar de todos modos"). */
  confirm: boolean;
}

/** Estructura colocada por el jugador en una celda (nunca terreno natural). */
export function structureAt(s: GameSession, cell: Cell): Structure | null {
  const same = (c: Cell) => c.column === cell.column && c.row === cell.row;
  const fan = s.ventilation.fans.find(same);
  if (fan) return { type: 'fan', id: fan.id, cell };
  const light = s.lights.items.find(same);
  if (light) return { type: 'light', id: light.id, cell };
  const support = s.supports.items.find(same);
  if (support && !support.fixed)
    return { type: 'support', id: support.id, cell };
  if (s.ventilation.hasDuct(cell.column, cell.row))
    return { type: 'duct', cell };
  const rail = s.rails.at(cell.column);
  if (rail && rail.row === cell.row) return { type: 'rail', cell };
  // Un entibado permanente solo se señala si no hay nada desmontable.
  return support ? { type: 'support', id: support.id, cell } : null;
}

export function planDismantle(
  s: GameSession,
  structure: Structure,
): DismantlePlan {
  let supply: SupplyKind,
    condition = 1,
    risk: Risk = 'ok',
    confirm = false;
  const notes: string[] = [];
  if (structure.type === 'support') {
    const sp = s.supports.items.find((x) => x.id === structure.id)!;
    supply = sp.kind === 'wood' ? 'wood_beam' : 'steel_beam';
    condition = sp.durability / SUPPORT[sp.kind].durability;
    if (sp.fixed) {
      risk = 'blocked';
      notes.push('ENTIBADO PERMANENTE DE LA BOCAMINA');
    } else {
      // Consulta real del estado geomecánico sin este marco.
      const { after } = s.geotech.simulateWithout(sp.id);
      if (RANK[after] >= RANK[StabilityState.Danger]) {
        risk = 'danger';
        confirm = true;
        notes.push(
          'PELIGRO: SOPORTE ESTRUCTURAL',
          `TECHO QUEDARIA EN ${after}`,
        );
      } else if (after === StabilityState.Watch) {
        risk = 'warn';
        notes.push('EL TECHO QUEDARIA EN VIGILANCIA');
      }
    }
  } else if (structure.type === 'light') {
    const l = s.lights.items.find((x) => x.id === structure.id)!;
    supply = l.kind;
    condition =
      l.fuel === Infinity ? 1 : Math.max(0, l.fuel / LAMPS[l.kind].fuelMs);
    risk = 'warn';
    notes.push('LA ZONA QUEDARA MAS OSCURA');
  } else if (structure.type === 'fan') {
    const f = s.ventilation.fans.find((x) => x.id === structure.id)!;
    supply = f.kind;
    const status = s.ventilation.status.find((x) => x.id === f.id);
    risk = status?.running ? 'warn' : 'ok';
    if (status?.running) notes.push(`DEJA SIN AIRE ${status.ducts} DUCTOS`);
  } else if (structure.type === 'duct') {
    supply = 'duct';
    if (s.ventilation.fans.length) {
      risk = 'warn';
      notes.push('PUEDE CORTAR LA RED DE DUCTOS');
    }
  } else {
    supply = 'rail';
    const x0 = structure.cell.column * 16;
    // Ocupado: el carro (20 px de ancho) se apoya en esta columna.
    if (s.cart.x + 10 > x0 && s.cart.x - 10 < x0 + 16) {
      risk = 'blocked';
      notes.push('EL CARRO ESTA SOBRE ESTE TRAMO');
    } else if (
      s.rails.at(structure.cell.column - 1) &&
      s.rails.at(structure.cell.column + 1)
    ) {
      risk = 'warn';
      notes.push('LA VIA QUEDARA CORTADA EN DOS');
    }
  }
  const fraction =
    (RECOVERY[supply] ?? 0) * Math.max(0, Math.min(1, condition));
  const credit = (s.salvage[supply] ?? 0) + fraction;
  return {
    structure,
    supply,
    label: SUPPLIES[supply].label,
    fraction,
    units: Math.floor(credit + 1e-9),
    risk,
    notes,
    confirm,
  };
}

/**
 * Retira la estructura, devuelve las unidades enteras y guarda el resto
 * fraccionario para el próximo desmontaje del mismo tipo. Lo recuperado va
 * al inventario; si no hay casilla, queda en espera (LoadoutSystem) sin
 * perderse ni duplicarse. Actualiza estabilidad, aire, luz y vías.
 */
export function applyDismantle(s: GameSession, plan: DismantlePlan): number {
  if (plan.risk === 'blocked') return -1;
  const st = plan.structure;
  if (st.type === 'support')
    s.supports.items = s.supports.items.filter((x) => x.id !== st.id);
  else if (st.type === 'light') {
    s.lights.items = s.lights.items.filter((x) => x.id !== st.id);
    s.lights.version++;
  } else if (st.type === 'fan')
    s.ventilation.fans = s.ventilation.fans.filter((x) => x.id !== st.id);
  else if (st.type === 'duct')
    s.ventilation.ducts = s.ventilation.ducts.filter(
      (d) => d.column !== st.cell.column || d.row !== st.cell.row,
    );
  else
    s.rails.segments = s.rails.segments.filter(
      (r) => r.column !== st.cell.column,
    );
  const units = recoverSupply(s, plan.supply, plan.fraction);
  s.geotech.evaluate();
  s.ventilation.evaluate();
  return units;
}

export function recoverSupply(s: GameSession, kind: SupplyKind, fraction: number): number {
  const credit = (s.salvage[kind] ?? 0) + fraction;
  const units = Math.floor(credit + 1e-9);
  s.salvage[kind] = Math.max(0, credit - units);
  s.supplies[kind] += units;
  s.loadout.sync();
  return units;
}
