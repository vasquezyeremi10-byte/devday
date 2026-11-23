import Phaser from 'phaser';
import { MATERIAL_LABEL, TOOLS } from '../config/balance';
import { TILE_SIZE, VIEW } from '../config/constants';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { Miner } from '../entities/Miner';
import { skinOf } from '../entities/MinerLook';
import { queueAssets } from '../systems/AssetLoader';
import {
  createForgottenDepthsTerrain,
  createExpeditionState,
  EXPEDITION_SCENE,
  FORGOTTEN_DEPTHS,
  markExpeditionDug,
  type ExpeditionState,
} from '../systems/Expeditions';
import { crossFog, revealFromFog } from '../systems/FogTransit';
import type { MineVisit } from '../systems/MineModes';
import { MiningSystem } from '../systems/MiningSystem';
import { encodeSave, SAVE_KEY } from '../systems/SaveSystem';
import { WorkSystem } from '../systems/WorkSystem';
import { InventoryPanel } from '../ui/InventoryPanel';
import { createPixelFont, pixelText } from '../ui/PixelFont';
import { FogPortal } from '../ui/FogPortal';
import { mineralOf, TerrainGrid, type Cell } from '../world/TerrainGrid';
import { TerrainFrame } from '../world/TerrainVisuals';
import { TerrainView } from '../world/TerrainView';

/**
 * Mundo lateral independiente de minería. Esta escena no conoce la geología
 * de superficie: recibe solo sesión y punto de regreso mediante `MineVisit`.
 */
export class ExpeditionScene extends Phaser.Scene {
  visit!: MineVisit;
  state!: ExpeditionState;
  grid!: TerrainGrid;
  miner!: Miner;
  terrain!: TerrainView;
  mining!: MiningSystem;
  inventory!: InventoryPanel;
  private portal!: FogPortal;
  private selection!: Phaser.GameObjects.Graphics;
  private crack!: Phaser.GameObjects.Image;
  private prompt!: Phaser.GameObjects.BitmapText;
  private status!: HTMLElement;
  private readonly work = new WorkSystem();
  private locked = false;
  private interactionRequested = false;
  private lastSave = 0;
  private lastWarning = '';

  constructor() {
    super(EXPEDITION_SCENE);
  }

  init(visit: MineVisit): void {
    this.visit = visit;
    this.locked = visit.fromFog === true;
    this.interactionRequested = false;
  }

  preload(): void {
    queueAssets(this);
  }

