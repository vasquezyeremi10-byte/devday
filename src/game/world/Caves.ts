import { Block, surfaceRow, type Cell, type TerrainGrid } from './TerrainGrid';

/**
 * Cavernas naturales de la exploración subterránea (geología rev. 2).
 *
 * Una red de salas de formas distintas (ancha, alta, redonda, en L y nichos)
 * unidas por pasadizos de 2–3 bloques de alto, que nace en el muro del fondo
 * de la galería de la bocamina. Modelo de videojuego, no geología real.
 *
 * Reglas de jugabilidad que el generador garantiza por construcción:
 * - Todo pasadizo cabe al minero (alto ≥ 2) y los desniveles son de un bloque.
 * - Ninguna celda queda a más de `CAVE_MAX_PATH` pasos de la galería: el aire
 *   de la red (VentilationSystem) nunca baja al nivel peligroso sin
 *   ventilador.
 * - La cámara secreta está sellada por roca dura: solo se llega con una picota
 *   de tungsteno, y guarda la pista del libro del abuelo.
 *
 * Es puro y determinista: la misma semilla produce la misma red. No toca la
 * galería, los rieles ni nada al oeste de `FIRST_COLUMN`.
 */
export const CAVE_FIRST_COLUMN = 26;
/** Pasos máximos (4-vecinos) desde la boca de la red hasta cualquier celda. */
export const CAVE_MAX_PATH = 34;
/** Pasos máximos hasta una fuente de aire fresco (boca o corriente natural). */
const VENT_REACH = 10;
const LAST_ROW = 28;

export type ChamberKind = 'wide' | 'tall' | 'round' | 'bent' | 'alcove';
export interface Chamber {
  kind: ChamberKind;
  cx: number;
  cy: number;
}
export interface SecretChamber {
  /** Roca dura que sella la cámara (requiere picota de tungsteno). */
  plug: [number, number][];
  /** Pasadizo ciego hasta el sello (aire; conectado a la red). */
  tunnel: [number, number][];
  /** Aire de la cámara, sellada. */
  cells: [number, number][];
  /** Celda de aire donde descansa la página arrancada. */
  page: Cell;
  /** Último aire del pasadizo ciego, junto al sello. */
  approach: Cell;
}
export interface CaveWorld {
  chambers: Chamber[];
  /** Aire natural nuevo de la red (sin la cámara secreta). */
  cells: [number, number][];
  /** Primera celda de la red, en el muro del fondo de la galería. */
  entrance: Cell;
  crystals: [number, number][];
  /** Roca dura de las paredes, la geoda y el sello. */
  hardRock: [number, number][];
  iron: [number, number][];
  copper: [number, number][];
  secret: SecretChamber;
  /** Corrientes naturales de aire: celdas de la red con aire fresco propio. */
  vents: Cell[];
}

const SOLID_HOSTS = new Set<Block>([
  Block.Dirt,
  Block.Rock,
  Block.HardRock,
  Block.Coal,
  Block.Iron,
  Block.Copper,
  Block.Gold,
  Block.Emerald,
  Block.Ruby,
  Block.Sapphire,
  Block.Diamond,
]);

