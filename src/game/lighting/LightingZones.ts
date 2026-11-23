import { TILE_SIZE } from '../config/constants';
import { LIGHTING } from '../config/lighting';
import { surfaceRow } from '../world/TerrainGrid';
import type { SolidQuery } from './LightOcclusion';

/** Zonas de iluminación según dónde está la cabeza del minero. */
export const LightZone = {
  /** A: superficie con luz natural. */
  Surface: 'surface',
  /** B: bocamina; la luz del día entra solo en parte. */
  Entrance: 'entrance',
  /** C: galería subterránea, casi oscura. */
  Gallery: 'gallery',
  /** D: excavación profunda, oscuridad total fuera del haz. */
  Deep: 'deep',
} as const;
export type LightZone = (typeof LightZone)[keyof typeof LightZone];

export interface SkyGrid extends SolidQuery {
  readonly columns: number;
  readonly rows: number;
}

const PER_TILE = TILE_SIZE / LIGHTING.cell;

/**
 * Alcance de un cambio del terreno, en celdas de 4 px. La luz pierde al menos
 * `airStep` por celda, así que un bloque que cambia no puede alterar la luz
 * más allá de max ÷ paso mínimo celdas; las caras de roca (`faceStep`) llevan
 * ese cambio unas celdas más adentro.
 */
const LIGHT_REACH = Math.ceil(
  LIGHTING.sky.max /
    Math.min(
      LIGHTING.sky.airStep,
      LIGHTING.sky.solidStep,
      LIGHTING.sky.softStep,
    ),
);

/** Ventana de celdas (bordes incluidos). */
interface Window {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Luz natural por celda de 4 px. Fuentes: el aire por encima de la superficie
 * natural de cada columna (cielo abierto). La luz avanza por aire excavado
 * perdiendo `airStep` por celda, entra en la roca perdiendo `solidStep` y
 * nunca vuelve a salir de un sólido hacia aire: no atraviesa el cerro.
 * Las caras de roca que dan a una galería oscura se oscurecen con ella
 * (`faceStep`), para que una losa delgada no deje ver luz exterior.
 *
 * `compute` calcula el mapa entero (al crear la escena). Al excavar,
 * construir o derrumbarse algo se usa `update`, que recalcula solo la zona
 * que ese cambio puede alcanzar y da exactamente el mismo resultado.
 */
export class SkyLightMap {
  readonly width: number;
  readonly height: number;
  /** Nivel entero 0..LIGHTING.sky.max por celda. */
  readonly level: Uint8Array;
  /**
   * Nivel para dibujar: la luz del día entra unos tres bloques en la tierra
   * en vez de uno, para que la superficie no corte a negro. No descubre
   * bloques ni cambia zonas (eso usa level).
   */
  readonly soft: Uint8Array;
  /**
   * Propagación sin el oscurecimiento de las caras (`level` y `soft` son
   * estos valores recortados por `face`). Se conservan para que `update`
   * pueda continuar la luz desde el borde de su ventana.
   */
  private readonly rawLevel: Uint8Array;
  private readonly rawSoft: Uint8Array;
  private readonly solid: Uint8Array;
  private readonly face: Uint8Array;
  private readonly buckets: number[][];
  /** Primera celda de 4 px bajo cielo abierto de cada columna de celdas. */
  private readonly skyTop: Int32Array;
  /**
   * Celda de 4 px del mundo donde empieza el mapa (`first` × celdas por
   * bloque). Los arreglos usan x local = x del mundo − x0.
   */
  readonly x0: number;