  create(): void {
    const session = this.visit.session;
    this.state = session.expedition ?? createExpeditionState(session.seed);
    this.state.active = true;
    session.expedition = this.state;
    this.grid = createForgottenDepthsTerrain(this.state);
    this.mining = new MiningSystem(this.grid);
    this.status = document.querySelector('#game-status')!;
    this.drawCavernBackdrop();
    this.terrain = new TerrainView(this, this.grid);
    this.physics.world.setBounds(
      0,
      0,
      FORGOTTEN_DEPTHS.columns * TILE_SIZE,
      FORGOTTEN_DEPTHS.rows * TILE_SIZE,
    );
    this.miner = new Miner(this);
    const spawn = this.validSpawn(this.state.position)
      ? this.state.position
      : FORGOTTEN_DEPTHS.spawn;
    this.miner.body.reset(spawn.x, spawn.y);
    this.physics.add.collider(this.miner, this.terrain.layer);
    this.cameras.main
      .setBounds(
        0,
        0,
        FORGOTTEN_DEPTHS.columns * TILE_SIZE,
        FORGOTTEN_DEPTHS.rows * TILE_SIZE,
      )
      .startFollow(this.miner, true, 0.12, 0.12)
      .setDeadzone(100, 52);
    createPixelFont(this);
    this.portal = new FogPortal(
      this,
      FORGOTTEN_DEPTHS.returnPortal.x,
      FORGOTTEN_DEPTHS.returnPortal.y + 12,
    );
    this.selection = this.add.graphics().setDepth(DEPTH.worldUi);
    this.crack = this.add
      .image(0, 0, 'terrain', TerrainFrame.CrackFirst)
      .setOrigin(0)
      .setDepth(DEPTH.foreground)
      .setVisible(false);
    this.prompt = pixelText(this, VIEW.width / 2, VIEW.height - 18, '', P.cream)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 2)
      .setVisible(false);
    this.inventory = new InventoryPanel(this, () => session);
    this.inventory.onChange = () => this.persist();
    this.inventory.onQuick = () => this.work.cancel();
    this.inventory.onUse = () => undefined;
    const keyboard = this.input.keyboard!;
    const interact = keyboard.addKey('E', true, false);
    const tab = keyboard.addKey('TAB', true, false);
    const onInteract = () => (this.interactionRequested = true);
    const onTab = () => {
      if (this.locked) return;
      this.work.cancel();
      this.inventory.toggle();
    };
    interact.on('down', onInteract);
    tab.on('down', onTab);
    const unload = () => this.persist();
    window.addEventListener('pagehide', unload);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      interact.off('down', onInteract);
      tab.off('down', onTab);
      window.removeEventListener('pagehide', unload);
    });
    this.status.textContent = 'Profundidades Olvidadas · E para volver · Tab inventario';
    this.lastSave = this.time.now;
    if (this.locked) revealFromFog(this, () => (this.locked = false));
  }

  /** Se usa por el botón de salida común y por la tecla E junto al portal. */
  requestExit(): void {
    if (!this.locked && this.nearPortal()) this.returnToSurface();
  }

  private drawCavernBackdrop(): void {
    const width = FORGOTTEN_DEPTHS.columns * TILE_SIZE;
    const height = FORGOTTEN_DEPTHS.rows * TILE_SIZE;
    const g = this.add.graphics().setDepth(DEPTH.background);
    g.fillStyle(P.ink).fillRect(0, 0, width, height);
    for (let x = 0; x < width; x += 32) {
      const high = 30 + ((x / 32) % 5) * 8;
      g.fillStyle(P.night).fillRect(x, high, 32, height - high);
      g.fillStyle(P.indigo).fillRect(x + 4, high + 20, 2, 28);
      g.fillStyle(P.plum).fillRect(x + 20, high + 42, 1, 18);
    }
    // Niebla de cueva en bandas ralas: opaca y a píxel entero.
    for (let x = 18; x < width; x += 37) {
      const y = 112 + ((x * 7) % 90);
      g.fillStyle(P.duskViolet).fillRect(x, y, 12, 1);
      g.fillStyle(P.indigo).fillRect(x + 4, y + 3, 16, 1);
    }
  }

  private validSpawn(point: { x: number; y: number }): boolean {
    const cell = TerrainGrid.worldToCell(point.x, point.y - 4);
    return this.grid.contains(cell.column, cell.row) && !this.grid.isSolid(cell.column, cell.row);
  }

  private nearPortal(): boolean {
    return (
      Phaser.Math.Distance.Between(
        this.miner.x,
        this.miner.y,
        FORGOTTEN_DEPTHS.returnPortal.x,
        FORGOTTEN_DEPTHS.returnPortal.y,
      ) <= 28
    );
  }

  private target(): Cell {
    const pointer = this.input.activePointer;
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return TerrainGrid.worldToCell(point.x, point.y);
  }

  private mine(now: number): string {
    const pointer = this.input.activePointer;
    const cell = this.target();
    const result = this.mining.inspect(this.miner.body.center, cell);
    const x = cell.column * TILE_SIZE;
    const y = cell.row * TILE_SIZE;
    if (result !== 'empty' && result !== 'outside')
      this.selection
        .lineStyle(1, result === 'ready' ? P.gold : P.red)
        .strokeRect(x, y, TILE_SIZE, TILE_SIZE);
    if (!pointer.leftButtonDown() || result !== 'ready') {
      this.work.cancel();
      return '';
    }
    const session = this.visit.session;
    const tool = session.tools.current;
    const block = this.grid.get(cell.column, cell.row);
    const warning =
      (!session.loadout.complete ? 'EQUIPA EL EPP COMPLETO' : '') ||
      session.toolProblem(block) ||
      session.storageProblem(block) ||
      (!tool || TOOLS[tool.kind].type === 'drill' ? 'EQUIPA PICOTA O PALA' : '');
    if (warning) {
      this.work.cancel();
      if (warning !== this.lastWarning) this.status.textContent = warning;
      this.lastWarning = warning;
      return warning;
    }
    this.lastWarning = '';
    const key = `${cell.column},${cell.row}:${tool!.id}`;
    const complete = this.work.advance(key, now, session.workMs(cell, this.grid));
    const progress = this.work.progress;
    this.miner
      .setTexture(skinOf(tool), tool!.kind === 'shovel' ? 47 + Math.min(6, Math.floor(progress * 7)) : 16 + Math.floor((now / 60) % 6))
      .setFlipX(x + 8 < this.miner.x);
    this.crack
      .setVisible(true)
      .setPosition(x, y)
      .setFrame(TerrainFrame.CrackFirst + Math.min(3, Math.floor(progress * 4)));
    this.selection
      .fillStyle(P.ink)
      .fillRect(x - 1, y - 6, 18, 4)
      .fillStyle(P.gold)
      .fillRect(x, y - 5, Math.floor(progress * 16), 2);
    if (complete && session.mineExpedition(this.mining, this.grid, this.miner.body.center, cell)) {
      markExpeditionDug(this.state, this.grid, cell);
      this.terrain.remove(cell);
      const mineral = mineralOf(block);
      this.status.textContent = mineral
        ? `HALLAZGO: ${MATERIAL_LABEL[mineral]}`
        : 'ROCA EXTRAÍDA';
      this.work.cancel();
      this.persist();
    }
    return `EXCAVANDO ${Math.floor(progress * 100)}%`;
  }

  private persist(): boolean {
    this.state.position = { x: this.miner.x, y: this.miner.y };
    try {
      localStorage.setItem(SAVE_KEY, encodeSave(this.visit.session, this.visit.player));
      return true;
    } catch {
      this.status.textContent = 'NO SE PUDO GUARDAR LA EXPEDICIÓN';
      return false;
    }
  }

  private returnToSurface(): void {
    this.work.cancel();
    this.state.active = false;
    if (!this.persist()) {
      this.state.active = true;
      return;
    }
    crossFog(this, this.portal, this.miner, 'MiningScene', {
      mineVisit: { ...this.visit, fromFog: true },
    });
  }

  update(): void {
    if (!this.grid) return;
    const now = this.time.now;
    this.portal.update(now);
    this.selection.clear();
    this.crack.setVisible(false);
    const near = this.nearPortal();
    this.prompt
      .setVisible(near && !this.inventory.open && !this.locked)
      .setText('[E] REGRESAR A LA SUPERFICIE');
    if (this.locked) {
      this.miner.step(true);
      return;
    }
    if (this.interactionRequested) {
      this.interactionRequested = false;
      if (near) {
        this.returnToSurface();
        return;
      }
    }
    const blocked = this.inventory.open;
    this.miner.step(blocked);
    let text = '';
    if (!blocked) text = this.mine(now);
    else this.work.cancel();
    if (text) this.status.textContent = `${FORGOTTEN_DEPTHS.name} · ${text}`;
    this.inventory.update(now);
    if (now - this.lastSave > 5000) {
      this.lastSave = now;
      this.persist();
    }
  }
}
