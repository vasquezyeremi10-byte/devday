import type { SupplyKind, ToolKind } from './balance';

/**
 * Celular (tecla U): aplicación «TIENDA MINERA». Catálogo por categorías que
 * reutiliza precios, pesos, etapas y descripciones de TOOLS, SUPPLIES y PPE.
 * Los pedidos confirmados se entregan por dron. Ver systems/PhoneCart.ts.
 */
export const PHONE_SHOP = {
  app: 'TIENDA MINERA',
  /** Unidades máximas de un mismo producto en el carrito. */
  maxQty: 99,
  /** Costo provisional del envío. */
  deliveryFee: 0,
} as const;

/** Nombres abreviados para las filas del celular (19 caracteres máx.). */
export const PHONE_SHORT_LABEL: Partial<Record<string, string>> = {
  ear: 'PROTEC. AUDITIVO',
  fan_main: 'VENTILADOR PPAL.',
  industrial: 'LUMINARIA INDUST.',
};

/** Marco del teléfono en la vista de 480 × 270 (la pantalla va 6 px adentro). */
export const PHONE_LAYOUT = { x: 164, y: 6, w: 152, h: 258 } as const;

/**
 * Productos que solo vende el celular. Desde los drones son suministros
 * reales (SUPPLIES + FOODS) con precio, peso y efecto PROVISIONALES.
 */
export const PHONE_ONLY = ['medkit', 'completo', 'suavecilla', 'terremoto'] as const;

export type PhoneProductId = ToolKind | SupplyKind | 'ear';

/** Categorías en el orden de las pestañas del celular. */
export const PHONE_CATEGORIES: readonly {
  id: string;
  label: string;
  items: readonly PhoneProductId[];
}[] = [
  { id: 'health', label: 'SALUD', items: ['medkit', 'ear'] },
  {
    id: 'tools',
    label: 'HERRAMIENTAS',
    items: ['iron', 'tungsten', 'shovel', 'axe', 'drill'],
  },
  {
    id: 'structures',
    label: 'ESTRUCTURAS',
    items: ['rail', 'wood_beam', 'steel_beam'],
  },
  {
    id: 'lighting',
    label: 'ILUMINACION',
    items: ['torch', 'lamp', 'industrial', 'battery'],
  },
  { id: 'blasting', label: 'TRONADURA', items: ['dynamite', 'fuse'] },
  { id: 'ventilation', label: 'VENTILACION', items: ['duct', 'fan_aux', 'fan_main'] },
  {
    id: 'food',
    label: 'ALIMENTOS Y BEBIDAS',
    // «cola» es la bebida cola de la bodega (sin marca registrada).
    items: ['cola', 'sandwich', 'empanada', 'completo', 'suavecilla', 'terremoto'],
  },
];
