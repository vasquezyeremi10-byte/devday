export const STEP_SOUNDS = {
  dirt: ['step-dirt-1', 'step-dirt-2', 'step-dirt-3'],
  gravel: ['step-gravel-1', 'step-gravel-2', 'step-gravel-3'],
  stone: ['step-stone-1', 'step-stone-2', 'step-stone-3'],
  metal: ['step-metal-1', 'step-metal-2', 'step-metal-3'],
  wood: ['step-wood-1', 'step-wood-2', 'step-wood-3'],
  leaves: ['step-leaves-1', 'step-leaves-2', 'step-leaves-3'],
} as const;

export type StepSurface = keyof typeof STEP_SOUNDS;

export const JUMP_SOUNDS = ['jump-hu-1', 'jump-hu-2'] as const;

export const ACTION_AUDIO = [
  ...Object.values(STEP_SOUNDS).flat(),
  ...JUMP_SOUNDS,
  'eat',
  'drink',
  'cart-rolling',
] as const;

export const actionAudioKey = (clip: (typeof ACTION_AUDIO)[number]): string =>
  `sfx-${clip}`;

export const ACTION_AUDIO_KEYS = ACTION_AUDIO.map(actionAudioKey);
