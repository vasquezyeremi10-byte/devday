import {
  BALANCE,
  MATERIAL_KG,
  SUPPLY_KEYS,
  TOOL_KEYS,
  TOOLS,
  type Material,
  type ToolKind,
} from '../config/balance';
import {
  MAX_LEVEL,
  MAX_SLOTS,
  PPE,
  PPE_KEYS,
  QUICKBAR_SIZE,
  REQUIRED_PPE,
  XP,
  XP_CURVE,
  xpForLevel,
  xpToNext,
  V4_PPE_PRICE,
  type PPEKind,
} from '../config/gear';
import { MINERAL_KEYS, type MineralKey } from '../config/minerals';
import { sanitizeMineName } from '../config/mineName';
import {
  LEGACY_COLUMNS,
  LEGACY_COLUMNS_V6,
  WORLD,
  WORLD_FIRST_COLUMN,
  WORLD_LEFT,
  WORLD_SPAN,
} from '../config/constants';
import {
  createInitialTerrain,
  DEFAULT_SEED,
  pristineTerrain,
  WORLD_REV_SOLID,
  WORLD_REV_ENTRANCE_10,
  WORLD_REV_EXPLORE,
  WORLD_REV_LEGACY,
} from '../world/Geology';
import { Block, surfaceRow, type Cell, type Point } from '../world/TerrainGrid';
import { TopDownGallery } from '../world/TopDownGallery';
import { CABIN_DOOR, validCabinPosition } from '../config/topDownCabin';
import { FallingBlocks } from './FallingBlocks';
import {
  restoreExpeditionState,
  snapshotExpedition,
} from './Expeditions';
import { GameSession, type LoosePile } from './GameSession';
import { LAMPS, type LampKind } from './PlacedLights';
import {
  ACHIEVEMENTS,
  levelForXp,
  rewardKey,
  type AchievementId,
  type Tier,
} from './ProgressionSystem';
import { SUPPORT } from './SupportSystem';
import type { GearSlot, ItemRef, QuickRef } from './LoadoutSystem';

/**
 * V8 (formato 6): mundo de 140 columnas, campamento, energía, alimentación,
 * último descanso y estado del pabellón. Las partidas V5 se migran al
 * cargarlas (índices de terreno de 80 columnas) y su clave se conserva.
 */
export const SAVE_KEY = 'mina-cero.save.v6';
export const V5_SAVE_KEY = 'mina-cero.save.v5';
/** Partida V4: se migra a V5 al cargarla y su clave se conserva. */
export const V4_SAVE_KEY = 'mina-cero.save.v4';
/** Partida V3: se migra a V4 al cargarla y su clave se conserva. */
export const V3_SAVE_KEY = 'mina-cero.save.v3';
/** Partida V2: se lee una vez, se migra y se conserva como respaldo. */
export const LEGACY_SAVE_KEY = 'mina-cero.save.v2';
/** Gracia mínima de una cuenta regresiva de derrumbe al cargar (ms). */
export const COLLAPSE_LOAD_GRACE = 10_000;

/**
 * Formato V3: semilla + diferencias del terreno (solo aire o escombro), mapa
 * de descubrimiento, sistemas instalados y temporizadores.
 *
 * Temporizadores al guardar/cargar:
 * - Mecha encendida: al cargar queda apagada, la carga sigue instalada y la
 *   mecha se devuelve al inventario. Nunca explota al abrir la partida.
 * - Derrumbe en cuenta regresiva: se guarda el tiempo restante; al cargar se
 *   reevalúa el tramo y, si sigue inminente, se reanuda con al menos 10 s.
 */
