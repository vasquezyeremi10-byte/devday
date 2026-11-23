import { SUPPLY_KEYS, TOOL_KEYS } from '../config/balance';
import { DRONE } from '../config/drones';
import type { PhoneProductId } from '../config/phoneShop';

/**
 * Cola de pedidos por dron y cajas en el suelo (lógica pura, sin Phaser).
 *
 * Un pedido pagado espera `DRONE.waitMs` reales (`dueAt`, reloj del sistema)
 * y luego despega. Hay un solo dron en el aire: los pedidos vencidos salen en
 * orden de llegada cuando el anterior terminó y hay un punto de entrega
 * libre. Al soltar la caja el pedido desaparece y nace la caja (un solo paso),
 * así que guardar a mitad de camino nunca duplica ni pierde productos: un
 * pedido en vuelo se guarda como «esperando» y al cargar vuelve a despegar.
 */
export interface ItemLine {
  kind: PhoneProductId;
  qty: number;
}
export interface DeliveryPoint {
  scene: 'MiningScene';
  x: number;
  y: number;
}
export interface DroneOrder {
  id: number;
  items: ItemLine[];
  total: number;
  /** Momento real del despegue (ms desde 1970). */
  dueAt: number;
  /** Punto de entrega reservado mientras vuela. */
  slot: number | null;
  destination?: DeliveryPoint;
  landing?: DeliveryPoint;
}
export interface SupplyBox {
  id: number;
  /** Índice en DRONE.slots. */
  slot: number;
  /**
   * Tiempo de juego (DayNightCycle.totalMs) en que el dron soltó la caja: los
   * alimentos perecederos envejecen desde ahí aunque sigan dentro de la caja.
   */
  at: number;
  items: ItemLine[];
  /** Se abrió al menos una vez (tapa abierta). */
  opened: boolean;
  destination?: DeliveryPoint;
  landing?: DeliveryPoint;
}
export interface DroneSnapshot {
  nextId: number;
  orders: {
    id: number;
    items: ItemLine[];
    total: number;
    dueAt: number;
    destination?: DeliveryPoint;
  }[];
  boxes: SupplyBox[];
}

const KINDS = new Set<string>([...TOOL_KEYS, ...SUPPLY_KEYS]);
const MAX_QTY = 999;
const isInt = (
  v: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const cleanPoint = (v: unknown): DeliveryPoint | undefined => {
  const p = v as Partial<DeliveryPoint> | null;
  return p?.scene === 'MiningScene' &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y)
    ? { scene: 'MiningScene', x: p.x!, y: p.y! }
    : undefined;
};

/** Líneas válidas (tipo conocido, cantidad entera positiva), fusionadas. */
function cleanItems(raw: unknown): ItemLine[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ItemLine[] = [];
  for (const line of raw) {
    if (!line || !KINDS.has(line.kind) || !isInt(line.qty, 1, MAX_QTY))
      return null;
    const same = out.find((l) => l.kind === line.kind);
    if (same) same.qty = Math.min(MAX_QTY, same.qty + line.qty);
    else out.push({ kind: line.kind, qty: line.qty });
  }
  return out;
}

export class DroneOrders {
  orders: DroneOrder[] = [];
  boxes: SupplyBox[] = [];
  nextId = 1;

  /** null si se puede pagar otro pedido; si no, el motivo. */
  canPlace(): string | null {
    return this.orders.length >= DRONE.maxPending
      ? `COLA LLENA: ${DRONE.maxPending} PEDIDOS|ESPERA UNA ENTREGA.`
      : null;
  }
  /** Registra un pedido ya pagado; despega en `DRONE.waitMs`. */
  place(
    items: ItemLine[],
    total: number,
    now: number,
    destination?: DeliveryPoint,
  ): DroneOrder {
    const clean = cleanItems(items);
    if (!clean?.length) throw new Error('Pedido sin productos válidos');
    const order: DroneOrder = {
      id: this.nextId++,
      items: clean,
      total,
      dueAt: now + DRONE.waitMs,
      slot: null,
      destination: cleanPoint(destination),
    };
    this.orders.push(order);
    return order;
  }
  /** Deshace un pedido recién registrado (si no se pudo guardar). */
  cancel(id: number): void {
    this.orders = this.orders.filter((o) => o.id !== id || o.slot !== null);
  }
  remainingMs(order: DroneOrder, now: number): number {
    return Math.max(0, order.dueAt - now);
  }
  get flying(): DroneOrder | undefined {
    return this.orders.find((o) => o.slot !== null);
  }
  /** Primer punto de entrega sin caja ni dron asignado. */
  freeSlot(): number | null {
    const used = new Set<number>([
      ...this.boxes.map((b) => b.slot),
      ...this.orders.flatMap((o) => (o.slot === null ? [] : [o.slot])),
    ]);
    const i = DRONE.slots.findIndex((_, i) => !used.has(i));
    return i < 0 ? null : i;
  }
  /** Pedido vencido que puede despegar ya (cola por orden de pago). */
  nextLaunch(now: number): DroneOrder | null {
    if (this.flying) return null;
    const next = [...this.orders].sort((a, b) => a.id - b.id)[0];
    if (!next || next.dueAt > now || this.freeSlot() === null) return null;
    return next;
  }
  /** Despega: reserva el punto de entrega. */
  launch(id: number, landing?: DeliveryPoint): number | null {
    const order = this.orders.find((o) => o.id === id);
    const slot = this.freeSlot();
    if (!order || order.slot !== null || slot === null) return null;
    order.slot = slot;
    order.landing = cleanPoint(landing);
    return slot;
  }
  /** El dron suelta la caja: el pedido pasa a ser una caja en el suelo (`at` = tiempo de juego). */
  deliver(id: number, at = 0): SupplyBox | null {
    const order = this.orders.find((o) => o.id === id);
    if (!order || order.slot === null) return null;
    this.orders = this.orders.filter((o) => o !== order);
    const box: SupplyBox = {
      id: order.id,
      slot: order.slot,
      at,
      items: order.items.map((l) => ({ ...l })),
      opened: false,
      destination: order.destination,
      landing: order.landing,
    };
    this.boxes.push(box);
    return box;
  }
  /** Un vuelo interrumpido (cambio de escena) vuelve a la cola. */
  resetFlights(): void {
    for (const o of this.orders) {
      o.slot = null;
      o.landing = undefined;
    }
  }

