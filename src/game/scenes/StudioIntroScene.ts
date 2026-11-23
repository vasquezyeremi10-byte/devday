import Phaser from 'phaser';
import { VIEW } from '../config/constants';
import { MENU_MUSIC, MENU_TITLE_TEXTURE } from '../config/menu';
import { PALETTE as P } from '../config/palette';
import { SPLASH, type SplashLogo } from '../config/splash';
import { queueAssets, queueKeys } from '../systems/AssetLoader';
import {
  buildTimeline,
  cuesBetween,
  itemAt,
  visibility,
  zoomFrame,
  type SplashItem,
  type SplashTimeline,
} from '../systems/SplashTimeline';
import { DitherCover } from '../ui/DitherCover';
import { createPixelFont, pixelText } from '../ui/PixelFont';
import { dissolveThreshold } from '../world/Dissolve';

/** Entrada que MenuScene recibe al terminar u omitir la introducción. */
export type MenuEntrance = 'wipe' | 'cinematic' | 'quick';

const CX = VIEW.width / 2;
const CY = VIEW.height / 2;
const DEPTH = { halo: 5, content: 10, cover: 100, prompt: 200, veil: 300 };

/**
 * Introducción del estudio: «DESARROLLADO POR», logotipo THE MINERS CL,
 * logotipos adicionales configurados (si los hay) y negro con ambiente antes
 * del menú. Todo se dibuja según el tiempo transcurrido (SplashTimeline), con
 * fundidos tramados de alfa binario. Esc, Espacio o un clic la omiten.
 *
 * Mientras corre, el resto de los recursos del juego se carga en segundo
 * plano para que el menú aparezca sin barra de carga.
 */
export class StudioIntroScene extends Phaser.Scene {
  static readonly KEY = 'StudioIntroScene';
  private timeline!: SplashTimeline;
  private elapsed = 0;
  private prev = -1;
  private running = false;
  private leaving = false;
  private startedAt = 0;
  private cover!: DitherCover;
  private veil!: DitherCover;
  private text!: Phaser.GameObjects.Container;
  private logo!: Phaser.GameObjects.Image;
  private halo!: Phaser.GameObjects.Image;
  private sponsors = new Map<SplashLogo, Phaser.GameObjects.Image>();
  private prompt: Phaser.GameObjects.GameObject[] = [];
  private sounds: Phaser.Sound.BaseSound[] = [];
  /** Para pruebas y depuración: etapa visible y sonidos lanzados. */
  readonly trace: { at: number; event: string }[] = [];

  constructor() {
    super(StudioIntroScene.KEY);
  }

