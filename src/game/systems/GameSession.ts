import { WarehouseStorage } from './WarehouseStorage';
import {
  BALANCE,
  BLOCK_WORK,
  SUPPLIES,
  SUPPLY_KEYS,
  TOOLS,
  materialOf,
  type Material,
  type SupplyKind,
  type ToolKind,
} from '../config/balance';
import {
  DAY_MS,
  LEVEL_REWARD,
  PPE,
  REQUIRED_PPE,
  XP,
  type PPEKind,
} from '../config/gear';
import {
  blockOfMaterial,
  isBuildMaterial,
  materialOfBlock,
  STACK_MAX,
  type BuildMaterial,
} from '../config/buildMaterials';
import { mineralInfo } from '../config/minerals';
import { TreeState } from '../world/Trees';
import { placementProblem, type Rect } from './BlockPlacement';
import { DEFAULT_MINE_NAME } from '../config/mineName';
import type { TopDownCabinSave } from '../config/topDownCabin';
import { DEFAULT_SEED, geologyOf, pristineTerrain } from '../world/Geology';
import {
  Block,
  mineralOf,
  type Cell,
  type Point,
  type TerrainGrid,
} from '../world/TerrainGrid';
import {
  GALLERY_LEVEL,
  galleryVisible,
  type TopDownGallery,
} from '../world/TopDownGallery';
import { BlastingSystem } from './BlastingSystem';
import { CartSystem } from './CartSystem';
import { CheatCodes } from './CheatCodes';
import { DeveloperCommands } from './DeveloperCommands';
import { RECOVERY, recoverSupply } from './DismantleSystem';
import { GALLERY_CARGO_LIMIT } from './GalleryRailway';
import type { GalleryAirSupply } from './GalleryVentilation';
import { supportKind, type GallerySupportSupply } from './GalleryStability';
import { GeotechnicalSystem } from './GeotechnicalSystem';
import { HEALTH, HealthSystem } from './HealthSystem';
import { DroneOrders } from './DroneOrders';
import { FallingBlocks } from './FallingBlocks';
import { FoodLedger, freshQty, shelfLifeMs } from './Freshness';
import { Fridge } from './Fridge';
import { InventorySystem } from './InventorySystem';
import { LoadoutSystem } from './LoadoutSystem';
import type { MiningSystem } from './MiningSystem';
import { PlacedLights } from './PlacedLights';
import { AchievementSystem, ProgressionSystem } from './ProgressionSystem';
import { RailSystem } from './RailSystem';
import { ExplorationProgress } from './ExplorationProgress';
import { RegionTracker } from './RegionTracker';
import { HeadlampBattery } from './HeadlampBattery';
import { IntroProgress } from './IntroProgress';
import { SUPPORT, SupportSystem } from './SupportSystem';
import { ToolSystem } from './ToolSystem';
import { VentilationSystem } from './VentilationSystem';
import { VisibilitySystem } from './VisibilitySystem';
import { DayNightCycle } from './DayNightCycle';
import {
  createExpeditionState,
  type ExpeditionState,
} from './Expeditions';
import { SurvivalSystem, type Activity } from './SurvivalSystem';
import {
  FOODS,
  isFood,
  isPerishable,
  PERISHABLE_KEYS,
  SURVIVAL,
  type FoodKind,
} from '../config/survival';

export interface LoosePile extends Point {
  id: number;
  /** Cada elemento es exactamente un bloque recuperable. */
  items: Material[];
}

/** Nivel de picota requerido por un bloque (0 = basta la pala). */
export function pickLevelFor(block: Block): number {
  const mineral = mineralOf(block);
  if (mineral) return mineralInfo(mineral).pick;
  if (block === Block.HardRock) return 2;
  if (block === Block.Dirt || block === Block.Rubble || block === Block.Wood)
    return 0;
  return 1;
}

export type BuyKind = ToolKind | SupplyKind | PPEKind | 'rescue' | 'kit';
export type GameMode = 'normal' | 'hardcore';

/** Resumen de una expedición terminada (Hardcore). */
export interface ExpeditionEnd {
  cause: string;
  days: number;
  mined: number;
  minerals: number;
  earned: number;
  money: number;
  deepestRow: number;
  workers: number;
  achievements: string[];
  endedAt: string;
}