  /**
   * Abre una caja y pasa al inventario todo lo que `receive` acepte, unidad
   * por unidad. Lo que no cabe queda dentro; la caja vacía desaparece.
   */
  collect(
    boxId: number,
    receive: (kind: PhoneProductId) => boolean,
  ): { taken: ItemLine[]; left: number; emptied: boolean } | null {
    const box = this.boxes.find((b) => b.id === boxId);
    if (!box) return null;
    box.opened = true;
    const taken: ItemLine[] = [];
    for (const line of box.items) {
      let n = 0;
      while (line.qty > 0 && receive(line.kind)) {
        line.qty--;
        n++;
      }
      if (n) taken.push({ kind: line.kind, qty: n });
    }
    box.items = box.items.filter((l) => l.qty > 0);
    const left = box.items.reduce((sum, l) => sum + l.qty, 0);
    if (!left) this.boxes = this.boxes.filter((b) => b !== box);
    return { taken, left, emptied: !left };
  }

  /** Retira solo la línea y cantidad elegidas. Una recepción fallida no toca la caja. */
  collectLine(
    boxId: number,
    kind: PhoneProductId,
    amount: number,
    receive: (kind: PhoneProductId) => boolean,
  ) {
    const box = this.boxes.find((b) => b.id === boxId);
    if (!box || !isInt(amount, 1)) return null;
    const line = box.items.find((l) => l.kind === kind);
    if (!line) return null;
    box.opened = true;
    let taken = 0;
    while (taken < amount && line.qty > 0 && receive(kind)) {
      line.qty--;
      taken++;
    }
    box.items = box.items.filter((l) => l.qty > 0);
    if (!box.items.length) this.boxes = this.boxes.filter((b) => b !== box);
    return { taken, left: line.qty, emptied: !box.items.length };
  }

  snapshot(): DroneSnapshot {
    return {
      nextId: this.nextId,
      // En vuelo se guarda como esperando: al cargar vuelve a despegar.
      orders: this.orders.map((o) => ({
        id: o.id,
        items: o.items.map((l) => ({ ...l })),
        total: o.total,
        dueAt: o.dueAt,
        destination: o.destination,
      })),
      boxes: this.boxes.map((b) => ({
        ...b,
        items: b.items.map((l) => ({ ...l })),
        destination: b.destination && { ...b.destination },
        landing: b.landing && { ...b.landing },
      })),
    };
  }
  /**
   * Restaura descartando entradas dañadas o repetidas (mismo id, mismo punto
   * de entrega). Sin dato (partidas anteriores): sin pedidos ni cajas.
   */
  restore(raw: unknown, now = 0): void {
    this.orders = [];
    this.boxes = [];
    this.nextId = 1;
    const data = raw as Partial<DroneSnapshot> | null | undefined;
    if (!data || typeof data !== 'object') return;
    const ids = new Set<number>();
    for (const o of Array.isArray(data.orders) ? data.orders : []) {
      const items = cleanItems(o?.items);
      if (
        !isInt(o?.id, 1) ||
        ids.has(o.id) ||
        !items?.length ||
        !isInt(o.total) ||
        !Number.isFinite(o.dueAt)
      )
        continue;
      if (this.orders.length >= DRONE.maxPending) break;
      ids.add(o.id);
      this.orders.push({
        id: o.id,
        items,
        total: o.total,
        dueAt: o.dueAt,
        slot: null,
        destination: cleanPoint(o.destination),
      });
    }
    const slots = new Set<number>();
    for (const b of Array.isArray(data.boxes) ? data.boxes : []) {
      const items = cleanItems(b?.items);
      if (
        !isInt(b?.id, 1) ||
        ids.has(b.id) ||
        !isInt(b.slot, 0, DRONE.slots.length - 1) ||
        slots.has(b.slot) ||
        !items?.length
      )
        continue;
      ids.add(b.id);
      slots.add(b.slot);
      // Una caja sin hora (guardado anterior) cuenta como entregada ahora.
      const at = Number.isFinite(b.at) && b.at >= 0 && b.at <= now ? b.at : now;
      this.boxes.push({
        id: b.id,
        slot: b.slot,
        at,
        items,
        opened: b.opened === true,
        destination: cleanPoint(b.destination),
        landing: cleanPoint(b.landing),
      });
    }
    const maxId = Math.max(0, ...ids);
    this.nextId = isInt(data.nextId, 1)
      ? Math.max(data.nextId, maxId + 1)
      : maxId + 1;
  }
}
