import type { Point } from '../world/TerrainGrid';

export interface Interaction extends Point {
  id: string;
  label: string;
  radius: number;
  facing?: boolean;
  enabled: boolean;
  action: () => void;
  /** Gana a los demás aunque estén más cerca (guía de la primera secuencia). */
  priority?: number;
}
/** Registro único. La selección es estable; una pulsación llama a una sola acción. */
export class InteractionSystem {
  readonly objects = new Map<string, Interaction>();
  selected?: Interaction;
  register(object: Interaction): void {
    this.objects.set(object.id, object);
  }
  select(
    origin: Point,
    direction: number,
    visible: (target: Interaction) => boolean = () => true,
  ): Interaction | undefined {
    this.selected = [...this.objects.values()]
      .filter(
        (o) =>
          o.enabled &&
          Math.hypot(o.x - origin.x, o.y - origin.y) <= o.radius &&
          (!o.facing || (o.x - origin.x) * direction >= -6) &&
          visible(o),
      )
      .sort(
        (a, b) =>
          (b.priority ?? 0) - (a.priority ?? 0) ||
          Math.hypot(a.x - origin.x, a.y - origin.y) -
            Math.hypot(b.x - origin.x, b.y - origin.y) ||
          a.id.localeCompare(b.id),
      )[0];
    return this.selected;
  }
  activate(): void {
    this.selected?.action();
  }
}
