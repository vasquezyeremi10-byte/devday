import Phaser from 'phaser';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import {
  PHONE_CATEGORIES,
  PHONE_LAYOUT,
  PHONE_SHOP,
  PHONE_SHORT_LABEL,
  type PhoneProductId,
} from '../config/phoneShop';
import type { BuyKind, GameSession } from '../systems/GameSession';
import {
  confirmOrder,
  formatGrams,
  NO_DISPATCHER,
  PhoneCart,
  phoneProduct,
  type OrderDispatcher,
  type Wallet,
} from '../systems/PhoneCart';
import { GAME_DAY_MS, shelfLifeMs } from '../systems/Freshness';
import { pixelText, smallText } from './PixelFont';
import { setShopIcon } from './QuickbarView';

/**
 * Celular (tecla U) con la aplicación «TIENDA MINERA»: catálogo por
 * categorías, ficha del producto con cantidad, carrito con subtotal, envío y
 * total, y confirmación del pedido. No cobra ni entrega: confirmar valida el
 * saldo y pasa el pedido al sistema de drones. La misma aplicación permite
 * vender la carga minera disponible desde la superficie.
 *
 * Dibujado por código a 480 × 270, píxeles enteros, colores de la paleta y
 * alfa 0/255. Teclado y ratón; la rueda desplaza el carrito.
 */
/** Pantalla dentro del marco (140 × 226). */
const SC = {
  x: PHONE_LAYOUT.x + 6,
  y: PHONE_LAYOUT.y + 18,
  w: PHONE_LAYOUT.w - 12,
  h: PHONE_LAYOUT.h - 32,
} as const;
/** Bandas de la pantalla, relativas a SC.y. */
const BAR = { status: 0, app: 8, wallet: 22, tabs: 31, list: 45 } as const;
const ROW = 18;
const ROWS = 6;
const CART_ROW = 20;
const CART_ROWS = 6;
const DETAIL_Y = BAR.list + ROW * ROWS; // 153
const SUMMARY_Y = BAR.list + CART_ROW * CART_ROWS; // 165
const SLIDE_MS = 140;
const TOAST_MS = 2600;
const DEPTH_BASE = DEPTH.ui + 30;

type Button = { x: number; y: number; w: number; h: number; run: () => void };
type Align = 'left' | 'right' | 'center';

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
const money = (n: number) => `$${n}`;
/** Nombre para una fila de la lista (19 caracteres caben en 114 px). */
const shortLabel = (id: PhoneProductId) =>
  clip(PHONE_SHORT_LABEL[id] ?? phoneProduct(id).label, 19);

/** Corta un texto en líneas de hasta `width` caracteres, por palabras. */
export function wrapText(text: string, width: number, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= width) line = next;
    else {
      if (line) lines.push(line);
      line = word.slice(0, width);
    }
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    const kept = lines.slice(0, max);
    kept[max - 1] = clip(kept[max - 1]!, width - 1) + '.';
    return kept;
  }
  return lines;
}

export class PhoneView {
  open = false;
  screen: 'store' | 'cart' | 'sale' = 'store';
  sale?: { quote: () => number; submit: () => number | string };
  category = 0;
  row = 0;
  qty = 1;
  cartRow = 0;
  cartScroll = 0;
  readonly cart = new PhoneCart();
  /** Sistema de drones; mientras no exista, ningún pedido se procesa. */
  dispatcher: OrderDispatcher = NO_DISPATCHER;
  /** Último aviso mostrado (también lo leen las pruebas). */
  toast: { lines: string[]; color: number; until: number } | null = null;