export function encodeSave(session: GameSession, player: Point): string {
  session.loadout.syncQuick();
  // Los lotes de los alimentos deben sumar lo que lleva el minero.
  session.syncFood();
  // Referencia de solo lectura: no se regenera el mundo en cada guardado.
  const initial = pristineTerrain(session.seed, session.grid.worldRev);
  const terrain: [number, number][] = [];
  const g = session.grid;
  for (let r = 0; r < g.rows; r++)
    for (let c = g.first; c < g.end; c++)
      if (g.get(c, r) !== initial.get(c, r))
        terrain.push([g.index(c, r), g.get(c, r)]);
  return JSON.stringify({
    version: 6,
    // V9: ancho del mundo con que se guardaron los índices de terreno. Las
    // partidas V6 anteriores no lo traían: SaveSystem asume 140 columnas.
    columns: g.columns,
    // Mundo abierto: primera columna de esos índices (borde oeste). Sin el
    // dato (partidas anteriores) los índices empiezan en la columna 0.
    left: g.first,
    v8: {
      survival: session.survival.snapshot(),
      inCabin: session.inCabin,
    },
    // V9: linterna del casco (carga e interruptor).
    lamp: session.headlamp.snapshot(),
    // Primera secuencia: «La herencia del abuelo».
    intro: session.intro.snapshot(),
    // V11: construcción. `terrain` ya lleva los bloques colocados (diferencias
    // contra la geología); `placed` dice cuáles son del jugador y `felled` los
    // árboles talados. La posición del jugador va en `player`.
    build: {
      placed: [...session.placed].sort((a, b) => a - b),
      felled: session.trees.snapshot(),
    },
    // V10: geología con que se generó el terreno (las diferencias son contra ella)
    // y progreso de la exploración subterránea.
    worldRev: session.grid.worldRev,
    explore: session.exploration.snapshot(),
    // V9: región donde quedó el minero y biomas visitados. El mundo de cada
    // región se regenera idéntico desde la semilla; lo excavado y construido
    // va en `terrain` y `build`.
    regions: session.regions.snapshot(),
    dayNightMs: session.dayNight.elapsedMs,
    // Tiempo de juego acumulado: la caducidad de los alimentos se mide contra
    // él (un día del juego = un ciclo día + noche).
    dayNightTotalMs: session.dayNight.totalMs,
    // Vencimientos de lo que lleva el minero y refrigerador (tiempo detenido).
    food: session.food.snapshot(),
    fridge: session.fridge.snapshot(),
    topDownCabin: session.topDownCabin,
    gallery: session.gallery?.snapshot(),
    // Expedición lateral: se guarda aparte de la geología de superficie.
    expedition: session.expedition
      ? snapshotExpedition(session.expedition)
      : undefined,
    developer: session.developer.snapshot(),
    // Códigos (tecla |): solo aparece si se usó alguno; sin él, sin códigos.
    cheats: session.cheats.snapshot(),
    // Pedidos pagados por el celular (esperando o en vuelo) y cajas del dron.
    drones: session.drones.snapshot(),
    seed: session.seed,
    money: session.money,
    supplies: session.supplies,
    warehouse: session.warehouse,
    inventory: session.inventory.items,
    tools: session.tools.items,
    equipped: session.tools.equipped,
    rails: session.rails.segments,
    cart: { x: session.cart.x, items: session.cart.inventory.items },
    terrain,
    revealed: session.visibility.encode(),
    piles: session.piles,
    nextPile: session.nextPile,
    sold: session.sold,
    deaths: session.deaths,
    supports: session.supports.items,
    lights: session.lights.items.map((l) => ({
      ...l,
      fuel: l.fuel === Infinity ? -1 : Math.round(l.fuel),
    })),
    ventilation: {
      ducts: session.ventilation.ducts,
      fans: session.ventilation.fans,
    },
    blasting: {
      drilled: [...session.blasting.drilled],
      fractured: [...session.blasting.fractured],
      charges: session.blasting.charges.map((c) => ({
        column: c.column,
        row: c.row,
        lit: c.endsAt !== null,
      })),
      blasts: session.blasting.blasts,
    },
    collapses: [...session.geotech.collapses.values()].map((c) => ({
      key: c.key,
      remaining: Math.round(c.remaining),
    })),
    // Bloques de un derrumbe que aún caían al guardar (solo si los hay): al
    // cargar quedan asentados como escombro donde habrían terminado.
    falling: session.falling.snapshot(),
    health: Math.round(session.health.hp),
    progression: {
      tier: session.progression.tier,
      earned: session.progression.earned,
      deepestRow: session.progression.deepestRow,
      found: [...session.progression.found],
    },
    achievements: [...session.achievements.unlocked],
    player,
    v4: {
      mode: session.mode,
      modeChosen: session.modeChosen,
      ended: session.ended,
      firstDayDone: session.firstDayDone,
      stats: session.stats,
      xp: session.progression.xp,
      xpCurve: XP_CURVE,
      rewarded: [...session.progression.rewarded],
      kitClaimed: session.kitClaimed,
      mineName: session.mineName,
      salvage: session.salvage,
      loadout: {
        slots: session.loadout.slots,
        ppe: session.loadout.ppe,
        nextPpe: session.loadout.nextPpe,
        gear: session.loadout.gear,
        quickbar: session.loadout.quickbar,
        selectedQuick: session.loadout.selectedQuick,
      },
    },
  });
}

const int = (v: unknown, max = 1e9): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
/** Lista de bloques válidos cuyo peso total (kg) no pasa `cap`. */
const materials = (v: unknown, cap: number): v is Material[] =>
  Array.isArray(v) &&
  v.every((m) => typeof m === 'string' && Object.hasOwn(BALANCE.sale, m)) &&
  v.reduce((kg: number, m: Material) => kg + MATERIAL_KG[m], 0) <= cap;
