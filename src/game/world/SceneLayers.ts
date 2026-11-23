import Phaser from 'phaser';
import { DEPTH } from '../config/layers';
import {
  DECORATIVE_MAPS,
  IMAGE_LAYERS,
  type DecorativeMap,
} from '../data/assets';

/** Los mapas decorativos nunca se incorporan al grupo de colisión. */
export function mountDecorativeMap(
  scene: Phaser.Scene,
  definition: DecorativeMap,
): void {
  const map = scene.make.tilemap({ key: definition.key });
  const tilesets = definition.tilesets.map(({ name, key }) => {
    const tileset = map.addTilesetImage(name, key);
    if (!tileset) throw new Error(`Tileset no encontrado: ${name}`);
    return tileset;
  });
  for (const item of definition.layers) {
    if (item.layer === 'terrain')
      throw new Error('El terreno jugable se importa mediante TerrainGrid');
    const layer = map.createLayer(item.name, tilesets);
    if (!layer) throw new Error(`Capa no encontrada: ${item.name}`);
    layer.setDepth(DEPTH[item.layer]);
  }
}

export function mountAssetLayers(scene: Phaser.Scene): void {
  for (const item of IMAGE_LAYERS) {
    if (item.layer === 'terrain')
      throw new Error('Una imagen decorativa no puede ser terreno');
    scene.textures.get(item.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const image = item.repeatWidth
      ? scene.add.tileSprite(
          item.x,
          item.y,
          item.repeatWidth,
          item.repeatHeight ?? scene.textures.getFrame(item.key).height,
          item.key,
        )
      : scene.add.image(item.x, item.y, item.key);
    image
      .setOrigin(0)
      .setDepth(DEPTH[item.layer] + (item.order ?? 0))
      .setScrollFactor(
        item.scrollFactor ?? 1,
        item.scrollFactorY ?? item.scrollFactor ?? 1,
      );
  }
  DECORATIVE_MAPS.forEach((map) => mountDecorativeMap(scene, map));
}
