import Phaser from 'phaser';
import { DEPTH } from '../config/layers';
import { PALETTE as P } from '../config/palette';

/** Niebla opaca por capas: píxeles enteros, sin transparencia ni desenfoque. */
export class FogPortal {
  private readonly fog: Phaser.GameObjects.Graphics;
  private intensity = 0;

  constructor(
    scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    private readonly width = 22,
    private readonly height = 42,
    depth = DEPTH.structures + 2,
  ) {
    this.fog = scene.add.graphics().setDepth(depth);
  }

  setIntensity(value: number): void {
    this.intensity = Phaser.Math.Clamp(value, 0, 1);
  }

  update(time: number): void {
    const g = this.fog;
    const pulse = Math.floor(time / 180) % 4;
    const boost = Math.round(this.intensity * 6);
    g.clear();
    // Marco rocoso oscuro: la niebla queda contenida en una boca vertical.
    g.fillStyle(P.ink).fillRect(this.x - this.width / 2 - 2, this.y - this.height - 2, this.width + 4, this.height + 4);
    g.fillStyle(P.night).fillRect(this.x - this.width / 2, this.y - this.height, this.width, this.height);
    for (let layer = 0; layer < 3; layer++) {
      const color = layer === 0 ? P.indigo : layer === 1 ? P.duskViolet : P.mauve;
      const offset = ((Math.floor(time / (110 + layer * 55)) + layer * 7) % 7) - 3;
      const base = this.y - this.height + layer * 5;
      for (let row = 0; row < 8; row++) {
        const y = base + row * 5;
        const half = Math.max(4, Math.floor(this.width / 2) - Math.abs(row - 3) + boost);
        const wobble = ((row * 3 + pulse + layer) % 5) - 2;
        const w = half * 2 - ((row + layer) % 3 === 0 ? 3 : 0);
        g.fillStyle(color).fillRect(Math.round(this.x - half + offset + wobble), y, w, 2);
        if ((row + pulse + layer) % 2 === 0)
          g.fillStyle(P.violet).fillRect(Math.round(this.x + half - 4 + offset), y + 2, 2, 1);
      }
    }
    // Mota y chispa: se regeneran por fase, sin crear objetos por cuadro.
    for (let i = 0; i < 12; i++) {
      const phase = (time / (500 + i * 37) + i * 1.73) % 1;
      const angle = i * 2.4 + phase * 2;
      const radius = 8 + ((i * 7) % 12) + boost;
      const x = Math.round(this.x + Math.sin(angle) * radius);
      const y = Math.round(this.y - this.height / 2 + Math.cos(angle * 1.7) * (8 + (i % 5) * 3) - phase * 8);
      if ((i + pulse) % 4 === 0 && !this.intensity) continue;
      g.fillStyle(i % 3 === 0 ? P.mist : i % 2 ? P.violet : P.duskViolet).fillRect(x, y, i % 5 === 0 ? 2 : 1, 1);
    }
  }

  destroy(): void {
    this.fog.destroy();
  }
}