const point = (v: Point) =>
  v &&
  Number.isFinite(v.x) &&
  Number.isFinite(v.y) &&
  v.x >= WORLD_LEFT &&
  v.x < WORLD.columns * 16 &&
  v.y >= 0 &&
  v.y < WORLD.rows * 16;
/** Columna del mundo válida: del borde oeste (negativa) al borde este. */
const columnOk = (v: unknown): v is number =>
  typeof v === 'number' &&
  Number.isInteger(v) &&
  v >= WORLD_FIRST_COLUMN &&
  v < WORLD.columns;
const cellOk = (v: Cell) =>
  v && columnOk(v.column) && int(v.row, WORLD.rows - 1);
/** Ancho guardado válido: de las 80 columnas originales al mundo actual. */
const savedColumnsOk = (v: unknown): v is number =>
  int(v) && v >= LEGACY_COLUMNS && v <= WORLD_SPAN;
/**
 * Primera columna de los índices guardados: 0 en las partidas anteriores al
 * mundo abierto; desde entonces, el borde oeste con que se guardó.
 */
const savedLeft = (v: unknown, columns: number): number =>
  typeof v === 'number' &&
  Number.isInteger(v) &&
  v <= 0 &&
  v >= WORLD_FIRST_COLUMN &&
  v + columns <= WORLD.columns
    ? v
    : 0;

type Restored = { session: GameSession; player: Point; migrated?: string };
/** JSON sin tipo: cada campo se valida antes de usarse. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SaveData = Record<string, any>;

/** Rechazar una partida corrupta completa, sin restauraciones parciales que dupliquen bienes. */
export function decodeSave(
  raw: string,
  developerMode = false,
  /**
   * Geología de las partidas sin el dato `worldRev` (anteriores a V10). El
   * juego pasa la revisión vigente: así esas partidas ganan las cavernas sin
   * perder nada, porque las diferencias del terreno solo son aire o escombro.
   */
  defaultRev: number = WORLD_REV_LEGACY,
): Restored | null {
  try {
    const data = JSON.parse(raw);
    const rev =
      data?.worldRev === WORLD_REV_LEGACY ||
      data?.worldRev === WORLD_REV_EXPLORE ||
      data?.worldRev === WORLD_REV_SOLID ||
      data?.worldRev === WORLD_REV_ENTRANCE_10
        ? data.worldRev
        : defaultRev;
    if (data?.version === 2) {
      const r = migrateV2(data, rev);
      return r && toV8(toV5(migrateToV4(r), false));
    }
    if (data?.version === 3) {
      const r = decodeV3(data, false, LEGACY_COLUMNS, rev);
      return r && toV8(toV5(migrateToV4(r), false));
    }
    if (data?.version === 4) {
      const r = decodeV3(data, false, LEGACY_COLUMNS, rev);
      const v4 = r && applyV4(r, data.v4);
      return v4 && toV8(toV5(v4, true));
    }
    if (data?.version !== 5 && data?.version !== 6) return null;
    const legacy = data.version === 5;
    // V9: las partidas V6 traen su propio ancho (`columns`); las anteriores
    // a los biomas guardaron 140 columnas y las de antes del campamento, 80.
    const columns =
      legacy || !savedColumnsOk(data.columns)
        ? legacy
          ? LEGACY_COLUMNS
          : LEGACY_COLUMNS_V6
        : data.columns;
    const left = legacy ? 0 : savedLeft(data.left, columns);
    if (left === 0 && columns > WORLD.columns) return null;
    const r = decodeV3(data, developerMode, columns, rev, left);
    // Leer flags antiguos de desarrollo sin alterar las 24 casillas disponibles.
    r?.session.developer.restore(data.developer);
    r?.session.cheats.restore(data.cheats);
    const v = r && applyV4(r, data.v4);
    if (!v) return null;
    v.session.kitClaimed = data.v4?.kitClaimed === true;
    // Partidas anteriores al nombre propio conservan «MINA CERO».
    v.session.mineName = sanitizeMineName(data.v4?.mineName);
    const salvage = data.v4?.salvage ?? {};
    for (const k of SUPPLY_KEYS)
      if (Number.isFinite(salvage[k]) && salvage[k] >= 0 && salvage[k] < 1)
        v.session.salvage[k] = salvage[k];
    if (legacy) return toV8(v);
    v.session.survival.restore(data.v8?.survival);
    v.session.inCabin = data.v8?.inCabin === true;
    // V9: carga de la linterna; partidas anteriores a V9 cargan al 100 %.
    v.session.headlamp.restore(data.lamp);
    // Sin datos (partidas anteriores a la secuencia) = sin tutorial.
    v.session.intro.restore(data.intro);
    v.session.exploration.restore(data.explore);
    // V9: sin el dato (partidas anteriores), solo el desierto es conocido.
    v.session.regions.restore(data.regions);
    // El reloj ya está restaurado: las pilas sin fechas (guardados anteriores)
    // nacen frescas ahora.
    const now = v.session.dayNight.totalMs;
    v.session.warehouse.restore(data.warehouse, now);
    v.session.food.restore(data.food);
    v.session.fridge.restore(data.fridge);
    v.session.syncFood();
    // Sin el dato (partidas anteriores): sin pedidos ni cajas.
    v.session.drones.restore(data.drones, now);
    return v;
  } catch {
    return null;
  }
}

