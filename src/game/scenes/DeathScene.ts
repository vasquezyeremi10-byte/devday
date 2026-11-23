import Phaser from 'phaser';
import { VIEW } from '../config/constants';
import { DEVELOPER_MODE, DEVELOPER_SAVE_KEY } from '../config/developer';
import { PALETTE as P } from '../config/palette';
import type { ExpeditionEnd, GameSession } from '../systems/GameSession';
import type { DamageSource } from '../systems/HealthSystem';
import { archiveExpedition } from '../systems/MenuData';
import { encodeSave, SAVE_KEY } from '../systems/SaveSystem';
import { industrialFrame } from '../ui/Frame';
import { MenuButton } from '../ui/MenuButton';
import { createPixelFont, pixelText, smallText } from '../ui/PixelFont';
import type { Point } from '../world/TerrainGrid';

const CAUSES: Record<DamageSource, string> = {
  derrumbe: 'APLASTADO POR UN DERRUMBE',
  roca: 'CAÍDA DE ROCAS',
  gnomo: 'ATAQUE DE UN GNOMO MINERO',
  tronadura: 'EXPLOSIÓN DE UNA TRONADURA',
  aire: 'AIRE IRRESPIRABLE',
  agotamiento: 'AGOTAMIENTO EXTREMO',
  hambre: 'DESNUTRICIÓN',
};

type Destination = { key: string; data?: object };
type DeathVisit = {
  owner: string;
  cause: string;
  end: ExpeditionEnd | null;
  loss: { money: number; items: number } | null;
  saved: boolean;
  retry: Destination;
  archive: () => void;
};

const DURATION = 360;

/** Aplica una sola vez la regla del modo y congela la escena visible. */
export function showDeath(
  owner: Phaser.Scene,
  session: GameSession,
  player: Point,
  retry: Destination,
): void {
  const cause =
    session.ended?.cause ??
    (session.health.lastSource
      ? CAUSES[session.health.lastSource]
      : 'ACCIDENTE MINERO');
  const end =
    session.ended ??
    (session.mode === 'hardcore' ? session.endExpedition(cause) : null);
  const loss = end ? null : session.die();
  const raw = encodeSave(session, player);
  let saved = false;
  try {
    localStorage.setItem(DEVELOPER_MODE ? DEVELOPER_SAVE_KEY : SAVE_KEY, raw);
    saved = true;
  } catch {
    // Reintentar conserva la sesión Normal en memoria.
  }
  const archive = () => {
    if (!end) return;
    try {
      archiveExpedition(
        localStorage,
        raw,
        DEVELOPER_MODE,
        session.seed,
        end,
        Date.now(),
      );
    } catch {
      // Se puede iniciar otra mina aunque el almacenamiento esté bloqueado.
    }
  };
  owner.scene.pause();
  owner.scene.launch('DeathScene', {
    owner: owner.sys.settings.key,
    cause,
    end,
    loss,
    saved,
    retry: end ? { key: 'MiningScene', data: { fresh: true } } : retry,
    archive,
  } satisfies DeathVisit);
  owner.scene.bringToTop('DeathScene');
}

/** Pantalla fija sobre el último fotograma de la escena en pausa. */
export class DeathScene extends Phaser.Scene {
  private visit!: DeathVisit;
  private buttons: MenuButton[] = [];
  private panel!: Phaser.GameObjects.Container;
  private veil!: Phaser.GameObjects.TileSprite;
  private shutters!: Phaser.GameObjects.Graphics;
  private openedAt = 0;
  private focused = 0;
  private locked = true;
  private leaving = false;

  constructor() {
    super('DeathScene');
  }

