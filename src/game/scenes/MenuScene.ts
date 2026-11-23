import Phaser from 'phaser';
import { keyLabel, loadControls } from '../config/controls';
import { DEVELOPER_MODE } from '../config/developer';
import { VIEW } from '../config/constants';
import { MENU_FX, MENU_LAYOUT, MENU_MUSIC, MENU_TITLE_TEXTURE } from '../config/menu';
import { PALETTE as P } from '../config/palette';
import { SPLASH } from '../config/splash';
import {
  archiveSave,
  archiveExpedition,
  formatPlayTime,
  loadMenuSettings,
  saveMenuSettings,
  summarizeSave,
  type MenuSettings,
  type SaveSummary,
  type StorageLike,
} from '../systems/MenuData';
import { decodeSave } from '../systems/SaveSystem';
import { loadDeferred, queueAssets, queueKeys } from '../systems/AssetLoader';
import {
  fullscreenLabel,
  fullscreenNotice,
  toggleFullscreen,
} from '../systems/DisplayMode';
import { DitherCover } from '../ui/DitherCover';
import { industrialFrame, hudPlate } from '../ui/Frame';
import { MenuAmbience } from '../ui/MenuAmbience';
import { MenuButton, ShadowText } from '../ui/MenuButton';
import { MenuTitle } from '../ui/MenuTitle';
import { createPixelFont, pixelText, smallText } from '../ui/PixelFont';
import { MiningScene } from './MiningScene';
import type { MenuEntrance } from './StudioIntroScene';

type PageId = 'main' | 'settings' | 'newConfirm' | 'exitConfirm' | 'exitInfo';
type Obj = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Visible &
  Phaser.GameObjects.Components.Depth;

interface Page {
  id: PageId;
  buttons: MenuButton[];
  /** Elementos del diálogo (marco, textos); el menú principal no tiene. */
  objects: Obj[];
  focus: number;
  back?: () => void;
}

const MAIN = MENU_LAYOUT.main;
const INFO = MENU_LAYOUT.info;
const DEPTH = {
  bg: 0,
  fx: 10,
  ui: 100,
  dim: 200,
  modal: 210,
  modalUi: 220,
  wipe: 1000,
};

const setVisible = (objects: readonly Obj[], visible: boolean) => {
  for (const o of objects) o.setVisible(visible);
};

const safeStorage = (): StorageLike | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/**
 * Menú principal: ilustración, título, cuatro botones, ajustes y diálogos.
 * Conecta con lo que existe: Continuar carga el guardado vigente (la
 * validación y la migración son las de SaveSystem), Nueva partida respalda la
 * actual y abre la pantalla de nombre y modalidad de MiningScene.
 */
export class MenuScene extends Phaser.Scene {
  private summary: SaveSummary = { state: 'none' };
  private settings: MenuSettings = { muted: false, effects: true };
  private storage: StorageLike | null = null;
  private ambience: MenuAmbience | null = null;
  private pages = {} as Record<PageId, Page>;
  private current: PageId = 'main';
  private infoIndex = 0;
  private info: ShadowText[] = [];
  private dim!: Phaser.GameObjects.Image;
  private wipeLayer!: Phaser.GameObjects.Graphics;
  private loadingObjects: Phaser.GameObjects.GameObject[] = [];
  private busy = true;
  private readonly handledKeys = new WeakSet<KeyboardEvent>();
  private newMessage!: ShadowText;
  private newLines: ShadowText[] = [];
  private soundButton!: MenuButton;
  private effectsButton!: MenuButton;
  private fullscreenButton!: MenuButton;
  private fullscreenNote!: ShadowText;
  private music: Phaser.Sound.BaseSound | null = null;
  /** Falso en cuanto el menú se cierra: la música no debe arrancar tarde. */
  private musicWanted = false;
  /** Cómo aparece el menú: persianas (por defecto) o tras la introducción. */
  private entrance: MenuEntrance = 'wipe';
  private entering = false;
  private entranceCover: DitherCover | null = null;
  private entranceTimers: Phaser.Time.TimerEvent[] = [];
  /** Logotipo con su subtítulo (ui/MenuTitle). */
  private title!: MenuTitle;
  /** Ayuda de teclas al pie. */
  private footer: Obj[] = [];
  /** Descripción contextual del botón elegido (solo un rato tras navegar). */
  private tip: Obj[] = [];
  private tipUntil = 0;
  private readonly lastSound = new Map<string, number>();
  private ambientLoop: Phaser.Sound.BaseSound | null = null;
  private lastPointerMove = 0;

  constructor() {
    super('MenuScene');
  }

