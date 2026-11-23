import Phaser from 'phaser';
import {
  BALANCE,
  kg,
  MATERIAL_KG,
  MATERIAL_LABEL,
  SUPPLIES,
  TOOLS,
  type Material,
  type SupplyKind,
} from '../config/balance';
import {
  EQUIP_SLOTS,
  MAX_SLOTS,
  PPE,
  QUICKBAR_SIZE,
  SLOT_LABEL,
  xpForLevel,
  type EquipSlot,
  type PPEKind,
} from '../config/gear';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import { ensureLook, lookMask, skinOf } from '../entities/MinerLook';
import type { GameSession } from '../systems/GameSession';
import type { ItemRef } from '../systems/LoadoutSystem';
import { industrialFrame } from './Frame';
import { setMaterialIcon } from './OperationsHUD';
import { pixelText } from './PixelFont';
import { foodSummary, foodTooltip, slotBadge } from './FreshnessView';
import { QuickbarView, quickTooltip, setShopIcon } from './QuickbarView';

type Target =
  | { kind: 'grid'; index: number }
  | { kind: 'equip'; slot: EquipSlot }
  | { kind: 'quick'; index: number }
  | { kind: 'menu'; index: number }
  | { kind: 'cargo'; index: number }
  | null;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
const inside = (r: Rect, x: number, y: number) =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** EPP que se dibuja como silueta en cada ranura vacía. */
const SILHOUETTE: Record<Exclude<EquipSlot, 'tool'>, PPEKind> = {
  head: 'helmet',
  eyes: 'goggles',
  torso: 'vest',
  hands: 'gloves',
  feet: 'boots',
  accessory: 'ear',
};
/** Color de rareza por material (bloques de la carga minera). */
const MATERIAL_RARITY: Partial<Record<Material, number>> = {
  dirt: P.umber,
  stone: P.stone,
  coal: P.stone,
  iron: P.steel,
  copper: P.clay,
  gold: P.gold,
  emerald: P.mint,
  ruby: P.red,
  sapphire: P.blue,
  diamond: P.white,
  alien_ore: P.peach,
  violet_crystal: P.duskViolet,
};
/** Pilas de la carga por material, en orden de aparición: [material, bloques]. */
function cargoStacks(items: readonly Material[]): [Material, number][] {
  const counts = new Map<Material, number>();
  for (const m of items) counts.set(m, (counts.get(m) ?? 0) + 1);
  return [...counts];
}
/** Marco por nivel tecnológico: básico, intermedio, avanzado. */
const TIER_COLOR = [P.steel, P.steel, P.mint, P.gold];
function rarityOf(s: GameSession, ref: ItemRef): number {
  if (ref.type === 'supply') return TIER_COLOR[SUPPLIES[ref.kind].tier]!;
  if (ref.type === 'ppe') return P.amber;
  const tool = s.tools.items.find((t) => t.id === ref.id);
  return tool ? TIER_COLOR[TOOLS[tool.kind].tier]! : P.steel;
}

/** Origen del panel en pantalla (480 × 270). */
const X = 12,
  Y = 30,
  PW = 456,
  PH = 202;
const CELL = 20;
const GRID = { x: X + 150, y: Y + 34, cols: 6 };
const QUICK = { x: X + 150, y: Y + 152 };
// Tras la barra rápida compacta de nueve casillas (196 px).
const CARGO_X = X + 360;
const MENU_WIDTH = 116;
/** Ranuras alrededor del personaje: izquierda, derecha y abajo. */
const EQUIP_POS: Record<EquipSlot, [number, number]> = {
  head: [X + 10, Y + 34],
  eyes: [X + 10, Y + 58],
  torso: [X + 10, Y + 82],
  hands: [X + 110, Y + 34],
  feet: [X + 110, Y + 58],
  accessory: [X + 110, Y + 82],
  tool: [X + 60, Y + 132],
};

/**
 * Inventario estilo RPG industrial: personaje con ranuras de EPP a la
 * izquierda, las 24 casillas disponibles a la derecha,
 * barra rápida abajo e información del objeto. Todo con píxeles de la paleta
 * y BitmapText. Las acciones llaman a LoadoutSystem: no hay lógica de bienes
 * en la interfaz.
 */
