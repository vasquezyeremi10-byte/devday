import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { DEPTH } from '../config/layers';
import type { DayNightCycle } from './DayNightCycle';

/**
 * Luz exterior de la hora (V7): tinte multiplicativo parejo sobre los objetos
 * del mundo, sin trama de puntos. Reemplaza el oscurecimiento por dithering
 * del exterior, que de noche se veía como ruido.
 *
 * - Mundo (terreno, estructuras, flora, carro): azul luna de noche, cálido
 *   en el crepúsculo.
 * - Personajes: una versión más suave, para que el minero nunca se pierda.
 * - Fuentes de luz (antorchas, faroles, lámparas, ventana, halos): sin
 *   tinte, así brillan de noche.
 * - Cielo, cordilleras e interfaz no se tocan (tienen sus propios colores).
 *
 * Solo se reaplica cuando el escalón de tinte cambia o aparecen objetos
 * nuevos; los tiles se tiñen en la zona visible de la cámara.
 */
const LIGHT_SOURCE = /lamp|lantern|window|halo|torch|glow/;

export class NightTint {
  private world = 0xffffff;
  private soft = 0xffffff;
  private applied = new WeakMap<object, number>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** ¿El objeto es una fuente de luz que no debe teñirse? */
  private emits(o: Phaser.GameObjects.Image): boolean {
    return (
      LIGHT_SOURCE.test(o.texture.key) || LIGHT_SOURCE.test(String(o.frame.name))
    );
  }

  private paint(o: Phaser.GameObjects.GameObject, tint: number): void {
    if (
      !(o instanceof Phaser.GameObjects.Image) &&
      !(o instanceof Phaser.GameObjects.Sprite)
    )
      return;
    const color = this.emits(o) ? 0xffffff : tint;
    if (this.applied.get(o) === color) return;
    this.applied.set(o, color);
    o.setTint(color);
  }

  update(cycle: DayNightCycle): void {
    const world = cycle.tint(),
      soft = cycle.tint(true);
    const changed = world !== this.world || soft !== this.soft;
    this.world = world;
    this.soft = soft;
    // Los fondos de las zonas traen su propio cuadro de la hora (Backdrop).
    for (const o of this.scene.children.list) {
      const depth = (o as unknown as { depth: number }).depth;
      if (depth < DEPTH.background || depth >= DEPTH.lighting) continue;
      if ((o as unknown as { scrollFactorX: number }).scrollFactorX !== 1)
        continue;
      const tint =
        depth >= DEPTH.characters && depth < DEPTH.machines ? soft : world;
      if (o instanceof Phaser.GameObjects.Container)
        for (const child of o.list) this.paint(child, tint);
      else if (o instanceof Phaser.Tilemaps.TilemapLayer)
        this.tintTiles(o, world, changed);
      else this.paint(o, tint);
    }
  }

  /**
   * Tiles visibles: los recién colocados al excavar nacen sin tinte, así que
   * de noche se repasa la ventana de la cámara (≈1 700 tiles, sin crear nada).
   */
  private tintTiles(
    layer: Phaser.Tilemaps.TilemapLayer,
    tint: number,
    changed: boolean,
  ): void {
    if (tint === 0xffffff && !changed) return;
    const cam = this.scene.cameras.main;
    const x = Math.max(0, Math.floor(cam.scrollX / TILE_SIZE) - 1),
      y = Math.max(0, Math.floor(cam.scrollY / TILE_SIZE) - 1);
    const w = Math.ceil(cam.width / TILE_SIZE) + 3,
      h = Math.ceil(cam.height / TILE_SIZE) + 3;
    // Al cambiar de escalón se tiñe la capa completa (la cámara puede moverse).
    if (changed) layer.setTint(tint);
    else layer.setTint(tint, x, y, w, h);
  }
}
