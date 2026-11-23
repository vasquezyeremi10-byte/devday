import { describe, expect, it } from 'vitest';
import { SUPPLIES, TOOLS } from '../config/balance';
import {
  PHONE_CATEGORIES,
  PHONE_SHOP,
  PHONE_SHORT_LABEL,
} from '../config/phoneShop';
import {
  confirmOrder,
  formatGrams,
  NO_DISPATCHER,
  PhoneCart,
  phoneProduct,
  PHONE_PRODUCT_IDS,
  type OrderDispatcher,
  type PhoneOrder,
  type Wallet,
} from './PhoneCart';

const wallet = (money: number, extra: Partial<Wallet> = {}): Wallet => ({
  money,
  infiniteMoney: false,
  unlocked: () => true,
  ...extra,
});

describe('catálogo del celular', () => {
  it('tiene las siete categorías pedidas y no vende la picota de diamante', () => {
    expect(PHONE_CATEGORIES.map((c) => c.label)).toEqual([
      'SALUD',
      'HERRAMIENTAS',
      'ESTRUCTURAS',
      'ILUMINACION',
      'TRONADURA',
      'VENTILACION',
      'ALIMENTOS Y BEBIDAS',
    ]);
    expect(PHONE_PRODUCT_IDS).not.toContain('diamond' as never);
    expect(PHONE_PRODUCT_IDS).toHaveLength(25);
  });

  it('reutiliza precio, peso y etapa de la bodega', () => {
    expect(phoneProduct('iron')).toMatchObject({
      price: TOOLS.iron.price,
      grams: TOOLS.iron.grams,
      tier: TOOLS.iron.tier,
      source: 'tool',
    });
    expect(phoneProduct('fan_aux')).toMatchObject({
      label: SUPPLIES.fan_aux.label,
      price: SUPPLIES.fan_aux.price,
      grams: SUPPLIES.fan_aux.grams,
      source: 'supply',
    });
    expect(phoneProduct('completo')).toMatchObject({
      price: SUPPLIES.completo.price,
      source: 'supply',
    });
    for (const id of PHONE_PRODUCT_IDS) {
      const p = phoneProduct(id);
      expect(p.label.length, id).toBeGreaterThan(0);
      expect(p.desc.length, id).toBeGreaterThan(0);
      expect(p.price, id).toBeGreaterThan(0);
      expect(p.grams, id).toBeGreaterThan(0);
    }
  });

  it('cada nombre cabe en una fila del celular (19 caracteres)', () => {
    for (const id of PHONE_PRODUCT_IDS)
      expect((PHONE_SHORT_LABEL[id] ?? phoneProduct(id).label).length, id).toBeLessThanOrEqual(19);
  });

  it('formatea pesos en gramos y kilos', () => {
    expect(formatGrams(350)).toBe('350 G');
    expect(formatGrams(2400)).toBe('2,4 KG');
    expect(formatGrams(22000)).toBe('22 KG');
  });
});

describe('PhoneCart', () => {
  it('suma varias unidades y distintos productos con subtotal y total', () => {
    const cart = new PhoneCart();
    cart.add('torch', 3);
    cart.add('cola', 2);
    cart.add('torch');
    expect(cart.lines).toEqual([
      { id: 'torch', qty: 4 },
      { id: 'cola', qty: 2 },
    ]);
    expect(cart.units).toBe(6);
    expect(cart.subtotalOf('torch')).toBe(4 * SUPPLIES.torch.price);
    expect(cart.subtotal).toBe(4 * SUPPLIES.torch.price + 2 * SUPPLIES.cola.price);
    expect(cart.total).toBe(cart.subtotal + PHONE_SHOP.deliveryFee);
    expect(cart.grams).toBe(4 * SUPPLIES.torch.grams + 2 * SUPPLIES.cola.grams);
  });

  it('modifica cantidades, respeta el máximo y quita con 0', () => {
    const cart = new PhoneCart();
    expect(cart.add('rail', 150)).toBe(PHONE_SHOP.maxQty);
    expect(cart.add('rail')).toBe(0);
    cart.setQty('rail', 5);
    expect(cart.qtyOf('rail')).toBe(5);
    cart.setQty('rail', 0);
    expect(cart.empty).toBe(true);
    expect(cart.add('rail', 0)).toBe(0);
    expect(cart.add('rail', -3)).toBe(0);
    cart.add('fuse', 2);
    cart.remove('fuse');
    expect(cart.lines).toEqual([]);
    expect(cart.total).toBe(0);
  });
});

describe('confirmOrder', () => {
  it('rechaza un carrito vacío', () => {
    expect(confirmOrder(new PhoneCart(), wallet(100), NO_DISPATCHER).ok).toBe(false);
  });

  it('impide superar el saldo y no toca el carrito', () => {
    const cart = new PhoneCart();
    cart.add('steel_beam', 3);
    const r = confirmOrder(cart, wallet(10), NO_DISPATCHER);
    expect(r.ok).toBe(false);
    expect(r.message[0]).toBe('SALDO INSUFICIENTE.');
    expect(r.message[1]).toBe(`FALTAN $${3 * SUPPLIES.steel_beam.price - 10}.`);
    expect(cart.qtyOf('steel_beam')).toBe(3);
  });

  it('rechaza productos de una etapa bloqueada', () => {
    const cart = new PhoneCart();
    cart.add('tungsten');
    const r = confirmOrder(cart, wallet(500, { unlocked: (id) => id !== 'tungsten' }), NO_DISPATCHER);
    expect(r.ok).toBe(false);
    expect(r.message[1]).toBe('REQUIERE ETAPA 2.');
  });

  it('sin drones no cobra ni entrega y conserva el carrito', () => {
    const cart = new PhoneCart();
    cart.add('cola', 2);
    const r = confirmOrder(cart, wallet(100), NO_DISPATCHER);
    expect(r.ok).toBe(false);
    expect(r.message).toEqual([...NO_DISPATCHER.unavailableReason]);
    expect(r.order?.total).toBe(2 * SUPPLIES.cola.price);
    expect(cart.qtyOf('cola')).toBe(2);
  });

  it('con un despachador disponible le entrega el pedido y vacía el carrito', () => {
    const received: PhoneOrder[] = [];
    const drones: OrderDispatcher = {
      available: true,
      unavailableReason: [],
      submit: (order) => {
        received.push(order);
        return null;
      },
    };
    const cart = new PhoneCart();
    cart.add('torch', 2);
    cart.add('medkit');
    const r = confirmOrder(cart, wallet(1000), drones);
    expect(r.ok).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0]!.lines.map((l) => [l.id, l.qty, l.unitPrice])).toEqual([
      ['torch', 2, SUPPLIES.torch.price],
      ['medkit', 1, SUPPLIES.medkit.price],
    ]);
    expect(cart.empty).toBe(true);
  });

  it('con dinero infinito no limita por saldo; si el dron rechaza, el carrito queda', () => {
    const cart = new PhoneCart();
    cart.add('fan_aux', 10);
    const busy: OrderDispatcher = {
      available: true,
      unavailableReason: [],
      submit: () => 'DRON OCUPADO',
    };
    const r = confirmOrder(cart, wallet(0, { infiniteMoney: true }), busy);
    expect(r).toMatchObject({ ok: false, message: ['DRON OCUPADO'] });
    expect(cart.units).toBe(10);
  });
});
