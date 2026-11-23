import { BALANCE } from '../config/balance';
import { CART } from '../config/cart';
import { InventorySystem } from './InventorySystem';
import type { RailSystem } from './RailSystem';

export class CartSystem {
  x: number = BALANCE.cartStartX;
  velocity = 0;
  pushing = false;
  readonly inventory = new InventorySystem(BALANCE.cartCapacity);
  constructor(readonly rails: RailSystem) {}
  stop(): void {
    this.pushing = false;
    this.velocity = 0;
  }
  /** Contacto de cada rueda con el riel y punto medio del eje. */
  contact(): { x: number; y: number; angle: number } {
    const [a, b] = CART.wheelCenters;
    const xl = this.x + a,
      xr = this.x + b;
    const yl = this.rails.railY(xl),
      yr = this.rails.railY(xr);
    return {
      x: (xl + xr) / 2,
      y: (yl + yr) / 2,
      angle: Math.atan2(yr - yl, xr - xl),
    };
  }
  /** Altura de la cabeza del riel bajo el centro del carro. */
  get y(): number {
    return this.contact().y;
  }
  step(
    direction: number,
    dt: number,
    playerCanMove: (next: number) => boolean = () => true,
  ): void {
    // Al subir cuesta más y al bajar rueda con más facilidad.
    const slope = this.rails.slopeAt(this.x);
    const grade =
      direction * slope < 0
        ? BALANCE.cartUphill
        : direction * slope > 0
          ? BALANCE.cartDownhill
          : 1;
    const desired = this.pushing ? direction * BALANCE.cartSpeed * grade : 0;
    const change =
      (direction && this.pushing
        ? BALANCE.cartAcceleration
        : BALANCE.cartBrake) * dt;
    this.velocity +=
      Math.sign(desired - this.velocity) *
      Math.min(change, Math.abs(desired - this.velocity));
    const bounds = this.rails.bounds(this.x);
    const next = Math.max(
      bounds.min,
      Math.min(bounds.max, this.x + this.velocity * dt),
    );
    if (bounds.min > bounds.max || !playerCanMove(next)) {
      this.stop();
      return;
    }
    // Llegar a un extremo sin continuidad frena el carro.
    if (next === this.x || next === bounds.min || next === bounds.max)
      this.velocity = next === this.x ? 0 : this.velocity * 0.5;
    this.x = next;
  }
}