  preload(): void {
    createPixelFont(this);
    queueKeys(this, [
      SPLASH.studio.key,
      SPLASH.studio.sound,
      SPLASH.sponsorSound,
      SPLASH.transition.ambience,
      ...SPLASH.sponsors.flatMap((s) => (s.sound ? [s.key, s.sound] : [s.key])),
    ]);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(P.ink);
    this.timeline = buildTimeline(SPLASH);
    this.elapsed = 0;
    this.prev = -1;
    this.running = false;
    this.leaving = false;
    this.sounds = [];
    this.trace.length = 0;
    this.sponsors.clear();
    this.prompt = [];

    this.buildText();
    this.buildLogo();
    for (const s of SPLASH.sponsors) {
      if (!this.textures.exists(s.key)) continue;
      this.sponsors.set(
        s,
        this.add.image(CX, CY, s.key).setDepth(DEPTH.content).setVisible(false),
      );
    }
    this.cover = new DitherCover(this, 0, 0, VIEW.width, VIEW.height, P.ink, DEPTH.cover);
    this.veil = new DitherCover(this, 0, 0, VIEW.width, VIEW.height, P.ink, DEPTH.veil).set(0);

    // El resto del juego (y la música del menú) se carga en segundo plano.
    queueAssets(this, [MENU_MUSIC.key, MENU_TITLE_TEXTURE]);
    this.load.start();

    this.input.keyboard?.on('keydown', this.onKey, this);
    this.input.on('pointerdown', this.onPointer, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.onKey, this);
      this.input.off('pointerdown', this.onPointer, this);
    });

    // El navegador no deja sonar nada sin una interacción previa: si el audio
    // está bloqueado se pide una pulsación antes de empezar.
    if (this.sound.locked) this.showPrompt();
    else this.begin();
  }

  update(_time: number, delta: number): void {
    if (!this.running || this.leaving) return;
    // Un salto grande (pestaña en segundo plano) no debe saltarse etapas.
    this.elapsed += Math.min(delta, 100);
    for (const cue of cuesBetween(this.timeline, this.prev, this.elapsed))
      this.play(cue.key, cue.volume, cue.loop);
    this.prev = this.elapsed;
    if (this.elapsed >= this.timeline.total) {
      this.finish('cinematic');
      return;
    }
    this.render(itemAt(this.timeline, this.elapsed));
  }

  // ------------------------------------------------------------ Elementos

  private buildText(): void {
    const label = pixelText(this, 0, 0, SPLASH.opening.text, P.cream).setLetterSpacing(2);
    label.setPosition(-Math.floor(label.width / 2), -4);
    const rule = this.add.graphics();
    const half = Math.floor(label.width / 2) + 10;
    // Filetes dorados a cada lado, con remache: sobrios, como la mina.
    for (const dir of [-1, 1]) {
      const x0 = dir < 0 ? -half - 32 : half;
      rule.fillStyle(P.gold).fillRect(x0, 0, 32, 1);
      rule.fillStyle(P.amber).fillRect(x0, 1, 32, 1);
      rule.fillStyle(P.cream).fillRect(dir < 0 ? -half - 2 : half + 1, -1, 1, 3);
    }
    this.text = this.add
      .container(CX, CY, [rule, label])
      .setDepth(DEPTH.content)
      .setVisible(false);
  }

  private buildLogo(): void {
    this.halo = this.add
      .image(CX, CY, this.haloTexture())
      .setDepth(DEPTH.halo)
      .setVisible(false);
    this.logo = this.add
      .image(CX, CY, SPLASH.studio.key, 0)
      .setDepth(DEPTH.content)
      .setVisible(false);
  }

  /**
   * Resplandor ámbar muy discreto detrás del logotipo: píxeles sueltos y
   * opacos cuya densidad baja con la distancia (sin alfa parcial ni blur).
   */
  private haloTexture(): string {
    const key = 'studio-halo';
    if (this.textures.exists(key)) return key;
    const size = 264;
    const t = this.textures.createCanvas(key, size, size)!;
    const ctx = t.context;
    const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
    for (let y = 0; y < size; y += 2)
      for (let x = 0; x < size; x += 2) {
        const r = Math.hypot(x - size / 2, y - size / 2);
        const density = Math.max(0, Math.min(1, (126 - r) / 50)) * 0.12;
        if (dissolveThreshold('cover', x, y) >= density * 64) continue;
        ctx.fillStyle = css(r < 100 ? P.rust : P.ember);
        ctx.fillRect(x, y, 2, 2);
      }
    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return key;
  }

  private showPrompt(): void {
    const line = pixelText(this, 0, 0, 'PULSA UNA TECLA O HAZ CLIC', P.cream).setLetterSpacing(1);
    line.setPosition(Math.floor(CX - line.width / 2), CY - 8);
    const hint = pixelText(this, 0, 0, 'PARA EMPEZAR CON SONIDO', P.steel);
    hint.setPosition(Math.floor(CX - hint.width / 2), CY + 6);
    const esc = pixelText(this, 0, 0, 'ESC: IR AL MENÚ', P.steel);
    esc.setPosition(Math.floor(CX - esc.width / 2), VIEW.height - 18);
    this.prompt = [line, hint, esc];
    for (const o of this.prompt)
      (o as Phaser.GameObjects.BitmapText).setDepth(DEPTH.prompt);
    // Parpadeo escalonado (visible / oculto), sin fundidos parciales.
    this.time.addEvent({
      delay: 650,
      loop: true,
      callback: () => {
        if (!this.running && line.active) line.setVisible(!line.visible);
      },
    });
  }

  // ------------------------------------------------------------- Flujo

  private begin(): void {
    for (const o of this.prompt) o.destroy();
    this.prompt = [];
    this.running = true;
    this.startedAt = this.time.now;
    this.trace.push({ at: 0, event: 'begin' });
  }

  private onKey(event: KeyboardEvent): void {
    if (event.repeat || this.leaving) return;
    if (!this.running) {
      if (event.code === 'Escape') this.skip();
      else this.begin();
      return;
    }
    if ((SPLASH.skipKeys as readonly string[]).includes(event.code)) {
      event.preventDefault();
      if (this.time.now - this.startedAt >= SPLASH.skipGuard) this.skip();
    }
  }

  private onPointer(): void {
    if (this.leaving) return;
    if (!this.running) return this.begin();
    if (this.time.now - this.startedAt >= SPLASH.skipGuard) this.skip();
  }

  /** Dibuja la etapa del instante actual. */
  private render(item: SplashItem | null): void {
    this.text.setVisible(item?.kind === 'text');
    const studio = item?.kind === 'logo' && item.studio;
    this.logo.setVisible(studio);
    this.halo.setVisible(studio);
    for (const [logo, image] of this.sponsors)
      image.setVisible(item?.kind === 'logo' && item.logo === logo);
    if (!item || item.kind === 'pause' || item.kind === 'black') {
      this.cover.set(1);
      return;
    }
    if (studio)
      this.logo.setFrame(zoomFrame(item, this.elapsed, SPLASH.studio.logo.sizes.length));
    this.cover.set(1 - visibility(item, this.elapsed));
  }

  private play(key: string, volume: number, loop: boolean): void {
    this.trace.push({ at: Math.round(this.elapsed), event: `sound:${key}` });
    if (!this.cache.audio.exists(key)) return;
    const sound = this.sound.add(key, { volume, loop });
    sound.play();
    if (!loop) sound.once(Phaser.Sound.Events.COMPLETE, () => sound.destroy());
    this.sounds.push(sound);
  }

  /** Omitir: corta sonidos y etapas pendientes y pasa al menú enseguida. */
  private skip(): void {
    if (this.leaving) return;
    this.trace.push({ at: Math.round(this.elapsed), event: 'skip' });
    this.leaving = true;
    this.running = false;
    for (const s of this.sounds) if (s.isPlaying || s.isPaused) s.stop();
    for (const s of this.sounds) s.destroy();
    this.sounds = [];
    const from = this.veil.coverage;
    this.tweens.addCounter({
      from,
      to: 1,
      duration: SPLASH.skip.out * (1 - from),
      onUpdate: (tween) => this.veil.set(tween.getValue() ?? 1),
      onComplete: () => this.whenLoaded(() => this.goToMenu('quick')),
    });
  }

  /** Final natural: el ambiente sigue sonando y el menú lo apaga despacio. */
  private finish(entrance: MenuEntrance): void {
    if (this.leaving) return;
    this.trace.push({ at: Math.round(this.elapsed), event: 'finish' });
    this.leaving = true;
    this.running = false;
    this.render(null);
    this.whenLoaded(() => this.goToMenu(entrance));
  }

  /** Si la carga en segundo plano no terminó, muestra su avance y espera. */
  private whenLoaded(done: () => void): void {
    if (!this.load.isLoading()) return done();
    const g = this.add.graphics().setDepth(DEPTH.veil + 1);
    const draw = () =>
      g
        .clear()
        .fillStyle(P.steel)
        .fillRect(159, VIEW.height - 24, 162, 6)
        .fillStyle(P.ink)
        .fillRect(160, VIEW.height - 23, 160, 4)
        .fillStyle(P.gold)
        .fillRect(161, VIEW.height - 22, Math.floor(158 * this.load.progress), 2);
    draw();
    this.load.on(Phaser.Loader.Events.PROGRESS, draw);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.load.off(Phaser.Loader.Events.PROGRESS, draw);
      done();
    });
  }

  private goToMenu(entrance: MenuEntrance): void {
    this.trace.push({ at: Math.round(this.elapsed), event: `menu:${entrance}` });
    this.scene.start('MenuScene', { entrance });
  }
}