/** Transacciones síncronas: comprobar todo antes de quitar, cobrar o desgastar. */
export class GameSession {
  gallery?: TopDownGallery;
  /** Estado de la expedición lateral activa; el perfil y el inventario siguen siendo únicos. */
  expedition?: ExpeditionState;
  readonly dayNight = new DayNightCycle();
  readonly developer: DeveloperCommands;
  money: number = BALANCE.initialMoney;
  readonly supplies = Object.fromEntries(
    SUPPLY_KEYS.map((k) => [k, 0]),
  ) as Record<SupplyKind, number>;
  readonly inventory = new InventorySystem(BALANCE.personalCapacity);
  readonly tools = new ToolSystem();
  readonly rails: RailSystem;
  readonly cart: CartSystem;
  readonly supports = new SupportSystem();
  readonly geotech: GeotechnicalSystem;
  readonly ventilation: VentilationSystem;
  readonly blasting: BlastingSystem;
  readonly visibility: VisibilitySystem;
  readonly lights = new PlacedLights();
  /**
   * V11: bloques colocados por el jugador (índice fila × columnas + columna).
   * Se retiran rápido y sin desgaste, y se guardan en la partida.
   */
  readonly placed = new Set<number>();
  /**
   * Bloques desprendidos por un derrumbe que aún están cayendo. Ya salieron
   * de la cuadrícula y vuelven a ella como escombro al asentarse.
   */
  readonly falling = new FallingBlocks();
  /** V11: árboles talados de la superficie (no reaparecen). */
  readonly trees = new TreeState();
  readonly health = new HealthSystem();
  /** V8: energía y alimentación. */
  readonly survival = new SurvivalSystem();
  /** V9: batería e interruptor de la linterna del casco. */
  readonly headlamp = new HeadlampBattery();
  /** Pedidos del celular entregados por dron y cajas en el suelo. */
  readonly drones = new DroneOrders();
  /** V8: el minero está dentro del pabellón del campamento. */
  inCabin = false;
  topDownCabin?: TopDownCabinSave;
  /** «La herencia del abuelo»: progreso del primer tutorial (`done` = sin él). */
  readonly intro = new IntroProgress();
  /** V10: progreso de la exploración subterránea (página de la cámara secreta). */
  readonly exploration = new ExplorationProgress();
  /** V9: región actual y biomas visitados. */
  readonly regions = new RegionTracker();
  readonly progression = new ProgressionSystem();
  /** Códigos de la partida (tecla |): dinero infinito y vuelo; apagan los logros. */
  readonly cheats = new CheatCodes();
  readonly achievements = new AchievementSystem(
    () => this.cheats.achievementsDisabled,
  );
  /** Inventario general, EPP equipado y barra rápida. */
  readonly loadout: LoadoutSystem;
  /** Modalidad fijada al crear la partida; no cambia a mitad de partida. */
  mode: GameMode = 'normal';
  modeChosen = false;
  /** Expedición Hardcore terminada: la partida no se puede reanudar. */
  ended: ExpeditionEnd | null = null;
  /** Misión inicial: equipar el EPP (kit gratuito de la bodega). */
  firstDayDone = false;
  /** El kit de seguridad gratuito se reclama una sola vez por partida. */
  kitClaimed = false;
  readonly warehouse = new WarehouseStorage();
  /** Vencimientos de los alimentos que lleva el minero (registro paralelo a `supplies`). */
  readonly food = new FoodLedger();
  /** Refrigerador de la cabaña: 10 casillas, caducidad detenida. */
  readonly fridge = new Fridge();
  /** Nombre que el jugador dio a la mina (letrero de la bocamina). */
  mineName: string = DEFAULT_MINE_NAME;
  /** Recuperación fraccionaria acumulada por tipo al desmontar (sin redondeos a favor). */
  readonly salvage: Partial<Record<SupplyKind, number>> = {};
  /** Estadísticas de la expedición. */
  stats = { playMs: 0, mined: 0, minerals: 0, lastCollapseMs: 0 };
  /** Subidas de nivel pendientes de anunciar (las consume la escena). */
  readonly levelEvents: { level: number; count: number }[] = [];
  xpFeedback = 0;
  private readonly oreDeposits = new Map<
    string,
    { mineral: keyof typeof XP.ore; reward: string }
  >();
  sold = 0;
  deaths = 0;
  piles: LoosePile[] = [
    { id: 1, x: 280, y: 153, items: Array<Material>(8).fill('dirt') },
  ];
  nextPile = 2;

  constructor(
    readonly grid: TerrainGrid,
    readonly seed: number = DEFAULT_SEED,
    developerMode = false,
  ) {
    this.rails = new RailSystem(grid);
    this.cart = new CartSystem(this.rails);
    this.loadout = new LoadoutSystem(this.tools, this.supplies);
    this.developer = new DeveloperCommands(developerMode);
    // Solo lo excavado por el jugador: la galería original de la bocamina
    // nace abierta y su entrada no puede generar derrumbes.
    const initial = pristineTerrain(seed, grid.worldRev);
    for (const deposit of geologyOf(seed, grid.worldRev).deposits) {
      const [col, row] = deposit.cells[0]!;
      for (const [x, y] of deposit.cells)
        this.oreDeposits.set(`${x},${y}`, {
          mineral: deposit.mineral,
          reward: `deposit:${col},${row}`,
        });
    }
    this.geotech = new GeotechnicalSystem(
      grid,
      this.supports,
      (c, r) => initial.isSolid(c, r),
      // El piso de una vía y el de la bodega están reforzados: no forman un
      // techo inestable ni se desprenden (un derrumbe no los destruye).
      (c, r) => this.protected({ column: c, row: r }),
    );
    this.ventilation = new VentilationSystem(grid);
    this.blasting = new BlastingSystem(grid, seed, (c) => this.protected(c));
    this.visibility = new VisibilitySystem(grid.columns, grid.rows, grid.first);
    this.visibility.initialize(grid);
    // Marcos originales de la galería de la bocamina.
    for (const column of [20, 23]) {
      const set = this.supports.install(grid, { column, row: 9 }, 'wood');
      if (set) set.fixed = true;
    }
    this.geotech.evaluate();
    this.ventilation.evaluate();
  }

  /** Atajo de compatibilidad: rieles en bodega. */
  get railStock(): number {
    return this.supplies.rail;
  }
  set railStock(value: number) {
    this.supplies.rail = value;
  }

