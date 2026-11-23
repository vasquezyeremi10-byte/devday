import type Phaser from 'phaser';
import { SUPPLIES, TOOLS, type SupplyKind } from '../config/balance';
import { isBuildMaterial } from '../config/buildMaterials';
import { PPE, QUICKBAR_SIZE } from '../config/gear';
import { PALETTE as P } from '../config/palette';
import { isFood } from '../config/survival';
import type { BuyKind, GameSession } from '../systems/GameSession';
import { hudPlate } from './Frame';
import { foodTooltip } from './FreshnessView';
import { pixelText } from './PixelFont';

/** Casilla del HUD (28 px) y de la versión compacta del inventario (20 px). */
const FULL = { size: 28, step: 31 } as const;
const COMPACT = { size: 20, step: 22 } as const;
const widthOf = (g: { size: number; step: number }) =>
  (QUICKBAR_SIZE - 1) * g.step + g.size;
export const QUICK_WIDTH = widthOf(FULL);
/** Ancho de la barra compacta (inventario). */
export const QUICK_WIDTH_COMPACT = widthOf(COMPACT);
/** Casillas del HUD: centradas, con 9 px de bandeja y margen bajo ellas. */
export const HUD_QUICK = { x: (480 - QUICK_WIDTH) / 2, y: 230 };
/** Margen de la bandeja alrededor de las casillas (lados, arriba y abajo). */
const TRAY = { side: 6, top: 5, bottom: 5 };

/** Ícono de bodega o inventario: hojas existentes u originales V3. */
export function setShopIcon(
  icon: Phaser.GameObjects.Image,
  kind: BuyKind,
): void {
  const legacy: Partial<Record<BuyKind, number>> = {
    iron: 0,
    tungsten: 1,
    shovel: 3,
  };
  if (legacy[kind] !== undefined)
    icon.setTexture('interaction-items', legacy[kind]);
  else if (kind in PPE) icon.setTexture('items-v3', `ppe_${kind}`);
  else if (isFood(kind)) icon.setTexture('v8-items', kind);
  else icon.setTexture('items-v3', kind);
}

function itemAt(s: GameSession, index: number) {
  const ref = s.loadout.quickbar[index];
  if (
    ref?.type === 'supply' &&
    (s.supplies[ref.kind] > 0 || isBuildMaterial(ref.kind))
  )
    return {
      kind: ref.kind,
      label: SUPPLIES[ref.kind].label,
      count: s.supplies[ref.kind],
    };
  if (ref?.type !== 'tool') return null;
  const tool = s.tools.items.find((t) => t.id === ref.id);
  if (!tool) return null;
  const def = TOOLS[tool.kind];
  return {
    kind: tool.kind,
    label: def.label,
    durability: tool.durability,
    max: def.durability,
    state: s.tools.state(tool),
  };
}

export function quickTooltip(s: GameSession, index: number): string[] {
  const item = itemAt(s, index);
  if (!item) return [`CASILLA ${index + 1} VACIA`];
  return [
    item.label,
    item.max === undefined
      ? `CANTIDAD: ${item.count}`
      : `DURABILIDAD: ${item.durability}/${item.max} | ${item.state}`,
    ...(item.max === undefined ? foodTooltip(s, item.kind as SupplyKind) : []),
  ];
}

/**
 * Línea de estado de la barra: el objeto seleccionado y la herramienta en la
 * mano («TIERRA X12 | HACHA BASICA»).
 */
export function quickStatus(s: GameSession): string {
  const selected = s.loadout.selectedQuick;
  const item = selected === null ? null : itemAt(s, selected);
  const tool = s.tools.current;
  const hand = tool ? TOOLS[tool.kind].label : 'MANOS LIBRES';
  const chosen = item
    ? item.max === undefined
      ? `${item.label} X${item.count}`
      : item.label
    : 'SIN SELECCION';
  return `${chosen} | MANO: ${hand}`;
}

/** Misma geometría y datos para la barra del juego y la del inventario. */
export class QuickbarView {
  private readonly container: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly detail: Phaser.GameObjects.Graphics;
  private readonly cells;
  private readonly size: number;
  private readonly step: number;
  private readonly width: number;
  private selected: number | null = null;
  private pulseUntil = 0;

