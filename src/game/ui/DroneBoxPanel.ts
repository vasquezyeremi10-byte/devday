import type Phaser from 'phaser';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import type { GameSession } from '../systems/GameSession';
import { phoneProduct } from '../systems/PhoneCart';
import { shelfLifeMs } from '../systems/Freshness';
import { industrialFrame } from './Frame';
import { pixelText } from './PixelFont';

/** Inventario de la caja: abrirla nunca transfiere productos. */
export class DroneBoxPanel {
  private readonly root: Phaser.GameObjects.Container;
  private boxId: number | null = null;
  private selected = 0;
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
    private readonly session: () => GameSession,
    private readonly save: () => boolean,
    private readonly onTaken: () => void,
  ) {
    this.root = scene.add
      .container()
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 70);
    const click = (p: Phaser.Input.Pointer) => {
      if (!this.open || p.button !== 0) return;
      this.hits
        .find(
          (h) => p.x >= h.x && p.x < h.x + h.w && p.y >= h.y && p.y < h.y + h.h,
        )
        ?.act();
    };
    scene.input.on('pointerdown', click);
    scene.events.once('shutdown', () => scene.input.off('pointerdown', click));
  }

  get open(): boolean {
    return this.boxId !== null;
  }
  show(id: number): void {
    const box = this.session().drones.boxes.find((b) => b.id === id);
    if (!box) return;
    this.boxId = id;
    box.opened = true;
    this.selected = 0;
    this.amount = 1;
    this.message = '';
    this.draw();
  }
  close(): void {
    this.boxId = null;
    this.root.removeAll(true);
    this.hits = [];
  }
  key(key: string): void {
    if (!this.open) return;
    const lines =
      this.session().drones.boxes.find((b) => b.id === this.boxId)?.items ?? [];
    if (key === 'ESC') this.close();
    else if (key === 'UP') {
      this.selected = Math.max(0, this.selected - 1);
      this.amount = 1;
      this.draw();
    } else if (key === 'DOWN') {
      this.selected = Math.min(lines.length - 1, this.selected + 1);
      this.amount = 1;
      this.draw();
    } else if (key === 'LEFT') {
      this.amount = Math.max(1, this.amount - 1);
      this.draw();
    } else if (key === 'RIGHT') {
      this.amount = Math.min(lines[this.selected]?.qty ?? 1, this.amount + 1);
      this.draw();
    } else if (key === 'ENTER' || key === 'Z') this.take();
  }

  private take(): void {
    const s = this.session();
    const box = s.drones.boxes.find((b) => b.id === this.boxId);
    const line = box?.items[this.selected];
    if (!box || !line) return;
    const result = s.drones.collectLine(
      box.id,
      line.kind,
      this.amount,
      (kind) => s.receive(kind, box.at + shelfLifeMs(kind)),
    );
    if (!result) return;
    this.message = result.taken
      ? `RETIRADO X${result.taken}${result.taken < this.amount ? '  INVENTARIO LLENO' : ''}`
      : 'INVENTARIO LLENO: LIBERA UNA CASILLA';
    if (result.taken) {
      this.onTaken();
      if (!this.save()) this.message = 'ERROR AL GUARDAR';
    }
    if (result.emptied) {
      this.close();
      return;
    }
    this.selected = Math.min(this.selected, box.items.length - 1);
    this.amount = Math.min(this.amount, box.items[this.selected]!.qty);
    this.draw();
  }

  private draw(): void {
    const box = this.session().drones.boxes.find((b) => b.id === this.boxId);
    if (!box) {
      this.close();
      return;
    }
    this.root.removeAll(true);
    this.hits = [];
    const g = this.scene.add.graphics();
    this.root.add(g);
    industrialFrame(g, 56, 38, 368, 194, { title: 20 });
    const label = (
      x: number,
      y: number,
      value: string,
      color: number = P.cream,
    ) => this.root.add(pixelText(this.scene, x, y, value, color));
    const button = (
      x: number,
      y: number,
      w: number,
      value: string,
      act: () => void,
    ) => {
      g.fillStyle(P.steel).fillRect(x, y, w, 14);
      label(x + 4, y + 3, value);
      this.hits.push({ x, y, w, h: 14, act });
    };
    label(68, 46, `CAJA DEL DRON ${box.id}`, P.gold);
    button(369, 43, 43, 'SALIR', () => this.close());
    label(
      68,
      65,
      `PRODUCTOS PENDIENTES  ${this.selected + 1}/${box.items.length}`,
    );
    button(370, 62, 18, '^', () => this.key('UP'));
    button(393, 62, 18, 'V', () => this.key('DOWN'));
    const first = Math.max(0, this.selected - 6);
    box.items.slice(first, first + 7).forEach((line, offset) => {
      const i = first + offset;
      const y = 79 + offset * 13;
      if (i === this.selected)
        g.fillStyle(P.slate).fillRect(67, y - 1, 344, 12);
      label(
        72,
        y,
        `${i === this.selected ? '>' : ' '} ${phoneProduct(line.kind).label.slice(0, 30)}  X${line.qty}`,
        i === this.selected ? P.gold : P.cream,
      );
      this.hits.push({
        x: 67,
        y: y - 1,
        w: 344,
        h: 12,
        act: () => {
          this.selected = i;
          this.amount = 1;
          this.message = '';
          this.draw();
        },
      });
    });
    label(69, 175, `CANTIDAD: ${this.amount}`, P.gold);
    button(190, 172, 17, '-', () => {
      this.amount = Math.max(1, this.amount - 1);
      this.draw();
    });
    button(213, 172, 17, '+', () => {
      this.amount = Math.min(box.items[this.selected]!.qty, this.amount + 1);
      this.draw();
    });
    button(237, 172, 42, 'TODO', () => {
      this.amount = box.items[this.selected]!.qty;
      this.draw();
    });
    button(301, 172, 78, 'RETIRAR', () => this.take());
    label(
      68,
      198,
      this.message || 'FLECHAS: ELEGIR   ENTER: RETIRAR   ESC: SALIR',
      this.message ? P.gold : P.silver,
    );
  }
}