  tierOf(kind: ToolKind | SupplyKind | PPEKind): number {
    return kind in TOOLS
      ? TOOLS[kind as ToolKind].tier
      : kind in PPE
        ? PPE[kind as PPEKind].tier
        : SUPPLIES[kind as SupplyKind].tier;
  }
  priceOf(kind: ToolKind | SupplyKind | PPEKind): number {
    return kind in TOOLS
      ? TOOLS[kind as ToolKind].price
      : kind in PPE
        ? PPE[kind as PPEKind].price
        : SUPPLIES[kind as SupplyKind].price;
  }

  /** Experiencia; key evita premiar dos veces. */
  gainXp(amount: number, key?: string): number {
    const xpBefore = this.progression.xp;
    const gained = this.progression.gainXp(amount, key);
    this.xpFeedback += this.progression.xp - xpBefore;
    if (gained) {
      this.money += gained * LEVEL_REWARD.gold;
      this.levelEvents.push({
        level: this.progression.level,
        count: gained,
      });
    }
    return gained;
  }

  /** Una extracción real y el primer bloque recuperado de cada yacimiento. */
  rewardExtraction(cell: Cell, mineral: keyof typeof XP.ore | null): void {
    const cellKey = `${cell.column},${cell.row}`;
    this.gainXp(mineral ? XP.ore[mineral] : XP.block, `block:${cellKey}`);
    if (!mineral) return;
    const deposit = this.oreDeposits.get(cellKey);
    if (deposit?.mineral === mineral) this.gainXp(XP.discovery, deposit.reward);
    this.progression.found.add(mineral);
  }

  /** Registra yacimientos ya trabajados antes de añadir el premio por depósito. */
  markLegacyDeposits(): void {
    for (const [key, deposit] of this.oreDeposits) {
      const [column, row] = key.split(',').map(Number) as [number, number];
      if (mineralOf(this.grid.get(column, row)) !== deposit.mineral)
        this.progression.rewarded.add(deposit.reward);
    }
  }

  buy(kind: BuyKind): string {
    if (kind === 'kit') return this.claimKit();
    if (kind === 'gloves' || kind === 'goggles') {
      if (
        this.loadout.ppe.some((item) => item.kind === kind) ||
        this.warehouse.stacks.some(
          (item) => item.type === 'ppe' && item.kind === kind,
        )
      )
        return 'YA TIENES ESTE EPP';
      if (!this.loadout.canAccept(kind))
        return 'INVENTARIO LLENO: LIBERA UNA CASILLA';
      this.loadout.addPPE(kind);
      return 'COMPRA REALIZADA';
    }
    if (kind in PPE && PPE[kind as PPEKind].price === 0)
      return this.kitClaimed
        ? 'EPP BASICO: YA LO RECIBISTE GRATIS EN TU KIT'
        : 'EL EPP BASICO ES GRATIS: RECLAMA TU KIT DE SEGURIDAD';
    if (kind === 'rescue')
      return this.rescue()
        ? 'KIT DE AUXILIO ENTREGADO'
        : 'AUN TIENES MEDIOS PARA CONTINUAR';
    const tier = this.tierOf(kind);
    if (!this.shopUnlocked(kind)) return `REQUIERE ETAPA ${tier}`;
    const price = this.priceOf(kind);
    if (!this.infiniteMoney && this.money < price) return 'SALDO INSUFICIENTE';
    // Nunca se pierde una compra: sin casilla libre no se cobra.
    if (!this.loadout.canAccept(kind))
      return 'INVENTARIO LLENO: LIBERA UNA CASILLA';
    if (!this.infiniteMoney) this.money -= price;
    if (kind in TOOLS) this.tools.add(kind as ToolKind);
    else if (kind in PPE) this.loadout.addPPE(kind as PPEKind);
    else this.addSupply(kind as SupplyKind);
    this.loadout.sync();
    return 'COMPRA REALIZADA';
  }

  /**
   * Suma unidades de un suministro. Los alimentos perecederos entran con su
   * vencimiento: `expiresAt` (tiempo de juego) o, sin él, vida útil completa
   * desde ahora.
   */
  addSupply(kind: SupplyKind, qty = 1, expiresAt?: number): void {
    if (isPerishable(kind)) this.syncFood();
    this.supplies[kind] += qty;
    if (isPerishable(kind))
      this.food.add(
        kind,
        qty,
        expiresAt ?? this.dayNight.totalMs + shelfLifeMs(kind),
      );
  }

  /** Tira los alimentos vencidos que lleva el minero; devuelve cuántas unidades. */
  discardExpiredFood(): number {
    this.syncFood();
    const now = this.dayNight.totalMs;
    let thrown = 0;
    for (const kind of PERISHABLE_KEYS) {
      const lots = this.food.lots(kind);
      const expired = lots
        .filter((l) => l.t <= now)
        .reduce((n, l) => n + l.qty, 0);
      if (!expired) continue;
      const fresh = lots.filter((l) => l.t > now);
      lots.length = 0;
      lots.push(...fresh);
      this.supplies[kind] -= expired;
      thrown += expired;
    }
    if (thrown) this.loadout.sync();
    return thrown;
  }

  /**
   * Hace coincidir los lotes de cada alimento con su cantidad real (otra
   * parte del código, o una partida anterior, pudo cambiarla): lo que falta
   * entra recién hecho y lo que sobra sale primero por lo que vence antes.
   */
  syncFood(): void {
    const now = this.dayNight.totalMs;
    for (const kind of PERISHABLE_KEYS)
      this.food.reconcile(kind, this.supplies[kind], now);
  }

