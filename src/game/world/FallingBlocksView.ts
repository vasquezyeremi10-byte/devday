import type Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { DEPTH } from '../config/layers';
import type { FallingBlocks } from '../systems/FallingBlocks';
import { TerrainFrame } from './TerrainVisuals';

/**
 * Dibujo de los bloques desprendidos. No decide nada: proyecta la posición
 * que calcula `FallingBlocks`. Cada bloque conserva el cuadro del tileset con
 * que se veía en el techo (pixel art intacto, en píxeles enteros); mientras
 * se afloja tiembla un píxel hacia los lados y después cae.
 *
 * Las imágenes se reutilizan: un derrumbe no crea ni destruye objetos una vez
 * que la reserva alcanzó el tamaño del derrumbe más grande.
 */
export class FallingBlocksView {
  private readonly live = new Map<number, Phaser.GameObjects.Image>();
  private readonly pool: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** Imágenes en uso y en reserva (diagnóstico para pruebas). */
  get counts(): { live: number; pooled: number } {
    return { live: this.live.size, pooled: this.pool.length };
  }

  update(falling: FallingBlocks, now: number): void {
    if (!falling.blocks.length && !this.live.size) return;
    const seen = new Set<number>();
    for (const b of falling.blocks) {
      seen.add(b.id);
      let image = this.live.get(b.id);
      if (!image) {
        image =
          this.pool.pop() ??
          this.scene.add
            .image(0, 0, 'terrain', TerrainFrame.Rubble)
            .setOrigin(0)
            // Sobre el terreno y sus bordes; bajo estructuras y personajes.
            .setDepth(DEPTH.terrain + 2.5);
        image
          .setFrame(b.frame >= 0 ? b.frame : TerrainFrame.Rubble)
          .setVisible(true);
        this.live.set(b.id, image);
      }
      // Aflojándose: tiembla un píxel, desfasado por bloque.
      const shake =
        b.delay > 0 ? ((Math.floor(now / 45) + b.id) % 2 ? 1 : -1) : 0;
      image.setPosition(b.column * TILE_SIZE + shake, Math.round(b.y));
    }
    for (const [id, image] of this.live) {
      if (seen.has(id)) continue;
      image.setVisible(false);
      this.live.delete(id);
      this.pool.push(image);
    }
  }
}