/** Herramienta retirada en V13: sus copias en partidas antiguas se descartan. */
const RETIRED_TOOLS = ['diamond'];

function restoreTools(session: GameSession, saved: unknown, equipped: unknown) {
  if (!Array.isArray(saved)) return false;
  const tools = saved.filter((t) => !RETIRED_TOOLS.includes(t?.kind));
  // Si la retirada era la equipada, la mano queda libre (sin error de carga).
  if (saved.some((t) => RETIRED_TOOLS.includes(t?.kind) && t?.id === equipped))
    equipped = 0;
  const ids = new Set<number>();
  for (const t of tools) {
    if (
      !int(t?.id) ||
      t.id === 0 ||
      ids.has(t.id) ||
      !TOOL_KEYS.includes(t.kind) ||
      !int(t.durability, TOOLS[t.kind as ToolKind].durability)
    )
      return false;
    ids.add(t.id);
  }
  if (equipped !== 0 && !ids.has(equipped as number)) return false;
  session.tools.items = tools;
  session.tools.equipped = equipped as number;
  session.tools.nextId = Math.max(0, ...ids) + 1;
  return true;
}

function restoreRails(
  session: GameSession,
  rails: unknown,
  cartX: number,
): boolean {
  if (!Array.isArray(rails) || !rails.length) return false;
  const columns = new Set<number>();
  for (const s of rails) {
    if (
      !cellOk(s) ||
      columns.has(s.column) ||
      !session.rails.supported(s.column, s.row)
    ) {
      // Una vía obstruida por escombro se conserva: sigue siendo de la partida.
      if (!cellOk(s) || columns.has(s.column)) return false;
    }
    columns.add(s.column);
  }
  const sorted = [...rails].sort((a, b) => a.column - b.column);
  // Desde V5 una vía puede quedar cortada al desmontar un tramo: solo se
  // exige desnivel de a lo sumo un bloque entre columnas vecinas.
  if (
    sorted.some(
      (s, i) =>
        i &&
        s.column === sorted[i - 1].column + 1 &&
        Math.abs(s.row - sorted[i - 1].row) > 1,
    )
  )
    return false;
  session.rails.segments = sorted.map((s) => ({
    column: s.column,
    row: s.row,
    kind: 'track',
  }));
  if (!Number.isFinite(cartX) || !session.rails.at(Math.floor(cartX / 16)))
    return false;
  session.cart.x = cartX;
  return true;
}

function restorePiles(session: GameSession, piles: unknown): boolean {
  if (!Array.isArray(piles)) return false;
  const restored: LoosePile[] = [];
  for (const p of piles) {
    const items: unknown = Array.isArray(p?.items)
      ? p.items
      : typeof p?.material === 'string' && int(p?.count, 64)
        ? Array(p.count).fill(p.material)
        : null;
    if (!int(p?.id) || !point(p) || !materials(items, 64)) return false;
    restored.push({ id: p.id, x: p.x, y: p.y, items: [...items] });
  }
  session.piles = restored;
  session.nextPile = Math.max(1, ...restored.map((p) => p.id)) + 1;
  return true;
}

/**
 * `columns`: ancho con que se guardaron los índices de terreno y el mapa de
 * descubrimiento (80 hasta V5; 140 desde V8).
 */
