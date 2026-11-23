import { TILE_SIZE } from '../config/constants';
import { LIGHTING } from '../config/lighting';

const H = LIGHTING.headlamp;

export interface Point {
  x: number;
  y: number;
}

/**
 * Luz de área cuadrada: plena dentro de un cuadro de `tiles` × `tiles`
 * bloques centrado en la fuente y luego se va apagando de a poco durante
 * `fadeTiles` bloques más. Usa la distancia de Chebyshev (máximo de |dx| y
 * |dy|), así el área iluminada es un cuadrado de bloques, no un círculo.
 */
export function squareFalloff(
  dx: number,
  dy: number,
  tiles: number,
  fadeTiles: number,
): number {
  const half = (tiles * TILE_SIZE) / 2,
    fade = fadeTiles * TILE_SIZE;
  const d = Math.max(Math.abs(dx), Math.abs(dy));
  if (d <= half) return 1;
  if (d >= half + fade) return 0;
  return 1 - (d - half) / fade;
}

/**
 * V12: luz radial tipo antorcha en la mano. Plena dentro de `coreTiles`
 * bloques de la lámpara y luego decae con la distancia euclidiana hasta 0 en
 * `radiusTiles`; `curve` > 1 la apaga más pronto. Igual en todas direcciones.
 */
export function radialFalloff(
  dx: number,
  dy: number,
  coreTiles: number,
  radiusTiles: number,
  curve = 1,
): number {
  const core = coreTiles * TILE_SIZE,
    radius = radiusTiles * TILE_SIZE;
  const d = Math.hypot(dx, dy);
  if (d <= core) return 1;
  if (d >= radius) return 0;
  return Math.pow(1 - (d - core) / (radius - core), curve);
}

/** Alcance total (px) de una luz cuadrada desde su centro. */
export const squareReach = (tiles: number, fadeTiles: number) =>
  ((tiles / 2 + fadeTiles) * TILE_SIZE) | 0;

/**
 * Lámpara del casco con luz radial (ver `radialFalloff`), independiente de
 * Phaser. Ilumina en todas direcciones alrededor del casco. Guarda la posición de la
 * lámpara (punto luminoso, centro de la luz y origen de la oclusión), el centro del minero y la potencia de encendido.
 */
export class HeadlampLight {
  x = 0;
  y = 0;
  facing: 1 | -1 = 1;
  /** 0 apagada, 1 encendida; se interpola con `fadeMs`. */
  power = 0;
  /** Centro del área iluminada verticalmente: el cuerpo del minero. */
  body: Point = { x: 0, y: 0 };

  /**
   * @param origin píxel de la lámpara en el mundo
   * @param body centro del minero (centro vertical del haz)
   */
  update(
    dtMs: number,
    on: boolean,
    origin: Point,
    body: Point,
    facing: 1 | -1,
  ): void {
    this.x = origin.x;
    this.y = origin.y;
    this.body = body;
    this.facing = facing;
    const fade = dtMs / H.fadeMs;
    this.power = on
      ? Math.min(1, this.power + fade)
      : Math.max(0, this.power - fade);
  }

  /** Intensidad en el punto (x, y), sin oclusión. */
  light(x: number, y: number): number {
    if (this.power <= 0) return 0;
    const R = H.radial;
    return (
      this.power *
      H.intensity *
      radialFalloff(x - this.x, y - this.y, R.coreTiles, R.radiusTiles, R.curve)
    );
  }
}
