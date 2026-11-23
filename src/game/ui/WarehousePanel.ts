import type Phaser from 'phaser';
import { PALETTE as P } from '../config/palette';
import { DEPTH } from '../config/layers';
import type { GameSession } from '../systems/GameSession';
import {
  storageLabel,
  unitGrams,
  WAREHOUSE_GRAMS,
  type StorageStack,
} from '../systems/WarehouseStorage';
import { industrialFrame, slotWell } from './Frame';
import { FRESH_COLOR, lotsSummary, shortLines, slotBadge } from './FreshnessView';
import { pixelText } from './PixelFont';
import { setShopIcon } from './QuickbarView';

const PAGE_SIZE = 24;
const kg = (grams: number) => String(grams / 1000).replace('.', ',');
type Side = 'carried' | 'stored';

export class WarehousePanel {
  private readonly root: Phaser.GameObjects.Container;
  private session?: GameSession;
  private page = { carried: 0, stored: 0 };
  private selected?: { side: Side; index: number };
  private amount = 1;
  private message = '';
  private hits: {
    x: number;
    y: number;
    w: number;
    h: number;
    act: () => void;
  }[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly save: () => boolean,
    private readonly blockLimit = Infinity,
  ) {
    this.root = scene.add
      .container()
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 70);
    const click = (p: Phaser.Input.Pointer) => {
      if (!this.open || p.button !== 0) return;
      this.hits
        .find(
          ({ x, y, w, h }) =>
            p.x >= x && p.x < x + w && p.y >= y && p.y < y + h,
        )
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
    this.page = { carried: 0, stored: 0 };
    this.amount = 1;
    this.selected = undefined;
    this.message = '';
    const before = session.warehouse.stacks.length;
    const wasStocked = session.warehouse.kitStocked;
    session.warehouse.stockKit(session);
    if ((!wasStocked || session.warehouse.stacks.length !== before) && !this.save()) this.message = 'ERROR AL GUARDAR';
    this.draw();
  }

  close(): void {
    this.session = undefined;
    this.root.removeAll(true);
    this.hits = [];
  }

  private label(
    x: number,
    y: number,
    value: string,
    color: number = P.cream,
  ): void {
    this.root.add(pixelText(this.scene, x, y, value, color));
  }

  /** Resumen de vencimiento de una pila (carga o bodega); undefined si no caduca. */
  private freshness(item: StorageStack) {
    const s = this.session!;
    if (item.type !== 'supply') return undefined;
    const lots = item.lots ?? s.warehouse.lotsOf(item, s.dayNight.totalMs);
    return lotsSummary(s, lots);
  }

