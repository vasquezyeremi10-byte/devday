import { PauseScene, type PauseVisit } from './PauseScene';
import { showDeath } from './DeathScene';
import Phaser from 'phaser';
import { TOOLS } from '../config/balance';
import { PLAYER, TILE_SIZE, VIEW } from '../config/constants';
import { HEADLAMP_ALIAS, loadControls } from '../config/controls';
import { DEVELOPER_MODE, DEVELOPER_SAVE_KEY } from '../config/developer';
import { PPE_EFFECT } from '../config/gear';
import { GALLERY_AIR } from '../config/galleryAir';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { isFood } from '../config/survival';
import { TopDownMiner } from '../entities/TopDownMiner';
import type { MinerWork } from '../entities/TopDownMinerArt';
import { WorldAudio } from '../systems/WorldAudio';
import { ACTION_AUDIO_KEYS } from '../config/actionAudio';
import { CartRollingAudio } from '../systems/ActionAudio';
import { missingAssets, queueAssets } from '../systems/AssetLoader';
import { DigEffects } from '../systems/DigEffects';
import {
  CART_RADIUS,
  GALLERY_CART_LIMIT,
  GALLERY_CARGO_LIMIT,
} from '../systems/GalleryRailway';
import {
  isGallerySupportSupply,
  type GallerySupport,
  type GallerySupportSupply,
} from '../systems/GalleryStability';
import { RANK, StabilityState } from '../systems/GeotechnicalSystem';
import {
  isGalleryAirSupply,
  type GalleryAirSupply,
} from '../systems/GalleryVentilation';
import { VENTILATION } from '../systems/VentilationSystem';
import {
  InteractionSystem,
  type Interaction,
} from '../systems/InteractionSystem';
import {
  arriveInMode,
  changeMineMode,
  SURFACE_MODE,
  type MineVisit,
} from '../systems/MineModes';
import { encodeSave, SAVE_KEY } from '../systems/SaveSystem';
import { WorkSystem } from '../systems/WorkSystem';
import { InventoryPanel } from '../ui/InventoryPanel';
import { OperationsHUD } from '../ui/OperationsHUD';
import { createPixelFont, pixelText, smallText } from '../ui/PixelFont';
import { createV3Art } from '../world/structures/V3Art';
import {
  Block,
  TerrainGrid,
  type Cell,
  type Point,
} from '../world/TerrainGrid';
import { GalleryRailwayView } from '../world/GalleryRailwayView';
import { WORLD_REV_SOLID } from '../world/Geology';
import { airWarning, GalleryAirView } from '../world/GalleryAirView';
import {
  GALLERY_ENTRY,
  galleryVisible,
  TopDownGallery,
} from '../world/TopDownGallery';
import { TopDownGalleryView } from '../world/TopDownGalleryView';

export type GalleryVisit = MineVisit;
const HELP = 'NIVEL −1 · CLIC PARA PICAR · TAB INVENTARIO · X DESMONTAR';
const HUD_TOP = 38;
const HUD_BOTTOM = 224;
const PICK_POSES = [0, 1, 1, 2, 2, 3] as const;
const SHOVEL_POSES = [1, 2, 2, 3, 3, 0] as const;
type Construction = 'rail' | GallerySupportSupply | GalleryAirSupply;
const isConstruction = (kind: string): kind is Construction =>
  kind === 'rail' || isGallerySupportSupply(kind) || isGalleryAirSupply(kind);

export class GalleryScene extends Phaser.Scene {
  private worldAudio!: WorldAudio;
  private cartAudio!: CartRollingAudio;
  miner!: TopDownMiner;
  visit!: GalleryVisit;
  gallery!: TopDownGallery;
  view!: TopDownGalleryView;
  hud!: OperationsHUD;
  inventory!: InventoryPanel;
  readonly work = new WorkSystem();
  private effects!: DigEffects;
  private mark!: Phaser.GameObjects.Graphics;
  private fracture!: Phaser.GameObjects.Graphics;
  private workPose?: { kind: MinerWork; phase: number };
  private readonly keys = new Set<string>();
  private readonly controls = loadControls();
  private lastImpact = -1;
  private impactAt = -Infinity;
  private lastSave = 0;
  private warning = '';
  private ready = false;
  private deathPending = false;
  private ignorePointer = false;
  private status!: HTMLElement;
  private interactions!: InteractionSystem;
  private cartAction!: Interaction;
  private railView!: GalleryRailwayView;
  private airView!: GalleryAirView;
  private mineKey!: Phaser.Input.Keyboard.Key;
  private swingTarget = '';
  private exitLabel!: Phaser.GameObjects.BitmapText;
  private inspectAirUntil = 0;
  private fanActions: Interaction[] = [];
  private fanRevision = -1;
  private railClick?: { point: Point; right: boolean };
  private dismantle = false;
  private manualSupply: Construction | null = null;
  private pendingSupport?: GallerySupport;
  private hazard!: Phaser.GameObjects.BitmapText;
  private nextDust = 0;