  /** Dinero infinito por código de la partida o por la consola de desarrollo. */
  get infiniteMoney(): boolean {
    return this.cheats.infiniteMoney || this.developer.infiniteMoney;
  }

  /**
   * Código `desbloquear`: pasa a la última etapa tecnológica (las etapas
   * nunca retroceden). No da experiencia ni logros; si ya estaban todas, no
   * cambia nada ni cuenta como código usado.
   */
  unlockAllTiers(): { changed: boolean; message: string } {
    if (this.progression.tier === 3)
      return { changed: false, message: 'YA TIENES TODAS LAS ETAPAS' };
    const result = this.cheats.execute('desbloquear');
    this.progression.tier = 3;
    return { changed: true, message: result.message };
  }

  /** La tienda y la transacción consultan la misma regla de desbloqueo. */
  shopUnlocked(kind: ToolKind | SupplyKind | PPEKind): boolean {
    return (
      this.developer.fullStacks || this.progression.tier >= this.tierOf(kind)
    );
  }

  /** V8: esfuerzo físico completado (energía y algo de hambre). */
  effort(kind: keyof typeof SURVIVAL.effort): void {
    this.survival.exert(SURVIVAL.effort[kind]);
  }

  /** Jornada cenital: una sola actualización de reloj, actividad y salud. */
  tickTopDown(delta: number, now: number, activity: Activity): void {
    const dt = Math.min(delta, 100);
    this.stats.playMs += dt;
    this.dayNight.tick(dt);
    this.survival.tick(dt, activity);
    const damage = this.survival.takeDamage(true);
    this.health.damage(damage.agotamiento, now, 'agotamiento');
    this.health.damage(damage.hambre, now, 'hambre');
  }

  /**
   * V8: comer o beber una unidad del inventario. Nunca supera el máximo ni
   * gasta un alimento que no serviría.
   */
  eat(kind: FoodKind): { ok: boolean; message: string } {
    if (!isFood(kind) || this.supplies[kind] < 1)
      return { ok: false, message: 'NO TIENES ESE ALIMENTO' };
    // Los vencidos no se pueden consumir: hace falta al menos una unidad vigente.
    const now = this.dayNight.totalMs;
    if (isPerishable(kind)) {
      this.syncFood();
      if (freshQty(this.food.lots(kind), now) < 1)
        return {
          ok: false,
          message: 'VENCIDO: NO SE PUEDE CONSUMIR. DESCARTALO',
        };
    }
    const heal = FOODS[kind].heal;
    if (heal && this.health.hp >= HEALTH.max)
      return { ok: false, message: 'TU SALUD ESTA COMPLETA' };
    const reason = this.survival.canConsume(kind);
    if (reason) return { ok: false, message: reason };
    // Se gasta la unidad vigente que vence antes.
    if (isPerishable(kind)) this.food.eat(kind, now);
    this.supplies[kind]--;
    const got = this.survival.consume(kind);
    const before = this.health.hp;
    if (heal) this.health.heal(heal);
    this.loadout.sync();
    const units = (points: number) =>
      Math.round((points / SURVIVAL.unit) * 10) / 10;
    return {
      ok: true,
      message: heal
        ? `+${Math.round(((this.health.hp - before) / HEALTH.max) * 50) / 10} CORAZONES`
        : FOODS[kind].energy
          ? `+${units(got.energy)} ENERGIA`
          : `+${units(got.hunger)} ALIMENTACION`,
    };
  }

  /**
   * Agrega una unidad comprada o entregada al inventario, con las mismas
   * reglas que la bodega (una casilla por tipo de suministro; una herramienta
   * nueva se equipa). false si no cabe: nada cambia.
   */
  receive(kind: ToolKind | SupplyKind | PPEKind, expiresAt?: number): boolean {
    if (!this.loadout.canAccept(kind)) return false;
    if (kind in TOOLS) this.tools.add(kind as ToolKind);
    else if (kind in PPE) this.loadout.addPPE(kind as PPEKind);
    else this.addSupply(kind as SupplyKind, 1, expiresAt);
    this.loadout.sync();
    return true;
  }

  /**
   * V8: dormir en el pabellón. Avanza el reloj hasta la fase opuesta y
   * recupera la energía; no toca inventario, dinero, experiencia ni las
   * estadísticas de la expedición.
   */
  sleep(): { woke: 'day' | 'night'; skippedMs: number } {
    const skip = this.dayNight.skipToNextPhase();
    this.survival.sleep(skip.skippedMs, {
      playMs: Math.round(this.stats.playMs),
      clockMs: this.dayNight.elapsedMs,
      woke: skip.woke,
    });
    return skip;
  }

  /**
   * V9: interruptor manual de la linterna. El encendido automático al
   * entrar a la mina solo procede si el interruptor está en «on» y la
   * batería tiene carga.
   */
  toggleHeadlamp(): string {
    const lamp = this.headlamp;
    lamp.on = !lamp.on;
    if (!lamp.on) return 'LINTERNA APAGADA';
    return lamp.empty
      ? 'LINTERNA SIN BATERIA: CAMBIALA (B) O COMPRALA EN LA TIENDA'
      : 'LINTERNA ENCENDIDA';
  }