  constructor(
    columns: number,
    rows: number,
    private readonly surface: (column: number) => number = surfaceRow,
    /** Columna del mundo de la primera columna (como TerrainGrid.first). */
    private readonly first = 0,
  ) {
    this.x0 = first * PER_TILE;
    this.width = columns * PER_TILE;
    this.height = rows * PER_TILE;
    const size = this.width * this.height;
    this.level = new Uint8Array(size);
    this.soft = new Uint8Array(size);
    this.rawLevel = new Uint8Array(size);
    this.rawSoft = new Uint8Array(size);
    this.solid = new Uint8Array(size);
    this.face = new Uint8Array(size);
    this.buckets = Array.from({ length: LIGHTING.sky.max + 1 }, () => []);
    // La superficie natural no cambia al excavar: se consulta una sola vez.
    this.skyTop = new Int32Array(this.width);
    for (let x = 0; x < this.width; x++)
      this.skyTop[x] =
        this.surface(Math.floor(x / PER_TILE) + first) * PER_TILE;
  }

  /** Mapa completo desde cero. */
  compute(grid: SkyGrid): void {
    const all = { x0: 0, y0: 0, x1: this.width - 1, y1: this.height - 1 };
    this.readSolid(grid, all);
    this.recompute(all, all);
  }

  /**
   * Recalcula solo lo que pueden alcanzar los bloques `cells` (los que
   * cambiaron entre sólido y aire desde el último cálculo). El resultado es
   * idéntico al de `compute`: fuera de la ventana nada puede haber cambiado,
   * y lo que entra a ella lo aportan las celdas de su borde, que conservan su
   * valor. Si la zona abarca buena parte del mapa se calcula todo.
   */
  update(
    grid: SkyGrid,
    cells: readonly { column: number; row: number }[],
  ): void {
    const columns = this.width / PER_TILE,
      rows = this.height / PER_TILE;
    let c0 = Infinity,
      c1 = -Infinity,
      r0 = Infinity,
      r1 = -Infinity;
    for (const cell of cells) {
      const column = cell.column - this.first,
        row = cell.row;
      if (column < 0 || row < 0 || column >= columns || row >= rows) continue;
      c0 = Math.min(c0, column);
      c1 = Math.max(c1, column);
      r0 = Math.min(r0, row);
      r1 = Math.max(r1, row);
    }
    if (c0 > c1) return;
    const around = (margin: number): Window => ({
      x0: Math.max(0, c0 * PER_TILE - margin),
      y0: Math.max(0, r0 * PER_TILE - margin),
      x1: Math.min(this.width - 1, (c1 + 1) * PER_TILE - 1 + margin),
      y1: Math.min(this.height - 1, (r1 + 1) * PER_TILE - 1 + margin),
    });
    // La luz propagada cambia hasta LIGHT_REACH celdas del cambio; las caras,
    // FACE_REACH más. Una celda de holgura en cada ventana.
    const light = around(LIGHT_REACH + 1);
    const faces = around(LIGHT_REACH + 2);
    const area = (faces.x1 - faces.x0 + 1) * (faces.y1 - faces.y0 + 1);
    if (area * 2 > this.width * this.height) return this.compute(grid);
    this.readSolid(grid, faces);
    this.recompute(light, faces);
  }

  /** Sólidos de los bloques que tocan la ventana: una consulta por bloque. */
  private readSolid(grid: SkyGrid, win: Window): void {
    const w = this.width,
      solid = this.solid;
    const c0 = Math.floor(win.x0 / PER_TILE),
      c1 = Math.floor(win.x1 / PER_TILE),
      r0 = Math.floor(win.y0 / PER_TILE),
      r1 = Math.floor(win.y1 / PER_TILE);
    for (let row = r0; row <= r1; row++) {
      // Se rellena la primera fila de celdas del bloque y se copia al resto.
      const first = row * PER_TILE * w;
      for (let column = c0; column <= c1; column++)
        solid.fill(
          grid.isSolid(column + this.first, row) ? 1 : 0,
          first + column * PER_TILE,
          first + (column + 1) * PER_TILE,
        );
      const from = first + c0 * PER_TILE,
        to = first + (c1 + 1) * PER_TILE;
      for (let k = 1; k < PER_TILE; k++)
        solid.copyWithin(from + k * w, from, to);
    }
  }

