import { PPE } from '../config/gear';
import {
  SUPPLIES,
  TOOL_DESC,
  TOOLS,
  type SupplyKind,
  type ToolKind,
} from '../config/balance';
import { DRONE } from '../config/drones';
import {
  PHONE_CATEGORIES,
  PHONE_SHOP,
  type PhoneProductId,
} from '../config/phoneShop';

/**
 * Carrito del celular (lógica pura, sin Phaser). El carrito no cobra ni
 * entrega: al confirmar valida el pedido y lo entrega a un `OrderDispatcher`
 * (el sistema de drones). Mientras no haya uno disponible el pedido queda en
 * el carrito y no se descuenta dinero.
 */
export interface PhoneProduct {
  id: PhoneProductId;
  label: string;
  desc: string;
  price: number;
  grams: number;
  tier: number;
  source: 'tool' | 'supply' | 'ppe';
}

export function phoneProduct(id: PhoneProductId): PhoneProduct {
  if (Object.hasOwn(TOOLS, id)) {
    const t = TOOLS[id as ToolKind];
    return {
      id,
      label: t.label,
      desc: TOOL_DESC[id as ToolKind],
      price: t.price,
      grams: t.grams,
      tier: t.tier,
      source: 'tool',
    };
  }
  if (id === 'ear') return { id, ...PPE.ear, source: 'ppe' };
  const s = SUPPLIES[id as SupplyKind];
  return {
    id,
    label: s.label,
    desc: s.desc,
    price: s.price,
    grams: s.grams,
    tier: s.tier,
    source: 'supply',
  };
}

/** Todos los productos del catálogo, sin repetir. */
export const PHONE_PRODUCT_IDS: readonly PhoneProductId[] = [
  ...new Set(PHONE_CATEGORIES.flatMap((c) => c.items)),
];

export interface CartLine {
  id: PhoneProductId;
  qty: number;
}
export interface OrderLine extends CartLine {
  unitPrice: number;
  subtotal: number;
  grams: number;
}
/** Pedido listo para el sistema de drones (precios fijados al confirmar). */
export interface PhoneOrder {
  lines: OrderLine[];
  units: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  grams: number;
}

/**
 * Punto de integración con los drones. `submit` cobra y programa la
 * entrega; devuelve null si aceptó el pedido o el motivo del rechazo.
 */
export interface OrderDispatcher {
  readonly available: boolean;
  readonly unavailableReason: readonly string[];
  submit(order: PhoneOrder): string | null;
}
/** Sin drones todavía: ningún pedido se cobra ni se entrega. */
export const NO_DISPATCHER: OrderDispatcher = {
  available: false,
  unavailableReason: ['ENTREGA POR DRON', 'AUN NO DISPONIBLE.', 'NO SE COBRO NADA.'],
  submit: () => 'ENTREGA POR DRON NO DISPONIBLE',
};

/** Lo que el carrito necesita saber del jugador para validar. */
export interface Wallet {
  money: number;
  infiniteMoney: boolean;
  unlocked(id: PhoneProductId): boolean;
}

export class PhoneCart {
  readonly lines: CartLine[] = [];

  qtyOf(id: PhoneProductId): number {
    return this.lines.find((l) => l.id === id)?.qty ?? 0;
  }
  /** Suma unidades (hasta el máximo por producto) y devuelve las añadidas. */
  add(id: PhoneProductId, qty = 1): number {
    const n = Math.floor(qty);
    if (!(n > 0)) return 0;
    const before = this.qtyOf(id);
    this.setQty(id, before + n);
    return this.qtyOf(id) - before;
  }
  /** Fija la cantidad; 0 o menos quita la línea. */
  setQty(id: PhoneProductId, qty: number): void {
    const n = Math.min(PHONE_SHOP.maxQty, Math.floor(qty) || 0);
    const i = this.lines.findIndex((l) => l.id === id);
    if (n <= 0) {
      if (i >= 0) this.lines.splice(i, 1);
    } else if (i >= 0) this.lines[i]!.qty = n;
    else this.lines.push({ id, qty: n });
  }
  remove(id: PhoneProductId): void {
    this.setQty(id, 0);
  }
  clear(): void {
    this.lines.length = 0;
  }
  get empty(): boolean {
    return this.lines.length === 0;
  }
  get units(): number {
    return this.lines.reduce((sum, l) => sum + l.qty, 0);
  }
  subtotalOf(id: PhoneProductId): number {
    return phoneProduct(id).price * this.qtyOf(id);
  }
  get subtotal(): number {
    return this.lines.reduce((sum, l) => sum + phoneProduct(l.id).price * l.qty, 0);
  }
  get deliveryFee(): number {
    return this.empty ? 0 : PHONE_SHOP.deliveryFee;
  }
  get total(): number {
    return this.subtotal + this.deliveryFee;
  }
  get grams(): number {
    return this.lines.reduce((sum, l) => sum + phoneProduct(l.id).grams * l.qty, 0);
  }
  order(): PhoneOrder {
    const lines = this.lines.map((l) => {
      const p = phoneProduct(l.id);
      return {
        id: l.id,
        qty: l.qty,
        unitPrice: p.price,
        subtotal: p.price * l.qty,
        grams: p.grams * l.qty,
      };
    });
    return {
      lines,
      units: this.units,
      subtotal: this.subtotal,
      deliveryFee: this.deliveryFee,
      total: this.total,
      grams: this.grams,
    };
  }
}

export interface ConfirmResult {
  ok: boolean;
  /** Líneas cortas para la pantalla del celular. */
  message: string[];
  order?: PhoneOrder;
}

/**
 * Confirmar pedido: carrito no vacío, productos desbloqueados y saldo
 * suficiente. Si no hay drones, el pedido no se cobra y el carrito se
 * conserva. Con drones, el despachador cobra; el carrito se vacía solo si
 * acepta el pedido.
 */
export function confirmOrder(
  cart: PhoneCart,
  wallet: Wallet,
  dispatcher: OrderDispatcher,
): ConfirmResult {
  if (cart.empty) return { ok: false, message: ['TU CARRITO', 'ESTA VACIO.'] };
  const locked = cart.lines.find((l) => !wallet.unlocked(l.id));
  if (locked) {
    const p = phoneProduct(locked.id);
    return { ok: false, message: [p.label, `REQUIERE ETAPA ${p.tier}.`] };
  }
  const order = cart.order();
  if (!wallet.infiniteMoney && order.total > wallet.money)
    return {
      ok: false,
      message: ['SALDO INSUFICIENTE.', `FALTAN $${order.total - wallet.money}.`],
      order,
    };
  if (!dispatcher.available)
    return { ok: false, message: [...dispatcher.unavailableReason], order };
  const refused = dispatcher.submit(order);
  // «|» separa las líneas del motivo en la pantalla del celular.
  if (refused) return { ok: false, message: refused.split('|'), order };
  cart.clear();
  return {
    ok: true,
    message: [
      `PEDIDO PAGADO: $${order.total}.`,
      `LLEGA EN DRON EN ${Math.round(DRONE.waitMs / 1000)} S.`,
    ],
    order,
  };
}

/** Peso legible: gramos bajo 1 kg, kilos con coma decimal desde 1 kg. */
export function formatGrams(grams: number): string {
  if (grams < 1000) return `${Math.round(grams)} G`;
  const kg = Math.round(grams / 100) / 10;
  return `${String(kg).replace('.', ',')} KG`;
}