  /**
   * V9: cambio de batería. Consume exactamente un repuesto y restaura la
   * carga a 100 %. Sin repuestos, con la carga llena o durante un reemplazo
   * ya en curso no hace nada (sin dobles consumos).
   */
  replaceHeadlamp(): string {
    const lamp = this.headlamp;
    if (this.supplies.battery < 1)
      return 'NO TIENES BATERIAS DE REPUESTO. COMPRALAS EN LA TIENDA';
    if (lamp.charge >= 100) return 'TU BATERIA AUN ESTA CARGADA';
    this.supplies.battery--;
    lamp.replace();
    this.loadout.sync();
    return 'BATERIA REEMPLAZADA: CARGA 100%';
  }

  build(cell: Cell): boolean {
    if (this.supplies.rail < 1 || !this.rails.place(cell)) return false;
    this.spendRail(`rail:${cell.column}`);
    return true;
  }

  buildGalleryRail(cell: Cell): boolean {
    if (
      this.supplies.rail < 1 ||
      this.gallery?.stability.at(cell) ||
      this.gallery?.ventilation.fanAt(cell) ||
      !this.gallery?.railway.place(cell)
    )
      return false;
    this.spendRail(`gallery:${GALLERY_LEVEL}:rail:${cell.column},${cell.row}`);
    return true;
  }

  removeGalleryRail(cell: Cell): boolean {
    if (!this.gallery?.railway.remove(cell)) return false;
    recoverSupply(this, 'rail', RECOVERY.rail!);
    return true;
  }

  gallerySupportProblem(
    cell: Cell,
    kind: GallerySupportSupply,
    player: Point,
  ): string | null {
    const gallery = this.gallery;
    if (!gallery) return 'NO HAY GALERIA';
    if (!this.shopUnlocked(kind)) return `REQUIERE ETAPA ${this.tierOf(kind)}`;
    if (this.supplies[kind] < 1) return 'COMPRA VIGAS EN TIENDA';
    if (gallery.railway.has(cell) || gallery.railway.occupies(cell))
      return 'VIA O CARRITO EN LA CELDA';
    if (gallery.ventilation.fanAt(cell)) return 'HAY UN VENTILADOR EN LA CELDA';
    const type = supportKind(kind);
    return (
      gallery.stability.check(cell, type) ??
      (gallery.stability.clear(player, gallery.stability.plan(cell, type))
        ? null
        : 'DEJA LIBRES LOS POSTES')
    );
  }

  buildGallerySupport(
    cell: Cell,
    kind: GallerySupportSupply,
    player: Point,
  ): boolean {
    if (this.gallerySupportProblem(cell, kind, player) || !this.gallery)
      return false;
    const stability = this.gallery.stability;
    stability.install(stability.plan(cell, supportKind(kind)));
    this.supplies[kind]--;
    this.effort('build');
    this.loadout.sync();
    this.gainXp(
      XP.support,
      `gallery:${GALLERY_LEVEL}:support:${cell.column},${cell.row}`,
    );
    return true;
  }

  removeGallerySupport(cell: Cell): boolean {
    const support = this.gallery?.stability.remove(cell);
    if (!support) return false;
    const kind = support.kind === 'wood' ? 'wood_beam' : 'steel_beam';
    recoverSupply(
      this,
      kind,
      ((RECOVERY[kind] ?? 0) * support.durability) /
        SUPPORT[support.kind].durability,
    );
    return true;
  }

  galleryAirProblem(cell: Cell, kind: GalleryAirSupply): string | null {
    const gallery = this.gallery;
    if (!gallery) return 'NO HAY GALERIA';
    if (!this.shopUnlocked(kind)) return `REQUIERE ETAPA ${this.tierOf(kind)}`;
    if (this.supplies[kind] < 1) return 'COMPRA EQUIPOS EN TIENDA';
    if (
      kind !== 'duct' &&
      (gallery.stability.at(cell) ||
        gallery.railway.has(cell) ||
        gallery.railway.occupies(cell))
    )
      return 'DEJA LIBRE LA CELDA DEL VENTILADOR';
    return gallery.ventilation.check(cell, kind);
  }

  buildGalleryAir(cell: Cell, kind: GalleryAirSupply, aim: Point): boolean {
    if (
      this.galleryAirProblem(cell, kind) ||
      !this.gallery?.ventilation.install(cell, kind, aim)
    )
      return false;
    this.supplies[kind]--;
    this.effort('build');
    this.loadout.sync();
    return true;
  }

  removeGalleryAir(cell: Cell): boolean {
    const removed = this.gallery?.ventilation.remove(cell);
    if (!removed) return false;
    recoverSupply(
      this,
      removed.kind,
      (RECOVERY[removed.kind] ?? 0) * removed.condition,
    );
    return true;
  }

  private spendRail(reward: string): void {
    this.supplies.rail--;
    this.effort('build');
    this.loadout.sync();
    this.gainXp(XP.rail, reward);
  }

  /** Motivo por el que la herramienta actual no puede trabajar el bloque. */
  toolProblem(block: Block): string | null {
    const tool = this.tools.current;
    if (!tool) return 'COMPRA Y EQUIPA UNA HERRAMIENTA';
    if (tool.durability <= 0) return 'TU HERRAMIENTA SE HA ROTO';
    const def = TOOLS[tool.kind];
    if (def.type === 'drill') return null;
    if (def.type === 'axe')
      return block === Block.Wood
        ? null
        : 'EL HACHA SOLO CORTA MADERA. EQUIPA PICOTA O PALA';
    const need = pickLevelFor(block);
    if (def.type === 'shovel')
      return need === 0 ? null : 'LA PALA NO ROMPE ROCA. EQUIPA PICOTA';
    if (def.level < need) return 'REQUIERE PICOTA DE TUNGSTENO O SUPERIOR';
    return null;
  }