  /** Propagación en `light` y caras y valores finales en `faces` (⊇ light). */
  private recompute(light: Window, faces: Window): void {
    const { solidStep, softStep } = LIGHTING.sky;
    // Mapa estricto: descubrimiento, zonas y caras; mapa suave: solo dibujo.
    this.spread(this.rawLevel, solidStep, light);
    this.spread(this.rawSoft, softStep, light);
    this.darkenFaces(faces);
    const w = this.width,
      { solid, face, level, soft, rawLevel, rawSoft } = this;
    for (let y = faces.y0; y <= faces.y1; y++)
      for (let x = faces.x0; x <= faces.x1; x++) {
        const i = y * w + x;
        if (solid[i]) {
          const f = face[i]!;
          level[i] = f < rawLevel[i]! ? f : rawLevel[i]!;
          soft[i] = f < rawSoft[i]! ? f : rawSoft[i]!;
        } else {
          level[i] = rawLevel[i]!;
          soft[i] = rawSoft[i]!;
        }
      }
  }

  /**
   * Recorre el anillo de celdas que rodea la ventana por fuera (dentro del
   * mapa): son el borde desde el que la luz ya calculada entra a ella.
   */
  private ring(win: Window, visit: (i: number) => void): void {
    const w = this.width,
      h = this.height;
    const x0 = Math.max(0, win.x0 - 1),
      x1 = Math.min(w - 1, win.x1 + 1);
    if (win.y0 > 0) for (let x = x0; x <= x1; x++) visit((win.y0 - 1) * w + x);
    if (win.y1 < h - 1)
      for (let x = x0; x <= x1; x++) visit((win.y1 + 1) * w + x);
    for (let y = win.y0; y <= win.y1; y++) {
      if (win.x0 > 0) visit(y * w + win.x0 - 1);
      if (win.x1 < w - 1) visit(y * w + win.x1 + 1);
    }
  }

  /**
   * Caras que miran a galerías: mínimo desde el aire subterráneo hacia la
   * roca. Solo escribe dentro de la ventana.
   */
  private darkenFaces(win: Window): void {
    const { max, faceStep } = LIGHTING.sky;
    const w = this.width,
      { solid, face, buckets } = this,
      level = this.rawLevel;
    for (const b of buckets) b.length = 0;
    for (let y = win.y0; y <= win.y1; y++)
      for (let x = win.x0; x <= win.x1; x++) {
        const i = y * w + x;
        if (!solid[i] && level[i]! < max) {
          face[i] = level[i]!;
          buckets[level[i]!]!.push(i);
        } else face[i] = 255;
      }
    this.ring(win, (i) => {
      if (face[i]! < max) buckets[face[i]!]!.push(i);
    });
    for (let l = 0; l < max; l++) {
      const bucket = buckets[l]!;
      while (bucket.length) {
        const i = bucket.pop()!;
        if (face[i] !== l) continue;
        const next = l + faceStep;
        if (next >= max) continue;
        const x = i % w,
          y = (i - x) / w;
        // Vecinos en el orden de siempre: izquierda, derecha, arriba, abajo.
        for (let k = 0; k < 4; k++) {
          const nx = k === 0 ? x - 1 : k === 1 ? x + 1 : x,
            ny = k === 2 ? y - 1 : k === 3 ? y + 1 : y;
          if (nx < win.x0 || nx > win.x1 || ny < win.y0 || ny > win.y1)
            continue;
          const n = ny * w + nx;
          if (!solid[n]) continue;
          if (next < face[n]!) {
            face[n] = next;
            buckets[next]!.push(n);
          }
        }
      }
    }
  }

