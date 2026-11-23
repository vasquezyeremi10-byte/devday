import Phaser from 'phaser';
import type { PPEKind } from '../config/gear';
import {
  composeLook,
  HERO_COLUMNS,
  HERO_FRAME,
  HERO_FRAMES,
  PPE_LAYERS,
} from './MinerCompose';

/**
 * Aspecto del minero según el EPP equipado (V13). Las hojas `miner*` dibujan
 * al minero sin EPP con cada herramienta; `miner-ppe` trae una capa por pieza
 * (scripts/art/build-hero.mjs). `ensureLook` compone la hoja vestida la
 * primera vez que se necesita y la guarda como textura `<hoja>@<máscara>`.
 * Las gafas y los guantes también se dibujan: son EPP como el resto.
 */
export const LOOK_BITS: Record<Exclude<PPEKind, 'ear'>, number> = {
  helmet: 1,
  goggles: 2,
  vest: 4,
  gloves: 8,
  boots: 16,
};
/** Hoja de capas del EPP (bloques de 288 × 192 en el orden de PPE_LAYERS). */
export const PPE_SHEET = 'miner-ppe';
/** Hoja sin herramienta: referencia para recuperar la herramienta al vestir. */
const BARE_SHEET = 'miner-unarmed';

/** Clave de la textura del aspecto; sin EPP es la hoja base. */
export const lookKey = (base: string, mask: number): string =>
  mask ? `${base}@${mask}` : base;
/** Hoja base de una clave (sin el sufijo del aspecto). */
export const baseOf = (key: string) => key.split('@')[0]!;

/** Píxeles RGBA de una textura cargada (se leen una sola vez por escena). */
const pixelCache = new WeakMap<Phaser.Textures.TextureManager, Map<string, ImageData>>();
function pixelsOf(scene: Phaser.Scene, key: string): ImageData {
  let cache = pixelCache.get(scene.textures);
  if (!cache) pixelCache.set(scene.textures, (cache = new Map()));
  const hit = cache.get(key);
  if (hit) return hit;
  const source = scene.textures.get(key).getSourceImage() as CanvasImageSource & {
    width: number;
    height: number;
  };
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  cache.set(key, data);
  return data;
}

/**
 * Textura del minero `base` vestido con el EPP de `mask`. Si falta alguna
 * hoja (carga incompleta) devuelve la base sin EPP en lugar de fallar.
 */
export function ensureLook(
  scene: Phaser.Scene,
  base: string,
  mask: number,
): string {
  const key = lookKey(base, mask);
  const textures = scene.textures;
  if (key === base || textures.exists(key)) return key;
  if (![base, BARE_SHEET, PPE_SHEET].every((k) => textures.exists(k)))
    return base;
  const sheet = pixelsOf(scene, base);
  const bare = pixelsOf(scene, BARE_SHEET);
  const ppe = pixelsOf(scene, PPE_SHEET);
  const block = sheet.data.length;
  const layers = PPE_LAYERS.flatMap((piece, i) =>
    mask & LOOK_BITS[piece]
      ? [ppe.data.subarray(i * block, (i + 1) * block)]
      : [],
  );
  const texture = textures.createCanvas(key, sheet.width, sheet.height);
  if (!texture) return base;
  const out = texture.context.createImageData(sheet.width, sheet.height);
  composeLook(sheet.data, bare.data, layers, out.data);
  texture.context.putImageData(out, 0, 0);
  for (let i = 0; i < HERO_FRAMES; i++)
    texture.add(
      i,
      0,
      (i % HERO_COLUMNS) * HERO_FRAME,
      Math.floor(i / HERO_COLUMNS) * HERO_FRAME,
      HERO_FRAME,
      HERO_FRAME,
    );
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  texture.refresh();
  return key;
}
/** Máscara de aspecto a partir del EPP equipado. */
export function lookMask(equipped: (kind: PPEKind) => boolean): number {
  let mask = 0;
  for (const [kind, bit] of Object.entries(LOOK_BITS))
    if (equipped(kind as PPEKind)) mask |= bit;
  return mask;
}

/** Hoja del minero según la herramienta en mano (la perforadora es aparte). */
export function skinOf(
  tool: { kind: string; durability: number } | undefined,
): string {
  if (!tool || !tool.durability || tool.kind === 'drill') return 'miner-unarmed';
  return tool.kind === 'iron' ? 'miner' : `miner-${tool.kind}`;
}