  private openedAt = 0;
  private now = 0;
  private oy = 0;
  private buttons: Button[] = [];
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly top: Phaser.GameObjects.Graphics;
  private readonly texts: Phaser.GameObjects.BitmapText[] = [];
  private readonly smalls: Phaser.GameObjects.BitmapText[] = [];
  private readonly icons: Phaser.GameObjects.Image[] = [];
  private textIndex = 0;
  private smallIndex = 0;
  private iconIndex = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: () => GameSession,
  ) {
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_BASE);
    this.top = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_BASE + 2);
    this.g.setVisible(false);
    this.top.setVisible(false);
    const onPointer = (p: Phaser.Input.Pointer) => this.pointer(p);
    const onWheel = (
      _p: Phaser.Input.Pointer,
      _o: unknown,
      _dx: number,
      dy: number,
    ) => this.wheel(dy);
    const onKey = (e: KeyboardEvent) => this.key(e);
    scene.input.on('pointerdown', onPointer);
    scene.input.on('wheel', onWheel);
    window.addEventListener('keydown', onKey);
    // Cambiar de escena (o dormirla) cierra el celular sin dejar entradas vivas.
    // Los eventos de la escena sobreviven a su reinicio: se quitan al cerrar
    // (antes quedaban dos oyentes por cada partida reiniciada).
    scene.events.on(Phaser.Scenes.Events.SLEEP, this.close, this);
    scene.events.on(Phaser.Scenes.Events.PAUSE, this.close, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.SLEEP, this.close, this);
      scene.events.off(Phaser.Scenes.Events.PAUSE, this.close, this);
      window.removeEventListener('keydown', onKey);
      scene.input.off('pointerdown', onPointer);
      scene.input.off('wheel', onWheel);
    });
  }

  // ------------------------------------------------------------ estado
  show(now: number): void {
    this.open = true;
    this.openedAt = now;
    this.screen = 'store';
    this.qty = 1;
    this.toast = null;
  }
  close(): void {
    if (!this.open) return;
    this.open = false;
    this.toast = null;
    this.hide();
  }
  get categoryItems(): readonly PhoneProductId[] {
    return PHONE_CATEGORIES[this.category]!.items;
  }
  get selected(): PhoneProductId {
    return this.categoryItems[this.row]!;
  }
  setCategory(index: number): void {
    const n = PHONE_CATEGORIES.length;
    this.category = ((index % n) + n) % n;
    this.row = 0;
    this.qty = 1;
  }
  selectRow(index: number): void {
    this.row = Math.max(0, Math.min(this.categoryItems.length - 1, index));
    this.qty = 1;
  }
  changeQty(delta: number): void {
    this.qty = Math.max(1, Math.min(PHONE_SHOP.maxQty, this.qty + delta));
  }
  unlocked(id: PhoneProductId): boolean {
    return this.session().shopUnlocked(id);
  }
  private wallet(): Wallet {
    const s = this.session();
    return {
      money: s.money,
      infiniteMoney: s.infiniteMoney,
      unlocked: (id) => this.unlocked(id),
    };
  }
  private notify(lines: string[], color: number): void {
    this.toast = { lines, color, until: this.now + TOAST_MS };
  }

  /** Agrega la cantidad elegida del producto seleccionado. */
  addSelected(): void {
    const id = this.selected;
    const p = phoneProduct(id);
    if (!this.unlocked(id)) {
      this.notify([clip(p.label, 22), `REQUIERE ETAPA ${p.tier}.`], P.red);
      return;
    }
    const added = this.cart.add(id, this.qty);
    if (!added) {
      this.notify([`MAXIMO ${PHONE_SHOP.maxQty} UNIDADES`, 'DE ESTE PRODUCTO.'], P.amber);
      return;
    }
    const w = this.wallet();
    const over = !w.infiniteMoney && this.cart.total > w.money;
    this.notify(
      [
        'AGREGADO AL CARRITO:',
        clip(`${added} X ${p.label}`, 22),
        ...(over ? ['EL TOTAL SUPERA SALDO.'] : []),
      ],
      over ? P.amber : P.mint,
    );
    this.qty = 1;
  }
  /** Cambia la cantidad de una línea del carrito (0 la quita). */
  changeLine(id: PhoneProductId, delta: number): void {
    const before = this.cart.qtyOf(id);
    if (delta > 0 && before >= PHONE_SHOP.maxQty) {
      this.notify([`MAXIMO ${PHONE_SHOP.maxQty} UNIDADES`, 'DE ESTE PRODUCTO.'], P.amber);
      return;
    }
    this.cart.setQty(id, before + delta);
    this.fixCartSelection();
  }
  removeLine(id: PhoneProductId): void {
    this.cart.remove(id);
    this.fixCartSelection();
  }
  private fixCartSelection(): void {
    const n = this.cart.lines.length;
    this.cartRow = Math.max(0, Math.min(n - 1, this.cartRow));
    this.cartScroll = Math.max(
      0,
      Math.min(this.cartScroll, n - CART_ROWS, this.cartRow),
    );
    if (this.cartRow >= this.cartScroll + CART_ROWS)
      this.cartScroll = this.cartRow - CART_ROWS + 1;
  }
  selectCartRow(index: number): void {
    this.cartRow = index;
    this.fixCartSelection();
  }
  /** Confirmar: valida y entrega el pedido a los drones (si los hay). */
  confirm(): void {
    const r = confirmOrder(this.cart, this.wallet(), this.dispatcher);
    this.notify(r.message, r.ok ? P.mint : r.order ? P.amber : P.red);
    if (r.ok) {
      this.screen = 'store';
      this.cartRow = this.cartScroll = 0;
    }
  }
  goTo(screen: 'store' | 'cart' | 'sale'): void {
    this.screen = screen;
    if (screen === 'cart') this.fixCartSelection();
  }

  // ------------------------------------------------------------ entrada
  private key(e: KeyboardEvent): void {
    if (!this.open || this.sliding) return;
    const el = document.activeElement as HTMLElement | null;
    if (
      el &&
      (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName) || el.isContentEditable)
    )
      return;
    const plus = e.key === '+' || e.code === 'NumpadAdd' || e.code === 'Equal';
    const minus = e.key === '-' || e.code === 'NumpadSubtract' || e.code === 'Minus';
    let handled = true;
    if (this.sale && e.code === 'KeyV') {
      this.goTo(this.screen === 'sale' ? 'store' : 'sale');
    } else if (this.screen === 'sale') {
      if (e.code === 'Enter') this.sellCargo();
      else if (e.code === 'KeyC') this.goTo('cart');
      else handled = false;
    } else if (this.screen === 'store') {
      if (e.code === 'ArrowLeft') this.setCategory(this.category - 1);
      else if (e.code === 'ArrowRight') this.setCategory(this.category + 1);
      else if (e.code === 'ArrowUp') this.selectRow(this.row - 1);
      else if (e.code === 'ArrowDown') this.selectRow(this.row + 1);
      else if (plus) this.changeQty(1);
      else if (minus) this.changeQty(-1);
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') this.addSelected();
      else if (e.code === 'KeyC') this.goTo('cart');
      else handled = false;
    } else {
      const line = this.cart.lines[this.cartRow];
      if (e.code === 'ArrowUp') this.selectCartRow(this.cartRow - 1);
      else if (e.code === 'ArrowDown') this.selectCartRow(this.cartRow + 1);
      else if (line && (plus || e.code === 'ArrowRight')) this.changeLine(line.id, 1);
      else if (line && (minus || e.code === 'ArrowLeft')) this.changeLine(line.id, -1);
      else if (line && (e.code === 'Delete' || e.code === 'Backspace'))
        this.removeLine(line.id);
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') this.confirm();
      else if (e.code === 'KeyC') this.goTo('store');
      else handled = false;
    }
    if (handled) e.preventDefault();
  }
  private pointer(p: Phaser.Input.Pointer): void {
    if (!this.open || this.sliding || !p.leftButtonDown()) return;
    for (const b of this.buttons)
      if (p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h) {
        b.run();
        return;
      }
  }
  private wheel(dy: number): void {
    if (!this.open || !dy) return;
    if (this.screen === 'cart') this.selectCartRow(this.cartRow + Math.sign(dy));
    else if (this.screen === 'store') this.selectRow(this.row + Math.sign(dy));
  }
  /** El clic cae dentro del teléfono (para no actuar sobre el mundo). */
  contains(x: number, y: number): boolean {
    const { x: px, y: py, w, h } = PHONE_LAYOUT;
    return this.open && x >= px && x < px + w && y >= py && y < py + h;
  }
  private get sliding(): boolean {
    return this.now - this.openedAt < SLIDE_MS;
  }

  // ------------------------------------------------------------ dibujo
  update(now: number): void {
    this.now = now;
    if (!this.open) return;
    if (this.toast && now >= this.toast.until) this.toast = null;
    // Entrada deslizándose desde abajo, en píxeles enteros.
    const t = Math.min(1, (now - this.openedAt) / SLIDE_MS);
    this.oy = Math.round((1 - t) * (1 - t) * 264);
    this.render();
  }

  private hide(): void {
    this.g.clear().setVisible(false);
    this.top.clear().setVisible(false);
    for (const t of this.texts) t.setVisible(false);
    for (const t of this.smalls) t.setVisible(false);
    for (const i of this.icons) i.setVisible(false);
    this.buttons = [];
  }

  private text(
    x: number,
    y: number,
    value: string,
    color: number,
    align: Align = 'left',
    layer = 1,
  ): Phaser.GameObjects.BitmapText {
    let t = this.texts[this.textIndex];
    if (!t) {
      t = pixelText(this.scene, 0, 0, '', P.white).setScrollFactor(0);
      this.texts.push(t);
    }
    this.textIndex++;
    return t
      .setText(value)
      .setTint(color)
      .setOrigin(align === 'left' ? 0 : align === 'right' ? 1 : 0.5, 0)
      .setPosition(Math.round(x), Math.round(y + this.oy))
      .setDepth(DEPTH_BASE + layer)
      .setVisible(true);
  }
  private small(x: number, y: number, value: string, color: number, align: Align = 'left'): void {
    let t = this.smalls[this.smallIndex];
    if (!t) {
      t = smallText(this.scene, 0, 0, '', P.white).setScrollFactor(0);
      this.smalls.push(t);
    }
    this.smallIndex++;
    t.setText(value)
      .setTint(color)
      .setOrigin(align === 'left' ? 0 : align === 'right' ? 1 : 0.5, 0)
      .setPosition(Math.round(x), Math.round(y + this.oy))
      .setDepth(DEPTH_BASE + 1)
      .setVisible(true);
  }
  private icon(x: number, y: number, id: PhoneProductId): void {
    let img = this.icons[this.iconIndex];
    if (!img) {
      img = this.scene.add.image(0, 0, 'v8-items', 'cola').setScrollFactor(0);
      this.icons.push(img);
    }
    this.iconIndex++;
    setShopIcon(img, id as BuyKind);
    img
      .setPosition(Math.round(x), Math.round(y + this.oy))
      .setDepth(DEPTH_BASE + 1)
      .clearTint()
      .setVisible(true);
  }
  private rect(x: number, y: number, w: number, h: number, color: number, g = this.g): void {
    g.fillStyle(color).fillRect(x, y + this.oy, w, h);
  }
  /** Botón con relieve: luz arriba, sombra abajo, contorno de tinta. */
  private button(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    colors: { face: number; light: number; dark: number; text: number },
    run: (() => void) | null,
  ): void {
    this.rect(x, y, w, h, P.ink);
    this.rect(x + 1, y + 1, w - 2, h - 2, colors.face);
    this.rect(x + 1, y + 1, w - 2, 1, colors.light);
    this.rect(x + 1, y + h - 2, w - 2, 1, colors.dark);
    this.text(x + Math.floor(w / 2), y + Math.floor((h - 8) / 2), label, colors.text, 'center');
    if (run) this.buttons.push({ x, y: y + this.oy, w, h, run });
  }
  private hit(x: number, y: number, w: number, h: number, run: () => void): void {
    this.buttons.push({ x, y: y + this.oy, w, h, run });
  }

  private render(): void {
    this.textIndex = this.smallIndex = this.iconIndex = 0;
    this.buttons = [];
    this.g.clear().setVisible(true);
    this.top.clear().setVisible(true);
    this.drawBody();
    this.drawStatus();
    this.drawAppBar();
    this.drawWallet();
    if (this.screen === 'store') {
      this.drawTabs();
      this.drawList();
      this.drawDetail();
    } else if (this.screen === 'sale') {
      this.drawSale();
    } else {
      this.drawCartHeader();
      this.drawCartLines();
      this.drawSummary();
    }
    this.drawToast();
    for (let i = this.textIndex; i < this.texts.length; i++) this.texts[i]!.setVisible(false);
    for (let i = this.smallIndex; i < this.smalls.length; i++) this.smalls[i]!.setVisible(false);
    for (let i = this.iconIndex; i < this.icons.length; i++) this.icons[i]!.setVisible(false);
  }

  /** Carcasa: contorno redondeado, botones laterales, parlante y cámara. */
  private drawBody(): void {
    const { x, y, w, h } = PHONE_LAYOUT;
    // Sombra dura a la derecha y abajo.
    this.pill(x + 3, y + 3, w, h, P.ink);
    // Botones laterales (sobresalen 1 px).
    this.rect(x - 1, y + 46, 2, 14, P.ink);
    this.rect(x - 1, y + 64, 2, 14, P.ink);
    this.rect(x + w - 1, y + 54, 2, 20, P.ink);
    this.pill(x, y, w, h, P.ink);
    this.pill(x + 1, y + 1, w - 2, h - 2, P.night);
    // Borde iluminado arriba a la izquierda.
    this.rect(x + 3, y + 1, w - 6, 1, P.stone);
    this.rect(x + 1, y + 4, 1, h - 8, P.stone);
    this.rect(x + w - 2, y + 4, 1, h - 8, P.slate);
    // Parlante, cámara y barra de inicio.
    const cx = x + Math.floor(w / 2);
    this.rect(cx - 12, y + 8, 24, 2, P.ink);
    this.rect(cx - 12, y + 8, 24, 1, P.slate);
    this.rect(cx + 18, y + 7, 3, 3, P.ink);
    this.rect(cx + 19, y + 8, 1, 1, P.blue);
    this.rect(cx - 16, y + h - 8, 32, 2, P.stone);
    // Marco y fondo de la pantalla.
    this.rect(SC.x - 1, SC.y - 1, SC.w + 2, SC.h + 2, P.ink);
    this.rect(SC.x, SC.y, SC.w, SC.h, P.desertNight);
  }
  private pill(x: number, y: number, w: number, h: number, color: number): void {
    const insets = [3, 1, 1];
    for (let i = 0; i < insets.length; i++) {
      this.rect(x + insets[i]!, y + i, w - insets[i]! * 2, 1, color);
      this.rect(x + insets[i]!, y + h - 1 - i, w - insets[i]! * 2, 1, color);
    }
    this.rect(x, y + 3, w, h - 6, color);
  }

  private drawStatus(): void {
    const y = SC.y + BAR.status;
    this.rect(SC.x, y, SC.w, 8, P.ink);
    const s = this.session();
    const day = s.dayNight.isDay;
    // Sol o luna y la jornada.
    if (day) {
      this.rect(SC.x + 3, y + 2, 4, 4, P.gold);
      this.rect(SC.x + 4, y + 1, 2, 6, P.gold);
      this.rect(SC.x + 2, y + 3, 6, 2, P.gold);
    } else {
      this.rect(SC.x + 3, y + 1, 4, 6, P.cream);
      this.rect(SC.x + 5, y + 1, 2, 4, P.ink);
    }
    this.small(SC.x + 10, y + 1, day ? 'DIA' : 'NOCHE', P.silver);
    if (this.sale) {
      this.small(SC.x + 55, y + 1, this.screen === 'sale' ? 'TIENDA V' : 'VENTA V', P.gold);
      this.hit(SC.x + 53, y, 37, 8, () =>
        this.goTo(this.screen === 'sale' ? 'store' : 'sale'),
      );
    }
    // Señal (cuatro barras) y batería.
    const r = SC.x + SC.w;
    for (let i = 0; i < 4; i++) this.rect(r - 28 + i * 3, y + 6 - (i + 1), 2, i + 1, P.mint);
    this.rect(r - 13, y + 2, 10, 5, P.silver);
    this.rect(r - 12, y + 3, 8, 3, P.ink);
    this.rect(r - 12, y + 3, 6, 3, P.mint);
    this.rect(r - 3, y + 3, 1, 3, P.silver);
  }
  private drawAppBar(): void {
    const y = SC.y + BAR.app;
    this.rect(SC.x, y, SC.w, 14, P.amber);
    this.rect(SC.x, y, SC.w, 1, P.gold);
    this.rect(SC.x, y + 13, SC.w, 1, P.ochre);
    // Logo: una picota en miniatura.
    this.rect(SC.x + 3, y + 4, 7, 2, P.ink);
    this.rect(SC.x + 2, y + 5, 1, 2, P.ink);
    this.rect(SC.x + 10, y + 5, 1, 2, P.ink);
    this.rect(SC.x + 6, y + 6, 1, 6, P.umber);
    this.text(SC.x + 13, y + 3, PHONE_SHOP.app, P.ink);
    // Botón del carrito con insignia de unidades.
    const bx = SC.x + SC.w - 22;
    this.rect(bx, y + 2, 20, 10, P.ink);
    this.rect(bx + 3, y + 4, 9, 4, this.screen === 'cart' ? P.gold : P.cream);
    this.rect(bx + 2, y + 3, 1, 1, P.cream);
    this.rect(bx + 4, y + 9, 2, 2, P.silver);
    this.rect(bx + 9, y + 9, 2, 2, P.silver);
    const units = this.cart.units;
    if (units) {
      const label = units > 99 ? '99+' : String(units);
      const w = label.length * 4 + 3;
      this.rect(bx + 19 - w, y, w, 7, P.red);
      this.small(bx + 21 - w, y + 1, label, P.white);
    }
    this.hit(bx, y + 1, 20, 12, () => this.goTo(this.screen === 'cart' ? 'store' : 'cart'));
  }
  private drawWallet(): void {
    const y = SC.y + BAR.wallet;
    this.rect(SC.x, y, SC.w, 9, P.slate);
    const s = this.session();
    const infinite = s.infiniteMoney;
    this.text(SC.x + 3, y + 1, 'SALDO', P.silver);
    this.text(SC.x + 36, y + 1, infinite ? 'LIBRE' : money(s.money), P.cream);
    const total = this.cart.total;
    if (this.screen === 'cart') {
      const left = s.money - total;
      this.text(
        SC.x + SC.w - 3,
        y + 1,
        infinite ? '' : `RESTA ${money(left)}`,
        left < 0 ? P.red : P.mint,
        'right',
      );
    } else if (total) {
      const over = !infinite && total > s.money;
      this.text(SC.x + SC.w - 3, y + 1, `CARRO ${money(total)}`, over ? P.red : P.gold, 'right');
    }
  }

  private sellCargo(): void {
    const result = this.sale?.submit();
    if (result === undefined) return;
    if (typeof result === 'number')
      this.notify(['VENTA COMPLETADA', '+$' + result], P.mint);
    else this.notify(wrapText(result, 22, 3), P.red);
  }

  private drawSale(): void {
    const y = SC.y + BAR.list;
    this.text(SC.x + 3, y, 'VENTA DE CARGA', P.gold);
    this.text(SC.x + 3, y + 16, 'EN SUPERFICIE', P.cream);
    this.text(SC.x + 3, y + 28, 'CARGA PERSONAL,', P.cream);
    this.text(SC.x + 3, y + 38, 'CARRO CERCANO Y', P.cream);
    this.text(SC.x + 3, y + 48, 'DESCARGA DE GALERIA', P.cream);
    const quote = this.sale?.quote() ?? 0;
    this.text(SC.x + 3, y + 69, 'TOTAL ' + money(quote), P.gold);
    this.button(SC.x + 3, y + 90, 95, 15, 'VENDER', { face: P.mint, light: P.cream, dark: P.teal, text: P.ink }, () => this.sellCargo());
  }

  private drawTabs(): void {
    const y = SC.y + BAR.tabs;
    this.rect(SC.x, y, SC.w, 14, P.night);
    this.rect(SC.x, y + 13, SC.w, 1, P.ink);
    const arrow = (x: number, dir: number) => {
      this.rect(x, y + 1, 11, 11, P.slate);
      for (let i = 0; i < 4; i++) {
        const cx = dir < 0 ? x + 3 + i : x + 7 - i;
        this.rect(cx, y + 6 - i, 1, 1 + i * 2, P.cream);
      }
    };
    arrow(SC.x + 1, -1);
    arrow(SC.x + SC.w - 12, 1);
    this.hit(SC.x, y, 14, 14, () => this.setCategory(this.category - 1));
    this.hit(SC.x + SC.w - 14, y, 14, 14, () => this.setCategory(this.category + 1));
    this.text(SC.x + SC.w / 2, y + 1, PHONE_CATEGORIES[this.category]!.label, P.cream, 'center');
    const n = PHONE_CATEGORIES.length;
    const dx = SC.x + Math.floor(SC.w / 2) - Math.floor((n * 6 - 2) / 2);
    for (let i = 0; i < n; i++)
      this.rect(dx + i * 6, y + 10, 4, 2, i === this.category ? P.gold : P.stone);
  }
  private drawList(): void {
    const items = this.categoryItems;
    const s = this.session();
    for (let i = 0; i < ROWS; i++) {
      const y = SC.y + BAR.list + i * ROW;
      const id = items[i];
      const selected = i === this.row && !!id;
      this.rect(SC.x, y, SC.w, ROW, i % 2 ? P.night : P.desertNight);
      if (!id) continue;
      if (selected) {
        this.rect(SC.x, y, SC.w, ROW, P.gold);
        this.rect(SC.x + 1, y + 1, SC.w - 2, ROW - 2, P.indigo);
      }
      const p = phoneProduct(id);
      const open = this.unlocked(id);
      this.icon(SC.x + 11, y + 9, id);
      // Nombre a todo el ancho; abajo peso, estado y precio.
      this.text(SC.x + 21, y + 1, shortLabel(id), open ? P.white : P.steel);
      this.text(SC.x + 21, y + 9, formatGrams(p.grams), P.steel);
      this.text(SC.x + SC.w - 3, y + 9, money(p.price), open ? P.gold : P.steel, 'right');
      const inCart = this.cart.qtyOf(id);
      const status = SC.x + 60;
      if (!open) this.text(status, y + 9, `ETAPA ${p.tier}`, P.red);
      else if (inCart) this.text(status, y + 9, `X${inCart}`, P.mint);
      else if (!s.infiniteMoney && p.price > s.money)
        this.text(status, y + 9, 'SIN SALDO', P.dawnPink);
      this.hit(SC.x, y, SC.w, ROW, () => this.selectRow(i));
    }
  }
  private drawDetail(): void {
    const y = SC.y + DETAIL_Y;
    this.rect(SC.x, y, SC.w, SC.h - DETAIL_Y, P.slate);
    this.rect(SC.x, y, SC.w, 1, P.gold);
    const id = this.selected;
    const p = phoneProduct(id);
    const open = this.unlocked(id);
    this.text(SC.x + 3, y + 3, clip(p.label, 22), P.gold);
    // Los perecederos reservan una línea para su vida útil (días del juego).
    const life = shelfLifeMs(id) / GAME_DAY_MS;
    wrapText(p.desc, 22, life ? 2 : 3).forEach((line, i) =>
      this.text(SC.x + 3, y + 12 + i * 8, line, P.mist),
    );
    if (life) this.text(SC.x + 3, y + 28, `CADUCA EN ${life} DIAS`, P.gold);
    this.text(SC.x + 3, y + 38, `PESO ${formatGrams(p.grams)}`, P.silver);
    this.text(SC.x + SC.w - 3, y + 38, `${money(p.price)} C/U`, P.gold, 'right');
    const grey = { face: P.stone, light: P.steel, dark: P.slate, text: P.cream };
    this.button(SC.x + 3, y + 48, 12, 12, '-', grey, () => this.changeQty(-1));
    this.rect(SC.x + 16, y + 48, 18, 12, P.ink);
    this.text(SC.x + 25, y + 50, String(this.qty).padStart(2, '0'), P.white, 'center');
    this.button(SC.x + 35, y + 48, 12, 12, '+', grey, () => this.changeQty(1));
    if (open)
      this.button(
        SC.x + 50,
        y + 48,
        SC.w - 53,
        12,
        clip(`AGREGAR ${money(p.price * this.qty)}`, 14),
        { face: P.teal, light: P.mint, dark: P.forest, text: P.white },
        () => this.addSelected(),
      );
    else
      this.button(
        SC.x + 50,
        y + 48,
        SC.w - 53,
        12,
        `ETAPA ${p.tier}`,
        { face: P.slate, light: P.stone, dark: P.ink, text: P.steel },
        () => this.addSelected(),
      );
    this.small(SC.x + SC.w / 2, y + 64, 'ENTER AGREGA · C CARRITO · U SALIR', P.steel, 'center');
  }

  private drawCartHeader(): void {
    const y = SC.y + BAR.tabs;
    this.rect(SC.x, y, SC.w, 14, P.night);
    this.rect(SC.x, y + 13, SC.w, 1, P.ink);
    this.button(
      SC.x + 2,
      y + 1,
      44,
      11,
      '< TIENDA',
      { face: P.slate, light: P.stone, dark: P.ink, text: P.cream },
      () => this.goTo('store'),
    );
    this.text(
      SC.x + SC.w - 3,
      y + 2,
      `CARRITO (${this.cart.units})`,
      P.gold,
      'right',
    );
  }
  private drawCartLines(): void {
    const lines = this.cart.lines;
    const top = SC.y + BAR.list;
    for (let i = 0; i < CART_ROWS; i++)
      this.rect(SC.x, top + i * CART_ROW, SC.w, CART_ROW, i % 2 ? P.night : P.desertNight);
    if (!lines.length) {
      this.text(SC.x + SC.w / 2, top + 44, 'TU CARRITO', P.cream, 'center');
      this.text(SC.x + SC.w / 2, top + 53, 'ESTA VACIO', P.cream, 'center');
      this.small(SC.x + SC.w / 2, top + 66, 'AGREGA PRODUCTOS DESDE LA TIENDA', P.steel, 'center');
      return;
    }
    const grey = { face: P.stone, light: P.steel, dark: P.slate, text: P.cream };
    const red = { face: P.rust, light: P.red, dark: P.ember, text: P.white };
    for (let i = 0; i < CART_ROWS; i++) {
      const index = this.cartScroll + i;
      const line = lines[index];
      if (!line) break;
      const y = top + i * CART_ROW;
      const p = phoneProduct(line.id);
      if (index === this.cartRow) {
        this.rect(SC.x, y, SC.w, CART_ROW, P.gold);
        this.rect(SC.x + 1, y + 1, SC.w - 2, CART_ROW - 2, P.indigo);
      }
      this.hit(SC.x, y, SC.w, CART_ROW, () => this.selectCartRow(index));
      this.icon(SC.x + 11, y + 10, line.id);
      this.text(SC.x + 21, y + 2, shortLabel(line.id), P.white);
      this.button(SC.x + 21, y + 10, 9, 9, '-', grey, () => {
        this.selectCartRow(index);
        this.changeLine(line.id, -1);
      });
      this.text(SC.x + 38, y + 11, String(line.qty).padStart(2, '0'), P.white, 'center');
      this.button(SC.x + 46, y + 10, 9, 9, '+', grey, () => {
        this.selectCartRow(index);
        this.changeLine(line.id, 1);
      });
      this.text(SC.x + SC.w - 15, y + 11, money(p.price * line.qty), P.gold, 'right');
      this.button(SC.x + SC.w - 12, y + 10, 10, 9, 'X', red, () => this.removeLine(line.id));
    }
    // Indicadores de desplazamiento.
    const r = SC.x + SC.w - 4;
    if (this.cartScroll > 0)
      for (let i = 0; i < 3; i++) this.rect(r - i, top + 1 + i, 1 + i * 2, 1, P.cream, this.top);
    if (this.cartScroll + CART_ROWS < lines.length)
      for (let i = 0; i < 3; i++)
        this.rect(r - i, top + CART_ROWS * CART_ROW - 2 - i, 1 + i * 2, 1, P.cream, this.top);
  }
  private drawSummary(): void {
    const y = SC.y + SUMMARY_Y;
    this.rect(SC.x, y, SC.w, SC.h - SUMMARY_Y, P.slate);
    this.rect(SC.x, y, SC.w, 1, P.gold);
    const s = this.session();
    const cart = this.cart;
    const row = (dy: number, label: string, value: string, color: number) => {
      this.text(SC.x + 3, y + dy, label, color === P.gold ? P.gold : P.silver);
      this.text(SC.x + SC.w - 3, y + dy, value, color, 'right');
    };
    row(3, 'SUBTOTAL', money(cart.subtotal), P.cream);
    row(11, 'ENVIO DRON', cart.deliveryFee ? money(cart.deliveryFee) : 'GRATIS', P.mint);
    const over = !s.infiniteMoney && cart.total > s.money;
    row(19, 'TOTAL', money(cart.total), over ? P.red : P.gold);
    row(27, 'PESO', formatGrams(cart.grams), P.cream);
    const ready = !cart.empty;
    this.button(
      SC.x + 3,
      y + 37,
      SC.w - 6,
      13,
      'CONFIRMAR PEDIDO',
      ready
        ? { face: P.orange, light: P.gold, dark: P.ember, text: P.ink }
        : { face: P.slate, light: P.stone, dark: P.ink, text: P.steel },
      () => this.confirm(),
    );
    this.small(SC.x + SC.w / 2, y + 53, 'SUPR QUITA · +/- CANT · C TIENDA', P.steel, 'center');
  }
  private drawToast(): void {
    if (!this.toast) return;
    const lines = this.toast.lines;
    const h = 5 + lines.length * 9;
    const x = SC.x + 5;
    const w = SC.w - 10;
    const y = SC.y + 104 - Math.floor(h / 2);
    this.rect(x - 1, y - 1, w + 2, h + 2, P.ink, this.top);
    this.rect(x, y, w, h, this.toast.color, this.top);
    this.rect(x + 1, y + 1, w - 2, h - 2, P.ink, this.top);
    lines.forEach((line, i) =>
      this.text(SC.x + SC.w / 2, y + 3 + i * 9, clip(line, 22), P.cream, 'center', 3),
    );
  }
}