  /** Tiempo real de trabajo de la herramienta actual sobre un bloque. */
  workMs(cell: Cell, grid = this.grid): number {
    const tool = this.tools.current;
    if (!tool) return Infinity;
    const block = grid.get(cell.column, cell.row);
    let ms: number = TOOLS[tool.kind].workMs;
    if (TOOLS[tool.kind].type === 'drill')
      return Math.round(ms * this.progression.workTimeFactor);
    if (block === Block.HardRock) ms *= BLOCK_WORK.hardRock;
    if (block === Block.Rubble) ms *= BLOCK_WORK.rubble;
    if (grid === this.grid && this.blasting.isFractured(cell))
      ms *= BLOCK_WORK.fractured;
    if (grid === this.grid && this.isPlaced(cell)) ms *= BLOCK_WORK.placed;
    return Math.round(ms * this.progression.workTimeFactor);
  }

  /** ¿La celda guarda un bloque colocado por el jugador? */
  isPlaced(cell: Cell): boolean {
    return this.placed.has(this.grid.index(cell.column, cell.row));
  }

  /** Motivo por el que lo retirado no cabría (carga llena o pila al máximo). */
  storageProblem(block: Block): string | null {
    const material = materialOfBlock(block);
    if (material)
      return this.supplies[material] >= STACK_MAX
        ? `${SUPPLIES[material].label} AL MAXIMO (${STACK_MAX})`
        : null;
    return this.inventory.fits(materialOf(block))
      ? null
      : `CARGA LLENA - ${this.inventory.capacity}/${this.inventory.capacity} KG`;
  }

  /**
   * Suma material de construcción (tope STACK_MAX) y le asegura un acceso en
   * la barra rápida. Devuelve cuántas unidades entraron.
   */
  addMaterial(kind: BuildMaterial, amount = 1): number {
    const n = Math.max(
      0,
      Math.min(Math.floor(amount), STACK_MAX - this.supplies[kind]),
    );
    if (!n) return 0;
    this.supplies[kind] += n;
    const quick = this.loadout.quickbar;
    if (!quick.some((q) => q?.type === 'supply' && q.kind === kind)) {
      const free = quick.indexOf(null);
      if (free >= 0) quick[free] = { type: 'supply', kind };
    }
    this.loadout.sync();
    return n;
  }

  /**
   * Coloca un bloque del material en la celda. Devuelve el motivo del rechazo
   * o `null` si lo colocó (consume exactamente una unidad).
   */
  placeBlock(
    cell: Cell,
    kind: BuildMaterial,
    origin: Point,
    blockers: readonly Rect[],
  ): string | null {
    if (!isBuildMaterial(kind)) return 'OBJETO NO COLOCABLE';
    if (this.supplies[kind] < 1) return `SIN ${SUPPLIES[kind].label}`;
    const problem = placementProblem(this, cell, origin, blockers);
    if (problem) return problem;
    this.supplies[kind]--;
    this.grid.set(cell.column, cell.row, blockOfMaterial(kind));
    this.placed.add(this.grid.index(cell.column, cell.row));
    this.visibility.reveal(cell.column, cell.row);
    this.effort('place');
    this.afterTerrainChange([cell]);
    this.loadout.sync();
    return null;
  }

  mine(mining: MiningSystem, origin: Point, cell: Cell): boolean {
    const tool = this.tools.current;
    const block = this.grid.get(cell.column, cell.row);
    if (
      !tool ||
      TOOLS[tool.kind].type === 'drill' ||
      this.storageProblem(block) ||
      this.protected(cell) ||
      this.toolProblem(block)
    )
      return false;
    const placedByPlayer = this.isPlaced(cell);
    if (mining.dig(origin, cell) !== 'ready') return false;
    this.placed.delete(this.grid.index(cell.column, cell.row));
    this.collectBlock(block);
    if (placedByPlayer) this.effort('place');
    else {
      // Lo construido se desarma sin desgaste, experiencia ni estadísticas
      // (no se puede cosechar XP colocando y retirando el mismo bloque).
      this.tools.wear(tool);
      this.effort(TOOLS[tool.kind].type === 'shovel' ? 'shovel' : 'pick');
    }
    this.afterTerrainChange([cell]);
    this.visibility.reveal(cell.column, cell.row);
    if (placedByPlayer) return true;
    this.stats.mined++;
    const mineral = mineralOf(block);
    if (mineral) this.stats.minerals++;
    this.rewardExtraction(cell, mineral);
    return true;
  }

