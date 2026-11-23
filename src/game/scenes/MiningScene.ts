import { showDeath } from './DeathScene';
import { PauseScene, type PauseVisit } from './PauseScene';
import { WarehousePanel } from '../ui/WarehousePanel';
import Phaser from 'phaser';
import {
  PLAYER,
  SPAWN,
  TILE_SIZE,
  VIEW,
  WORLD,
  WORLD_LEFT,
  WORLD_WIDTH,
} from '../config/constants';
import { FOODS, isFood, SURVIVAL, type FoodKind } from '../config/survival';
import { ACTION_AUDIO_KEYS, type StepSurface } from '../config/actionAudio';
import {
  CartRollingAudio,
  FootstepAudio,
  playFoodSound,
} from '../systems/ActionAudio';
import { CabinInterior } from '../ui/CabinInterior';
import { BiomeBackdrop } from '../world/BiomeBackdrop';
import { BiomeAmbience } from '../world/BiomeAmbience';
import { createLandmarks, type LandmarkSpot } from '../world/Landmarks';
import { GroundShadowView } from '../world/GroundShadowView';
import { Critters } from '../world/Critters';
import { biomeAtX, biomeDef } from '../config/biomes';
import { WorldAudio } from '../systems/WorldAudio';
import { CAMP_LAYOUT, CampSite } from '../world/structures/Camp';
import type { CampVisit } from '../config/topDownCamp';
import { CABIN_DOOR } from '../config/topDownCabin';
import { CabinSite } from '../world/structures/Cabin';
import {
  BALANCE,
  MATERIAL_LABEL,
  SUPPLIES,
  SUPPLY_KEYS,
  TOOLS,
  materialOf,
  type SupplyKind,
} from '../config/balance';
import { CART } from '../config/cart';
import { DEPTH } from '../config/layers';
import {
  DAY_MS,
  ENGINEER_DAYS,
  ENGINEER_SUPPORTS,
  PPE_EFFECT,
  XP,
  type PPEKind,
} from '../config/gear';
import { mineralInfo } from '../config/minerals';
import { PALETTE as P } from '../config/palette';
import { Miner } from '../entities/Miner';
import { GnomeBoss } from '../entities/GnomeBoss';
import {
  AttackTimer,
  GNOME,
  STRIKE_FEEL,
  canHitGnome,
  weaponDamage,
} from '../systems/Combat';
import { GNOME_AI } from '../config/gnomeAI';
import { strikeConnects } from '../systems/GnomeSenses';
import { MinerGear } from '../entities/MinerGear';
import { baseOf, ensureLook, lookMask, skinOf } from '../entities/MinerLook';
import { solidLength } from '../lighting/LightOcclusion';
import { missingAssets, queueAssets } from '../systems/AssetLoader';
import { wrapText } from '../ui/DialogBox';
import { BLAST, type Charge } from '../systems/BlastingSystem';
import {
  applyDismantle,
  planDismantle,
  structureAt,
  type DismantlePlan,
} from '../systems/DismantleSystem';
import { HEADLAMP_ALIAS, loadControls } from '../config/controls';
import {
  BUILD_MATERIALS,
  isBuildMaterial,
  materialOfBlock,
  STACK_MAX,
  TREE,
  type BuildMaterial,
} from '../config/buildMaterials';
import { placementProblem, type Rect } from '../systems/BlockPlacement';
import { TreeView } from '../world/TreeView';
import {
  TREE_COLUMNS,
  treeBounds,
  treeGround,
  treeTrunk,
} from '../world/Trees';
import { DEVELOPER_MODE, DEVELOPER_SAVE_KEY } from '../config/developer';
import { nameChar } from '../config/mineName';
import { DigEffects } from '../systems/DigEffects';
import { GameSession } from '../systems/GameSession';
import {
  shockZone,
  StabilityState,
  type Span,
} from '../systems/GeotechnicalSystem';
import { HEALTH } from '../systems/HealthSystem';
import { InteractionSystem } from '../systems/InteractionSystem';
import { LightingSystem } from '../systems/LightingSystem';
import { MiningSystem } from '../systems/MiningSystem';
import {
  ACHIEVEMENTS,
  TIERS,
  type AchievementId,
} from '../systems/ProgressionSystem';
import { railTop } from '../systems/RailSystem';
import {
  decodeSave,
  encodeSave,
  LEGACY_SAVE_KEY,
  SAVE_KEY,
  V3_SAVE_KEY,
  V4_SAVE_KEY,
  V5_SAVE_KEY,
} from '../systems/SaveSystem';
import {
  AirState,
  airStateOf,
  VENTILATION,
} from '../systems/VentilationSystem';
import { WorkSystem } from '../systems/WorkSystem';
import { InventoryPanel } from '../ui/InventoryPanel';
import { PhoneView } from '../ui/PhoneView';
import { FridgePanel } from '../ui/FridgePanel';
import { DroneView } from '../world/DroneView';
import { DroneBoxPanel } from '../ui/DroneBoxPanel';
import type { PhoneOrder } from '../systems/PhoneCart';
import { LevelUpEffect } from '../ui/LevelUpEffect';
import { DeveloperConsole } from '../ui/DeveloperConsole';
import { OperationsHUD } from '../ui/OperationsHUD';
import { SafetyScreens } from '../ui/SafetyScreens';
import {
  CABIN_NOTES,
  INTRO_DIALOGS,
  INTRO_TARGETS,
  introEnabled,
  type DialogPage,
  type IntroStep,
} from '../config/intro';
import { BookView } from '../ui/BookView';
import { DialogBox } from '../ui/DialogBox';
import { IntroGuide } from '../ui/IntroGuide';
import { arriveInMode, MINE_MODE, type MineVisit } from '../systems/MineModes';
import { EXPEDITION_SCENE } from '../systems/Expeditions';
import { crossFog, revealFromFog } from '../systems/FogTransit';
import { FogPortal } from '../ui/FogPortal';
import { createPixelFont, pixelText } from '../ui/PixelFont';
import {
  cellNoise,
  createInitialTerrain,
  freshSeed,
  geologyOf,
  pristineTerrain,
  WORLD_REV_ENTRANCE_10,
  WORLD_REV_EXPLORE,
} from '../world/Geology';
import { FALL, impactDamage } from '../systems/FallingBlocks';
import { FallingBlocksView } from '../world/FallingBlocksView';
import { TORN_PAGE, worldRevDefault } from '../config/explore';
import { CrystalMotes } from '../ui/CrystalMotes';
import { LogisticsView } from '../world/LogisticsView';
import { OperationsView } from '../world/OperationsView';
import {
  createPlaceholderTextures,
  drawPlaceholderWorld,
} from '../world/PlaceholderArt';
import { Scenery } from '../world/Scenery';
import type { DesertBackdrop } from '../world/Backdrop';
import { NightTint } from '../systems/NightTint';
import { mountAssetLayers } from '../world/SceneLayers';
import { createV3Art } from '../world/structures/V3Art';
import {
  Block,
  mineralOf,
  surfaceRow,
  TerrainGrid,
  TUNNEL,
  type Cell,
  type Point,
} from '../world/TerrainGrid';
import { TerrainView } from '../world/TerrainView';
import { TerrainFrame } from '../world/TerrainVisuals';

/** Nombre de un bloque: material de construcción o, si no, mineral. */
const blockLabel = (block: Block): string => {
  const material = materialOfBlock(block);
  return material
    ? SUPPLIES[material].label
    : MATERIAL_LABEL[materialOf(block)];
};

interface LoadingAction {
  x: number;
  y: number;
  toolId: number;
  pileId?: number;
  toCart: boolean;
  cartX: number;
}

/** Suministros que se instalan o usan con el clic derecho (Q los recorre). */
/** Objetos que se instalan con clic derecho (los rieles también, o con Z). */
const PLACEABLE: SupplyKind[] = SUPPLY_KEYS.filter(
  // La batería del casco no se instala en celdas: se cambia con B o Usar.
  (k) => k !== 'fuse' && k !== 'battery' && !isFood(k),
);
/** Teclas 1 a 9 de la barra rápida (una por casilla). */
const QUICK_KEYS = [
  'ONE',
  'TWO',
  'THREE',
  'FOUR',
  'FIVE',
  'SIX',
  'SEVEN',
  'EIGHT',
  'NINE',
] as const;
/** Cajón de herramientas de la bodega (pieza `wh_toolbox`, x 83..97). */
const WAREHOUSE_X = 106;
const TOOLBOX_X = 90;
/** Boca del túnel (columna 18 de la galería). */
const MINE_ENTRANCE_X = TUNNEL.fromColumn * TILE_SIZE;
/** Fondo de la galería lateral: no bloquea al minero, solo inicia la expedición. */
const TRANSITION_PORTAL_X = (TUNNEL.toColumn + 0.5) * TILE_SIZE;

export class MiningScene extends Phaser.Scene {
  private footsteps!: FootstepAudio;
  private cartAudio!: CartRollingAudio;
  private worldAudio!: WorldAudio;
  miner!: Miner;
  terrain!: TerrainView;
  mining!: MiningSystem;
  scenery!: Scenery;
  effects!: DigEffects;
  gear!: MinerGear;
  session!: GameSession;
  interactions!: InteractionSystem;
  hud!: OperationsHUD;
  lighting!: LightingSystem;
  ops!: OperationsView;
  work = new WorkSystem();
  loading: LoadingAction | null = null;
  buildCell: Cell | null = null;
  private frameMs = 0;
  private logistics!: LogisticsView;
  private selection!: Phaser.GameObjects.Graphics;
  private crack!: Phaser.GameObjects.Image;
  private progressLabel!: Phaser.GameObjects.BitmapText;
  private drillTool!: Phaser.GameObjects.Image;
  private levelUp!: LevelUpEffect;
  private quickSupply: SupplyKind | null = null;
  /** V11: árboles dibujados y ritmo de hachazos (ms de escena del último golpe). */
  treeView!: TreeView;
  private lastChop = 0;
  private chopTree = -1;
  private lastBuildWarning = '';
  private lastBuildAt = 0;
  /** Derrumbes: bloques que caen, tramos en curso y escombro ya asentado. */
  fallingView!: FallingBlocksView;
  private collapsing: Span[] = [];
  private settledCells: Cell[] = [];
  private lastThudAt = 0;
  /** Eventos de teclado ya contados (un toque = una pulsación). */
  private readonly countedKeys = new WeakSet<KeyboardEvent>();
  private saveTimer: Phaser.Time.TimerEvent | null = null;
  private readonly pressed = new Set<string>();
  /** Pulsaciones por tecla en el cuadro: dos toques rápidos no se pierden. */
  /** Controles configurables (Tab, X, V por defecto). */
  private controls = loadControls();
  /** Modo desmontar estructuras y plan pendiente de confirmación. */
  dismantleMode = false;
  private pendingPlan: DismantlePlan | null = null;
  private dismantleLabel!: Phaser.GameObjects.BitmapText;
  private wrenchCursor!: Phaser.GameObjects.Image;
  private leftClick = false;
  private lastClock = 0;
  private lastImpact = -1;
  private lastSave = 0;
  private pushSide = -1;
  private ignorePointer = false;
  private lastWarning = '';
  private hidden = false;
  /** Tinte parejo de la hora sobre el mundo exterior (sin trama). */
  private nightTint!: NightTint;
  /** Fondo vivo del Atacama (cielo, astros, nubes, aves, polvo). */
  get backdrop(): DesertBackdrop | undefined {
    return this.registry.get('desert-backdrop') as DesertBackdrop | undefined;
  }
  private rightClick = false;
  private second = 0;
  private exposure = 0;
  private lastGrounded = 0;
  private hazardFxAt = 0;
  /** V8: campamento, suelo propio, interior del pabellón y avisos. */
  camp!: CampSite;
  /** Rediseño 11-11-2026: cabaña minera animada que sustituye al pabellón. */
  cabinSite!: CabinSite;
  /**
   * Suelo de todo el mundo. Desde el mundo abierto es la cuadrícula de la
   * partida, del borde oeste al este (antes el campamento y la Mano del
   * Desierto tenían un suelo fijo aparte).
   */
  get worldGround(): TerrainGrid {
    return this.session.grid;
  }
  /** Fondo de las zonas (cordilleras o costa) y su cruce por cámara. */
  biomeBackdrop!: BiomeBackdrop;
  /** Monumentos de Antofagasta en el plano tras el suelo (diagnóstico). */
  landmarks: LandmarkSpot[] = [];
  /** Sombra de contacto del minero sobre el suelo real. */
  groundShadow!: GroundShadowView;
  /** Chinchillas del desierto (decoración en movimiento, sin interacción). */
  critters!: Critters;
  /** V9: partículas de ambiente propias de cada bioma. */
  biomeAmbience!: BiomeAmbience;
  cabin!: CabinInterior;
  warehouse!: WarehousePanel;
  private lastUnits = { energy: 5, hunger: 5 };
  private survivalNoticeAt = 0;
  private hurtNoticeAt = 0;
  private eating: {
    kind: FoodKind;
    until: number;
    image: Phaser.GameObjects.Image;
  } | null = null;
  inventory!: InventoryPanel;
  /** Celular (U): tienda minera con carrito; los pedidos esperan a los drones. */
  phone!: PhoneView;
  /** Refrigerador de la cabaña (interfaz tipo cofre; caducidad detenida adentro). */
  fridge!: FridgePanel;
  /** Dron de reparto, cajas en el suelo, indicador y cuenta regresiva. */
  droneView!: DroneView;
  droneBox!: DroneBoxPanel;
  safety!: SafetyScreens;
  /** «La herencia del abuelo»: diálogo omitible, libro y guía de objetivos. */
  dialog!: DialogBox;
  book!: BookView;
  private guide!: IntroGuide;
  /** V10: partículas de los cristales violeta y celda de la página secreta. */
  private crystalMotes!: CrystalMotes;
  private pageCell: Cell | null = null;
  private pageArt: Phaser.GameObjects.Graphics | null = null;
  /** Hasta cuándo se ignora E tras cerrar un diálogo o el libro (ms de escena). */
  private interactLockUntil = 0;
  private readonly introOn = introEnabled(
    import.meta.env.DEV,
    navigator.webdriver === true,
    window.location.search,
  );
  /** Consola de la tecla | (códigos; en desarrollo, también sus comandos). */
  developerConsole?: DeveloperConsole;
  /** Evento secreto ya visto en esta sesión con los logros desactivados. */
  private alienSeen = false;
  private gnome: GnomeBoss | null = null;
  /** Cadencia del golpe (J) con pulsación guardada. */
  private readonly attackTimer = new AttackTimer();
  private attackFacing: -1 | 1 = 1;
  private readonly saveKey = DEVELOPER_MODE ? DEVELOPER_SAVE_KEY : SAVE_KEY;
  /** Última posición segura en superficie (para el control de acceso). */
  private lastSafe: { x: number; y: number } = { x: SPAWN.x, y: SPAWN.y };
  private wasInMine = false;
  /** Crear una mina nueva al reiniciar la escena (tras fin de expedición). */
  static pendingNew = false;

  /** Intentos seguidos de cargar recursos que fallaron (se reinicia al lograrlo). */
  static loadAttempts = 0;
  /** El mundo está construido: hasta entonces `update` no hace nada. */
  private ready = false;
  private campVisit?: CampVisit;
  private deathPending = false;
  private fresh = false;
  private mineVisit?: MineVisit;
  private portalLabel!: Phaser.GameObjects.BitmapText;
  private transitionPortal!: FogPortal;
  private recovery?: { session: GameSession; clock: number };

  constructor() {
    super('MiningScene');
  }
  init(data?: {
    mineVisit?: MineVisit;
    campVisit?: CampVisit;
    fresh?: boolean;
    recovery?: { session: GameSession; clock: number };
  }): void {
    this.mineVisit = data?.mineVisit;
    this.campVisit = data?.campVisit;
    this.fresh = data?.fresh ?? false;
    this.recovery = data?.recovery;
    this.deathPending = false;
    if (new URLSearchParams(location.search).get('view') === 'top-down')
      document.querySelector<HTMLButtonElement>('#restart')!.textContent =
        'Volver al campamento';
  }

  /**
   * Menú de pausa (Esc): la escena se detiene (mundo, reloj y física quietos)
   * y PauseScene se abre encima. Al reanudar se sueltan las teclas que
   * quedaron presionadas, para que el minero no siga caminando solo.
   */
  private openPause(): void {
    this.pressed.clear();
    this.cancelWork();
    this.session.cart.stop();
    this.scene.pause();
    this.scene.launch(PauseScene.KEY, {
      canSave: this.session.modeChosen && !this.session.ended,
      save: () => this.save(),
      resume: () => {
        this.scene.stop(PauseScene.KEY);
        this.input.keyboard?.resetKeys();
        this.pressed.clear();
        this.ignorePointer = true;
        this.scene.resume();
        document.querySelector('#game-status')!.textContent =
          'Mina lista · H abre la guía · | códigos' +
          (DEVELOPER_MODE ? ' · DESARROLLADOR' : '');
      },
      toMenu: () => {
        if (this.session.modeChosen && !this.session.ended) this.save();
        this.scene.stop(PauseScene.KEY);
        this.scene.start('MenuScene');
      },
    } satisfies PauseVisit);
    this.scene.bringToTop(PauseScene.KEY);
  }

