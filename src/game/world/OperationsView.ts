import type Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import type { GameSession } from '../systems/GameSession';
import { StabilityState } from '../systems/GeotechnicalSystem';
import { SUPPORT } from '../systems/SupportSystem';
import { pixelText } from '../ui/PixelFont';
import type { Cell } from './TerrainGrid';
import { TerrainFrame } from './TerrainVisuals';

const T = TILE_SIZE;

/**
 * Proyección visual de lo instalado por el jugador. Ninguna imagen decide
 * colisión, estabilidad ni aire: todo se lee de los sistemas de GameSession.
 */
export class OperationsView {
  private readonly frames: Phaser.GameObjects.Graphics;
  private readonly ducts: Phaser.GameObjects.Graphics;
  private readonly hazard: Phaser.GameObjects.Graphics;
  private readonly sprites = new Map<string, Phaser.GameObjects.GameObject>();
  private readonly cracks: Phaser.GameObjects.Image[] = [];
  private readonly timers: Phaser.GameObjects.BitmapText[] = [];
  private signature = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.frames = scene.add.graphics().setDepth(DEPTH.structures + 4);
    this.ducts = scene.add.graphics().setDepth(DEPTH.structures + 3);
    this.hazard = scene.add.graphics().setDepth(DEPTH.worldUi - 1);
  }

  private sprite<T extends Phaser.GameObjects.GameObject>(
    key: string,
    make: () => T,
  ): T {
    let s = this.sprites.get(key) as T | undefined;
    if (!s) {
      s = make();
      this.sprites.set(key, s);
    }
    return s;
  }

  update(s: GameSession, now: number, player: Cell): void {
    const sig = JSON.stringify([
      s.supports.items.map((x) => [
        x.column,
        x.row,
        x.kind,
        x.roof,
        Math.ceil(x.durability / 10),
      ]),
      s.lights.items.map((l) => l.id),
      s.ventilation.ducts,
      s.ventilation.status.map((f) => f.running),
      [...s.blasting.drilled],
      s.blasting.charges.map((c) => [c.column, c.row, c.endsAt !== null]),
    ]);
    if (sig !== this.signature) {
      this.signature = sig;
      this.rebuild(s);
    }
    this.drawHazards(s, now, player);
    // Cuenta regresiva visible sobre cada mecha encendida.
    let n = 0;
    for (const c of s.blasting.charges) {
      if (c.endsAt === null) continue;
      const seconds = Math.max(0, Math.ceil((c.endsAt - now) / 1000));
      const label =
        this.timers[n] ??
        (this.timers[n] = pixelText(this.scene, 0, 0, '', P.red).setDepth(
          DEPTH.worldUi + 1,
        ));
      label
        .setVisible(true)
        .setText(`${seconds}`)
        .setPosition(c.column * T + 5, c.row * T - 10)
        .setTint(Math.floor(now / 150) % 2 ? P.cream : P.red);
      // Chispa de la mecha: píxeles que alternan cada 90 ms.
      const spark = Math.floor(now / 90) % 3;
      this.hazard
        .fillStyle(spark ? P.gold : P.white)
        .fillRect(c.column * T + 9 + spark, c.row * T + 2 - spark, 1, 1);
      n++;
    }
    for (; n < this.timers.length; n++) this.timers[n]!.setVisible(false);
  }

  private rebuild(s: GameSession): void {
    const g = this.frames.clear();
    // Marcos: postes, sombrero y cuñas contra el techo real.
    for (const sp of s.supports.items) {
      const x = sp.column * T,
        top = (sp.roof + 1) * T,
        floor = (sp.row + 1) * T;
      const steel = sp.kind === 'steel',
        broken = sp.durability <= 0,
        worn = sp.durability < SUPPORT[sp.kind].durability * 0.35;
      // Madera cálida (ocre/greda) o acero azul con remaches.
      const fill = steel ? P.steel : P.clay,
        light = steel ? P.silver : P.ochre,
        dark = steel ? P.slate : P.earth;
      for (const px of [x + 1, x + 12]) {
        g.fillStyle(P.ink).fillRect(px, top + 3, 3, floor - top - 3);
        g.fillStyle(fill).fillRect(px + 1, top + 3, 1, floor - top - 3);
        g.fillStyle(light).fillRect(px, top + 4, 1, floor - top - 5);
        // Vetas de la madera o placas apernadas del acero.
        for (let y = top + 8; y < floor - 3; y += 6)
          g.fillStyle(steel ? P.white : dark).fillRect(px + 1, y, 1, 1);
        // Zapata sobre el piso.
        g.fillStyle(P.ink).fillRect(px - 1, floor - 2, 5, 2);
        g.fillStyle(steel ? P.stone : P.taupe).fillRect(px, floor - 2, 3, 1);
      }
      if (broken) {
        // Sombrero partido: dos mitades caídas.
        g.fillStyle(P.ink)
          .fillRect(x, top + 1, 7, 3)
          .fillRect(x + 9, top + 3, 7, 3);
        g.fillStyle(dark)
          .fillRect(x + 1, top + 2, 5, 1)
          .fillRect(x + 10, top + 4, 5, 1);
        continue;
      }
      g.fillStyle(P.ink).fillRect(x, top, T, 4);
      g.fillStyle(fill).fillRect(x + 1, top + 1, T - 2, 2);
      g.fillStyle(light).fillRect(x + 1, top + 1, T - 2, 1);
      g.fillStyle(dark)
        .fillRect(x + 4, top + 3, 1, 1)
        .fillRect(x + 11, top + 3, 1, 1);
      if (steel)
        for (const bx of [x + 2, x + 7, x + 13])
          g.fillStyle(P.white).fillRect(bx, top + 1, 1, 1);
      if (worn)
        g.fillStyle(P.ink)
          .fillRect(x + 6, top + 1, 1, 2)
          .fillRect(x + 2, top + 8, 1, 2);
    }
    // Ductos conectados entre sí y a los ventiladores.
    const d = this.ducts.clear();
    const joined = (c: number, r: number) =>
      s.ventilation.hasDuct(c, r) ||
      s.ventilation.fans.some((f) => f.column === c && f.row === r);
    for (const duct of s.ventilation.ducts) {
      const cx = duct.column * T + 8,
        cy = duct.row * T + 5;
      const arms: [number, number][] = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      d.fillStyle(P.ink).fillRect(cx - 3, cy - 3, 7, 7);
      for (const [dx, dy] of arms)
        if (joined(duct.column + dx, duct.row + dy)) {
          if (dx)
            d.fillStyle(P.ink).fillRect(dx > 0 ? cx : cx - 8, cy - 3, 9, 7);
          else d.fillStyle(P.ink).fillRect(cx - 3, dy > 0 ? cy : cy - 8, 7, 9);
        }
      for (const [dx, dy] of arms)
        if (joined(duct.column + dx, duct.row + dy)) {
          if (dx) {
            d.fillStyle(P.steel).fillRect(dx > 0 ? cx : cx - 8, cy - 2, 9, 5);
            d.fillStyle(P.silver).fillRect(dx > 0 ? cx : cx - 8, cy - 2, 9, 1);
          } else
            d.fillStyle(P.steel).fillRect(cx - 2, dy > 0 ? cy : cy - 8, 5, 9);
        }
      d.fillStyle(P.steel).fillRect(cx - 2, cy - 2, 5, 5);
      d.fillStyle(P.silver).fillRect(cx - 2, cy - 2, 5, 1);
      d.fillStyle(P.slate).fillRect(cx - 2, cy + 2, 5, 1);
      // Brida de unión con pernos en el centro de cada tramo.
      d.fillStyle(P.stone).fillRect(cx - 3, cy - 3, 1, 7);
      d.fillStyle(P.gold).fillRect(cx - 3, cy - 2, 1, 1);
    }
    // Sprites de luces, ventiladores, barrenos y cargas.
    const live = new Set<string>();
    for (const l of s.lights.items) {
      const key = `light-${l.id}`;
      live.add(key);
      this.sprite(key, () => {
        const x = l.column * T,
          y = l.row * T;
        if (l.kind === 'torch')
          return this.scene.add
            .sprite(x + 4, y, 'torch', l.id % 4)
            .setOrigin(0, 0)
            .setDepth(DEPTH.structures + 2)
            .play({ key: 'torch-burn', startFrame: l.id % 4 });
        const ceiling = s.grid.isSolid(l.column, l.row - 1);
        return this.scene.add
          .image(
            x + 8,
            ceiling ? y : y + 6,
            'world-v3',
            l.kind === 'lamp' ? 'lamp_mine' : 'lamp_industrial',
          )
          .setOrigin(0.5, 0)
          .setDepth(DEPTH.structures + 2);
      });
    }
    for (const f of s.ventilation.fans) {
      const key = `fan-${f.id}`;
      live.add(key);
      const sprite = this.sprite(key, () =>
        this.scene.add
          .sprite(
            f.column * T + 8,
            (f.row + 1) * T,
            f.kind === 'fan_main' ? 'fan-main' : 'fan-aux',
            0,
          )
          .setOrigin(0.5, 1)
          .setDepth(DEPTH.structures + 3),
      ) as Phaser.GameObjects.Sprite;
      const running = s.ventilation.status.find((x) => x.id === f.id)?.running;
      if (running)
        sprite.play(
          `${f.kind === 'fan_main' ? 'fan-main' : 'fan-aux'}-spin`,
          true,
        );
      else sprite.stop();
    }
    for (const k of s.blasting.drilled) {
      const [c, r] = k.split(',').map(Number) as [number, number];
      const key = `hole-${k}`;
      live.add(key);
      this.sprite(key, () =>
        this.scene.add
          .image(c * T + 6, r * T + 6, 'world-v3', 'drill_hole')
          .setOrigin(0)
          .setDepth(DEPTH.terrain + 3),
      );
    }
    for (const c of s.blasting.charges) {
      const key = `charge-${c.column},${c.row}`;
      live.add(key);
      this.sprite(key, () =>
        this.scene.add
          .image(c.column * T + 5, c.row * T + 4, 'world-v3', 'charge')
          .setOrigin(0)
          .setDepth(DEPTH.terrain + 4),
      );
    }
    for (const [key, obj] of this.sprites)
      if (!live.has(key)) {
        obj.destroy();
        this.sprites.delete(key);
      }
  }

  /** Grietas de techo por gravedad y marca de bloques en colapso inminente. */
  private drawHazards(s: GameSession, now: number, player: Cell): void {
    this.hazard.clear();
    let n = 0;
    for (const span of s.geotech.spans) {
      if (span.state === StabilityState.Stable) continue;
      if (
        Math.abs(span.roof - player.row) > 12 ||
        span.to < player.column - 16 ||
        span.from > player.column + 16
      )
        continue;
      const stage =
        span.state === StabilityState.Watch
          ? 0
          : span.state === StabilityState.Danger
            ? 2
            : 3;
      for (let c = span.from; c <= span.to; c++) {
        if (!s.visibility.has(c, span.roof)) continue;
        const crack =
          this.cracks[n] ??
          (this.cracks[n] = this.scene.add
            .image(0, 0, 'terrain', TerrainFrame.CrackFirst)
            .setOrigin(0)
            .setDepth(DEPTH.terrain + 2.7));
        crack
          .setVisible(true)
          .setPosition(c * T, span.roof * T)
          .setFrame(TerrainFrame.CrackFirst + stage)
          .setFlipX((c + span.roof) % 2 === 1);
        n++;
        if (span.state === StabilityState.Imminent && Math.floor(now / 250) % 2)
          this.hazard
            .lineStyle(1, P.red)
            .strokeRect(c * T, span.roof * T, T, T);
      }
    }
    for (; n < this.cracks.length; n++) this.cracks[n]!.setVisible(false);
  }
}