function decodeV3(
  data: SaveData,
  developerMode = false,
  columns: number = WORLD.columns,
  rev: number = WORLD_REV_LEGACY,
  /** Primera columna de los índices guardados (0 antes del mundo abierto). */
  left = 0,
): Restored | null {
  if (
    !int(data.seed, 0xffffffff) ||
    !int(data.money) ||
    !int(data.sold) ||
    !point(data.player) ||
    !materials(data.inventory, BALANCE.personalCapacity) ||
    !materials(data.cart?.items, BALANCE.cartCapacity) ||
    !Array.isArray(data.terrain)
  )
    return null;
  const grid = createInitialTerrain(data.seed, rev);
  // V11: bloques colocados (validados contra la lista de colocados del guardado).
  const placedKeys = new Set<number>(
    Array.isArray(data.build?.placed) ? data.build.placed : [],
  );
  for (const entry of data.terrain) {
    if (!Array.isArray(entry)) return null;
    const [index, block] = entry;
    if (!int(index, columns * grid.rows - 1)) return null;
    const c = (index % columns) + left,
      r = Math.floor(index / columns);
    // Excavación, escombro o un bloque colocado por el jugador (tierra, roca
    // o madera, solo si el guardado lo declara): cargar nunca crea mena.
    const built =
      (block === Block.Dirt || block === Block.Rock || block === Block.Wood) &&
      placedKeys.has(index);
    if (
      (block !== Block.Air && block !== Block.Rubble && !built) ||
      grid.get(c, r) === Block.Bedrock
    )
      return null;
    grid.set(c, r, block);
  }
  // Derrumbe a medias al guardar: sus bloques ya habían salido del techo. Se
  // asientan ahora como escombro (un bloque desprendido, un escombro), antes
  // de crear la sesión para que todos sus sistemas vean el terreno final.
  const fallen = new FallingBlocks();
  fallen.restore(data.falling, grid);
  const settled = fallen.settle(grid);
  const session = new GameSession(grid, data.seed, developerMode);
  // Solo cuentan como colocados los que siguen siendo bloques construibles.
  // V9: los índices guardados usan el ancho de la partida; se reasientan en
  // la cuadrícula actual (las columnas nuevas se agregan a la derecha).
  for (const key of placedKeys) {
    if (!int(key, columns * grid.rows - 1)) continue;
    const r = Math.floor(key / columns),
      c = (key % columns) + left;
    const b = grid.get(c, r);
    if (b === Block.Dirt || b === Block.Rock || b === Block.Wood)
      session.placed.add(grid.index(c, r));
  }
  session.trees.restore(data.build?.felled);
  session.dayNight.restore(data.dayNightMs, data.dayNightTotalMs);
  if (typeof data.topDownCabin?.inside === 'boolean') {
    const p = data.topDownCabin.position;
    session.topDownCabin = {
      inside: data.topDownCabin.inside,
      position: p && validCabinPosition(p) ? { x: p.x, y: p.y } : CABIN_DOOR,
    };
  }
  session.gallery = TopDownGallery.restore(data.gallery);
  session.expedition = restoreExpeditionState(data.expedition, session.seed);
  // Partida anterior a la ampliación: lo visible del mundo nuevo se calcula
  // y se suma lo que ya se había descubierto en las 80 columnas originales.
  if (columns !== grid.columns || left !== grid.first)
    session.visibility.initialize(grid);
  if (
    typeof data.revealed !== 'string' ||
    !session.visibility.decode(data.revealed, columns, left)
  )
    session.visibility.initialize(grid);
  for (const cell of settled) session.visibility.reveal(cell.column, cell.row);
  session.visibility.dirty.length = 0;
  if (!restoreTools(session, data.tools, data.equipped)) return null;
  if (!restoreRails(session, data.rails, data.cart.x)) return null;
  if (!restorePiles(session, data.piles)) return null;
  session.nextPile = Math.max(
    session.nextPile,
    int(data.nextPile) ? data.nextPile : 0,
  );
  for (const key of SUPPLY_KEYS) {
    const v = data.supplies?.[key] ?? 0;
    if (!int(v, 9999)) return null;
    session.supplies[key] = v;
  }
  session.money = data.money;
  session.sold = data.sold;
  session.deaths = int(data.deaths) ? data.deaths : 0;
  session.inventory.items.push(...data.inventory);
  session.cart.inventory.items.push(...data.cart.items);
  // Sostenimiento, luces y ventilación instalados.
  session.supports.items = [];
  session.supports.nextId = 1;
  for (const s of Array.isArray(data.supports) ? data.supports : []) {
    if (!cellOk(s) || (s.kind !== 'wood' && s.kind !== 'steel')) return null;
    const durability = Math.max(
      0,
      Math.min(SUPPORT[s.kind as 'wood'].durability, Number(s.durability) || 0),
    );
    session.supports.items.push({
      column: s.column,
      row: s.row,
      id: session.supports.nextId++,
      kind: s.kind,
      durability,
      roof: s.row,
      ...(s.fixed === true ? { fixed: true } : {}),
    });
  }
  session.supports.refresh(grid);
  for (const l of Array.isArray(data.lights) ? data.lights : []) {
    if (!cellOk(l) || !Object.hasOwn(LAMPS, l.kind)) return null;
    const kind = l.kind as LampKind;
    const fuel =
      LAMPS[kind].fuelMs === Infinity
        ? Infinity
        : Math.max(1, Math.min(LAMPS[kind].fuelMs, Number(l.fuel) || 0));
    session.lights.items.push({
      id: session.lights.nextId++,
      column: l.column,
      row: l.row,
      kind,
      fuel,
    });
  }
  session.lights.prune(grid);
  const v = data.ventilation ?? {};
  for (const d of Array.isArray(v.ducts) ? v.ducts : []) {
    if (!cellOk(d)) return null;
    session.ventilation.ducts.push({ column: d.column, row: d.row });
  }
  for (const f of Array.isArray(v.fans) ? v.fans : []) {
    if (!cellOk(f) || (f.kind !== 'fan_aux' && f.kind !== 'fan_main'))
      return null;
    session.ventilation.fans.push({
      id: session.ventilation.nextId++,
      column: f.column,
      row: f.row,
      kind: f.kind,
    });
  }
  session.ventilation.prune();
  // Barrenos, fracturas y cargas: las mechas encendidas se apagan al cargar.
  const b = data.blasting ?? {};
  const cellKey = (k: unknown) =>
    typeof k === 'string' && /^-?\d+,\d+$/.test(k) ? k : null;
  for (const k of Array.isArray(b.drilled) ? b.drilled : [])
    if (cellKey(k)) session.blasting.drilled.add(k);
  for (const k of Array.isArray(b.fractured) ? b.fractured : [])
    if (cellKey(k)) session.blasting.fractured.add(k);
  for (const c of Array.isArray(b.charges) ? b.charges : []) {
    if (!cellOk(c)) return null;
    if (!session.blasting.chargeAt(c))
      session.blasting.charges.push({
        column: c.column,
        row: c.row,
        endsAt: null,
      });
    if (c.lit) session.supplies.fuse++;
  }
  session.blasting.blasts = int(b.blasts) ? b.blasts : 0;
  // Salud, progreso y logros.
  session.health.hp =
    int(data.health, 100) && data.health > 0 ? data.health : 100;
  const p = data.progression ?? {};
  session.progression.tier = ([1, 2, 3].includes(p.tier) ? p.tier : 1) as Tier;
  session.progression.earned = int(p.earned) ? p.earned : 0;
  session.progression.deepestRow = int(p.deepestRow, WORLD.rows)
    ? p.deepestRow
    : 0;
  for (const m of Array.isArray(p.found) ? p.found : [])
    if (MINERAL_KEYS.includes(m))
      session.progression.found.add(m as MineralKey);
  for (const a of Array.isArray(data.achievements) ? data.achievements : [])
    if (Object.hasOwn(ACHIEVEMENTS, a))
      session.achievements.unlocked.add(a as AchievementId);
  // Estado geotécnico y de aire con el terreno recuperado.
  session.geotech.evaluate();
  for (const saved of Array.isArray(data.collapses) ? data.collapses : []) {
    const live = session.geotech.collapses.get(saved?.key);
    if (live && Number.isFinite(saved.remaining))
      live.remaining = Math.max(COLLAPSE_LOAD_GRACE, saved.remaining);
  }
  session.ventilation.evaluate();
  return { session, player: data.player };
}

