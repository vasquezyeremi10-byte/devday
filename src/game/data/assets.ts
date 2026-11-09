import type { LayerName } from '../config/layers';

export type Asset =
  | { type: 'image'; key: string; url: string }
  | {
      type: 'spritesheet';
      key: string;
      url: string;
      frameWidth: number;
      frameHeight: number;
    }
  | { type: 'tilemap'; key: string; url: string };
export interface ImageLayer {
  key: string;
  layer: LayerName;
  x: number;
  y: number;
  scrollFactor?: number;
}
export interface DecorativeMap {
  key: string;
  tilesets: { name: string; key: string }[];
  layers: { name: string; layer: LayerName }[];
}

/** URLs relativas a public, por ejemplo assets/backgrounds/background_sky_v01.png. */
export const ASSETS: Asset[] = [];
export const IMAGE_LAYERS: ImageLayer[] = [];
export const DECORATIVE_MAPS: DecorativeMap[] = [];
