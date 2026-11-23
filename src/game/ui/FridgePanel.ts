import type Phaser from 'phaser';
import { SUPPLIES } from '../config/balance';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { FRIDGE, PERISHABLE_KEYS, type PerishableKind } from '../config/survival';
import { formatDays, GAME_DAY_MS, summarize } from '../systems/Freshness';
import type { GameSession } from '../systems/GameSession';
import { industrialFrame, slotWell } from './Frame';
import { FRESH_COLOR, FROZEN_COLOR, slotBadge } from './FreshnessView';
import { pixelText } from './PixelFont';
import { setShopIcon } from './QuickbarView';

/**
 * Refrigerador de la cabaña con interfaz tipo cofre: a la izquierda los
 * alimentos y bebidas que lleva el minero, a la derecha las 10 casillas del
 * refrigerador. Mover entre ambos lados con los botones; dentro, el tiempo de
 * caducidad está detenido. Mientras está abierto el reloj del juego no corre
 * (la escena lo trata como ventana modal).
 */
type Side = 'carried' | 'fridge';
const SLOT = 22;
const STEP = 25;
const COLS_LEFT = 4;
const COLS_RIGHT = 5;

export class FridgePanel {
  private readonly root: Phaser.GameObjects.Container;
  private session?: GameSession;
  private selected?: { side: Side; index: number };
  private amount = 1;
  private message = '';
  private hits: { x: number; y: number; w: number; h: number; act: () => void }[] = [];
  /** La escena guarda la partida tras cada movimiento. */
  onChange?: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly save: () => boolean,
  ) {
    this.root = scene.add
      .container()
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 70)
      .setVisible(false);
    const click = (p: Phaser.Input.Pointer) => {
      if (!this.open || p.button !== 0) return;
      this.hits
        .find(({ x, y, w, h }) => p.x >= x && p.x < x + w && p.y >= y && p.y < y + h)
        ?.act();
    };
    scene.input.on('pointerdown', click);
    scene.events.once('shutdown', () => scene.input.off('pointerdown', click));
  }

  get open(): boolean {
    return !!this.session;
  }

  show(session: GameSession): void {
    this.session = session;
    this.selected = undefined;
    this.amount = 1;
    this.message = '';
    this.root.setVisible(true);
    this.draw();
  }

  close(): void {
    this.session = undefined;
    this.root.removeAll(true);
    this.root.setVisible(false);
    this.hits = [];
  }

  /** Alimentos perecederos que lleva el minero, en el orden del catálogo. */
  private carried(): { kind: PerishableKind; count: number }[] {
    const s = this.session!;
    return PERISHABLE_KEYS.filter((k) => s.supplies[k] > 0).map((kind) => ({
      kind,
      count: s.supplies[kind],
    }));
  }

  private label(x: number, y: number, value: string, color: number = P.cream): void {
    this.root.add(pixelText(this.scene, x, y, value, color));
  }

  private draw(): void {
    const s = this.session!;
    s.syncFood();
    const now = s.dayNight.totalMs;
    const fridge = s.fridge;
    const carried = this.carried();
    this.root.removeAll(true);
    this.hits = [];
    const g = this.scene.add.graphics();
    this.root.add(g);
    industrialFrame(g, 21, 25, 438, 213, { title: 20 });
    this.snowflake(g, 32, 31);
    this.label(44, 33, 'REFRIGERADOR   /   CABAÑA', P.mist);
    this.label(
      31,
      52,
      `CASILLAS: ${fridge.used}/${FRIDGE.slots}   UNIDADES: ${fridge.units}   ADENTRO EL TIEMPO SE DETIENE`,
    );
    const button = (
      x: number,
      y: number,
      w: number,
      label: string,
      act: () => void,
      color: number = P.steel,
    ) => {
      g.fillStyle(color).fillRect(x, y, w, 13);
      this.label(x + 4, y + 3, label);
      this.hits.push({ x, y, w, h: 13, act });
    };
    button(410, 29, 39, 'SALIR', () => this.close());
    // ---- izquierda: lo que lleva el minero
    this.label(32, 79, 'INVENTARIO', P.gold);
    carried.forEach((item, i) => {
      const px = 32 + (i % COLS_LEFT) * STEP;
      const py = 94 + Math.floor(i / COLS_LEFT) * 26;
      const sum = summarize(s.food.lots(item.kind), now);
      this.slot(g, px, py, item.kind, item.count, sum, false, this.isSelected('carried', i));
      this.hits.push({
        x: px,
        y: py,
        w: SLOT,
        h: SLOT,
        act: () => this.select('carried', i),
      });
    });
    for (let i = carried.length; i < PERISHABLE_KEYS.length; i++) {
      const px = 32 + (i % COLS_LEFT) * STEP;
      const py = 94 + Math.floor(i / COLS_LEFT) * 26;
      slotWell(g, px, py, SLOT, SLOT);
    }
    if (!carried.length) this.label(32, 128, 'NO LLEVAS ALIMENTOS', P.silver);
    // ---- derecha: las 10 casillas
    this.label(160, 79, 'REFRIGERADOR', P.mist);
    for (let i = 0; i < FRIDGE.slots; i++) {
      const px = 160 + (i % COLS_RIGHT) * STEP;
      const py = 94 + Math.floor(i / COLS_RIGHT) * 26;
      const slot = fridge.slots[i];
      if (!slot) {
        slotWell(g, px, py, SLOT, SLOT);
        continue;
      }
      this.slot(g, px, py, slot.kind, slot.count, summarize(slot.lots, 0, true), true, this.isSelected('fridge', i));
      this.hits.push({
        x: px,
        y: py,
        w: SLOT,
        h: SLOT,
        act: () => this.select('fridge', i),
      });
    }
    // ---- detalle y acciones
    const sel = this.selected;
    const item =
      sel && (sel.side === 'carried' ? carried[sel.index] : fridge.slots[sel.index]);
    if (sel && item) {
      const frozen = sel.side === 'fridge';
      const lots = frozen ? fridge.slots[sel.index]!.lots : s.food.lots(item.kind);
      this.label(32, 176, `${SUPPLIES[item.kind].label}   X${item.count}`);
      button(32, 191, 17, '-', () => {
        this.amount = Math.max(1, this.amount - 1);
        this.draw();
      });
      this.label(55, 194, String(this.amount));
      button(100, 191, 17, '+', () => {
        this.amount = Math.min(item.count, this.amount + 1);
        this.draw();
      });
      button(123, 191, 29, '10+', () => {
        this.amount = Math.min(item.count, this.amount + 10);
        this.draw();
      });
      button(158, 191, 40, 'TODO', () => {
        this.amount = item.count;
        this.draw();
      });
      button(
        204,
        191,
        84,
        frozen ? '<< SACAR' : 'GUARDAR >>',
        () => this.move(sel.side, sel.index, item.kind),
        frozen ? P.rust : P.teal,
      );
      // Cada fecha de vencimiento de la pila (hasta tres).
      this.label(300, 176, frozen ? 'EN FRIO (DETENIDO):' : 'VENCIMIENTOS:', frozen ? FROZEN_COLOR : P.gold);
      lots.slice(0, 3).forEach((lot, i) => {
        const ms = frozen ? lot.t : lot.t - now;
        const expired = ms <= 0;
        this.label(
          300,
          187 + i * 10,
          expired ? `${lot.qty} X VENCIDO` : `${lot.qty} X ${formatDays(ms)} DIAS`,
          expired
            ? P.red
            : frozen
              ? FROZEN_COLOR
              : FRESH_COLOR[ms < GAME_DAY_MS ? 'soon' : 'fresh'],
        );
      });
      if (lots.length > 3) this.label(300, 217, `+${lots.length - 3} FECHAS MAS`, P.silver);
    } else this.label(32, 176, 'ELIGE UNA CASILLA PARA MOVER ALIMENTOS');
    button(380, 219, 69, 'TIRAR VENC.', () => this.throwExpired(), P.rust);
    this.label(
      32,
      219,
      this.message || 'CLIC: SELECCIONAR   ESC: CERRAR',
      this.message ? P.gold : P.cream,
    );
  }

  private isSelected(side: Side, index: number): boolean {
    return this.selected?.side === side && this.selected.index === index;
  }

  private select(side: Side, index: number): void {
    this.selected = { side, index };
    this.amount = 1;
    this.message = '';
    this.draw();
  }

  /** Casilla con ícono, cantidad e insignia de días (celeste si está en frío). */
  private slot(
    g: Phaser.GameObjects.Graphics,
    px: number,
    py: number,
    kind: PerishableKind,
    count: number,
    sum: ReturnType<typeof summarize>,
    frozen: boolean,
    selected: boolean,
  ): void {
    slotWell(g, px, py, SLOT, SLOT);
    if (selected) g.lineStyle(1, P.gold).strokeRect(px, py, SLOT, SLOT);
    const icon = this.scene.add.image(px + 11, py + 9, 'items-v3', 'lock');
    setShopIcon(icon, kind);
    this.root.add(icon);
    if (count > 1) this.label(px + 2, py + 14, String(Math.min(count, 999)).slice(0, 3));
    const badge = slotBadge(sum, frozen);
    if (badge) {
      const bg = this.scene.add.graphics();
      bg.fillStyle(P.ink).fillRect(px, py, badge.text.length * 6 + 1, 9);
      this.root.add(bg);
      this.label(px + 1, py + 1, badge.text, badge.color);
    }
  }

  private move(side: Side, index: number, kind: PerishableKind): void {
    const s = this.session!;
    const r =
      side === 'carried'
        ? s.fridge.deposit(s, kind, this.amount)
        : s.fridge.withdraw(s, index, this.amount);
    if ('error' in r) this.message = r.error;
    else {
      const partial = r.moved < this.amount ? ` (SOLO CABIAN ${r.moved})` : '';
      this.message = this.save()
        ? `${side === 'carried' ? 'GUARDADO' : 'RETIRADO'}: ${r.moved}${partial}`
        : 'ERROR AL GUARDAR';
      this.selected = undefined;
      this.onChange?.();
    }
    this.draw();
  }

  /** Tira lo vencido del refrigerador y de lo que lleva el minero. */
  private throwExpired(): void {
    const s = this.session!;
    const thrown = s.fridge.discardExpired() + s.discardExpiredFood();
    this.message = thrown
      ? this.save()
        ? `TIRASTE ${thrown} UNIDAD(ES) VENCIDA(S)`
        : 'ERROR AL GUARDAR'
      : 'NO HAY NADA VENCIDO';
    if (thrown) {
      this.selected = undefined;
      this.onChange?.();
    }
    this.draw();
  }

  /** Copo de nieve de 7 × 7 junto al título. */
  private snowflake(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(P.mist);
    g.fillRect(x + 3, y, 1, 7).fillRect(x, y + 3, 7, 1);
    g.fillRect(x + 1, y + 1, 1, 1).fillRect(x + 5, y + 1, 1, 1);
    g.fillRect(x + 1, y + 5, 1, 1).fillRect(x + 5, y + 5, 1, 1);
  }
}