/**
 * Migración V2 → V3: semilla fija, excavaciones conservadas sobre la nueva
 * geología, plata y cuarzo (retirados) liquidados a su precio V2, rieles en
 * bodega como suministro y pilas convertidas a lista de bloques.
 */
function migrateV2(data: SaveData, rev: number): Restored | null {
  if (
    !int(data.money) ||
    !int(data.railStock) ||
    !int(data.sold) ||
    !point(data.player) ||
    !Array.isArray(data.terrain) ||
    !Array.isArray(data.inventory) ||
    !Array.isArray(data.cart?.items)
  )
    return null;
  const seed = DEFAULT_SEED;
  const grid = createInitialTerrain(seed, rev);
  for (let r = 0; r < grid.rows; r++) {
    const row = data.terrain[r];
    if (!Array.isArray(row) || row.length !== LEGACY_COLUMNS) return null;
    for (let c = 0; c < LEGACY_COLUMNS; c++)
      if (
        row[c] === Block.Air &&
        grid.get(c, r) !== Block.Bedrock &&
        r >= surfaceRow(c)
      )
        grid.set(c, r, Block.Air);
  }
  const session = new GameSession(grid, seed);
  session.visibility.initialize(grid);
  let credit = 0;
  const keep = (items: string[], cap: number): Material[] | null => {
    const out: Material[] = [];
    for (const m of items) {
      if (Object.hasOwn(BALANCE.legacySale, m))
        credit += BALANCE.legacySale[m]!;
      else if (Object.hasOwn(BALANCE.sale, m)) out.push(m as Material);
      else return null;
    }
    return out.reduce((kg, m) => kg + MATERIAL_KG[m], 0) <= cap ? out : null;
  };
  const inventory = keep(data.inventory, BALANCE.personalCapacity);
  const cart = keep(data.cart.items, BALANCE.cartCapacity);
  if (!inventory || !cart) return null;
  // Herramientas: cualquier pala heredada pasa a ser la pala básica única.
  const tools = (Array.isArray(data.tools) ? data.tools : []).map(
    (t: { id: number; kind: string; durability: number }) => {
      const kind = /shovel|pala/i.test(t.kind) ? 'shovel' : t.kind;
      return {
        id: t.id,
        kind,
        durability: TOOL_KEYS.includes(kind as ToolKind)
          ? Math.min(t.durability, TOOLS[kind as ToolKind].durability)
          : t.durability,
      };
    },
  );
  if (!restoreTools(session, tools, data.equipped)) return null;
  if (!restoreRails(session, data.rails, data.cart.x)) return null;
  if (!restorePiles(session, data.piles)) return null;
  session.money = data.money + credit;
  session.supplies.rail = data.railStock;
  session.sold = data.sold;
  session.inventory.items.push(...inventory);
  session.cart.inventory.items.push(...cart);
  session.geotech.evaluate();
  session.ventilation.evaluate();
  return {
    session,
    player: data.player,
    migrated: credit
      ? `PARTIDA V2 MIGRADA. PLATA Y CUARZO LIQUIDADOS: +$${credit}`
      : 'PARTIDA V2 MIGRADA AL MUNDO V3',
  };
}