  returnToCamp(): void {
    if (this.deathPending) return;
    if (this.ready && this.session.modeChosen && !this.save()) {
      this.hud.announce('ERROR AL GUARDAR');
      return;
    }
    this.scene.start('TopDownScene');
  }
  preload(): void {
    queueAssets(this, ACTION_AUDIO_KEYS);
  }
  create(): void {
    this.ready = false;
    // Sin todas las texturas, Phaser pinta su reemplazo (cuadros verdes con
    // diagonal) en las cajas, barriles, antorchas y el minero: se reintenta
    // la carga en vez de construir el mundo incompleto.
    const missing = missingAssets(this);
    if (missing.length) {
      this.handleMissingAssets(missing);
      return;
    }
    MiningScene.loadAttempts = 0;
    this.ready = true;
    this.worldAudio = new WorldAudio(this);
    this.footsteps = new FootstepAudio(this);
    this.cartAudio = new CartRollingAudio(this);
    this.pressed.clear();
    this.work.cancel();
    this.loading = null;
    this.saveTimer = null;
    this.leftClick = this.rightClick = false;
    this.buildCell = null;
    this.ignorePointer = false;
    this.lastClock = performance.now();
    this.lastImpact = -1;
    this.lastWarning = '';
    this.exposure = 0;
    this.second = 0;
    createPlaceholderTextures(this);
    drawPlaceholderWorld(this);
    // Mano del Desierto, salitrera, locomotora del FCAB y Huanchaca.
    this.landmarks = createLandmarks(this);
    mountAssetLayers(this);
    createV3Art(this);
    let restored: ReturnType<typeof decodeSave> = null,
      saveWarning = '';
    const fresh = this.fresh || MiningScene.pendingNew;
    MiningScene.pendingNew = false;
    this.lastSafe = { x: SPAWN.x, y: SPAWN.y };
    this.wasInMine = false;
    this.alienSeen = false;
    this.gnome = null;
    this.attackTimer.reset();
    if (this.mineVisit) {
      restored = this.mineVisit;
      if (!this.mineVisit.fromFog) arriveInMode(this);
    } else if (this.recovery) {
      const { session, clock } = this.recovery;
      // Las mechas ya encendidas conservan el tiempo que les quedaba.
      const now = this.game.loop.time;
      for (const charge of session.blasting.charges)
        if (charge.endsAt !== null) charge.endsAt += now - clock;
      session.health.invulnerableUntil = now + 2000;
      restored = { session, player: SPAWN };
      this.recovery = undefined;
    } else {
      try {
        const raw = fresh
          ? null
          : (localStorage.getItem(this.saveKey) ??
            (DEVELOPER_MODE
              ? null
              : (localStorage.getItem(V5_SAVE_KEY) ??
                localStorage.getItem(V4_SAVE_KEY) ??
                localStorage.getItem(V3_SAVE_KEY) ??
                localStorage.getItem(LEGACY_SAVE_KEY))));
        restored = raw
          ? decodeSave(raw, DEVELOPER_MODE, WORLD_REV_EXPLORE)
          : null;
        if (raw && !restored) {
          localStorage.setItem(`${this.saveKey}.invalid`, raw);
          saveWarning = 'GUARDADO INVALIDO: COPIA DE RESPALDO CONSERVADA';
        }
      } catch {
        saveWarning = 'GUARDADO LOCAL NO DISPONIBLE';
      }
    }
    if (restored?.session.expedition?.active && !this.campVisit && !this.mineVisit) {
      this.ready = false;
      this.scene.start(MINE_MODE, { ...restored, fromSurface: true });
      return;
    }
    if (!restored) {
      const seed = freshSeed();
      this.session = new GameSession(
        createInitialTerrain(seed, worldRevDefault()),
        seed,
        DEVELOPER_MODE,
      );
    } else this.session = restored.session;
    if (this.campVisit)
      this.session.dayNight.restore(this.campVisit.time, this.campVisit.total);
    const grid = this.session.grid;
    // Un derrumbe que seguía cayendo (muerte o cambio de escena en plena
    // caída) queda asentado: cada bloque, como escombro donde habría caído.
    const settled = this.session.falling.settle(grid);
    this.session.geotech.suspended = false;
    if (settled.length) {
      for (const c of settled) this.session.visibility.reveal(c.column, c.row);
      this.session.afterTerrainChange(settled);
    }
    this.collapsing = [];
    this.settledCells = [];
    this.lastThudAt = 0;
    this.fallingView = new FallingBlocksView(this);
    this.mining = new MiningSystem(grid);
    const initial = pristineTerrain(
      this.session.seed,
      this.session.grid.worldRev,
    );
    this.mining.excavated =
      initial.cells.flat().filter((b) => b !== Block.Air).length -
      grid.cells.flat().filter((b) => b !== Block.Air).length;
    for (let r = 0; r < initial.rows; r++)
      for (let c = initial.first; c < initial.end; c++) {
        const mineral = mineralOf(initial.get(c, r));
        if (mineral && !grid.isSolid(c, r)) this.mining.discovered[mineral]++;
      }
    // Mundo abierto: un solo terreno del borde oeste al este, con campamento,
    // Mano del Desierto y las zonas del oeste excavables como la mina.
    this.terrain = new TerrainView(this, grid, this.session.visibility);
    this.physics.world.setBounds(
      WORLD_LEFT,
      0,
      WORLD_WIDTH,
      WORLD.rows * TILE_SIZE,
    );
    this.miner = new Miner(this);
    this.miner.on('jump', () => this.footsteps.jump(this.inMine()));
    // V11: la posición guardada se recupera aun junto a lo construido: si el
    // cuerpo queda dentro de un bloque (p. ej. sobre un techo recién colocado)
    // se sube hasta el primer lugar libre, en vez de reaparecer en la entrada.
    const spot =
      restored && this.freeSpot(restored.player.x, restored.player.y);
    if (spot) this.miner.body.reset(spot.x, spot.y);
    this.physics.add.collider(this.miner, this.terrain.layer);
    const portalTop = TUNNEL.topRow * TILE_SIZE;
    createPixelFont(this);
    this.transitionPortal = new FogPortal(
      this,
      TRANSITION_PORTAL_X,
      (TUNNEL.bottomRow + 1) * TILE_SIZE,
    );
    this.portalLabel = pixelText(this, TRANSITION_PORTAL_X, portalTop - 15, '[E] ATRAVESAR LA NIEBLA', P.cream)
      .setOrigin(0.5, 1).setDepth(DEPTH.worldUi).setVisible(false);
    this.cameras.main
      .setBounds(WORLD_LEFT, 0, WORLD_WIDTH, WORLD.rows * TILE_SIZE + 36)
      .startFollow(this.miner, true, 1, 1)
      .setDeadzone(100, 50);
    // Selección, progreso y vista previa se leen aun a oscuras.
    this.selection = this.add.graphics().setDepth(DEPTH.worldUi);
    this.crack = this.add
      .image(0, 0, 'terrain', TerrainFrame.CrackFirst)
      .setOrigin(0)
      .setDepth(DEPTH.foreground)
      .setVisible(false);
    this.progressLabel = pixelText(this, 0, 0, '', P.cream).setDepth(
      DEPTH.worldUi + 2,
    );
    this.drillTool = this.add
      .image(0, 0, 'world-v3', 'drill_tool')
      .setDepth(DEPTH.characters + 1)
      .setVisible(false);
    this.scenery = new Scenery(this, grid.worldRev >= WORLD_REV_ENTRANCE_10);
    // Retirar decoración cuya celda fue excavada en la partida restaurada.
    for (let r = 0; r < initial.rows; r++)
      for (let c = initial.first; c < initial.end; c++)
        if (initial.isSolid(c, r) && !grid.isSolid(c, r))
          this.scenery.cellRemoved({ column: c, row: r });
    // V11: un árbol cuyo suelo se excavó ya no está; los talados dejan tocón.
    const noGround: number[] = [];
    for (let i = 0; i < TREE_COLUMNS.length; i++) {
      const ground = treeGround(i);
      if (!grid.isSolid(ground.column, ground.row)) {
        this.session.trees.uproot(i);
        noGround.push(i);
      }
    }
    this.treeView = new TreeView(this, this.session.trees);
    for (const i of noGround) this.treeView.remove(i);
    // V11: la decoración baja un bloque colocado encima se arranca.
    for (const key of this.session.placed) this.uprootDecor(grid.cellOf(key));
    this.camp = new CampSite(this);
    this.scenery.lights.push(...this.camp.lights);
    this.cabinSite = new CabinSite(this);
    this.scenery.lights.push(...this.cabinSite.lights);
    this.gear = new MinerGear(this);
    this.hud = new OperationsHUD(this);
    this.cabin = new CabinInterior(this, () =>
      ensureLook(
        this,
        'miner-unarmed',
        lookMask((k: PPEKind) => this.session.loadout.equipped(k)),
      ),
    );
    this.cabin.onSleep = () => {
      const r = this.session.sleep();
      this.lastUnits.energy = this.session.survival.energyUnits;
      this.save();
      return r.woke === 'night'
        ? 'ANOCHECE: COMIENZA LA NOCHE'
        : 'AMANECE: COMIENZA EL DIA';
    };
    this.cabin.onWake = () => {
      const s = this.session;
      this.hud.announce(
        `DESPERTASTE DESCANSADO: ENERGIA 5/5. ALIMENTACION ${s.survival.hungerUnits}/5` +
          (s.survival.hungerUnits <= 2 ? ': COME ALGO PRONTO' : ''),
      );
      this.sound.play('sfx-collect', { volume: 0.3, rate: 0.8 });
      this.save();
    };
    this.lastUnits = {
      energy: this.session.survival.energyUnits,
      hunger: this.session.survival.hungerUnits,
    };
    this.survivalNoticeAt = 0;
    this.hurtNoticeAt = 0;
    this.eating = null;
    this.levelUp = new LevelUpEffect(this);
    this.quickSupply = null;
    this.syncQuickSupply();
    this.effects = new DigEffects(this, () => this.hud.cargoAnchor);
    this.logistics = new LogisticsView(this, this.scenery.cart);
    this.ops = new OperationsView(this);
    this.lighting = new LightingSystem(
      this,
      grid,
      this.scenery.lights,
      this.session.lights,
      this.session.visibility,
    );
    this.nightTint = new NightTint(this);
    // Fondo de las zonas (desierto o costa) por posición de la cámara.
    this.biomeBackdrop = new BiomeBackdrop(
      this,
      () => this.backdrop?.rangeLayers() ?? [],
    );
    this.biomeAmbience = new BiomeAmbience(this, grid);
    // Sombra de contacto del minero sobre el suelo real (sigue los escalones).
    this.groundShadow = new GroundShadowView(this);
    // Chinchillas del desierto: decoración en movimiento que huye del minero.
    this.critters = new Critters(
      this,
      [this.terrain.layer],
      (c, r) => this.worldGround.isSolid(c, r),
      (x, y) => this.effects.impact(x, y, true, 0),
    );
    // V10: partículas de los cristales y página de la cámara secreta.
    this.crystalMotes = new CrystalMotes(
      this,
      this.lighting.crystals,
      this.session.visibility,
    );
    this.buildTornPage();
    // Tras sincronizar la física: el haz sale de la posición dibujada del casco.
    const lightingTick = () =>
      this.lighting.update(this.miner, this.frameMs, this.lastClock);
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, lightingTick);
    this.interactions = new InteractionSystem();
    this.registerInteractions();
    this.session.loadout.sync();
    this.inventory = new InventoryPanel(this, () => this.session);
    this.phone = new PhoneView(this, () => this.session);
    this.phone.sale = {
      quote: () => this.session.quoteCargo(this.cartNearForSale()),
      submit: () => {
        if (this.inMine() && !this.cabin.open)
          return 'VENDE LA CARGA DESDE LA SUPERFICIE';
        const result = this.session.sellCargo(this.cartNearForSale(), () =>
          this.save(),
        );
        if (typeof result === 'string') return result;
        if (!result) return 'SIN CARGA PARA VENDER';
        this.sound.play('sfx-collect', { volume: 0.4 });
        this.checkProgress();
        return result;
      },
    };
    this.phone.dispatcher = {
      available: true,
      unavailableReason: [],
      submit: (order) => this.payDroneOrder(order),
    };
    this.droneView = new DroneView(this, () => this.session, {
      onLaunch: (order) =>
        this.hud.announce(`PEDIDO ${order.id}: EL DRON DESPEGO`),
      onDelivered: (box) => {
        this.hud.announce(`PAQUETE ${box.id} ENTREGADO. ÁBRELO CON E`);
        this.sound.play('sfx-collect', { volume: 0.4, rate: 1.2 });
        this.save();
      },
    });
    this.droneBox = new DroneBoxPanel(
      this,
      () => this.session,
      () => this.save(),
      () => {
        this.sound.play('sfx-collect', { volume: 0.4 });
        this.syncQuickSupply();
      },
    );
    this.inventory.onUse = (kind) => {
      if (isFood(kind)) return this.consumeFood(kind);
      if (kind === 'battery') return this.replaceBattery();
      if (PLACEABLE.includes(kind)) this.useManualSupply(kind);
    };
    this.inventory.onQuick = (index) => this.activateQuick(index);
    this.inventory.onChange = () => {
      this.syncQuickSupply();
      this.save();
    };
    this.safety = new SafetyScreens(this);
    this.dialog = new DialogBox(this);
    this.book = new BookView(this);
    this.guide = new IntroGuide(this);
    let consolePausedAt = 0;
    // Tecla |: códigos de la partida para todos (money, fly, gnomo y
    // desbloquear, que pasa a la última etapa; desactivan los
    // logros). En modo desarrollador se suman fullstacks y mochila, y money
    // sigue siendo el de desarrollo (partida aparte, sin tocar los logros).
    this.developerConsole = new DeveloperConsole(
      this,
      (command) => {
        const s = this.session;
        if (command.trim().toLowerCase() === 'gnomo') {
          if (this.gnome && !this.gnome.dead)
            return 'YA HAY UN GNOMO MINERO EN LA ZONA';
          if (!this.spawnGnome()) return 'NO HAY ESPACIO LIBRE PARA EL GNOMO';
          const result = s.cheats.execute(command);
          this.save();
          return result.message;
        }
        if (command.trim().toLowerCase() === 'desbloquear') {
          const result = s.unlockAllTiers();
          if (result.changed) {
            this.hud.announce(
              `ETAPA 3 DESBLOQUEADA: ${TIERS[3].name}. NUEVOS EQUIPOS EN EL CELULAR (U)`,
            );
            if (!this.save())
              return 'CAMBIO ACTIVO. ERROR AL GUARDAR. USA G AL CERRAR';
          }
          return result.message;
        }
        const dev = DEVELOPER_MODE ? s.developer.execute(command) : null;
        let result: { message: string; changed: boolean };
        if (dev && !dev.message.startsWith('COMANDO DESCONOCIDO')) result = dev;
        else {
          const cheat = s.cheats.execute(command);
          if (!cheat.recognized)
            return DEVELOPER_MODE
              ? 'DESCONOCIDO: MONEY / FLY / GNOMO / DESBLOQUEAR / FULLSTACKS / MOCHILA'
              : 'CODIGO DESCONOCIDO: MONEY / FLY / GNOMO / DESBLOQUEAR';
          result = cheat;
        }
        if (result.changed && !this.save())
          return 'CAMBIO ACTIVO. ERROR AL GUARDAR. USA G AL CERRAR';
        return result.message;
      },
      (open) => {
        this.cancelWork();
        this.session.cart.stop();
        this.miner.step(true);
        this.pressed.clear();
        this.leftClick = false;
        this.rightClick = false;
        this.ignorePointer = true;
        this.input.keyboard?.resetKeys();
        this.input.enabled = !open;
        if (open) {
          consolePausedAt = this.game.loop.time;
          this.scene.pause();
        } else {
          // Phaser reanuda su reloj absoluto: conservar el tiempo restante
          // de las mechas y la protección para no castigar la pausa.
          const elapsed = this.game.loop.time - consolePausedAt;
          for (const charge of this.session.blasting.charges)
            if (charge.endsAt !== null) charge.endsAt += elapsed;
          if (this.session.health.invulnerableUntil > consolePausedAt)
            this.session.health.invulnerableUntil += elapsed;
          this.lastClock = performance.now();
          this.scene.resume();
        }
      },
      DEVELOPER_MODE,
    );
    this.input.mouse?.disableContextMenu();
    const rightDown = (p: Phaser.Input.Pointer) => {
      if (this.warehouse.open || this.fridge?.open) return;
      // Con el celular abierto el clic es suyo: nunca excava ni construye.
      if (this.phone?.open) {
        this.ignorePointer = true;
        return;
      }
      if (this.hud.blocksWorld(p.x, p.y)) {
        const quick = this.hud.quickAt(p.x, p.y);
        if (p.leftButtonDown() && !this.inventory.open) {
          this.ignorePointer = true;
          if (
            quick >= 0 &&
            !this.hud.modal &&
            !this.buildCell &&
            !this.safety.modeOpen &&
            !this.safety.confirmOpen
          )
            this.activateQuick(quick);
        }
        return;
      }
      if (p.rightButtonDown()) this.rightClick = true;
      // Clic izquierdo por evento: no se pierde aunque dure menos que un cuadro.
      else if (p.leftButtonDown()) this.leftClick = true;
    };
    this.input.on('pointerdown', rightDown);
    this.warehouse = new WarehousePanel(this, () => this.save());
    this.fridge = new FridgePanel(this, () => this.save());
    // Botones de modalidad y de nueva mina (pantallas sin objetos interactivos).
    const screenClick = (p: Phaser.Input.Pointer) => {
      const b = this.safety.buttons;
      const hit = (r: { x: number; y: number; w: number; h: number }) =>
        p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
      if (this.safety.modeOpen) {
        if (hit(b.normal)) this.chooseMode('normal');
        else if (hit(b.hardcore)) this.chooseMode('hardcore');
      } else if (this.safety.confirmOpen) {
        if (hit(b.proceed) && this.pendingPlan)
          this.finishDismantle(this.pendingPlan);
        else if (hit(b.cancel)) {
          this.pendingPlan = null;
          this.safety.showConfirm(null);
        }
      }
    };
    this.input.on('pointerdown', screenClick);
    // Teclas configurables por código del navegador. Tab no cambia el foco
    // mientras el juego tiene el control, pero sí funciona normalmente si el
    // foco está en un botón, enlace o formulario de la página.
    this.controls = loadControls();
    const onKey = (e: KeyboardEvent) => {
      if (this.developerConsole?.open) return;
      const el = document.activeElement as HTMLElement | null;
      const external =
        !!el &&
        (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName) ||
          el.isContentEditable);
      if (external) return;
      // Nueva expedición: las letras escriben el nombre de la mina (1 y 2
      // siguen eligiendo la modalidad). Ninguna otra acción se dispara.
      if (this.safety?.modeOpen) {
        if (e.key === 'Backspace') {
          e.preventDefault();
          this.safety.eraseName();
        } else {
          const c = nameChar(e.key);
          if (c) {
            e.preventDefault();
            this.safety.typeName(c);
          }
        }
        return;
      }
      if (e.repeat) return;
      const action =
        e.code === this.controls.inventory
          ? 'INVENTORY'
          : e.code === this.controls.dismantle
            ? 'DISMANTLE'
            : e.code === this.controls.withdraw
              ? 'WITHDRAW'
              : e.code === this.controls.headlamp || e.code === HEADLAMP_ALIAS
                ? 'HEADLAMP'
                : e.code === this.controls.battery
                  ? 'BATTERY'
                  : e.code === this.controls.save
                    ? 'SAVE'
                    : e.code === this.controls.phone
                      ? 'PHONE'
                      : null;
      if (!action) return;
      e.preventDefault();
      this.pressed.add(action);
    };
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      window.removeEventListener('keydown', onKey),
    );
    this.dismantleLabel = pixelText(this, 0, 0, '', P.cream)
      .setDepth(DEPTH.worldUi + 3)
      .setVisible(false);
    this.wrenchCursor = this.add
      .image(0, 0, 'items-v3', 'wrench')
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 3)
      .setVisible(false);
    this.dismantleMode = false;
    this.input.setDefaultCursor('');
    this.pendingPlan = null;
    for (const key of [
      'Z',
      // E es la tecla de interactuar; Z sigue funcionando como alias.
      'E',
      'T',
      'C',
      'R',
      'M',
      'H',
      'Q',
      'J',
      'ESC',
      'UP',
      'DOWN',
      ...QUICK_KEYS,
      'ENTER',
      'LEFT',
      'RIGHT',
    ]) {
      const input = this.input.keyboard!.addKey(key, true, false);
      // E cuenta como Z: todo el juego lee una sola acción de interactuar.
      const action = key === 'E' ? 'Z' : key;
      input.on('down', (_key: unknown, event?: KeyboardEvent) => {
        // Un toque puede llegar varias veces si se retrasa el cuadro.
        if (event) {
          if (this.countedKeys.has(event)) return;
          this.countedKeys.add(event);
        }
        this.pressed.add(action);
      });
    }
    const visibility = () => {
      this.hidden = document.hidden;
      this.cancelWork();
      this.session.cart.stop();
      this.ignorePointer = true;
      this.save();
    };
    const blur = () => {
      this.cancelWork();
      this.session.cart.stop();
      this.ignorePointer = true;
    };
    const unload = () => this.save();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', unload);
    this.game.events.on(Phaser.Core.Events.BLUR, blur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.save();
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, lightingTick);
      this.input.off('pointerdown', rightDown);
      this.input.off('pointerdown', screenClick);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', unload);
      this.game.events.off(Phaser.Core.Events.BLUR, blur);
    });
    if (saveWarning) this.hud.announce(saveWarning);
    else
      this.hud.announce(
        restored?.migrated ??
          (restored
            ? 'PARTIDA RECUPERADA | H: AYUDA'
            : 'RETIRA EL KIT EN BODEGA. EQUÍPATE EN EL INVENTARIO (TAB)'),
      );
    if (restored?.migrated) this.save();
    if (!this.session.modeChosen && !this.session.ended)
      this.safety.showMode(true);
    // V8: la partida se guardó dentro del pabellón: se retoma ahí.
    else if (this.session.inCabin && !this.session.ended) this.enterCabin(true);
    // «La herencia del abuelo»: tabla del piso según lo avanzado y, si se
    // recargó durante el diálogo inicial, se retoma.
    this.syncIntro(this.time.now, false, true);
    if (
      this.session.intro.step === 'welcome' &&
      this.session.modeChosen &&
      !this.session.ended
    )
      this.showWelcome();
    document.querySelector('#game-status')!.textContent =
      'Mina lista · H abre la guía · | códigos' +
      (DEVELOPER_MODE ? ' · DESARROLLADOR' : '');
    if (this.mineVisit?.fromFog)
      revealFromFog(this, () => {
        this.transitionPortal.setIntensity(0);
      });
  }

  save(): boolean {
    if (this.deathPending) return false;
    try {
      localStorage.setItem(
        this.saveKey,
        encodeSave(this.session, { x: this.miner.x, y: this.miner.y }),
      );
      return true;
    } catch {
      this.hud?.announce('NO SE PUDO GUARDAR EN ESTE NAVEGADOR');
      return false;
    }
  }
  returnToSurface(): void {
    if (!this.ready || this.deathPending || this.cabin?.sleeping) return;
    if (this.cabin?.open) {
      this.cabin.hide();
      this.session.inCabin = false;
      this.miner.setVisible(true);
    }
    this.cancelWork();
    this.session.cart.stop();
    this.buildCell = null;
    this.hud.close();
    this.miner.body.reset(SPAWN.x, SPAWN.y);
    this.save();
    this.hud.announce('DE VUELTA EN SUPERFICIE. CARGA CONSERVADA');
  }
  private freeBody(x: number, y: number): boolean {
    for (const dx of [-5, 4])
      for (const dy of [-6, 11]) {
        const c = TerrainGrid.worldToCell(x + dx, y + dy);
        if (this.session.grid.isSolid(c.column, c.row)) return false;
      }
    return true;
  }
  /** Primer punto libre desde (x, y) hacia arriba (hasta tres bloques). */
  private freeSpot(x: number, y: number): Point | null {
    for (let dy = 0; dy <= 48; dy += 2)
      if (this.freeBody(x, y - dy)) return { x, y: y - dy };
    return null;
  }
  private spawnGnome(): boolean {
    if (this.gnome && !this.gnome.dead) return false;
    this.gnome?.destroy();
    this.gnome = null;
    for (const dx of [48, -48, 72, -72]) {
      const point = this.freeSpot(this.miner.x + dx, this.miner.y);
      if (!point) continue;
      // El sprite del gnomo (64 × 48) apoya sus pies 9 px más abajo que el
      // origen del minero: así su cuerpo queda sobre el mismo suelo.
      this.gnome = new GnomeBoss(this, point.x, point.y - 9);
      // Aparece mirando al minero que lo invocó.
      this.gnome.brain.facing = dx > 0 ? -1 : 1;
      this.physics.add.collider(this.gnome.sprite, this.terrain.layer);
      this.hud.announce('GNOMO MINERO: J PARA ATACAR');
      return true;
    }
    return false;
  }

  /**
   * Golpe del minero (J). La cadencia la lleva `attackTimer`; aquí se dibuja
   * el movimiento y, si conecta, se aplica el daño en el acto (sin demora).
   */
  private attackGnome(): void {
    if (this.miner.direction)
      this.attackFacing = this.miner.direction < 0 ? -1 : 1;
    else this.attackFacing = this.miner.flipX ? -1 : 1;
    this.miner.setFlipX(this.attackFacing < 0);
    const tool = this.session.tools.current;
    const armed = tool && tool.durability > 0 ? tool : undefined;
    const shovel = armed?.kind === 'shovel';
    // Mientras se excava o se empuja el carro esa animación manda.
    if (!this.work.key && !this.session.cart.pushing) this.miner.swing(shovel);
    const contact = this.gnomeContact();
    const key = shovel ? 'sfx-shovel-0' : 'sfx-pick-0';
    if (!contact) {
      // Golpe al aire: más suave y agudo que uno que conecta.
      if (this.cache.audio.exists(key))
        this.sound.play(key, { volume: 0.22, rate: 1.25 });
      return;
    }
    const { gnome, x, y } = contact;
    if (this.cache.audio.exists(key))
      this.sound.play(key, { volume: 0.5, rate: 0.85 });
    if (this.cache.audio.exists('sfx-shovel-1'))
      this.sound.play('sfx-shovel-1', { volume: 0.3, rate: 0.6 });
    this.effects.sparks(x, y);
    this.cameras.main.shake(STRIKE_FEEL.shakeMs, STRIKE_FEEL.shakeIntensity);
    if (gnome.hit(weaponDamage(armed?.kind), this.miner.x))
      this.hud.announce('GNOMO MINERO DERROTADO');
  }

  /** Gnomo al alcance del golpe y punto de contacto (borde cercano), o null. */
  private gnomeContact(): { gnome: GnomeBoss; x: number; y: number } | null {
    const gnome = this.gnome;
    if (!gnome || gnome.dead) return null;
    const hurtbox = gnome.hurtbox();
    const target = {
      x: hurtbox.x + hurtbox.width / 2,
      y: hurtbox.y + hurtbox.height / 2,
    };
    if (
      !canHitGnome(
        this.miner.x,
        this.miner.y,
        this.attackFacing,
        target.x,
        target.y,
      ) ||
      !this.visible(target)
    )
      return null;
    return {
      gnome,
      x: target.x - (this.attackFacing * hurtbox.width) / 2,
      y: target.y - 2,
    };
  }

  /** Gnomo: percepción, golpe con su picota y efectos de su actividad. */
  private updateGnome(deltaMs: number): void {
    const gnome = this.gnome;
    if (!gnome) return;
    if (gnome.gone) {
      this.gnome = null;
      return;
    }
    const grid = this.session.grid;
    const body = this.miner.body;
    gnome.update(deltaMs * this.time.timeScale, {
      solid: (column, row) => grid.isSolid(column, row),
      player: { x: body.x, y: body.y, width: body.width, height: body.height },
      strike: (box, chest) => {
        if (this.session.health.dead) return;
        const player = {
          x: body.x,
          y: body.y,
          width: body.width,
          height: body.height,
        };
        if (this.cache.audio.exists('sfx-pick-1'))
          this.sound.play('sfx-pick-1', { volume: 0.4, rate: 0.75 });
        if (strikeConnects((c, r) => grid.isSolid(c, r), chest, box, player))
          this.hurt(GNOME.hit, 'gnomo', chest.x);
      },
      mineHit: (x, y) => this.effects.impact(x, y, false, 0.18),
      dust: (x, y) => this.effects.impact(x, y - 1, true, 0),
    });
    if (gnome.gone) this.gnome = null;
  }

  /** El gnomo oye excavar al minero cerca y va a mirar. */
  private noiseForGnome(x: number, y: number): void {
    const gnome = this.gnome;
    if (!gnome || gnome.dead) return;
    const c = gnome.chest();
    if (Math.hypot(x - c.x, y - c.y) <= GNOME_AI.hearing) gnome.brain.hear(x);
  }
  private visible(
    target: Point,
    origin: Point = this.miner.body.center,
  ): boolean {
    const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
    for (let i = 0; i < distance; i += 4) {
      const c = TerrainGrid.worldToCell(
        origin.x + ((target.x - origin.x) * i) / distance,
        origin.y + ((target.y - origin.y) * i) / distance,
      );
      if (this.session.grid.isSolid(c.column, c.row)) return false;
    }
    return true;
  }
  private get playerCell(): Cell {
    return TerrainGrid.worldToCell(this.miner.x, this.miner.y - 4);
  }
  private nearCart(): boolean {
    const cart = this.session.cart;
    return (
      Math.hypot(
        this.miner.x - cart.x,
        this.miner.body.bottom - (cart.y + 4),
      ) <= 38 &&
      // Desde el cuerpo o desde la cabeza: en una rampa la esquina del
      // escalón puede tapar la línea baja.
      (this.visible({ x: cart.x, y: cart.y - 6 }) ||
        this.visible(
          { x: cart.x, y: cart.y - 6 },
          { x: this.miner.x, y: this.miner.body.top + 2 },
        ))
    );
  }
  private registerInteractions(): void {
    const register = (
      id: string,
      x: number,
      label: string,
      action: () => void,
    ) =>
      this.interactions.register({
        id,
        x,
        y: 148,
        radius: BALANCE.interactionRadius,
        label,
        enabled: true,
        action,
      });
    register('warehouse', WAREHOUSE_X, '[E] ABRIR BODEGA', () => {
      this.cancelWork();
      this.session.cart.stop();
      this.warehouse.show(this.session);
      this.leftClick = this.rightClick = false;
      this.ignorePointer = true;
    });
    register('cart', this.session.cart.x, '[E] EMPUJAR CARRITO', () => {
      if (this.session.inventory.items.length) this.startLoading();
      else this.togglePush();
    });
    register('cabin', CAMP_LAYOUT.doorX, '[E] ENTRAR A LA CABAÑA', () =>
      this.enterCabin(),
    );
    // «La herencia del abuelo»: solo existen mientras toca ese paso y ganan a
    // lo que tengan cerca (la pila de material, la bodega).
    const guided = (id: string, x: number, label: string, action: () => void) =>
      this.interactions.register({
        id,
        x,
        y: 148,
        radius: 28,
        label,
        enabled: false,
        priority: 1,
        action,
      });
    guided('toolbox', TOOLBOX_X, '[E] ABRIR EL CAJÓN', () =>
      this.openToolbox(),
    );
    guided('mine-entrance', TRANSITION_PORTAL_X, '[E] ATRAVESAR LA NIEBLA', () =>
      this.enterGallery(),
    );
    // V10: la página arrancada del abuelo en la cámara secreta (se registra
    // siempre; solo se habilita cuando esa celda ya fue descubierta).
    guided('torn-page', -10_000, '[E] LEER LA PÁGINA', () =>
      this.readTornPage(),
    );
  }

  /** E ante el refrigerador de la cabaña: interfaz tipo cofre. */
  private openFridge(): void {
    this.cancelWork();
    this.session.cart.stop();
    this.fridge.show(this.session);
    this.leftClick = this.rightClick = false;
    this.ignorePointer = true;
  }

  /** Página arrancada sobre el suelo de la cámara secreta (geología rev. 2). */
  private buildTornPage(): void {
    this.pageCell =
      geologyOf(this.session.seed, this.session.grid.worldRev).explore?.secret
        .page ?? null;
    const cell = this.pageCell;
    if (!cell) return;
    const x = cell.column * TILE_SIZE + 2,
      y = (cell.row + 1) * TILE_SIZE - 9;
    const g = this.add.graphics().setDepth(DEPTH.structures);
    this.pageArt = g;
    g.setVisible(this.session.grid.get(cell.column, cell.row) === Block.Air);
    // Hoja de diario con contorno de tinta, renglones y una esquina rota.
    g.fillStyle(P.ink).fillRect(x, y, 12, 8);
    g.fillStyle(P.cream).fillRect(x + 1, y + 1, 10, 6);
    g.fillStyle(P.sand).fillRect(x + 1, y + 6, 10, 1);
    g.fillStyle(P.loam)
      .fillRect(x + 2, y + 2, 6, 1)
      .fillRect(x + 2, y + 4, 7, 1);
    g.fillStyle(P.ink).fillRect(x + 10, y + 5, 2, 3);
    g.fillStyle(P.mauve).fillRect(x + 8, y + 1, 1, 1);
  }

  /** E sobre la página: la pista del abuelo, una sola vez como hallazgo. */
  private readTornPage(): void {
    this.introSay(TORN_PAGE, () => {
      if (!this.session.exploration.readPage()) return;
      this.hud.celebrate(
        'PÁGINA DEL ABUELO',
        'EL CRISTAL VIOLETA RESPONDE A LA ROCA DURA.',
        'PISTA',
      );
      this.sound.play('sfx-collect', { volume: 0.4, rate: 0.8 });
      this.save();
    });
  }
  private refreshInteractions(): void {
    const s = this.session;
    const cart = this.interactions.objects.get('cart')!;
    cart.x = s.cart.x;
    cart.y = s.cart.y - 6;
    cart.label = s.inventory.items.length
      ? '[E] CARGAR CON PALA | C: EMPUJAR'
      : '[E] EMPUJAR CARRITO';
    const step = s.intro.step;
    this.interactions.objects.get('toolbox')!.enabled = step === 'tools';
    this.interactions.objects.get('mine-entrance')!.enabled = true;
    const page = this.interactions.objects.get('torn-page')!;
    if (this.pageCell) {
      const uncovered =
        s.grid.get(this.pageCell.column, this.pageCell.row) === Block.Air;
      this.pageArt?.setVisible(uncovered);
      page.x = this.pageCell.column * TILE_SIZE + 8;
      page.y = this.pageCell.row * TILE_SIZE + 8;
      page.radius = 22;
      page.enabled =
        uncovered && s.visibility.has(this.pageCell.column, this.pageCell.row);
    } else page.enabled = false;
    for (const p of s.piles) {
      const id = `pile-${p.id}`;
      if (!this.interactions.objects.has(id))
        this.interactions.register({
          id,
          x: p.x,
          y: p.y,
          radius: BALANCE.interactionRadius,
          label: '[E] RECOGER MATERIAL SUELTO',
          enabled: true,
          action: () => this.startLoading(p.id),
        });
      this.interactions.objects.get(id)!.enabled = p.items.length > 0;
    }
    // Cajas del dron: una interacción por caja, mientras exista.
    const boxes = new Set(s.drones.boxes.map((b) => `drone-box-${b.id}`));
    for (const key of this.interactions.objects.keys())
      if (key.startsWith('drone-box-') && !boxes.has(key))
        this.interactions.objects.delete(key);
    for (const box of s.drones.boxes) {
      const id = `drone-box-${box.id}`;
      if (!this.interactions.objects.has(id))
        this.interactions.register({
          id,
          x: box.landing?.x ?? DroneView.slotX(box.slot),
          y: (box.landing?.y ?? 160) - 12,
          radius: BALANCE.interactionRadius,
          label: '[E] ABRIR CAJA DEL DRON',
          enabled: true,
          action: () => this.openSupplyBox(box.id),
        });
    }
    for (const key of this.interactions.objects.keys())
      if (key.startsWith('rail-')) this.interactions.objects.delete(key);
    for (const end of s.rails.ends()) {
      const target = end.target;
      const valid = typeof target !== 'string';
      this.interactions.register({
        id: `rail-${end.column}`,
        x: end.column * 16 + 8,
        y: railTop(valid ? target.row : end.from.row) - 8,
        radius: 25,
        facing: false,
        enabled: true,
        label: !valid
          ? `VIA: ${target}`
          : s.railStock
            ? '[E] EXTENDER VIA'
            : '[E] EXTENDER VIA - COMPRA RIELES',
        action: () => {
          this.cancelWork();
          if (!valid) {
            this.hud.announce(target);
            return;
          }
          if (!s.railStock) {
            this.hud.announce('COMPRA TRAMOS DE RIEL CON U');
            return;
          }
          this.buildCell = { ...target };
        },
      });
    }
    this.interactions.select(
      this.miner.body.center,
      this.miner.flipX ? -1 : 1,
      (p) => this.visible(p),
    );
  }
  private togglePush(): void {
    const cart = this.session.cart;
    if (cart.pushing) {
      cart.stop();
      return;
    }
    if (!this.nearCart() || !this.miner.body.blocked.down) return;
    if (Math.abs(this.miner.x - cart.x) < CART.sideClearance) {
      this.hud.announce('COLOCATE A UN LADO DEL CARRO');
      return;
    }
    this.cancelWork();
    this.pushSide = this.miner.x < cart.x ? -1 : 1;
    cart.pushing = true;
  }
  private startLoading(pileId?: number): void {
    if (!this.miner.body.blocked.down) return;
    if (!this.session.loadout.equipToolKind('shovel')) {
      this.hud.announce('NECESITAS UNA PALA FUNCIONAL');
      return;
    }
    const toCart = this.nearCart();
    if (
      (toCart && this.session.cart.inventory.full) ||
      (!toCart && this.session.inventory.full)
    ) {
      this.hud.announce(
        toCart
          ? `CARRITO LLENO - ${BALANCE.cartCapacity}/${BALANCE.cartCapacity} KG`
          : `CARGA LLENA - ${BALANCE.personalCapacity}/${BALANCE.personalCapacity} KG`,
      );
      return;
    }
    if (
      pileId === undefined &&
      (!toCart || !this.session.inventory.items.length)
    )
      return;
    this.cancelWork();
    this.session.cart.stop();
    this.loading = {
      x: this.miner.x,
      y: this.miner.y,
      toolId: this.session.tools.equipped,
      pileId,
      toCart,
      cartX: this.session.cart.x,
    };
    this.work.advance('load', performance.now(), BALANCE.shovelMs);
  }
  private cancelWork(): void {
    this.work.cancel();
    this.loading = null;
    this.lastImpact = -1;
  }
  private target(): Cell {
    const p = this.input.activePointer,
      point = this.cameras.main.getWorldPoint(p.x, p.y);
    return TerrainGrid.worldToCell(point.x, point.y);
  }
  private completedAction(): void {
    const t = this.session.tools.current;
    if (t?.durability === 0) {
      this.effects.broken(this.miner.x, this.miner.y);
      this.hud.announce('TU HERRAMIENTA SE HA ROTO');
    } else if (t && t.durability === Math.floor(TOOLS[t.kind].durability * 0.2))
      this.hud.announce('HERRAMIENTA PROXIMA A ROMPERSE');
    this.save();
  }
  private updateLoading(now: number): string {
    const a = this.loading!;
    const pile = this.session.piles.find((p) => p.id === a.pileId);
    if (
      this.miner.direction ||
      Math.hypot(this.miner.x - a.x, this.miner.y - a.y) > 3 ||
      this.session.tools.equipped !== a.toolId ||
      !this.miner.body.blocked.down ||
      (a.toCart && (!this.nearCart() || this.session.cart.x !== a.cartX)) ||
      (pile &&
        (!pile.items.length ||
          Math.hypot(this.miner.x - pile.x, this.miner.y - pile.y) > 36))
    ) {
      this.cancelWork();
      return 'CARGA CANCELADA';
    }
    const complete = this.work.advance('load', now, BALANCE.shovelMs);
    const p = this.work.progress,
      phase = Math.min(6, Math.floor(p * 7));
    this.miner.anims.stop();
    this.miner.setTexture('miner', 47 + phase);
    const targetX =
      phase < 4 && pile
        ? pile.x
        : a.toCart
          ? this.session.cart.x
          : this.miner.x + 10;
    this.miner.setFlipX(targetX < this.miner.x);
    if (phase === 2 && this.lastImpact !== 2) {
      this.effects.impact(
        this.miner.x + (this.miner.flipX ? -8 : 8),
        this.miner.body.bottom - 2,
        true,
      );
      this.lastImpact = 2;
    }
    if (complete) {
      const ok = a.toCart
        ? this.session.load(a.pileId)
        : a.pileId !== undefined && this.session.collectPile(a.pileId);
      if (ok) {
        this.effects.impact(
          a.toCart ? this.session.cart.x : this.miner.x,
          this.miner.body.bottom - 8,
          true,
        );
        this.completedAction();
      }
      this.cancelWork();
    }
    return `CARGANDO ${Math.floor(p * 100)}% | E/ESC: CANCELAR`;
  }

  /** Perforadora: barreno virtual en 2,5 s; el bloque permanece. */
  private updateDrilling(now: number, cell: Cell): string {
    const s = this.session,
      t = s.tools.current!;
    const reason = s.blasting.canDrill(cell);
    if (reason) {
      this.cancelWork();
      if (reason !== this.lastWarning) this.hud.announce(reason);
      this.lastWarning = reason;
      return reason;
    }
    const key = `drill:${cell.column},${cell.row}:${t.id}`;
    const complete = this.work.advance(key, now, s.workMs(cell)),
      progress = this.work.progress;
    const x = cell.column * 16,
      y = cell.row * 16;
    this.miner.anims.stop();
    this.miner.setTexture('miner-unarmed', 0).setFlipX(x + 8 < this.miner.x);
    // Vibración visual: la herramienta tiembla 1 px y suelta polvo.
    const jitter = Math.floor(now / 40) % 2;
    this.drillTool
      .setVisible(true)
      .setFlipX(this.miner.flipX)
      .setPosition(
        Math.round(this.miner.x) + (this.miner.flipX ? -7 : 7),
        Math.round(this.miner.y) + 1 + jitter,
      );
    const tick = Math.floor(now / 220);
    if (tick !== this.lastImpact) {
      this.lastImpact = tick;
      this.effects.impact(x + 8, y + 8, false, 0.12);
    }
    this.selection
      .fillStyle(P.ink)
      .fillRect(x - 1, y - 6, 18, 4)
      .fillStyle(P.mint)
      .fillRect(x, y - 5, Math.floor(progress * 16), 2);
    if (complete) {
      if (s.blasting.drill(cell)) {
        s.tools.wear(t);
        s.effort('drill');
        this.completedAction();
        this.hud.announce(
          s.supplies.dynamite
            ? 'BARRENO LISTO. Q: DINAMITA Y CLIC DERECHO PARA CARGAR'
            : 'BARRENO LISTO. COMPRA DINAMITA Y MECHAS CON U',
        );
      }
      this.cancelWork();
    }
    return `PERFORANDO ${Math.floor(progress * 100)}%`;
  }

  private updateMining(now: number): string {
    const pointer = this.input.activePointer,
      cell = this.target(),
      t = this.session.tools.current;
    const result = this.mining.inspect(this.miner.body.center, cell);
    const x = cell.column * 16,
      y = cell.row * 16;
    if (this.inTransitionMine()) {
      this.cancelWork();
      if (pointer.leftButtonDown() && this.lastWarning !== 'LA NIEBLA RECHAZA LA PICOTA') {
        this.lastWarning = 'LA NIEBLA RECHAZA LA PICOTA';
        this.hud.announce('LA NIEBLA RECHAZA LA PICOTA');
      }
      return 'NIEBLA DE TRANSICIÓN: EXTRACCIÓN BLOQUEADA';
    }
    if (this.hud.blocksWorld(pointer.x, pointer.y)) {
      this.cancelWork();
      this.chopTree = -1;
      return '';
    }
    // V11: un árbol bajo el cursor se tala con el hacha (tiene prioridad).
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tree = this.session.trees.at(world.x, world.y);
    if (tree >= 0) {
      this.cancelWork();
      return this.updateChopping(now, tree);
    }
    this.chopTree = -1;
    // V11: con un material elegido, vista previa de la celda apuntada.
    const supply = this.hud.activeSupply;
    const hint =
      supply && isBuildMaterial(supply)
        ? this.drawPlacementPreview(cell, supply)
        : '';
    if (result !== 'empty' && result !== 'outside')
      this.selection
        .lineStyle(1, result === 'ready' ? P.gold : P.red)
        .strokeRect(x, y, 16, 16);
    if (!pointer.leftButtonDown() || this.ignorePointer || result !== 'ready') {
      this.cancelWork();
      return hint;
    }
    if (t && t.durability > 0 && TOOLS[t.kind].type === 'drill')
      return this.updateDrilling(now, cell);
    const block = this.session.grid.get(cell.column, cell.row);
    const warning =
      (this.session.loadout.complete
        ? null
        : 'EQUIPA TU EPP COMPLETO ANTES DE EXCAVAR') ??
      this.session.toolProblem(block) ??
      this.session.storageProblem(block) ??
      (this.session.protected(cell)
        ? 'SOPORTE DE VIA O BODEGA: PROTEGIDO'
        : '');
    if (warning) {
      this.cancelWork();
      if (warning !== this.lastWarning) this.hud.announce(warning);
      this.lastWarning = warning;
      return warning;
    }
    this.lastWarning = '';
    const key = `${cell.column},${cell.row}:${t!.id}`,
      duration = this.session.workMs(cell);
    if (key !== this.work.key) this.lastImpact = -1;
    const complete = this.work.advance(key, now, duration),
      progress = this.work.progress;
    const elapsed = now - this.work.started;
    const phase = Math.floor(elapsed / (1000 / 18)) % 6;
    this.miner.anims.stop();
    this.miner
      .setTexture(
        skinOf(t),
        t!.kind === 'shovel'
          ? 47 + Math.min(6, Math.floor(progress * 7))
          : 16 + phase,
      )
      .setFlipX(x + 8 < this.miner.x);
    const impact = Math.floor(elapsed / (1000 / 3));
    if (phase >= 3 && impact !== this.lastImpact) {
      this.effects.impact(x + 8, y + 8, t!.kind === 'shovel');
      this.lastImpact = impact;
      this.noiseForGnome(x + 8, y + 8);
    }
    this.crack
      .setVisible(true)
      .setPosition(x, y)
      .setFrame(
        TerrainFrame.CrackFirst + Math.min(3, Math.floor(progress * 4)),
      );
    this.selection
      .fillStyle(P.ink)
      .fillRect(x - 1, y - 6, 18, 4)
      .fillStyle(P.gold)
      .fillRect(x, y - 5, Math.floor(progress * 16), 2);
    this.progressLabel
      .setPosition(x - 3, y - 16)
      .setText(`${Math.floor(progress * 100)}%`)
      .setVisible(true);
    if (complete) {
      if (this.session.mine(this.mining, this.miner.body.center, cell)) {
        this.terrainChanged([cell]);
        this.effects.impact(x + 8, y + 8, block === Block.Dirt, 0.5);
        this.completedAction();
        const mineral = mineralOf(block);
        if (mineral) {
          this.effects.collect(mineral, x + 8, y + 8);
          if (block === Block.Alien) this.alienEvent(x + 8, y + 8);
          else if (this.mining.discovered[mineral] === 1 && t!.durability > 0) {
            this.hud.announce(
              `NUEVO MINERAL: ${MATERIAL_LABEL[mineral]} - $${BALANCE.sale[mineral]} (${mineralInfo(mineral).rarity})`,
            );
            this.miner.celebrate();
          }
        }
        this.checkProgress();
      }
      this.cancelWork();
    }
    return `${this.session.isPlaced(cell) ? 'DESARMANDO' : 'EXCAVANDO'} ${blockLabel(block)} | ${Math.floor(progress * 100)}%`;
  }

  /** Redibujo y efectos comunes tras cualquier cambio del terreno. */
  private terrainChanged(cells: Cell[]): void {
    for (const cell of cells) {
      this.terrain.redraw(cell);
      this.scenery.cellRemoved(cell);
      // V11: sin suelo, el árbol que crecía ahí (o su tocón) desaparece.
      const tree = this.treeView.groundAt(cell.column, cell.row);
      if (tree >= 0 && !this.session.grid.isSolid(cell.column, cell.row)) {
        this.session.trees.uproot(tree);
        this.treeView.remove(tree);
      }
    }
    // Solo la zona que esos bloques pueden alcanzar (mismo resultado).
    this.lighting.terrainChanged(cells);
  }

  // ---------- V11: construcción y tala ----------

  /** Rectángulos de las entidades que impiden colocar un bloque. */
  private entityRects(): Rect[] {
    const b = this.miner.body;
    const cart = this.session.cart;
    return [
      { x: b.left, y: b.top, w: b.width, h: b.height },
      {
        x: cart.x - CART.width / 2,
        y: cart.y + CART.bodyOffset,
        w: CART.width,
        h: CART.height,
      },
    ];
  }

  /** Guardado diferido: colocar o talar muchas veces seguidas no satura. */
  private saveSoon(): void {
    if (this.saveTimer) return;
    this.saveTimer = this.time.delayedCall(400, () => {
      this.saveTimer = null;
      this.save();
    });
  }

  /** La decoración apoyada en el suelo bajo un bloque nuevo se arranca. */
  private uprootDecor(cell: Cell): void {
    const ground = surfaceRow(cell.column);
    // Las piezas de la bocamina también cuelgan de esas celdas: no se tocan.
    if (
      cell.column >= TUNNEL.fromColumn - 1 &&
      cell.column <= TUNNEL.toColumn + 1
    )
      return;
    if (cell.row < ground && cell.row >= ground - 3)
      this.scenery.cellRemoved({ column: cell.column, row: ground });
  }

  /** Clic derecho con un material: coloca un bloque en la celda apuntada. */
  private placeMaterial(cell: Cell, kind: BuildMaterial): void {
    const s = this.session;
    const problem = s.placeBlock(
      cell,
      kind,
      this.miner.body.center,
      this.entityRects(),
    );
    if (problem) {
      if (
        problem !== this.lastBuildWarning ||
        this.time.now > this.lastBuildAt + 800
      )
        this.hud.announce(problem);
      this.lastBuildWarning = problem;
      this.lastBuildAt = this.time.now;
      return;
    }
    this.lastBuildWarning = '';
    this.uprootDecor(cell);
    this.terrainChanged([cell]);
    this.effects.impact(
      cell.column * 16 + 8,
      cell.row * 16 + 8,
      kind !== 'mat_stone',
      0.2,
    );
    this.syncQuickSupply();
    this.saveSoon();
  }

  /**
   * Vista previa del bloque: tablero de píxeles del color del material
   * (parece translúcido sin alfa parcial) con borde verde si cabe o rojo si
   * no. Devuelve el texto de ayuda para el HUD.
   */
  private drawPlacementPreview(cell: Cell, kind: BuildMaterial): string {
    const s = this.session;
    if (!s.grid.contains(cell.column, cell.row)) return '';
    // Sobre un bloque sólido el cursor es de excavación, no de colocación.
    if (s.grid.isSolid(cell.column, cell.row)) return '';
    const problem =
      s.supplies[kind] < 1
        ? `SIN ${SUPPLIES[kind].label}`
        : placementProblem(s, cell, this.miner.body.center, this.entityRects());
    const color = problem ? P.red : BUILD_MATERIALS[kind].tint;
    const x = cell.column * 16,
      y = cell.row * 16;
    this.selection.fillStyle(color);
    for (let j = 0; j < 16; j++)
      for (let i = j & 1; i < 16; i += 2)
        this.selection.fillRect(x + i, y + j, 1, 1);
    this.selection
      .lineStyle(1, problem ? P.red : P.mint)
      .strokeRect(x, y, 16, 16);
    return problem ?? `CLIC DERECHO: COLOCAR ${SUPPLIES[kind].label}`;
  }

  /** Mantener el clic sobre un árbol: un hachazo cada TREE.hitMs. */
  private updateChopping(now: number, tree: number): string {
    const s = this.session,
      pointer = this.input.activePointer;
    const trunk = treeTrunk(tree),
      o = this.miner.body.center;
    const near = Math.hypot(trunk.x - o.x, trunk.y - o.y) <= TREE.reach;
    const b = treeBounds(tree);
    this.selection
      .lineStyle(1, near ? P.gold : P.red)
      .strokeRect(b.x, b.y, b.w, b.h);
    const t = s.tools.current;
    const warn = (text: string): string => {
      if (text !== this.lastWarning) this.hud.announce(text);
      this.lastWarning = text;
      return text;
    };
    if (!pointer.leftButtonDown() || this.ignorePointer) {
      this.chopTree = -1;
      return near
        ? t?.kind === 'axe'
          ? 'ARBOL: MANTEN EL CLIC PARA TALAR'
          : 'ARBOL: EQUIPA EL HACHA PARA TALARLO'
        : 'ARBOL: ACERCATE PARA TALARLO';
    }
    if (!near) return warn('DEMASIADO LEJOS DEL ARBOL');
    if (!t || t.kind !== 'axe')
      return warn('NECESITAS UN HACHA PARA TALAR: COMPRALA CON U');
    if (t.durability <= 0) return warn('TU HERRAMIENTA SE HA ROTO');
    if (s.supplies.mat_wood > STACK_MAX - TREE.wood)
      return warn(`MADERA AL MAXIMO (${STACK_MAX})`);
    this.lastWarning = '';
    if (this.chopTree !== tree) {
      this.chopTree = tree;
      this.lastChop = now - TREE.hitMs + 180;
    }
    this.miner.anims.stop();
    this.miner
      .setTexture(skinOf(t), 16 + (Math.floor(now / (1000 / 18)) % 6))
      .setFlipX(trunk.x < this.miner.x);
    if (now - this.lastChop >= TREE.hitMs) {
      this.lastChop = now;
      this.hitTree(tree);
    }
    return `TALANDO ARBOL | ${s.trees.hitsOf(tree)}/${TREE.hp}`;
  }

  private hitTree(tree: number): void {
    const s = this.session;
    const t = s.tools.current!;
    const trunk = treeTrunk(tree);
    const result = s.trees.hit(tree);
    s.tools.wear(t);
    s.effort('chop');
    this.treeView.shake(tree);
    this.effects.woodChips(trunk.x, trunk.y - 4, 4);
    if (result.fell) {
      const away = trunk.x >= this.miner.x ? 1 : -1;
      this.treeView.fall(tree, away, () =>
        this.effects.woodChips(trunk.x + away * 14, trunk.y + 4, 14),
      );
      const n = s.addMaterial('mat_wood', result.wood);
      this.effects.floatText(trunk.x, trunk.y - 16, `+${n} MADERA`, P.cream);
      this.hud.announce(`ARBOL TALADO: +${n} MADERA`);
      s.gainXp(XP.block * 2, `tree:${tree}`);
      this.chopTree = -1;
      this.syncQuickSupply();
    }
    this.completedAction();
  }

  /** Clic derecho: instalar o usar el objeto activo en la celda apuntada. */
  private useSupply(cell: Cell, now: number): void {
    const s = this.session;
    const center = TerrainGrid.center(cell);
    const origin = this.miner.body.center;
    if (
      Math.hypot(center.x - origin.x, center.y - origin.y) >
      PLAYER.reach + 16
    ) {
      this.hud.announce('DEMASIADO LEJOS');
      return;
    }
    // Encender la mecha de una carga instalada.
    const charge = s.blasting.chargeAt(cell);
    if (charge) {
      if (charge.endsAt !== null) return;
      if (s.supplies.fuse < 1) {
        this.hud.announce('NECESITAS UNA MECHA. COMPRALA CON U');
        return;
      }
      s.blasting.light(cell, now);
      s.supplies.fuse--;
      this.sound.play('sfx-pick-2', { volume: 0.25, rate: 2.2 });
      this.hud.announce('⚠ PELIGRO: ALEJATE DE LA ZONA DE TRONADURA');
      return;
    }
    const kind = this.hud.activeSupply;
    // V11: un material de construcción se coloca como bloque en la celda.
    if (kind && isBuildMaterial(kind)) {
      this.placeMaterial(cell, kind);
      return;
    }
    if (!kind || s.supplies[kind] < 1) {
      this.hud.announce('Q: ELIGE UN OBJETO QUE TENGAS EN EL INVENTARIO');
      return;
    }
    let reason: string | null = null;
    const stock = s.supplies[kind];
    if (kind === 'wood_beam' || kind === 'steel_beam') {
      const support = kind === 'wood_beam' ? 'wood' : 'steel';
      const before = s.geotech.collapses.size;
      const old = s.supports.at(cell.column, cell.row);
      reason =
        old && !(old.kind === 'wood' && support === 'steel')
          ? 'YA HAY UN MARCO AQUI'
          : old
            ? null
            : s.supports.check(s.grid, cell);
      if (!reason && s.supports.install(s.grid, cell, support)) {
        s.supplies[kind]--;
        s.geotech.evaluate();
        s.gainXp(XP.support, `support:${cell.column},${cell.row}`);
        if (s.geotech.collapses.size < before) this.unlock('prevenir_es_vivir');
        this.hud.announce(
          s.geotech.collapses.size < before
            ? 'GALERIA ESTABILIZADA: DERRUMBE EVITADO'
            : old
              ? 'MARCO REEMPLAZADO POR ACERO'
              : 'VIGA INSTALADA',
        );
      }
    } else if (kind === 'torch' || kind === 'lamp' || kind === 'industrial') {
      reason = s.lights.check(s.grid, cell);
      if (!reason && s.lights.install(s.grid, cell, kind)) {
        s.supplies[kind]--;
        this.hud.announce(`${SUPPLIES[kind].label} INSTALADA`);
      }
    } else if (kind === 'rail') {
      // Riel con clic derecho: continúa la vía en la columna apuntada.
      const spot = s.rails.placementFor(cell);
      if (typeof spot === 'string') reason = spot;
      else if (s.build(spot))
        this.hud.announce(
          spot.row !== s.rails.at(spot.column - 1)?.row &&
            spot.row !== s.rails.at(spot.column + 1)?.row
            ? 'RAMPA CONECTADA'
            : 'VIA CONECTADA',
        );
      else reason = 'NO SE PUEDE CONSTRUIR AQUI';
    } else if (kind === 'dynamite') {
      reason = s.blasting.canCharge(cell);
      if (!reason && s.blasting.charge(cell)) {
        s.supplies.dynamite--;
        this.hud.announce(
          s.supplies.fuse
            ? 'CARGA LISTA. CLIC DERECHO EN ELLA: ENCENDER MECHA (6 S)'
            : 'CARGA LISTA. COMPRA MECHAS PARA ENCENDERLA',
        );
      }
    } else if (kind === 'duct' || kind === 'fan_aux' || kind === 'fan_main') {
      reason = s.ventilation.check(cell, kind);
      if (!reason && s.ventilation.install(cell, kind)) {
        s.supplies[kind]--;
        s.ventilation.evaluate();
        this.hud.announce(`${SUPPLIES[kind].label} INSTALADO`);
      }
    }
    // V8: instalar una estructura cuesta energía (el riel ya la cobra en build).
    if (kind !== 'rail' && s.supplies[kind] < stock) s.effort('build');
    if (reason) this.hud.announce(reason);
    else this.save();
  }

  private cycleSupply(): void {
    const owned = PLACEABLE.filter((k) => this.session.supplies[k] > 0);
    if (!owned.length) {
      this.useManualSupply(null);
      this.hud.announce('SIN OBJETOS. COMPRALOS CON U');
      return;
    }
    const i = this.hud.activeSupply ? owned.indexOf(this.hud.activeSupply) : -1;
    const next = owned[(i + 1) % owned.length]!;
    this.useManualSupply(next);
    this.hud.announce(`OBJETO: ${SUPPLIES[next].label} | CLIC DERECHO: USAR`);
  }

  /**
   * Derrumbe localizado al terminar los 10 s de advertencia: el techo del
   * tramo se desprende y cae con física propia (`updateFalling`). El daño
   * depende de dónde esté el minero en ese momento: solo lo golpea el bloque
   * que le cae encima, con más fuerza cuanto más rápido venga; lejos, nada.
   */
  private doCollapse(span: Span): void {
    const s = this.session;
    // Bloques del techo que se sueltan: salen de la cuadrícula y caen.
    const detached = s.geotech.release(
      span,
      (cell) => s.protected(cell),
      Math.max(1, s.falling.room),
    );
    if (!detached.length) return;
    // Hasta que todo se asiente, el estado a medio derrumbe no se evalúa.
    s.geotech.suspended = true;
    const middle = (span.from + span.to) / 2,
      half = Math.max(1, (span.to - span.from) / 2);
    for (const d of detached) {
      // Se aflojan del centro hacia los costados, con algo de desorden.
      const delay =
        FALL.loosenMs +
        FALL.loosenSpreadMs *
          (Math.abs(d.column - middle) / half) *
          (0.6 + 0.4 * cellNoise(s.seed, d.column, d.row));
      s.falling.add(d, d.block, delay, this.terrain.frameAt(d));
    }
    s.afterTerrainChange(detached);
    this.terrainChanged(detached);
    this.collapsing.push(span);
    this.cameras.main.shake(260, 0.006);
    this.sound.play('sfx-pick-0', { volume: 0.7, rate: 0.45 });
    s.stats.lastCollapseMs = s.stats.playMs;
    const pc = this.playerCell;
    const near =
      pc.column >= span.from - 4 &&
      pc.column <= span.to + 4 &&
      Math.abs(pc.row - span.roof) <= 5;
    if (near && !s.health.dead) this.unlock('un_susto');
    this.hud.announce('¡DERRUMBE! EL TECHO SE DESPRENDE');
  }

  /**
   * Caída de los bloques desprendidos (FallingBlocks): avanzan con el tiempo
   * de simulación, golpean al minero según su velocidad, se parten sobre el
   * carro y se asientan como escombro. El terreno se actualiza al asentarse
   * cada bloque; la luz, el aire y la estabilidad, una vez, cuando todos
   * terminaron (así un derrumbe grande no recalcula el mapa por bloque).
   */
  private updateFalling(dtMs: number): void {
    const s = this.session,
      falling = s.falling;
    if (!falling.active) {
      this.fallingView.update(falling, this.time.now);
      return;
    }
    const body = this.miner.body,
      cart = s.cart;
    const step = falling.step(dtMs, s.grid, {
      // Dentro de la cabaña el minero no está en la mina.
      player:
        this.cabin.open || s.health.dead
          ? null
          : { x: body.left, y: body.top, w: body.width, h: body.height },
      cart: {
        x: cart.x - CART.width / 2,
        y: cart.y + CART.bodyOffset,
        w: CART.width,
        h: CART.height,
      },
    });
    for (const b of step.released)
      // Polvo al soltarse del techo.
      this.effects.impact(b.column * 16 + 8, b.y + 16, true, 0.05);
    const now = this.time.now;
    for (const landed of step.landed) {
      s.visibility.reveal(landed.cell.column, landed.cell.row);
      // Tile y colisión del escombro, de inmediato: el siguiente se apila.
      this.terrain.redraw(landed.cell);
      this.settledCells.push(landed.cell);
      // A lo sumo un golpe sonoro cada 70 ms: muchos bloques no saturan.
      const loud = now - this.lastThudAt >= 70;
      if (loud) this.lastThudAt = now;
      this.effects.rubbleImpact(
        landed.cell.column * 16 + 8,
        (landed.cell.row + 1) * 16,
        landed.block.block,
        loud ? Math.min(0.6, 0.15 + landed.speed / 600) : 0,
        landed.speed > 150,
      );
    }
    for (const broken of step.broken) {
      this.effects.rubbleImpact(
        broken.block.column * 16 + 8,
        broken.block.y + 16,
        broken.block.block,
        0.4,
        false,
      );
      if (broken.by === 'player')
        this.hurt(
          impactDamage(broken.speed, s.loadout.equipped('helmet')),
          'derrumbe',
        );
    }
    this.fallingView.update(falling, now);
    if (!falling.active) this.finishCollapse();
  }

  /** Todo se asentó: un solo recálculo de luz, aire, soportes y estabilidad. */
  private finishCollapse(): void {
    const s = this.session;
    const cells = this.settledCells.splice(0);
    // El golpe del derrumbe castiga a los marcos cercanos: uno debilitado
    // puede ceder y dejar inestable el tramo vecino (derrumbe en cadena, con
    // su propia advertencia de 10 s).
    for (const span of this.collapsing.splice(0)) {
      const zone = shockZone(span);
      s.supports.shock(zone.center, zone.radius);
    }
    s.geotech.suspended = false;
    s.afterTerrainChange(cells);
    this.terrainChanged(cells);
    if (s.health.dead) return;
    this.hud.announce('¡DERRUMBE! RETIRA EL ESCOMBRO CON PALA O PICOTA');
    this.save();
  }
  /** Tronadura: fragmentación irregular ≤ 3×3, daño, polvo y aire viciado. */
  private doBlast(charge: Charge): void {
    const s = this.session;
    const result = s.blasting.explode(charge);
    for (const cell of result.destroyed)
      s.visibility.reveal(cell.column, cell.row);
    const cx = charge.column * 16 + 8,
      cy = charge.row * 16 + 8;
    // Material recuperable: una pila sobre el piso bajo la carga.
    let floor = charge.row;
    while (floor < s.grid.rows - 1 && !s.grid.isSolid(charge.column, floor + 1))
      floor++;
    s.drop(cx, (floor + 1) * 16 - 7, result.materials);
    for (const m of result.materials) {
      if (m !== 'dirt' && m !== 'stone') s.progression.found.add(m);
      if (m === 'alien_ore') this.alienEvent(cx, cy);
    }
    s.supports.shock(charge, BLAST.shockRadius);
    s.geotech.shake(charge, BLAST.shockRadius + 1);
    s.ventilation.pollute(charge);
    s.afterTerrainChange(result.destroyed);
    this.terrainChanged(result.destroyed);
    this.blastFx(cx, cy, result.destroyed);
    // Daño al minero según distancia y roca interpuesta.
    const p = this.miner.body.center;
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d < BLAST.radius) {
      const shield =
        solidLength(s.grid, cx, cy, p.x, p.y) > 16 ? BLAST.shielded : 1;
      const ear = s.loadout.equipped('ear') ? PPE_EFFECT.earBlast : 1;
      this.hurt(
        BLAST.maxDamage * (1 - d / BLAST.radius) * shield * ear,
        'tronadura',
      );
    }
    if (!s.health.dead && !s.ended) {
      for (const [i, m] of result.materials.entries()) {
        const mineral = m === 'dirt' || m === 'stone' ? null : m;
        if (mineral) s.rewardExtraction(result.destroyed[i]!, mineral);
      }
    }
    this.hud.announce(
      `TRONADURA: ${result.destroyed.length} BLOQUES. MATERIAL SUELTO EN EL PISO`,
    );
    this.save();
  }

  /** Destello en anillos de píxeles, polvo, fragmentos y sacudida. */
  private blastFx(x: number, y: number, cells: Cell[]): void {
    const g = this.add.graphics().setDepth(DEPTH.worldUi);
    let frame = 0;
    const draw = () => {
      g.clear();
      const r = 6 + frame * 7;
      for (let a = 0; a < 16; a++) {
        const t = (a / 16) * Math.PI * 2;
        g.fillStyle(
          frame < 2 ? P.white : frame < 3 ? P.cream : P.gold,
        ).fillRect(
          Math.round(x + Math.cos(t) * r),
          Math.round(y + Math.sin(t) * r),
          2,
          2,
        );
      }
      if (frame < 2)
        g.fillStyle(P.cream).fillRect(
          Math.round(x) - 4,
          Math.round(y) - 4,
          8,
          8,
        );
      if (++frame > 4) g.destroy();
    };
    draw();
    this.time.addEvent({
      delay: 60,
      repeat: 4,
      callback: () => g.active && draw(),
    });
    for (const c of cells) {
      this.effects.impact(c.column * 16 + 8, c.row * 16 + 8, false, 0.15);
      this.effects.impact(c.column * 16 + 8, c.row * 16 + 8, true, 0.1);
    }
    const dust = this.add
      .sprite(Math.round(x), Math.round(y) + 8, 'fx-dust', 0)
      .setDepth(DEPTH.foreground);
    dust
      .play('fx-dust')
      .once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => dust.destroy());
    this.cameras.main.shake(320, 0.01);
    this.sound.play('sfx-pick-0', { volume: 1, rate: 0.35 });
    this.sound.play('sfx-shovel-1', { volume: 0.8, rate: 0.5 });
  }

  /**
   * Daño con parpadeo y empuje breve. Se clasifica como leve, grave o letal;
   * el EPP reduce golpes menores, nunca da inmunidad.
   */
  private hurt(
    amount: number,
    source: 'derrumbe' | 'roca' | 'tronadura' | 'gnomo',
    /** Origen horizontal del golpe: empuja al minero hacia el otro lado. */
    fromX?: number,
  ): void {
    const h = this.session.health;
    const taken = h.damage(amount, this.time.now, source);
    if (!taken) return;
    this.miner.setVelocityY(-140);
    this.miner.flash();
    if (fromX !== undefined) this.miner.knock(this.miner.x < fromX ? -1 : 1);
    const label = h.dead ? 'LETAL' : taken >= 40 ? 'GRAVE' : 'LEVE';
    this.hud.announce(
      `DANO ${label} POR ${source.toUpperCase()}: -${Math.round(taken)} SALUD`,
    );
  }

  private handleDeath(): void {
    if (this.deathPending) return;
    this.deathPending = true;
    const s = this.session;
    const player =
      s.mode === 'hardcore' ? { x: this.miner.x, y: this.miner.y } : SPAWN;
    this.cancelWork();
    s.cart.stop();
    s.inCabin = false;
    showDeath(this, s, player, {
      key: 'MiningScene',
      data: { recovery: { session: s, clock: this.time.now } },
    });
  }

  /** Activa o desactiva el modo desmontar (X). */
  private toggleDismantle(force?: boolean): void {
    this.dismantleMode = force ?? !this.dismantleMode;
    this.cancelWork();
    this.buildCell = null;
    this.pendingPlan = null;
    this.safety.showConfirm(null);
    this.input.setDefaultCursor(this.dismantleMode ? 'crosshair' : '');
    this.wrenchCursor.setVisible(this.dismantleMode);
    this.dismantleLabel.setVisible(false);
    this.hud.announce(
      this.dismantleMode
        ? 'MODO DESMONTAR: APUNTA UNA ESTRUCTURA Y HAZ CLIC. X O ESC: SALIR'
        : 'MODO DESMONTAR DESACTIVADO',
    );
  }

  /**
   * Modo desmontar: resalta la estructura apuntada (verde sin riesgo,
   * amarillo con consecuencias, rojo peligrosa o bloqueada), muestra qué se
   * recupera y pide confirmación si el techo quedaría en peligro.
   */
  private updateDismantle(): string {
    const p = this.input.activePointer;
    this.wrenchCursor.setPosition(Math.round(p.x) + 8, Math.round(p.y) + 8);
    const cell = this.target();
    const s = this.session;
    // Nada se revela tras terreno no descubierto.
    const structure = s.visibility.has(cell.column, cell.row)
      ? structureAt(s, cell)
      : null;
    if (!structure) {
      this.dismantleLabel.setVisible(false);
      return 'MODO DESMONTAR: APUNTA UNA VIGA, LUZ, DUCTO, VENTILADOR O RIEL';
    }
    const plan = planDismantle(s, structure);
    const center = TerrainGrid.center(cell);
    const body = this.miner.body.center;
    if (Math.hypot(center.x - body.x, center.y - body.y) > PLAYER.reach + 16) {
      plan.risk = 'blocked';
      plan.notes.unshift('FUERA DE ALCANCE');
    } else if (!this.visible(center)) {
      plan.risk = 'blocked';
      plan.notes.unshift('HAY ROCA ENTRE TU Y LA ESTRUCTURA');
    }
    const color =
      plan.risk === 'ok' ? P.mint : plan.risk === 'warn' ? P.gold : P.red;
    this.selection
      .lineStyle(1, color)
      .strokeRect(cell.column * 16, cell.row * 16, 16, 16);
    const recovered =
      plan.units > 0
        ? `RECUPERAS ${plan.units}`
        : `RECUPERAS 0 (+${Math.round(plan.fraction * 100)}% ACUMULADO)`;
    this.dismantleLabel
      .setVisible(true)
      .setPosition(cell.column * 16 - 20, cell.row * 16 - 10)
      .setText(plan.label)
      .setTint(color);
    const clicked = this.leftClick && !this.hud.blocksWorld(p.x, p.y);
    this.leftClick = false;
    if (clicked) {
      if (plan.risk === 'blocked')
        this.hud.announce(`NO SE PUEDE: ${plan.notes[0]}`);
      else if (plan.confirm) {
        this.pendingPlan = plan;
        this.safety.showConfirm([
          'PELIGRO - SOPORTE ESTRUCTURAL',
          'RETIRAR ESTA VIGA PUEDE PROVOCAR',
          'UN DERRUMBE.',
          `ESTADO RESULTANTE: ${plan.notes[1]?.replace('TECHO QUEDARIA EN ', '') ?? ''}`,
        ]);
      } else this.finishDismantle(plan);
    }
    return `${plan.label} | ${recovered}${plan.notes.length ? ' | ' + plan.notes[0] : ''}`;
  }

  /** Ejecuta el desmontaje y actualiza vista, luz, aire y estabilidad. */
  private finishDismantle(plan: DismantlePlan): void {
    const units = applyDismantle(this.session, plan);
    this.pendingPlan = null;
    this.safety.showConfirm(null);
    if (units < 0) return;
    this.lighting.terrainChanged();
    this.sound.play('sfx-shovel-1', { volume: 0.3, rate: 1.3 });
    const collapse = this.session.geotech.collapses.size;
    this.hud.announce(
      `RETIRADO: ${plan.label} (+${units})` +
        (collapse ? ' | ATENCION: TECHO INESTABLE' : ''),
    );
    this.save();
  }

  /** Fija la modalidad al crear la mina; después no se puede cambiar. */
  private chooseMode(mode: 'normal' | 'hardcore'): void {
    if (this.session.modeChosen) return;
    this.session.mode = mode;
    this.session.modeChosen = true;
    // El nombre escrito (o MINA CERO si quedó vacío) identifica la partida.
    this.session.mineName = this.safety.mineName;
    this.safety.showMode(false);
    this.hud.announce(
      `${this.session.mineName}: ${
        mode === 'hardcore' ? 'MODO HARDCORE, UNA SOLA VIDA.' : 'MODO NORMAL.'
      }${this.introOn ? '' : ' RETIRA EL KIT EN BODEGA'}`,
    );
    this.save();
    // Partida nueva: empieza dentro de la cabaña del abuelo.
    if (this.introOn) this.startIntro();
  }

  /** La mina empieza bajo la superficie natural (incluye la galería). */
  private inMine(cell: Cell = this.playerCell): boolean {
    return cell.row >= surfaceRow(cell.column);
  }

  /** La corta galería de entrada es solo transición: no se extrae de ella. */
  private inTransitionMine(cell: Cell = this.playerCell): boolean {
    return (
      cell.column >= TUNNEL.fromColumn &&
      cell.column <= TUNNEL.toColumn &&
      cell.row >= TUNNEL.topRow &&
      cell.row <= TUNNEL.bottomRow + 1
    );
  }

  /**
   * Control de acceso: sin EPP completo el minero no puede estar bajo la
   * superficie (portal, pozo excavado, salto o partida cargada). Vuelve a
   * la última posición segura y se muestra qué falta.
   */
  private accessControl(): void {
    const l = this.session.loadout;
    const inside = this.inMine();
    if (inside && !l.complete) {
      this.miner.body.reset(this.lastSafe.x, this.lastSafe.y);
      this.miner.setVelocity(0, 0);
      this.session.cart.stop();
      this.cancelWork();
      if (!this.safety.gateVisible) {
        this.safety.showGate((k: PPEKind) => l.equipped(k));
        this.sound.play('sfx-pick-2', { volume: 0.2, rate: 0.6 });
      }
      return;
    }
    if (!inside && this.miner.body.blocked.down)
      this.lastSafe = { x: this.miner.x, y: this.miner.y };
    if (inside && !this.wasInMine) this.unlock('minero_preparado');
    this.wasInMine = inside;
  }

  /** Misión inicial: retirar y equipar el EPP básico. */
  private checkFirstDay(): void {
    const s = this.session;
    if (s.firstDayDone || !s.loadout.complete) return;
    s.firstDayDone = true;
    s.gainXp(XP.quest, 'quest:primer-dia');
    this.unlock('primer_dia_seguro');
    this.hud.announce(
      'MISION COMPLETA: TU PRIMER DIA. YA PUEDES ENTRAR A LA MINA',
    );
  }

  /**
   * V9: región del minero. La primera vez que pisa un bioma se anuncia y se
   * guarda; la región actual y las visitadas viajan en la partida.
   */
  private trackRegion(): void {
    if (this.session.inCabin || !this.miner.visible) return;
    const found = this.session.regions.enter(biomeAtX(this.miner.x));
    if (!found) return;
    this.hud.announce(`NUEVA REGION: ${biomeDef(found).name}`);
    this.save();
  }

  /** Logro con notificación, una sola vez por partida. */
  private unlock(id: AchievementId): void {
    if (!this.session.achievements.unlock(id)) return;
    const a = ACHIEVEMENTS[id];
    this.hud.celebrate(a.title, a.text);
    this.sound.play('sfx-collect', { volume: 0.4, rate: 1.2 });
    this.save();
  }

  /** Barra rápida: equipa la herramienta o activa el suministro. */
  private activateQuick(index: number): void {
    // V8: un alimento en la barra se come de inmediato (no cambia lo equipado).
    const ref = this.session.loadout.quickbar[index];
    if (ref?.type === 'supply' && isFood(ref.kind)) {
      this.consumeFood(ref.kind);
      return;
    }
    this.cancelWork();
    // El bloque elegido se conserva al cambiar de herramienta (clic derecho
    // sigue colocándolo): la barra marca la herramienta y el HUD el bloque.
    const keepBlock =
      ref?.type === 'tool' &&
      this.hud.activeSupply &&
      isBuildMaterial(this.hud.activeSupply)
        ? this.hud.activeSupply
        : null;
    this.session.loadout.selectQuick(index);
    this.hud.activeSupply = null;
    this.syncQuickSupply();
    if (keepBlock) this.hud.activeSupply = keepBlock;
    this.save();
  }

  private useManualSupply(kind: SupplyKind | null): void {
    const l = this.session.loadout;
    if (l.activeQuick?.type !== 'tool') l.selectedQuick = null;
    this.quickSupply = null;
    this.hud.activeSupply = kind;
  }

  private syncQuickSupply(): void {
    const s = this.session;
    s.loadout.syncQuick();
    const ref = s.loadout.activeQuick;
    if (ref?.type === 'supply')
      this.hud.activeSupply = this.quickSupply = ref.kind;
    else {
      if (this.quickSupply && this.hud.activeSupply === this.quickSupply)
        this.hud.activeSupply = null;
      this.quickSupply = null;
    }
    // Un material elegido sigue activo aun en cero (la barra lo conserva).
    if (
      this.hud.activeSupply &&
      s.supplies[this.hud.activeSupply] <= 0 &&
      !isBuildMaterial(this.hud.activeSupply)
    )
      this.hud.activeSupply = null;
  }

  private cartNearForSale(): boolean {
    const cart = this.session.cart;
    return (
      !this.cabin.open &&
      Math.hypot(cart.x - this.miner.x, cart.y + 4 - this.miner.body.bottom) <=
        36
    );
  }

  /**
   * Pago del pedido del celular: solo se cobra si el pedido entra a la cola
   * y la partida se guarda con él (dinero y pedido en el mismo guardado, sin
   * duplicados al cargar). Devuelve el motivo del rechazo («|» separa líneas).
   */
  private payDroneOrder(order: PhoneOrder): string | null {
    const s = this.session;
    const full = s.drones.canPlace();
    if (full) return full;
    if (!s.infiniteMoney && s.money < order.total)
      return `SALDO INSUFICIENTE.|FALTAN $${order.total - s.money}.`;
    const placed = s.drones.place(
      order.lines.map((l) => ({ kind: l.id, qty: l.qty })),
      order.total,
      Date.now(),
      {
        scene: 'MiningScene',
        x: Math.round(this.miner.x),
        y: Math.round(this.miner.body.bottom),
      },
    );
    const paid = s.infiniteMoney ? 0 : order.total;
    s.money -= paid;
    if (!this.save()) {
      s.drones.cancel(placed.id);
      s.money += paid;
      return 'NO SE PUDO GUARDAR.|NO SE COBRO NADA.';
    }
    this.hud.announce(
      `PEDIDO ${placed.id} PAGADO ($${order.total}). EL DRON DESPEGA EN 20 S`,
    );
    return null;
  }

  /** E abre la caja sin transferir nada; el retiro es manual. */
  private openSupplyBox(id: number): void {
    this.cancelWork();
    this.droneBox.show(id);
  }

  /** El celular solo se abre sin otra ventana, diálogo ni descanso en curso. */
  private phoneAvailable(): boolean {
    return (
      this.session.modeChosen &&
      !this.session.ended &&
      !this.cabin.sleeping &&
      !this.hud.modal &&
      !this.inventory.open &&
      !this.droneBox.open &&
      !this.fridge.open &&
      !this.dialog.open &&
      !this.book.open &&
      !this.safety.modeOpen &&
      !this.safety.confirmOpen
    );
  }

  /** Viste al minero con su EPP real en cualquier hoja y cuadro. */
  private applyLook(): void {
    const mask = lookMask((k: PPEKind) => this.session.loadout.equipped(k));
    const key = ensureLook(this, baseOf(this.miner.texture.key), mask);
    if (this.miner.texture.key !== key)
      this.miner.setTexture(key, this.miner.frame.name);
  }
  /** Evento secreto: una sola vez por partida, guardado como logro. */
  private alienEvent(x: number, y: number): void {
    const achievements = this.session.achievements;
    // Con códigos usados el evento se ve igual (una vez por sesión), sin logro.
    if (achievements.disabled) {
      if (this.alienSeen || achievements.unlocked.has('no_estamos_solos'))
        return;
      this.alienSeen = true;
    } else if (!achievements.unlock('no_estamos_solos')) return;
    const a = ACHIEVEMENTS.no_estamos_solos;
    const g = this.add.graphics().setDepth(DEPTH.worldUi);
    let frame = 0;
    this.time.addEvent({
      delay: 70,
      repeat: 16,
      callback: () => {
        g.clear();
        for (let ring = 0; ring < 3; ring++) {
          const r = ((frame * 4 + ring * 12) % 40) + 4;
          for (let k = 0; k < 20; k++) {
            const t = (k / 20) * Math.PI * 2 + frame * 0.1;
            g.fillStyle(ring % 2 ? P.mint : P.teal).fillRect(
              Math.round(x + Math.cos(t) * r),
              Math.round(y + Math.sin(t) * r * 0.7),
              1,
              1,
            );
          }
        }
        if (++frame > 16) g.destroy();
      },
    });
    this.sound.play('sfx-collect', { volume: 0.5, rate: 0.5 });
    this.time.delayedCall(250, () =>
      this.sound.play('sfx-collect', { volume: 0.4, rate: 0.75 }),
    );
    this.hud.celebrate(
      achievements.disabled ? 'SIN LOGRO: CODIGOS USADOS' : a.title,
      a.text,
    );
    this.save();
  }

  private checkProgress(): void {
    const s = this.session;
    // Ingeniero previsor: jornadas sin derrumbes con la mina sostenida.
    if (
      s.supports.items.filter((x) => x.durability > 0).length >=
        ENGINEER_SUPPORTS + 2 &&
      s.stats.playMs - s.stats.lastCollapseMs >= ENGINEER_DAYS * DAY_MS
    )
      this.unlock('ingeniero_previsor');
    const tier = s.progression.update();
    if (tier) {
      s.gainXp(XP.tier, `tier:${tier}`);
      if (tier === 3 && s.mode === 'hardcore') this.unlock('hasta_el_final');
      this.hud.announce(
        `ETAPA ${tier} DESBLOQUEADA: ${TIERS[tier].name}. NUEVOS EQUIPOS EN EL CELULAR (U)`,
      );
      this.sound.play('sfx-collect', { volume: 0.4, rate: 1.3 });
      this.save();
    }
  }

  /** Sistemas con reloj: derrumbes, mechas, desgaste, aire y salud. */
  private tickSystems(dtMs: number, now: number, gameNow: number): void {
    const s = this.session;
    for (const collapse of s.geotech.tick(
      dtMs,
      s.falling.room,
      !s.falling.active,
    ))
      this.doCollapse(collapse.span);
    this.updateFalling(dtMs);
    if (s.health.dead) return this.handleDeath();
    for (const charge of s.blasting.due(gameNow)) {
      this.doBlast(charge);
      if (s.health.dead) return this.handleDeath();
    }
    this.second += dtMs;
    if (this.second >= 1000) {
      const seconds = this.second / 1000;
      this.second = 0;
      for (const broken of s.supports.age(seconds))
        this.hud.announce(
          `UNA ${broken.kind === 'wood' ? 'VIGA DE MADERA' : 'VIGA DE ACERO'} SE ROMPIO`,
        );
      for (const out of s.lights.burn(seconds * 1000))
        this.hud.announce(
          `${out.kind === 'torch' ? 'UNA ANTORCHA' : 'UN FARO'} SE APAGO`,
        );
      s.ventilation.decay(seconds * 1000);
      s.ventilation.evaluate();
      s.geotech.evaluate();
      const pc = this.playerCell;
      if (pc.row > s.progression.deepestRow && this.miner.body.blocked.down)
        s.progression.deepestRow = pc.row;
      this.checkProgress();
    }
    // Señales de inestabilidad: polvo y crujidos en tramos peligrosos cercanos.
    if (now - this.hazardFxAt > 1300) {
      this.hazardFxAt = now;
      const pc = this.playerCell;
      const near = s.geotech.spans.filter(
        (sp) =>
          (sp.state === StabilityState.Danger ||
            sp.state === StabilityState.Imminent) &&
          Math.abs(sp.roof - pc.row) < 10 &&
          sp.to >= pc.column - 14 &&
          sp.from <= pc.column + 14,
      );
      for (const sp of near) {
        const c = sp.from + Math.floor(Math.random() * (sp.to - sp.from + 1));
        this.effects.impact(c * 16 + 8, (sp.roof + 1) * 16, true, 0.05);
      }
      if (near.length)
        this.sound.play('sfx-pick-1', { volume: 0.12, rate: 0.5 });
    }
    // Calidad del aire donde respira el minero.
    const pc = this.playerCell;
    const underground = pc.row >= surfaceRow(pc.column);
    const q = s.ventilation.at(pc.column, pc.row);
    const air = airStateOf(q);
    const exp = VENTILATION.exposure;
    this.tickSurvival(dtMs, gameNow);
    let airFactor = 1;
    if (
      underground &&
      (air === AirState.Dangerous || air === AirState.Emergency)
    ) {
      const before = this.exposure;
      this.exposure += dtMs;
      if (before === 0)
        this.hud.announce('⚠ AIRE PELIGROSO - REGRESA A UNA ZONA SEGURA');
      if (this.exposure > exp.graceMs) {
        const emergency = air === AirState.Emergency;
        airFactor = emergency ? exp.slow.emergency : exp.slow.dangerous;
        s.health.damage(
          ((emergency ? exp.damage.emergency : exp.damage.dangerous) * dtMs) /
            1000,
          gameNow,
          'aire',
        );
      }
    } else {
      this.exposure = Math.max(0, this.exposure - dtMs * 2);
      // V8: sin energía o sin alimento la salud no se recupera sola.
      if (
        air === AirState.Adequate &&
        gameNow - s.health.lastHitAt > 5000 &&
        s.survival.regenAllowed
      )
        s.health.heal((HEALTH.regen * dtMs) / 1000);
    }
    this.miner.speedFactor = airFactor * s.survival.speedFactor;
    if (s.health.dead) return this.handleDeath();
    // Parpadeo durante la protección tras un golpe (sin alfa parcial).
    this.miner.setVisible(
      gameNow >= s.health.invulnerableUntil ||
        Math.floor(gameNow / 80) % 2 === 0,
    );
    // Franja de estado bajo tierra y alarma con mayor prioridad.
    const span = s.geotech.around(pc, 3);
    const fans = s.ventilation.status;
    this.hud.stripText = underground
      ? `AIRE ${air} | TECHO ${span?.state ?? StabilityState.Stable}` +
        (fans.length
          ? ` | EQUIPOS ${fans.filter((f) => f.running).length}/${fans.length}`
          : '')
      : '';
    this.lighting.helmet = s.loadout.equipped('helmet');
    const lit = s.blasting.charges.find((c) => c.endsAt !== null);
    const collapse = [...s.geotech.collapses.values()]
      .filter(
        (c) =>
          Math.abs(c.span.roof - pc.row) < 12 &&
          c.span.to >= pc.column - 16 &&
          c.span.from <= pc.column + 16,
      )
      .sort((a, b) => a.remaining - b.remaining)[0];
    this.hud.alarmText = lit
      ? `⚠ PELIGRO: ALEJATE DE LA ZONA DE TRONADURA - ${Math.max(0, Math.ceil((lit.endsAt! - gameNow) / 1000))} S`
      : collapse
        ? `⚠ PELIGRO: GALERIA INESTABLE - DERRUMBE EN: ${Math.ceil(collapse.remaining / 1000)} SEGUNDOS`
        : underground && air === AirState.Emergency
          ? '⚠ EMERGENCIA AMBIENTAL - SAL DE INMEDIATO'
          : underground && air === AirState.Dangerous
            ? '⚠ AIRE PELIGROSO - REGRESA A UNA ZONA SEGURA'
            : '';
  }

  // ---------- «La herencia del abuelo»: primera secuencia jugable ----------

  /** Diálogo breve y omitible (Esc); `then` corre al terminar o al omitir. */
  private introSay(pages: readonly DialogPage[], then?: () => void): void {
    this.cancelWork();
    this.session.cart.stop();
    this.ignorePointer = true;
    this.dialog.show(pages, () => {
      this.ignorePointer = true;
      // La pulsación que cierra un diálogo no debe activar lo que hay debajo.
      this.interactLockUntil = this.time.now + 250;
      then?.();
    });
  }

  /** Partida nueva con la secuencia activa: empieza dentro de la cabaña. */
  private startIntro(): void {
    this.session.intro.start();
    if (this.campVisit && this.scene.get('TopDownCabinScene')) {
      this.openTopDownCabin();
      return;
    }
    this.enterCabin(true);
    this.cabin.setBoard('hidden', this.time.now);
    this.save();
    this.showWelcome();
  }

  private openTopDownCabin(): void {
    const session = this.session;
    session.inCabin = false;
    session.topDownCabin = { inside: true, position: CABIN_DOOR };
    this.scene.start('TopDownCabinScene', {
      session,
      player: { x: this.miner.x, y: this.miner.y },
    });
  }

  /** Diálogo inicial sobre la herencia; también se retoma si se recarga durante él. */
  private showWelcome(): void {
    this.introSay(INTRO_DIALOGS.welcome, () => {
      if (this.session.intro.welcomeDone()) this.onIntroStep('tools');
    });
  }

  /** El cajón de la bodega guarda la picota y la pala del abuelo (gratis, una vez). */
  private openToolbox(): void {
    const s = this.session;
    if (s.intro.step !== 'tools') return;
    if (s.loadout.free() < 1) {
      this.hud.announce('INVENTARIO LLENO: LIBERA UNA CASILLA');
      return;
    }
    s.tools.add('shovel');
    s.tools.add('iron');
    s.loadout.sync();
    this.sound.play('sfx-collect', { volume: 0.3, rate: 1.2 });
    this.introSay(INTRO_DIALOGS.tools, () => {
      if (s.intro.toolsFound()) this.onIntroStep('kit');
    });
  }

  private enterGallery(): void {
    const s = this.session;
    if (!s.loadout.complete) {
      this.safety.showGate((k: PPEKind) => s.loadout.equipped(k));
      return;
    }
    if (s.intro.step === 'mine') {
      this.inspectMine();
      return;
    }
    this.crossPortal();
  }

  private crossPortal(): void {
    this.cancelWork();
    this.session.cart.stop();
    this.unlock('minero_preparado');
    this.session.beginExpedition();
    crossFog(this, this.transitionPortal, this.miner, EXPEDITION_SCENE, {
      session: this.session,
      player: { x: this.miner.x, y: this.miner.y },
      fromSurface: true,
      fromFog: true,
    });
  }

  private inspectMine(): void {
    const s = this.session;
    if (s.intro.step !== 'mine') return;
    this.introSay(INTRO_DIALOGS.mine, () => {
      if (s.intro.mineInspected(s.stats.mined)) this.onIntroStep('dig');
      this.crossPortal();
    });
  }

  /** Avisos breves al cambiar de paso (la guía de una línea ya indica qué sigue). */
  private onIntroStep(step: IntroStep): void {
    const notes: Partial<Record<IntroStep, string>> = {
      kit: 'HERRAMIENTAS DEL ABUELO LISTAS',
      mine: 'EQUIPO DE SEGURIDAD COMPLETO',
      dig: 'ENTRA A LA MINA CON LA PICOTA EQUIPADA',
    };
    if (notes[step]) this.hud.announce(notes[step]!);
    if (step === 'home') {
      this.hud.celebrate(
        'PRIMERA EXTRACCION',
        'UN BLOQUE MENOS EN LA MINA DEL ABUELO.',
        'HITO',
      );
      this.sound.play('sfx-collect', { volume: 0.4, rate: 1.2 });
    }
    this.save();
  }

  /** Avance automático por el estado del juego (herramientas, equipo, excavación). */
  private introTick(): void {
    const s = this.session;
    if (!s.intro.active || !s.modeChosen || s.ended) return;
    // No se anuncia nada mientras hay un diálogo o el libro abierto.
    if (this.dialog.open || this.book.open) return;
    const step = s.intro.update({
      hasTools: s.tools.hasPick() && !!s.tools.usable('shovel'),
      kitReady: s.loadout.complete,
      mined: s.stats.mined,
    });
    if (step) this.onIntroStep(step);
  }

  /** Tabla, flecha y objetivo de la guía según el paso actual. */
  private syncIntro(now: number, modal: boolean, snap = false): void {
    const s = this.session;
    const intro = s.intro;
    this.cabin.setBoard(intro.boardState, snap ? -1e9 : now);
    const show =
      intro.active && !intro.hintsOff && s.modeChosen && !s.ended && !modal;
    const inside = this.cabin.open;
    const step = intro.step;
    this.cabin.setMarker(
      show && inside
        ? step === 'board' || step === 'book'
          ? 'board'
          : ['tools', 'kit', 'mine', 'dig'].includes(step)
            ? 'exit'
            : null
        : null,
    );
    const where: Record<string, { x: number; y: number }> = {
      toolbox: { x: TOOLBOX_X, y: 128 },
      warehouse: { x: WAREHOUSE_X, y: 118 },
      mine: { x: MINE_ENTRANCE_X + 12, y: 84 },
      cabinDoor: { x: CAMP_LAYOUT.doorX, y: 116 },
    };
    const target = INTRO_TARGETS[step];
    this.guide.update(
      now,
      step,
      show,
      show && !inside && target && where[target] ? where[target]! : null,
    );
  }

  /** Al volver a la cabaña tras la primera extracción, la tabla cruje y se suelta. */
  private onCabinEntered(): void {
    if (!this.session.intro.cabinEntered()) return;
    this.cabin.setBoard('loose', this.time.now);
    this.sound.play('sfx-shovel-0', { volume: 0.25, rate: 0.45 });
    this.onIntroStep('board');
    this.introSay(INTRO_DIALOGS.home);
  }

  /** E sobre la tabla: se levanta y aparece el libro del abuelo. */
  private examineBoard(): void {
    const s = this.session;
    if (!s.intro.boardExamined()) return;
    this.cabin.setBoard('open', this.time.now);
    this.sound.play('sfx-shovel-1', { volume: 0.3, rate: 0.6 });
    this.onIntroStep('book');
    this.introSay(INTRO_DIALOGS.board, () => this.readBook());
  }

  /** Primera página del libro; leerla cierra la secuencia (y se puede releer). */
  private readBook(): void {
    this.cancelWork();
    this.ignorePointer = true;
    this.book.show(() => {
      this.ignorePointer = true;
      this.interactLockUntil = this.time.now + 250;
      if (!this.session.intro.bookRead()) return;
      this.hud.celebrate(
        'EL LIBRO DEL ABUELO',
        'HAY MINERALES QUE NINGÚN CATÁLOGO RECUERDA.',
        'HALLAZGO',
      );
      this.sound.play('sfx-collect', { volume: 0.4, rate: 0.9 });
      this.save();
    });
  }

  // ---------- V8: pabellón, comida y supervivencia ----------

  /** Entra al pabellón: la figura aparece junto a la puerta interior. */
  enterCabin(silent = false): void {
    this.cancelWork();
    this.session.cart.stop();
    this.buildCell = null;
    if (this.dismantleMode) this.toggleDismantle(false);
    this.hud.close();
    this.session.inCabin = true;
    this.miner.body.reset(CAMP_LAYOUT.doorX, SPAWN.y);
    this.miner.setVelocity(0, 0);
    this.cabin.show();
    this.ignorePointer = true;
    if (silent) return;
    this.sound.play('sfx-shovel-0', { volume: 0.2, rate: 0.7 });
    this.hud.announce(
      'CABAÑA: A/D PARA MOVERTE. JUNTO A LA CAMA, E PARA DESCANSAR',
    );
    this.onCabinEntered();
    this.save();
  }

  /** Sale del pabellón por la puerta, al pie de los escalones. */
  exitCabin(): void {
    if (!this.cabin.open) return;
    this.cabin.hide();
    this.session.inCabin = false;
    this.miner.body.reset(CAMP_LAYOUT.doorX, SPAWN.y);
    this.miner.setVisible(true).setFlipX(false);
    this.sound.play('sfx-shovel-0', { volume: 0.2, rate: 0.7 });
    this.save();
  }

  /** Z dentro del pabellón: salir, revisar el casillero o descansar. */
  private cabinAction(): void {
    const action = this.cabin.action();
    const s = this.session;
    if (action === 'exit') this.exitCabin();
    else if (
      action === 'calendar' ||
      action === 'stove' ||
      action === 'window' ||
      action === 'shelf'
    )
      this.hud.announce(CABIN_NOTES[action]);
    else if (action === 'fridge') this.openFridge();
    else if (action === 'board') this.examineBoard();
    else if (action === 'book') this.readBook();
    else if (action === 'locker') {
      const last = s.survival.lastSleep;
      this.hud.say(
        'CASILLERO',
        `ENERGIA ${s.survival.energyUnits}/5 (${s.survival.energyState}). ` +
          `ALIMENTACION ${s.survival.hungerUnits}/5 (${s.survival.hungerState}). ` +
          (last
            ? `ULTIMO DESCANSO: JORNADA ${Math.floor(last.playMs / DAY_MS) + 1}, DESPERTASTE DE ${last.woke === 'day' ? 'DIA' : 'NOCHE'}.`
            : 'AUN NO HAS DORMIDO AQUI.'),
      );
    } else if (action === 'sleep') {
      const reason = s.survival.canSleep();
      if (reason) {
        this.hud.announce(reason);
        return;
      }
      this.inventory.close();
      this.cabin.startSleep(this.time.now);
    }
  }

  /**
   * Comer o beber: una unidad del inventario, animación breve (no bloquea
   * controles), HUD y texto flotante sin fondo.
   */
  consumeFood(kind: FoodKind): string {
    if (this.cabin?.sleeping) return '';
    const result = this.session.eat(kind);
    if (!result.ok) {
      this.hud.announce(result.message);
      return result.message;
    }
    const now = this.time.now;
    playFoodSound(this, kind);
    this.lastUnits = {
      energy: this.session.survival.energyUnits,
      hunger: this.session.survival.hungerUnits,
    };
    if (this.cabin.open) this.cabin.eat(kind, now);
    else {
      this.eating?.image.destroy();
      this.eating = {
        kind,
        until: now + 800,
        image: this.add
          .image(0, 0, 'v8-items', `${kind}_hand`)
          .setDepth(DEPTH.characters + 1),
      };
    }
    this.floatText(result.message, FOODS[kind].drink ? P.gold : P.mint);
    this.syncQuickSupply();
    this.save();
    return result.message;
  }

  /** Texto flotante pequeño, sin fondo, que sube y desaparece de golpe. */
  private floatText(text: string, color: number): void {
    const inside = this.cabin.open;
    const x = inside ? this.cabin.puppetX : Math.round(this.miner.x);
    const y = inside ? 206 - 30 : Math.round(this.miner.body.top) - 10;
    const label = pixelText(
      this,
      Math.round(x - (text.length * 6) / 2),
      y,
      text,
      color,
    )
      .setDepth(inside ? DEPTH.ui + 6 : DEPTH.worldUi + 4)
      .setScrollFactor(inside ? 0 : 1);
    let step = 0;
    this.time.addEvent({
      delay: 70,
      repeat: 13,
      callback: () => {
        if (!label.active) return;
        if (++step >= 14) label.destroy();
        else if (step % 2 === 0) label.setY(label.y - 1);
      },
    });
  }

  /** Gesto de comer/beber del minero en el mundo: el alimento sube a la boca. */
  private updateEating(now: number): void {
    const e = this.eating;
    if (!e) return;
    if (now >= e.until || this.cabin.open) {
      e.image.destroy();
      this.eating = null;
      return;
    }
    const p = 1 - (e.until - now) / 800;
    const dx = this.miner.flipX ? -1 : 1;
    e.image
      .setVisible(this.miner.visible)
      .setFlipX(this.miner.flipX)
      .setPosition(
        Math.round(this.miner.x) + dx * (p < 0.3 ? 6 : 4),
        Math.round(this.miner.y) +
          (p < 0.3 ? 3 : -4) +
          (p > 0.4 && Math.floor(now / 120) % 2 ? 1 : 0),
      );
  }

  /**
   * Energía y hambre: consumo por caminar o empujar carga, hambre con el
   * tiempo, daño gradual por agotamiento o desnutrición y avisos al cruzar
   * los umbrales (una vez y un recordatorio espaciado, sin tapar la vista).
   */
  private tickSurvival(dtMs: number, gameNow: number): void {
    const s = this.session,
      v = s.survival;
    const cart = s.cart;
    const walking = this.cabin.open
      ? this.cabin.state === 'idle' && this.miner.direction !== 0
      : this.miner.body.blocked.down &&
        Math.abs(this.miner.body.velocity.x) > 5;
    v.tick(this.cabin.sleeping ? 0 : dtMs, {
      walking,
      pushingLoaded:
        cart.pushing &&
        cart.inventory.items.length > 0 &&
        Math.abs(cart.velocity) > 1,
    });
    const owed = v.takeDamage();
    if (owed.agotamiento > 0) {
      s.health.damage(owed.agotamiento, gameNow, 'agotamiento');
      if (gameNow - this.hurtNoticeAt > 8000) {
        this.hurtNoticeAt = gameNow;
        this.hud.announce(
          '⚠ SIN ENERGIA, EL ESFUERZO TE QUITA SALUD. DESCANSA',
        );
      }
    }
    if (owed.hambre > 0) {
      s.health.damage(owed.hambre, gameNow, 'hambre');
      if (gameNow - this.hurtNoticeAt > 15_000) {
        this.hurtNoticeAt = gameNow;
        this.hud.announce('⚠ LA DESNUTRICION TE QUITA SALUD. COME ALGO');
      }
    }
    this.miner.tired = v.energyUnits <= 1;
    const e = v.energyUnits,
      h = v.hungerUnits;
    const energyText = [
      '⚠ AGOTAMIENTO EXTREMO - NECESITAS DESCANSAR',
      'ESTAS AGOTADO: DUERME EN LA CABAÑA, AL OESTE DE LA BODEGA',
      'TE SIENTES CANSADO',
    ];
    const hungerText = [
      '⚠ TIENES HAMBRE - NECESITAS COMER',
      'HAMBRE INTENSA: COMPRA COMIDA CON U',
      'TIENES HAMBRE',
    ];
    if (e < this.lastUnits.energy && e <= 2) {
      this.hud.announce(energyText[e]!);
      this.survivalNoticeAt = gameNow;
    }
    if (h < this.lastUnits.hunger && h <= 2) {
      this.hud.announce(hungerText[h]!);
      this.survivalNoticeAt = gameNow;
    }
    if (
      (e === 0 || h === 0) &&
      gameNow - this.survivalNoticeAt > SURVIVAL.reminderMs
    ) {
      this.survivalNoticeAt = gameNow;
      this.hud.announce(e === 0 ? energyText[0]! : hungerText[0]!);
    }
    this.lastUnits = { energy: e, hunger: h };
  }

  // ---------- V9: linterna frontal direccional y batería ----------

  /** Cambio de batería por tecla o «Usar» en el inventario. */
  replaceBattery(): string {
    const msg = this.session.replaceHeadlamp();
    this.hud.announce(msg);
    if (msg.startsWith('BATERIA REEMPLAZADA')) {
      this.sound.play('sfx-collect', { volume: 0.3, rate: 1.4 });
      this.save();
    }
    return msg;
  }

  /**
   * Consumo de la batería: solo con el haz realmente encendido (potencia
   * > 0; incluye el desvanecido breve al encender o apagar) y solo cuando
   * el mundo corre: menús, pausa del desarrollador y pestaña oculta no
   * gastan. Los avisos de umbral se emiten una sola vez por evento.
   */
  private tickHeadlamp(dtMs: number): void {
    const lamp = this.session.headlamp;
    // Como la supervivencia: el descanso en el pabellón no gasta batería.
    lamp.tick(this.cabin?.sleeping ? 0 : dtMs, this.lighting.lamp.power > 0);
    if (lamp.takeLowNotice())
      this.hud.announce('⚠ BATERIA BAJA: 20% DE CARGA. CAMBIALA CON B');
    if (lamp.takeDrainedNotice())
      this.hud.announce('⚠ BATERIA AGOTADA: LA LINTERNA SE APAGO');
  }

  /**
   * Recursos que el servidor no entregó (se reinició, se cayó la conexión):
   * hasta tres reintentos con espera creciente; después, un aviso claro en el
   * lienzo y en la consola. Nunca se juega con texturas de reemplazo.
   */
  private handleMissingAssets(missing: string[]): void {
    createPixelFont(this);
    const attempt = ++MiningScene.loadAttempts;
    const status = document.querySelector('#game-status');
    const g = this.add.graphics().setScrollFactor(0);
    g.fillStyle(P.ink).fillRect(0, 0, VIEW.width, VIEW.height);
    if (attempt <= 3) {
      pixelText(
        this,
        150,
        128,
        `RECARGANDO RECURSOS (${attempt}/3)...`,
        P.cream,
      );
      if (status) status.textContent = 'Recargando recursos del juego…';
      this.time.delayedCall(600 * attempt, () =>
        this.scene.restart({
          campVisit: this.campVisit,
          recovery: this.recovery,
          fresh: this.fresh,
        }),
      );
      return;
    }
    console.error(`[DEEPKIN] Recursos sin cargar: ${missing.join(', ')}`);
    if (status)
      status.textContent = 'No se pudieron cargar los recursos del juego';
    pixelText(
      this,
      60,
      92,
      'NO SE PUDIERON CARGAR LOS RECURSOS DEL JUEGO',
      P.red,
    );
    pixelText(
      this,
      60,
      112,
      wrapText(missing.slice(0, 8).join(', ').toUpperCase(), 58),
      P.silver,
    ).setLineSpacing(3);
    pixelText(this, 60, 168, 'REVISA QUE EL SERVIDOR ESTÉ EN MARCHA', P.cream);
    pixelText(this, 60, 180, 'Y RECARGA LA PÁGINA (F5).', P.cream);
  }

  private stepSurface(): StepSurface {
    const { x, body } = this.miner;
    const { column, row } = TerrainGrid.worldToCell(x, body.bottom + 1);
    const ground = this.session.grid.get(column, row);
    if (this.session.rails.has(column, row - 1)) return 'metal';
    if (ground === Block.Wood) return 'wood';
    if (this.inMine())
      return ground === Block.Dirt
        ? 'dirt'
        : ground === Block.Rubble
          ? 'gravel'
          : 'stone';
    // Todo el exterior es desierto: tierra, salvo la roca de los cerros.
    return biomeAtX(x) === 'hills' ? 'stone' : 'dirt';
  }

  update(_time: number, deltaMs: number): void {
    if (!this.ready || this.deathPending) return;
    this.transitionPortal.update(this.time.now);
    if (!this.input.enabled) return;
    if (this.session.health.dead || this.session.ended) {
      this.handleDeath();
      return;
    }
    this.worldAudio.update(
      deltaMs,
      this.miner.x,
      this.session.dayNight.sunStrength,
      this.cabin.open ? 'cabin' : this.inMine() ? 'mine' : 'outdoors',
    );
    if (this.developerConsole?.open) {
      this.cartAudio.stop();
      return;
    }
    const now = performance.now(),
      dt = Math.min(0.05, (now - this.lastClock) / 1000);
    if (now - this.lastClock > 500) this.cancelWork();
    this.lastClock = now;
    this.selection.clear();
    this.crack.setVisible(false);
    this.progressLabel.setVisible(false);
    this.drillTool.setVisible(false);
    const has = (key: string) => this.pressed.has(key);
    if (!this.input.activePointer.leftButtonDown()) this.ignorePointer = false;
    // Pantalla de nueva expedición: primero, para que las letras del nombre
    // (M, F, R, H, Z…) no disparen acciones del juego.
    if (this.safety.modeOpen) {
      if (has('ONE')) this.chooseMode('normal');
      else if (has('TWO')) this.chooseMode('hardcore');
      this.pressed.clear();
    }
    // T oculta o muestra la guía de la primera secuencia (no los diálogos).
    if (
      has('T') &&
      this.session.intro.active &&
      !this.dialog.open &&
      !this.book.open
    ) {
      this.hud.announce(
        this.session.intro.toggleHints()
          ? 'GUIA ACTIVADA'
          : 'GUIA OCULTA: T PARA VOLVER A MOSTRARLA',
      );
      this.save();
    }
    if (this.warehouse.open) {
      if (has('ESC')) this.warehouse.close();
      if (has('SAVE')) this.save();
      this.pressed.clear();
      this.miner.step(true);
      this.cancelWork();
      return;
    }
    if (this.droneBox.open) {
      for (const key of ['ESC', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'ENTER', 'Z'])
        if (has(key)) this.droneBox.key(key);
      this.pressed.clear();
      this.miner.step(true);
      this.cancelWork();
      return;
    }
    // Refrigerador abierto: ventana modal como la bodega (el reloj no corre).
    if (this.fridge.open) {
      if (has('ESC') || has('INVENTORY')) this.fridge.close();
      if (has('SAVE'))
        this.hud.announce(
          this.save() ? 'PARTIDA GUARDADA' : 'ERROR AL GUARDAR',
        );
      this.pressed.clear();
      this.miner.step(true);
      this.cancelWork();
      return;
    }
    // Celular: U abre y cierra, Esc cierra. Mientras está abierto sus
    // teclas no llegan al juego, pero el mundo sigue (reloj, hambre, luz).
    if (this.phone.open && (has('PHONE') || has('ESC'))) {
      this.phone.close();
      this.pressed.clear();
    } else if (has('PHONE') && this.phoneAvailable()) {
      this.cancelWork();
      this.session.cart.stop();
      this.buildCell = null;
      this.phone.show(now);
    }
    if (this.phone.open) {
      this.pressed.clear();
      this.ignorePointer = true;
    }
    if (has('M')) {
      this.sound.mute = !this.sound.mute;
      this.hud.announce(this.sound.mute ? 'SONIDO APAGADO' : 'SONIDO ACTIVO');
    }
    if (has('SAVE'))
      this.hud.announce(this.save() ? 'PARTIDA GUARDADA' : 'ERROR AL GUARDAR');
    if (has('R')) this.returnToSurface();
    if (has('H')) {
      this.cancelWork();
      this.session.cart.stop();
      this.hud.toggleHelp();
    }
    // Esc abre la pausa solo si no tiene nada que cerrar o cancelar antes.
    if (
      has('ESC') &&
      !this.deathPending &&
      !this.hud.modal &&
      !this.inventory.open &&
      !this.safety.confirmOpen &&
      !this.safety.modeOpen &&
      !this.dialog.open &&
      !this.book.open &&
      !this.dismantleMode &&
      !this.cabin.sleeping &&
      this.buildCell === null
    ) {
      this.openPause();
      return;
    }
    if (has('ESC') && this.cabin.cancelSleep())
      this.hud.announce('DESCANSO CANCELADO');
    if (has('ESC')) {
      this.hud.close();
      this.inventory.close();
      this.cancelWork();
      this.buildCell = null;
      this.session.cart.stop();
      this.ignorePointer = true;
    }
    // Confirmación de desmontaje y fin de expedición.
    if (this.safety.confirmOpen) {
      if (has('ENTER') && this.pendingPlan)
        this.finishDismantle(this.pendingPlan);
      else if (has('ESC')) {
        this.pendingPlan = null;
        this.safety.showConfirm(null);
        this.hud.announce('DESMONTAJE CANCELADO');
      }
      this.pressed.delete('ESC');
    } else if (has('ESC') && this.dismantleMode) this.toggleDismantle(false);
    if (
      has('INVENTORY') &&
      !this.cabin.sleeping &&
      !this.hud.helpOpen &&
      !this.safety.modeOpen
    ) {
      this.cancelWork();
      this.session.cart.stop();
      this.ignorePointer = true;
      this.inventory.toggle();
    }
    const modal =
      this.hud.modal ||
      this.phone.open ||
      this.dialog.open ||
      this.book.open ||
      this.inventory.open ||
      this.safety.confirmOpen ||
      this.safety.modeOpen;
    if (!modal && !this.cabin.open) {
      const clock = this.time.now;
      if (
        has('J') ? this.attackTimer.press(clock) : this.attackTimer.poll(clock)
      )
        this.attackGnome();
      this.updateGnome(deltaMs);
      const feet = this.miner.body;
      this.critters.update(
        deltaMs * this.time.timeScale,
        { x: feet.center.x, y: feet.bottom },
        (c, r) => this.worldGround.isSolid(c, r),
      );
    } else {
      this.gnome?.freeze();
      this.critters.freeze();
    }
    // V8: dentro del pabellón el minero del mundo queda quieto en la puerta;
    // A/D mueven la figura del interior.
    const inside = this.cabin.open;
    if (this.campVisit && !modal) {
      const { arrival } = this.campVisit;
      this.campVisit = undefined;
      if (arrival === 'cabin') {
        this.openTopDownCabin();
      } else {
        if (inside) this.exitCabin();
        const id =
          arrival === 'warehouse'
            ? this.session.intro.step === 'tools'
              ? 'toolbox'
              : 'warehouse'
            : 'mine-entrance';
        const destination = this.interactions.objects.get(id)!;
        // El centro del portal ya cuenta como subsuelo en la vista lateral.
        const approach =
          arrival === 'mine' ? destination.x - TILE_SIZE : destination.x;
        const spot = this.freeSpot(approach, SPAWN.y);
        this.miner.body.reset(spot?.x ?? SPAWN.x, spot?.y ?? SPAWN.y);
        if (arrival !== 'mine' || destination.enabled) destination.action();
      }
      this.pressed.clear();
      return;
    }
    // Código `fly`: apagarlo (o entrar al pabellón) devuelve la gravedad.
    this.miner.canFly = this.session.cheats.flight && !inside;
    this.miner.step(
      modal || inside || this.buildCell !== null || this.session.cart.pushing,
    );
    if (this.miner.body.blocked.down) this.lastGrounded = now;
    this.refreshInteractions();
    if (inside) this.interactions.selected = undefined;
    let prompt = '';
    let cartTravel = 0;
    if (
      ((!modal && !this.buildCell) || this.inventory.open) &&
      !this.cabin.sleeping
    )
      QUICK_KEYS.forEach((key, i) => {
        if (has(key)) this.activateQuick(i);
      });
    if (modal) {
      this.cancelWork();
      if (this.dialog.open) {
        // E, Enter o clic avanzan; Esc omite lo que queda del diálogo.
        if (has('ESC')) this.dialog.skip();
        else if (has('Z') || has('ENTER')) this.dialog.advance();
      } else if (this.book.open) {
        if (has('Z') || has('ENTER') || has('ESC')) this.book.dismiss();
      } else if (has('Z') && this.hud.helpOpen) this.hud.close();
    } else if (inside) {
      if (
        has('Z') &&
        !this.cabin.sleeping &&
        this.time.now >= this.interactLockUntil
      )
        this.cabinAction();
      prompt = this.cabin.sleeping
        ? ''
        : this.cabin.prompt
          ? ''
          : 'A/D: MOVERTE | CAMA: DESCANSAR | PUERTA: SALIR';
    } else if (this.buildCell) {
      const cell = this.buildCell,
        valid = this.session.rails.canPlace(cell);
      // Vista previa del perfil: plano o rampa de un bloque.
      const y = railTop(cell.row);
      this.selection
        .lineStyle(1, valid ? P.mint : P.red)
        .strokeRect(cell.column * 16, cell.row * 16, 16, 16);
      for (let x = 0; x < 16; x += 2)
        this.selection
          .fillStyle(valid ? P.mint : P.red)
          .fillRect(cell.column * 16 + x, y, 1, 1);
      prompt = valid
        ? '[E] COLOCAR VIA | ESC: CANCELAR'
        : 'VIA INVALIDA: DESNIVEL, SOPORTE O TERRENO SIN EXCAVAR';
      if (has('Z')) {
        if (
          Math.abs(cell.column * 16 + 8 - this.miner.x) <= 48 &&
          this.session.build(cell)
        ) {
          this.hud.announce(
            cell.row !== this.session.rails.at(cell.column - 1)?.row &&
              cell.row !== this.session.rails.at(cell.column + 1)?.row
              ? 'RAMPA CONECTADA'
              : 'VIA CONECTADA',
          );
          this.buildCell = null;
          this.save();
        } else this.hud.announce('NO SE PUEDE CONSTRUIR AQUI');
      }
    } else {
      if (has('Q')) this.cycleSupply();
      if (has('DISMANTLE')) this.toggleDismantle();
      // V9: interruptor de la linterna y cambio de batería (una vez por
      // pulsación; `pressed` se limpia cada cuadro y `e.repeat` se ignora).
      if (has('HEADLAMP')) {
        this.hud.announce(this.session.toggleHeadlamp());
        this.save();
      }
      if (has('BATTERY')) this.replaceBattery();
      if (this.rightClick && !this.session.cart.pushing && !this.dismantleMode)
        this.useSupply(this.target(), this.time.now);
      if (has('C') && !this.loading) this.togglePush();
      if (has('WITHDRAW') && this.nearCart() && !this.session.cart.pushing) {
        this.cancelWork();
        const n = this.session.cart.inventory.transferTo(
          this.session.inventory,
        );
        this.hud.announce(
          n
            ? `RETIRADOS ${n} BLOQUES (${Math.round(this.session.inventory.weight)}/${this.session.inventory.capacity} KG)`
            : 'NO HAY ESPACIO O CARGA',
        );
        this.save();
      }
      if (has('Z') && this.time.now >= this.interactLockUntil) {
        if (this.interactions.selected?.id === 'mine-entrance') this.interactions.activate();
        else if (this.session.cart.pushing) this.session.cart.stop();
        else if (this.loading) this.cancelWork();
        else {
          this.interactions.activate();
          this.ignorePointer = true;
        }
      }
      if (!this.input.enabled) return;
      if (this.session.cart.pushing) {
        const cart = this.session.cart;
        if (!this.nearCart() || now - this.lastGrounded > 250) cart.stop();
        else {
          // El minero sigue al carro por el piso real de cada columna.
          const groundY = (x: number) => {
            const seg = this.session.rails.at(Math.floor(x / 16));
            return seg ? (seg.row + 1) * 16 - 12 : this.miner.y;
          };
          const previousX = cart.x;
          cart.step(this.miner.direction, dt, (next) => {
            const x = next + this.pushSide * CART.pushOffset;
            // A su altura, en el piso del tramo o un escalón (rampa) más
            // arriba o más abajo.
            return (
              this.freeBody(x, groundY(x)) ||
              [0, -16, 16].some((dy) => this.freeBody(x, this.miner.y + dy))
            );
          });
          cartTravel = this.hidden ? 0 : cart.x - previousX;
          const gap = cart.x + this.pushSide * CART.pushOffset - this.miner.x;
          this.miner.setVelocityX(
            Phaser.Math.Clamp(
              cart.velocity + gap * 8,
              -PLAYER.speed,
              PLAYER.speed,
            ),
          );
          // Rampa: subir el escalón de un bloque detrás o delante del carro.
          const dir = Math.sign(gap);
          const blocked =
            dir > 0
              ? this.miner.body.blocked.right
              : this.miner.body.blocked.left;
          if (dir && blocked && this.miner.body.blocked.down) {
            const target = this.miner.y - 16;
            if (this.freeBody(this.miner.x + dir * 3, target))
              this.miner.body.reset(this.miner.x + dir * 3, target);
          }
          this.miner.setFlipX(this.pushSide > 0).play('miner-push', true);
        }
        prompt = '[E] SOLTAR CARRITO | A/D: EMPUJAR';
      } else if (this.loading) prompt = this.updateLoading(now);
      else if (this.dismantleMode) prompt = this.updateDismantle();
      else if (!this.hud.modal && !this.buildCell && !this.hidden)
        prompt = this.updateMining(now) || prompt;
    }
    this.cartAudio.update(deltaMs, cartTravel);
    this.rightClick = false;
    if (!this.dismantleMode) this.leftClick = false;
    if (this.interactions.selected && !modal && !this.buildCell) {
      const o = this.interactions.selected;
      // El recuadro del carro se ajusta a su tamaño real (ruedas incluidas).
      if (o.id === 'cart')
        this.selection
          .lineStyle(1, P.gold)
          .strokeRect(
            Math.round(o.x) - CART.width / 2 - 2,
            Math.round(this.session.cart.y) + CART.bodyOffset - 2,
            CART.width + 4,
            CART.height + 4,
          );
      else
        this.selection
          .lineStyle(1, P.gold)
          .strokeRect(Math.round(o.x) - 10, Math.round(o.y) - 15, 20, 28);
    }
    this.syncQuickSupply();
    if (!this.work.key && !this.session.cart.pushing) {
      this.miner.setTexture(
        skinOf(this.session.tools.current),
        this.miner.frame.name,
      );
      const tool = this.session.tools.current;
      if (tool?.kind === 'drill' && tool.durability)
        this.drillTool
          .setVisible(this.miner.visible)
          .setFlipX(this.miner.flipX)
          .setPosition(
            Math.round(this.miner.x) + (this.miner.flipX ? -7 : 7),
            Math.round(this.miner.y) + 1,
          );
    }
    const active = !this.session.ended && this.session.modeChosen;
    const environmentActive = active && !modal && !this.hidden;
    // V9: el haz solo arranca con el interruptor en «on» y batería con carga.
    this.lighting.lampPowered =
      this.session.headlamp.on && !this.session.headlamp.empty;
    this.session.dayNight.tick(
      deltaMs * this.time.timeScale,
      !environmentActive,
    );
    this.lighting.daylight = this.session.dayNight.daylight;
    this.nightTint.update(this.session.dayNight);
    this.scenery.ambient(
      this.session.dayNight,
      this.time.now,
      environmentActive,
    );
    this.backdrop?.update(
      this.session.dayNight,
      deltaMs * this.time.timeScale,
      environmentActive,
      this.session.grid,
    );
    // V9: fondos de los biomas (después del desierto: usan el cuadro de la
    // hora de sus cordilleras), ambiente propio y región del minero.
    this.biomeBackdrop.update(this.cameras.main);
    this.biomeAmbience.update(
      this.session.dayNight,
      deltaMs * this.time.timeScale,
      environmentActive,
      this.cameras.main,
    );
    {
      const body = this.miner.body;
      const world = this.worldGround;
      this.groundShadow.update(
        body.center.x,
        body.bottom,
        this.miner.visible && !this.cabin.open,
        (c, r) => world.isSolid(c, r),
      );
    }
    this.trackRegion();
    // Cabaña animada: humo, ventanas, farol, cachiyuyos y silla mecedora.
    this.cabinSite.update(deltaMs * this.time.timeScale);
    if (active) {
      this.tickSystems(dt * 1000, now, this.time.now);
      if (this.deathPending) return;
      // V9: la batería solo gasta con el mundo corriendo (sin menús ni pausa).
      if (environmentActive) this.tickHeadlamp(dt * 1000);
      this.session.stats.playMs += dt * 1000;
      if (!this.session.ended) this.accessControl();
      this.checkFirstDay();
      // Los premios ya se aplicaron a la sesión; el efecto solo los presenta.
      for (const e of this.session.levelEvents.splice(0)) {
        this.hud.levelUp(this.time.now);
        this.levelUp.celebrate(e.level, e.count, this.time.now);
        this.save();
      }
      if (this.session.xpFeedback) {
        this.levelUp.gain(this.session.xpFeedback, this.time.now);
        this.session.xpFeedback = 0;
      }
    }
    this.applyLook();
    this.updateEating(this.time.now);
    if (this.cabin.open) {
      this.miner.setVisible(false);
      this.drillTool.setVisible(false);
      const previousX = this.cabin.puppetX;
      this.cabin.update(
        this.time.now,
        dt * 1000,
        modal ? 0 : this.miner.direction,
        this.session.dayNight,
        this.session.survival.energyUnits <= 1,
        this.session.survival.speedFactor,
      );
      if (!this.hidden)
        this.footsteps.advance(
          Math.abs(this.cabin.puppetX - previousX),
          'wood',
        );
    } else if (
      environmentActive &&
      !this.buildCell &&
      !this.session.cart.pushing &&
      !this.miner.flying &&
      this.miner.body.blocked.down &&
      this.miner.body.velocity.y >= 0 &&
      this.miner.direction !== 0
    ) {
      this.footsteps.advance(
        Math.abs(this.miner.body.deltaXFinal()),
        this.stepSurface(),
        this.miner.sprinting,
        this.inMine(),
      );
    }
    this.inventory.update(this.time.now);
    this.phone.update(this.time.now);
    this.droneView.update(this.time.now, Date.now());
    this.safety.update(this.time.now);
    this.crystalMotes.update(
      this.time.now,
      this.cameras.main,
      !this.cabin.open && this.lighting.crystals.spots.length > 0,
    );
    this.introTick();
    this.syncIntro(this.time.now, modal);
    this.dialog.update(this.time.now);
    this.book.update(this.time.now);
    this.hud.modes = {
      build: !!this.buildCell,
      dismantle: this.dismantleMode,
    };
    this.logistics.update(this.session, now);
    this.ops.update(this.session, this.time.now, this.playerCell);
    this.terrain.sync();
    this.gear.update(this.miner, this.session.grid);
    this.frameMs = dt * 1000;
    this.levelUp.update(
      this.session,
      this.miner,
      this.time.now,
      modal || !!this.session.ended,
    );
    this.hud.zone = this.cabin.open ? 'cabin' : this.lighting.zone;
    const selected = this.interactions.selected;
    this.portalLabel.setVisible(!modal && !this.cabin.open && selected?.id === 'mine-entrance');
    // Indicaciones del campamento con su texto propio; el resto, genérica.
    this.hud.promptLabel = this.cabin.open
      ? this.cabin.prompt
      : selected?.id === 'cabin' || selected?.id === 'mine-entrance' || selected?.id.startsWith('drone-box-')
        ? selected.label
        : '[E] INTERACTUAR';
    this.hud.update(
      this.session,
      this.cabin.open
        ? !!this.cabin.prompt
        : !!selected &&
            !this.buildCell &&
            !this.dismantleMode &&
            !this.session.cart.pushing,
      prompt,
      this.time.now,
      modal,
      this.levelUp.isPresenting(this.time.now),
    );
    if (now - this.lastSave > 5000) {
      this.lastSave = now;
      this.save();
    }
    this.pressed.clear();
  }
}

export const physicsConfig = {
  default: 'arcade',
  arcade: {
    gravity: { x: 0, y: PLAYER.gravity },
    debug: false,
    fixedStep: true,
    fps: 60,
  },
};
