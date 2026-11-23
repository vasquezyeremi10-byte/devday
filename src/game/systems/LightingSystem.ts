import Phaser from 'phaser';
import { TILE_SIZE, WORLD_LEFT, WORLD_WIDTH } from '../config/constants';
import { DEPTH } from '../config/layers';
import { HEADLAMP_RANGE, LIGHTING } from '../config/lighting';
import { PALETTE as P } from '../config/palette';
import type { Miner } from '../entities/Miner';
import { NIGHT_LIGHT } from './DayNightCycle';
import {
  HeadlampLight,
  radialFalloff,
  squareFalloff,
  type Point,
} from '../lighting/HeadlampLight';
import { ExposureMap, type SurfaceShape } from '../lighting/ExposureMap';
import { transmittance, type SolidQuery } from '../lighting/LightOcclusion';
import {
  ambientAt,
  classifyZone,
  LightZone,
  SkyLightMap,
} from '../lighting/LightingZones';
import { UndergroundDarkness } from '../lighting/UndergroundDarkness';
import { CrystalIndex } from '../world/CrystalIndex';
import type { LightSource } from '../world/Scenery';
import {
  Block,
  mineralOf,
  surfaceRow,
  type Cell,
  type TerrainGrid,
} from '../world/TerrainGrid';
import { LAMPS, type PlacedLights } from './PlacedLights';
import type { VisibilitySystem } from './VisibilitySystem';

/** Celda del dibujo de la luz (2 px). */
const C = LIGHTING.renderCell;
/** Celda del mapa de luz natural y de la oclusión compartida (4 px). */
const Q = LIGHTING.cell;
const PENETRATION = LIGHTING.headlamp.penetration;
/** Diferencia de oclusión entre bloques vecinos que se trata como borde. */
const EDGE = 0.2;
/** Píxel de la lámpara en el cuadro de 16 × 24 mirando a la derecha. */
/** Luz mínima para descubrir un bloque (verlo una vez lo vuelve conocido). */
const REVEAL = 0.3;

/** Contribución precalculada de una luz fija, en celdas de 2 px del mundo. */
interface LightCache {
  x0: number;
  y0: number;
  w: number;
  h: number;
  data: Float32Array;
  warm: boolean;
  /** Luz de un cristal violeta: tiñe de violeta en vez de ámbar. */
  violet: boolean;
}

/**
 * Caída radial del casco por medio píxel de distancia (radialFalloff
 * precalculada): la composición de 2 px la pide para miles de celdas.
 */
const HEADLAMP_FALLOFF = Float32Array.from(
  { length: Math.ceil(HEADLAMP_RANGE * 2) + 2 },
  (_, k) =>
    radialFalloff(
      k / 2,
      0,
      LIGHTING.headlamp.radial.coreTiles,
      LIGHTING.headlamp.radial.radiusTiles,
      LIGHTING.headlamp.radial.curve,
    ),
);

/** Ids de caché de los cristales: lejos de los de antorchas y luces. */
const CRYSTAL_ID = 10_000_000;

/**
 * Coordinador de iluminación. Luz final de cada celda de 2 px visible:
 * max(luz natural, ambiente) combinada con lámpara del casco, luces
 * instaladas y faroles, cada fuente recortada por LightOcclusion contra los
 * tiles sólidos reales. Lo que deja atrás vuelve a oscurecerse (no es niebla
 * de guerra); lo que se iluminó queda descubierto (VisibilitySystem).
 */
