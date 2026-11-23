import { showDeath } from './DeathScene';
import Phaser from 'phaser';
import { VIEW } from '../config/constants';
import { loadControls } from '../config/controls';
import { DEVELOPER_MODE, DEVELOPER_SAVE_KEY } from '../config/developer';
import { CABIN_NOTES, INTRO_DIALOGS } from '../config/intro';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { isFood } from '../config/survival';
import {
  CABIN_BED,
  CABIN_BEDSIDE,
  CABIN_BOARD,
  CABIN_DOOR,
  CABIN_FRIDGE,
  CABIN_LOCKER,
  CABIN_ROOM,
  validCabinPosition,
} from '../config/topDownCabin';
import { TopDownMiner } from '../entities/TopDownMiner';
import { WorldAudio } from '../systems/WorldAudio';
import { ACTION_AUDIO_KEYS } from '../config/actionAudio';
import { missingAssets, queueAssets } from '../systems/AssetLoader';
import { GALLERY_CARGO_LIMIT } from '../systems/GalleryRailway';
import { InteractionSystem } from '../systems/InteractionSystem';
import { encodeSave, SAVE_KEY } from '../systems/SaveSystem';
import { BookView } from '../ui/BookView';
import { cabinFade } from '../ui/CabinInterior';
import { DialogBox } from '../ui/DialogBox';
import { FridgePanel } from '../ui/FridgePanel';
import { InventoryPanel } from '../ui/InventoryPanel';
import { OperationsHUD } from '../ui/OperationsHUD';
import { createPixelFont, pixelText } from '../ui/PixelFont';
import { createV3Art } from '../world/structures/V3Art';
import { TopDownCabinView } from '../world/TopDownCabinView';
import type { GalleryVisit } from './GalleryScene';

const ARRIVE = 240;
const APPROACH = 460;
const LIE_DOWN = 330;
const DREAM = 560;
const FADE = 540;
const BLACK = 190;
const RISE = 470;
const REST_AT = APPROACH + LIE_DOWN + DREAM + FADE;
const WAKE_AT = REST_AT + BLACK + FADE;

export class TopDownCabinScene extends Phaser.Scene {
  private worldAudio!: WorldAudio;
  miner!: TopDownMiner;
  visit!: GalleryVisit;
  private room!: TopDownCabinView;
  private hud!: OperationsHUD;
  private inventory!: InventoryPanel;
  /** Refrigerador (interfaz tipo cofre; caducidad detenida adentro). */
  fridge!: FridgePanel;
  private dialog!: DialogBox;
  private book!: BookView;
  private fade!: Phaser.GameObjects.TileSprite;
  private tint!: Phaser.GameObjects.Rectangle;
  private wake!: Phaser.GameObjects.BitmapText;
  private interactions!: InteractionSystem;
  private status!: HTMLElement;
  private ready = false;
  private deathPending = false;
  private openedAt = 0;
  private leavingAt?: number;
  private rest?: { at: number; x: number; y: number; committed: boolean };
  private noticeUntil = 0;
  private lastSave = 0;
  private readonly pressed = new Set<string>();
  private readonly controls = loadControls();

  constructor() {
    super('TopDownCabinScene');
  }

  init(visit: GalleryVisit): void {
    this.visit = visit;
    this.ready = false;
    this.deathPending = false;
  }

  preload(): void {
    queueAssets(this, ACTION_AUDIO_KEYS);
  }

