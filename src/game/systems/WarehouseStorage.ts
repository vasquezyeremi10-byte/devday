import {
  MATERIAL_KG,
  MATERIAL_LABEL,
  SUPPLIES,
  TOOLS,
  type Material,
  type SupplyKind,
} from '../config/balance';
import { isBuildMaterial, STACK_MAX } from '../config/buildMaterials';
import { PPE, type PPEKind } from '../config/gear';
import { isPerishable } from '../config/survival';
import {
  addLots,
  cleanLots,
  cloneLots,
  fitLots,
  shelfLifeMs,
  takeSoonest,
  type Lot,
} from './Freshness';
import type { GameSession } from './GameSession';
import type { Tool } from './ToolSystem';

export const WAREHOUSE_GRAMS = 1_000_000;
const KIT = ['helmet', 'vest', 'boots'] as const;
const KIT_ACCESSORIES = ['gloves', 'goggles'] as const;
type Goods =
  /**
   * `lots`: vencimientos de los alimentos perecederos (tiempo de juego, el
   * reloj corre también en la bodega); ver systems/Freshness.ts.
   */
  | { type: 'supply'; kind: SupplyKind; lots?: Lot[] }
  | { type: 'mineral'; kind: Material }
  | { type: 'ppe'; kind: PPEKind; id?: number }
  | { type: 'tool'; kind: Tool['kind']; durability: number; id?: number };
export type StorageStack = Goods & { count: number };

export const storageLabel = (stack: StorageStack): string => {
  switch (stack.type) {
    case 'supply':
      return SUPPLIES[stack.kind].label;
    case 'mineral':
      return MATERIAL_LABEL[stack.kind];
    case 'ppe':
      return PPE[stack.kind].label;
    case 'tool':
      return TOOLS[stack.kind].label;
  }
};

export function unitGrams(stack: StorageStack): number {
  switch (stack.type) {
    case 'mineral':
      return Math.round(MATERIAL_KG[stack.kind] * 1000);
    case 'supply':
      return SUPPLIES[stack.kind].grams;
    case 'ppe':
      return PPE[stack.kind].grams;
    case 'tool':
      return TOOLS[stack.kind].grams;
  }
}
const stackLimit = (item: StorageStack) =>
  item.type === 'supply' || item.type === 'mineral' ? STACK_MAX : 1;

export class WarehouseStorage {
  readonly stacks: StorageStack[] = [];
  kitStocked = false;

  get grams(): number {
    return this.stacks.reduce(
      (sum, stack) => sum + unitGrams(stack) * stack.count,
      0,
    );
  }

  stockKit(session: GameSession): void {
    if (!this.kitStocked) {
      this.kitStocked = true;
      if (!session.kitClaimed) {
        for (const kind of KIT)
          if (!session.loadout.ppe.some((item) => item.kind === kind))
            this.stacks.push({ type: 'ppe', kind, count: 1 });
        session.kitClaimed = true;
      }
    }
    // Completa también los kits de partidas anteriores a la retirada de la tienda.
    for (const kind of KIT_ACCESSORIES)
      if (
        !session.loadout.ppe.some((item) => item.kind === kind) &&
        !this.stacks.some((item) => item.type === 'ppe' && item.kind === kind) &&
        this.grams + PPE[kind].grams <= WAREHOUSE_GRAMS
      ) this.stacks.push({ type: 'ppe', kind, count: 1 });
  }

  /** Lotes de una pila de la bodega ajustados a su cantidad (una pila sin fechas nace fresca). */
  lotsOf(stack: StorageStack, now: number): Lot[] | undefined {
    if (stack.type !== 'supply' || !isPerishable(stack.kind)) return undefined;
    stack.lots ??= [];
    fitLots(stack.lots, stack.count, now + shelfLifeMs(stack.kind));
    return stack.lots;
  }

  carried(session: GameSession): StorageStack[] {
    session.syncFood();
    const minerals = new Map<Material, number>();
    for (const kind of session.inventory.items)
      minerals.set(kind, (minerals.get(kind) ?? 0) + 1);
    return [
      ...session.tools.items.map(({ id, kind, durability }): StorageStack => ({
        type: 'tool',
        id,
        kind,
        durability,
        count: 1,
      })),
      ...session.loadout.ppe.map(({ id, kind }): StorageStack => ({
        type: 'ppe',
        id,
        kind,
        count: 1,
      })),
      ...(Object.keys(SUPPLIES) as SupplyKind[])
        .filter((kind) => session.supplies[kind] > 0)
        .map((kind): StorageStack => ({
          type: 'supply',
          kind,
          count: session.supplies[kind],
          ...(isPerishable(kind)
            ? { lots: cloneLots(session.food.lots(kind)) }
            : {}),
        })),
      ...[...minerals].map(([kind, count]): StorageStack => ({
        type: 'mineral',
        kind,
        count,
      })),
    ];
  }

