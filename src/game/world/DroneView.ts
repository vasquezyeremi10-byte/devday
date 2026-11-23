import Phaser from 'phaser';
import { DRONE } from '../config/drones';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import type { DroneOrder, SupplyBox } from '../systems/DroneOrders';
import type { GameSession } from '../systems/GameSession';
import { droneLanding } from '../systems/DroneLanding';
import { pixelText } from '../ui/PixelFont';
import { buildParts, type Brush, type Part } from './structures/PartsTexture';

/**
 * Entrega por dron (sin NPC): el dron entra volando desde la izquierda, se
 * detiene sobre el punto de entrega junto a la cabaña, baja, suelta la caja y
 * se va. Las cajas quedan en el suelo hasta vaciarlas con E. Un indicador
 * (sobre la oscuridad, DEPTH.worldUi) señala cada caja y el dron en camino,
 * y una placa del HUD muestra la cuenta regresiva.
 *
 * Arte original por código con la paleta de 49 colores y alfa 0/255.
 */
const TEXTURE = 'drone';
const DRONE_W = 28;
const DRONE_H = 13;
const BOX_W = 16;
const BOX_H = 13;
/** El dron (origen arriba al centro) sostiene la caja por la parte de arriba. */
const BOX_UNDER = 12;
const GROUND = DRONE.groundY;
/** y del dron cuando la caja toca el suelo. */
const PLATE = { x: 339, y: 29, w: 136, h: 13 } as const;

type Grid = readonly string[];
const COLORS: Record<string, number> = {
  S: P.silver,
  W: P.white,
  H: P.stone,
  A: P.steel,
  Y: P.gold,
  K: P.ink,
  R: P.red,
  r: P.rust,
  G: P.mint,
  g: P.teal,
  N: P.slate,
  T: P.stone,
  L: P.indigo,
  M: P.mist,
  C: P.steel,
  c: P.clay,
  b: P.loam,
  l: P.silver,
  s: P.steel,
  n: P.night,
  V: P.cream,
  k: P.umber,
};

/** Cuadrícula con contorno de tinta automático (alrededor de lo pintado). */
function outlined(grid: Grid): Part['draw'] {
  const at = (x: number, y: number) =>
    y >= 0 &&
    y < grid.length &&
    x >= 0 &&
    x < grid[y]!.length &&
    grid[y]![x] !== '.';
  return (b: Brush) =>
    grid.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch !== '.') b.px(x, y, COLORS[ch]!);
        else if (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1))
          b.px(x, y, P.ink);
      }),
    );
}

/** Aspas: larga, corta y en giro (tres posiciones de las hélices). */
const BLADES = [
  '.SSSSSSSSS........SSSSSSSSS.',
  '...SSSSS............SSSSS...',
  '..W.SSS.W..........W.SSS.W..',
];
function droneGrid(blades: string, lights: boolean): Grid {
  return [
    '............................',
    blades,
    '....HHH..............HHH....',
    '.....A................A.....',
    '.....AAAAA........AAAAA.....',
    '.........YKYKYKYKYK.........',
    `.........${lights ? 'R' : 'r'}NNNNNNNN${lights ? 'G' : 'g'}.........`,
    '.........NNNLLMLNNN.........',
    '..........TTTTTTTT..........',
    '............CCCC............',
    '...........C....C...........',
    '...........C....C...........',
    '............................',
  ];
}
const BOX_CLOSED: Grid = [
  '................',
  '.KYKYKYKYKYKYKY.',
  '.ssssssssssssss.',
  '.lccccccccccccl.',
  '.lbbbbbbbbbbbbl.',
  '.cccVVVVVVVcccc.',
  '.cccVkVVVkVcccc.',
  '.bbbVVkkkVVbbbb.',
  '.cccVVVkVVVcccc.',
  '.cccVVVVVVVcccc.',
  '.lbbbbbbbbbbbbl.',
  '.ssssssssssssss.',
  '................',
];
const BOX_OPEN: Grid = [
  '.KYKYKYKYKYKYKY.',
  '.ssssssssssssss.',
  '.nnnnnnnnnnnnnn.',
  '.lccccccccccccl.',
  '.lbbbbbbbbbbbbl.',
  '.cccVVVVVVVcccc.',
  '.cccVkVVVkVcccc.',
  '.bbbVVkkkVVbbbb.',
  '.cccVVVkVVVcccc.',
  '.cccVVVVVVVcccc.',
  '.lbbbbbbbbbbbbl.',
  '.ssssssssssssss.',
  '................',
];