  create(): void {
    this.status = document.querySelector('#game-status')!;
    document.querySelector<HTMLButtonElement>('#restart')!.textContent =
      'Volver al campamento';
    if (missingAssets(this).length) {
      this.status.textContent =
        'No se cargaron los recursos de la cabaña. Vuelve al campamento.';
      return;
    }
    const s = this.visit.session;
    const saved = s.topDownCabin?.position;
    const p = saved && validCabinPosition(saved) ? saved : CABIN_DOOR;
    const { x, y, w, h } = CABIN_ROOM;
    this.physics.world.setBounds(x, y, w, h);
    this.miner = new TopDownMiner(this, p.x, p.y, 'wood');
    this.miner.face(0, -1);
    this.room = new TopDownCabinView(this, this.miner);
    createPixelFont(this);
    createV3Art(this);
    this.hud = new OperationsHUD(this);
    this.hud.zone = 'cabin';
    this.hud.cargoBlockLimit = GALLERY_CARGO_LIMIT;
    this.inventory = new InventoryPanel(this, () => s);
    this.inventory.cargoBlockLimit = GALLERY_CARGO_LIMIT;
    this.inventory.onQuick = (i) => this.quick(i);
    this.inventory.onUse = (kind) => this.use(kind);
    this.inventory.onChange = () => {
      this.save();
    };
    this.fridge = new FridgePanel(this, () => this.save());
    this.dialog = new DialogBox(this);
    this.book = new BookView(this);
    this.tint = this.add
      .rectangle(0, 0, VIEW.width, VIEW.height, 0xffffff)
      .setOrigin(0)
      .setDepth(DEPTH.lighting)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.fade = cabinFade(this);
    this.fade.setVisible(true).setFrame(16);
    this.wake = pixelText(
      this,
      240,
      52,
      'HAS DESCANSADO\nENERGIA RESTAURADA',
      P.cream,
    )
      .setOrigin(0.5, 0)
      .setCenterAlign()
      .setDepth(DEPTH.ui + 4)
      .setVisible(false);
    this.interactions = new InteractionSystem();
    this.register('exit', CABIN_DOOR, 'SALIR', () => this.requestExit(), 13);
    this.register('bed', CABIN_BEDSIDE, 'DORMIR', () => this.startRest(), 13);
    this.register('locker', CABIN_LOCKER, 'REVISAR CASILLERO', () => {
      const last = s.survival.lastSleep;
      this.hud.announce(
        `ENERGIA ${s.survival.energyUnits}/5 · ALIMENTACION ${s.survival.hungerUnits}/5` +
          (last
            ? ` · DESPERTASTE DE ${last.woke === 'day' ? 'DIA' : 'NOCHE'}`
            : ''),
      );
      this.inventory.show();
    });
    this.register(
      'fridge',
      CABIN_FRIDGE,
      'ABRIR REFRIGERADOR',
      () => this.fridge.show(s),
      14,
    );
    this.register(
      'board',
      CABIN_BOARD,
      'REVISAR TABLA',
      () => {
        if (s.intro.boardExamined()) {
          this.save();
          this.dialog.show(INTRO_DIALOGS.board, () => this.openBook());
        } else this.openBook();
      },
      12,
    );
    this.register(
      'window',
      { x: 263, y: 93 },
      'MIRAR VENTANA',
      () => this.hud.announce(CABIN_NOTES.window),
      11,
    );
    this.register(
      'stove',
      { x: 171, y: 183 },
      'REVISAR ESTUFA',
      () => this.hud.announce(CABIN_NOTES.stove),
      11,
    );

    this.register(
      'calendar',
      { x: 333, y: 94 },
      'REVISAR CALENDARIO',
      () => this.hud.announce(CABIN_NOTES.calendar),
      10,
    );
    this.register(
      'shelf',
      { x: 217, y: 109 },
      'REVISAR ESTANTE',
      () => this.hud.announce(CABIN_NOTES.shelf),
      10,
    );
    this.openedAt = this.time.now;
    this.leavingAt = undefined;
    this.rest = undefined;
    this.noticeUntil = 0;
    this.lastSave = this.time.now;
    this.pressed.clear();
    this.status.textContent = 'CABAÑA · WASD O FLECHAS';
    const keyboard = this.input.keyboard!;
    if (this.controls.inventory === 'Tab')
      keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.TAB);
    const key = (e: KeyboardEvent) => {
      if (!e.repeat) this.pressed.add(e.code);
    };
    const click = (p: Phaser.Input.Pointer) => {
      if (
        this.rest ||
        this.leavingAt !== undefined ||
        this.inventory.open ||
        this.fridge.open
      )
        return;
      if (this.dialog.open) return this.dialog.advance();
      if (this.book.open) return this.book.dismiss();
      const slot = this.hud.quickAt(p.x, p.y);
      if (slot >= 0) this.quick(slot);
    };
    const unload = () => {
      this.save();
    };
    keyboard.on('keydown', key);
    this.input.on('pointerdown', click);
    window.addEventListener('pagehide', unload);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown', key);
      this.input.off('pointerdown', click);
      window.removeEventListener('pagehide', unload);
    });
    s.topDownCabin = { inside: true, position: p };
    s.inCabin = false;
    if (s.gallery) s.gallery.active = false;
    s.intro.update({
      hasTools: s.tools.hasPick() && !!s.tools.usable('shovel'),
      kitReady: s.loadout.complete,
      mined: s.stats.mined,
    });
    this.ready = true;
    this.worldAudio = new WorldAudio(this);
    this.miner.present(this.time.now, { hp: s.health.hp });
    if (s.intro.step === 'welcome') {
      this.dialog.show(INTRO_DIALOGS.welcome, () => {
        s.intro.welcomeDone();
        this.save();
      });
    } else if (s.intro.cabinEntered()) this.dialog.show(INTRO_DIALOGS.home);
    this.save();
  }

  private register(
    id: string,
    point: { x: number; y: number },
    label: string,
    action: () => void,
    radius = 17,
  ): void {
    this.interactions.register({
      id,
      ...point,
      label,
      action,
      radius,
      enabled: true,
    });
  }

  private save(inside = true): boolean {
    if (!this.ready || this.deathPending) return false;
    const s = this.visit.session;
    const p = { x: this.miner.x, y: this.miner.y };
    s.topDownCabin = {
      inside,
      position: this.rest
        ? CABIN_BEDSIDE
        : validCabinPosition(p)
          ? p
          : CABIN_DOOR,
    };
    try {
      localStorage.setItem(
        DEVELOPER_MODE ? DEVELOPER_SAVE_KEY : SAVE_KEY,
        encodeSave(s, this.visit.player),
      );
      return true;
    } catch {
      this.hud.announce('ERROR AL GUARDAR');
      return false;
    }
  }

  requestExit(): void {
    if (!this.ready) {
      this.scene.start('TopDownScene', { fromCabin: true });
    } else if (
      !this.rest &&
      this.leavingAt === undefined &&
      !this.dialog.open &&
      !this.book.open &&
      !this.inventory.open &&
      !this.fridge.open
    ) {
      if (Phaser.Math.Distance.BetweenPoints(this.miner, CABIN_DOOR) <= 13)
        this.leavingAt = this.time.now;
      else this.hud.announce('ACERCATE A LA PUERTA PARA SALIR');
    }
  }

  private quick(i: number): void {
    const s = this.visit.session;
    const ref = s.loadout.quickbar[i];
    if (ref?.type === 'supply' && isFood(ref.kind)) this.use(ref.kind);
    else {
      s.loadout.selectQuick(i);
      this.save();
    }
  }

  private use(kind: string): string | undefined {
    const s = this.visit.session;
    let message: string | undefined;
    if (isFood(kind)) {
      const result = s.eat(kind);
      if (result.ok) this.miner.eat(kind, this.time.now, result.message);
      message = result.message;
    } else if (kind === 'battery') message = s.replaceHeadlamp();
    if (message) {
      this.hud.announce(message);
      this.save();
    }
    return message;
  }

  private openBook(): void {
    this.book.show(() => {
      if (this.visit.session.intro.bookRead()) this.save();
    });
  }

  private startRest(): void {
    if (this.rest) return;
    const reason = this.visit.session.survival.canSleep();
    if (reason) {
      this.hud.announce(reason);
      return;
    }
    if (this.miner.x < 175 || this.miner.y < 120) {
      this.hud.announce('ACERCATE POR EL COSTADO DE LA CAMA');
      return;
    }
    this.rest = {
      at: this.time.now,
      x: this.miner.x,
      y: this.miner.y,
      committed: false,
    };
  }

  private animateRest(now: number): number {
    const rest = this.rest!;
    const elapsed = now - rest.at;
    if (elapsed < APPROACH) {
      const t = Phaser.Math.Easing.Sine.InOut(elapsed / APPROACH);
      this.miner.face(CABIN_BEDSIDE.x - rest.x || -1, CABIN_BEDSIDE.y - rest.y);
      this.miner.step(0, false, 1, true);
      this.miner.body.reset(
        Phaser.Math.Linear(rest.x, CABIN_BEDSIDE.x, t),
        Phaser.Math.Linear(rest.y, CABIN_BEDSIDE.y, t),
      );
      return 0;
    }
    if (elapsed < APPROACH + LIE_DOWN) {
      const t = (elapsed - APPROACH) / LIE_DOWN;
      this.miner.body.reset(
        Phaser.Math.Linear(CABIN_BEDSIDE.x, CABIN_BED.x, t),
        CABIN_BEDSIDE.y,
      );
      this.miner.setVisible(t < 0.52);
      this.room.sleepPose(Math.max(0, t * 2 - 1), now, false);
      return 0;
    }
    if (elapsed >= REST_AT && !rest.committed) {
      rest.committed = true;
      this.visit.session.sleep();
      this.save();
    }
    if (elapsed < WAKE_AT) {
      this.miner.setVisible(false);
      this.room.sleepPose(1, now, elapsed < REST_AT);
      return elapsed < REST_AT
        ? Phaser.Math.Clamp((elapsed - (REST_AT - FADE)) / FADE, 0, 1)
        : Phaser.Math.Clamp(1 - (elapsed - REST_AT - BLACK) / FADE, 0, 1);
    }
    const t = Phaser.Math.Clamp((elapsed - WAKE_AT) / RISE, 0, 1);
    this.room.sleepPose(Math.max(0, 1 - t * 2), now, false);
    this.miner.setVisible(t >= 0.48);
    this.miner.body.reset(
      Phaser.Math.Linear(CABIN_BED.x, CABIN_BEDSIDE.x, t),
      CABIN_BEDSIDE.y,
    );
    if (t === 1) {
      this.rest = undefined;
      this.noticeUntil = now + 2250;
      this.save();
    }
    return 0;
  }

  private handleDeath(): void {
    this.deathPending = true;
    const { session, player } = this.visit;
    session.topDownCabin = { inside: false, position: CABIN_DOOR };
    showDeath(this, session, player, {
      key: 'TopDownScene',
      data: { fromCabin: true, visit: this.visit },
    });
  }

  update(now: number, delta: number): void {
    if (!this.ready || this.deathPending) return;
    const s = this.visit.session;
    if (s.health.dead) return this.handleDeath();
    this.worldAudio.update(delta, 0, s.dayNight.sunStrength, 'cabin');
    const has = (code: string) => this.pressed.has(code);
    const use = has('KeyZ') || has('KeyE') || has('Enter');
    const elapsed = now - this.openedAt;
    const board = this.interactions.objects.get('board')!;
    board.enabled = s.intro.boardState !== 'hidden';
    board.label =
      s.intro.boardState === 'open' ? 'LEER LIBRO' : 'REVISAR TABLA';
    const target = this.interactions.select(
      this.miner,
      0,
      (item) =>
        item.id !== 'bed' || (this.miner.x >= 175 && this.miner.y >= 120),
    );
    const wasResting = !!this.rest;
    let fade = Phaser.Math.Clamp(1 - elapsed / ARRIVE, 0, 1);
    if (this.leavingAt !== undefined) {
      fade = Math.min(1, (now - this.leavingAt) / ARRIVE);
      if (fade >= 1) {
        if (this.save(false)) {
          this.scene.start('TopDownScene', { fromCabin: true });
          return;
        }
        s.topDownCabin!.inside = true;
        this.leavingAt = undefined;
      }
    } else if (this.rest) fade = this.animateRest(now);
    else if (elapsed >= ARRIVE) {
      if (this.dialog.open) {
        if (has('Escape')) this.dialog.skip();
        else if (use) this.dialog.advance();
      } else if (this.book.open) {
        if (has('Escape')) this.book.dismiss();
        else if (use) this.book.dismiss();
      } else if (this.fridge.open) {
        // Refrigerador abierto: ventana modal (el reloj no corre).
        if (has('Escape') || has(this.controls.inventory)) this.fridge.close();
      } else {
        if (has(this.controls.inventory)) this.inventory.toggle();
        if (has('Escape')) this.inventory.close();
        for (let i = 0; i < 9; i++) if (has(`Digit${i + 1}`)) this.quick(i);
        if (has(this.controls.save) && this.save())
          this.hud.announce('PARTIDA GUARDADA');
        if (use && !this.inventory.open) this.interactions.activate();
      }
    }
    this.pressed.clear();
    const busy =
      this.leavingAt !== undefined ||
      elapsed < ARRIVE ||
      !!this.rest ||
      wasResting;
    const modal =
      this.dialog.open ||
      this.book.open ||
      this.inventory.open ||
      this.fridge.open;
    if (!this.rest)
      this.miner.step(delta, !busy && !modal, s.survival.speedFactor);
    if (!busy && !modal && !document.hidden) {
      s.tickTopDown(delta, now, {
        walking: this.miner.body.velocity.length() > 5,
        pushingLoaded: false,
      });
      if (s.health.dead) return this.handleDeath();
    }
    this.miner.present(now, {
      hp: s.health.hp,
      tired: s.survival.energyUnits <= 1 || s.survival.starving,
      suspended: busy,
    });
    this.fade.setVisible(fade > 0).setFrame(Math.ceil(fade * 16));
    this.tint.setFillStyle(s.dayNight.isDay ? 0xffffff : 0xbab0c9);
    this.room.ambient(s.dayNight, now);
    this.room.setBoard(s.intro.boardState);
    this.dialog.update(now);
    this.book.update(now);
    this.wake
      .setVisible(now < this.noticeUntil)
      .setY(
        49 +
          Math.min(
            4,
            Math.max(0, Math.floor((this.noticeUntil - now - 1950) / 55)),
          ),
      );
    const prompt = !busy && !modal && target ? `[Z] ${target.label}` : '';
    const status = this.rest
      ? 'CABAÑA · DESCANSANDO'
      : now < this.noticeUntil
        ? 'HAS DESCANSADO · ENERGÍA RESTAURADA'
        : prompt || 'CABAÑA · WASD O FLECHAS';
    if (this.status.textContent !== status) this.status.textContent = status;
    this.hud.promptLabel = prompt;
    this.hud.update(s, !!prompt, '', now, modal, false);
    this.inventory.update(now);
    if (now - this.lastSave >= 5000 && this.leavingAt === undefined) {
      this.lastSave = now;
      this.save();
    }
  }
}

