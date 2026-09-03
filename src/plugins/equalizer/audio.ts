import {
  EQUALIZER_BAND_COUNT,
  EQUALIZER_FREQUENCIES,
  EQUALIZER_Q,
} from './presets';

// NOTE: Only one DSP plugin (equalizer / audio-compressor) can own the
// source -> destination path at a time. Enabling both will mix their outputs,
// so keep only one of them enabled.
let audioContext: AudioContext | null = null;
let audioSource: MediaElementAudioSourceNode | null = null;
let filters: BiquadFilterNode[] = [];
let ownsOutput = false;

const disconnectQuietly = (fn: () => void) => {
  try {
    fn();
  } catch {
    // Already disconnected (or owned by another plugin)
  }
};

export const setEqualizerGains = (gains: readonly number[]) => {
  filters.forEach((filter, index) => {
    const gain = gains[index] ?? 0;
    if (filter.gain.value !== gain) {
      filter.gain.setTargetAtTime(gain, audioContext?.currentTime ?? 0, 0.015);
    }
  });
};

export const attachEqualizer = (
  context: AudioContext,
  source: MediaElementAudioSourceNode,
  gains: readonly number[],
) => {
  if (source === audioSource && filters.length === EQUALIZER_BAND_COUNT) {
    setEqualizerGains(gains);
    return;
  }

  detachEqualizer();

  audioContext = context;
  audioSource = source;

  // Take over the direct path so dry + wet signals are not mixed
  ownsOutput = true;
  disconnectQuietly(() => source.disconnect(context.destination));

  let head: AudioNode = source;
  for (let index = 0; index < EQUALIZER_BAND_COUNT; index++) {
    const filter = context.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = EQUALIZER_FREQUENCIES[index];
    filter.Q.value = EQUALIZER_Q;
    filter.gain.value = gains[index] ?? 0;
    head.connect(filter);
    head = filter;
    filters.push(filter);
  }
  head.connect(context.destination);
};

export const detachEqualizer = () => {
  if (filters.length === 0) {
    audioContext = null;
    audioSource = null;
    return;
  }

  const context = audioContext;
  const source = audioSource;

  for (const filter of filters) {
    disconnectQuietly(() => filter.disconnect());
  }
  filters = [];

  if (source && context) {
    disconnectQuietly(() => source.disconnect());
    if (ownsOutput) {
      try {
        source.connect(context.destination);
      } catch {
        // Destination already connected by another plugin
      }
    }
  }

  ownsOutput = false;
  audioContext = null;
  audioSource = null;
};
