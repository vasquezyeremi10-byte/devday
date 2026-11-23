import {
  SUPPLIES,
  TOOLS,
  type SupplyKind,
  type ToolKind,
} from '../config/balance';
import {
  MAX_SLOTS,
  PPE,
  QUICKBAR_SIZE,
  REQUIRED_PPE,
  SLOT_LABEL,
  type EquipSlot,
  type PPEKind,
} from '../config/gear';
import { isBuildMaterial } from '../config/buildMaterials';
import type { ToolSystem } from './ToolSystem';

/** Referencia a un objeto que ocupa una casilla del inventario general. */
export type ItemRef =
  | { type: 'tool'; id: number }
  | { type: 'supply'; kind: SupplyKind }
  | { type: 'ppe'; id: number };
/** La barra rápida solo referencia objetos que ya se poseen. */
export type QuickRef = Exclude<ItemRef, { type: 'ppe' }>;
export interface PPEItem {
  id: number;
  kind: PPEKind;
}
export type GearSlot = Exclude<EquipSlot, 'tool'>;

/** ¿La referencia es un material de construcción (V11)? */
const isBuildRef = (ref: ItemRef | null): boolean =>
  ref?.type === 'supply' && isBuildMaterial(ref.kind);

const same = (a: ItemRef | null, b: ItemRef | null) =>
  !!a &&
  !!b &&
  a.type === b.type &&
  (a.type === 'supply'
    ? a.kind === (b as typeof a).kind
    : a.id === (b as { id: number }).id);

/**
 * Inventario general, equipamiento y barra rápida. Es una disposición sobre
 * los bienes reales (ToolSystem, suministros y EPP): no crea ni destruye
 * objetos al moverlos. La carga minera (por peso, 50 kg) es otro sistema.
 *
 * - Cada herramienta no equipada ocupa una casilla.
 * - Cada tipo de suministro ocupa una casilla (pila sin límite).
 * - Cada EPP sin equipar ocupa una casilla; equipado no ocupa ninguna.
 * Si un objeto no cabe (partida migrada), queda en `overflow` y entra solo
 * en cuanto se libera una casilla: nunca se pierde.
 */
export class LoadoutSystem {
  slots: (ItemRef | null)[] = Array(MAX_SLOTS).fill(null);
  readonly unlocked = MAX_SLOTS;
  ppe: PPEItem[] = [];
  nextPpe = 1;
  /** EPP equipado por ranura (id del objeto). */
  gear: Record<GearSlot, number | null> = {
    head: null,
    eyes: null,
    torso: null,
    hands: null,
    feet: null,
    accessory: null,
  };
  quickbar: (QuickRef | null)[] = Array(QUICKBAR_SIZE).fill(null);
  selectedQuick: number | null = null;
  overflow: ItemRef[] = [];

  constructor(
    private readonly tools: ToolSystem,
    private readonly supplies: Record<SupplyKind, number>,
  ) {}

  /** Objetos que deben estar en el inventario general. */
  private desired(): ItemRef[] {
    const equipped = new Set(Object.values(this.gear));
    return [
      ...this.tools.items
        .filter((t) => t.id !== this.tools.equipped)
        .map((t): ItemRef => ({ type: 'tool', id: t.id })),
      ...(Object.keys(this.supplies) as SupplyKind[])
        .filter((k) => this.supplies[k] > 0)
        .map((kind): ItemRef => ({ type: 'supply', kind })),
      ...this.ppe
        .filter((p) => !equipped.has(p.id))
        .map((p): ItemRef => ({ type: 'ppe', id: p.id })),
    ];
  }

  /** Reconcilia la disposición con los bienes reales. */
  sync(): void {
    this.syncQuick();
    const want = this.desired();
    for (let i = 0; i < this.slots.length; i++) {
      const ref = this.slots[i]!;
      if (ref && !want.some((w) => same(w, ref))) this.slots[i] = null;
    }
    const missing = want.filter((w) => !this.slots.some((s) => same(s, w)));
    this.overflow = [];
    for (const ref of missing) {
      const free = this.slots.findIndex((s) => !s);
      if (free >= 0) this.slots[free] = ref;
      else this.overflow.push(ref);
    }
  }

  free(): number {
    this.sync();
    return this.slots.filter((s) => !s).length;
  }

