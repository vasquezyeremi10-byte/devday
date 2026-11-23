import { PLAYER, TILE_SIZE } from '../config/constants';
import { PPE_EFFECT } from '../config/gear';
import { Block, type Cell, type TerrainGrid } from '../world/TerrainGrid';

/**
 * Física de los bloques desprendidos por un derrumbe (lógica pura, sin
 * Phaser). Modelo de videojuego, no una simulación geomecánica:
 *
 * - Solo los bloques desprendidos se simulan; el resto del terreno es
 *   estático. Al desprenderse, el bloque deja la cuadrícula y pasa a esta
 *   lista; al detenerse vuelve a la cuadrícula como escombro. Un bloque
 *   desprendido es siempre un bloque asentado: nada se duplica.
 * - Cada bloque cae recto por su columna: primero se afloja (`delay`, tiembla
 *   en su sitio), después acelera con la gravedad del mundo hasta un tope.
 * - Se detiene sobre el primer sólido que encuentra (piso, escombro ya
 *   asentado o un bloque que cayó antes) y se apila.
 * - Si en la caída toca al minero o al carro se parte: el golpe se informa
 *   (con su velocidad) y el bloque no deja escombro ahí.
 */
export const FALL = {
  /** Aceleración (px/s²): la misma gravedad que el minero. */
  gravity: PLAYER.gravity,
  /** Velocidad máxima de caída (px/s). */
  maxSpeed: 360,
  /** Aflojamiento antes de soltarse (ms): mínimo y margen según la posición. */
  loosenMs: 140,
  loosenSpreadMs: 360,
  /** Bloques simulados a la vez; un derrumbe nuevo espera si no hay lugar. */
  maxActive: 96,
  /** Paso máximo de integración (ms): un cuadro lento no atraviesa el piso. */
  maxStepMs: 50,
  /**
   * Golpe al minero: bajo `minSpeed` el bloque apenas se movía y no daña;
   * sobre eso, daño = base + velocidad × perSpeed, con tope. Un techo a dos
   * bloques golpea a ~130 px/s; desde cinco bloques, a ~270 px/s.
   */
  damage: { minSpeed: 60, base: 20, perSpeed: 0.3, max: 95 },
} as const;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FallingBlock {
  id: number;
  column: number;
  /** Borde superior (px del mundo); el bloque ocupa TILE_SIZE hacia abajo. */
  y: number;
  /** Velocidad vertical (px/s), siempre hacia abajo. */
  vy: number;
  /** Bloque que era en el techo (define su aspecto mientras cae). */
  block: Block;
  /** Cuadro del tileset con que se dibujaba (−1: lo decide la vista). */
  frame: number;
  /** Tiempo que le queda aflojándose antes de soltarse (ms). */
  delay: number;
}

export interface Landing {
  block: FallingBlock;
  cell: Cell;
  /** Velocidad al tocar (px/s). */
  speed: number;
}
export interface Break {
  block: FallingBlock;
  speed: number;
  /** Qué lo partió; `lost` = no encontró dónde asentarse. */
  by: 'player' | 'cart' | 'lost';
}
export interface FallStep {
  /** Bloques que terminaron de aflojarse y empezaron a caer en este paso. */
  released: FallingBlock[];
  landed: Landing[];
  broken: Break[];
}

/** Guardado: [columna, borde superior en px, bloque]. */
export type FallingSnapshot = [number, number, number][];

const T = TILE_SIZE;

/**
 * Daño de un bloque que golpea al minero según la velocidad del impacto. El
 * casco amortigua el golpe (PPE_EFFECT.helmetRock), nunca lo anula.
 */
export function impactDamage(speed: number, helmet: boolean): number {
  const { minSpeed, base, perSpeed, max } = FALL.damage;
  if (!(speed >= minSpeed)) return 0;
  const raw = Math.min(max, base + speed * perSpeed);
  return raw * (helmet ? PPE_EFFECT.helmetRock : 1);
}

/** Primera fila sólida bajo un bloque cuyo borde superior está en `y`. */
function floorRow(grid: TerrainGrid, column: number, y: number): number {
  let row = Math.floor((y + T - 1) / T) + 1;
  // Fuera de la cuadrícula `isSolid` responde lecho: siempre hay piso.
  while (!grid.isSolid(column, row)) row++;
  return row;
}

const overlaps = (column: number, top: number, bottom: number, r: Rect) =>
  column * T < r.x + r.w &&
  (column + 1) * T > r.x &&
  top < r.y + r.h &&
  bottom > r.y;

export class FallingBlocks {
  readonly blocks: FallingBlock[] = [];
  private nextId = 1;

  get active(): boolean {
    return this.blocks.length > 0;
  }
  /** Lugares libres para un derrumbe nuevo. */
  get room(): number {
    return FALL.maxActive - this.blocks.length;
  }

  /** Suma un bloque ya retirado de la cuadrícula, en la celda donde estaba. */
  add(cell: Cell, block: Block, delay = 0, frame = -1): FallingBlock {
    const item: FallingBlock = {
      id: this.nextId++,
      column: cell.column,
      y: cell.row * T,
      vy: 0,
      block,
      frame,
      delay: Math.max(0, delay),
    };
    this.blocks.push(item);
    return item;
  }

