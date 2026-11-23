import { showDeath } from './DeathScene';
import { WarehousePanel } from '../ui/WarehousePanel';
import { GALLERY_CARGO_LIMIT } from '../systems/GalleryRailway';
import Phaser from 'phaser';
import { DEVELOPER_MODE, DEVELOPER_SAVE_KEY } from '../config/developer';
import { PALETTE as P } from '../config/palette';
import { TopDownMiner } from '../entities/TopDownMiner';
import { WorldAudio } from '../systems/WorldAudio';
import { ACTION_AUDIO_KEYS } from '../config/actionAudio';
import { missingAssets, queueAssets } from '../systems/AssetLoader';
import { OperationsHUD } from '../ui/OperationsHUD';
import { createV3Art } from '../world/structures/V3Art';
import { InventoryPanel } from '../ui/InventoryPanel';
import { isFood } from '../config/survival';
import { loadControls } from '../config/controls';
import { DayNightCycle } from '../systems/DayNightCycle';
import { InteractionSystem } from '../systems/InteractionSystem';
import { readSavedRaw } from '../systems/MenuData';
import { decodeSave, encodeSave, SAVE_KEY } from '../systems/SaveSystem';
import { WORLD_REV_EXPLORE } from '../world/Geology';
import { createPixelFont, smallText } from '../ui/PixelFont';
import { CAMP_DOORS, CAMP_MAP } from '../config/topDownCamp';
import { buildCamp } from '../world/TopDownCamp';
import { CABIN_DOOR, CABIN_PORCH } from '../config/topDownCabin';
import { cabinFade } from '../ui/CabinInterior';
import { MINE_MODE, type MineVisit } from '../systems/MineModes';

const HELP = 'CAMPAMENTO · WASD o flechas para caminar';

export class TopDownScene extends Phaser.Scene {
  private worldAudio!: WorldAudio;
  miner!: TopDownMiner;
  private interactions!: InteractionSystem;
  private interactRequested = false;
  private ambience!: Phaser.GameObjects.Graphics;
  private tint!: Phaser.GameObjects.Rectangle;
  private readonly previewClock = new DayNightCycle();
  private visit?: MineVisit;
  private inventory?: InventoryPanel;
  private lastSave = 0;
  private readonly controls = loadControls();
  private get clock(): DayNightCycle {
    return this.visit?.session.dayNight ?? this.previewClock;
  }
  private prompt!: Phaser.GameObjects.BitmapText;
  private status!: HTMLElement;
  private safetyNoticeUntil = 0;
  private cabinTransition?: { at: number; visit: MineVisit };
  private arrivalAt?: number;
  private deathPending = false;
  private ready = false;
  private transition!: Phaser.GameObjects.TileSprite;
  private warehouse?: WarehousePanel;
  private hud?: OperationsHUD;

  constructor() {
    super('TopDownScene');
  }

  preload(): void {
    queueAssets(this, ACTION_AUDIO_KEYS);
  }

