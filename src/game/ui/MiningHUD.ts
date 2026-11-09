import type Phaser from 'phaser';
import { DEPTH } from '../config/layers';
import type { MiningResult } from '../systems/MiningSystem';

const LABELS: Record<MiningResult, string> = {
  ready: 'CLIC · EXCAVAR',
  outside: 'FUERA DE LA MINA',
  empty: 'APUNTA A UN BLOQUE',
  protected: 'LECHO PROTEGIDO',
  far: 'ACÉRCATE AL BLOQUE',
  occluded: 'BLOQUE OBSTRUIDO',
};

export class MiningHUD {
  private readonly depthLabel: Phaser.GameObjects.Text;
  private readonly targetLabel: Phaser.GameObjects.Text;
  private readonly blocksLabel: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene) {
    scene.add
      .rectangle(10, 10, 95, 21, 0x20262c, 0.94)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH.ui);
    scene.add
      .rectangle(0, 249, 480, 21, 0x20262c, 0.96)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH.ui);
    const text = (x: number, y: number, value: string, color = '#c4bfb0') =>
      scene.add
        .text(x, y, value, { fontFamily: 'monospace', fontSize: '8px', color })
        .setScrollFactor(0)
        .setDepth(DEPTH.ui + 1);
    this.depthLabel = text(18, 17, 'NIVEL  00 m', '#f0cf8b');
    this.targetLabel = text(10, 256, 'APUNTA A UN BLOQUE');
    this.blocksLabel = text(470, 256, 'BLOQUES 000').setOrigin(1, 0);
  }

  update(y: number, count: number, result: MiningResult): void {
    this.depthLabel.setText(
      `NIVEL  ${Math.max(0, Math.floor((y - 160) / 16))
        .toString()
        .padStart(2, '0')} m`,
    );
    this.targetLabel
      .setText(LABELS[result])
      .setColor(result === 'ready' ? '#f0cf8b' : '#c4bfb0');
    this.blocksLabel.setText(`BLOQUES ${count.toString().padStart(3, '0')}`);
  }
}