const PARTS: Part[] = [
  // Hélices girando y luces de navegación que parpadean.
  {
    name: 'drone_0',
    w: DRONE_W,
    h: DRONE_H,
    draw: outlined(droneGrid(BLADES[0]!, true)),
  },
  {
    name: 'drone_1',
    w: DRONE_W,
    h: DRONE_H,
    draw: outlined(droneGrid(BLADES[1]!, false)),
  },
  {
    name: 'drone_2',
    w: DRONE_W,
    h: DRONE_H,
    draw: outlined(droneGrid(BLADES[2]!, true)),
  },
  {
    name: 'drone_3',
    w: DRONE_W,
    h: DRONE_H,
    draw: outlined(droneGrid(BLADES[1]!, false)),
  },
  { name: 'box_closed', w: BOX_W, h: BOX_H, draw: outlined(BOX_CLOSED) },
  { name: 'box_open', w: BOX_W, h: BOX_H, draw: outlined(BOX_OPEN) },
];

/** Interpolación con salida suave, en píxeles enteros. */
const ease = (t: number) => 1 - (1 - t) * (1 - t);
const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

/** Posición del dron en su vuelo (t en ms desde el despegue). */
export function flightPose(
  slotX: number,
  t: number,
  groundY: number = GROUND,
): {
  x: number;
  y: number;
  phase: 'approach' | 'descend' | 'drop' | 'leave' | 'done';
  carrying: boolean;
} {
  const f = DRONE.flight;
  const startX = slotX - f.reach;
  const cruiseY = groundY - f.cruise - BOX_UNDER - BOX_H;
  const hoverY = groundY - f.hover - BOX_UNDER - BOX_H;
  const landY = groundY - BOX_UNDER - BOX_H;
  if (t < f.approachMs) {
    const k = ease(t / f.approachMs);
    return {
      x: lerp(startX, slotX, k),
      y: lerp(cruiseY, hoverY, k) + (Math.floor(t / 180) % 2),
      phase: 'approach',
      carrying: true,
    };
  }
  t -= f.approachMs;
  if (t < f.descendMs) {
    const k = ease(t / f.descendMs);
    return {
      x: slotX,
      y: lerp(hoverY, landY, k),
      phase: 'descend',
      carrying: true,
    };
  }
  t -= f.descendMs;
  if (t < f.dropMs)
    return {
      x: slotX,
      y: landY - Math.floor((t / f.dropMs) * 4),
      phase: 'drop',
      carrying: false,
    };
  t -= f.dropMs;
  if (t < f.leaveMs) {
    const k = (t / f.leaveMs) ** 2;
    return {
      x: lerp(slotX, slotX + f.reach, k),
      y: lerp(landY - 4, cruiseY - 20, Math.min(1, k * 1.6)),
      phase: 'leave',
      carrying: false,
    };
  }
  return {
    x: slotX + f.reach,
    y: cruiseY - 20,
    phase: 'done',
    carrying: false,
  };
}

export interface DroneHooks {
  /** La caja tocó el suelo (el pedido ya es una caja en la sesión). */
  onDelivered(box: SupplyBox): void;
  /** El dron despegó hacia el campamento. */
  onLaunch(order: DroneOrder): void;
}