  /** ¿Cabe una compra sin perder nada? */
  canAccept(kind: ToolKind | SupplyKind | PPEKind): boolean {
    if (kind in PPE)
      return !this.gear[PPE[kind as PPEKind].slot] || this.free() > 0;
    if (kind in SUPPLIES)
      return this.supplies[kind as SupplyKind] > 0 || this.free() > 0;
    // Herramienta nueva: se equipa y la anterior pasa a una casilla.
    return !this.tools.current || this.free() > 0;
  }

  ppeById(id: number | null): PPEItem | undefined {
    return id === null ? undefined : this.ppe.find((p) => p.id === id);
  }

  /** EPP nuevo: se equipa solo si su ranura está libre. */
  addPPE(kind: PPEKind): PPEItem {
    const item = { id: this.nextPpe++, kind };
    this.ppe.push(item);
    const slot = PPE[kind].slot;
    if (!this.gear[slot]) this.gear[slot] = item.id;
    this.sync();
    return item;
  }

  equipped(kind: PPEKind): boolean {
    return this.ppeById(this.gear[PPE[kind].slot])?.kind === kind;
  }
  missing(): PPEKind[] {
    return REQUIRED_PPE.filter((k) => !this.equipped(k));
  }
  get complete(): boolean {
    return this.missing().length === 0;
  }

  /** Equipa el objeto de una casilla; el anterior de esa ranura ocupa su lugar. */
  equipFromSlot(index: number): string | null {
    const ref = this.slots[index];
    if (!ref) return 'CASILLA VACIA';
    if (ref.type === 'supply') return 'ESTE OBJETO NO SE EQUIPA';
    if (ref.type === 'tool') {
      this.selectedQuick = null;
      const previous = this.tools.equipped;
      this.tools.equipped = ref.id;
      this.slots[index] = previous ? { type: 'tool', id: previous } : null;
      this.sync();
      return null;
    }
    const item = this.ppeById(ref.id)!;
    const slot = PPE[item.kind].slot;
    const previous = this.gear[slot];
    this.gear[slot] = item.id;
    this.slots[index] =
      previous !== null ? { type: 'ppe', id: previous } : null;
    this.sync();
    return null;
  }

  /** Quita lo equipado en una ranura; necesita una casilla libre. */
  unequip(slot: EquipSlot): string | null {
    if (slot === 'tool') {
      if (!this.tools.equipped) return 'NO HAY HERRAMIENTA EQUIPADA';
      if (this.free() < 1) return 'INVENTARIO LLENO: LIBERA UNA CASILLA';
      this.selectedQuick = null;
      this.tools.equipped = 0;
      this.sync();
      return null;
    }
    if (this.gear[slot] === null) return 'RANURA VACIA';
    if (this.free() < 1) return 'INVENTARIO LLENO: LIBERA UNA CASILLA';
    this.gear[slot] = null;
    this.sync();
    return null;
  }

  /** Equipa una herramienta del tipo (recorre repuestos utilizables). */
  equipToolKind(kind: ToolKind): boolean {
    const candidates = this.tools.items.filter(
      (t) => t.kind === kind && t.durability > 0,
    );
    if (!candidates.length) return false;
    const current = candidates.findIndex((t) => t.id === this.tools.equipped);
    const next = candidates[(current + 1) % candidates.length]!;
    if (next.id === this.tools.equipped) return true;
    const index = this.slots.findIndex(
      (s) => s?.type === 'tool' && s.id === next.id,
    );
    if (index >= 0) return this.equipFromSlot(index) === null;
    this.selectedQuick = null;
    this.tools.equipped = next.id;
    this.sync();
    return true;
  }

  /** Mover o intercambiar entre casillas. Nunca duplica. */
  move(from: number, to: number): string | null {
    if (from === to) return null;
    if (from < 0 || to < 0 || from >= MAX_SLOTS || to >= MAX_SLOTS)
      return 'CASILLA INVALIDA';
    if (!this.slots[from]) return 'CASILLA VACIA';
    [this.slots[from], this.slots[to]] = [this.slots[to]!, this.slots[from]!];
    return null;
  }

  /** Descarta el objeto (o la pila) de una casilla. */
  discard(index: number): string | null {
    const ref = this.slots[index];
    if (!ref) return 'CASILLA VACIA';
    if (ref.type === 'supply') this.supplies[ref.kind] = 0;
    else if (ref.type === 'tool')
      this.tools.items = this.tools.items.filter((t) => t.id !== ref.id);
    else this.ppe = this.ppe.filter((p) => p.id !== ref.id);
    this.slots[index] = null;
    this.sync();
    return null;
  }

