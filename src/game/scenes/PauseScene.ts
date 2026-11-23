import Phaser from 'phaser';
import { VIEW } from '../config/constants';
import { PALETTE as P } from '../config/palette';
import {
  fullscreenLabel,
  fullscreenNotice,
  toggleFullscreen,
} from '../systems/DisplayMode';
import { loadMenuSettings, saveMenuSettings } from '../systems/MenuData';
import { industrialFrame } from '../ui/Frame';
import { MenuButton, ShadowText } from '../ui/MenuButton';
import { createPixelFont, smallText } from '../ui/PixelFont';

/** Lo que la partida entrega al abrir la pausa. */
export interface PauseVisit {
  /** Hay partida que guardar (modo elegido, expedición viva). */
  canSave: boolean;
  save: () => boolean;
  resume: () => void;
  toMenu: () => void;
}

type PageId = 'main' | 'settings';
interface Page {
  buttons: MenuButton[];
  focus: number;
}

const PANEL = { x: 150, y: 52, w: 180, h: 166 };
const BUTTON = { x: 164, w: 152, h: 20, pitch: 26, top: 78 };

const storage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/**
 * Menú de pausa de la partida (Esc): Reanudar, Configuración (sonido y
 * pantalla completa), Guardar partida y Volver al menú principal. Se abre
 * sobre la escena en pausa (el mundo, el reloj y la física quedan quietos) y
 * atrapa el teclado como la pantalla de muerte, para que ninguna tecla llegue
 * a la mina mientras está abierta.
 */
export class PauseScene extends Phaser.Scene {
  static readonly KEY = 'PauseScene';
  private visit!: PauseVisit;
  private pages = {} as Record<PageId, Page>;
  private current: PageId = 'main';
  private panel!: Phaser.GameObjects.Graphics;
  private title!: ShadowText;
  private message!: ShadowText;
  private soundButton!: MenuButton;
  private fullscreenButton!: MenuButton;
  private leaving = false;

  constructor() {
    super(PauseScene.KEY);
  }

