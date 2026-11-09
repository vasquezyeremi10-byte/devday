import type Phaser from 'phaser';
import { ASSETS } from '../data/assets';

export function queueAssets(scene: Phaser.Scene): void {
  for (const asset of ASSETS) {
    const url = `${import.meta.env.BASE_URL}${asset.url}`;
    if (asset.type === 'image') scene.load.image(asset.key, url);
    else if (asset.type === 'spritesheet')
      scene.load.spritesheet(asset.key, url, {
        frameWidth: asset.frameWidth,
        frameHeight: asset.frameHeight,
      });
    else scene.load.tilemapTiledJSON(asset.key, url);
  }
}
