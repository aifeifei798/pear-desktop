export const EQUALIZER_FREQUENCIES = [
  32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const;

export const EQUALIZER_BAND_COUNT = EQUALIZER_FREQUENCIES.length;

export const EQUALIZER_MIN_GAIN = -12;

export const EQUALIZER_MAX_GAIN = 12;

export const EQUALIZER_GAIN_STEP = 0.5;

export const EQUALIZER_Q = 1;

export const equalizerPresetNames = [
  'flat',
  'bass-booster',
  'treble-booster',
  'vocal',
  'pop',
  'rock',
  'jazz',
  'classical',
  'electronic',
  'hip-hop',
] as const;

export type EqualizerPresetName = (typeof equalizerPresetNames)[number];

export const FLAT_PRESET: EqualizerPresetName = 'flat';

export const equalizerPresets: Record<EqualizerPresetName, readonly number[]> =
  {
    'flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'bass-booster': [7, 6, 4, 2, 1, 0, 0, 0, 0, 0],
    'treble-booster': [0, 0, 0, 0, 0, 1, 2, 4, 6, 7],
    'vocal': [-1, 0, 1, 2, 3, 4, 4, 2, 0, -1],
    'pop': [-2, -1, 0, 2, 4, 4, 2, 0, 1, 2],
    'rock': [4, 3, 2, 1, 0, -1, 0, 1, 3, 4],
    'jazz': [3, 2, 1, 0, 0, 1, 2, 3, 4, 3],
    'classical': [4, 3, 2, 0, -1, -1, 0, 2, 3, 4],
    'electronic': [4, 3, 2, 0, 0, 1, 2, 3, 4, 4],
    'hip-hop': [5, 4, 3, 1, 0, 0, 1, 2, 3, 3],
  };

export const flatGains = (): number[] => [...equalizerPresets[FLAT_PRESET]];

export const presetGains = (preset: string): number[] => {
  const found = (equalizerPresets as Record<string, readonly number[]>)[preset];
  return found ? [...found] : flatGains();
};

export const isKnownPreset = (preset: string): preset is EqualizerPresetName =>
  (equalizerPresetNames as readonly string[]).includes(preset);