  create(data?: {
    fromGallery?: boolean;
    fromCabin?: boolean;
    visit?: MineVisit;
  }): void {
    const { width, height, spawnX, spawnY } = CAMP_MAP;
    const portal = CAMP_DOORS.find(({ id }) => id === 'mine')!;
    this.cabinTransition = undefined;
    this.deathPending = false;
    this.ready = false;
    this.hud = undefined;
    this.warehouse = undefined;
    this.visit = data?.visit;
    this.inventory = undefined;
    this.lastSave = this.time.now;
    this.arrivalAt = data?.fromCabin ? this.time.now : undefined;
    let spawn = data?.fromCabin
      ? CABIN_PORCH
      : data?.fromGallery
        ? { x: portal.x, y: portal.y + 10 }
        : { x: spawnX, y: spawnY };
    this.physics.world.setBounds(0, 0, width, height);
    if (!this.visit) {
      try {
        const raw = readSavedRaw(localStorage, DEVELOPER_MODE);
        const saved = JSON.parse(raw ?? 'null');
        this.previewClock.restore(saved?.dayNightMs);
        const loaded =
          raw && decodeSave(raw, DEVELOPER_MODE, WORLD_REV_EXPLORE);
        if (loaded && loaded.session.ended) {
          this.scene.start('MiningScene');
          return;
        }
        if (loaded && loaded.session.modeChosen) this.visit = loaded;
        if (saved?.topDownCabin?.inside === false && !data?.fromGallery)
          spawn = CABIN_PORCH;
        if (
          raw &&
          (saved?.topDownCabin?.inside || saved?.v8?.inCabin) &&
          !data?.fromCabin &&
          !data?.fromGallery
        ) {
          const visit = this.visit;
          if (visit?.session.modeChosen && !visit.session.ended)
            this.scene.start('TopDownCabinScene', visit);
        } else if (raw && saved?.gallery?.active && !data?.fromGallery) {
          const visit = this.visit;
          if (
            visit?.session.gallery?.active &&
            visit.session.modeChosen &&
            visit.session.loadout.complete &&
            !visit.session.ended
          )
            this.scene.start(MINE_MODE, visit);
        }
      } catch {
        this.clock.restore(undefined);
      }
    }
    this.miner = new TopDownMiner(this, spawn.x, spawn.y);
    createPixelFont(this);
    buildCamp(this, this.miner);
    if (this.visit && !missingAssets(this).length) {
      const session = this.visit.session;
      createV3Art(this);
      this.hud = new OperationsHUD(this);
      this.warehouse = new WarehousePanel(
        this,
        () => this.save(),
        GALLERY_CARGO_LIMIT,
      );
      this.inventory = new InventoryPanel(this, () => session);
      this.inventory.onQuick = (index) => this.quick(index);
      this.inventory.onUse = (kind) => this.use(kind);
      this.inventory.onChange = () => {
        this.save();
      };
      const unload = () => this.save();
      const click = (p: Phaser.Input.Pointer) => {
        if (
          !this.warehouse?.open &&
          !this.inventory?.open &&
          !this.cabinTransition &&
          this.arrivalAt === undefined
        ) {
          const slot = this.hud!.quickAt(p.x, p.y);
          if (slot >= 0) this.quick(slot);
        }
      };
      this.input.on('pointerdown', click);
      window.addEventListener('pagehide', unload);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.input.off('pointerdown', click);
        window.removeEventListener('pagehide', unload);
      });
      this.miner.present(this.time.now, { hp: session.health.hp });
    }
    this.cameras.main
      .setBounds(0, 0, width, height)
      .startFollow(this.miner, true, 0.16, 0.16);

    this.interactions = new InteractionSystem();
    for (const { id, x, y, label, arrival } of CAMP_DOORS)
      this.interactions.register({
        id,
        x,
        y,
        label:
          arrival === 'cabin'
            ? 'ENTRAR A LA CABAÑA'
            : id === 'warehouse'
              ? 'ABRIR BODEGA'
              : label,
        radius: 17,
        enabled: true,
        action: () => {
          if (arrival === 'cabin' && this.enterCabin()) return;
          if (arrival === 'mine' && this.enterGallery()) return;
          if (
            id === 'warehouse' &&
            this.warehouse &&
            this.visit?.session.modeChosen &&
            !this.visit.session.ended &&
            this.visit.session.intro.step !== 'tools'
          ) {
            this.warehouse.show(this.visit.session);
            return;
          }
          if (!this.save()) return;
          this.scene.start('MiningScene', {
            campVisit: {
              arrival,
              time: this.clock.elapsedMs,
              total: this.clock.totalMs,
            },
          });
        },
      });
    this.interactRequested = false;
    this.safetyNoticeUntil = 0;
    const keys = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (this.warehouse?.open) {
        if (event.code === 'Escape') this.warehouse.close();
        return;
      }
      if (this.cabinTransition || this.arrivalAt !== undefined) return;
      if (event.code === this.controls.inventory && this.inventory) {
        event.preventDefault();
        this.inventory.toggle();
      } else if (event.code === 'Escape') this.inventory?.close();
      else if (event.code === this.controls.save) this.save();
      else if (/^Digit[1-9]$/.test(event.code))
        this.quick(Number(event.code.at(-1)) - 1);
      else if (event.code === 'KeyZ' && !this.inventory?.open)
        this.interactRequested = true;
    };
    window.addEventListener('keydown', keys);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      window.removeEventListener('keydown', keys),
    );
    this.tint = this.add
      .rectangle(0, 0, width, height, 0xffffff)
      .setOrigin(0)
      .setDepth(height + 1)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.ambience = this.add.graphics().setDepth(height + 2);
    this.prompt = smallText(this, 0, 0, '', P.cream)
      .setOrigin(0.5, 1)
      .setDepth(height + 3);
    this.transition = cabinFade(this);
    if (this.arrivalAt !== undefined)
      this.transition.setVisible(true).setFrame(16);
    this.status = document.querySelector('#game-status')!;
    this.status.textContent = HELP;
    document.querySelector<HTMLButtonElement>('#restart')!.textContent =
      'Volver al juego lateral';
    this.ready = true;
    this.worldAudio = new WorldAudio(this);
  }

  closeWarehouse(): boolean {
    if (!this.warehouse?.open) return false;
    this.warehouse.close();
    return true;
  }

  private save(): boolean {
    if (!this.visit) return true;
    try {
      localStorage.setItem(
        DEVELOPER_MODE ? DEVELOPER_SAVE_KEY : SAVE_KEY,
        encodeSave(this.visit.session, this.visit.player),
      );
      this.lastSave = this.time.now;
      return true;
    } catch {
      this.hud?.announce('ERROR AL GUARDAR');
      return false;
    }
  }

  private quick(index: number): void {
    const s = this.visit?.session;
    if (!s) return;
    const ref = s.loadout.quickbar[index];
    if (ref?.type === 'supply' && isFood(ref.kind)) this.use(ref.kind);
    else {
      s.loadout.selectQuick(index);
      this.save();
    }
  }

  private use(kind: string): string | undefined {
    if (!isFood(kind) || !this.visit) return;
    const result = this.visit.session.eat(kind);
    if (result.ok) {
      this.miner.eat(kind, this.time.now, result.message);
      this.save();
    } else this.hud?.announce(result.message);
    return result.message;
  }
  private enterCabin(): boolean {
    try {
      const visit = this.visit;
      if (!visit || !visit.session.modeChosen || visit.session.ended)
        return false;
      visit.session.topDownCabin = { inside: true, position: CABIN_DOOR };
      this.cabinTransition = { at: this.time.now, visit };
      return true;
    } catch {
      return false;
    }
  }

  private enterGallery(): boolean {
    try {
      const visit = this.visit;
      if (!visit || !visit.session.modeChosen || visit.session.ended)
        return false;
      if (!visit.session.loadout.complete) {
        this.safetyNoticeUntil = this.time.now + 3500;
        return true;
      }
      if (visit.session.intro.step === 'mine')
        visit.session.intro.mineInspected(visit.session.stats.mined);
      visit.session.topDownCabin = undefined;
      this.scene.start(MINE_MODE, visit);
      return true;
    } catch {
      return false;
    }
  }

  private handleDeath(visit: MineVisit): void {
    this.deathPending = true;
    showDeath(this, visit.session, visit.player, {
      key: 'TopDownScene',
      data: { visit },
    });
  }

  update(time: number, delta: number): void {
    if (!this.ready || this.deathPending) return;
    if (this.visit?.session.health.dead) return this.handleDeath(this.visit);
    this.worldAudio.update(delta, 0, this.clock.sunStrength, 'outdoors');
    if (this.warehouse?.open) {
      this.miner.step(delta, false);
      this.miner.present(time, { suspended: true });
      this.prompt.setVisible(false);
      this.interactRequested = false;
      this.status.textContent = 'BODEGA · ALMACENAMIENTO';
      return;
    }
    if (this.cabinTransition || this.arrivalAt !== undefined) {
      this.interactRequested = false;
      this.miner.step(delta, false);
      this.miner.present(time, { suspended: true });
      const elapsed = time - (this.cabinTransition?.at ?? this.arrivalAt!);
      const frame = Math.min(16, Math.max(0, Math.ceil(elapsed / 15)));
      this.transition
        .setVisible(true)
        .setFrame(this.cabinTransition ? frame : 16 - frame);
      if (elapsed >= 240) {
        if (this.cabinTransition)
          this.scene.start('TopDownCabinScene', this.cabinTransition.visit);
        else {
          this.arrivalAt = undefined;
          this.transition.setVisible(false);
        }
      }
      this.tint.setFillStyle(this.clock.tint());
      this.drawAmbience(time);
      return;
    }
    const s = this.visit?.session;
    const modal = !!this.inventory?.open || document.hidden;
    this.miner.step(delta, !modal, s?.survival.speedFactor);
    if (!modal && s) {
      s.tickTopDown(delta, time, {
        walking: this.miner.body.velocity.length() > 5,
        pushingLoaded: false,
      });
      if (s.health.dead) return this.handleDeath(this.visit!);
    } else if (!s) this.clock.tick(delta, document.hidden);
    this.miner.present(time, {
      hp: s?.health.hp,
      tired: !!s && (s.survival.energyUnits <= 1 || s.survival.starving),
    });
    if (s && this.hud) {
      this.hud.update(s, false, '', time, modal, false);
      this.inventory?.update(time);
      if (time - this.lastSave >= 5000) this.save();
    }
    const target = this.interactions.select(
      this.miner,
      0,
      ({ y }) => this.miner.y >= y - 6,
    );
    this.prompt.setVisible(!!target && !modal);
    const message =
      target?.id === 'mine' && time < this.safetyNoticeUntil
        ? 'EQUIPA EL KIT DE SEGURIDAD DE LA BODEGA'
        : target
          ? '[Z] ' + target.label
          : HELP;
    if (this.status.textContent !== message) this.status.textContent = message;
    if (target) {
      this.prompt
        .setText(message)
        .setPosition(Math.round(target.x), Math.round(target.y + 22));
    }
    if (this.interactRequested) {
      this.interactRequested = false;
      if (!modal) this.interactions.activate();
    }

    this.tint.setFillStyle(this.clock.tint());
    this.drawAmbience(time);
  }

  private drawAmbience(time: number): void {
    const g = this.ambience.clear();
    for (let i = 0; i < 4; i++) {
      const age = ((time + i * 390) % 1560) / 1560;
      const x = Math.round(327 - age * 26);
      const y = Math.round(194 - age * 30);
      const size = 2 + Math.floor(age * 5);
      g.fillStyle(age > 0.62 ? P.khaki : P.taupe).fillRect(x, y + 1, size, 3);
      g.fillStyle(P.sand).fillRect(x + 1, y, size - 1, 2);
    }
    // Sombras de nubes discretas en la parte abierta de la quebrada.
    const cloud = Math.round((time * 0.006) % (CAMP_MAP.width + 110)) - 110;
    if (this.clock.isDay) {
      g.fillStyle(P.desertSoil);
      for (let i = 0; i < 26; i++)
        g.fillRect(cloud + i * 4, 385 + Math.round(Math.sin(i / 5) * 5), 2, 1);
      for (let i = 0; i < 4; i++) {
        const x =
          Math.round((time * 0.032 + i * 15) % (CAMP_MAP.width + 80)) - 30;
        const y = 192 + i * 5 + Math.round(Math.sin(time / 800 + i) * 7);
        const wing = Math.floor(time / 150 + i) % 2 ? -1 : 1;
        g.fillStyle(P.earth)
          .fillRect(x - 1, y, 3, 1)
          .fillRect(x - 3, y + wing, 2, 1)
          .fillRect(x + 2, y + wing, 2, 1);
      }
    } else {
      // Los puntos emisivos permanecen cálidos al pasar el tinte nocturno.
      for (const [x, y] of [
        [277, 253],
        [325, 253],
        [320, 254],
        [404, 237],
        [532, 269],
        [580, 269],
        [646, 274],
        [686, 274],
      ] as const)
        g.fillStyle(P.gold)
          .fillRect(x - 2, y, 5, 2)
          .fillStyle(P.cream)
          .fillRect(x - 1, y, 3, 1);
    }
  }
}