export class LightingSystem {
  readonly sky: SkyLightMap;
  readonly lamp = new HeadlampLight();
  /** Cristales violeta del terreno (se reindexan al cambiar el terreno). */
  readonly crystals: CrystalIndex;
  readonly darkness: UndergroundDarkness;
  zone: LightZone = LightZone.Surface;
  /** La lámpara va en el casco: sin casco equipado no ilumina. */
  helmet = true;
  /**
   * V9: habilitación por batería e interruptor manual (la fija la escena).
   * Con la batería agotada o la linterna apagada a mano, el haz no arranca.
   */
  lampPowered = true;
  /**
   * Luz exterior del reloj V7 (NIGHT_LIGHT..1). No oscurece el exterior con
   * trama (eso lo hace NightTint con un tinte parejo): enciende el casco de
   * noche y agranda los halos de faroles y ventanas.
   */
  daylight = 1;
  /** Píxel de la lámpara por cuadro de la hoja del minero. */
  private readonly sparkles: number[] = [];
  /** Luz natural de cada celda de la ventana en el último cuadro. */
  private natural = new Float32Array(0);
  /** Píxeles del mundo con una estructura delante (desde WORLD_LEFT). */
  private readonly foreground: Uint8Array;
  /** Personajes y máquinas visibles en este cuadro (siluetas). */
  private actors: SurfaceShape[] = [];
  private readonly caches = new Map<number, LightCache>();
  private cacheVersion = -1;
  /** Exposición real de las estructuras delante de la roca (ExposureMap). */
  readonly exposure: ExposureMap;
  /** Interruptor de diagnóstico (capturas de antes/después). */
  surfaceExposure = true;
  /** Objetos de la escena en la última reconstrucción (−1: reconstruir). */
  private exposureCount = -1;
  private readonly alphaCache = new WeakMap<object, Uint8Array>();