  /**
   * Avanza la caída `dtMs` milisegundos de simulación. `hazards` son los
   * cuerpos que parten un bloque al tocarlo (el minero y el carro).
   */
  step(
    dtMs: number,
    grid: TerrainGrid,
    hazards: { player?: Rect | null; cart?: Rect | null } = {},
  ): FallStep {
    const out: FallStep = { released: [], landed: [], broken: [] };
    if (!this.blocks.length || !(dtMs > 0)) return out;
    const ms = Math.min(dtMs, FALL.maxStepMs);
    // De abajo hacia arriba: el de más abajo se asienta primero y el de
    // encima ya encuentra su escombro en la cuadrícula.
    const order = [...this.blocks].sort((a, b) => b.y - a.y || a.id - b.id);
    /** Bloque que sigue cayendo más abajo en cada columna. */
    const below = new Map<number, FallingBlock>();
    const gone = new Set<FallingBlock>();
    for (const b of order) {
      let dt = ms;
      if (b.delay > 0) {
        const used = Math.min(b.delay, dt);
        b.delay -= used;
        dt -= used;
        if (b.delay > 0) {
          below.set(b.column, b);
          continue;
        }
        out.released.push(b);
      }
      const seconds = dt / 1000;
      const from = b.y;
      b.vy = Math.min(FALL.maxSpeed, b.vy + FALL.gravity * seconds);
      let y = b.y + b.vy * seconds;
      // No atraviesa al bloque que cae justo debajo en su columna.
      const lower = below.get(b.column);
      if (lower && y > lower.y - T) {
        y = Math.max(from, lower.y - T);
        b.vy = Math.min(b.vy, lower.vy);
      }
      const stop = floorRow(grid, b.column, from);
      const rest = (stop - 1) * T;
      const reached = Math.min(y, rest);
      // Golpe en el tramo recorrido en este paso (sin saltarse cuerpos).
      const hit =
        b.vy >= FALL.damage.minSpeed
          ? hazards.player &&
            overlaps(b.column, from, reached + T, hazards.player)
            ? 'player'
            : hazards.cart &&
                overlaps(b.column, from, reached + T, hazards.cart)
              ? 'cart'
              : null
          : null;
      if (hit) {
        gone.add(b);
        out.broken.push({ block: b, speed: b.vy, by: hit });
        continue;
      }
      if (y >= rest) {
        b.y = rest;
        gone.add(b);
        const cell = { column: b.column, row: stop - 1 };
        if (
          grid.contains(cell.column, cell.row) &&
          !grid.isSolid(cell.column, cell.row)
        ) {
          grid.set(cell.column, cell.row, Block.Rubble);
          out.landed.push({ block: b, cell, speed: b.vy });
        } else out.broken.push({ block: b, speed: b.vy, by: 'lost' });
        continue;
      }
      b.y = y;
      below.set(b.column, b);
    }
    if (gone.size) {
      let kept = 0;
      for (const b of this.blocks) if (!gone.has(b)) this.blocks[kept++] = b;
      this.blocks.length = kept;
    }
    return out;
  }

  /**
   * Asienta de inmediato todo lo que esté cayendo (al cargar una partida o
   * al cambiar de escena en pleno derrumbe): cada bloque queda como escombro
   * donde habría terminado. Devuelve las celdas que ocupó.
   */
  settle(grid: TerrainGrid): Cell[] {
    const cells: Cell[] = [];
    const order = [...this.blocks].sort((a, b) => b.y - a.y || a.id - b.id);
    for (const b of order) {
      const row = floorRow(grid, b.column, b.y) - 1;
      if (grid.contains(b.column, row) && !grid.isSolid(b.column, row)) {
        grid.set(b.column, row, Block.Rubble);
        cells.push({ column: b.column, row });
      }
    }
    this.blocks.length = 0;
    return cells;
  }

  /** Para el guardado: `undefined` si nada cae (la partida no cambia). */
  snapshot(): FallingSnapshot | undefined {
    return this.blocks.length
      ? this.blocks.map((b) => [b.column, Math.round(b.y), b.block])
      : undefined;
  }

  /**
   * Recupera lo que caía al guardar. Solo se admite dentro del mundo; un dato
   * inválido se ignora (nunca crea bloques fuera de la cuadrícula).
   */
  restore(data: unknown, grid: TerrainGrid): void {
    this.blocks.length = 0;
    if (!Array.isArray(data)) return;
    for (const entry of data.slice(0, FALL.maxActive)) {
      if (!Array.isArray(entry)) continue;
      const [column, y, block] = entry as unknown[];
      if (
        !Number.isInteger(column) ||
        !Number.isFinite(y) ||
        !Number.isInteger(block) ||
        (column as number) < grid.first ||
        (column as number) >= grid.end ||
        (y as number) < 0 ||
        (y as number) >= grid.rows * T
      )
        continue;
      const item = this.add(
        { column: column as number, row: 0 },
        block as Block,
      );
      item.y = y as number;
    }
  }
}
