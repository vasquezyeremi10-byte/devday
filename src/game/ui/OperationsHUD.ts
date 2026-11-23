import type Phaser from 'phaser';
import {
  MATERIAL_LABEL,
  TOOLS,
  type Material,
  type SupplyKind,
} from '../config/balance';
import { DEPTH } from '../config/layers';
import { GAME_TITLE } from '../config/menu';
import { PALETTE as P } from '../config/palette';
import type { BuyKind, GameSession } from '../systems/GameSession';
import { heartHalves } from '../systems/HealthSystem';
import { hudPlate, hudSeparator, industrialFrame } from './Frame';
import { createHudIcons, type HudIcon } from './HudArt';
import { createSurvivalArt } from './SurvivalArt';
import { halvesOf } from '../systems/SurvivalSystem';
import { pixelText, smallText } from './PixelFont';
import {
  HUD_QUICK,
  QuickbarView,
  quickStatus,
  quickTooltip,
  setShopIcon,
} from './QuickbarView';

/**
 * V8: placa de supervivencia bajo los corazones (energía y alimentación,
 * cinco íconos cada una, alineados con los corazones).
 */
const SURVIVAL_PLATE = { x: 5, y: 28, w: 56, h: 22 } as const;
/** V9: placa de la batería de la linterna, junto a la de supervivencia. */
const BATTERY_PLATE = { x: 64, y: 28, w: 52, h: 22 } as const;
/** Primera línea de estado/avisos: bajo la placa de supervivencia. */
const NOTICE_Y = 55;


/**
 * Barra superior V8 en tres módulos (interiores, en píxeles de la vista
 * 480 × 270): vida y zona a la izquierda; nivel y experiencia al centro, más
 * alto, como información principal; dinero, EPP y carga a la derecha.
 */
const TOP = {
  left: { x: 5, y: 4, w: 136, h: 22, zone: 62 },
  center: { x: 148, y: 3, w: 184, h: 25, badgeX: 151, barX: 179, barW: 148 },
  right: { x: 339, y: 4, w: 136, h: 22, money: 339, ppe: 384, cargo: 424 },
} as const;

const ZONES: Record<string, [string, number]> = {
  surface: ['SUPERFICIE', P.desertSand],
  entrance: ['BOCAMINA', P.gold],
  gallery: ['GALERIA', P.silver],
  deep: ['PROFUNDO', P.mauve],
  cabin: ['CABAÑA', P.cream],
};

/** Dinero compacto: hasta 99999 entero; después en miles. */
const money = (value: number) =>
  value < 100_000 ? String(value) : `${Math.floor(value / 1000)}K`;