  constructor() {
    super('GalleryScene');
  }

  init(visit: GalleryVisit): void {
    this.ready = false;
    this.deathPending = false;
    this.visit = visit;
  }

  preload(): void {
    queueAssets(this, ['sfx-ventilation', ...ACTION_AUDIO_KEYS]);
  }

  create(): void {
    this.status = document.querySelector('#game-status')!;
    document.querySelector<HTMLButtonElement>('#restart')!.textContent =
      'Volver al campamento';
    const missing = missingAssets(this);
    if (missing.length) {
      this.status.textContent =
        'No se cargaron los recursos de la galería. Vuelve al campamento.';
      return;
    }
    const { session } = this.visit;
    const gallery = (session.gallery ??= new TopDownGallery(
      this.visit.fromSurface || session.grid.worldRev >= WORLD_REV_SOLID,
      this.visit.fromSurface ? session.seed : undefined,
    ));
    this.gallery = gallery;
    const cart = gallery.railway.point;
    const saved = gallery.position;
    const overlaps =
      Math.abs(saved.x - cart.x) < CART_RADIUS + 5 &&
      Math.abs(saved.y - 3 - cart.y) < CART_RADIUS + 3;
    const position = gallery.active && !overlaps ? saved : GALLERY_ENTRY;
    gallery.active = true;
    const width = gallery.grid.columns * TILE_SIZE,
      height = gallery.grid.rows * TILE_SIZE;
    this.physics.world.setBounds(0, 0, width, height);
    this.miner = new TopDownMiner(this, position.x, position.y, 'stone', true);
    this.miner.face(1, 0);
    this.miner.setDepth(DEPTH.characters);
    this.cameras.main
      // El margen permite apuntar a los extremos de la galería fuera del HUD.
      .setBounds(
        0,
        -HUD_TOP,
        width,
        height + HUD_TOP + VIEW.height - HUD_BOTTOM,
      )
      .startFollow(this.miner, true, 0.16, 0.16);
    createPixelFont(this);
    createV3Art(this);
    session.loadout.sync();
    this.hud = new OperationsHUD(this);
    this.hud.zone = 'gallery';
    if (this.visit.fromSurface)
      this.hud.announce('ESPACIO: PICAR FRENTE A TI   TAB: INVENTARIO');
    this.hud.cargoBlockLimit = this.visit.fromSurface
      ? undefined
      : GALLERY_CARGO_LIMIT;
    this.inventory = new InventoryPanel(this, () => session);
    this.inventory.cargoBlockLimit = this.hud.cargoBlockLimit;
    this.inventory.onQuick = (index) => this.selectQuick(index);
    this.inventory.onUse = (kind) => this.use(kind);
    this.inventory.onChange = () => {
      this.save();
    };
    this.effects = new DigEffects(this, () => this.hud.cargoAnchor);
    this.view = new TopDownGalleryView(this, gallery, this.miner);
    this.railView = new GalleryRailwayView(this, gallery.railway, this.miner);
    this.airView = new GalleryAirView(this, gallery);
    this.inspectAirUntil = 0;
    this.fanActions = [];
    this.fanRevision = -1;
    this.interactions = new InteractionSystem();
    this.interactions.register({
      id: 'exit',
      ...GALLERY_ENTRY,
      radius: 20,
      enabled: true,
      label: this.visit.fromSurface
        ? 'SALIR A LA SUPERFICIE'
        : 'VOLVER A SUPERFICIE',
      action: () => this.returnToCamp(),
    });
    this.exitLabel = pixelText(
      this,
      GALLERY_ENTRY.x,
      GALLERY_ENTRY.y - 40,
      '[E] SALIR A LA SUPERFICIE',
      P.cream,
    )
      .setDepth(DEPTH.worldUi)
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.cartAction = {
      id: 'cart',
      ...gallery.railway.point,
      radius: 25,
      enabled: true,
      label: '',
      action: () => this.useCart(),
    };
    this.interactions.register(this.cartAction);
    this.mark = this.add.graphics().setDepth(DEPTH.worldUi);
    this.fracture = this.add.graphics().setDepth(DEPTH.terrain + 1);
    this.workPose = undefined;
    this.hazard = smallText(this, VIEW.width / 2, 34, '', P.gold)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 1);
    this.pendingSupport = undefined;
    this.nextDust = 0;
    this.work.cancel();
    this.keys.clear();
    this.warning = '';
    this.ignorePointer = true;
    this.dismantle = false;
    this.manualSupply = null;
    this.railClick = undefined;
    this.lastSave = this.time.now;
    this.status.textContent = HELP;
    const keyboard = this.input.keyboard!;
    this.mineKey = keyboard.addKey('SPACE');
    this.swingTarget = '';
    if (this.visit.fromSurface) arriveInMode(this);
    if (this.controls.inventory === 'Tab')
      keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.TAB);
    const key = (event: KeyboardEvent) => {
      if (!event.repeat) this.keys.add(event.code);
    };
    const click = (p: Phaser.Input.Pointer) => {
      if (this.inventory.open) return;
      const slot = this.hud.quickAt(p.x, p.y);
      if (slot >= 0) {
        this.ignorePointer = true;
        this.selectQuick(slot);
        return;
      }
      if (p.y < HUD_TOP || p.y >= HUD_BOTTOM || p.x < 0 || p.x >= VIEW.width)
        return;
      if (p.rightButtonDown() || (this.dismantle && p.leftButtonDown()))
        this.railClick = {
          point: this.cameras.main.getWorldPoint(p.x, p.y),
          right: p.rightButtonDown(),
        };
    };
    this.input.mouse?.disableContextMenu();
    keyboard.on('keydown', key);
    this.input.on('pointerdown', click);
    const unload = () => {
      this.save();
    };
    const blur = () => {
      this.work.cancel();
      this.swingTarget = '';
      this.keys.clear();
      this.ignorePointer = true;
      this.gallery.railway.stop();
      this.railClick = undefined;
    };
    window.addEventListener('pagehide', unload);
    this.game.events.on(Phaser.Core.Events.BLUR, blur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown', key);
      this.input.off('pointerdown', click);
      window.removeEventListener('pagehide', unload);
      this.game.events.off(Phaser.Core.Events.BLUR, blur);
    });
    this.ready = true;
    this.worldAudio = new WorldAudio(this);
    this.cartAudio = new CartRollingAudio(this);
    this.miner.present(this.time.now, { hp: session.health.hp });
    this.save();
  }

  private handleDeath(): void {
    this.deathPending = true;
    const { session, player } = this.visit;
    this.gallery.railway.stop();
    this.gallery.active = false;
    this.gallery.ventilation.resetExposure();
    if (session.mode === 'normal') this.gallery.position = GALLERY_ENTRY;
    showDeath(this, session, player, {
      key: this.visit.fromSurface ? SURFACE_MODE : 'TopDownScene',
      data: this.visit.fromSurface
        ? { recovery: { session, clock: this.time.now } }
        : { fromGallery: true, visit: this.visit },
    });
  }

  returnToCamp(): void {
    if (this.ready) {
      this.gallery.railway.stop();
      this.gallery.active = false;
      this.gallery.ventilation.resetExposure();
      if (!this.save()) {
        this.gallery.active = true;
        this.hud.announce('ERROR AL GUARDAR. REINTENTA ANTES DE SALIR');
        return;
      }
    }
    if (this.visit.fromSurface) changeMineMode(this, SURFACE_MODE, this.visit);
    else this.scene.start('TopDownScene', { fromGallery: true });
  }

  requestExit(): void {
    if (
      !this.ready ||
      Phaser.Math.Distance.BetweenPoints(this.miner, GALLERY_ENTRY) <= 20
    )
      this.returnToCamp();
    else this.hud.announce('VUELVE A LA TRAMPILLA PARA SALIR');
  }

  private save(): boolean {
    if (!this.ready || this.deathPending) return false;
    this.gallery.position = { x: this.miner.x, y: this.miner.y };
    try {
      localStorage.setItem(
        DEVELOPER_MODE ? DEVELOPER_SAVE_KEY : SAVE_KEY,
        encodeSave(this.visit.session, this.visit.player),
      );
      return true;
    } catch {
      this.hud.announce('ERROR AL GUARDAR');
      return false;
    }
  }

  private use(kind: string): string | void {
    const s = this.visit.session;
    if (isConstruction(kind)) {
      this.manualSupply = kind;
      this.hud.activeSupply = kind;
      this.inventory.close();
      return 'CLIC DERECHO SOBRE SUELO EXCAVADO';
    }
    let message: string | undefined;
    if (isFood(kind)) {
      const result = s.eat(kind);
      if (result.ok) this.miner.eat(kind, this.time.now, result.message);
      message = result.message;
    } else if (kind === 'battery') message = s.replaceHeadlamp();
    if (!message) return;
    this.hud.announce(message);
    this.save();
    return message;
  }

  private selectQuick(index: number): void {
    const s = this.visit.session;
    const item = s.loadout.quickbar[index];
    this.work.cancel();
    this.manualSupply = null;
    this.hud.activeSupply = null;
    if (item?.type === 'supply' && isFood(item.kind)) this.use(item.kind);
    else s.loadout.selectQuick(index);
    if (item?.type === 'supply' && isConstruction(item.kind))
      this.hud.announce(
        'CONSTRUCCION ELEGIDA. CLIC DERECHO SOBRE SUELO EXCAVADO',
      );
  }

  private useCart(): void {
    const { session } = this.visit;
    const rail = this.gallery.railway;
    this.work.cancel();
    if (rail.pushing) rail.stop();
    else if (rail.atStation && rail.inventory.items.length) {
      const count = rail.unload();
      this.hud.announce(
        `DESCARGA: ${count} BLOQUES LISTOS PARA VENDER CON EL CELULAR EN LA VISTA LATERAL`,
      );
    } else if (session.inventory.items.length && rail.space > 0) {
      const count = rail.load(session.inventory);
      if (count) this.hud.announce(`CARGADOS: ${count} BLOQUES`);
    } else if (
      !rail.start(this.miner.body.center, (p) =>
        this.gallery.stability.clear(p),
      )
    ) {
      this.hud.announce('PONTE DETRAS DEL CARRITO, EN EL SENTIDO DE LA VIA');
    }
    this.save();
  }

  private canReach(cell: Cell): boolean {
    const p = TerrainGrid.center(cell),
      origin = this.miner.body.center;
    return (
      Math.hypot(p.x - origin.x, p.y - origin.y) <= PLAYER.reach &&
      galleryVisible(this.gallery.grid, origin, cell)
    );
  }

  private removeSupport(support: GallerySupport): void {
    this.pendingSupport = undefined;
    if (
      !this.canReach(support) ||
      this.gallery.stability.at(support) !== support
    ) {
      this.hud.announce('EL MARCO YA NO ESTA AL ALCANCE');
      return;
    }
    if (this.visit.session.removeGallerySupport(support)) {
      this.view.supportChanged(support);
      this.hud.announce('MARCO RETIRADO. RECUPERACION SEGUN ESTADO');
      this.save();
    }
  }

  private editStructure(): boolean {
    const click = this.railClick;
    this.railClick = undefined;
    if (!click) return false;
    const { session } = this.visit;
    const active = session.loadout.activeQuick;
    const kind =
      this.manualSupply ?? (active?.type === 'supply' ? active.kind : '');
    if (click.right && !isConstruction(kind)) return false;
    if (!click.right && !this.dismantle) return false;
    this.pendingSupport = undefined;
    this.work.cancel();
    this.ignorePointer = true;
    const cell = TerrainGrid.worldToCell(click.point.x, click.point.y);
    if (!this.canReach(cell)) {
      this.hud.announce('FUERA DE ALCANCE');
      return true;
    }
    const air = this.gallery.ventilation;
    if (click.right && isGalleryAirSupply(kind)) {
      const problem = session.galleryAirProblem(cell, kind);
      if (problem) this.hud.announce(problem);
      else if (session.buildGalleryAir(cell, kind, this.miner.aim)) {
        this.buildPose(cell);
        this.hud.announce(
          kind === 'duct' ? 'DUCTO INSTALADO' : 'VENTILADOR INSTALADO',
        );
        this.save();
      }
      return true;
    }
    // Los ductos van por encima de vías y marcos: tienen prioridad al apuntar.
    if (!click.right && (air.ductAt(cell) || air.fanAt(cell))) {
      if (session.removeGalleryAir(cell)) {
        this.hud.announce('EQUIPO RETIRADO. RECUPERACION SEGUN ESTADO');
        this.save();
      } else this.hud.announce('VENTILADOR FIJO DE LA TOMA');
      return true;
    }
    if (click.right && isGallerySupportSupply(kind)) {
      const problem = session.gallerySupportProblem(
        cell,
        kind,
        this.miner.body.center,
      );
      if (problem) this.hud.announce(problem);
      else if (
        session.buildGallerySupport(cell, kind, this.miner.body.center)
      ) {
        this.buildPose(cell);
        this.view.supportChanged(cell);
        this.hud.announce('MARCO INSTALADO');
        this.save();
      }
      return true;
    }
    const support = this.gallery.stability.at(cell);
    if (!click.right && support) {
      const risk = this.gallery.stability.removalRisk(support);
      if (RANK[risk] >= RANK[StabilityState.Danger]) {
        this.pendingSupport = support;
        this.hud.announce('RETIRAR ESTE MARCO DEBILITA LA GALERIA');
      } else this.removeSupport(support);
      return true;
    }
    const rail = this.gallery.railway;
    const problem = click.right
      ? air.fanAt(cell)
        ? 'YA HAY UN VENTILADOR EN LA CELDA'
        : support
          ? 'YA HAY UN MARCO EN LA CELDA'
          : session.railStock
            ? rail.placementProblem(cell)
            : 'COMPRA RIELES CON U EN LA VISTA LATERAL'
      : rail.removalProblem(cell);
    if (problem) {
      this.hud.announce(problem);
      return true;
    }
    const changed = click.right
      ? session.buildGalleryRail(cell)
      : session.removeGalleryRail(cell);
    if (changed) {
      if (click.right) this.buildPose(cell);
      this.hud.announce(click.right ? 'VIA COLOCADA' : 'VIA RETIRADA. +1 RIEL');
      this.railView.redraw();
      this.save();
    }
    return true;
  }

  private buildPose(cell: Cell): void {
    const { x, y } = TerrainGrid.center(cell);
    const origin = this.miner.body.center;
    this.miner.build(this.time.now, x - origin.x, y - origin.y);
  }

  private advanceStability(ms: number, now: number): void {
    const { stability, railway, visibility } = this.gallery;
    const { session } = this.visit;
    for (const id of stability.tick(ms)) {
      const { filled, damaged } = stability.collapse(id, (cell) =>
        railway.occupies(cell),
      );
      if (!filled.length) continue;
      this.gallery.ventilation.collapse(filled);
      if (filled.some((cell) => railway.has(cell))) railway.stop();
      const body = this.miner.body;
      let crushed = false,
        nearby = false;
      for (const cell of filled) {
        const x = cell.column * TILE_SIZE,
          y = cell.row * TILE_SIZE;
        crushed ||=
          body.right > x &&
          body.left < x + TILE_SIZE &&
          body.bottom > y &&
          body.top < y + TILE_SIZE;
        nearby ||=
          Math.hypot(body.center.x - x - 8, body.center.y - y - 8) <= 32;
        visibility.reveal(cell.column, cell.row);
        this.view.terrainChanged(cell);
        this.effects.impact(x + 8, y + 8, true, 0.2);
      }
      for (const support of damaged) this.view.supportChanged(support);
      this.railView.redraw();
      session.stats.lastCollapseMs = session.stats.playMs;
      if (nearby) this.cameras.main.shake(260, 0.006);
      if (crushed) {
        session.health.hp = 0;
        session.health.lastSource = 'derrumbe';
      } else if (nearby) {
        const helmet = session.loadout.equipped('helmet')
          ? PPE_EFFECT.helmetRock
          : 1;
        session.health.damage(30 * helmet, now, 'roca');
      }
      this.hud.announce('DERRUMBE: DESPEJA LOS ESCOMBROS CON PALA O PICOTA');
      if (session.health.dead) break;
      this.save();
    }
  }

  private refreshFans(): void {
    const air = this.gallery.ventilation;
    if (this.fanRevision === air.revision) return;
    this.fanRevision = air.revision;
    for (const item of this.fanActions)
      this.interactions.objects.delete(item.id);
    this.fanActions = [];
    for (const [key, fan] of air.fans) {
      const action: Interaction = {
        id: `fan-${key}`,
        ...TerrainGrid.center(fan),
        radius: 14,
        enabled: !air.grid.isSolid(fan.column, fan.row),
        label: fan.enabled ? 'APAGAR VENTILADOR' : 'ENCENDER VENTILADOR',
        action: () => {
          air.toggle(fan);
          this.hud.announce(
            !fan.enabled
              ? 'VENTILADOR APAGADO'
              : air.running.has(key)
                ? 'VENTILADOR EN MARCHA'
                : 'VENTILADOR SIN SUMINISTRO',
          );
          this.save();
        },
      };
      this.fanActions.push(action);
      this.interactions.register(action);
    }
  }

  private hazardMessage(now: number, modal: boolean): string {
    if (modal) return '';
    if (this.pendingSupport) return 'RIESGO: ENTER CONFIRMA · ESC CANCELA';
    const p = this.miner.body.center;
    const sector = this.gallery.stability.around(
      TerrainGrid.worldToCell(p.x, p.y),
    );
    if (!sector) return '';
    if (now >= this.nextDust) {
      const fall = sector.cells.find(({ cell }) =>
        this.gallery.visibility.has(cell.column, cell.row),
      );
      if (fall) {
        const { x, y } = TerrainGrid.center(fall.cell);
        this.effects.impact(x, y, true, 0.09);
      }
      this.nextDust = now + 1450;
    }
    return sector.remaining !== undefined
      ? `COLAPSO EN ${Math.ceil(sector.remaining / 1000)} S`
      : sector.state === StabilityState.Danger
        ? 'GALERIA INESTABLE'
        : 'PRECAUCION: GRIETAS';
  }

  update(now: number, delta: number): void {
    if (!this.ready || this.deathPending || !this.input.enabled) return;
    const { session: s } = this.visit;
    if (s.health.dead) return this.handleDeath();
    this.worldAudio.update(delta, 0, s.dayNight.sunStrength, 'mine');
    const has = (code: string) => this.keys.has(code);
    if (has(this.controls.inventory)) {
      this.inventory.toggle();
      this.ignorePointer = true;
    }
    if (
      this.visit.fromSurface &&
      has('Escape') &&
      !this.inventory.open &&
      !this.dismantle &&
      !this.pendingSupport
    ) {
      this.keys.clear();
      this.swingTarget = '';
      this.work.cancel();
      this.gallery.railway.stop();
      this.scene.pause();
      this.scene.launch(PauseScene.KEY, {
        canSave: true,
        save: () => this.save(),
        resume: () => {
          this.scene.stop(PauseScene.KEY);
          this.keys.clear();
          this.input.keyboard?.resetKeys();
          this.scene.resume();
        },
        toMenu: () => {
          this.save();
          this.scene.stop(PauseScene.KEY);
          this.scene.start('MenuScene');
        },
      } satisfies PauseVisit);
      this.scene.bringToTop(PauseScene.KEY);
      return;
    }
    if (has('Escape') && this.inventory.open) this.inventory.close();
    if (has('Escape')) {
      this.dismantle = false;
      this.pendingSupport = undefined;
    }
    if (has(this.controls.dismantle) && !this.inventory.open) {
      this.swingTarget = '';
      this.dismantle = !this.dismantle;
      this.pendingSupport = undefined;
      this.work.cancel();
      this.hud.announce(
        this.dismantle
          ? 'DESMONTAR: CLIC IZQUIERDO SOBRE LA ESTRUCTURA'
          : 'DESMONTAJE DESACTIVADO',
      );
    }
    if (has(this.controls.headlamp) || has(HEADLAMP_ALIAS))
      this.hud.announce(s.toggleHeadlamp());
    if (has(this.controls.battery)) this.use('battery');
    if (has('KeyM')) {
      this.sound.mute = !this.sound.mute;
      this.hud.announce(this.sound.mute ? 'SONIDO APAGADO' : 'SONIDO ACTIVO');
    }
    if (has(this.controls.save) && this.save())
      this.hud.announce('PARTIDA GUARDADA');
    for (let i = 0; i < 9; i++) if (has(`Digit${i + 1}`)) this.selectQuick(i);

    const modal = this.inventory.open || document.hidden || !!s.ended;
    const rail = this.gallery.railway;
    const air = this.gallery.ventilation;
    if (!modal && has('KeyJ'))
      this.inspectAirUntil =
        now < this.inspectAirUntil ? 0 : now + GALLERY_AIR.inspectMs;
    this.refreshFans();
    if (!modal && has('KeyR')) {
      this.keys.clear();
      this.returnToCamp();
      return;
    }
    if (!modal && has('Enter') && this.pendingSupport && !rail.pushing)
      this.removeSupport(this.pendingSupport);
    if (modal && rail.pushing) rail.stop();
    const point = rail.point;
    const origin = this.miner.body.center;
    Object.assign(this.cartAction, point, {
      priority: rail.pushing ? 1 : 0,
      enabled: galleryVisible(
        this.gallery.grid,
        origin,
        TerrainGrid.worldToCell(point.x, point.y),
      ),
      label: rail.pushing
        ? 'DETENER CARRITO'
        : rail.atStation && rail.inventory.items.length
          ? 'DESCARGAR'
          : s.inventory.items.length && rail.space > 0
            ? 'CARGAR CARRITO'
            : 'EMPUJAR CARRITO',
    });
    const target = this.interactions.select(
      origin,
      0,
      (item) =>
        (item.id !== 'exit' && !item.id.startsWith('fan-')) ||
        galleryVisible(
          this.gallery.grid,
          origin,
          TerrainGrid.worldToCell(item.x, item.y),
        ),
    );
    if (target && !modal && (has('KeyZ') || has('KeyE'))) {
      this.keys.clear();
      this.interactions.activate();
      if (target.id === 'exit') return;
    }
    const strike = has('Space');
    this.keys.clear();
    const pushing = rail.pushing;
    const travelled = rail.travelled;
    const quality = air.at(TerrainGrid.worldToCell(origin.x, origin.y));
    const slow = VENTILATION.exposure.slow;
    const airSpeed =
      quality === 0
        ? slow.emergency
        : quality < GALLERY_AIR.critical
          ? slow.dangerous
          : 1;
    const blocked = modal;
    this.miner.step(
      delta,
      !blocked && !pushing,
      s.survival.speedFactor * airSpeed,
      pushing,
      !!this.visit.fromSurface,
    );
    if (pushing) {
      const player = rail.step(delta * airSpeed, (p) =>
        this.gallery.stability.clear(p),
      );
      if (player) {
        const aim = rail.heading;
        this.miner.face(aim.x, aim.y);
        this.miner.body.reset(player.x, player.y + 3);
      }
      if (!rail.pushing) this.save();
    }
    this.cartAudio.update(delta, rail.travelled - travelled);
    this.miner.setDepth(DEPTH.characters + this.miner.y / 1000);
    this.mark.clear();
    this.fracture.clear();
    this.workPose = undefined;
    if (blocked || pushing) {
      this.railClick = undefined;
      this.swingTarget = '';
      this.work.cancel();
    }
    this.railView.update(!modal && (pushing || target?.id === 'cart'));
    if (!this.inventory.open && !document.hidden && !s.ended) {
      if (!blocked && !pushing && !this.editStructure() && !this.dismantle)
        this.extract(now, strike);
      const dt = Math.min(delta, 100);
      s.tickTopDown(delta, now, {
        walking: this.miner.body.velocity.length() > 5,
        pushingLoaded:
          rail.travelled > travelled && rail.inventory.items.length > 0,
      });
      if (s.health.dead) return this.handleDeath();
      const p = this.miner.body.center;
      s.health.damage(
        air.exposure(TerrainGrid.worldToCell(p.x, p.y), dt),
        now,
        'aire',
      );
      if (s.health.dead) return this.handleDeath();
      s.headlamp.tick(
        dt,
        s.loadout.equipped('helmet') && s.headlamp.on && !s.headlamp.empty,
      );
      this.advanceStability(dt, now);
      if (s.health.dead) return this.handleDeath();
    }
    this.miner.present(now, {
      work: this.workPose,
      hp: s.health.hp,
      tired: s.survival.energyUnits <= 1 || s.survival.starving,
      suspended: pushing || document.hidden,
    });
    const lamp =
      s.loadout.equipped('helmet') && s.headlamp.on ? s.headlamp.fraction : 0;
    this.view.illuminate(
      this.cameras.main,
      this.miner.body.center,
      this.miner.aim,
      lamp,
    );
    const prompt =
      target && !blocked
        ? `[${this.visit.fromSurface ? 'E' : 'Z'}] ${target.label}`
        : '';
    this.exitLabel.setVisible(
      !!this.visit.fromSurface && target?.id === 'exit' && !blocked,
    );
    const interaction =
      target?.id === 'cart' && prompt
        ? `${prompt} · CARRITO: ${rail.inventory.items.length}/${GALLERY_CART_LIMIT}`
        : prompt ||
          (this.visit.fromSurface
            ? 'ESPACIO O CLIC PARA PICAR · TAB INVENTARIO'
            : HELP);
    const hazard = this.hazardMessage(now, blocked);
    this.hazard.setText(hazard);
    const feet = this.miner.body.center;
    const reading = air.at(TerrainGrid.worldToCell(feet.x, feet.y));
    this.airView.update(
      now,
      feet,
      reading,
      now < this.inspectAirUntil,
      blocked,
    );
    const status = [hazard, modal ? '' : airWarning(reading), interaction]
      .filter(Boolean)
      .join(' · ');
    if (this.status.textContent !== status) this.status.textContent = status;
    this.hud.promptLabel = prompt;
    this.hud.modes.dismantle = this.dismantle;
    this.hud.update(s, !!prompt, '', now, blocked, false);
    this.inventory.update(now);
    if (now - this.lastSave >= 5000) {
      this.lastSave = now;
      this.save();
    }
  }

  private extract(now: number, pressed: boolean): void {
    const p = this.input.activePointer;
    if (!p.leftButtonDown()) {
      this.ignorePointer = false;
      this.warning = '';
    }
    const origin = this.miner.body.center;
    const directional = !!this.visit.fromSurface;
    const world = directional
      ? origin
      : this.cameras.main.getWorldPoint(p.x, p.y);
    const cell = TerrainGrid.worldToCell(world.x, world.y);
    if (directional) {
      cell.column += this.miner.aim.x;
      cell.row += this.miner.aim.y;
    }
    const inWorld =
      p.y >= HUD_TOP &&
      p.y < HUD_BOTTOM &&
      p.x >= 0 &&
      p.x < this.cameras.main.width;
    const strike = directional && pressed;
    const targetKey = `${cell.column},${cell.row}`;
    if (this.swingTarget !== targetKey) this.swingTarget = '';
    if (strike) this.swingTarget = targetKey;
    const { grid, mining } = this.gallery;
    if (
      (!directional && !inWorld) ||
      mining.inspect(origin, cell) !== 'ready' ||
      !galleryVisible(grid, origin, cell)
    ) {
      this.swingTarget = '';
      this.work.cancel();
      return;
    }
    const x = cell.column * TILE_SIZE,
      y = cell.row * TILE_SIZE;
    this.mark.lineStyle(1, P.gold).strokeRect(x, y, 16, 16);
    if (
      !(inWorld && p.leftButtonDown() && !this.ignorePointer) &&
      !(directional && (this.mineKey.isDown || this.swingTarget))
    ) {
      this.work.cancel();
      return;
    }
    if (!directional) this.miner.face(x + 8 - origin.x, y + 8 - origin.y);
    const s = this.visit.session;
    const block = grid.get(cell.column, cell.row);
    const warning = s.galleryProblem(block, !this.visit.fromSurface);
    if (warning) {
      if (this.warning !== warning) this.hud.announce(warning);
      this.swingTarget = '';
      this.warning = warning;
      this.work.cancel();
      return;
    }
    const tool = s.tools.current!;
    const shovel = TOOLS[tool.kind].type === 'shovel';
    const key = `${cell.column},${cell.row}:${tool.id}`;
    if (key !== this.work.key) {
      this.lastImpact = -1;
      this.impactAt = -Infinity;
    }
    const duration = s.workMs(cell, grid);
    const complete = this.work.advance(key, now, duration);
    const progress = this.work.progress;
    const cycles = Math.max(1, Math.round(duration / (shovel ? 480 : 400)));
    const stroke = Math.min(cycles - 1e-6, progress * cycles);
    const beat = Math.floor(stroke);
    const frame = Math.floor((stroke - beat) * 6);
    const phase = complete ? 2 : (shovel ? SHOVEL_POSES : PICK_POSES)[frame]!;
    this.workPose = { kind: shovel ? 'shovel' : 'pick', phase };
    const hitX = Math.round(Phaser.Math.Clamp(origin.x, x + 2, x + 13));
    const hitY = Math.round(Phaser.Math.Clamp(origin.y, y + 2, y + 13));
    if (!complete && beat !== this.lastImpact && phase === 2) {
      this.lastImpact = beat;
      this.impactAt = now;
      this.effects.impact(hitX, hitY, shovel, 0.2);
    }
    this.mark
      .fillStyle(P.ink)
      .fillRect(x, y - 5, 16, 3)
      .fillStyle(P.gold)
      .fillRect(x, y - 4, Math.floor(progress * 16), 1);
    if (complete && s.mineGallery(origin, cell, !this.visit.fromSurface)) {
      this.swingTarget = '';
      this.view.terrainChanged(cell);
      if (this.gallery.railway.has(cell)) this.railView.redraw();
      this.effects.galleryBreak(
        x + 8,
        y + 8,
        block,
        shovel || block === Block.Rubble,
      );
      if (block === Block.Rock)
        this.effects.floatText(x + 8, y + 8, '+1 PIEDRA');
      this.save();
      return;
    }
    this.drawFracture(x, y, hitX, hitY, progress, now - this.impactAt);
  }

  private drawFracture(
    x: number,
    y: number,
    hitX: number,
    hitY: number,
    progress: number,
    age: number,
  ): void {
    const g = this.fracture;
    const offset = age < 80 ? (age < 40 ? 1 : -1) : 0;
    const pixel = (color: number, dx: number, dy: number) =>
      g.fillStyle(color).fillRect(x + dx + offset, y + dy, 1, 1);
    if (progress > 0.14)
      for (const [dx, dy] of [
        [8, 3],
        [8, 4],
        [7, 5],
        [7, 6],
        [8, 7],
        [9, 8],
      ] as const)
        pixel(P.ink, dx, dy);
    if (progress > 0.4)
      for (const [dx, dy] of [
        [8, 9],
        [7, 10],
        [6, 10],
        [5, 11],
        [5, 12],
        [4, 13],
      ] as const)
        pixel(P.ink, dx, dy);
    if (progress > 0.7)
      for (const [dx, dy] of [
        [10, 8],
        [11, 7],
        [12, 7],
        [13, 6],
        [8, 10],
        [9, 11],
        [9, 12],
        [10, 13],
      ] as const)
        pixel(P.ink, dx, dy);
    if (age < 85) {
      g.fillStyle(P.silver).fillRect(hitX - 1, hitY, 3, 1);
      g.fillRect(hitX, hitY - 1, 1, 3);
      g.fillStyle(P.steel).fillRect(x + 3 + offset, y + 3, 9, 1);
    }
  }
}