  /**
   * Suelo para la oclusión y el primer plano. Desde el mundo abierto la
   * cuadrícula principal cubre todo el mundo (del borde oeste al este), así
   * que por defecto es ella misma; las pruebas pueden pasar otra.
   */
  private readonly solid: SolidQuery;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: TerrainGrid,
    private readonly lights: readonly LightSource[],
    private readonly placed?: PlacedLights,
    private readonly visibility?: VisibilitySystem,
    solid?: SolidQuery,
  ) {
    this.solid = solid ?? grid;
    this.sky = new SkyLightMap(grid.columns, grid.rows, surfaceRow, grid.first);
    this.sky.compute(grid);
    this.crystals = new CrystalIndex(grid);
    this.darkness = new UndergroundDarkness(scene);
    this.natural = new Float32Array(this.darkness.light.length);
    this.foreground = new Uint8Array(WORLD_WIDTH * grid.rows * TILE_SIZE);
    // La exposición cubre de la columna 0 al borde este (estructuras de la
    // mina y del este); el campamento queda con la luz de su entorno.
    this.exposure = new ExposureMap(
      (grid.end > 0 ? grid.end : grid.columns) * TILE_SIZE,
      grid.rows * TILE_SIZE,
    );
  }

  /** Alfa (0/1) de toda la imagen fuente de una textura, leída una vez. */
  private alphaOf(source: HTMLImageElement | HTMLCanvasElement): Uint8Array {
    const hit = this.alphaCache.get(source);
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const alpha = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3] ? 1 : 0;
    this.alphaCache.set(source, alpha);
    return alpha;
  }

  /**
   * Formas de todas las estructuras del mundo (capa de estructuras, también
   * dentro de contenedores), con su silueta real. Incluye automáticamente
   * lo que se construya o coloque en el futuro.
   */
  private surfaceShapes(
    min: number = DEPTH.terrain + 5,
    max: number = DEPTH.characters,
  ): SurfaceShape[] {
    const shapes: SurfaceShape[] = [];
    const add = (o: Phaser.GameObjects.GameObject, ox: number, oy: number) => {
      if (
        !(
          o instanceof Phaser.GameObjects.Image ||
          o instanceof Phaser.GameObjects.Sprite
        ) ||
        !o.visible ||
        o.scrollFactorX !== 1
      )
        return;
      const frame = o.frame,
        source = frame.source.image as HTMLImageElement | HTMLCanvasElement;
      if (!source?.width) return;
      // Las texturas de piezas se dibujan una vez: su alfa se lee una vez.
      const alpha = this.alphaOf(source),
        sw = source.width,
        w = frame.cutWidth,
        h = frame.cutHeight,
        flip = o.flipX;
      shapes.push({
        x: Math.round(ox + o.x - o.originX * w),
        y: Math.round(oy + o.y - o.originY * h),
        w,
        h,
        opaque: (i, j) =>
          alpha[(frame.cutY + j) * sw + frame.cutX + (flip ? w - 1 - i : i)] ===
          1,
      });
    };
    for (const o of this.scene.children.list) {
      const depth = (o as unknown as { depth: number }).depth;
      if (depth < min || depth >= max) continue;
      if (o instanceof Phaser.GameObjects.Container) {
        if (o.visible) for (const child of o.list) add(child, o.x, o.y);
      } else add(o, 0, 0);
    }
    return shapes;
  }

  /**
   * Firma barata de la capa de estructuras: cuántos objetos visibles hay en
   * ella. Partículas, personajes y HUD no la cambian.
   */
  private structureCount(): number {
    let n = 0;
    for (const o of this.scene.children.list) {
      const depth = (o as unknown as { depth: number }).depth;
      if (depth < DEPTH.terrain + 5 || depth >= DEPTH.characters) continue;
      if (!(o as unknown as { visible: boolean }).visible) continue;
      n += o instanceof Phaser.GameObjects.Container ? o.list.length + 1 : 1;
    }
    return n;
  }

  /** Reconstruye la exposición (al excavar o al cambiar los objetos). */
  private rebuildExposure(): void {
    this.exposureCount = this.structureCount();
    const shapes = this.surfaceShapes();
    this.exposure.rebuild(shapes, (x, y) =>
      this.solid.isSolid(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE)),
    );
    // Máscara de primer plano: siluetas reales de las estructuras (incluido
    // el campamento en x negativas).
    const fg = this.foreground,
      w = WORLD_WIDTH,
      h = this.grid.rows * TILE_SIZE;
    fg.fill(0);
    for (const s of shapes)
      for (let j = 0; j < s.h; j++) {
        const y = s.y + j;
        if (y < 0 || y >= h) continue;
        for (let i = 0; i < s.w; i++) {
          const x = s.x + i - WORLD_LEFT;
          if (x >= 0 && x < w && s.opaque(i, j)) fg[y * w + x] = 1;
        }
      }
  }

  /**
   * ¿Hay algo delante del fondo en este píxel? Terreno sólido, una
   * estructura o un personaje/máquina. La luz ámbar de los faroles al aire
   * libre solo cae sobre eso (no tiñe el cielo ni los cerros lejanos).
   */
  private isForeground(x: number, y: number): boolean {
    if (this.solid.isSolid(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE)))
      return true;
    const fx = x - WORLD_LEFT;
    if (fx >= 0 && fx < WORLD_WIDTH && y >= 0 && this.foreground[y * WORLD_WIDTH + fx])
      return true;
    for (const a of this.actors)
      if (
        x >= a.x &&
        y >= a.y &&
        x < a.x + a.w &&
        y < a.y + a.h &&
        a.opaque(x - a.x, y - a.y)
      )
        return true;
    return false;
  }

  /**
   * Recalcula la luz tras excavar: la luz entra en el nuevo hueco. Con
   * `cells` (los bloques que cambiaron) solo se rehace la zona que pueden
   * alcanzar, con el mismo resultado; sin ella se recalcula todo el mapa.
   */
  terrainChanged(cells?: readonly Cell[]): void {
    if (cells) {
      this.sky.update(this.grid, cells);
      this.dropCaches(cells);
    } else {
      this.sky.compute(this.grid);
      this.caches.clear();
    }
    this.crystals.refresh();
    // Lo que antes era roca detrás de una estructura puede ser aire ahora.
    this.exposureCount = -1;
  }

  /**
   * Descarta las luces fijas precalculadas que un bloque cambiado puede
   * afectar: aquellas cuyo recuadro (con un bloque de margen, por los rayos
   * que pasan justo por una esquina) toca alguno de esos bloques. Los rayos
   * de una luz no salen de su recuadro, así que las demás siguen valiendo.
   */
  private dropCaches(cells: readonly Cell[]): void {
    const per = TILE_SIZE / C;
    for (const [id, cache] of this.caches) {
      const c0 = Math.floor(cache.x0 / per) - 1,
        c1 = Math.floor((cache.x0 + cache.w - 1) / per) + 1,
        r0 = Math.floor(cache.y0 / per) - 1,
        r1 = Math.floor((cache.y0 + cache.h - 1) / per) + 1;
      if (
        cells.some(
          (cell) =>
            cell.column >= c0 &&
            cell.column <= c1 &&
            cell.row >= r0 &&
            cell.row <= r1,
        )
      )
        this.caches.delete(id);
    }
  }

  /**
   * Posición de la lámpara en el mundo: el foco dibujado al frente del casco
   * (V13, cuadro de 32 × 32: píxeles x 20, y 8–9 mirando a la derecha).
   */
  lampOrigin(miner: Miner): Point {
    return {
      x: Math.round(miner.x) + (miner.flipX ? -4.5 : 4.5),
      y: Math.round(miner.y) - 11,
    };
  }
  /** Luz compuesta 0..1 del último fotograma en un punto visible del mundo. */
  lightAt(x: number, y: number): number {
    const d = this.darkness,
      cx = Math.floor((x - d.x) / C),
      cy = Math.floor((y - d.y) / C);
    if (cx < 0 || cy < 0 || cx >= d.columns || cy >= d.rows) return 0;
    return d.light[cy * d.columns + cx]!;
  }

  update(miner: Miner, dtMs: number, now: number): void {
    const origin = this.lampOrigin(miner);
    const row = Math.floor(origin.y / TILE_SIZE);
    this.zone = classifyZone(this.sky.at(origin.x, origin.y), row);
    // La lámpara del casco se enciende sola al dejar la luz del día;
    // sin casco equipado no hay lámpara y sin batería (o apagada a mano)
    // el haz no arranca.
    this.lamp.update(
      dtMs,
      (this.zone !== LightZone.Surface || this.daylight < 0.5) &&
        this.helmet &&
        this.lampPowered,
      origin,
      { x: Math.round(miner.x), y: Math.round(miner.y) - 3 },
      miner.flipX ? -1 : 1,
    );
    const d = this.darkness;
    d.begin(this.scene.cameras.main);
    this.ambientPass();
    this.sparkles.length = 0;
    this.placedPass();
    this.crystalPass();
    if (this.lamp.power > 0) this.lampPass(origin);
    this.decorPass(now);
    this.glowPass();
    this.discover();
    // Estructuras al aire libre delante de la roca: toman la luz del aire que
    // las rodea (sol, faroles, casco), no la de la roca de detrás.
    if (this.surfaceExposure) {
      if (
        this.exposureCount < 0 ||
        this.structureCount() !== this.exposureCount
      )
        this.rebuildExposure();
      this.exposure.update((x, y) => this.lightAt(x, y));
    }
    d.compose(this.surfaceExposure ? this.exposure : null, (x, y) =>
      this.isForeground(x, y),
    );
    this.decorate(origin, now);
    d.present();
  }

  /**
   * Luz natural y ambiente mínimo, este último solo en terreno descubierto.
   * Ambos tienen la resolución del mapa natural (bloques de Q = 4 px): se
   * calculan una vez por bloque y se copian a sus celdas de 2 px.
   */
  private ambientPass(): void {
    const d = this.darkness,
      sky = this.sky,
      v = this.visibility;
    const step = Q / C;
    for (let by = 0; by < d.rows; by += step) {
      const wy = d.y + by * C,
        row = Math.floor(wy / TILE_SIZE),
        sy = Math.floor(wy / Q);
      for (let bx = 0; bx < d.columns; bx += step) {
        const wx = d.x + bx * C,
          sx = Math.floor(wx / Q),
          lx = sx - sky.x0;
        const inside = lx >= 0 && sy >= 0 && lx < sky.width && sy < sky.height;
        const natural =
          (inside
            ? sky.level[sy * sky.width + lx]!
            : sky.levelAt(sx, sy)) / LIGHTING.sky.max;
        // Dibujo: luz del día que baja unos bloques en la tierra (mapa suave).
        const shown =
          (inside
            ? sky.soft[sy * sky.width + lx]!
            : sky.levelAt(sx, sy, true)) / LIGHTING.sky.max;
        const column = Math.floor(wx / TILE_SIZE);
        const known = !v || v.has(column, row);
        // Lo descubierto bajo tierra conserva el ambiente azul (nivel 1).
        const floor = known && row >= surfaceRow(column) ? 1 : 0;
        const light = Math.max(shown, known ? ambientAt(column, row) : 0);
        for (let cy = by; cy < Math.min(d.rows, by + step); cy++)
          for (let cx = bx; cx < Math.min(d.columns, bx + step); cx++) {
            const i = cy * d.columns + cx;
            this.natural[i] = natural;
            d.known[i] = floor;
            d.light[i] = light;
          }
      }
    }
  }

  /**
   * Marca como descubiertos los bloques que reciben luz suficiente. Usa la
   * luz natural estricta (solo la cara expuesta) más las luces locales: la
   * penumbra que se dibuja bajo la superficie no revela lo que hay debajo.
   */
  private discover(): void {
    const v = this.visibility;
    if (!v) return;
    const d = this.darkness;
    for (let cy = 0; cy < d.rows; cy++)
      for (let cx = 0; cx < d.columns; cx++) {
        const i = cy * d.columns + cx;
        const strict = 1 - (1 - this.natural[i]!) * (1 - d.local[i]!);
        if (strict >= REVEAL)
          v.reveal(
            Math.floor((d.x + cx * C) / TILE_SIZE),
            Math.floor((d.y + cy * C) / TILE_SIZE),
          );
      }
  }

  /** Celda de mena iluminada por el haz: candidata a destello. */
  private noteMineral(i: number, wx: number, wy: number): void {
    // Un candidato por bloque de 4 px, como con las celdas de 4 px: la celda
    // de 2 px no multiplica los destellos.
    if (((Math.floor(wx) % Q) + Q) % Q >= C || ((Math.floor(wy) % Q) + Q) % Q >= C) return;
    if (
      mineralOf(
        this.grid.get(Math.floor(wx / TILE_SIZE), Math.floor(wy / TILE_SIZE)),
      )
    )
      this.sparkles.push(i);
  }

  /** Búfer reutilizado de la oclusión por bloques de 4 px (−1: sin calcular). */
  private occlusionBuffer = new Float32Array(0);

  /**
   * Oclusión compartida por bloques de Q (4 px) dentro del recuadro
   * [left, right] × [top, bottom] del mundo: cada bloque traza un solo rayo
   * desde (ox, oy) hasta su centro, y las cuatro celdas de 2 px que contiene
   * usan ese valor. Solo en los bordes (bloques vecinos con oclusión
   * distinta: la sombra que proyecta un escalón, la cara de un bloque) cada
   * celda de 2 px traza su propio rayo, así la sombra se ciñe al relieve sin
   * cuadruplicar el costo.
   */
  private occlusion(
    ox: number,
    oy: number,
    left: number,
    top: number,
    right: number,
    bottom: number,
  ): (wx: number, wy: number) => number {
    const qx0 = Math.floor(left / Q),
      qy0 = Math.floor(top / Q);
    const qw = Math.floor(right / Q) - qx0 + 1,
      qh = Math.floor(bottom / Q) - qy0 + 1;
    if (this.occlusionBuffer.length < qw * qh)
      this.occlusionBuffer = new Float32Array(qw * qh);
    const buffer = this.occlusionBuffer;
    buffer.fill(-1, 0, qw * qh);
    const block = (qx: number, qy: number): number => {
      const i = qx - qx0,
        j = qy - qy0;
      if (i < 0 || j < 0 || i >= qw || j >= qh) return -1;
      const k = j * qw + i;
      let t = buffer[k]!;
      if (t < 0) {
        t = transmittance(this.solid, ox, oy, qx * Q + Q / 2, qy * Q + Q / 2, PENETRATION);
        buffer[k] = t;
      }
      return t;
    };
    return (wx, wy) => {
      const qx = Math.floor(wx / Q),
        qy = Math.floor(wy / Q);
      const t = block(qx, qy);
      // Borde de una sombra (un escalón que tapa la luz, la cara de un
      // bloque): si el bloque vecino del lado de esta celda difiere, la celda
      // traza su propio rayo y el borde queda a 2 px, ceñido al relieve.
      const sx = wx - qx * Q < Q / 2 ? -1 : 1,
        sy = wy - qy * Q < Q / 2 ? -1 : 1;
      const nx = block(qx + sx, qy),
        ny = block(qx, qy + sy);
      if ((nx >= 0 && Math.abs(nx - t) > EDGE) || (ny >= 0 && Math.abs(ny - t) > EDGE))
        return transmittance(this.solid, ox, oy, wx, wy, PENETRATION);
      return t;
    };
  }

  /** Resplandor radial del casco (V12), ocluido por los tiles sólidos. */
  private lampPass(origin: Point): void {
    const d = this.darkness,
      lamp = this.lamp,
      reach = HEADLAMP_RANGE + C,
      c = { x: lamp.x, y: lamp.y };
    const x0 = Math.max(0, Math.floor((c.x - reach - d.x) / C)),
      x1 = Math.min(d.columns - 1, Math.floor((c.x + reach - d.x) / C)),
      y0 = Math.max(0, Math.floor((c.y - reach - d.y) / C)),
      y1 = Math.min(d.rows - 1, Math.floor((c.y + reach - d.y) / C));
    const shade = this.occlusion(
      origin.x,
      origin.y,
      d.x + x0 * C,
      d.y + y0 * C,
      d.x + x1 * C + C - 1,
      d.y + y1 * C + C - 1,
    );
    const gain = lamp.power * LIGHTING.headlamp.intensity;
    const r2 = HEADLAMP_RANGE * HEADLAMP_RANGE;
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const wx = d.x + cx * C + C / 2,
          wy = d.y + cy * C + C / 2;
        // Caída radial desde la tabla (igual a lamp.light, sin Math.pow).
        const dx = wx - c.x,
          dy = wy - c.y,
          dd = dx * dx + dy * dy;
        if (dd >= r2) continue;
        const beam = gain * HEADLAMP_FALLOFF[Math.round(Math.sqrt(dd) * 2)]!;
        let raw = beam;
        if (raw < 0.02) continue;
        raw *= shade(wx, wy);
        if (raw < 0.02) continue;
        const i = cy * d.columns + cx,
          base = d.light[i]!;
        d.light[i] = 1 - (1 - base) * (1 - raw);
        d.local[i] = Math.max(d.local[i]!, raw);
        if (raw > base && raw > 0.05) d.warm[i] = 1;
        if (beam > 0.35) this.noteMineral(i, wx, wy);
      }
  }

  /**
   * Cristales violeta descubiertos con aire a su lado: cada uno alumbra su
   * entorno (recortado por la roca) y tiñe de violeta lo que toca. Solo los
   * que caen en la ventana de la cámara; el resto no cuesta nada.
   */
  private crystalPass(): void {
    const spots = this.crystals.spots;
    if (!spots.length) return;
    const d = this.darkness,
      { radius, intensity } = LIGHTING.crystal;
    const left = d.x - radius,
      right = d.x + d.columns * C + radius,
      top = d.y - radius,
      bottom = d.y + d.rows * C + radius;
    for (const s of spots) {
      if (s.lx === null || s.ly === null) continue;
      if (s.lx < left || s.lx > right || s.ly < top || s.ly > bottom) continue;
      // Solo lo ya descubierto brilla: un cristal tras la roca no delata la caverna.
      if (this.visibility && !this.visibility.has(s.column, s.row)) continue;
      this.applyCache(
        this.cacheFor(
          CRYSTAL_ID + this.grid.index(s.column, s.row),
          s.lx,
          s.ly,
          radius,
          intensity,
          false,
          null,
          true,
        ),
      );
    }
  }

  /** Contribución de una luz fija con oclusión (se recalcula al excavar). */
  private cacheFor(
    id: number,
    x: number,
    y: number,
    radius: number,
    intensity: number,
    warm: boolean,
    square: { tiles: number; fade: number } | null = null,
    violet = false,
  ): LightCache {
    const hit = this.caches.get(id);
    if (hit) return hit;
    const x0 = Math.floor((x - radius) / C),
      y0 = Math.floor((y - radius) / C);
    const w = Math.ceil((radius * 2) / C) + 1,
      h = w;
    const data = new Float32Array(w * h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const wx = (x0 + i) * C + C / 2,
          wy = (y0 + j) * C + C / 2,
          dist = Math.hypot(wx - x, wy - y);
        if (!square && dist >= radius) continue;
        // Antorcha: cuadro de bloques que se apaga de a poco; resto: círculo.
        const raw =
          intensity *
          (square
            ? squareFalloff(wx - x, wy - y, square.tiles, square.fade)
            : Math.pow(1 - dist / radius, 0.9));
        if (raw < 0.02) continue;
        data[j * w + i] =
          raw * transmittance(this.solid, x, y, wx, wy, PENETRATION);
      }
    const cache = { x0, y0, w, h, data, warm, violet };
    this.caches.set(id, cache);
    return cache;
  }

  /** Suma una luz fija precalculada a la ventana visible. */
  private applyCache(cache: LightCache): void {
    const d = this.darkness,
      ox = d.x / C,
      oy = d.y / C;
    for (let j = 0; j < cache.h; j++) {
      const cy = cache.y0 + j - oy;
      if (cy < 0 || cy >= d.rows) continue;
      for (let i = 0; i < cache.w; i++) {
        const v = cache.data[j * cache.w + i]!;
        if (!v) continue;
        const cx = cache.x0 + i - ox;
        if (cx < 0 || cx >= d.columns) continue;
        const k = cy * d.columns + cx,
          base = d.light[k]!;
        d.light[k] = 1 - (1 - base) * (1 - v);
        d.local[k] = Math.max(d.local[k]!, v);
        // Luz de fuego o de faro: domina la celda → rampa ámbar (sin puntos).
        // Un cristal la tiñe de violeta, salvo donde ya manda una luz cálida.
        if (v > base && v > 0.05) {
          if (!cache.violet) {
            d.warm[k] = 1;
            d.violet[k] = 0;
          } else if (!d.warm[k]) d.violet[k] = 1;
        }
        if (v > 0.4) this.noteMineral(k, d.x + cx * C + C / 2, d.y + cy * C + C / 2);
      }
    }
  }

  /**
   * Antorchas (instaladas por el jugador o fijas en la galería), faros y
   * luminarias. Todas las antorchas usan la misma luz: 5 × 5 bloques.
   */
  private placedPass(): void {
    const placed = this.placed;
    if (placed && placed.version !== this.cacheVersion) {
      this.caches.clear();
      this.cacheVersion = placed.version;
    }
    const torch = LAMPS.torch;
    const square = { tiles: torch.area, fade: torch.fade };
    // Antorchas fijas del escenario: ids negativos para no chocar.
    this.lights.forEach((light, i) => {
      if (light.kind !== 'torch') return;
      this.applyCache(
        this.cacheFor(
          -1 - i,
          light.x,
          light.y,
          torch.radius,
          torch.intensity,
          true,
          square,
        ),
      );
    });
    for (const light of placed?.items ?? []) {
      const spec = LAMPS[light.kind];
      this.applyCache(
        this.cacheFor(
          light.id,
          light.column * TILE_SIZE + 8,
          light.row * TILE_SIZE + (light.kind === 'torch' ? 8 : 6),
          spec.radius,
          spec.intensity,
          light.kind === 'torch',
          'area' in spec ? { tiles: spec.area, fade: spec.fade } : null,
        ),
      );
    }
  }
  /** 0 de día, 1 en plena noche (según la luz exterior del reloj V7). */
  get night(): number {
    return Math.max(
      0,
      Math.min(1, (1 - this.daylight) / (1 - NIGHT_LIGHT)),
    );
  }

  /**
   * Brillo ámbar aditivo de las luces locales. Al aire libre de día no se
   * nota (el sol domina); de noche crece con la oscuridad. Bajo tierra,
   * siempre. Sin halos de puntos: bandas cuantizadas en la composición.
   */
  private glowPass(): void {
    const d = this.darkness,
      night = this.night,
      outside = LIGHTING.zones.surface;
    let any = false;
    for (let i = 0; i < d.local.length; i++) {
      const local = d.local[i]!;
      if (local <= 0) continue;
      const open = this.natural[i]! >= outside;
      d.outdoor[i] = open ? 1 : 0;
      d.glowAmount[i] = open ? local * night : local;
      if (open && night > 0) any = true;
    }
    // Siluetas de personajes y máquinas solo si hay luz local al aire libre.
    this.actors = any
      ? this.surfaceShapes(DEPTH.characters, DEPTH.foreground)
      : [];
  }

  /**
   * Faroles y ventanas: emisión baja de día; de noche su luz ámbar alcanza
   * muros, suelo, personajes y objetos cercanos, recortada por la roca.
   */
  private decorPass(now: number): void {
    const d = this.darkness;
    const night = this.night;
    const { radius: base, nightRadius } = LIGHTING.decorLamp;
    for (const light of this.lights) {
      if (light.kind !== 'decor') continue;
      if (light.nightOnly && night <= 0) continue;
      const radius = base + (light.radius * nightRadius - base) * night;
      // Titileo: la intensidad salta entre 0,8 y 1,0 en pasos de 260 ms,
      // determinista por posición (cuantizada, sin alfa parcial).
      const step = Math.floor(now / 260) + Math.round(light.x * 7);
      const wobble = light.flicker && step % 3 === 0 ? 0.8 : 1;
      const intensity =
        (light.nightOnly ? 0.95 * night : LIGHTING.decorLamp.intensity + night * 0.45) *
        wobble;
      const x0 = Math.max(0, Math.floor((light.x - radius - d.x) / C)),
        x1 = Math.min(d.columns - 1, Math.floor((light.x + radius - d.x) / C)),
        y0 = Math.max(0, Math.floor((light.y - radius - d.y) / C)),
        y1 = Math.min(d.rows - 1, Math.floor((light.y + radius - d.y) / C));
      if (x0 > x1 || y0 > y1) continue;
      const shade = this.occlusion(
        light.x,
        light.y,
        d.x + x0 * C,
        d.y + y0 * C,
        d.x + x1 * C + C - 1,
        d.y + y1 * C + C - 1,
      );
      for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++) {
          const wx = d.x + cx * C + C / 2,
            wy = d.y + cy * C + C / 2,
            dist = Math.hypot(wx - light.x, wy - light.y);
          if (dist >= radius) continue;
          const raw = intensity * (1 - dist / radius) * shade(wx, wy);
          const i = cy * d.columns + cx;
          if (raw > d.light[i]!) d.warm[i] = 1;
          d.light[i] = Math.max(d.light[i]!, raw);
          d.local[i] = Math.max(d.local[i]!, raw);
        }
    }
  }

  /** Punto luminoso de la lámpara y destellos discretos de mena. */
  private decorate(origin: Point, now: number): void {
    const d = this.darkness;
    if (this.lamp.power > 0.5) {
      d.dot(origin.x, origin.y - 1, LIGHTING.colors.lamp);
      d.dot(origin.x, origin.y, P.cream);
    }
    // Un destello breve por celda iluminada de mena, desfasado por posición.
    // El mineral desconocido late más seguido y con otro color.
    for (const i of this.sparkles) {
      const cx = i % d.columns,
        cy = Math.floor(i / d.columns),
        wx = d.x + cx * C,
        wy = d.y + cy * C,
        seed = (wx * 73856093) ^ (wy * 19349663);
      if (d.light[i]! < 0.4) continue;
      const alien =
        this.grid.get(
          Math.floor(wx / TILE_SIZE),
          Math.floor(wy / TILE_SIZE),
        ) === Block.Alien;
      const period = alien ? 6 : 24;
      if ((Math.floor(now / 160) + (seed & 31)) % period !== 0) continue;
      d.dot(
        wx + (seed & (C - 1)),
        wy + ((seed >> 2) & (C - 1)),
        alien ? P.mint : LIGHTING.colors.sparkle,
      );
    }
  }
}