/** Conserva nivel y fracción de la barra antigua, sin pagar niveles previos. */
function restoreExperience(
  s: GameSession,
  total: number,
  legacy: boolean,
): void {
  if (!legacy) {
    s.progression.xp = total;
    s.progression.level = levelForXp(total);
    return;
  }
  const oldThreshold = (level: number) => 20 * (level - 1) * level;
  let level = 1;
  while (level < MAX_LEVEL && total >= oldThreshold(level + 1)) level++;
  const leftover = total - oldThreshold(level);
  s.progression.level = level;
  s.progression.xp =
    xpForLevel(level) +
    (level === MAX_LEVEL
      ? leftover
      : Math.floor(
          (leftover * xpToNext(level)) /
            (oldThreshold(level + 1) - oldThreshold(level)),
        ));
  s.markLegacyDeposits();
}

/**
 * Migración a V4 de una partida V2 o V3. Esas partidas ya trabajaban en la
 * mina sin EPP: se les entrega el conjunto básico equipado (sin cobrarlo)
 * para no dejarlas fuera, modo Normal y misión inicial cumplida. La
 * experiencia se estima con lo ya logrado (ventas, minerales y excavación),
 * y los objetos que no quepan en las casillas esperan sin perderse.
 */
function migrateToV4(restored: Restored): Restored {
  const s = restored.session;
  s.mode = 'normal';
  s.modeChosen = true;
  s.firstDayDone = true;
  for (const kind of REQUIRED_PPE)
    if (!s.loadout.equipped(kind)) s.loadout.addPPE(kind);
  const initial = pristineTerrain(s.seed, s.grid.worldRev);
  let dug = 0;
  for (let r = 0; r < s.grid.rows; r++)
    for (let c = s.grid.first; c < s.grid.end; c++)
      if (initial.isSolid(c, r) && !s.grid.isSolid(c, r)) dug++;
  s.stats.mined = dug;
  restoreExperience(
    s,
    Math.floor(s.progression.earned / 5) +
      dug * XP.block +
      s.progression.found.size * XP.discovery,
    true,
  );
  s.levelEvents.length = 0;
  s.loadout.sync();
  return {
    ...restored,
    migrated:
      (restored.migrated ? restored.migrated + '. ' : '') +
      'PARTIDA MIGRADA A V4: EPP BASICO ENTREGADO',
  };
}

const refOk = (s: GameSession, ref: unknown): ref is ItemRef => {
  const r = ref as ItemRef | null;
  if (!r || typeof r !== 'object') return false;
  if (r.type === 'tool') return s.tools.items.some((t) => t.id === r.id);
  if (r.type === 'supply') return SUPPLY_KEYS.includes(r.kind);
  if (r.type === 'ppe') return s.loadout.ppe.some((p) => p.id === r.id);
  return false;
};

