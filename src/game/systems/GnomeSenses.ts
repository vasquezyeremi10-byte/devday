import { TILE_SIZE } from '../config/constants';
import { GNOME_AI } from '../config/gnomeAI';
import { GNOME_SHEET } from '../config/gnomeAnimations';

/** Consulta de celdas sólidas (TerrainGrid.isSolid). */
export type SolidAt = (column: number, row: number) => boolean;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Lo que el gnomo encuentra delante de sus pies, hacia un lado. */
export interface Probe {
  /** Roca a la altura del cuerpo. */
  wall: boolean;
  /** La roca es un escalón de un bloque con espacio libre para saltarlo. */
  step: boolean;
  /** Bloques de caída antes de encontrar suelo (Infinity si no hay). */
  drop: number;
}

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

/**
 * Línea de visión entre dos puntos del mundo: recorre exactamente las celdas
 * que cruza el segmento (Amanatides–Woo) y falla en la primera sólida.
 */
export function lineOfSight(
  solid: SolidAt,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  let column = Math.floor(ax / TILE_SIZE);
  let row = Math.floor(ay / TILE_SIZE);
  const endColumn = Math.floor(bx / TILE_SIZE);
  const endRow = Math.floor(by / TILE_SIZE);
  const dx = bx - ax;
  const dy = by - ay;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const tDeltaX = stepX ? TILE_SIZE / Math.abs(dx) : Infinity;
  const tDeltaY = stepY ? TILE_SIZE / Math.abs(dy) : Infinity;
  const edgeX = stepX > 0 ? (column + 1) * TILE_SIZE : column * TILE_SIZE;
  const edgeY = stepY > 0 ? (row + 1) * TILE_SIZE : row * TILE_SIZE;
  let tMaxX = stepX ? (edgeX - ax) / dx : Infinity;
  let tMaxY = stepY ? (edgeY - ay) / dy : Infinity;
  for (let guard = 0; guard < 512; guard++) {
    if (solid(column, row)) return false;
    if (column === endColumn && row === endRow) return true;
    if (tMaxX < tMaxY) {
      column += stepX;
      tMaxX += tDeltaX;
    } else {
      row += stepY;
      tMaxY += tDeltaY;
    }
  }
  return false;
}

/** Explora la columna que hay justo delante del cuerpo, hacia `dir`. */
export function probeAhead(solid: SolidAt, body: Rect, dir: -1 | 1): Probe {
  const x = dir > 0 ? body.x + body.width + 3 : body.x - 3;
  const column = Math.floor(x / TILE_SIZE);
  const feet = Math.floor((body.y + body.height - 1) / TILE_SIZE);
  const head = Math.floor(body.y / TILE_SIZE);
  let wall = false;
  for (let row = head; row <= feet; row++) if (solid(column, row)) wall = true;
  const own = Math.floor((body.x + body.width / 2) / TILE_SIZE);
  const step =
    wall &&
    solid(column, feet) &&
    !solid(column, feet - 1) &&
    !solid(column, feet - 2) &&
    !solid(own, feet - 2);
  let drop = 0;
  if (!wall)
    for (drop = 0; drop <= 8 && !solid(column, feet + 1 + drop); drop++);
  return { wall, step, drop: drop > 8 ? Infinity : drop };
}

/**
 * Caja de golpe de la picota en el mundo. `box` está en coordenadas del
 * cuadro (mirando a la derecha); el sprite usa origen centrado.
 */
export function strikeRect(
  box: Rect,
  spriteX: number,
  spriteY: number,
  facing: -1 | 1,
): Rect {
  const left = spriteX - GNOME_SHEET.frameWidth / 2;
  const top = spriteY - GNOME_SHEET.frameHeight / 2;
  return {
    x:
      facing > 0
        ? left + box.x
        : left + GNOME_SHEET.frameWidth - box.x - box.width,
    y: top + box.y,
    width: box.width,
    height: box.height,
  };
}

/**
 * El golpe conecta si la picota toca al objetivo y ninguna roca se interpone
 * entre el pecho del gnomo y el punto de contacto.
 */
export function strikeConnects(
  solid: SolidAt,
  chest: { x: number; y: number },
  strike: Rect,
  target: Rect,
): boolean {
  if (!rectsOverlap(strike, target)) return false;
  const x0 = Math.max(strike.x, target.x);
  const x1 = Math.min(strike.x + strike.width, target.x + target.width);
  const y0 = Math.max(strike.y, target.y);
  const y1 = Math.min(strike.y + strike.height, target.y + target.height);
  return lineOfSight(solid, chest.x, chest.y, (x0 + x1) / 2, (y0 + y1) / 2);
}

/**
 * ¿Ve el gnomo al minero? Mira lejos hacia delante y poco hacia atrás; la
 * roca bloquea la vista (se prueba la cabeza y el centro del minero).
 */
export function canSee(
  solid: SolidAt,
  eye: { x: number; y: number },
  facing: -1 | 1,
  target: Rect,
): boolean {
  const cx = target.x + target.width / 2;
  const dx = cx - eye.x;
  const dy = target.y + target.height / 2 - eye.y;
  if (Math.abs(dy) > GNOME_AI.sightHeight) return false;
  const range = dx * facing >= 0 ? GNOME_AI.sightAhead : GNOME_AI.sightBehind;
  if (Math.abs(dx) > range) return false;
  return (
    lineOfSight(solid, eye.x, eye.y, cx, target.y + 3) ||
    lineOfSight(solid, eye.x, eye.y, cx, target.y + target.height / 2)
  );
}
