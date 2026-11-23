import Phaser from 'phaser';
import { PALETTE as P } from '../config/palette';

const PERIOD = 5200;
const FRAME_MS = 36;
const SWEEP_MS = 1200;
const SPARK_MS = 360;

interface ShinePixel {
  x: number;
  y: number;
  color: number;
  gem: boolean;
  brightness: number;
}

/** Lee el filo dorado y los cristales del marco central una vez al crear el menú. */
function readShinePixels(image: Phaser.GameObjects.Image): ShinePixel[] {
  const frame = image.frame;
  const source = image.texture.getSourceImage();
  if (!(source instanceof HTMLImageElement || source instanceof HTMLCanvasElement)) return [];
  const scratch = document.createElement('canvas');
  scratch.width = frame.width;
  scratch.height = frame.height;
  const ctx = scratch.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(source, -frame.cutX, -frame.cutY);
  const { data } = ctx.getImageData(0, 0, frame.width, frame.height);
  const pixels: ShinePixel[] = [];
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      const i = (y * frame.width + x) * 4;
      if (data[i + 3] !== 255) continue;
      const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
      const violet = b >= r && r > g + 24 && b >= 118;
      const cyan = b > r + 30 && g > r + 25 && b >= 130;
      const gem = violet || cyan;
      if (gem || (r >= 238 && g >= 154 && b < 160)) {
        const color = violet ? 0xea88eb : cyan ? P.mist : P.cream;
        pixels.push({ x, y, color, gem, brightness: r + g + b });
      }
    }
  }
  return pixels;
}

/** Destello diagonal y chispas escalonadas sobre «LA VETA», sin alfa parcial. */
export class MenuTitleShine {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly pixels: ShinePixel[];
  private readonly sparkSites: ShinePixel[] = [];
  private lastFrame = -1;

  constructor(private readonly image: Phaser.GameObjects.Image, depth: number) {
    this.graphics = image.scene.add.graphics().setDepth(depth).setVisible(false);
    this.pixels = readShinePixels(image);
    const gems = this.pixels.filter((p) => p.gem).sort((a, b) => b.brightness - a.brightness);
    for (const gem of gems) {
      if (this.sparkSites.length === 6) break;
      if (this.sparkSites.every((site) => Math.abs(gem.x - site.x) >= 12))
        this.sparkSites.push(gem);
    }
  }

  update(elapsed: number, enabled: boolean): void {
    const phase = (elapsed - 520) % PERIOD;
    const active = enabled && phase >= 0 && phase < SWEEP_MS + SPARK_MS;
    this.graphics.setVisible(active);
    if (!active) {
      this.lastFrame = -1;
      return;
    }
    const frame = Math.floor(phase / FRAME_MS);
    if (frame === this.lastFrame) return;
    this.lastFrame = frame;
    const g = this.graphics.clear();
    const { x: left, y: top, width } = this.image;
    const time = frame * FRAME_MS;
    const span = width + 28;
    const sweepX = -8 + (time / SWEEP_MS) * span;
    for (const p of this.pixels) {
      const distance = sweepX - p.x - p.y * 0.45;
      if (distance < -2 || distance > (p.gem ? 29 : 5)) continue;
      const color = Math.abs(distance) < 1.5 ? P.white : p.color;
      g.fillStyle(color).fillRect(left + p.x, top + p.y, 1, 1);
    }
    for (const p of this.sparkSites) {
      const delay = ((p.x + p.y * 0.45 + 8) / span) * SWEEP_MS;
      const age = time - delay;
      if (age < 0 || age >= SPARK_MS) continue;
      const x = left + p.x;
      const y = top + p.y;
      const radius = age >= 72 && age < 216 ? 2 : 1;
      g.fillStyle(p.color)
        .fillRect(x - radius, y, 2 * radius + 1, 1)
        .fillRect(x, y - radius, 1, 2 * radius + 1)
        .fillStyle(P.white)
        .fillRect(x, y, 1, 1);
    }
  }
}