  create(visit: DeathVisit): void {
    this.visit = visit;
    this.openedAt = this.game.loop.time;
    this.locked = true;
    this.leaving = false;
    createPixelFont(this);
    const key = 'death-veil';
    if (!this.textures.exists(key)) {
      const texture = this.textures.createCanvas(key, 4, 4)!;
      texture.context.fillStyle = '#' + P.ink.toString(16).padStart(6, '0');
      texture.context.fillRect(0, 0, 4, 4);
      texture.context.clearRect(0, 0, 2, 2);
      texture.refresh();
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.veil = this.add
      .tileSprite(0, 0, VIEW.width, VIEW.height, key)
      .setOrigin(0)
      .setVisible(false);
    const plate = this.add.graphics();
    industrialFrame(plate, 65, 50, 350, 170, { accent: P.rust });
    // Viga de acero, remaches y marcas de peligro del socavón.
    plate.fillStyle(P.ink).fillRect(80, 62, 320, 9).fillRect(80, 204, 320, 4);
    plate.fillStyle(P.stone).fillRect(82, 62, 316, 1).fillRect(82, 206, 316, 1);
    for (const left of [83, 373])
      for (let x = 0; x < 20; x += 5)
        for (let y = 0; y < 5; y++)
          plate.fillStyle(P.rust).fillRect(left + x + y, 64 + y, 2, 1);
    const titleShadow = pixelText(this, 242, 82, 'HAS MUERTO', P.ink)
      .setOrigin(0.5, 0)
      .setScale(4);
    const title = pixelText(this, 240, 80, 'HAS MUERTO', P.red)
      .setOrigin(0.5, 0)
      .setScale(4);
    const center = (y: number, label: string, tint: number) =>
      pixelText(this, 240, y, label, tint).setOrigin(0.5, 0);
    const { end, loss } = visit;
    const cargo =
      loss?.items === 1 ? '1 BLOQUE' : `${loss?.items ?? 0} BLOQUES`;
    const detail = end
      ? `DÍA ${end.days}  ·  ${end.mined} BLOQUES  ·  PROFUNDIDAD ${end.deepestRow}`
      : `PERDISTE $${loss?.money ?? 0} Y ${cargo} DE CARGA`;
    const hint = !visit.saved
      ? 'NO SE PUDO GUARDAR'
      : end
        ? 'REINTENTAR INICIA UNA MINA NUEVA'
        : 'REAPARECES EN SUPERFICIE';
    this.panel = this.add
      .container(0, 0, [
        plate,
        titleShadow,
        title,
        center(119, visit.cause, P.cream),
        center(137, detail, P.silver),
        center(151, hint, P.steel),
        smallText(
          this,
          240,
          210,
          'FLECHAS O TAB: ELEGIR   ENTER: ACEPTAR',
          P.silver,
        ).setOrigin(0.5, 0),
      ])
      .setVisible(false);
    this.buttons = (['REINTENTAR', 'MENÚ PRINCIPAL'] as const).map(
      (label, index) =>
        new MenuButton(this, 90 + index * 154, 171, 142, 25, label, {
          onClick: () => this.activate(index),
          onHover: () => this.focus(index),
        }),
    );
    this.buttons.forEach((button) => button.setLive(false));
    this.focus(0);
    this.shutters = this.add.graphics().setDepth(1);
    const restart = document.querySelector<HTMLButtonElement>('#restart');
    const wasDisabled = restart?.disabled ?? false;
    if (restart) restart.disabled = true;
    document.querySelector<HTMLElement>('#game')?.focus();
    const status = document.querySelector('#game-status');
    if (status) status.textContent = 'Has muerto · ' + visit.cause;
    const keydown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (this.locked || event.repeat || this.leaving) return;
      if (['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'].includes(event.code))
        this.focus(0);
      else if (['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'].includes(event.code))
        this.focus(1);
      else if (event.code === 'Tab') this.focus(1 - this.focused);
      else if (['Enter', 'NumpadEnter', 'Space'].includes(event.code))
        this.activate(this.focused);
    };
    const keyup = (event: KeyboardEvent) => event.stopImmediatePropagation();
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('keyup', keyup, true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('keyup', keyup, true);
      if (restart) restart.disabled = wasDisabled;
    });
  }

  update(now: number): void {
    if (this.locked) {
      const progress = Math.min(1, (now - this.openedAt) / DURATION);
      this.veil.setVisible(progress >= 1 / 3);
      this.shutters.clear();
      if (progress >= 1) {
        this.locked = false;
        this.panel.setPosition(0, 0).setVisible(true);
        this.buttons.forEach((button) => button.setLive(true));
        this.focus(this.focused);
      } else {
        this.panel.setVisible(progress >= 0.55);
        this.panel.y = Math.round((1 - progress) * 12);
        this.shutters.fillStyle(P.ink);
        const closing = progress < 1 / 3;
        const shutter = closing ? progress * 3 : (1 - progress) * 1.5;
        for (let y = 0; y < VIEW.height; y += 10) {
          const stagger = (y * 13) % 34;
          const w = Math.min(
            VIEW.width / 2,
            Math.round(shutter * (VIEW.width / 2 + stagger)),
          );
          this.shutters.fillRect(0, y, w, 10);
          this.shutters.fillRect(VIEW.width - w, y, w, 10);
        }
      }
    }
    for (const button of this.buttons) button.update(now);
  }

  private focus(index: number): void {
    this.focused = index;
    this.buttons.forEach((button, i) => button.setFocused(i === index));
  }

  private activate(index: number): void {
    if (this.locked || this.leaving) return;
    this.leaving = true;
    const destination = index === 0 ? this.visit.retry : { key: 'MenuScene' };
    if (index === 0) this.visit.archive();
    this.scene.stop(this.visit.owner);
    this.scene.start(destination.key, destination.data);
  }
}