  /**
   * Extracción de un mundo de expedición. Reutiliza herramientas, capacidad,
   * inventario y experiencia del perfil, pero no mezcla su cuadrícula con la
   * geología, sostenimiento ni visibilidad del mundo principal.
   */
  mineExpedition(
    mining: MiningSystem,
    grid: TerrainGrid,
    origin: Point,
    cell: Cell,
  ): boolean {
    const tool = this.tools.current;
    const block = grid.get(cell.column, cell.row);
    if (
      !tool ||
      TOOLS[tool.kind].type === 'drill' ||
      this.storageProblem(block) ||
      this.toolProblem(block)
    )
      return false;
    if (mining.dig(origin, cell) !== 'ready') return false;
    this.collectBlock(block);
    this.tools.wear(tool);
    this.effort(TOOLS[tool.kind].type === 'shovel' ? 'shovel' : 'pick');
    this.stats.mined++;
    const mineral = mineralOf(block);
    if (mineral) {
      this.stats.minerals++;
      this.progression.found.add(mineral);
    }
    const id = this.expedition?.id ?? 'unknown';
    this.gainXp(
      mineral ? XP.ore[mineral] : XP.block,
      `expedition:${id}:${grid.index(cell.column, cell.row)}`,
    );
    return true;
  }

  /** Crea una única expedición activa por partida; futuras regiones agregan otro id. */
  beginExpedition(): ExpeditionState {
    const expedition = this.expedition ?? createExpeditionState(this.seed);
    expedition.active = true;
    this.expedition = expedition;
    return expedition;
  }

  private collectBlock(block: Block): void {
    const material = materialOfBlock(block);
    if (material) this.addMaterial(material);
    else this.inventory.add(materialOf(block));
  }

  galleryProblem(block: Block, limitBlocks = true): string | null {
    const tool = this.tools.current;
    if (!this.loadout.complete)
      return 'EQUIPA TU EPP COMPLETO. KIT GRATIS EN BODEGA';
    if (
      !tool ||
      (TOOLS[tool.kind].type !== 'pick' &&
        (block !== Block.Rubble || TOOLS[tool.kind].type !== 'shovel'))
    )
      return block === Block.Rubble
        ? 'EQUIPA PALA O PICOTA'
        : 'EQUIPA UNA PICOTA';
    if (block === Block.Rubble) return this.toolProblem(block);
    const full =
      limitBlocks && !materialOfBlock(block) &&
      this.inventory.items.length >= GALLERY_CARGO_LIMIT;
    return (
      this.toolProblem(block) ??
      (full
        ? `CARGA LLENA (${GALLERY_CARGO_LIMIT} BLOQUES). USA EL CARRITO`
        : this.storageProblem(block))
    );
  }

  mineGallery(origin: Point, cell: Cell, limitBlocks = true): boolean {
    const gallery = this.gallery;
    if (!gallery) return false;
    const { column, row } = cell;
    const block = gallery.grid.get(column, row);
    if (
      !galleryVisible(gallery.grid, origin, cell) ||
      this.galleryProblem(block, limitBlocks)
    )
      return false;
    if (gallery.mining.dig(origin, cell) !== 'ready') return false;
    gallery.ventilation.evaluate();
    gallery.visibility.reveal(column, row);
    this.tools.wear();
    this.effort(
      this.tools.current && TOOLS[this.tools.current.kind].type === 'shovel'
        ? 'shovel'
        : 'pick',
    );
    if (block === Block.Rubble) {
      gallery.stability.clearRubble(cell);
      return true;
    }
    gallery.dug.add(row * gallery.grid.columns + column);
    gallery.stability.refresh([cell]);
    this.collectBlock(block);
    this.stats.mined++;
    const mineral = mineralOf(block);
    const prefix = `gallery:${GALLERY_LEVEL}`;
    this.gainXp(
      mineral ? XP.ore[mineral] : XP.block,
      `${prefix}:block:${column},${row}`,
    );
    if (mineral) {
      this.stats.minerals++;
      this.progression.found.add(mineral);
      const deposit = gallery.deposit(column, row);
      if (deposit >= 0)
        this.gainXp(XP.discovery, `${prefix}:deposit:${deposit}`);
    }
    return true;
  }

  /** Mantiene coherentes los sistemas que dependen del terreno. */
  afterTerrainChange(cells: Cell[]): void {
    for (const c of cells) {
      this.blasting.forget(c);
      const key = this.grid.index(c.column, c.row);
      // Un bloque colocado que desapareció (tronadura) o se convirtió en
      // escombro deja de contar como construido.
      if (this.placed.has(key)) {
        const b = this.grid.get(c.column, c.row);
        if (b !== Block.Dirt && b !== Block.Rock && b !== Block.Wood)
          this.placed.delete(key);
      }
    }
    this.supports.refresh(this.grid);
    this.lights.prune(this.grid);
    this.ventilation.prune();
    this.geotech.evaluate();
    this.ventilation.evaluate();
  }

  protected(cell: Cell): boolean {
    return (
      this.rails.protects(cell) ||
      (cell.row === 10 && cell.column >= 3 && cell.column <= 12)
    );
  }

  /** Material suelto: una pila nueva o la existente en el mismo lugar. */
  drop(x: number, y: number, items: Material[]): LoosePile | null {
    if (!items.length) return null;
    const near = this.piles.find(
      (p) => Math.abs(p.x - x) < 10 && Math.abs(p.y - y) < 10,
    );
    if (near) {
      near.items.push(...items);
      return near;
    }
    const pile = { id: this.nextPile++, x, y, items: [...items] };
    this.piles.push(pile);
    return pile;
  }

