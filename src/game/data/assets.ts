import type { LayerName } from '../config/layers';
import { ACTION_AUDIO, actionAudioKey } from '../config/actionAudio';
import { WORLD_AUDIO, worldAudioKey } from '../config/worldAudio';
import { GNOME_SHEET } from '../config/gnomeAnimations';

/**
 * Manifiesto único de recursos externos. `preload: false` registra recursos
 * preparados para etapas futuras sin cargarlos al iniciar la escena.
 * Procedencia y licencias: docs/ASSET_CREDITS.md.
 */
export type Asset = { key: string; url: string; preload?: boolean } & (
  | { type: 'image' }
  | { type: 'spritesheet'; frameWidth: number; frameHeight: number }
  | { type: 'atlas'; atlasUrl: string }
  | { type: 'audio' }
  | { type: 'tilemap' }
);
export interface ImageLayer {
  key: string;
  layer: LayerName;
  x: number;
  y: number;
  scrollFactor?: number;
  scrollFactorY?: number;
  /** Orden dentro de una profundidad; útil para varios fondos parallax. */
  order?: number;
  repeatWidth?: number;
  repeatHeight?: number;
}
export interface DecorativeMap {
  key: string;
  tilesets: { name: string; key: string }[];
  layers: { name: string; layer: LayerName }[];
}

/** Efectos PixelFX normalizados por scripts/art/import-assets.mjs. */
export const EFFECTS = {
  'fx-pick-spark': {
    url: 'assets/effects/fx_pick_spark.png',
    frameWidth: 92,
    frameHeight: 57,
    frames: 7,
    fps: 15,
    originX: 0.087,
    originY: 0.965,
  },
  'fx-dust': {
    url: 'assets/effects/fx_dust.png',
    frameWidth: 87,
    frameHeight: 55,
    frames: 12,
    fps: 15,
    originX: 0.54,
    originY: 0.891,
  },
  'fx-collect': {
    url: 'assets/effects/fx_collect.png',
    frameWidth: 70,
    frameHeight: 77,
    frames: 17,
    fps: 15,
    originX: 0.457,
    originY: 0.987,
  },
} as const;
export type EffectKey = keyof typeof EFFECTS;

export const SOUNDS = {
  pick: ['sfx-pick-0', 'sfx-pick-1', 'sfx-pick-2'],
  shovel: ['sfx-shovel-0', 'sfx-shovel-1'],
  collect: ['sfx-collect'],
} as const;