export function carveCaves(grid: TerrainGrid, random: () => number): CaveWorld {
  const int = (a: number, b: number) => a + Math.floor(random() * (b - a + 1));
  const key = (x: number, y: number) => grid.index(x, y);
  const original = new Map<number, Block>();
  const lastColumn = Math.min(grid.end - 6, 64);
  const minRow = (x: number) => Math.max(8, surfaceRow(x) + 4);
  const canCarve = (x: number, y: number) =>
    x >= CAVE_FIRST_COLUMN &&
    x <= lastColumn &&
    y >= minRow(x) &&
    y <= LAST_ROW &&
    SOLID_HOSTS.has(grid.get(x, y));
  const carve = (x: number, y: number) => {
    // La boca atraviesa el muro de la galería (filas 8–9, sobre su piso).
    const mouth = x <= CAVE_FIRST_COLUMN + 1 && y >= 8 && y <= 9;
    if (!mouth && !canCarve(x, y)) return;
    if (!SOLID_HOSTS.has(grid.get(x, y))) return;
    original.set(key(x, y), grid.get(x, y));
    grid.set(x, y, Block.Air);
  };

  /** Sala de contorno irregular. */
  const blob = (cx: number, cy: number, rx: number, ry: number) => {
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++)
      for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
        const d = ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2;
        if (d + (random() - 0.5) * 0.45 <= 1) carve(x, y);
      }
  };
  /** Pasadizo de 2 × 2 entre dos puntos (cabe el minero; desniveles de 1). */
  const tube = (x0: number, y0: number, x1: number, y1: number) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const y = Math.round(y0 + ((y1 - y0) * i) / steps);
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) carve(x + dx, y + dy);
    }
  };

  const chambers: Chamber[] = [];
  const room = (kind: ChamberKind, cx: number, cy: number) => {
    chambers.push({ kind, cx, cy });
    if (kind === 'wide') blob(cx, cy, int(3, 4), int(1, 2));
    else if (kind === 'tall') blob(cx, cy, int(1, 2), int(3, 4));
    else if (kind === 'round') blob(cx, cy, int(2, 3), int(2, 3));
    else if (kind === 'bent') {
      blob(cx, cy, 4, 1);
      blob(cx + 4, cy + 2, 1, 3);
    } else blob(cx, cy, 2, 1);
  };

  // Boca en el muro del fondo de la galería y red principal descendente.
  const entrance: Cell = { column: CAVE_FIRST_COLUMN, row: 9 };
  const jitter = () => int(-1, 1);
  const A = { x: 31 + jitter(), y: 12 + jitter() };
  const B = { x: 38 + jitter(), y: 16 + jitter() };
  const C = { x: 44 + jitter(), y: 19 + jitter() };
  const D = { x: A.x + int(7, 8), y: A.y - 2 };
  const E = { x: B.x - int(6, 7), y: B.y + 3 };
  const F = { x: C.x + 1, y: C.y + 5 };
  tube(entrance.column, 8, A.x - 2, A.y);
  room('wide', A.x, A.y);
  tube(A.x, A.y, B.x, B.y);
  room('tall', B.x, B.y);
  tube(B.x, B.y, C.x, C.y);
  room('round', C.x, C.y);
  tube(A.x + 2, A.y, D.x, D.y);
  room('bent', D.x, D.y);
  tube(B.x, B.y + 2, E.x, E.y);
  room('alcove', E.x, E.y);
  tube(C.x, C.y + 1, F.x, F.y);
  room('wide', F.x, F.y);

  // Poda: nada a más de CAVE_MAX_PATH pasos de la boca (aire respirable).
  const distance = new Map<number, number>();
  const queue: number[] = [];
  const start = key(entrance.column, entrance.row);
  if (original.has(start)) {
    distance.set(start, 0);
    queue.push(start);
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    const d = distance.get(i)!;
    const { column: x, row: y } = grid.cellOf(i);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const n = key(x + dx, y + dy);
      // Por todo el aire (la red y las cavernas selladas que toque), no solo
      // lo tallado: un pasadizo que cruza una caverna sigue conectado.
      if (
        grid.contains(x + dx, y + dy) &&
        grid.get(x + dx, y + dy) === Block.Air &&
        !distance.has(n) &&
        d + 1 <= CAVE_MAX_PATH
      ) {
        distance.set(n, d + 1);
        queue.push(n);
      }
    }
  }
  for (const [i, block] of [...original]) {
    if (distance.has(i)) continue;
    const c = grid.cellOf(i);
    grid.set(c.column, c.row, block);
    original.delete(i);
  }
  const cells: [number, number][] = [...original.keys()].map((i) => {
    const c = grid.cellOf(i);
    return [c.column, c.row];
  });
  const isCave = (x: number, y: number) => original.has(key(x, y));
  const kept = chambers.filter((c) => isCave(c.cx, c.cy));

  /** Paredes sólidas que dan al aire de la red, en orden estable. */
  const walls = (): [number, number][] => {
    const out: [number, number][] = [];
    const seen = new Set<number>();
    for (const [x, y] of cells)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const wx = x + dx,
          wy = y + dy,
          k = key(wx, wy);
        if (
          seen.has(k) ||
          wx <= CAVE_FIRST_COLUMN ||
          wx > lastColumn ||
          wy < minRow(wx) ||
          wy > LAST_ROW ||
          !SOLID_HOSTS.has(grid.get(wx, wy))
        )
          continue;
        seen.add(k);
        out.push([wx, wy]);
      }
    return out;
  };

  const crystals: [number, number][] = [];
  const hardRock: [number, number][] = [];
  const iron: [number, number][] = [];
  const copper: [number, number][] = [];
  const put = (
    list: [number, number][],
    block: Block,
    x: number,
    y: number,
  ) => {
    if (!SOLID_HOSTS.has(grid.get(x, y)) || isCave(x, y)) return false;
    grid.set(x, y, block);
    list.push([x, y]);
    return true;
  };
  const take = <T>(list: T[]): T => list.splice(int(0, list.length - 1), 1)[0]!;

  // Secreto: pasadizo ciego, sello de roca dura y cámara sellada con la página.
  const secret = carveSecret(grid, random, kept, cells, isCave, canCarve);

  // Cobre y hierro a la vista en las paredes (hierro arriba, cobre abajo).
  const pool = walls().filter(
    ([x, y]) => !secret.plug.some(([px, py]) => px === x && py === y),
  );
  for (let n = 0; n < 7 && pool.length; n++) {
    const [x, y] = take(pool);
    if (y < 17) put(iron, Block.Iron, x, y);
    else put(copper, Block.Copper, x, y);
  }
  for (const ch of kept) {
    const near = pool.filter(([x, y]) => Math.hypot(x - ch.cx, y - ch.cy) < 8);
    for (let n = 0; n < 2 && near.length; n++) {
      const [x, y] = take(near);
      put(
        ch.cy < 17 ? iron : copper,
        ch.cy < 17 ? Block.Iron : Block.Copper,
        x,
        y,
      );
    }
  }
  // Cristales violeta: racimos en las paredes de cada sala y junto al sello.
  for (const ch of kept) {
    const near = pool.filter(([x, y]) => Math.hypot(x - ch.cx, y - ch.cy) < 7);
    for (let n = int(2, 4); n > 0 && near.length; n--) {
      const [x, y] = take(near);
      if (put(crystals, Block.Crystal, x, y) && random() < 0.5)
        put(crystals, Block.Crystal, x + (random() < 0.5 ? 1 : -1), y);
    }
  }
  // Pista: destellos violeta en las paredes del pasadizo ciego, junto al sello.
  const toward = Math.sign(secret.plug[0]![0] - secret.approach.column) || 1;
  for (const [x, y] of [
    [secret.approach.column, secret.approach.row - 2],
    [secret.approach.column - toward, secret.approach.row + 2],
    [secret.approach.column, secret.approach.row + 2],
  ] as const)
    put(crystals, Block.Crystal, x, y);

  // Geoda: cristales encerrados en roca dura junto a una sala (pico de tungsteno).
  for (const ch of kept.filter((c) => c.kind !== 'alcove')) {
    let placed = false;
    for (let tries = 0; tries < 30 && !placed; tries++) {
      const gx = ch.cx + int(-8, 8),
        gy = ch.cy + int(-4, 5);
      const block = [-1, 0, 1].every((dy) =>
        [-1, 0, 1].every((dx) => {
          const x = gx + dx,
            y = gy + dy;
          return (
            canCarve(x, y) &&
            !isCave(x, y) &&
            !secret.plug.some(([px, py]) => px === x && py === y) &&
            grid.get(x, y) !== Block.Crystal
          );
        }),
      );
      const exposed = [
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
      ].some(([dx, dy]) => isCave(gx + dx!, gy + dy!));
      if (!block || !exposed) continue;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const inner = Math.abs(dx) + Math.abs(dy) <= 1 && random() < 0.6;
          if (dx === 0 && dy === 0) put(crystals, Block.Crystal, gx, gy);
          else if (inner) put(crystals, Block.Crystal, gx + dx, gy + dy);
          else put(hardRock, Block.HardRock, gx + dx, gy + dy);
        }
      placed = true;
    }
  }
  // Rocas resistentes sueltas en las paredes profundas.
  const deep = pool.filter(([, y]) => y >= 15);
  for (let n = 0; n < 8 && deep.length; n++) {
    const [x, y] = take(deep);
    put(hardRock, Block.HardRock, x, y);
  }
  for (const [x, y] of secret.plug) hardRock.push([x, y]);

  // Corrientes naturales: grietas demasiado finas para pasar, pero que traen
  // aire fresco a las salas lejanas (la red no exige ventilador).
  const vents: Cell[] = kept.map((c) => {
    let row = c.cy;
    while (isCave(c.cx, row - 1)) row--;
    return { column: c.cx, row };
  });
  // Si aún queda una celda lejos de toda fuente de aire, otra corriente ahí.
  const nearest = () => {
    const dist = new Map<number, number>();
    const q: number[] = [];
    for (const s of [start, ...vents.map((v) => key(v.column, v.row))])
      if (original.has(s)) {
        dist.set(s, 0);
        q.push(s);
      }
    for (let head = 0; head < q.length; head++) {
      const i = q[head]!;
      const { column: x, row: y } = grid.cellOf(i);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const n = key(x + dx, y + dy);
        if (
          grid.contains(x + dx, y + dy) &&
          grid.get(x + dx, y + dy) === Block.Air &&
          !dist.has(n) &&
          dist.get(i)! < 60
        ) {
          dist.set(n, dist.get(i)! + 1);
          q.push(n);
        }
      }
    }
    return dist;
  };
  for (let guard = 0; guard < 8; guard++) {
    const dist = nearest();
    let far = -1,
      farD = 0;
    for (const [i, d] of dist) {
      if (!original.has(i) || d <= farD) continue;
      far = i;
      farD = d;
    }
    if (farD <= VENT_REACH || far < 0) break;
    vents.push(grid.cellOf(far));
  }
  grid.vents.push(...vents);

  for (const [x, y] of [...cells, ...secret.tunnel, ...secret.cells])
    grid.caveAir.add(key(x, y));
  // La cámara sellada también respira por una fisura: al romper el sello el
  // aire ya es fresco y la página se puede leer sin ventilador.
  vents.push({ column: secret.page.column, row: secret.page.row - 1 });
  grid.vents.push(vents[vents.length - 1]!);

  return {
    chambers: kept,
    cells,
    entrance,
    crystals: crystals.filter(([x, y]) => grid.get(x, y) === Block.Crystal),
    hardRock: hardRock.filter(([x, y]) => grid.get(x, y) === Block.HardRock),
    iron: iron.filter(([x, y]) => grid.get(x, y) === Block.Iron),
    copper: copper.filter(([x, y]) => grid.get(x, y) === Block.Copper),
    secret,
    vents,
  };
}

