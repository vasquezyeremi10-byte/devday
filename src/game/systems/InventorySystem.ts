import { MATERIAL_KG, type Material } from '../config/balance';

/**
 * Carga por peso (kg). Cada entrada es un bloque (≈ 1 kg, MATERIAL_KG); la
 * capacidad es el peso máximo: 50 kg encima del minero y 100 kg en el carro.
 * Herramientas y monedas van aparte.
 */
export class InventorySystem {
  constructor(
    /** Peso máximo en kg. */
    readonly capacity: number,
    readonly items: Material[] = [],
  ) {}
  /** Peso total transportado (kg). */
  get weight(): number {
    return this.items.reduce((kg, m) => kg + MATERIAL_KG[m], 0);
  }
  /** ¿Entra otro bloque de ese material sin pasar la capacidad? */
  fits(item: Material = 'dirt'): boolean {
    return this.weight + MATERIAL_KG[item] <= this.capacity + 1e-9;
  }
  /** Sin lugar ni para el bloque más liviano. */
  get full(): boolean {
    return !this.fits();
  }
  add(item: Material): boolean {
    if (!this.fits(item)) return false;
    this.items.push(item);
    return true;
  }
  /** Pasa hasta `count` bloques (los primeros) mientras quepan por peso. */
  transferTo(other: InventorySystem, count = this.items.length): number {
    if (other === this) return 0;
    const limit = Math.max(0, Math.floor(count));
    let moved = 0;
    while (moved < limit && this.items.length) {
      const item = this.items[0]!;
      if (!other.fits(item)) break;
      other.items.push(this.items.shift()!);
      moved++;
    }
    return moved;
  }
}