  create(visit: PauseVisit): void {
    this.visit = visit;
    this.leaving = false;
    this.current = 'main';
    createPixelFont(this);
    this.buildVeil();
    this.panel = this.add.graphics();
    this.title = new ShadowText(this, PANEL.x + 6, PANEL.y + 2, 'PAUSA', P.gold);
    this.message = new ShadowText(this, 0, PANEL.y + PANEL.h - 30, '', P.silver);
    smallText(
      this,
      VIEW.width / 2,
      PANEL.y + PANEL.h - 12,
      'FLECHAS: ELEGIR  ENTER: ACEPTAR  ESC: VOLVER',
      P.silver,
    ).setOrigin(0.5, 0);

    const button = (page: Page, i: number, label: string, act: () => void) => {
      const index = page.buttons.length;
      const b = new MenuButton(
        this,
        BUTTON.x,
        BUTTON.top + i * BUTTON.pitch,
        BUTTON.w,
        BUTTON.h,
        label,
        { onClick: () => this.act(act), onHover: () => this.focus(page, index) },
      );
      page.buttons.push(b);
      return b;
    };
    const main: Page = { buttons: [], focus: 0 };
    button(main, 0, 'REANUDAR', () => this.resume());
    button(main, 1, 'CONFIGURACIÓN', () => this.show('settings'));
    button(main, 2, 'GUARDAR PARTIDA', () => this.save()).setEnabled(visit.canSave);
    button(main, 3, 'MENÚ PRINCIPAL', () => this.toMenu());
    const settings: Page = { buttons: [], focus: 0 };
    this.soundButton = button(settings, 0, '', () => this.toggleSound());
    this.fullscreenButton = button(settings, 1, '', () => this.toggleFullscreen());
    button(settings, 3, 'VOLVER', () => this.show('main'));
    this.pages = { main, settings };
    this.refreshLabels();
    this.show('main');

    // Teclado: se atiende aquí y no sigue hacia la mina. F11 queda libre
    // (lo maneja la pantalla completa, registrada antes en fase de captura).
    const keydown = (event: KeyboardEvent) => {
      if (event.code === 'F11') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat || this.leaving) return;
      const page = this.pages[this.current];
      if (['ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA'].includes(event.code)) this.move(page, -1);
      else if (['ArrowDown', 'KeyS', 'ArrowRight', 'KeyD', 'Tab'].includes(event.code))
        this.move(page, 1);
      else if (['Enter', 'NumpadEnter', 'Space', 'KeyE', 'KeyZ'].includes(event.code))
        page.buttons[page.focus]?.activate();
      else if (event.code === 'Escape' || event.code === 'Backspace') {
        if (this.current === 'settings') this.show('main');
        else this.resume();
      }
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.code !== 'F11') event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('keyup', keyup, true);
    const onFullscreen = () => this.refreshLabels();
    this.game.events.on('fullscreenchange', onFullscreen);
    window.addEventListener('resize', onFullscreen);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('keyup', keyup, true);
      this.game.events.off('fullscreenchange', onFullscreen);
      window.removeEventListener('resize', onFullscreen);
    });
    const status = document.querySelector('#game-status');
    if (status) status.textContent = 'Partida en pausa';
  }

  update(time: number): void {
    for (const b of this.pages[this.current]?.buttons ?? []) b.update(time);
  }

  /** Velo de damero de tinta sobre la mina (sin alfa parcial). */
  private buildVeil(): void {
    const key = 'pause-veil';
    if (!this.textures.exists(key)) {
      const t = this.textures.createCanvas(key, 2, 2)!;
      t.context.fillStyle = `#${P.ink.toString(16).padStart(6, '0')}`;
      // Un píxel de cada cuatro: atenúa la mina sin un damero denso.
      t.context.fillRect(0, 0, 1, 1);
      t.refresh();
      t.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.add.tileSprite(0, 0, VIEW.width, VIEW.height, key).setOrigin(0);
  }

  private show(id: PageId): void {
    this.current = id;
    this.message.setText('');
    const settings = id === 'settings';
    this.panel.clear();
    industrialFrame(this.panel, PANEL.x, PANEL.y, PANEL.w, PANEL.h, {
      accent: P.gold,
      title: 11,
    });
    this.title.setText(settings ? 'CONFIGURACIÓN' : 'PAUSA');
    for (const [pageId, page] of Object.entries(this.pages) as [PageId, Page][])
      for (const b of page.buttons) b.setLive(pageId === id);
    const page = this.pages[id];
    page.focus = page.buttons.findIndex((b) => b.isEnabled);
    this.focus(page, page.focus);
  }

  private focus(page: Page, index: number): void {
    page.focus = index;
    page.buttons.forEach((b, i) => b.setFocused(i === index));
  }

  private move(page: Page, d: number): void {
    const n = page.buttons.length;
    for (let k = 1; k <= n; k++) {
      const i = (page.focus + d * k + n * k) % n;
      if (page.buttons[i]!.isEnabled) return this.focus(page, i);
    }
  }

  private act(fn: () => void): void {
    if (this.leaving) return;
    this.sound.play('sfx-collect', { volume: 0.25, rate: 1.6 });
    fn();
  }

  private say(text: string, color: number = P.silver): void {
    this.message.setText(text).setColor(color);
    this.message.setPosition(
      Math.round(VIEW.width / 2 - this.message.width / 2),
      PANEL.y + PANEL.h - 28,
    );
  }

  private resume(): void {
    this.leaving = true;
    this.visit.resume();
  }

  private save(): void {
    const ok = this.visit.save();
    this.say(ok ? 'PARTIDA GUARDADA' : 'ERROR AL GUARDAR', ok ? P.mint : P.red);
  }

  private toMenu(): void {
    this.leaving = true;
    this.visit.toMenu();
  }

  /** Mismo ajuste que «Sonido» en la Configuración del menú principal. */
  private toggleSound(): void {
    const store = storage();
    const settings = loadMenuSettings(
      store,
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    );
    settings.muted = !this.sound.mute;
    this.sound.mute = settings.muted;
    saveMenuSettings(store, settings);
    this.refreshLabels();
  }

  private toggleFullscreen(): void {
    void toggleFullscreen().then((result) => {
      if (!this.sys.isActive()) return;
      const notice = fullscreenNotice(result);
      if (notice) this.say(notice, P.gold);
      this.refreshLabels();
    });
  }

  private refreshLabels(): void {
    this.soundButton.setText(`SONIDO: ${this.sound.mute ? 'SILENCIADO' : 'ACTIVADO'}`);
    this.fullscreenButton.setText(fullscreenLabel(true));
  }
}
