import Phaser from 'phaser';
import {
  COVER_TILE_PX,
  DISSOLVE_LEVELS,
  coverMask,
  dissolveLevel,
} from '../world/Dissolve';

/**
 * Cortina tramada de un color plano: tapa una zona con un porcentaje de
 * píxeles opacos (alfa 0/255, nunca parcial). Sirve para fundidos «a negro» y
 * para revelar la pantalla sin transparencias. Cada nivel es una baldosa de
 * 32 × 32 px que se crea una sola vez por color y se repite con un TileSprite.
 */
export class DitherCover {
  readonly sprite: Phaser.GameObjects.TileSprite;
  private level = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    private readonly color: number,
    depth: number,
  ) {
    this.sprite = scene.add
      .tileSprite(x, y, w, h, DitherCover.textureFor(scene, color, DISSOLVE_LEVELS))
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(depth);
    this.set(1);
  }

  /** Clave de la baldosa del nivel; se genera la primera vez que se pide. */
  static textureFor(scene: Phaser.Scene, color: number, level: number): string {
    const key = `dither-cover-${color.toString(16)}-${level}`;
    if (scene.textures.exists(key)) return key;
    const texture = scene.textures.createCanvas(key, COVER_TILE_PX, COVER_TILE_PX)!;
    const ctx = texture.context;
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    const mask = coverMask(level);
    for (let i = 0; i < mask.length; i++)
      if (mask[i]) ctx.fillRect(i % COVER_TILE_PX, Math.floor(i / COVER_TILE_PX), 1, 1);
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return key;
  }

  /** Cobertura 0..1 (0 = no tapa, 1 = color pleno). */
  set(fraction: number): this {
    const level = dissolveLevel(fraction);
    if (level === this.level) return this;
    this.level = level;
    this.sprite.setVisible(level > 0);
    if (level > 0)
      this.sprite.setTexture(DitherCover.textureFor(this.scene, this.color, level));
    return this;
  }

  get coverage(): number {
    return this.level / DISSOLVE_LEVELS;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