  constructor(
    scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    depth: number,
    /** Con bandeja propia (HUD); sin ella dentro del inventario. */
    private readonly tray = false,
  ) {
    const g = tray ? FULL : COMPACT;
    this.size = g.size;
    this.step = g.step;
    this.width = widthOf(g);
    this.frame = scene.add.graphics();
    this.detail = scene.add.graphics();
    const { size, step } = this;
    this.cells = Array.from({ length: QUICKBAR_SIZE }, (_, i) => {
      const at = i * step;
      return {
        icon: scene.add.image(
          at + (tray ? 15 : 10),
          tray ? 13 : 10,
          'items-v3',
          'lock',
        ),
        number: pixelText(scene, at + 2, tray ? 2 : 1, String(i + 1), P.silver),
        count: pixelText(
          scene,
          at + size - (tray ? 3 : 2),
          tray ? 18 : 12,
          '',
          P.white,
        ).setOrigin(1, 0),
      };
    });
    this.container = scene.add
      .container(x, y, [
        this.frame,
        ...this.cells.map((c) => c.icon),
        this.detail,
        ...this.cells.flatMap((c) => [c.number, c.count]),
      ])
      .setScrollFactor(0)
      .setDepth(depth);
  }

  /** ¿El punto de pantalla cae sobre la bandeja (incluido su marco)? */
  covers(x: number, y: number): boolean {
    if (!this.tray) return this.hit(x, y) >= 0;
    return (
      x >= this.x - TRAY.side - 2 &&
      x < this.x + this.width + TRAY.side + 2 &&
      y >= this.y - TRAY.top - 2 &&
      y < this.y + this.size + TRAY.bottom + 2
    );
  }

  hit(x: number, y: number): number {
    if (y < this.y || y >= this.y + this.size) return -1;
    const offset = x - this.x;
    const i = Math.floor(offset / this.step);
    return i >= 0 && i < QUICKBAR_SIZE && offset % this.step < this.size
      ? i
      : -1;
  }