  assignQuick(index: number, ref: ItemRef | null): string | null {
    if (index < 0 || index >= QUICKBAR_SIZE) return 'RANURA INVALIDA';
    if (ref?.type === 'ppe') return 'EL EPP NO VA EN LA BARRA RAPIDA';
    if (ref && !this.ownsQuick(ref)) return 'OBJETO NO DISPONIBLE';
    const previous = this.quickbar.findIndex((q) => same(q, ref));
    if (previous >= 0 && previous !== index) {
      this.moveQuick(previous, index);
    } else {
      this.quickbar[index] = ref;
      if (this.selectedQuick === index) this.selectQuick(index);
    }
    return null;
  }

  ownsQuick(ref: QuickRef): boolean {
    // Los materiales de construcción conservan su acceso aun en cero: así la
    // casilla no se mueve de lugar cada vez que se agota y se vuelve a juntar.
    return ref.type === 'supply'
      ? this.supplies[ref.kind] > 0 || isBuildMaterial(ref.kind)
      : this.tools.items.some((t) => t.id === ref.id);
  }

  /** Reconcilia las referencias sin reponer automáticamente objetos perdidos. */
  syncQuick(): void {
    for (let i = 0; i < QUICKBAR_SIZE; i++) {
      const ref = this.quickbar[i];
      if (ref && !this.ownsQuick(ref)) this.quickbar[i] = null;
    }
    // Compras, auxilio u otras acciones pueden equipar una herramienta por su cuenta.
    const ref = this.activeQuick;
    // Elegir un bloque de construcción conserva la herramienta en mano.
    if (
      this.selectedQuick !== null &&
      !isBuildRef(ref) &&
      this.tools.equipped !== (ref?.type === 'tool' ? ref.id : 0)
    )
      this.selectedQuick = null;
  }

  get activeQuick(): QuickRef | null {
    return this.selectedQuick === null
      ? null
      : (this.quickbar[this.selectedQuick] ?? null);
  }

  moveQuick(from: number, to: number): void {
    if (from === to) return;
    [this.quickbar[from], this.quickbar[to]] = [
      this.quickbar[to] ?? null,
      this.quickbar[from] ?? null,
    ];
    if (this.selectedQuick === from) this.selectedQuick = to;
    else if (this.selectedQuick === to) this.selectedQuick = from;
  }

  /** La tecla equipa el ejemplar exacto; un acceso vacío deja las manos libres. */
  selectQuick(index: number): void {
    if (index < 0 || index >= QUICKBAR_SIZE) return;
    this.syncQuick();
    const ref = this.quickbar[index];
    const previous = this.tools.equipped;
    // Un bloque de construcción se elige sin soltar la herramienta: clic
    // izquierdo rompe con ella y clic derecho coloca el bloque.
    this.tools.equipped =
      ref?.type === 'tool' ? ref.id : isBuildRef(ref ?? null) ? previous : 0;
    if (ref?.type === 'tool' && previous !== ref.id) {
      const slot = this.slots.findIndex((s) => same(s, ref));
      if (slot >= 0)
        this.slots[slot] = previous ? { type: 'tool', id: previous } : null;
    }
    this.selectedQuick = index;
    this.sync();
  }

  /** Texto de información de una referencia. */
  describe(ref: ItemRef | null): string[] {
    if (!ref) return [];
    if (ref.type === 'supply') {
      const s = SUPPLIES[ref.kind];
      const type =
        s.category === 'ALIMENTOS Y BEBIDAS'
          ? 'ALIMENTO'
          : s.category === 'MATERIALES'
            ? 'MATERIAL'
            : 'SUMINISTRO';
      return [s.label, `TIPO: ${type} X${this.supplies[ref.kind]}`, s.desc];
    }
    if (ref.type === 'tool') {
      const t = this.tools.items.find((x) => x.id === ref.id);
      if (!t) return [];
      const def = TOOLS[t.kind];
      return [
        def.label,
        `TIPO: HERRAMIENTA | ${def.workMs / 1000} S POR BLOQUE`,
        `DURABILIDAD ${t.durability}/${def.durability} | ${this.tools.state(t)}`,
      ];
    }
    const p = this.ppeById(ref.id);
    if (!p) return [];
    const def = PPE[p.kind];
    return [def.label, `TIPO: EPP | RANURA ${SLOT_LABEL[def.slot]}`, def.desc];
  }
}