  private draw(): void {
    const s = this.session!;
    const stock = s.warehouse;
    const items = { carried: stock.carried(s), stored: stock.stacks };
    const selected =
      this.selected && items[this.selected.side][this.selected.index];
    this.root.removeAll(true);
    this.hits = [];
    const g = this.scene.add.graphics();
    this.root.add(g);
    industrialFrame(g, 21, 25, 438, 213, { title: 20 });
    this.label(31, 33, 'BODEGA   /   ALMACENAMIENTO', P.gold);
    this.label(
      31,
      52,
      `USADO: ${kg(stock.grams)} / 1000 KG   LIBRE: ${kg(WAREHOUSE_GRAMS - stock.grams)} KG`,
    );
    g.fillStyle(P.ink).fillRect(31, 64, 418, 7);
    g.fillStyle(P.mint).fillRect(
      32,
      65,
      Math.floor((416 * stock.grams) / WAREHOUSE_GRAMS),
      5,
    );
    const button = (
      x: number,
      y: number,
      w: number,
      label: string,
      act: () => void,
    ) => {
      g.fillStyle(P.steel).fillRect(x, y, w, 13);
      this.label(x + 4, y + 3, label);
      this.hits.push({ x, y, w, h: 13, act });
    };
    button(410, 29, 39, 'SALIR', () => this.close());
    for (const [side, x, title] of [
      ['carried', 32, 'INVENTARIO'],
      ['stored', 250, 'COFRE'],
    ] as const) {
      const list = items[side];
      const last = Math.max(0, Math.ceil(list.length / PAGE_SIZE) - 1);
      this.page[side] = Math.min(last, this.page[side]);
      const current = this.page[side];
      this.label(x, 79, `${title}   ${current + 1}/${last + 1}`, P.gold);
      for (const [offset, symbol, pos] of [
        [-1, '<', 156],
        [1, '>', 173],
      ] as const)
        button(x + pos, 76, 15, symbol, () => {
          this.page[side] = Math.max(0, Math.min(last, current + offset));
          this.selected = undefined;
          this.draw();
        });
      for (let i = 0; i < PAGE_SIZE; i++) {
        const px = x + (i % 8) * 25;
        const py = 94 + Math.floor(i / 8) * 26;
        const index = current * PAGE_SIZE + i;
        const item = list[index];
        slotWell(g, px, py, 22, 22);
        if (!item) continue;
        if (this.selected?.side === side && this.selected.index === index)
          g.lineStyle(1, P.gold).strokeRect(px, py, 22, 22);
        if (item.type === 'mineral')
          this.label(px + 2, py + 4, storageLabel(item).slice(0, 3), P.mint);
        else {
          const icon = this.scene.add.image(
            px + 11,
            py + 9,
            'items-v3',
            'lock',
          );
          setShopIcon(icon, item.kind);
          this.root.add(icon);
        }
        if (item.count > 1)
          this.label(px + 2, py + 14, String(item.count).slice(0, 3));
        // Alimentos: días que quedan hasta vencer (el reloj corre en la bodega).
        const sum = this.freshness(item);
        const badge = slotBadge(sum);
        if (badge) {
          const bg = this.scene.add.graphics();
          bg.fillStyle(P.ink).fillRect(px, py, badge.text.length * 6 + 1, 9);
          this.root.add(bg);
          this.label(px + 1, py + 1, badge.text, badge.color);
        }
        this.hits.push({
          x: px,
          y: py,
          w: 22,
          h: 22,
          act: () => {
            this.selected = { side, index };
            this.amount = 1;
            this.message = '';
            this.draw();
          },
        });
      }
    }
    if (selected) {
      this.label(
        32,
        176,
        `${storageLabel(selected)}   X${selected.count}   ${kg(unitGrams(selected))} KG/U`,
      );
      button(32, 191, 17, '-', () => {
        this.amount = Math.max(1, this.amount - 1);
        this.draw();
      });
      this.label(55, 194, String(this.amount));
      button(100, 191, 17, '+', () => {
        this.amount = Math.min(selected.count, this.amount + 1);
        this.draw();
      });
      button(123, 191, 29, '10+', () => {
        this.amount = Math.min(selected.count, this.amount + 10);
        this.draw();
      });
      button(158, 191, 40, 'TODO', () => {
        this.amount = selected.count;
        this.draw();
      });
      const deposit = this.selected!.side === 'carried';
      button(219, 191, 78, deposit ? 'DEPOSITAR' : 'RETIRAR', () => {
        const error = deposit
          ? stock.deposit(s, selected, this.amount)
          : stock.withdraw(
              s,
              this.selected!.index,
              this.amount,
              this.blockLimit,
            );
        this.message =
          error ??
          (this.save()
            ? deposit
              ? 'DEPOSITADO'
              : 'RETIRADO'
            : 'ERROR AL GUARDAR');
        if (!error) this.selected = undefined;
        this.draw();
      });
      // Vencimiento de la pila elegida (junto a los botones).
      const sum = this.freshness(selected);
      if (sum)
        shortLines(sum).forEach((line, i) =>
          this.label(
            304,
            190 + i * 10,
            line,
            i === 0 ? FRESH_COLOR[sum.state] : P.silver,
          ),
        );
    } else this.label(32, 176, 'ELIGE UNA CASILLA PARA MOVER OBJETOS');
    button(352, 212, 88, 'PEDIR AUXILIO', () => {
      this.message = !s.rescue()
        ? 'AUN TIENES MEDIOS PARA CONTINUAR'
        : this.save() ? 'HERRAMIENTAS DE AUXILIO RETIRADAS' : 'ERROR AL GUARDAR';
      this.draw();
    });
    this.label(
      32,
      219,
      this.message || 'CLIC: SELECCIONAR   ESC: CERRAR',
      this.message ? P.gold : P.cream,
    );
  }
}