/** Corta un texto en líneas de hasta `max` caracteres, por palabras. */
export function wrap(text: string, max = 68): string {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if ((line + ' ' + word).trim().length > max) {
      lines.push(line);
      line = word;
    } else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

export class OperationsHUD {
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly status: Phaser.GameObjects.BitmapText;
  private readonly zoneText: Phaser.GameObjects.BitmapText;
  /** Zona de luz donde está el minero (la fija la escena). */
  zone = 'surface';
  cargoBlockLimit?: number;
  /** Punto del HUD al que vuelan los fragmentos recogidos (ícono de carga). */
  readonly cargoAnchor = { x: TOP.right.cargo + 7, y: TOP.right.y + 14 };
  private readonly xpValue: Phaser.GameObjects.BitmapText;
  private readonly xpTip: Phaser.GameObjects.BitmapText;
  private readonly xpTipFrame: Phaser.GameObjects.Graphics;
  private xpFill: number | null = null;
  private xpLast = 0;
  private xpFullAt = -Infinity;
  private readonly wallet: Phaser.GameObjects.BitmapText;
  private readonly cargo: Phaser.GameObjects.BitmapText;
  private readonly prompt: Phaser.GameObjects.BitmapText;
  private readonly message: Phaser.GameObjects.BitmapText;
  private readonly equipment: Phaser.GameObjects.BitmapText;
  private readonly strip: Phaser.GameObjects.BitmapText;
  private readonly alarm: Phaser.GameObjects.BitmapText;
  private readonly action: Phaser.GameObjects.BitmapText;
  private readonly quickTip: Phaser.GameObjects.BitmapText;
  /** Nombre del objeto elegido y de la herramienta en mano (se desvanece). */
  private readonly quickLabel: Phaser.GameObjects.BitmapText;
  private quickStatusText = '';
  private quickLabelUntil = 0;
  private readonly quickbar: QuickbarView;
  private readonly help: Phaser.GameObjects.Container;
  private readonly speech: Phaser.GameObjects.Container;
  private readonly speechText: Phaser.GameObjects.BitmapText;
  private readonly speechName: Phaser.GameObjects.BitmapText;
  private readonly award: Phaser.GameObjects.Container;
  private readonly awardText: Phaser.GameObjects.BitmapText;
  private until = 0;
  private readonly hearts: Phaser.GameObjects.Image[];
  private readonly heartBlink: number[] = [];
  /** V8: cinco rayos (energía) y cinco presas (alimentación). */
  private readonly bolts: Phaser.GameObjects.Image[];
  private readonly meals: Phaser.GameObjects.Image[];
  /** V9: cinco baterías (carga de la linterna en quintos). */
  private readonly batteries: Phaser.GameObjects.Image[];
  private readonly batteryTip: Phaser.GameObjects.BitmapText;
  private readonly meterBlink = {
    bolts: [] as number[],
    meals: [] as number[],
  };
  private lastMeter = { bolts: 10, meals: 10 };
  private lastBatteryHalves = 10;
  private readonly batteryBlink: number[] = [];
  private readonly survivalTip: Phaser.GameObjects.BitmapText;
  /** Texto de la indicación de interacción (la escena puede precisarlo). */
  promptLabel = '[E] INTERACTUAR';
  private readonly modeBar: Phaser.GameObjects.Graphics;
  private readonly modeIcons: Phaser.GameObjects.Image[];
  modes = { build: false, dismantle: false };
  private lastHalves = 10;
  private speechUntil = 0;
  private awardUntil = 0;
  helpOpen = false;
  /** Línea de estado bajo tierra y alarma activa (las fija la escena). */
  stripText = '';
  alarmText = '';
  /** Suministro activo para el clic derecho. */
  activeSupply: SupplyKind | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
  ) {
    const text = (x: number, y: number, s: string, color: number = P.cream) =>
      pixelText(scene, x, y, s, color)
        .setScrollFactor(0)
        .setDepth(DEPTH.ui + 2);
    createHudIcons(scene);
    const small = (x: number, y: number, s: string, color: number) =>
      smallText(scene, x, y, s, color)
        .setScrollFactor(0)
        .setDepth(DEPTH.ui + 2);
    const icon = (x: number, y: number, frame: HudIcon) =>
      scene.add
        .image(x, y, 'hud-icons', frame)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.ui + 2);
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.ui);
    // Módulo central: insignia de nivel, rótulo, valor y barra de XP.
    const C = TOP.center;
    this.status = text(0, C.y + 9, '', P.cream);
    icon(C.barX, C.y + 2, 'star');
    small(C.barX + 10, C.y + 4, 'EXPERIENCIA', P.steel);
    this.xpValue = text(0, C.y + 2, '', P.cream);
    this.xpTip = text(0, 0, '', P.cream).setLineSpacing(1);
    this.xpTipFrame = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 4);
    // Módulo derecho: dinero, EPP y carga con rótulo, ícono y valor.
    const R = TOP.right;
    small(R.money + 2, R.y + 3, 'DINERO', P.steel);
    small(R.ppe + 2, R.y + 3, 'EPP', P.steel);
    small(R.cargo + 2, R.y + 3, 'CARGA', P.steel);
    icon(R.money + 2, R.y + 10, 'coin');
    icon(R.ppe + 2, R.y + 10, 'helmet');
    icon(R.cargo + 2, R.y + 10, 'crate');
    this.wallet = text(R.money + 13, R.y + 11, '', P.gold);
    // Módulo izquierdo: vida (corazones) y zona actual, con rótulos.
    const L = TOP.left;
    small(L.x + 3, L.y + 3, 'VIDA', P.steel);
    small(L.zone + 2, L.y + 3, 'ZONA', P.steel);
    icon(L.zone + 2, L.y + 10, 'pick');
    this.zoneText = text(L.zone + 14, L.y + 11, '', P.desertSand);
    this.quickbar = new QuickbarView(
      scene,
      HUD_QUICK.x,
      HUD_QUICK.y,
      DEPTH.ui + 3,
      true,
    );
    this.quickTip = text(0, 0, '', P.cream).setLineSpacing(1);
    // Indicadores de acciones manuales que no están en el acceso rápido.
    this.modeBar = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 1);
    this.modeIcons = ['wrench', 'drill', 'torch'].map((frame, i) =>
      scene.add
        .image(429 + i * 19, 253, 'items-v3', frame)
        .setScrollFactor(0)
        .setDepth(DEPTH.ui + 2),
    );
    // Cinco corazones arriba a la izquierda (20 HP cada uno).
    this.hearts = Array.from({ length: 5 }, (_, i) =>
      scene.add
        .image(
          TOP.left.x + 2 + i * 10,
          TOP.left.y + 10,
          'items-v3',
          'heart_full',
        )
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.ui + 2),
    );
    // V8: energía y alimentación, bajo los corazones y con su misma grilla.
    createSurvivalArt(scene);
    const meterRow = (y: number, frame: string) =>
      Array.from({ length: 5 }, (_, i) =>
        scene.add
          .image(TOP.left.x + 2 + i * 10, y, 'v8-items', frame)
          .setOrigin(0, 0)
          .setScrollFactor(0)
          .setDepth(DEPTH.ui + 2),
      );
    this.bolts = meterRow(SURVIVAL_PLATE.y + 3, 'bolt_full');
    this.meals = meterRow(SURVIVAL_PLATE.y + 12, 'food_full');
    // V9: batería de la linterna (hud-icons), junto a la placa de supervivencia.
    this.batteries = Array.from({ length: 5 }, (_, i) =>
      scene.add
        .image(
          BATTERY_PLATE.x + 2 + i * 10,
          BATTERY_PLATE.y + 3,
          'hud-icons',
          'battery_full',
        )
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.ui + 2),
    );
    this.batteryTip = text(0, 0, '', P.cream)
      .setLineSpacing(1)
      .setDepth(DEPTH.ui + 5);
    this.survivalTip = text(0, 0, '', P.cream)
      .setLineSpacing(1)
      .setDepth(DEPTH.ui + 5);
    this.cargo = text(R.cargo + 14, R.y + 11, '', P.silver);
    this.equipment = text(R.ppe + 15, R.y + 11, '', P.silver);
    this.strip = text(10, NOTICE_Y, '', P.silver);
    this.alarm = text(10, NOTICE_Y + 13, '', P.red);
    // Sobre la acción actual: la barra de nueve casillas ocupa el centro.
    this.prompt = text(12, 211, '', P.gold);
    this.quickLabel = text(0, HUD_QUICK.y - 17, '', P.cream);
    this.action = text(10, 223, '', P.silver);
    this.message = text(10, 0, '', P.cream).setLineSpacing(1);
    const helpBg = scene.add.graphics();
    industrialFrame(helpBg, 2, 2, 436, 210);
    const helpText = pixelText(
      scene,
      10,
      8,
      `${GAME_TITLE} / GUÍA\n\n` +
        'A/D O FLECHAS: MOVERSE. ESPACIO: SALTAR\n' +
        'E: INTERACTUAR (BODEGA, CARRO, VIAS, PILAS)\n' +
        'TAB: INVENTARIO. KIT DE SEGURIDAD EN BODEGA\n' +
        'U: TIENDA MINERA Y VENTA DE CARGA\n' +
        '1-9: ACCESO RAPIDO (HERRAMIENTAS, BLOQUES Y OBJETOS)\n' +
        'CLIC: PICAR, EXCAVAR O TALAR CON LA HERRAMIENTA EN MANO\n' +
        'CLIC DERECHO: COLOCAR EL BLOQUE ELEGIDO (TIERRA/PIEDRA/MADERA)\n' +
        'Q: ELEGIR OBJETO. CLIC DERECHO: INSTALAR O USAR OBJETO\n' +
        '  VIGAS Y ANTORCHAS; DINAMITA EN UN BARRENO, CLIC DER: MECHA.\n' +
        'C: EMPUJAR CARRO  V: RETIRAR CARGA  X: MODO DESMONTAR\n' +
        'F: LINTERNA DEL CASCO. B: CAMBIAR BATERIA (REPUESTOS CON U)\n' +
        'G: GUARDAR  R: SUPERFICIE  M: SONIDO  ESC: CANCELAR  H: GUIA\n' +
        'GALERIAS ANCHAS SIN VIGAS SE DERRUMBAN, CON AVISO PREVIO.\n' +
        'EL AIRE EMPEORA LEJOS DE LA ENTRADA Y EN PROFUNDIDAD.\n' +
        'RIELES: CLIC DERECHO O E AL FINAL DE LA VIA. SUBEN 1 BLOQUE.\n' +
        'ANTORCHAS: EN LA MURALLA DE LA MINA, PARED, PISO O TECHO.\n' +
        'CABAÑA AL OESTE: DORMIR. COMIDA CON U; 1-9 O USAR: COMER\n' +
        'GUARDADO AUTOMATICO. RECARGAR CONTINUA LA PARTIDA.',
      P.cream,
    ).setLineSpacing(3);
    this.help = scene.add
      .container(20, 29, [helpBg, helpText])
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 20)
      .setVisible(false);
    const speechBg = scene.add.graphics();
    industrialFrame(speechBg, 2, 2, 448, 36, { accent: P.amber });
    this.speechName = pixelText(scene, 10, 5, '', P.gold);
    this.speechText = pixelText(scene, 10, 16, '', P.cream).setLineSpacing(2);
    this.speech = scene.add
      // Sobre la bandeja de la barra rápida, sin tocar su marco.
      .container(14, 180, [speechBg, this.speechName, this.speechText])
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 5)
      .setVisible(false);
    const awardBg = scene.add.graphics();
    industrialFrame(awardBg, 2, 2, 308, 48, { accent: P.mint });
    this.awardText = pixelText(scene, 10, 9, '', P.mint).setLineSpacing(2);
    this.award = scene.add
      .container(10, 166, [awardBg, this.awardText])
      .setScrollFactor(0)
      // Bajo el inventario (ui+15): un logro no tapa el tooltip.
      .setDepth(DEPTH.ui + 12)
      .setVisible(false);
  }

  /**
   * Corazones: completo, medio o vacío. El que pierde vida parpadea un
   * instante; con un corazón o menos, los restantes laten despacio y suena
   * un aviso discreto una vez.
   */
  private updateHearts(hp: number, now: number): void {
    const halves = heartHalves(hp);
    if (halves < this.lastHalves)
      for (
        let i = Math.floor(halves / 2);
        i < Math.ceil(this.lastHalves / 2);
        i++
      )
        this.heartBlink[i] = now + 700;
    const critical = halves > 0 && halves <= 2;
    if (critical && this.lastHalves > 2)
      this.scene.sound.play('sfx-pick-2', { volume: 0.12, rate: 0.5 });
    this.lastHalves = halves;
    this.hearts.forEach((heart, i) => {
      const left = halves - i * 2;
      heart.setFrame(
        left >= 2 ? 'heart_full' : left === 1 ? 'heart_half' : 'heart_empty',
      );
      const blinking =
        now < (this.heartBlink[i] ?? 0) && Math.floor(now / 90) % 2 === 0;
      const pulse = critical && left > 0 && Math.floor(now / 500) % 2 === 0;
      heart.setVisible(!blinking && !pulse);
    });
  }
  /**
   * V8: rayos y presas con tres estados (lleno, medio, vacío). El que se
   * vacía parpadea un instante; con una unidad o menos, los restantes laten
   * despacio (sin alertas que tapen la pantalla).
   */
  private updateMeter(
    icons: Phaser.GameObjects.Image[],
    key: 'bolts' | 'meals',
    prefix: 'bolt' | 'food',
    points: number,
    now: number,
  ): void {
    const halves = halvesOf(points);
    const last = this.lastMeter[key];
    const blink = this.meterBlink[key];
    if (halves < last)
      for (let i = Math.floor(halves / 2); i < Math.ceil(last / 2); i++)
        blink[i] = now + 600;
    this.lastMeter[key] = halves;
    const critical = halves <= 2;
    icons.forEach((icon, i) => {
      const left = halves - i * 2;
      icon.setFrame(
        `${prefix}_${left >= 2 ? 'full' : left === 1 ? 'half' : 'empty'}`,
      );
      const flashing = now < (blink[i] ?? 0) && Math.floor(now / 90) % 2 === 0;
      // Crítico: los íconos que quedan laten; con cero, el primero vacío.
      const pulse =
        critical &&
        (left > 0 || (halves === 0 && i === 0)) &&
        Math.floor(now / 500) % 2 === 0;
      icon.setVisible(!flashing && !pulse);
    });
  }

  /**
   * V9: batería de la linterna con tres estados (lleno, medio, vacío). Al
   * cruzar al umbral de advertencia (≤ 20 %) o al agotarse, las baterías
   * restantes laten despacio y parpadean breve: aviso discreto, sin alertas
   * que tapen la pantalla.
   */
  private updateBattery(s: GameSession, now: number, modal: boolean): void {
    const lamp = s.headlamp;
    const halves = Math.min(10, Math.ceil(lamp.fraction * 10));
    const last = this.lastBatteryHalves;
    const blink = this.batteryBlink;
    if (halves < last)
      for (let i = Math.floor(halves / 2); i < Math.ceil(last / 2); i++)
        blink[i] = now + 600;
    this.lastBatteryHalves = halves;
    const critical = lamp.low || lamp.empty;
    this.batteries.forEach((icon, i) => {
      const left = halves - i * 2;
      icon.setFrame(
        `battery_${left >= 2 ? 'full' : left === 1 ? 'half' : 'empty'}`,
      );
      const flashing = now < (blink[i] ?? 0) && Math.floor(now / 90) % 2 === 0;
      const pulse =
        critical &&
        (left > 0 || (halves === 0 && i === 0)) &&
        Math.floor(now / 500) % 2 === 0;
      icon.setVisible(!modal && !flashing && !pulse);
    });
  }

  get modal(): boolean {
    return this.helpOpen;
  }
  announce(message: string): void {
    this.message.setText(wrap(message, 74));
    this.until = this.scene.time.now + 3500;
  }
  /** Diálogo breve de un personaje sobre la barra inferior. */
  say(name: string, text: string, ms = 7000): void {
    this.speechName.setText(name);
    this.speechText.setText(wrap(text, 68));
    this.speech.setVisible(true);
    this.speechUntil = this.scene.time.now + ms;
  }
  /** Notificación de logro, descubrimiento o nivel. */
  celebrate(title: string, text: string, header = 'LOGRO DESBLOQUEADO'): void {
    this.awardText.setText(`${header}\n${title}\n${wrap(text, 47)}`);
    this.award.setVisible(true);
    this.awardUntil = this.scene.time.now + 6000;
  }
  toggleHelp(): void {
    this.helpOpen = !this.helpOpen;
    this.help.setVisible(this.helpOpen);
  }
  close(): void {
    if (this.helpOpen) this.toggleHelp();
  }

  quickAt(x: number, y: number): number {
    return this.quickbar.hit(x, y);
  }

  /** Los clics sobre un módulo o la bandeja no llegan al mundo. */
  blocksWorld(x: number, y: number): boolean {
    const inside = (m: { x: number; y: number; w: number; h: number }) =>
      x >= m.x - 2 && x < m.x + m.w + 3 && y >= m.y - 2 && y < m.y + m.h + 3;
    return (
      inside(TOP.left) ||
      inside(SURVIVAL_PLATE) ||
      inside(BATTERY_PLATE) ||
      inside(TOP.center) ||
      inside(TOP.right) ||
      (this.quickbar.visible && this.quickbar.covers(x, y))
    );
  }

  /** Barra superior: módulos, tubo que los une, insignia y barra de XP. */
  private drawTop(
    g: Phaser.GameObjects.Graphics,
    s: GameSession,
    flash: boolean,
  ): void {
    const L = TOP.left,
      C = TOP.center,
      R = TOP.right;
    // Tres módulos alineados; los laterales, iguales y más bajos que el central.
    hudPlate(g, L.x, L.y, L.w, L.h);
    hudPlate(g, C.x, C.y, C.w, C.h);
    hudPlate(g, R.x, R.y, R.w, R.h);
    const S = SURVIVAL_PLATE;
    hudPlate(g, S.x, S.y, S.w, S.h);
    g.fillStyle(P.slate).fillRect(S.x + 3, S.y + 11, S.w - 6, 1);
    // V9: placa de la batería de la linterna.
    const B = BATTERY_PLATE;
    hudPlate(g, B.x, B.y, B.w, B.h);
    g.fillStyle(P.slate).fillRect(B.x + 3, B.y + 11, B.w - 6, 1);
    hudSeparator(g, L.zone - 2, L.y + 2, L.h - 4);
    hudSeparator(g, R.ppe - 2, R.y + 2, R.h - 4);
    hudSeparator(g, R.cargo - 2, R.y + 2, R.h - 4);
    // Insignia octogonal del nivel: aro dorado con bisel y centro índigo.
    const bx = C.badgeX,
      by = C.y + 2,
      bw = 22,
      bh = 21;
    g.fillStyle(P.ink)
      .fillRect(bx + 2, by, bw - 4, bh)
      .fillRect(bx, by + 2, bw, bh - 4)
      .fillRect(bx + 1, by + 1, bw - 2, bh - 2);
    g.fillStyle(P.gold)
      .fillRect(bx + 2, by + 1, bw - 4, bh - 2)
      .fillRect(bx + 1, by + 2, bw - 2, bh - 4);
    g.fillStyle(P.cream)
      .fillRect(bx + 2, by + 1, bw - 5, 1)
      .fillRect(bx + 1, by + 2, 1, bh - 5);
    g.fillStyle(P.amber)
      .fillRect(bx + 3, by + bh - 2, bw - 5, 1)
      .fillRect(bx + bw - 2, by + 3, 1, bh - 5);
    g.fillStyle(P.ink).fillRect(bx + 3, by + 3, bw - 6, bh - 6);
    g.fillStyle(flash ? P.amber : P.indigo).fillRect(
      bx + 4,
      by + 4,
      bw - 8,
      bh - 8,
    );
    g.fillStyle(flash ? P.gold : P.dusk).fillRect(bx + 4, by + 4, bw - 8, 1);
    this.status.setX(bx + Math.round((bw - this.status.width) / 2) + 1);
    // Barra de experiencia: canal hundido con marcas cada 10 % y relleno
    // dorado con brillo; dorado claro al subir de nivel.
    const x0 = C.barX,
      y0 = C.y + 12,
      w = C.barW,
      h = 7;
    g.fillStyle(P.ink).fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    g.fillStyle(P.indigo).fillRect(x0, y0, w, h);
    g.fillStyle(P.desertNight).fillRect(x0, y0, w, 1);
    const fill = Math.round(w * (this.xpFill ?? 0));
    if (fill) {
      g.fillStyle(flash ? P.cream : P.gold).fillRect(x0, y0, fill, h);
      g.fillStyle(flash ? P.white : P.cream).fillRect(x0, y0 + 1, fill, 1);
      g.fillStyle(P.amber).fillRect(x0, y0 + h - 2, fill, 2);
      g.fillStyle(P.white).fillRect(x0 + fill - 1, y0 + 1, 1, h - 3);
    }
    for (let i = 1; i < 10; i++) {
      const tx = x0 + Math.round((w * i) / 10);
      g.fillStyle(tx < x0 + fill ? P.amber : P.night).fillRect(
        tx,
        y0 + 1,
        1,
        h - 2,
      );
    }
    this.xpValue.setX(x0 + w - this.xpValue.width);
    // Zona actual.
    const [zone, color] = ZONES[this.zone] ?? ZONES.surface!;
    this.zoneText.setText(zone).setTint(color);
    // Valores de la derecha: dinero, EPP (verde completo / naranja si falta) y
    // carga (dorada casi llena, roja llena).
    // Peso en kg (50 kg encima): el rótulo «CARGA» ya indica la magnitud.
    const used =
        this.cargoBlockLimit === undefined
          ? s.inventory.weight
          : s.inventory.items.length,
      cap = this.cargoBlockLimit ?? s.inventory.capacity;
    this.cargo
      .setText(`${Math.round(used)}/${cap}`)
      .setTint(used >= cap ? P.red : used >= cap * 0.75 ? P.gold : P.cream);
  }

  levelUp(now: number): void {
    this.xpFullAt = now;
  }

  update(
    s: GameSession,
    interact: boolean,
    action: string,
    now: number,
    modal: boolean,
    levelUp: boolean,
  ): void {
    const g = this.panel.clear();
    const p = s.progression;
    this.status.setText(String(p.level));
    this.xpValue.setText(
      p.xpNeeded ? `${p.xpInLevel} / ${p.xpNeeded} XP` : 'NIVEL MAXIMO',
    );
    const target = p.levelProgress();
    const age = now - this.xpFullAt;
    const dt = Math.max(0, Math.min(50, now - this.xpLast));
    this.xpLast = now;
    this.xpFill ??= target;
    if (age < 240)
      this.xpFill +=
        (1 - this.xpFill) * Math.min(1, dt / Math.max(dt, 240 - age));
    else if (age < 440) this.xpFill = 1;
    else {
      if (this.xpFullAt !== -Infinity) {
        this.xpFill = 0;
        this.xpFullAt = -Infinity;
      }
      this.xpFill += (target - this.xpFill) * (1 - Math.exp(-dt / 90));
      if (Math.abs(target - this.xpFill) < 0.003) this.xpFill = target;
    }
    this.wallet.setText(s.infiniteMoney ? 'INF' : money(s.money));
    this.equipment
      .setText(`${5 - s.loadout.missing().length}/5`)
      .setTint(s.loadout.complete ? P.mint : P.orange);
    this.drawTop(g, s, age < 440);
    this.updateHearts(s.health.hp, now);
    this.updateMeter(this.bolts, 'bolts', 'bolt', s.survival.energy, now);
    this.updateMeter(this.meals, 'meals', 'food', s.survival.hunger, now);
    this.updateBattery(s, now, modal);
    const pointer = this.scene.input.activePointer;
    const hover =
      modal || !this.scene.input.isOver
        ? -1
        : this.quickAt(pointer.x, pointer.y);
    this.quickbar.setVisible(!modal);
    if (!modal) this.quickbar.update(s, now, hover);
    // Al elegir (o gastar) un objeto de la barra, se rotula 1,6 s con la
    // herramienta en mano; la barra misma ya muestra icono y cantidad.
    const status = s.loadout.selectedQuick === null ? '' : quickStatus(s);
    if (status !== this.quickStatusText) {
      this.quickStatusText = status;
      if (status) this.quickLabelUntil = now + 1600;
    }
    const showLabel = !modal && !!status && now < this.quickLabelUntil;
    this.quickLabel.setVisible(showLabel);
    if (showLabel) {
      this.quickLabel.setText(status);
      const w = this.quickLabel.width;
      const x = Math.round((480 - w) / 2);
      this.quickLabel.setX(x);
      hudPlate(g, x - 5, this.quickLabel.y - 3, w + 10, 15);
    }
    const tip = hover < 0 ? [] : quickTooltip(s, hover);
    this.quickTip.setVisible(tip.length > 0);
    if (tip.length) {
      const w = Math.max(...tip.map((line) => line.length)) * 6 + 10;
      const h = tip.length * 9 + 6;
      const x = Math.min(474 - w, Math.max(6, Math.round(pointer.x) - 18));
      const y = HUD_QUICK.y - h - 11;
      industrialFrame(g, x, y, w, h, { shadow: false });
      this.quickTip.setPosition(x + 5, y + 4).setText(tip.join('\n'));
    }
    // El equipo manual (bodega, Q, carga suelta) conserva su indicador.
    const mb = this.modeBar.clear();
    const manualTool =
      s.loadout.activeQuick?.type !== 'tool' ? s.tools.current : undefined;
    const manualSupply =
      s.loadout.activeQuick?.type !== 'supply' ? this.activeSupply : null;
    const frames = [
      this.modes.dismantle ? 'wrench' : this.modes.build ? 'hammer' : null,
      manualTool?.kind ?? null,
      manualSupply,
    ];
    this.modeIcons.forEach((icon, i) => {
      const kind = frames[i];
      icon.setVisible(!modal && !!kind);
      if (modal || !kind) return;
      // Placa pequeña del mismo sistema que la barra rápida.
      hudPlate(mb, icon.x - 8, 245, 16, 17, i === 0 ? P.orange : P.gold);
      if (kind === 'hammer' || kind === 'wrench')
        icon.setTexture('items-v3', kind);
      else setShopIcon(icon, kind as BuyKind);
      if (i === 1 && manualTool) {
        const ratio = manualTool.durability / TOOLS[manualTool.kind].durability;
        mb.fillStyle(P.ink).fillRect(icon.x - 8, 259, 16, 2);
        mb.fillStyle(
          ratio > 0.5 ? P.mint : ratio > 0.2 ? P.gold : P.red,
        ).fillRect(icon.x - 8, 259, Math.max(1, Math.round(16 * ratio)), 2);
      }
    });
    // Estado, alertas y avisos ocupan solo el ancho de su contenido.
    const label = (
      t: Phaser.GameObjects.BitmapText,
      value: string,
      color: number = P.ink,
    ) => {
      t.setText(value).setVisible(!!value);
      if (value)
        g.fillStyle(color).fillRect(
          t.x - 4,
          t.y - 2,
          t.width + 8,
          t.height + 4,
        );
    };
    label(this.strip, modal ? '' : this.stripText);
    const blink = Math.floor(now / 300) % 2 === 0;
    this.alarm
      .setY(this.strip.visible ? NOTICE_Y + 13 : NOTICE_Y)
      .setTint(blink ? P.cream : P.red);
    label(this.alarm, wrap(this.alarmText, 74), blink ? P.rust : P.ink);
    this.message.setY(
      this.alarm.visible
        ? this.alarm.y + this.alarm.height + 5
        : this.strip.visible
          ? NOTICE_Y + 13
          : NOTICE_Y,
    );
    label(this.message, now <= this.until ? this.message.text : '');
    // Indicación de interacción: placa del HUD con acento dorado.
    this.prompt
      .setText(!modal && interact ? this.promptLabel : '')
      .setVisible(!modal && interact);
    if (this.prompt.visible)
      hudPlate(
        g,
        this.prompt.x - 4,
        this.prompt.y - 3,
        this.prompt.width + 8,
        this.prompt.height + 5,
      );
    label(this.action, modal || tip.length ? '' : wrap(action, 74));
    const overXp =
      !modal &&
      this.scene.input.isOver &&
      pointer.x >= TOP.center.x - 2 &&
      pointer.x < TOP.center.x + TOP.center.w + 2 &&
      pointer.y >= TOP.center.y - 2 &&
      pointer.y < TOP.center.y + TOP.center.h + 2;
    this.xpTipFrame.clear();
    // V8: detalle de energía y alimentación al pasar sobre su placa.
    const S = SURVIVAL_PLATE;
    const overSurvival =
      !modal &&
      this.scene.input.isOver &&
      pointer.x >= S.x - 2 &&
      pointer.x < S.x + S.w + 3 &&
      pointer.y >= S.y - 2 &&
      pointer.y < S.y + S.h + 3;
    this.survivalTip.setVisible(overSurvival);
    if (overSurvival) {
      const v = s.survival;
      const lines = [
        `ENERGIA ${v.energyUnits}/5 - ${v.energyState}`,
        `ALIMENTACION ${v.hungerUnits}/5 - ${v.hungerState}`,
        'DESCANSA EN LA CABAÑA. COME ALGO DE LA TIENDA.',
      ];
      const w = Math.max(...lines.map((l) => l.length)) * 6 + 10;
      industrialFrame(this.xpTipFrame, S.x, S.y + S.h + 4, w, 33, {
        shadow: false,
      });
      this.survivalTip
        .setPosition(S.x + 6, S.y + S.h + 8)
        .setText(lines.join('\n'));
    }
    // V9: detalle de la linterna al pasar sobre su placa.
    const B = BATTERY_PLATE;
    const overBattery =
      !modal &&
      this.scene.input.isOver &&
      pointer.x >= B.x - 2 &&
      pointer.x < B.x + B.w + 3 &&
      pointer.y >= B.y - 2 &&
      pointer.y < B.y + B.h + 3;
    this.batteryTip.setVisible(overBattery);
    if (overBattery) {
      const lit = s.headlamp.on && !s.headlamp.empty;
      const lines = [
        `LINTERNA ${lit ? 'ENCENDIDA' : 'APAGADA'} - BATERIA ${s.headlamp.percent}%`,
        `REPUESTOS: ${s.supplies.battery} | B: CAMBIAR BATERIA`,
        'L: ENCENDER/APAGAR. DURA 15 MIN DE USO.',
      ];
      const w = Math.max(...lines.map((l) => l.length)) * 6 + 10;
      industrialFrame(this.xpTipFrame, B.x, B.y + B.h + 4, w, 33, {
        shadow: false,
      });
      this.batteryTip
        .setPosition(B.x + 6, B.y + B.h + 8)
        .setText(lines.join('\n'));
    }
    this.xpTip.setVisible(overXp);
    if (overXp) {
      const detail = [
        `EXPERIENCIA TOTAL: ${p.xp}`,
        p.xpNeeded
          ? `FALTAN ${p.xpNeeded - p.xpInLevel} XP PARA EL NIVEL ${p.level + 1}`
          : 'NIVEL MAXIMO ALCANZADO',
        `VELOCIDAD DE MINADO: +${p.miningSpeedPoints} PT`,
      ];
      industrialFrame(this.xpTipFrame, 133, 35, 215, 33, { shadow: false });
      this.xpTip
        .setPosition(139, 39)
        .setText(detail.join('\n'))
        .setDepth(DEPTH.ui + 5);
    }
    if (now > this.speechUntil) this.speech.setVisible(false);
    this.award.setVisible(!modal && !levelUp && now < this.awardUntil);
  }

}

export function setMaterialIcon(
  icon: Phaser.GameObjects.Image,
  material: Material,
): void {
  const senmou: Partial<Record<Material, number>> = {
    coal: 6,
    copper: 7,
    iron: 8,
    gold: 10,
  };
  if (material === 'dirt' || material === 'stone')
    icon.setTexture('interaction-items', material === 'dirt' ? 5 : 6);
  else if (senmou[material] !== undefined)
    icon.setTexture('mineral-items', senmou[material]);
  else icon.setTexture('items-v3', material);
}
export { MATERIAL_LABEL };