  load(pileId?: number): boolean {
    const tool = this.tools.current;
    if (
      tool?.kind !== 'shovel' ||
      tool.durability <= 0 ||
      this.cart.inventory.full
    )
      return false;
    const pile = this.piles.find((p) => p.id === pileId && p.items.length);
    if (pileId !== undefined) {
      if (!pile) return false;
      this.cart.inventory.add(pile.items.pop()!);
    } else if (!this.inventory.transferTo(this.cart.inventory, 1)) return false;
    this.tools.wear(tool);
    this.effort('shovel');
    return true;
  }

  collectPile(id: number): boolean {
    const tool = this.tools.current,
      pile = this.piles.find((p) => p.id === id);
    if (
      tool?.kind !== 'shovel' ||
      tool.durability <= 0 ||
      !pile?.items.length ||
      this.inventory.full
    )
      return false;
    this.inventory.add(pile.items.pop()!);
    this.tools.wear(tool);
    this.effort('shovel');
    return true;
  }

  /** La carga descargada en la galería sigue disponible aunque cambie la vista. */
  private cargoForSale(includeCart: boolean): Material[][] {
    const cargo = [this.inventory.items];
    if (includeCart) cargo.push(this.cart.inventory.items);
    if (this.gallery) cargo.push(this.gallery.railway.delivered);
    return cargo;
  }

  quoteCargo(includeCart: boolean): number {
    return this.cargoForSale(includeCart)
      .flat()
      .reduce((sum, item) => sum + BALANCE.sale[item], 0);
  }

  sellCargo(includeCart: boolean, save: () => boolean): number | string {
    const cargo = this.cargoForSale(includeCart);
    const previousCargo = cargo.map((items) => [...items]);
    if (!previousCargo.some((items) => items.length)) return 0;
    const { money, sold, xpFeedback } = this;
    const { earned, xp, level } = this.progression;
    const events = this.levelEvents.length;
    const payment = this.creditSale(cargo.flatMap((items) => items.splice(0)));
    if (save()) return payment;
    cargo.forEach((items, index) => items.push(...previousCargo[index]!));
    Object.assign(this, { money, sold, xpFeedback });
    Object.assign(this.progression, { earned, xp, level });
    this.levelEvents.length = events;
    return 'ERROR AL GUARDAR LA VENTA';
  }

  private creditSale(items: Material[]): number {
    const money = items.reduce((n, m) => n + BALANCE.sale[m], 0);
    this.money += money;
    this.sold += items.length;
    this.progression.earned += money;
    this.gainXp(Math.floor(money / 5) * XP.salePer5);
    return money;
  }

  /** Auxilio de bodega: reemplazos finitos, únicamente cuando falta un kit viable. */
  rescue(): boolean {
    let given = false;
    if (!this.tools.hasPick() && this.money < TOOLS.iron.price) {
      this.tools.add('iron');
      given = true;
    }
    if (!this.tools.usable('shovel') && this.money < TOOLS.shovel.price) {
      this.tools.add('shovel');
      given = true;
    }
    this.loadout.sync();
    return given;
  }

  /**
   * Muerte en modo Normal: reaparece en superficie, pierde los bloques que
   * transportaba y el 10 % del dinero. Conserva nivel, herramientas, EPP,
   * tecnologías, terreno, vías y carro (los daños de la mina permanecen).
   */
  die(): { money: number; items: number } {
    const money = Math.floor(this.money * BALANCE.death.moneyFraction);
    this.money -= money;
    const lost = Math.max(
      0,
      this.inventory.items.length - BALANCE.death.keepItems,
    );
    this.inventory.items.splice(BALANCE.death.keepItems);
    this.deaths++;
    this.health.revive();
    // V8: reaparece con fuerzas mínimas (2/5) para no morir en bucle.
    const floor = SURVIVAL.unit * 2;
    this.survival.energy = Math.max(this.survival.energy, floor);
    this.survival.hunger = Math.max(this.survival.hunger, floor);
    this.survival.starvingMs = 0;
    this.survival.takeDamage();
    return { money, items: lost };
  }

  /**
   * Kit de seguridad gratuito: entrega el EPP básico que falte, equipado en
   * sus ranuras (no ocupa casillas). Una sola vez por partida y sin duplicar:
   * solo se agregan piezas ausentes.
   */
  claimKit(): string {
    if (this.kitClaimed) return 'YA RECLAMASTE TU KIT DE SEGURIDAD';
    let given = 0;
    for (const kind of REQUIRED_PPE)
      if (!this.loadout.ppe.some((p) => p.kind === kind)) {
        const item = this.loadout.addPPE(kind);
        this.loadout.gear[PPE[kind].slot] = item.id;
        given++;
      }
    this.kitClaimed = true;
    this.loadout.sync();
    return given
      ? 'KIT DE SEGURIDAD ENTREGADO Y EQUIPADO'
      : 'YA TIENES TODO TU EPP';
  }

  /** Jornadas de juego transcurridas (desde 1). */
  get days(): number {
    return Math.floor(this.stats.playMs / DAY_MS) + 1;
  }

  /** Muerte en Hardcore: la expedición termina y no se puede reanudar. */
  endExpedition(cause: string): ExpeditionEnd {
    this.ended = {
      cause,
      days: this.days,
      mined: this.stats.mined,
      minerals: this.stats.minerals,
      earned: this.progression.earned,
      money: this.money,
      deepestRow: this.progression.deepestRow,
      workers: 0,
      achievements: [...this.achievements.unlocked],
      endedAt: new Date().toISOString(),
    };
    return this.ended;
  }
}