  deposit(
    session: GameSession,
    item: StorageStack,
    amount: number,
  ): string | undefined {
    const owned = this.carried(session).find(
      (stack) =>
        stack.type === item.type &&
        stack.kind === item.kind &&
        (!('id' in stack) || ('id' in item && stack.id === item.id)),
    );
    if (
      !owned ||
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      amount > owned.count
    )
      return 'CANTIDAD NO DISPONIBLE';
    if (this.grams + amount * unitGrams(owned) > WAREHOUSE_GRAMS)
      return 'LA BODEGA ADMITE HASTA 1000 KG';
    let moved: Lot[] | undefined;
    switch (owned.type) {
      case 'mineral':
        for (let i = 0; i < amount; i++)
          session.inventory.items.splice(
            session.inventory.items.indexOf(owned.kind),
            1,
          );
        break;
      case 'supply':
        session.supplies[owned.kind] -= amount;
        // Los alimentos viajan con sus fechas (las que vencen antes primero).
        if (isPerishable(owned.kind))
          moved = session.food.take(owned.kind, amount);
        break;
      case 'tool':
        session.tools.items = session.tools.items.filter(
          (tool) => tool.id !== owned.id,
        );
        if (session.tools.equipped === owned.id) session.tools.equipped = 0;
        break;
      case 'ppe':
        session.loadout.ppe = session.loadout.ppe.filter(
          (item) => item.id !== owned.id,
        );
        if (session.loadout.gear[PPE[owned.kind].slot] === owned.id)
          session.loadout.gear[PPE[owned.kind].slot] = null;
        break;
    }
    this.add(owned, amount, moved);
    session.loadout.sync();
  }

  withdraw(
    session: GameSession,
    slot: number,
    amount: number,
    blockLimit = Infinity,
  ): string | undefined {
    const item = this.stacks[slot];
    if (
      !item ||
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      amount > item.count
    )
      return 'CANTIDAD NO DISPONIBLE';
    if (item.type === 'mineral') {
      if (
        session.inventory.items.length + amount > blockLimit ||
        (blockLimit === Infinity &&
          session.inventory.weight + amount * MATERIAL_KG[item.kind] >
            session.inventory.capacity)
      )
        return 'CARGA MINERA LLENA';
    } else {
      const supply = item.type === 'supply' ? session.supplies[item.kind] : 0;
      const material = item.type === 'supply' && isBuildMaterial(item.kind);
      if (!supply && !material && session.loadout.free() === 0)
        return 'MOCHILA LLENA';
      if (material && supply + amount > STACK_MAX) return 'PILA AL MAXIMO';
    }
    switch (item.type) {
      case 'mineral':
        for (let i = 0; i < amount; i++)
          session.inventory.items.push(item.kind);
        break;
      case 'supply': {
        session.supplies[item.kind] += amount;
        if (isPerishable(item.kind)) {
          // Las fechas viajan con las unidades (las que vencen antes primero).
          const lots = this.lotsOf(item, session.dayNight.totalMs)!;
          session.food.addLots(item.kind, takeSoonest(lots, amount));
        }
        break;
      }
      case 'tool':
        session.tools.items.push({
          id: session.tools.nextId++,
          kind: item.kind,
          durability: item.durability,
        });
        break;
      case 'ppe':
        session.loadout.ppe.push({
          id: session.loadout.nextPpe++,
          kind: item.kind,
        });
        break;
    }
    item.count -= amount;
    if (!item.count) this.stacks.splice(slot, 1);
    session.loadout.sync();
  }

  /** `lots`: fechas de vencimiento de lo que se guarda (alimentos perecederos). */
  private add(item: StorageStack, amount: number, lots?: Lot[]): void {
    const limit = stackLimit(item);
    const pending = lots ? cloneLots(lots) : undefined;
    if (limit > 1)
      for (const stack of this.stacks) {
        if (stack.type !== item.type || stack.kind !== item.kind) continue;
        const moved = Math.min(amount, limit - stack.count);
        if (stack.type === 'supply' && pending && moved) {
          // La pila existente conserva sus fechas y suma las que llegan.
          stack.lots ??= [];
          addLots(stack.lots, takeSoonest(pending, moved));
        }
        stack.count += moved;
        amount -= moved;
      }
    // Los identificadores pertenecen al inventario del personaje.
    const stored = { ...item };
    if ('id' in stored) delete stored.id;
    if ('lots' in stored) delete stored.lots;
    while (amount > 0) {
      const count = Math.min(amount, limit);
      this.stacks.push({
        ...stored,
        count,
        ...(pending ? { lots: takeSoonest(pending, count) } : {}),
      });
      amount -= count;
    }
  }

  /**
   * `now`: tiempo de juego de la partida cargada; una pila perecedera sin
   * fechas (guardado anterior) nace fresca en ese instante.
   */
  restore(raw: unknown, now = 0): void {
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('stacks' in raw) ||
      !Array.isArray(raw.stacks)
    )
      return;
    this.kitStocked = 'kitStocked' in raw && raw.kitStocked === true;
    let grams = 0;
    for (const entry of raw.stacks) {
      if (
        !entry ||
        typeof entry.kind !== 'string' ||
        !Number.isSafeInteger(entry.count)
      )
        continue;
      const { type, kind, count, durability } = entry;
      let item: StorageStack;
      if (type === 'supply' && Object.hasOwn(SUPPLIES, kind)) {
        const supply: StorageStack & { type: 'supply' } = { type, kind, count };
        if (isPerishable(kind)) {
          const lots = cleanLots(entry.lots) ?? [];
          fitLots(lots, count, now + shelfLifeMs(kind));
          supply.lots = lots;
        }
        item = supply;
      } else if (type === 'mineral' && Object.hasOwn(MATERIAL_KG, kind))
        item = { type, kind, count };
      else if (type === 'ppe' && Object.hasOwn(PPE, kind))
        item = { type, kind, count };
      else if (
        type === 'tool' &&
        Object.hasOwn(TOOLS, kind) &&
        Number.isInteger(durability) &&
        durability >= 0 &&
        durability <= TOOLS[kind as Tool['kind']].durability
      )
        item = { type, kind, count, durability };
      else continue;
      const mass = unitGrams(item) * count;
      if (
        count < 1 ||
        count > stackLimit(item) ||
        grams + mass > WAREHOUSE_GRAMS
      )
        continue;
      this.stacks.push(item);
      grams += mass;
    }
  }
}