  init(data?: { entrance?: MenuEntrance }): void {
    this.entrance = data?.entrance ?? 'wipe';
    this.footer = [];
    this.tip = [];
    this.tipUntil = 0;
    this.info = [];
    this.ambientLoop = null;
  }

  preload(): void {
    createPixelFont(this);
    const g = this.add.graphics();
    g.fillStyle(P.ink).fillRect(0, 0, VIEW.width, VIEW.height);
    g.fillStyle(P.steel).fillRect(159, 127, 162, 12);
    g.fillStyle(P.ink).fillRect(160, 128, 160, 10);
    const label = pixelText(this, 192, 112, 'CARGANDO MINA', P.cream);
    const bar = this.add.graphics();
    this.load.on('progress', (value: number) => {
      bar
        .clear()
        .fillStyle(P.gold)
        .fillRect(162, 130, Math.floor(156 * value), 6);
    });
    this.loadingObjects = [g, label, bar];
    queueAssets(this, [MENU_TITLE_TEXTURE]);
    const s = MENU_FX.sounds;
    queueKeys(this, [s.move.key, s.confirm.key, s.back.key, MENU_FX.ambience.key]);
  }

  create(): void {
    for (const o of this.loadingObjects) o.destroy();
    this.loadingObjects = [];
    this.cameras.main.setBackgroundColor(P.ink);
    this.storage = safeStorage();
    this.settings = loadMenuSettings(
      this.storage,
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    );
    this.sound.mute = this.settings.muted;
    this.summary = summarizeSave(this.storage, DEVELOPER_MODE);
    this.pages = {} as Record<PageId, Page>;
    this.current = 'main';
    this.newLines = [];

    // El menú ocupa toda la ventana: se oculta el marco de la página.
    if (!document.body.classList.contains('in-menu')) {
      document.body.classList.add('in-menu');
      window.dispatchEvent(new Event('resize'));
    }
    const status = document.querySelector('#game-status');
    if (status) status.textContent = 'Menú principal';

    this.add.image(0, 0, 'menu-bg').setOrigin(0).setDepth(DEPTH.bg);
    if (this.settings.effects) this.ambience = new MenuAmbience(this, DEPTH.fx);
    this.buildTitle();
    this.buildMain();
    this.buildInfoPlate();
    this.buildDim();
    this.buildSettings();
    this.buildNewConfirm();
    this.buildExitConfirm();
    this.buildExitInfo();
    this.wipeLayer = this.add.graphics().setDepth(DEPTH.wipe);

    // Ayuda discreta al pie: fuente pequeña, sin placa.
    const hint = smallText(
      this,
      MAIN.x,
      VIEW.height - 10,
      'FLECHAS: ELEGIR · ENTER: ACEPTAR · ESC: VOLVER',
      P.silver,
    ).setDepth(DEPTH.ui);
    this.footer.push(hint);

    const onKey = (event: KeyboardEvent) => this.onKey(event);
    this.input.keyboard?.on('keydown', onKey);
    // Profundidad: el puntero inclina levemente las capas del ambiente.
    const onMove = (p: Phaser.Input.Pointer) => {
      this.lastPointerMove = this.time.now;
      this.ambience?.setParallax(
        (p.x - VIEW.width / 2) / (VIEW.width / 2),
        (p.y - VIEW.height / 2) / (VIEW.height / 2),
      );
    };
    this.input.on('pointermove', onMove);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', onKey);
      this.input.off('pointermove', onMove);
      this.ambience?.destroy();
      this.ambience = null;
      this.stopMusic();
      this.stopIntroAmbience();
      this.entranceTimers.forEach((t) => t.remove());
      this.entranceTimers = [];
      this.entranceCover = null;
      this.entering = false;
    });

    this.show('main');
    if (this.entrance === 'wipe') {
      this.startMusic(0);
      this.settleAmbience();
      this.title.play(260, !this.settings.effects);
      this.wipe('in', () => {
        this.busy = false;
      });
    } else this.playEntrance(this.entrance);
  }

  // ------------------------------------------------ Entrada tras la intro

  /**
   * Entrada continua desde la introducción del estudio. «cinematic»: el fondo
   * se revela tramado desde el negro, el título aparece línea por línea
   * (MenuTitle) y los botones se deslizan uno a uno; la música sube de 0 a su
   * volumen y el viento de la introducción baja a su nivel de fondo. «quick» (al omitir): revelado breve, todo
   * visible de inmediato. Cualquier tecla o clic completa la entrada.
   */
  private playEntrance(kind: Exclude<MenuEntrance, 'wipe'>): void {
    const cfg = SPLASH.menuEntrance;
    this.entering = true;
    this.busy = true;
    this.settleAmbience();
    const cover = (this.entranceCover = new DitherCover(
      this,
      0,
      0,
      VIEW.width,
      VIEW.height,
      P.ink,
      DEPTH.wipe - 1,
    ));
    const reveal = (duration: number) =>
      this.tweens.addCounter({
        from: 1,
        to: 0,
        duration,
        ease: 'Sine.easeOut',
        onUpdate: (tween) => {
          if (cover.sprite.active) cover.set(tween.getValue() ?? 0);
        },
      });
    const later = (delay: number, fn: () => void) =>
      this.entranceTimers.push(this.time.delayedCall(delay, fn));
    if (kind === 'quick') {
      this.startMusic(SPLASH.skip.musicFadeIn);
      this.title.showInstant();
      reveal(SPLASH.skip.menuIn);
      later(SPLASH.skip.menuIn, () => this.finishEntrance());
      return;
    }
    this.startMusic(cfg.musicFadeIn);
    setVisible(this.footer, false);
    const buttons = this.pages.main.buttons;
    for (const b of buttons) b.setEnterOffset(-(MAIN.x + MAIN.w + 12));
    reveal(cfg.background);
    this.title.play(cfg.titleAt, !this.settings.effects);
    buttons.forEach((b, i) =>
      later(cfg.buttonsAt + i * cfg.buttonStagger, () => b.slideIn(cfg.buttonSlide)),
    );
    const end =
      cfg.buttonsAt + (buttons.length - 1) * cfg.buttonStagger + cfg.buttonSlide;
    later(end, () => setVisible(this.footer, true));
    later(Math.max(end, cfg.background) + 30, () => this.finishEntrance());
    // Un clic completa la entrada, pero el botón no se activa con ese clic.
    this.input.once('pointerdown', () => {
      if (!this.entering) return;
      this.finishEntrance(false);
      this.input.once('pointerup', () => (this.busy = false));
    });
  }

  /** Deja el menú completo y utilizable (al terminar o al interrumpir). */
  private finishEntrance(release = true): void {
    if (!this.entering) return;
    this.entering = false;
    this.entranceTimers.forEach((t) => t.remove());
    this.entranceTimers = [];
    this.entranceCover?.destroy();
    this.entranceCover = null;
    if (!this.title.revealed) this.title.showInstant();
    setVisible(this.footer, true);
    for (const b of this.pages.main.buttons) b.setEnterOffset(0);
    if (release) this.busy = false;
  }

  /**
   * Viento de galería bajo la música: si viene sonando desde la introducción
   * baja a su volumen de fondo; si no, empieza en silencio y sube.
   */
  private settleAmbience(): void {
    const { key, volume, fadeIn } = MENU_FX.ambience;
    let loop = this.sound.getAll(key).find((s) => s.isPlaying) ?? null;
    if (!loop) {
      if (!this.cache.audio.exists(key)) return;
      loop = this.sound.add(key, { loop: true, volume: 0 });
      const start = loop;
      if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, () => start.play());
      else start.play();
    }
    this.ambientLoop = loop;
    this.tweens.add({ targets: loop, volume, duration: fadeIn });
  }

  private stopIntroAmbience(): void {
    for (const s of this.sound.getAll(MENU_FX.ambience.key)) {
      s.stop();
      s.destroy();
    }
    this.ambientLoop = null;
  }

  /**
   * Sonidos de la interfaz. Un mismo sonido no se repite antes de
   * `MENU_FX.soundGap`; confirmar o volver cortan el tic de navegación.
   */
  private sfx(kind: keyof typeof MENU_FX.sounds): void {
    const { key, volume } = MENU_FX.sounds[kind];
    const now = this.time.now;
    if (now - (this.lastSound.get(key) ?? -1e9) < MENU_FX.soundGap) return;
    this.lastSound.set(key, now);
    if (kind !== 'move')
      for (const s of this.sound.getAll(MENU_FX.sounds.move.key)) s.stop();
    if (this.cache.audio.exists(key)) this.sound.play(key, { volume });
  }

  update(time: number, delta: number): void {
    if (this.settings.effects && this.ambience) {
      // Sin mover el puntero, la profundidad deriva sola, muy despacio.
      if (time - this.lastPointerMove > MENU_FX.idleDrift)
        this.ambience.setParallax(Math.sin(time / 9000) * 0.6, Math.sin(time / 13000) * 0.4);
      this.ambience.update(time, delta);
    }
    this.title.update(time, this.settings.effects && this.current === 'main');
    // Descripción contextual: solo un rato después de navegar.
    setVisible(this.tip, this.current === 'main' && !this.entering && time < this.tipUntil);
    for (const b of this.pages.main?.buttons ?? []) b.update(time);
    if (this.current !== 'main')
      for (const b of this.pages[this.current].buttons) b.update(time);
  }

  // ---------------------------------------------------------------- Títulos

  private buildTitle(): void {
    this.title = new MenuTitle(
      this,
      MAIN.x,
      MENU_FX.titleY,
      MENU_FX.subtitle,
      DEPTH.ui,
    );
  }

  // ------------------------------------------------------------- Principal

  private buildMain(): void {
    const canContinue = this.summary.state === 'ok';
    const labels = [
      'NUEVA PARTIDA',
      'CONTINUAR PARTIDA',
      'CONFIGURACION',
      'SALIR',
    ];
    const accents = [P.gold, P.gold, P.gold, P.red];
    const actions = [
      () => this.onNewGame(),
      () => this.startGame(false),
      () => this.show('settings'),
      () => this.show('exitConfirm'),
    ];
    const page: Page = {
      id: 'main',
      buttons: [],
      objects: [],
      focus: canContinue ? 1 : 0,
    };
    labels.forEach((label, i) => {
      const button = new MenuButton(
        this,
        MAIN.x,
        MAIN.y + i * MAIN.pitch,
        MAIN.w,
        MAIN.h,
        label === 'CONFIGURACION' ? 'CONFIGURACIÓN' : label,
        {
          accent: accents[i],
          onClick: () => this.activate(actions[i]!),
          onHover: () => this.hover(page, i),
        },
      ).setDepth(DEPTH.ui);
      if (i === 1) button.setEnabled(canContinue);
      page.buttons.push(button);
    });
    this.pages.main = page;
  }

  /**
   * Descripción contextual del botón elegido: una placa compacta bajo la
   * columna que aparece solo un rato después de navegar (teclado o cursor) y
   * se oculta sola. No hay texto permanente bajo los botones.
   */
  private buildInfoPlate(): void {
    const g = this.add.graphics().setDepth(DEPTH.ui);
    hudPlate(g, INFO.x, INFO.y, INFO.w, INFO.h);
    this.tip.push(g);
    for (let i = 0; i < 3; i++) {
      const line = new ShadowText(
        this,
        INFO.x + 6,
        INFO.y + 5 + i * 10,
        '',
        i ? P.silver : P.cream,
      );
      for (const o of line.objects) o.setDepth(DEPTH.ui).setVisible(false);
      this.tip.push(...line.objects);
      this.info.push(line);
    }
    g.setVisible(false);
  }

  /** Texto del panel inferior para el botón del menú principal `i`. */
  private describe(i: number): [string, string, string] {
    const s = this.summary;
    if (i === 0) return ['NUEVA MINA', 'ELIGES NOMBRE Y', 'MODALIDAD'];
    if (i === 2) return ['CONFIGURACIÓN', 'SONIDO, EFECTOS Y', 'CONTROLES'];
    if (i === 3) return ['SALIR DEL JUEGO', 'TU PROGRESO SE', 'GUARDA SOLO'];
    if (s.state === 'ok')
      return s.ended
        ? [s.mineName, 'EXPEDICIÓN TERMINADA', 'VER RESUMEN FINAL']
        : [
            s.mineName,
            `NIVEL ${s.level} - ${s.mode === 'hardcore' ? 'HARDCORE' : 'NORMAL'}`,
            `JUGADO: ${formatPlayTime(s.playMs)}`,
          ];
    if (s.state === 'corrupt')
      return [
        'GUARDADO ILEGIBLE',
        'NO SE PUEDE CONTINUAR',
        'SE RESPALDA AL EMPEZAR',
      ];
    if (s.state === 'unavailable')
      return ['SIN ALMACENAMIENTO', 'DEL NAVEGADOR: NO SE', 'PODRÁ GUARDAR'];
    return ['SIN PARTIDA GUARDADA', 'EMPIEZA UNA MINA', 'NUEVA PARA JUGAR'];
  }

  private refreshInfo(): void {
    const lines = this.describe(this.infoIndex);
    lines.forEach((text, i) => this.info[i]!.setText(text));
    this.info[0]!.setColor(
      this.infoIndex === 1 && this.summary.state !== 'ok' ? P.red : P.cream,
    );
  }

  // ---------------------------------------------------------- Ajustes

  private buildDim(): void {
    if (!this.textures.exists('menu-dim')) {
      const texture = this.textures.createCanvas(
        'menu-dim',
        VIEW.width,
        VIEW.height,
      )!;
      texture.context.fillStyle = '#0d1020';
      // Un píxel de cada cuatro (rejilla de 2 × 2): atenúa el menú sin el
      // damero del 50 %, que sobre la ilustración nítida se leía como ruido.
      for (let y = 0; y < VIEW.height; y += 2)
        for (let x = 0; x < VIEW.width; x += 2)
          texture.context.fillRect(x, y, 1, 1);
      texture.refresh();
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.dim = this.add
      .image(0, 0, 'menu-dim')
      .setOrigin(0)
      .setDepth(DEPTH.dim)
      .setVisible(false);
  }

  /** Marco de diálogo con barra de título; devuelve la página y un registro de objetos. */
  private dialog(
    id: PageId,
    x: number,
    y: number,
    w: number,
    h: number,
    title: string,
    accent: number,
    back: () => void,
  ): {
    page: Page;
    text: (tx: number, ty: number, value: string, color: number) => ShadowText;
  } {
    const page: Page = { id, buttons: [], objects: [], focus: 0, back };
    const g = this.add.graphics().setDepth(DEPTH.modal).setVisible(false);
    industrialFrame(g, x, y, w, h, { accent, title: 11 });
    page.objects.push(g);
    const text = (tx: number, ty: number, value: string, color: number) => {
      const t = new ShadowText(this, tx, ty, value, color);
      for (const o of t.objects) {
        o.setDepth(DEPTH.modal + 1).setVisible(false);
        page.objects.push(o);
      }
      return t;
    };
    text(x + 6, y + 2, title, accent);
    this.pages[id] = page;
    return { page, text };
  }

  private dialogButton(
    page: Page,
    x: number,
    y: number,
    w: number,
    text: string,
    accent: number,
    onClick: () => void,
  ): MenuButton {
    const index = page.buttons.length;
    const button = new MenuButton(this, x, y, w, 20, text, {
      accent,
      onClick: () => this.activate(onClick),
      onHover: () => this.hover(page, index),
    })
      .setDepth(DEPTH.modalUi)
      .setLive(false);
    page.buttons.push(button);
    return button;
  }

  private buildSettings(): void {
    const x = 90;
    const y = 24;
    const { page, text } = this.dialog(
      'settings',
      x,
      y,
      300,
      216,
      'CONFIGURACIÓN',
      P.gold,
      () => this.show('main'),
    );
    this.soundButton = this.dialogButton(
      page,
      x + 20,
      y + 22,
      260,
      '',
      P.gold,
      () => this.toggleSound(),
    );
    this.effectsButton = this.dialogButton(
      page,
      x + 20,
      y + 46,
      260,
      '',
      P.gold,
      () => this.toggleEffects(),
    );
    this.fullscreenButton = this.dialogButton(
      page,
      x + 20,
      y + 70,
      260,
      '',
      P.gold,
      () => this.toggleFullscreen(),
    );
    this.fullscreenNote = text(x + 20, y + 93, '', P.steel);
    this.refreshSettingLabels();

    text(x + 14, y + 102, 'CONTROLES', P.gold);
    const c = loadControls();
    const left: [string, string][] = [
      ['A / D', 'MOVERSE'],
      ['ESPACIO', 'SALTAR'],
      ['CLIC', 'EXCAVAR'],
      ['E / Z', 'INTERACTUAR'],
      [keyLabel(c.inventory), 'INVENTARIO'],
      [keyLabel(c.dismantle), 'DESMONTAR'],
      ['ESC', 'PAUSA'],
    ];
    const right: [string, string][] = [
      [keyLabel(c.withdraw), 'RETIRAR CARGA'],
      [keyLabel(c.headlamp), 'LINTERNA'],
      [keyLabel(c.battery), 'BATERÍA'],
      ['M', 'SONIDO'],
      [keyLabel(c.save), 'GUARDAR'],
      ['H / R', 'AYUDA / SUPERF.'],
      ['F11', 'PANT. COMPLETA'],
    ];
    const column = (list: [string, string][], cx: number) =>
      list.forEach(([key, action], i) => {
        text(cx, y + 114 + i * 9, key, P.gold);
        text(cx + 48, y + 114 + i * 9, action, P.cream);
      });
    column(left, x + 14);
    column(right, x + 154);
    text(x + 14, y + 180, 'REASIGNAR TECLAS: AÚN NO DISPONIBLE', P.stone);
    this.dialogButton(page, x + 80, y + 192, 140, 'VOLVER', P.gold, () =>
      this.show('main'),
    );
    // F11 o la pantalla completa del navegador: la etiqueta sigue el estado.
    const onFullscreen = () => this.refreshSettingLabels();
    this.game.events.on('fullscreenchange', onFullscreen);
    window.addEventListener('resize', onFullscreen);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('fullscreenchange', onFullscreen);
      window.removeEventListener('resize', onFullscreen);
    });
  }

  private refreshSettingLabels(): void {
    this.soundButton.setText(
      `SONIDO: ${this.settings.muted ? 'SILENCIADO' : 'ACTIVADO'}`,
    );
    this.effectsButton.setText(
      `EFECTOS AMBIENTALES: ${this.settings.effects ? 'ACTIVADOS' : 'REDUCIDOS'}`,
    );
    this.fullscreenButton.setText(fullscreenLabel());
  }

  private toggleFullscreen(): void {
    this.fullscreenNote.setText('');
    void toggleFullscreen().then((result) => {
      if (!this.sys.isActive()) return;
      this.fullscreenNote.setText(fullscreenNotice(result) ?? '');
      this.refreshSettingLabels();
    });
  }

  /** Sin almacenamiento los ajustes rigen solo esta visita (no hay aviso). */
  private persistSettings(): void {
    saveMenuSettings(this.storage, this.settings);
  }

  private toggleSound(): void {
    this.settings.muted = !this.settings.muted;
    this.sound.mute = this.settings.muted;
    this.persistSettings();
    this.refreshSettingLabels();
  }

  private toggleEffects(): void {
    this.settings.effects = !this.settings.effects;
    if (this.settings.effects) {
      this.ambience ??= new MenuAmbience(this, DEPTH.fx);
      this.ambience.setVisible(true);
    } else this.ambience?.setVisible(false);
    this.persistSettings();
    this.refreshSettingLabels();
  }

  // ------------------------------------------------------------ Diálogos

  private buildNewConfirm(): void {
    const x = 90;
    const y = 80;
    const { page, text } = this.dialog(
      'newConfirm',
      x,
      y,
      300,
      100,
      'PARTIDA EXISTENTE',
      P.red,
      () => this.show('main'),
    );
    for (let i = 0; i < 3; i++)
      this.newLines.push(
        text(x + 10, y + 20 + i * 11, '', i ? P.silver : P.cream),
      );
    this.newMessage = text(x + 10, y + 54, '', P.red);
    this.dialogButton(page, x + 14, y + 72, 130, 'CANCELAR', P.mint, () =>
      this.show('main'),
    );
    this.dialogButton(
      page,
      x + 156,
      y + 72,
      130,
      'EMPEZAR DE CERO',
      P.red,
      () => this.confirmNew(),
    );
    page.focus = 0;
  }

  private buildExitConfirm(): void {
    const x = 110;
    const y = 88;
    const { page, text } = this.dialog(
      'exitConfirm',
      x,
      y,
      260,
      88,
      'SALIR DEL JUEGO',
      P.red,
      () => this.show('main'),
    );
    text(x + 10, y + 20, '¿QUIERES CERRAR EL JUEGO?', P.cream);
    text(x + 10, y + 32, 'TU PROGRESO SE GUARDA SOLO.', P.silver);
    this.dialogButton(page, x + 10, y + 56, 110, 'VOLVER', P.mint, () =>
      this.show('main'),
    );
    this.dialogButton(page, x + 136, y + 56, 110, 'SALIR', P.red, () =>
      this.exitGame(),
    );
  }

  private buildExitInfo(): void {
    const x = 90;
    const y = 88;
    const { page, text } = this.dialog(
      'exitInfo',
      x,
      y,
      300,
      88,
      'SALIR DEL JUEGO',
      P.gold,
      () => this.show('main'),
    );
    // Breve: dos líneas y volver.
    text(x + 10, y + 20, 'EL NAVEGADOR NO DEJA CERRARLO.', P.cream);
    text(x + 10, y + 32, 'CIERRA LA PESTAÑA (CTRL+W).', P.silver);
    this.dialogButton(page, x + 80, y + 56, 140, 'VOLVER', P.gold, () =>
      this.show('main'),
    );
  }

  // ----------------------------------------------------------- Acciones

  private onNewGame(): void {
    if (this.summary.state === 'none' || this.summary.state === 'unavailable') {
      this.startGame(true);
      return;
    }
    const s = this.summary;
    const lines =
      s.state === 'ok'
        ? [
            `${s.mineName} - NIVEL ${s.level}`,
            'SE GUARDA UNA COPIA DE RESPALDO Y',
            'LA MINA NUEVA REEMPLAZA A LA ACTUAL.',
          ]
        : [
            'NO SE PUEDE LEER LA PARTIDA GUARDADA.',
            'SE CONSERVA UNA COPIA DE RESPALDO.',
            'SE COMENZARÁ UNA MINA NUEVA.',
          ];
    lines.forEach((line, i) => this.newLines[i]!.setText(line));
    this.newMessage.setText('');
    this.pages.newConfirm.focus = 0;
    this.show('newConfirm');
  }

  private confirmNew(): void {
    const s = this.summary;
    if (s.state === 'ok' || s.state === 'corrupt') {
      const storage = this.storage;
      const session = s.state === 'ok' && s.ended
        ? decodeSave(s.raw, DEVELOPER_MODE)?.session
        : undefined;
      const now = Date.now();
      const archived = storage && (session?.ended
        ? archiveExpedition(storage, s.raw, DEVELOPER_MODE, session.seed, session.ended, now)
        : archiveSave(storage, s.raw, DEVELOPER_MODE, now));
      if (!archived) {
        this.newMessage.setText(
          'NO SE PUDO CREAR EL RESPALDO: NO SE CAMBIÓ NADA.',
        );
        return;
      }
    }
    this.startGame(true);
  }

  private exitGame(): void {
    this.persistSettings();
    window.close();
    // Solo una pestaña abierta por script puede cerrarse: si seguimos aquí, se avisa.
    this.time.delayedCall(300, () => {
      if (this.scene.isActive('MenuScene')) this.show('exitInfo');
    });
  }

  /** Entra a la mina: nueva (pantalla de nombre y modalidad) o la guardada. */
  private startGame(fresh: boolean): void {
    if (this.busy) return;
    this.busy = true;
    MiningScene.pendingNew = fresh;
    this.fadeOutMusic();
    // El viento de fondo se va con la música.
    if (this.ambientLoop)
      this.tweens.add({ targets: this.ambientLoop, volume: 0, duration: MENU_FX.startFade });
    // Fundido tramado a negro y, ya en negro, la partida a ventana completa.
    const cover = new DitherCover(this, 0, 0, VIEW.width, VIEW.height, 0x000000, DEPTH.wipe);
    cover.set(0);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: MENU_FX.startFade,
      ease: 'Sine.easeIn',
      onUpdate: (tween) => cover.set(tween.getValue() ?? 1),
      onComplete: () => {
        cover.set(1);
        document.body.classList.remove('in-menu');
        window.dispatchEvent(new Event('resize'));
        this.scene.start('MiningScene', {});
      },
    });
  }

  // ----------------------------------------------------------------- Música

  /**
   * Carga la canción en segundo plano y la deja sonando en bucle. Si el
   * navegador aún no permite audio (sin interacción previa), Phaser la
   * reproduce en cuanto se desbloquea con el primer clic o tecla. Con
   * `fadeInMs` (tras la introducción) empieza en silencio y sube de a poco.
   */
  private startMusic(fadeInMs: number): void {
    this.musicWanted = true;
    loadDeferred(this, MENU_MUSIC.key)
      .then(() => {
        if (!this.musicWanted || this.music) return;
        if (!this.cache.audio.exists(MENU_MUSIC.key)) return;
        const music = this.sound.add(MENU_MUSIC.key, {
          loop: true,
          volume: fadeInMs > 0 ? 0 : MENU_MUSIC.volume,
        });
        this.music = music;
        const play = () => {
          if (!this.musicWanted || this.music !== music) return;
          music.play();
          // Entrada progresiva: de 0 a su volumen normal.
          if (fadeInMs > 0)
            this.tweens.add({
              targets: music,
              volume: MENU_MUSIC.volume,
              duration: fadeInMs,
              ease: 'Sine.easeIn',
            });
        };
        if (this.sound.locked)
          this.sound.once(Phaser.Sound.Events.UNLOCKED, play);
        else play();
      })
      .catch(() => {
        // Sin la canción el menú funciona igual; no se reintenta.
      });
  }

  private fadeOutMusic(): void {
    this.musicWanted = false;
    const music = this.music;
    if (!music?.isPlaying) return;
    this.tweens.add({
      targets: music,
      volume: 0,
      duration: MENU_MUSIC.fadeOutMs,
    });
  }

  private stopMusic(): void {
    this.musicWanted = false;
    this.music?.stop();
    this.music?.destroy();
    this.music = null;
  }

  private activate(action: () => void): void {
    if (this.busy) return;
    this.sfx('confirm');
    action();
  }

  // -------------------------------------------------- Páginas y navegación

  private show(id: PageId): void {
    this.current = id;
    const modal = id !== 'main';
    this.dim.setVisible(modal);
    const main = this.pages.main;
    main.buttons.forEach((b) => b.setBlocked(modal));
    for (const [pageId, page] of Object.entries(this.pages) as [
      PageId,
      Page,
    ][]) {
      if (pageId === 'main') continue;
      const open = pageId === id;
      for (const o of page.objects) o.setVisible(open);
      for (const b of page.buttons) b.setLive(open);
    }
    const page = this.pages[id];
    this.focusPage(page, this.firstEnabled(page, page.focus));
  }

  private firstEnabled(page: Page, from: number): number {
    const n = page.buttons.length;
    for (let k = 0; k < n; k++) {
      const i = (from + k) % n;
      if (page.buttons[i]!.isEnabled) return i;
    }
    return 0;
  }

  /** `user`: lo pidió el jugador (suena y muestra la descripción). */
  private focusPage(page: Page, index: number, user = false): void {
    const changed = page.focus !== index;
    page.focus = index;
    page.buttons.forEach((b, i) => b.setFocused(i === index && b.isEnabled));
    if (page.id === 'main') {
      this.infoIndex = index;
      this.refreshInfo();
      if (user) this.tipUntil = this.time.now + MENU_FX.tipMs;
    }
    if (user && changed) this.sfx('move');
  }

  private hover(page: Page, index: number): void {
    if (this.busy || page.id !== this.current) return;
    if (page.id === 'main') {
      // Continuar desactivado también explica por qué (sin partida guardada).
      this.infoIndex = index;
      this.refreshInfo();
      this.tipUntil = this.time.now + MENU_FX.tipMs;
    }
    if (page.buttons[index]!.isEnabled) this.focusPage(page, index, true);
  }

  private onKey(event: KeyboardEvent): void {
    const code = event.code;
    const page = this.pages[this.current];
    if (!page) return;
    const prev = ['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA'];
    const next = ['ArrowDown', 'ArrowRight', 'KeyS', 'KeyD'];
    const accept = ['Enter', 'NumpadEnter', 'Space', 'KeyZ', 'KeyE'];
    const handled = [...prev, ...next, ...accept, 'Escape', 'Backspace'];
    // Durante la entrada tras la intro, una tecla solo la completa.
    if (this.entering) {
      if (!event.repeat) this.finishEntrance();
      if (handled.includes(code)) event.preventDefault();
      this.handledKeys.add(event);
      return;
    }
    if (!handled.includes(code)) return;
    event.preventDefault();
    // Si dos teclas caen en el mismo fotograma, Phaser puede entregar un mismo
    // evento dos veces: cada evento del navegador se atiende una sola vez.
    if (this.handledKeys.has(event)) return;
    this.handledKeys.add(event);
    if (this.busy) return;
    const n = page.buttons.length;
    const move = (d: number) => {
      for (let k = 1; k <= n; k++) {
        const i = (page.focus + d * k + n * k) % n;
        if (page.buttons[i]!.isEnabled) return this.focusPage(page, i, true);
      }
    };
    if (prev.includes(code)) move(-1);
    else if (next.includes(code)) move(1);
    else if (accept.includes(code)) {
      if (event.repeat) return;
      // Con teclado el botón se hunde un instante, como con el clic.
      const button = page.buttons[page.focus];
      button?.pulse();
      button?.activate();
    } else if (!event.repeat && page.back) {
      this.sfx('back');
      page.back();
    }
  }

  // ------------------------------------------------------- Transición

  /**
   * Persianas de 16 px que cubren o descubren la pantalla en escalones de
   * 6 px, alternando arriba y abajo. Sin alfa parcial.
   */
  private wipe(direction: 'in' | 'out', done?: () => void): void {
    const bars = VIEW.width / 16;
    const g = this.wipeLayer;
    const draw = (cover: number) => {
      g.clear().fillStyle(P.ink);
      for (let i = 0; i < bars; i++) {
        const local = Phaser.Math.Clamp(
          cover * 1.8 - (i * 0.8) / (bars - 1),
          0,
          1,
        );
        const h =
          local >= 1
            ? VIEW.height
            : Math.round((local * VIEW.height) / 6) * 6;
        if (h > 0) g.fillRect(i * 16, i % 2 ? 0 : VIEW.height - h, 16, h);
      }
    };
    const from = direction === 'out' ? 0 : 1;
    this.tweens.addCounter({
      from,
      to: 1 - from,
      duration: 520,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => draw(tween.getValue() ?? 0),
      onComplete: () => {
        draw(1 - from);
        done?.();
      },
    });
  }
}