export class InventoryPanel {
  open = false;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly texts: Phaser.GameObjects.BitmapText[] = [];
  private readonly icons: Phaser.GameObjects.Image[] = [];
  private readonly preview: Phaser.GameObjects.Image;
  private readonly ghost: Phaser.GameObjects.Image;
  private readonly quickbar: QuickbarView;
  private readonly all: Phaser.GameObjects.GameObject[] = [];
  private textIndex = 0;
  private iconIndex = 0;
  private selected: Target = null;
  private hover: Target = null;
  private drag: Target = null;
  private dragMoved = false;
  private pointer = { x: 0, y: 0 };
  private lastClick = { at: 0, key: '' };
  private menu: {
    target: Target;
    options: string[];
    x: number;
    y: number;
  } | null = null;
  private message = '';
  private messageUntil = 0;
  /** Usar un suministro; puede devolver el mensaje a mostrar (V8: comer). */
  onUse?: (kind: SupplyKind) => string | void;
  cargoBlockLimit?: number;
  onQuick?: (index: number) => void;
  onChange?: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: () => GameSession,
  ) {
    const fix = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      (
        o as unknown as Phaser.GameObjects.Components.ScrollFactor
      ).setScrollFactor(0);
      this.all.push(o);
      return o;
    };
    this.g = fix(scene.add.graphics().setDepth(DEPTH.ui + 15));
    this.quickbar = new QuickbarView(scene, QUICK.x, QUICK.y, DEPTH.ui + 17);
    this.preview = fix(
      scene.add
        .image(0, 0, 'miner', 0)
        .setScale(2)
        .setDepth(DEPTH.ui + 16),
    );
    this.overlay = fix(scene.add.graphics().setDepth(DEPTH.ui + 18));
    this.ghost = fix(
      scene.add.image(0, 0, 'items-v3', 'lock').setDepth(DEPTH.ui + 19),
    );
    for (let i = 0; i < 60; i++)
      this.texts.push(
        fix(pixelText(scene, 0, 0, '', P.cream).setDepth(DEPTH.ui + 17)),
      );
    for (let i = 0; i < 48; i++)
      this.icons.push(
        fix(scene.add.image(0, 0, 'items-v3', 'lock').setDepth(DEPTH.ui + 16)),
      );
    this.setVisible(false);
    scene.input.on('pointerdown', this.down, this);
    scene.input.on('pointermove', this.moveTo, this);
    scene.input.on('pointerup', this.up, this);
    scene.input.on('pointerupoutside', this.cancelDrag, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointerdown', this.down, this);
      scene.input.off('pointermove', this.moveTo, this);
      scene.input.off('pointerup', this.up, this);
      scene.input.off('pointerupoutside', this.cancelDrag, this);
    });
  }

  private setVisible(v: boolean): void {
    this.quickbar.setVisible(v);
    for (const o of this.all)
      (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(v);
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }
  show(): void {
    this.open = true;
    this.menu = null;
    this.drag = null;
    this.hover = null;
    this.lastClick = { at: 0, key: '' };
    this.session().loadout.sync();
    this.setVisible(true);
    this.ghost.setVisible(false);
  }
  close(): void {
    this.open = false;
    this.menu = null;
    this.drag = null;
    this.setVisible(false);
  }

  /** Muestra un aviso dentro del panel. */
  say(text: string): void {
    this.message = text;
    this.messageUntil = this.scene.time.now + 3000;
  }

  // ---------- Geometría y búsqueda ----------
  private gridRect(i: number): Rect {
    return {
      x: GRID.x + (i % GRID.cols) * (CELL + 2),
      y: GRID.y + Math.floor(i / GRID.cols) * (CELL + 2),
      w: CELL,
      h: CELL,
    };
  }
  private equipRect(slot: EquipSlot): Rect {
    const [x, y] = EQUIP_POS[slot];
    return { x, y, w: CELL, h: CELL };
  }
  private menuRect(i: number): Rect {
    const m = this.menu!;
    return { x: m.x, y: m.y + i * 10, w: MENU_WIDTH, h: 10 };
  }
  private targetAt(x: number, y: number): Target {
    if (this.menu)
      for (let i = 0; i < this.menu.options.length; i++)
        if (inside(this.menuRect(i), x, y)) return { kind: 'menu', index: i };
    for (let i = 0; i < MAX_SLOTS; i++)
      if (inside(this.gridRect(i), x, y)) return { kind: 'grid', index: i };
    for (const slot of EQUIP_SLOTS)
      if (inside(this.equipRect(slot), x, y)) return { kind: 'equip', slot };
    const quick = this.quickbar.hit(x, y);
    if (quick >= 0) return { kind: 'quick', index: quick };
    for (let i = 0; i < 4; i++)
      if (inside({ x: CARGO_X + i * 18, y: QUICK.y, w: 16, h: 18 }, x, y))
        return { kind: 'cargo', index: i };
    return null;
  }
  private refAt(t: Target): ItemRef | null {
    const s = this.session();
    if (!t) return null;
    if (t.kind === 'grid') return s.loadout.slots[t.index] ?? null;
    if (t.kind === 'quick') return s.loadout.quickbar[t.index] ?? null;
    if (t.kind === 'equip') {
      if (t.slot === 'tool')
        return s.tools.equipped ? { type: 'tool', id: s.tools.equipped } : null;
      const id = s.loadout.gear[t.slot];
      return id !== null ? { type: 'ppe', id } : null;
    }
    return null;
  }
  private keyOf(t: Target): string {
    if (!t) return '';
    return t.kind === 'equip'
      ? `e:${t.slot}`
      : `${t.kind}:${'index' in t ? t.index : ''}`;
  }

  // ---------- Entrada del puntero ----------
  private down(p: Phaser.Input.Pointer): void {
    if (!this.open) return;
    const t = this.targetAt(p.x, p.y);
    if (t?.kind === 'menu') {
      this.runMenu(this.menu!.options[t.index]!, this.menu!.target);
      this.menu = null;
      return;
    }
    this.menu = null;
    if (p.rightButtonDown()) {
      if (t && (this.refAt(t) || t.kind === 'quick'))
        this.openMenu(t, p.x, p.y);
      return;
    }
    if (!t) return;
    this.selected = t;
    if (t.kind === 'quick') {
      this.drag = t;
      this.dragMoved = false;
      return;
    }
    const key = this.keyOf(t);
    const now = this.scene.time.now;
    if (key === this.lastClick.key && now - this.lastClick.at < 350) {
      this.lastClick = { at: 0, key: '' };
      this.primary(t);
      return;
    }
    this.lastClick = { at: now, key };
    if (this.refAt(t)) {
      this.drag = t;
      this.dragMoved = false;
    }
  }
  private moveTo(p: Phaser.Input.Pointer): void {
    if (!this.open) return;
    this.pointer = { x: p.x, y: p.y };
    this.hover = this.targetAt(p.x, p.y);
    if (this.drag && p.getDistance() >= 3) {
      this.dragMoved = true;
      this.ghost.setPosition(Math.round(p.x), Math.round(p.y));
    }
  }
  private up(p: Phaser.Input.Pointer): void {
    if (!this.open || !this.drag) return;
    const from = this.drag;
    this.drag = null;
    this.ghost.setVisible(false);
    const to = this.targetAt(p.x, p.y);
    if (this.dragMoved) {
      this.lastClick = { at: 0, key: '' };
      this.drop(from, to);
    } else if (
      from.kind === 'quick' &&
      to?.kind === 'quick' &&
      from.index === to.index
    )
      this.onQuick?.(from.index);
  }

  private cancelDrag(): void {
    this.drag = null;
    this.ghost.setVisible(false);
  }

  /** Soltar un objeto arrastrado: mover, equipar, quitar o asignar. */
  private drop(from: Target, to: Target): void {
    const l = this.session().loadout;
    let result: string | null = null;
    if (from?.kind === 'quick') {
      if (to?.kind === 'quick' && l.quickbar[from.index])
        l.moveQuick(from.index, to.index);
    } else if (from?.kind === 'grid' && to?.kind === 'grid')
      result = l.move(from.index, to.index);
    else if (from?.kind === 'grid' && to?.kind === 'equip')
      result = this.equipInto(from.index, to.slot);
    else if (
      (from?.kind === 'grid' || from?.kind === 'equip') &&
      to?.kind === 'quick'
    ) {
      const ref = this.refAt(from);
      if (ref) result = l.assignQuick(to.index, ref);
    } else if (from?.kind === 'equip' && to?.kind === 'grid')
      result = l.unequip(from.slot);
    if (result) this.say(result);
    this.onChange?.();
  }

  /** Equipar solo en la ranura compatible. */
  private equipInto(index: number, slot: EquipSlot): string | null {
    const s = this.session();
    const ref = s.loadout.slots[index];
    if (!ref) return 'CASILLA VACIA';
    const fits =
      ref.type === 'tool'
        ? slot === 'tool'
        : ref.type === 'ppe'
          ? PPE[s.loadout.ppeById(ref.id)!.kind].slot === slot
          : false;
    if (!fits) return `NO VA EN LA RANURA ${SLOT_LABEL[slot]}`;
    return s.loadout.equipFromSlot(index);
  }

  /** Acción principal (doble clic): equipar, quitar o usar. */
  private primary(t: Target): void {
    const s = this.session();
    const ref = this.refAt(t);
    if (!t || !ref) return;
    let result: string | null = null;
    if (t.kind === 'equip') result = s.loadout.unequip(t.slot);
    else if (t.kind === 'grid') {
      if (ref.type === 'supply')
        result =
          this.onUse?.(ref.kind) ||
          `OBJETO ACTIVO: ${SUPPLIES[ref.kind].label}`;
      else result = s.loadout.equipFromSlot(t.index);
    }
    if (result) this.say(result);
    this.onChange?.();
  }

  private openMenu(t: Target, x: number, y: number): void {
    const ref = this.refAt(t);
    const options: string[] = [];
    if (t?.kind === 'quick') options.push('QUITAR DE LA BARRA');
    else if (t?.kind === 'equip') options.push('DESEQUIPAR', 'INFORMACION');
    else if (ref) {
      if (ref.type === 'supply') options.push('USAR', 'ASIGNAR A BARRA');
      else options.push('EQUIPAR');
      if (ref.type === 'tool') options.push('ASIGNAR A BARRA');
      options.push('INFORMACION', 'DESCARTAR');
    }
    this.menu = {
      target: t,
      options,
      x: Math.min(x, 480 - MENU_WIDTH - 4),
      y: Math.min(y, 230 - options.length * 10),
    };
  }

  private runMenu(option: string, t: Target): void {
    const s = this.session(),
      l = s.loadout;
    const ref = this.refAt(t);
    let result: string | null = null;
    if (option === 'EQUIPAR' && t?.kind === 'grid')
      result = l.equipFromSlot(t.index);
    else if (option === 'DESEQUIPAR' && t?.kind === 'equip')
      result = l.unequip(t.slot);
    else if (option === 'USAR' && ref?.type === 'supply') {
      result =
        this.onUse?.(ref.kind) || `OBJETO ACTIVO: ${SUPPLIES[ref.kind].label}`;
    } else if (option === 'ASIGNAR A BARRA' && ref) {
      const free = l.quickbar.findIndex((q) => !q);
      result = l.assignQuick(free >= 0 ? free : QUICKBAR_SIZE - 1, ref);
      if (!result) result = 'ASIGNADO A LA BARRA RAPIDA';
    } else if (option === 'QUITAR DE LA BARRA' && t?.kind === 'quick')
      result = l.assignQuick(t.index, null);
    else if (option === 'INFORMACION') this.selected = t;
    else if (option === 'DESCARTAR' && t?.kind === 'grid') {
      const isRequired =
        ref?.type === 'ppe' && PPE[l.ppeById(ref.id)!.kind].required;
      result = isRequired
        ? 'EL EPP OBLIGATORIO NO SE DESCARTA'
        : (l.discard(t.index) ?? 'OBJETO DESCARTADO');
    }
    if (result) this.say(result);
    this.onChange?.();
  }

  // ---------- Dibujo ----------
  private text(
    x: number,
    y: number,
    s: string,
    color: number = P.cream,
    depth: number = DEPTH.ui + 17,
  ) {
    const t = this.texts[this.textIndex++];
    if (!t) return;
    t.setVisible(true)
      .setPosition(Math.round(x), Math.round(y))
      .setText(s)
      .setTint(color)
      .setDepth(depth);
  }
  private icon(
    x: number,
    y: number,
    set: (img: Phaser.GameObjects.Image) => void,
  ) {
    const img = this.icons[this.iconIndex++];
    if (!img) return;
    img.setVisible(true).setPosition(x, y).setScale(1);
    set(img);
  }
  /** Ícono de una referencia del inventario. */
  private refIcon(img: Phaser.GameObjects.Image, ref: ItemRef): void {
    const s = this.session();
    if (ref.type === 'supply') setShopIcon(img, ref.kind);
    else if (ref.type === 'ppe')
      img.setTexture('items-v3', `ppe_${s.loadout.ppeById(ref.id)!.kind}`);
    else {
      const tool = s.tools.items.find((t) => t.id === ref.id);
      if (tool) setShopIcon(img, tool.kind);
    }
  }
  /** Marco metálico de una casilla con sombra interna. */
  private slotFrame(r: Rect, state: 'normal' | 'selected' | 'hover') {
    const g = this.g;
    g.fillStyle(P.ink).fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    g.fillStyle(P.slate).fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle(P.night).fillRect(r.x, r.y, r.w, 2).fillRect(r.x, r.y, 2, r.h);
    g.fillStyle(P.stone).fillRect(r.x, r.y + r.h - 1, r.w, 1);
    if (state === 'selected' || state === 'hover')
      this.overlay
        .lineStyle(1, state === 'selected' ? P.gold : P.cream)
        .strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  }

  /** Marco de color según rareza o nivel del objeto. */
  private rarityFrame(r: Rect, color: number): void {
    this.overlay.fillStyle(color);
    this.overlay.fillRect(r.x, r.y + r.h - 2, r.w, 1);
    this.overlay.fillRect(r.x, r.y, 1, r.h - 2);
  }
  /** Barra de durabilidad bajo una herramienta. */
  private durabilityBar(r: Rect, toolId: number): void {
    const tool = this.session().tools.items.find((t) => t.id === toolId);
    if (!tool) return;
    const ratio = tool.durability / TOOLS[tool.kind].durability;
    this.overlay.fillStyle(P.ink).fillRect(r.x + 2, r.y + r.h - 4, r.w - 4, 2);
    this.overlay
      .fillStyle(ratio > 0.5 ? P.mint : ratio > 0.2 ? P.gold : P.red)
      .fillRect(r.x + 2, r.y + r.h - 4, Math.round((r.w - 4) * ratio), 2);
  }
  /** Líneas del tooltip para lo que hay bajo el cursor. */
  private tooltipLines(s: GameSession): string[] {
    const l = s.loadout,
      h = this.hover;
    if (!this.scene.input.isOver || !h || h.kind === 'menu' || this.menu)
      return [];
    if (h.kind === 'cargo') {
      const stack = cargoStacks(s.inventory.items)[h.index];
      if (!stack)
        return [
          'CARGA MINERA',
          this.cargoBlockLimit === undefined
            ? `HASTA ${kg(s.inventory.capacity)} (CADA BLOQUE PESA ${kg(1)} APROX.)`
            : `HASTA ${this.cargoBlockLimit} BLOQUES`,
        ];
      const [m, n] = stack;
      return [
        MATERIAL_LABEL[m],
        `${n} BLOQUES | ${kg(n * MATERIAL_KG[m])}`,
        `VALOR: $${BALANCE.sale[m]} C/U`,
        'USO: VENDER CON U O CARGAR AL CARRO',
      ];
    }
    if (h.kind === 'quick') {
      return quickTooltip(s, h.index);
    }
    const ref = this.refAt(h);
    if (!ref)
      return h.kind === 'equip' ? [SLOT_LABEL[h.slot], 'RANURA VACIA'] : [];
    if (ref.type === 'tool') {
      const tool = s.tools.items.find((t) => t.id === ref.id)!;
      const def = TOOLS[tool.kind];
      return [
        def.label,
        `DURABILIDAD: ${tool.durability}/${def.durability} (${s.tools.state(tool)})`,
        def.type === 'drill'
          ? `USO: PERFORA BARRENOS EN ${def.workMs / 1000} S`
          : `VELOCIDAD: ${def.workMs / 1000} S POR BLOQUE`,
        `VALOR: $${def.price}`,
        h.kind === 'equip' ? 'EQUIPADA' : 'DOBLE CLIC: EQUIPAR',
      ];
    }
    if (ref.type === 'supply') {
      const sp = SUPPLIES[ref.kind];
      return [
        sp.label,
        sp.desc,
        `CANTIDAD: ${s.supplies[ref.kind]}`,
        ...foodTooltip(s, ref.kind),
        'USO: Q O DOBLE CLIC, LUEGO CLIC DERECHO',
        `VALOR: $${sp.price} C/U`,
      ];
    }
    const p = l.ppeById(ref.id)!;
    const def = PPE[p.kind];
    return [
      def.label,
      def.desc,
      `RANURA: ${SLOT_LABEL[def.slot]}`,
      'DURABILIDAD: NO SE DESGASTA',
      l.gear[def.slot] === p.id ? 'EQUIPADO' : 'DOBLE CLIC: EQUIPAR',
      ...(p.kind === 'helmet' ? ['LAMPARA: FUNCIONAL'] : []),
    ];
  }
  /** Recuadro flotante junto al cursor, dentro de la pantalla. */
  private tooltip(info: string[], now: number): void {
    if (!info.length || (this.drag && this.dragMoved)) return;
    void now;
    const lines = info.flatMap((line) => wrapLine(line, 30));
    const w = Math.max(...lines.map((s) => s.length)) * 6 + 6,
      h = lines.length * 10 + 4;
    const x = Math.min(this.pointer.x + 10, 476 - w),
      y = Math.min(this.pointer.y + 10, 232 - h);
    this.overlay.fillStyle(P.ink).fillRect(x - 2, y - 2, w + 4, h + 4);
    this.overlay.fillStyle(P.steel).fillRect(x - 1, y - 1, w + 2, h + 2);
    this.overlay.fillStyle(P.silver).fillRect(x - 1, y - 1, w + 2, 1);
    this.overlay.fillStyle(P.night).fillRect(x, y, w, h);
    this.overlay.fillStyle(P.gold).fillRect(x, y, w, 1);
    lines.forEach((line, i) =>
      this.text(
        x + 3,
        y + 3 + i * 10,
        line,
        i ? P.cream : P.gold,
        DEPTH.ui + 20,
      ),
    );
  }

  update(now: number): void {
    if (!this.open) return;
    const s = this.session(),
      l = s.loadout;
    l.sync();
    s.syncFood();
    this.textIndex = 0;
    this.iconIndex = 0;
    for (const t of this.texts) t.setVisible(false);
    for (const i of this.icons) i.setVisible(false);
    const g = this.g.clear();
    this.overlay.clear();
    // Panel industrial: borde metálico, remaches y barra de título.
    industrialFrame(g, X, Y, PW, PH, { title: 13 });
    // Separador entre personaje e inventario.
    g.fillStyle(P.ink).fillRect(X + 140, Y + 18, 2, PH - 22);
    this.text(X + 8, Y + 5, 'INVENTARIO Y EQUIPO', P.gold);
    this.text(X + PW - 110, Y + 5, 'TAB / ESC: CERRAR', P.silver);
    // Personaje con su EPP real.
    const mask = lookMask((k: PPEKind) => l.equipped(k));
    const tool = s.tools.current;
    const key = ensureLook(this.scene, skinOf(tool), mask);
    this.preview
      .setTexture(key, Math.floor(now / 400) % 2)
      .setPosition(X + 70, Y + 70);
    for (const slot of EQUIP_SLOTS) {
      const r = this.equipRect(slot);
      const t: Target = { kind: 'equip', slot };
      this.slotFrame(
        r,
        this.keyOf(this.selected) === this.keyOf(t)
          ? 'selected'
          : this.keyOf(this.hover) === this.keyOf(t)
            ? 'hover'
            : 'normal',
      );
      const ref = this.refAt(t);
      if (ref) {
        this.icon(r.x + 10, r.y + 10, (img) => this.refIcon(img, ref));
        // Indicador de equipado: esquina dorada.
        this.overlay.fillStyle(P.gold).fillRect(r.x + r.w - 4, r.y + 1, 3, 3);
      } else {
        // Silueta del objeto que va en la ranura, tapada con tramado oscuro.
        this.icon(r.x + 10, r.y + 10, (img) =>
          slot === 'tool'
            ? img.setTexture('interaction-items', 0)
            : img.setTexture('items-v3', `ppe_${SILHOUETTE[slot]}`),
        );
        for (let y = 0; y < r.h; y++)
          for (let x = (y % 2) as number; x < r.w; x += 2)
            this.overlay.fillStyle(P.slate).fillRect(r.x + x, r.y + y, 1, 1);
      }
    }
    const missing = l.missing();
    this.text(
      X + 8,
      Y + 160,
      missing.length ? `EPP ${5 - missing.length}/5 ✕` : 'EPP 5/5 ✓',
      missing.length ? P.red : P.mint,
    );
    if (missing.length)
      this.text(
        X + 8,
        Y + 170,
        `FALTA: ${missing.map((k) => PPE[k].short).join(' ')}`.slice(0, 22),
        P.red,
      );
    const lamp = l.equipped('helmet')
      ? 'LAMPARA: FUNCIONAL'
      : 'LAMPARA: SIN CASCO';
    this.text(X + 8, Y + 182, lamp, P.silver);
    // Nivel, experiencia y dinero.
    const pr = s.progression;
    this.text(GRID.x, Y + 19, `NIVEL ${pr.level}`, P.gold);
    const next = xpForLevel(pr.level + 1);
    g.fillStyle(P.ink).fillRect(GRID.x + 50, Y + 20, 82, 6);
    g.fillStyle(P.mint).fillRect(
      GRID.x + 51,
      Y + 21,
      Math.round(80 * pr.levelProgress()),
      4,
    );
    this.text(GRID.x + 138, Y + 19, `XP ${pr.xp}/${next}`, P.silver);
    this.text(
      GRID.x + 228,
      Y + 19,
      s.infiniteMoney ? '$INF' : `$${s.money}`,
      P.gold,
    );
    // Las 24 casillas están disponibles desde el inicio.
    for (let i = 0; i < MAX_SLOTS; i++) {
      const r = this.gridRect(i);
      const t: Target = { kind: 'grid', index: i };
      this.slotFrame(
        r,
        this.keyOf(this.selected) === this.keyOf(t)
          ? 'selected'
          : this.keyOf(this.hover) === this.keyOf(t)
            ? 'hover'
            : 'normal',
      );
      const ref = l.slots[i];
      if (
        !ref ||
        (this.drag && this.keyOf(this.drag) === this.keyOf(t) && this.dragMoved)
      )
        continue;
      this.rarityFrame(r, rarityOf(s, ref));
      this.icon(r.x + 10, r.y + 10, (img) => this.refIcon(img, ref));
      if (ref.type === 'supply') {
        this.text(
          r.x + (s.supplies[ref.kind] > 9 ? 9 : 14),
          r.y + 13,
          `${Math.min(99, s.supplies[ref.kind])}`,
          P.white,
        );
        // Alimentos: días que quedan hasta vencer (el más próximo de la pila).
        const badge = slotBadge(foodSummary(s, ref.kind));
        if (badge) {
          const w = badge.text.length * 6;
          this.overlay.fillStyle(P.ink).fillRect(r.x, r.y, w + 1, 9);
          this.text(r.x + 1, r.y + 1, badge.text, badge.color, DEPTH.ui + 19);
        }
      }
      if (ref.type === 'tool') this.durabilityBar(r, ref.id);
    }
    // Barra rápida: solo referencias a objetos que se poseen.
    this.text(QUICK.x, QUICK.y - 11, 'ACCESO RÁPIDO — TECLAS 1 A 9', P.silver);
    this.quickbar.update(
      s,
      now,
      this.hover?.kind === 'quick' ? this.hover.index : -1,
      !!(this.dragMoved && this.drag && this.refAt(this.drag)?.type !== 'ppe'),
    );
    // Carga minera (independiente de las casillas): por peso, no por bloque.
    // Hasta cuatro pilas por material con su cantidad y una barra de peso.
    const cx = CARGO_X;
    const weight =
        this.cargoBlockLimit === undefined
          ? s.inventory.weight
          : s.inventory.items.length,
      cap = this.cargoBlockLimit ?? s.inventory.capacity;
    this.text(
      cx,
      QUICK.y - 9,
      `CARGA ${Math.round(weight)}/${cap}${this.cargoBlockLimit === undefined ? ' KG' : ''}`,
      weight >= cap ? P.red : P.silver,
    );
    const stacks = cargoStacks(s.inventory.items);
    for (let i = 0; i < 4; i++) {
      const r = { x: cx + i * 18, y: QUICK.y, w: 16, h: 18 };
      g.fillStyle(P.ink).fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
      g.fillStyle(P.slate).fillRect(r.x, r.y, r.w, r.h);
      const stack = stacks[i];
      if (stack) {
        const [m, n] = stack;
        this.rarityFrame(r, MATERIAL_RARITY[m] ?? P.stone);
        this.icon(r.x + 8, r.y + 8, (img) => setMaterialIcon(img, m));
        const label = String(Math.min(99, n));
        g.fillStyle(P.ink).fillRect(
          r.x + r.w - label.length * 6,
          r.y + 10,
          label.length * 6,
          8,
        );
        this.text(r.x + r.w - label.length * 6, r.y + 10, label, P.white);
      }
    }
    // Barra de peso: ámbar al 75 %, roja llena.
    const bar = { x: cx - 1, y: QUICK.y + 21, w: 72 };
    g.fillStyle(P.ink).fillRect(bar.x, bar.y, bar.w + 2, 6);
    g.fillStyle(P.slate).fillRect(bar.x + 1, bar.y + 1, bar.w, 4);
    const fill = Math.min(bar.w, Math.round((bar.w * weight) / cap));
    if (fill)
      g.fillStyle(
        weight >= cap ? P.red : weight >= cap * 0.75 ? P.gold : P.mint,
      ).fillRect(bar.x + 1, bar.y + 1, fill, 4);
    if (l.overflow.length)
      this.text(
        GRID.x,
        GRID.y + 4 * (CELL + 2) + 1,
        `${l.overflow.length} OBJETO(S) ESPERAN CASILLA LIBRE`,
        P.gold,
      );
    // Tooltip flotante al pasar el cursor: nombre, descripción, cantidad,
    // durabilidad, uso y valor. Nada de texto permanente en las casillas.
    this.tooltip(this.tooltipLines(s), now);
    if (now < this.messageUntil)
      this.text(GRID.x, Y + PH - 12, this.message, P.gold);
    else
      this.text(
        GRID.x,
        Y + PH - 12,
        'ARRASTRA AL ACCESO RAPIDO | CLIC DER: MENU',
        P.silver,
      );
    // Menú contextual.
    if (this.menu) {
      const m = this.menu;
      this.overlay
        .fillStyle(P.ink)
        .fillRect(m.x - 1, m.y - 1, MENU_WIDTH + 2, m.options.length * 10 + 2);
      m.options.forEach((option, i) => {
        const r = this.menuRect(i);
        const hot = this.hover?.kind === 'menu' && this.hover.index === i;
        this.overlay
          .fillStyle(hot ? P.slate : P.night)
          .fillRect(r.x, r.y, r.w, r.h);
        this.text(
          r.x + 2,
          r.y + 1,
          option,
          hot ? P.gold : P.cream,
          DEPTH.ui + 20,
        );
      });
    }
    // Objeto arrastrado sigue al puntero.
    if (this.drag && this.dragMoved) {
      const ref = this.refAt(this.drag);
      if (ref) {
        this.ghost.setVisible(true);
        this.refIcon(this.ghost, ref);
      }
    }
  }
}

function wrapLine(text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if ((line + ' ' + word).trim().length > max) {
      out.push(line);
      line = word;
    } else line = (line + ' ' + word).trim();
  }
  if (line) out.push(line);
  return out;
}