export class DroneView {
  /** Vuelo actual (sesión real, no se guarda: al cargar vuelve a despegar). */
  flight: {
    orderId: number;
    slot: number;
    x: number;
    y: number;
    startedAt: number;
    /** Reloj real del despegue (para medir la espera). */
    launchedWall: number;
    dropped: boolean;
  } | null = null;
  private readonly drone: Phaser.GameObjects.Sprite;
  private readonly carried: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly boxes = new Map<number, Phaser.GameObjects.Image>();
  private readonly marks: Phaser.GameObjects.Graphics;
  private readonly plate: Phaser.GameObjects.Graphics;
  private readonly plateText: Phaser.GameObjects.BitmapText;
  private readonly labels: Phaser.GameObjects.BitmapText[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: () => GameSession,
    private readonly hooks: DroneHooks,
  ) {
    buildParts(scene, TEXTURE, PARTS);
    if (!scene.anims.exists('drone-fly'))
      scene.anims.create({
        key: 'drone-fly',
        frames: [0, 1, 2, 3].map((i) => ({
          key: TEXTURE,
          frame: `drone_${i}`,
        })),
        frameRate: 20,
        repeat: -1,
      });
    this.shadow = scene.add
      .image(0, 0, 'warehouse', 'shadow_small')
      .setOrigin(0, 0)
      .setDepth(DEPTH.structures + 4)
      .setVisible(false);
    this.carried = scene.add
      .image(0, 0, TEXTURE, 'box_closed')
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.characters + 2)
      .setVisible(false);
    this.drone = scene.add
      .sprite(0, 0, TEXTURE, 'drone_0')
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.characters + 3)
      .setVisible(false);
    this.marks = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH.worldUi + 6);
    this.plate = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 2);
    this.plateText = pixelText(scene, PLATE.x + 15, PLATE.y + 3, '', P.cream)
      .setScrollFactor(0)
      .setDepth(DEPTH.ui + 3);
    // Un vuelo que quedó a medias (cambio de escena) vuelve a la cola.
    session().drones.resetFlights();
  }

  /** x del mundo del punto de entrega. */
  static slotX(slot: number): number {
    return DRONE.slots[slot]!;
  }

  /** Avanza la cola (reloj real) y el vuelo (tiempo de la escena). */
  update(now: number, wallNow: number): void {
    const drones = this.session().drones;
    if (!this.flight) {
      const next = drones.nextLaunch(wallNow);
      if (next) {
        const landing =
          next.destination &&
          droneLanding(
            this.session().grid,
            next.destination,
            drones.boxes.map((b) => b.landing).filter((p) => p !== undefined),
            // Las estructuras son decorativas en TerrainGrid, pero ocupan píxeles visibles.
            (x, y) =>
              y <= 164 && ((x >= -380 && x <= -212) || (x >= 39 && x <= 132)),
          );
        const slot = drones.launch(next.id, landing);
        if (slot !== null) {
          this.flight = {
            orderId: next.id,
            slot,
            x: landing?.x ?? DroneView.slotX(slot),
            y: landing?.y ?? GROUND,
            startedAt: now,
            launchedWall: wallNow,
            dropped: false,
          };
          this.hooks.onLaunch(next);
        }
      }
    }
    this.updateFlight(now);
    this.syncBoxes();
    this.drawMarks(now);
    this.drawPlate(wallNow);
  }

  private updateFlight(now: number): void {
    const f = this.flight;
    if (!f) {
      this.drone.setVisible(false).stop();
      this.carried.setVisible(false);
      this.shadow.setVisible(false);
      return;
    }
    const pose = flightPose(f.x, now - f.startedAt, f.y);
    if (
      !f.dropped &&
      (pose.phase === 'drop' || pose.phase === 'leave' || pose.phase === 'done')
    ) {
      f.dropped = true;
      const box = this.session().drones.deliver(
        f.orderId,
        this.session().dayNight.totalMs,
      );
      if (box) this.hooks.onDelivered(box);
    }
    if (pose.phase === 'done') {
      this.flight = null;
      this.updateFlight(now);
      return;
    }
    this.drone.setVisible(true).setPosition(pose.x, pose.y);
    if (!this.drone.anims.isPlaying) this.drone.play('drone-fly');
    this.carried
      .setVisible(pose.carrying)
      .setPosition(pose.x, pose.y + BOX_UNDER);
    // Sombra en el suelo cuando el dron está cerca.
    const height = f.y - (pose.y + BOX_UNDER + BOX_H);
    this.shadow.setVisible(height < 70).setPosition(pose.x - 6, f.y - 1);
  }

  /** Una imagen por caja de la sesión (tapa abierta si ya se abrió). */
  private syncBoxes(): void {
    const boxes = this.session().drones.boxes;
    const alive = new Set(boxes.map((b) => b.id));
    for (const [id, img] of this.boxes)
      if (!alive.has(id)) {
        img.destroy();
        this.boxes.delete(id);
      }
    for (const box of boxes) {
      let img = this.boxes.get(box.id);
      if (!img) {
        img = this.scene.add
          .image(
            box.landing?.x ?? DroneView.slotX(box.slot),
            box.landing?.y ?? GROUND,
            TEXTURE,
            'box_closed',
          )
          .setOrigin(0.5, 1)
          .setDepth(DEPTH.structures + 6);
        this.boxes.set(box.id, img);
      }
      img.setFrame(box.opened ? 'box_open' : 'box_closed');
    }
  }

  /**
   * Indicadores sobre la oscuridad: flecha que rebota sobre cada caja y el
   * punto de entrega del dron en vuelo; fuera de pantalla, una flecha en el
   * borde con la distancia en metros (1 bloque = 1 m).
   */
  private drawMarks(now: number): void {
    const g = this.marks.clear();
    let label = 0;
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const s = this.session();
    const targets: { x: number; y: number; color: number; tag: string }[] =
      s.drones.boxes.map((b) => ({
        x: b.landing?.x ?? DroneView.slotX(b.slot),
        y: b.landing?.y ?? GROUND,
        color: P.gold,
        tag: 'CAJA',
      }));
    if (this.flight && !this.flight.dropped)
      targets.push({
        x: this.flight.x,
        y: this.flight.y,
        color: P.mint,
        tag: 'DRON',
      });
    const bob = Math.floor(now / 250) % 2;
    const minerX = (
      this.scene as unknown as { miner?: { x: number; y: number } }
    ).miner;
    for (const t of targets) {
      const wy = t.y - BOX_H - 6;
      const sx = Math.round((t.x - view.x) * cam.zoom);
      const sy = Math.round((wy - view.y) * cam.zoom);
      const inside =
        sx >= 8 && sx <= cam.width - 8 && sy >= 36 && sy <= cam.height - 70;
      if (inside) {
        this.arrow(g, sx, sy - 6 - bob, 'down', t.color);
        continue;
      }
      // Fuera de pantalla: flecha en el borde hacia el objetivo.
      const cx = cam.width / 2;
      const cy = cam.height / 2;
      const dx = sx - cx;
      const dy = sy - cy;
      const horizontal =
        Math.abs(dx) * (cam.height / cam.width) >= Math.abs(dy);
      const ex = horizontal
        ? dx < 0
          ? 10
          : cam.width - 10
        : Math.max(14, Math.min(cam.width - 14, sx));
      const ey = horizontal
        ? Math.max(40, Math.min(cam.height - 74, sy))
        : dy < 0
          ? 40
          : cam.height - 74;
      const dir = horizontal
        ? dx < 0
          ? 'left'
          : 'right'
        : dy < 0
          ? 'up'
          : 'down';
      this.arrow(g, ex, ey, dir, t.color);
      const meters = minerX
        ? Math.round(Math.hypot(t.x - minerX.x, wy - minerX.y) / 16)
        : 0;
      let text = this.labels[label];
      if (!text) {
        text = pixelText(this.scene, 0, 0, '', P.cream)
          .setScrollFactor(0)
          .setDepth(DEPTH.worldUi + 7);
        this.labels.push(text);
      }
      label++;
      const value = `${t.tag} ${meters} M`;
      const tx =
        dir === 'left'
          ? ex + 8
          : dir === 'right'
            ? ex - 8 - value.length * 6
            : ex - value.length * 3;
      const ty = dir === 'up' ? ey + 7 : dir === 'down' ? ey - 15 : ey - 4;
      g.fillStyle(P.ink).fillRect(tx - 2, ty - 1, value.length * 6 + 3, 10);
      text.setText(value).setPosition(tx, ty).setTint(t.color).setVisible(true);
    }
    for (let i = label; i < this.labels.length; i++)
      this.labels[i]!.setVisible(false);
  }

  /** Flecha de 7 × 5 con contorno de tinta. */
  private arrow(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    dir: 'up' | 'down' | 'left' | 'right',
    color: number,
  ): void {
    const rows = [7, 5, 3, 1];
    const draw = (c: number, grow: number) => {
      g.fillStyle(c);
      rows.forEach((w, i) => {
        const len = w + grow * 2;
        const off = i - grow;
        if (dir === 'down')
          g.fillRect(x - Math.floor(len / 2), y + off, len, 1);
        else if (dir === 'up')
          g.fillRect(x - Math.floor(len / 2), y - off, len, 1);
        else if (dir === 'right')
          g.fillRect(x + off, y - Math.floor(len / 2), 1, len);
        else g.fillRect(x - off, y - Math.floor(len / 2), 1, len);
      });
    };
    draw(P.ink, 1);
    draw(color, 0);
  }

  /** Placa del HUD: cuenta regresiva, dron en vuelo o cajas listas. */
  private drawPlate(wallNow: number): void {
    const s = this.session().drones;
    const g = this.plate.clear();
    const waiting = [...s.orders]
      .sort((a, b) => a.id - b.id)
      .find((o) => o.slot === null);
    let text = '';
    let color: number = P.cream;
    if (this.flight && !this.flight.dropped) {
      text = `PEDIDO ${this.flight.orderId} EN VUELO`;
      color = P.mint;
    } else if (waiting) {
      const left = s.remainingMs(waiting, wallNow);
      if (left > 0) {
        const sec = Math.ceil(left / 1000);
        text = `PEDIDO ${waiting.id} EN 0:${String(sec).padStart(2, '0')}`;
      } else if (s.freeSlot() === null) {
        text = 'ABRE TUS CAJAS';
        color = P.red;
      } else text = `PEDIDO ${waiting.id} EN COLA`;
    } else if (s.boxes.length) {
      text = `CAJAS PENDIENTES X${s.boxes.length}`;
      color = P.gold;
    }
    if (!text) {
      this.plateText.setVisible(false);
      return;
    }
    const { x, y, w, h } = PLATE;
    g.fillStyle(P.ink).fillRect(x, y, w, h);
    g.fillStyle(P.night).fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle(P.gold).fillRect(x + 1, y + 1, 2, h - 2);
    // Dron en miniatura.
    g.fillStyle(P.silver)
      .fillRect(x + 5, y + 3, 3, 1)
      .fillRect(x + 9, y + 3, 3, 1);
    g.fillStyle(P.steel).fillRect(x + 6, y + 4, 5, 3);
    g.fillStyle(P.gold).fillRect(x + 7, y + 4, 3, 1);
    g.fillStyle(P.clay).fillRect(x + 7, y + 7, 3, 3);
    const extra = s.orders.length > 1 ? ` +${s.orders.length - 1}` : '';
    this.plateText
      .setText((text + extra).slice(0, 19))
      .setTint(color)
      .setVisible(true);
  }
}