/** Campos V4: modalidad, fin de expedición, experiencia e inventario. */
function applyV4(restored: Restored, v: SaveData | undefined): Restored | null {
  if (!v || typeof v !== 'object') return null;
  const s = restored.session;
  if (v.mode !== 'normal' && v.mode !== 'hardcore') return null;
  s.mode = v.mode;
  s.modeChosen = v.modeChosen === true;
  s.firstDayDone = v.firstDayDone === true;
  if (v.ended && typeof v.ended.cause === 'string') s.ended = v.ended;
  const st = v.stats ?? {};
  for (const k of ['playMs', 'mined', 'minerals', 'lastCollapseMs'] as const)
    s.stats[k] = int(st[k], 1e12) ? st[k] : 0;
  restoreExperience(s, int(v.xp) ? v.xp : 0, v.xpCurve !== XP_CURVE);
  for (const k of Array.isArray(v.rewarded) ? v.rewarded : [])
    if (typeof k === 'string') s.progression.rewarded.add(rewardKey(k));
  const l = s.loadout,
    lo = v.loadout ?? {};
  const ids = new Set<number>();
  l.ppe = [];
  for (const p of Array.isArray(lo.ppe) ? lo.ppe : []) {
    if (!int(p?.id) || ids.has(p.id) || !PPE_KEYS.includes(p.kind)) return null;
    ids.add(p.id);
    l.ppe.push({ id: p.id, kind: p.kind as PPEKind });
  }
  l.nextPpe = Math.max(
    int(lo.nextPpe) ? lo.nextPpe : 1,
    ...[...ids].map((i) => i + 1),
    1,
  );
  for (const slot of Object.keys(l.gear) as GearSlot[]) {
    const id = lo.gear?.[slot];
    const item = l.ppe.find((p) => p.id === id);
    // Un EPP solo puede estar en su ranura y en una sola.
    l.gear[slot] = item && PPE[item.kind].slot === slot ? item.id : null;
  }
  l.slots = Array(MAX_SLOTS).fill(null);
  (Array.isArray(lo.slots) ? lo.slots : []).forEach(
    (ref: unknown, i: number) => {
      if (i < MAX_SLOTS && refOk(s, ref)) l.slots[i] = ref;
    },
  );
  if (Array.isArray(lo.quickbar)) {
    // Las partidas anteriores guardaban tipos de herramienta y seis accesos.
    const readQuick = (raw: unknown): QuickRef | null => {
      const q = raw as (QuickRef | { type: 'tool'; kind: ToolKind }) | null;
      if (q?.type === 'supply' && SUPPLY_KEYS.includes(q.kind)) return q;
      if (q?.type !== 'tool') return null;
      if ('id' in q) return { type: 'tool', id: q.id };
      if (!TOOL_KEYS.includes(q.kind)) return null;
      const tool = [
        s.tools.current,
        s.tools.usable(q.kind),
        s.tools.items.find((t) => t.kind === q.kind),
      ].find((t) => t?.kind === q.kind);
      return tool ? { type: 'tool', id: tool.id } : null;
    };
    const seen = new Set<string>();
    for (let i = 0; i <= QUICKBAR_SIZE; i++) {
      const ref = readQuick(lo.quickbar[i]);
      if (!ref || !l.ownsQuick(ref)) continue;
      const key = ref.type === 'tool' ? `tool:${ref.id}` : `supply:${ref.kind}`;
      if (seen.has(key)) continue;
      const slot = i < QUICKBAR_SIZE ? i : l.quickbar.indexOf(null);
      if (slot < 0) break;
      l.quickbar[slot] = ref;
      seen.add(key);
    }
    if (int(lo.selectedQuick, QUICKBAR_SIZE - 1))
      l.selectedQuick = lo.selectedQuick;
  }
  l.sync();
  return restored;
}

/**
 * Migración a V5 (EPP básico gratuito). Política: quien ya tiene el EPP lo
 * conserva y su kit queda marcado como reclamado (no se puede pedir otro).
 * Las partidas V4 pagaron ese EPP en la bodega: reciben una compensación
 * única igual a su precio V4 (75 monedas por el conjunto completo). Las
 * V2/V3 lo recibieron gratis al migrar: sin compensación. Si falta alguna
 * pieza, el kit queda disponible para reclamarla gratis.
 */
/**
 * Migración a V8: el mundo se amplía sin mover nada de lo existente (el
 * terreno excavado, vías, carro y pilas conservan sus coordenadas). Energía
 * y alimentación empiezan completas; nada del progreso se pierde.
 */
function toV8(restored: Restored): Restored {
  const s = restored.session;
  s.survival.restore(null);
  s.inCabin = false;
  const note = 'MUNDO AMPLIADO: CAMPAMENTO AL OESTE, ENERGIA Y ALIMENTACION';
  return {
    ...restored,
    migrated: restored.migrated ? `${restored.migrated}. ${note}` : note,
  };
}

function toV5(restored: Restored, refund: boolean): Restored {
  const s = restored.session;
  const owned = REQUIRED_PPE.filter((k) =>
    s.loadout.ppe.some((p) => p.kind === k),
  );
  s.kitClaimed = owned.length === REQUIRED_PPE.length;
  const credit = refund
    ? owned.reduce((n, k) => n + (V4_PPE_PRICE[k] ?? 0), 0)
    : 0;
  s.money += credit;
  if (!credit) return restored;
  return {
    ...restored,
    migrated: `EPP AHORA GRATUITO: SE DEVUELVEN $${credit} PAGADOS EN V4`,
  };
}
