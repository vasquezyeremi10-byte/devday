import type { BiomeId } from './biomes';

export const WORLD_AUDIO_LOOPS = [
  'surface',
  'mine',
  'birds',
  'wind',
  'cave',
  'surf',
] as const;
export const WORLD_AUDIO = [...WORLD_AUDIO_LOOPS, 'chirps'] as const;

export const worldAudioKey = (track: (typeof WORLD_AUDIO)[number]): string =>
  `world-audio-${track}`;

// Ganancias máximas del viento, las aves y la rompiente por bioma.
export const OUTDOOR_AUDIO: Record<BiomeId, readonly [number, number, number]> =
  {
    // Todo es desierto: viento seco, sin el coro de aves de los bosques de
    // V9. Solo La Portada suma oleaje y algunas gaviotas.
    salar: [0.22, 0, 0],
    moon: [0.24, 0, 0],
    sierra: [0.16, 0, 0],
    paranal: [0.26, 0.01, 0],
    hand: [0.18, 0, 0],
    desert: [0.15, 0, 0],
    pampa: [0.17, 0, 0],
    fcab: [0.15, 0, 0],
    huanchaca: [0.17, 0, 0],
    hills: [0.28, 0.02, 0],
    portada: [0.09, 0.04, 0.27],
  };