/**
 * Pasadizo ciego desde una sala hasta un sello de roca dura de dos bloques y,
 * detrás, una cámara mínima sellada. Prueba varias salas, lados y largos hasta
 * que la cámara quede rodeada de roca (nunca abierta a otra caverna).
 */
function carveSecret(
  grid: TerrainGrid,
  random: () => number,
  rooms: Chamber[],
  cave: [number, number][],
  isCave: (x: number, y: number) => boolean,
  canCarve: (x: number, y: number) => boolean,
): SecretChamber {
  // Primero las salas (la más cercana a la boca antes: la cámara queda a poca
  // distancia); si ninguna sirve, cualquier celda de la red como punto de partida.
  const order = [
    ...[...rooms]
      .filter((c) => c.kind !== 'alcove')
      .sort((a, b) => a.cx + a.cy - (b.cx + b.cy))
      .map((c) => ({ cx: c.cx, cy: c.cy })),
    ...[...cave]
      .sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
      .map(([cx, cy]) => ({ cx, cy })),
  ];
  for (const ch of order)
    for (const side of random() < 0.5 ? [1, -1] : [-1, 1])
      for (const length of [4, 5, 3, 6, 7]) {
        const x = (i: number) => ch.cx + side * (1 + i);
        // Primer bloque de roca en la fila central: ahí termina la sala.
        let edge = 0;
        while (edge < 10 && isCave(x(edge), ch.cy)) edge++;
        if (edge >= 10) continue;
        const rows = [ch.cy - 1, ch.cy, ch.cy + 1];
        const tunnel = Array.from({ length }, (_, i) => x(edge + i));
        const plugX = [x(edge + length), x(edge + length + 1)];
        const roomX = Array.from({ length: 7 }, (_, i) =>
          x(edge + length + 2 + i),
        );
        const solid = (cx: number, y: number) =>
          canCarve(cx, y) && !isCave(cx, y);
        // Los dos primeros bloques del pasadizo empalman con la sala (pueden
        // ser aire de ella); el resto debe ser roca firme con anillo intacto.
        const junction = tunnel.slice(0, 2);
        const beyond = [...tunnel.slice(2), ...plugX, ...roomX];
        const ok =
          junction.every((cx) =>
            rows.every((y) => isCave(cx, y) || solid(cx, y)),
          ) &&
          beyond.every((cx) => rows.every((y) => solid(cx, y))) &&
          beyond.every((cx) =>
            [ch.cy - 2, ch.cy + 2].every((y) => solid(cx, y)),
          ) &&
          rows.every((y) => solid(roomX[roomX.length - 1]! + side, y));
        if (!ok) continue;
        const plug: [number, number][] = [];
        const cells: [number, number][] = [];
        for (const cx of tunnel)
          for (const y of rows) grid.set(cx, y, Block.Air);
        for (const cx of plugX)
          for (const y of rows) {
            grid.set(cx, y, Block.HardRock);
            plug.push([cx, y]);
          }
        for (const cx of roomX)
          for (const y of rows) {
            // Contorno suave: sin las esquinas del fondo ni del techo extremo.
            const far = cx === roomX[roomX.length - 1];
            const near = cx === roomX[0];
            if ((far && y !== ch.cy) || (near && y === ch.cy - 1)) continue;
            grid.set(cx, y, Block.Air);
            cells.push([cx, y]);
          }
        return {
          plug,
          tunnel: tunnel.flatMap((cx) =>
            rows.map((y): [number, number] => [cx, y]),
          ),
          cells,
          page: { column: roomX[3]!, row: ch.cy + 1 },
          approach: { column: tunnel[tunnel.length - 1]!, row: ch.cy },
        };
      }
  throw new Error(
    'No se pudo ubicar la cámara secreta: ' + JSON.stringify(order),
  );
}