  /**
   * Propaga la luz del cielo: plena sobre la superficie natural, pierde
   * `airStep` por celda de aire y `step` por celda sólida, y nunca sale de un
   * sólido hacia aire (no atraviesa el cerro ni entra en cámaras selladas).
   * Solo escribe dentro de la ventana; la luz que viene de fuera entra por
   * las celdas de su borde, con el valor que ya tenían.
   */
  private spread(level: Uint8Array, step: number, win: Window): void {
    const { max, airStep } = LIGHTING.sky;
    const w = this.width,
      { solid, buckets, skyTop } = this;
    for (const b of buckets) b.length = 0;
    // Cielo abierto: aire sobre la superficie natural de su columna (la celda
    // y está sobre ella si y < fila de superficie × celdas por bloque).
    for (let y = win.y0; y <= win.y1; y++)
      for (let x = win.x0; x <= win.x1; x++) {
        const i = y * w + x;
        if (!solid[i] && y < skyTop[x]!) {
          level[i] = max;
          buckets[max]!.push(i);
        } else level[i] = 0;
      }
    this.ring(win, (i) => {
      if (level[i]! > 0) buckets[level[i]!]!.push(i);
    });
    // Propagación por niveles decrecientes (cola de cubetas, sin asignaciones).
    for (let l = max; l > 0; l--) {
      const bucket = buckets[l]!;
      while (bucket.length) {
        const i = bucket.pop()!;
        if (level[i] !== l) continue;
        const x = i % w,
          y = (i - x) / w;
        const from = solid[i];
        for (let k = 0; k < 4; k++) {
          const nx = k === 0 ? x - 1 : k === 1 ? x + 1 : x,
            ny = k === 2 ? y - 1 : k === 3 ? y + 1 : y;
          if (nx < win.x0 || nx > win.x1 || ny < win.y0 || ny > win.y1)
            continue;
          const n = ny * w + nx;
          if (from && !solid[n]) continue;
          const next = l - (solid[n] ? step : airStep);
          if (next > level[n]!) {
            level[n] = next;
            buckets[next]!.push(n);
          }
        }
      }
    }
  }

  /**
   * Nivel entero de una celda de 4 px. A la izquierda del mundo (campamento
   * V8 y monolitos V9) el suelo es intacto: cielo pleno sobre la superficie
   * natural de cada columna y la misma caída por celda sólida que calcula la
   * propagación. Fuera por los otros lados, oscuridad.
   */
  levelAt(cx: number, cy: number, soft = false): number {
    const lx = cx - this.x0;
    if (cy < 0 || cy >= this.height || lx >= this.width) return 0;
    if (lx >= 0) return (soft ? this.soft : this.level)[cy * this.width + lx]!;
    // Cada columna del oeste usa su propia superficie (los monolitos tienen
    // lomas suaves; la superficie la da surfaceRow con columnas negativas).
    const top = this.surface(Math.floor(cx / PER_TILE)) * PER_TILE;
    const { max, solidStep, softStep } = LIGHTING.sky;
    const step = soft ? softStep : solidStep;
    return cy < top ? max : Math.max(0, max - (cy - top + 1) * step);
  }

  /** Luz natural 0..1 en un punto del mundo; fuera del mundo, oscuridad. */
  at(x: number, y: number): number {
    return (
      this.levelAt(
        Math.floor(x / LIGHTING.cell),
        Math.floor(y / LIGHTING.cell),
      ) / LIGHTING.sky.max
    );
  }
}

/**
 * Luz ambiental mínima de una celda: solo bajo la superficie natural, y
 * decreciente con la profundidad hasta el valor de la zona profunda.
 */
export function ambientAt(
  column: number,
  row: number,
  surface: (column: number) => number = surfaceRow,
): number {
  const top = surface(column);
  if (row < top) return 0;
  const { shallow, deep, deepRow } = LIGHTING.ambient;
  if (row >= deepRow) return deep;
  const t = (row - top) / Math.max(1, deepRow - top);
  return shallow + (deep - shallow) * Math.min(1, t);
}

/** Zona de la cabeza del minero según la luz natural que recibe y su fila. */
export function classifyZone(sky: number, row: number): LightZone {
  if (sky >= LIGHTING.zones.surface) return LightZone.Surface;
  if (sky >= LIGHTING.zones.entrance) return LightZone.Entrance;
  return row >= LIGHTING.ambient.deepRow ? LightZone.Deep : LightZone.Gallery;
}
