import type Phaser from 'phaser';
import { TILE_SIZE, VIEW } from '../config/constants';
import { LEVEL_REWARD } from '../config/gear';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';
import type { GameSession } from '../systems/GameSession';
import { pixelText, xpPixelText } from './PixelFont';

const CHARGE_MS = 240;
const DURATION_MS = 2600;
const BEAM_MS = 800;
export const BEAM_HEIGHT = 96;
const STARS = 16;
const XP_POPUP_MS = 700;

/** Efecto de presentación: lee el terreno, nunca registra luces ni descubre celdas. */
export class LevelUpEffect {
  private readonly beam: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.BitmapText;
  private readonly level: Phaser.GameObjects.BitmapText;
  private readonly gold: Phaser.GameObjects.BitmapText;
  private readonly speed: Phaser.GameObjects.BitmapText;
  private readonly xpShadow: Phaser.GameObjects.BitmapText;
  private readonly xp: Phaser.GameObjects.BitmapText;
  private readonly texts: Phaser.GameObjects.BitmapText[];
  private started = -Infinity;
  private targetLevel = 0;
  private count = 0;
  private pending: { level: number; count: number } | null = null;
  private sounded = false;
  private xpAt = -Infinity;
  private xpSum = 0;
  // Se reutilizan el gráfico y los textos; no se crean emisores por nivel.
  private starCount = 0;
  private beamHeight = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.beam = scene.add.graphics().setDepth(DEPTH.lighting + 1);
    this.labels = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH.worldUi + 6);
    const place = (text: Phaser.GameObjects.BitmapText) =>
      text
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.worldUi + 7)
        .setVisible(false);
    const text = (color: number) => place(pixelText(scene, 0, 0, '', color));
    this.title = text(P.gold);
    this.level = text(P.cream);
    this.gold = text(P.gold);
    this.speed = text(P.mint);
    this.xpShadow = place(xpPixelText(scene, P.slate));
    this.xp = place(xpPixelText(scene, P.mist));
    this.texts = [
      this.title,
      this.level,
      this.gold,
      this.speed,
      this.xpShadow,
      this.xp,
    ];
  }

  gain(xp: number, now: number): void {
    this.xpSum = (now - this.xpAt < 500 ? this.xpSum : 0) + xp;
    this.xpAt = now;
    this.xp.setText(`+${this.xpSum} XP`);
    this.xpShadow.setText(this.xp.text);
  }

  celebrate(level: number, count: number, now: number): void {
    if (now - this.started < DURATION_MS) {
      this.pending = { level, count: (this.pending?.count ?? 0) + count };
      return;
    }
    this.started = now;
    this.targetLevel = level;
    this.count = count;
    this.sounded = false;
  }

  isPresenting(now: number): boolean {
    return now - this.started < DURATION_MS || this.pending !== null;
  }

  update(
    s: GameSession,
    player: { x: number; y: number },
    now: number,
    modal: boolean,
  ): void {
    const g = this.beam.clear();
    this.labels.clear();
    this.starCount = this.beamHeight = 0;
    for (const t of this.texts) t.setVisible(false);
    if (now - this.started >= DURATION_MS && this.pending) {
      const next = this.pending;
      this.pending = null;
      this.celebrate(next.level, next.count, now);
    }
    const age = now - this.started;
    if (age >= CHARGE_MS && age < DURATION_MS && !this.sounded) {
      this.sounded = true;
      this.scene.sound.play('sfx-collect', { volume: 0.5, rate: 1.4 });
    }
    if (modal) return;
    const x = Math.round(player.x),
      y = Math.round(player.y);
    const camera = this.scene.cameras.main;
    const screenX = Math.round(x - camera.scrollX);
    const screenY = Math.round(y - camera.scrollY);
    const textY = Math.max(70, Math.min(181, screenY - 47));
    const xpAge = now - this.xpAt;
    if (xpAge < XP_POPUP_MS) {
      const progress = xpAge / XP_POPUP_MS;
      const rise = Math.round(16 * (1 - (1 - progress) ** 1.5));
      const margin = Math.ceil(this.xp.width / 2) + 4;
      const cx = Math.min(
        VIEW.width - margin,
        Math.max(margin, screenX + (age < DURATION_MS ? 57 : 13)),
      );
      const cy = Math.max(75, Math.min(215, screenY - 22)) - rise;
      // Solo glifos: la sombra de 1 px sigue la silueta, sin dibujar una placa.
      this.xpShadow.setVisible(true).setPosition(cx + 1, cy + 1);
      this.xp.setVisible(true).setPosition(cx, cy);
    }
    const show = (t: Phaser.GameObjects.BitmapText, tx: number, ty: number) => {
      const half = Math.ceil(t.width / 2);
      const cx = Math.min(VIEW.width - half - 4, Math.max(half + 4, tx));
      t.setVisible(true).setPosition(cx, ty);
      this.labels
        .fillStyle(P.ink)
        .fillRect(cx - half - 2, ty - 1, half * 2 + 4, t.height + 2);
    };

    if (age >= DURATION_MS) return;
    const t = age - CHARGE_MS;
    if (t < 0) return;
    const air = (px: number, py: number) => {
      const column = Math.floor(px / TILE_SIZE),
        row = Math.floor(py / TILE_SIZE);
      return s.visibility.has(column, row) && !s.grid.isSolid(column, row);
    };
    const ray = (px: number, py: number) => {
      const steps = Math.ceil(Math.hypot(px - x, py - (y - 8)) / 4);
      for (let i = 1; i <= steps; i++) {
        const f = i / steps;
        if (!air(x + (px - x) * f, y - 8 + (py - y + 8) * f)) return false;
      }
      return air(px, py);
    };
    const starClear = (px: number, py: number, size: number) =>
      ray(px, py) &&
      air(px - size, py) &&
      air(px + size, py) &&
      air(px, py - size) &&
      air(px, py + size);
    if (t < BEAM_MS) {
      // Columnas de píxeles planos; el techo detiene el haz incluso si hay aire al otro lado.
      const width =
        t < 90
          ? 3 + Math.floor(t / 15)
          : t > 560
            ? Math.ceil((800 - t) / 32)
            : 9;
      const top = y + 8 - BEAM_HEIGHT;
      for (let dx = -width; dx <= width; dx++) {
        const d = Math.abs(dx),
          base = d > 5 ? y + 8 : y - 11;
        const px = x + dx;
        let py = base;
        if (!ray(px, base)) continue;
        while (py > top && air(px, py - 1)) py--;
        const h = base - py;
        this.beamHeight = Math.max(this.beamHeight, h);
        g.fillStyle(d <= 1 ? P.cream : d <= 4 ? P.gold : P.amber);
        if (d >= 6)
          for (let yy = py; yy < base; yy += 3) {
            if ((yy + dx) % 2 === 0) g.fillRect(px, yy, 1, 2);
          }
        else g.fillRect(px, py, 1, h);
      }
      if (t < 160) {
        // Corona breve de chispas sin cubrir el cuerpo del personaje.
        const r = 9 + Math.floor(t / 12);
        for (const [dx, dy] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ] as const) {
          const px = x + dx * r,
            py = y - 5 + dy * Math.round(r * 0.6);
          if (starClear(px, py, 2)) this.star(px, py, 2, P.cream);
        }
      }
    }
    for (let i = 0; i < STARS; i++) {
      const k = (t - 70 - (i % 5) * 44) / 990;
      if (k < 0 || k >= 1 || (k > 0.77 && (Math.floor(t / 45) + i) % 2))
        continue;
      const lane = i - (STARS - 1) / 2;
      const px = x + Math.round(lane * (1.6 + k * 3.4));
      const py = y - 39 - (i % 4) * 7 + Math.round(k * (18 + k * 28));
      const size = k > 0.65 ? 0 : i % 3 ? 1 : 2;
      if (!starClear(px, py, size)) continue;
      this.star(px, py, size, i % 3 ? P.gold : P.white);
      this.starCount++;
    }
    if (t >= 110 && t < 1110) {
      this.title
        .setText('¡SUBISTE DE NIVEL!')
        .setScale(t >= 180 && t < 310 ? 2 : 1);
      show(this.title, screenX, textY);
      this.level.setText(`NIVEL ${this.targetLevel}`);
      show(this.level, screenX, textY + (this.title.scaleX === 2 ? 21 : 12));
    }
    if (t >= 540) {
      const rise = Math.floor((t - 540) / 110);
      this.gold.setText(`+${this.count * LEVEL_REWARD.gold} DE ORO`);
      show(this.gold, screenX, textY + 33 - rise);
      if (t >= 700) {
        this.speed.setText(
          `+${this.count * LEVEL_REWARD.miningPoints} VELOCIDAD DE MINADO`,
        );
        show(this.speed, screenX, textY + 44 - rise);
      }
    }
  }

  private star(x: number, y: number, size: number, color: number): void {
    this.beam
      .fillStyle(color)
      .fillRect(x - size, y, size * 2 + 1, 1)
      .fillRect(x, y - size, 1, size * 2 + 1);
  }
}