  get visible(): boolean {
    return this.container.visible;
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  update(s: GameSession, now: number, hover = -1, dropping = false): void {
    if (s.loadout.selectedQuick !== this.selected) {
      this.selected = s.loadout.selectedQuick;
      this.pulseUntil = now + 130;
    }
    const SIZE = this.size;
    const full = this.tray;
    const g = this.frame.clear(),
      d = this.detail.clear();
    if (this.tray) this.drawTray(g);
    this.cells.forEach(({ icon, number, count }, i) => {
      const x = i * this.step;
      const active = this.selected === i;
      const pulse = active && now < this.pulseUntil;
      const hovered = hover === i;
      // Casilla hundida: sombra arriba-izquierda, canto claro abajo-derecha.
      g.fillStyle(active ? P.gold : P.ink).fillRect(x, 0, SIZE, SIZE);
      g.fillStyle(active ? P.amber : hovered ? (dropping ? P.mint : P.silver) : P.slate)
        .fillRect(x + 1, 1, SIZE - 2, SIZE - 2);
      g.fillStyle(active ? P.cream : hovered ? P.white : P.stone)
        .fillRect(x + 2, SIZE - 2, SIZE - 3, 1)
        .fillRect(x + SIZE - 2, 2, 1, SIZE - 3);
      g.fillStyle(active ? P.indigo : P.night).fillRect(x + 2, 2, SIZE - 4, SIZE - 4);
      g.fillStyle(P.ink)
        .fillRect(x + 2, 2, SIZE - 4, 1)
        .fillRect(x + 2, 2, 1, SIZE - 4);
      if (full) {
        // Pestaña del número en la esquina superior izquierda.
        g.fillStyle(active ? P.gold : P.slate).fillRect(x + 1, 1, 8, 10);
        g.fillStyle(active ? P.cream : P.stone).fillRect(x + 1, 1, 8, 1);
        g.fillStyle(P.ink).fillRect(x + 9, 1, 1, 10).fillRect(x + 1, 11, 9, 1);
      }
      number.setTint(active ? (full ? P.ink : P.cream) : P.silver);
      if (active) {
        // Escuadras crema en las esquinas e indicador bajo la casilla.
        g.fillStyle(P.cream)
          .fillRect(x + SIZE - 5, -1, 5, 1)
          .fillRect(x + SIZE - 1, -1, 1, 4)
          .fillRect(x - 1, SIZE - 3, 1, 4)
          .fillRect(x - 1, SIZE, 5, 1)
          .fillRect(x + SIZE - 5, SIZE, 5, 1)
          .fillRect(x + SIZE - 1, SIZE - 3, 1, 4);
        if (this.tray) {
          const cx = x + SIZE / 2;
          g.fillStyle(P.gold)
            .fillRect(cx - 3, SIZE + 2, 6, 1)
            .fillRect(cx - 2, SIZE + 3, 4, 1)
            .fillRect(cx - 1, SIZE + 4, 2, 1);
        }
      }
      const item = itemAt(s, i);
      icon.setVisible(!!item).setY((full ? 13 : 10) - (pulse ? 1 : 0));
      count.setVisible(item?.count !== undefined);
      if (!item) {
        // Casilla vacía: rombo tenue, para que no parezca un hueco.
        const cx = x + SIZE / 2 + 1,
          cy = SIZE / 2 + 1;
        g.fillStyle(active ? P.dusk : P.slate)
          .fillRect(cx - 1, cy - 3, 2, 1)
          .fillRect(cx - 3, cy - 1, 1, 2)
          .fillRect(cx + 2, cy - 1, 1, 2)
          .fillRect(cx - 1, cy + 2, 2, 1);
        return;
      }
      setShopIcon(icon, item.kind);
      if (item.count !== undefined) {
        const value = item.count > 999 ? '999+' : String(item.count);
        count.setText(value).setTint(item.count > 0 ? P.white : P.steel);
        const cy = full ? 18 : 12;
        d.fillStyle(P.ink).fillRect(
          x + SIZE - (full ? 3 : 2) - value.length * 6,
          cy,
          value.length * 6,
          8,
        );
      } else if (item.max !== undefined) {
        // Durabilidad: canal hundido con contorno y brillo en el relleno.
        const ratio = item.durability / item.max;
        const w = SIZE - 8;
        const by = SIZE - 7;
        d.fillStyle(P.ink).fillRect(x + 3, by, w + 2, 5);
        d.fillStyle(P.slate).fillRect(x + 4, by + 1, w, 3);
        const color = ratio > 0.5 ? P.mint : ratio > 0.2 ? P.gold : P.red;
        const fill = ratio > 0 ? Math.max(1, Math.round(w * ratio)) : 2;
        d.fillStyle(ratio > 0 ? color : P.red).fillRect(x + 4, by + 1, fill, 3);
        if (ratio > 0)
          d.fillStyle(ratio > 0.5 ? P.lime : ratio > 0.2 ? P.cream : P.peach)
            .fillRect(x + 4, by + 1, fill, 1);
      }
    });
  }

  /** Bandeja de la barra rápida: placa propia con riel y topes laterales. */
  private drawTray(g: Phaser.GameObjects.Graphics): void {
    const SIZE = this.size;
    const x = -TRAY.side,
      y = -TRAY.top,
      w = this.width + TRAY.side * 2,
      h = SIZE + TRAY.top + TRAY.bottom;
    hudPlate(g, x, y, w, h);
    // Riel bajo las casillas y topes con remache a cada lado.
    g.fillStyle(P.slate).fillRect(x + 2, SIZE + 1, w - 4, 1);
    for (const tx of [x + 1, x + w - 4]) {
      g.fillStyle(P.stone).fillRect(tx, 4, 3, SIZE - 8);
      g.fillStyle(P.silver).fillRect(tx, 4, 1, SIZE - 8);
      g.fillStyle(P.ink).fillRect(tx + 1, SIZE / 2 - 1, 1, 2);
    }
  }
}
