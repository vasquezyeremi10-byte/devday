import Phaser from 'phaser';
import { biomeBlend, BIOMES, type BiomeId } from '../config/biomes';
import { VIEW } from '../config/constants';
import { DEPTH } from '../config/layers';
import type { BackdropLayer } from './Backdrop';

/**
 * Las imágenes visibles ocupan posiciones fijas en su plano de parallax.
 * Los bordes de cada textura comparten la silueta y el dibujo de su vecina.
 */
export class BiomeBackdrop {
  private readonly images = new Map<string, Phaser.GameObjects.Image>();
  private scrollX = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: () => BackdropLayer[],
  ) {}

  update(cam: Phaser.Cameras.Scene2D.Camera): void {
    this.scrollX = Math.round(cam.scrollX);
    // Tramos del oeste que se dibujan a demanda: uno por cuadro cuando está a
    // menos de dos vistas de entrar, así ya existe al aparecer.
    let prefetched = false;
    for (const layer of this.layers()) {
      const shift = Math.round(layer.factor * this.scrollX);
      const x = layer.anchor - shift;
      let image = this.images.get(layer.key);
      const covered = layer.revealFrom !== undefined && shift + VIEW.width <= layer.revealFrom;
      if (covered || x >= VIEW.width || x + layer.width <= 0) {
        if (
          layer.prepare &&
          !prefetched &&
          x < VIEW.width * 3 &&
          x + layer.width > -VIEW.width * 2
        ) {
          layer.prepare();
          prefetched = true;
        }
        image?.setVisible(false);
        continue;
      }
      if (!image) {
        // Si llegó a la vista sin dibujarse (salto de cámara), se dibuja ya.
        layer.prepare?.();
        image = this.scene.add
          .image(x, layer.top, layer.key, layer.frame)
          .setOrigin(0)
          .setScrollFactor(0)
          .setDepth(DEPTH.background + layer.depth);
        this.images.set(layer.key, image);
      }
      if (Number(image.frame.name) !== layer.frame) image.setFrame(layer.frame);
      image.setX(x).setVisible(true);
    }
  }

  /** Zona bajo el centro de la cámara y fracción de la vecina (diagnóstico). */
  blend(): { left: BiomeId; right: BiomeId | null; t: number } {
    const { a, t } = biomeBlend(this.scrollX + VIEW.width / 2);
    return {
      left: BIOMES[a]!.id,
      right: t > 0 ? BIOMES[a + 1]!.id : null,
      t,
    };
  }

  /** Capas visibles y su x en pantalla (diagnóstico). */
  stamped(): { key: string; x: number }[] {
    return [...this.images.values()]
      .filter((image) => image.visible)
      .map(({ texture, x }) => ({ key: texture.key, x }));
  }
}