/** URLs relativas a public, por ejemplo assets/backgrounds/background_sky_v01.png. */
export const ASSETS: Asset[] = [
  ...ACTION_AUDIO.map((clip): Asset => ({
    type: 'audio',
    key: actionAudioKey(clip),
    url: `assets/audio/actions/${clip}.${clip.startsWith('step-') || clip.startsWith('jump-') || clip === 'cart-rolling' ? 'ogg' : 'wav'}`,
    preload: false,
  })),
  ...WORLD_AUDIO.map((track): Asset => ({
    type: 'audio',
    key: worldAudioKey(track),
    url: `assets/audio/world/${track}.mp3`,
    preload: false,
  })),
  // Introducción del estudio (StudioIntroScene; ver config/splash.ts). Logo
  // aportado por el estudio THE MINERS CL; sonidos originales generados por
  // scripts/audio/build-intro-sfx.mjs.
  {
    type: 'spritesheet',
    key: 'studio-logo',
    url: 'assets/ui/studio-logo.png',
    frameWidth: 212,
    frameHeight: 212,
    preload: false,
  },
  {
    type: 'audio',
    key: 'sfx-intro-impact',
    url: 'assets/audio/intro-impact.wav',
    preload: false,
  },
  {
    type: 'audio',
    key: 'sfx-intro-chime',
    url: 'assets/audio/intro-chime.wav',
    preload: false,
  },
  {
    type: 'audio',
    key: 'sfx-intro-ambience',
    url: 'assets/audio/intro-ambience.wav',
    preload: false,
  },
  // Sonidos del menú (MENU_FX en config/menu.ts), originales y diferidos.
  {
    type: 'audio',
    key: 'sfx-ui-move',
    url: 'assets/audio/ui-move.wav',
    preload: false,
  },
  {
    type: 'audio',
    key: 'sfx-ui-confirm',
    url: 'assets/audio/ui-confirm.wav',
    preload: false,
  },
  {
    type: 'audio',
    key: 'sfx-ui-back',
    url: 'assets/audio/ui-back.wav',
    preload: false,
  },
  {
    // Música del menú principal (MENU_MUSIC); la carga MenuScene al abrirse.
    type: 'audio',
    key: 'music-menu',
    url: 'assets/audio/menu-theme.mp3',
    preload: false,
  },
  {
    type: 'audio',
    key: 'sfx-ventilation',
    url: 'assets/audio/ventilation-loop.wav',
    preload: false,
  },
  {
    type: 'spritesheet',
    key: 'miner-shovel',
    url: 'assets/characters/player/hero_shovel.png',
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    type: 'spritesheet',
    key: 'miner-unarmed',
    url: 'assets/characters/player/hero_unarmed.png',
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    type: 'spritesheet',
    key: 'interaction-items',
    url: 'assets/interactions/items.png',
    frameWidth: 16,
    frameHeight: 16,
  },
  {
    type: 'spritesheet',
    key: 'miner-tungsten',
    url: 'assets/characters/player/hero_tungsten.png',
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    type: 'spritesheet',
    key: 'miner-axe',
    url: 'assets/characters/player/hero_axe.png',
    frameWidth: 32,
    frameHeight: 32,
  },
  // V13: minero dibujado por código (scripts/art/build-hero.mjs), una hoja
  // por herramienta sin EPP; `miner-ppe` trae las capas de casco, gafas,
  // chaleco, guantes y botas que entities/MinerLook.ts compone encima.
  {
    type: 'spritesheet',
    key: 'miner',
    url: 'assets/characters/player/hero.png',
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    type: 'image',
    key: 'miner-ppe',
    url: 'assets/characters/player/hero_ppe.png',
  },
  // Gnomo minero (PNG 32 × 32 aportado, animado por scripts/art/build-gnome.mjs).
  {
    type: 'spritesheet',
    key: GNOME_SHEET.key,
    url: GNOME_SHEET.url,
    frameWidth: GNOME_SHEET.frameWidth,
    frameHeight: GNOME_SHEET.frameHeight,
  },
  {
    type: 'atlas',
    key: 'props',
    url: 'assets/structures/props.png',
    atlasUrl: 'assets/structures/props.json',
  },
  {
    type: 'atlas',
    key: 'equipment',
    url: 'assets/machinery/equipment.png',
    atlasUrl: 'assets/machinery/equipment.json',
    preload: false,
  },
  {
    type: 'spritesheet',
    key: 'ore-veins',
    url: 'assets/environments/minerals/ore_veins.png',
    frameWidth: 16,
    frameHeight: 16,
  },
  {
    type: 'spritesheet',
    key: 'mineral-items',
    url: 'assets/environments/minerals/mineral_items.png',
    frameWidth: 16,
    frameHeight: 16,
  },
  {
    type: 'spritesheet',
    key: 'torch',
    url: 'assets/environments/underground/torch.png',
    frameWidth: 8,
    frameHeight: 16,
  },
  ...Object.entries(EFFECTS).map(([key, fx]): Asset => ({
    type: 'spritesheet',
    key,
    url: fx.url,
    frameWidth: fx.frameWidth,
    frameHeight: fx.frameHeight,
  })),
  // Menú principal: bocamina y barrera de niebla, 480 × 270.
  { type: 'image', key: 'menu-bg', url: 'assets/ui/menu-bg-portal.png' },
  { type: 'image', key: 'menu-title-veta', url: 'assets/ui/menu-title-veta.png', preload: false },
  // Los fondos CraftPix de V9 se retiraron el 18 de noviembre de 2026: todo
  // el mundo es desierto, con fondos dibujados por código (world/Backdrop.ts).
  {
    type: 'audio',
    key: 'sfx-pick-0',
    url: 'assets/audio/impactMining_000.ogg',
  },
  {
    type: 'audio',
    key: 'sfx-pick-1',
    url: 'assets/audio/impactMining_001.ogg',
  },
  {
    type: 'audio',
    key: 'sfx-pick-2',
    url: 'assets/audio/impactMining_002.ogg',
  },
  {
    type: 'audio',
    key: 'sfx-shovel-0',
    url: 'assets/audio/impactSoft_medium_000.ogg',
  },
  {
    type: 'audio',
    key: 'sfx-shovel-1',
    url: 'assets/audio/impactSoft_medium_001.ogg',
  },
  {
    type: 'audio',
    key: 'sfx-collect',
    url: 'assets/audio/impactGlass_light_002.ogg',
  },
];
/** Desactivar al integrar los PNG de cielo, montañas y pared subterránea. */
export const USE_PLACEHOLDER_BACKGROUNDS = true;
export const IMAGE_LAYERS: ImageLayer[] = [];
export const DECORATIVE_MAPS: DecorativeMap[] = [];
