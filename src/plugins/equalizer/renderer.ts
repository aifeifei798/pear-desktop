import { debounce } from '@/providers/decorators';

import { attachEqualizer, detachEqualizer, setEqualizerGains } from './audio';
import { mountEqualizerUI, syncEqualizerUI, unmountEqualizerUI } from './panel';
import {
  EQUALIZER_BAND_COUNT,
  EQUALIZER_MAX_GAIN,
  EQUALIZER_MIN_GAIN,
  FLAT_PRESET,
  flatGains,
  presetGains,
} from './presets';

import type { EqualizerPluginConfig } from './index';
import type { RendererContext } from '@/types/contexts';
import type { MusicPlayer } from '@/types/music-player';

let context: RendererContext<EqualizerPluginConfig> | null = null;
let gains: number[] = flatGains();
let preset: string = FLAT_PRESET;

const normalizeGains = (value: unknown): number[] => {
  const next = flatGains();
  if (!Array.isArray(value)) {
    return next;
  }

  for (
    let index = 0;
    index < Math.min(value.length, EQUALIZER_BAND_COUNT);
    index++
  ) {
    const parsed = Number(value[index]);
    if (Number.isFinite(parsed)) {
      next[index] = Math.min(
        EQUALIZER_MAX_GAIN,
        Math.max(EQUALIZER_MIN_GAIN, parsed),
      );
    }
  }

  return next;
};

const persistGains = debounce((next: number[]) => {
  context?.setConfig({ gains: next, preset: 'custom' });
}, 500);

const onAudioCanPlay = (event: CustomEvent<Compressor>) => {
  attachEqualizer(event.detail.audioContext, event.detail.audioSource, gains);
};

export const onRendererStart = () => {
  document.addEventListener('peard:audio-can-play', onAudioCanPlay, {
    passive: true,
  });
};

export const onRendererStop = () => {
  document.removeEventListener('peard:audio-can-play', onAudioCanPlay);
  unmountEqualizerUI();
  detachEqualizer();
  context = null;
};

export const onPlayerApiReady = async (
  _api: MusicPlayer,
  ctx: RendererContext<EqualizerPluginConfig>,
) => {
  context = ctx;

  const config = await ctx.getConfig();
  gains = normalizeGains(config.gains);
  preset = typeof config.preset === 'string' ? config.preset : FLAT_PRESET;

  mountEqualizerUI(gains, preset, {
    onLiveGains: (next) => {
      gains = normalizeGains(next);
      setEqualizerGains(gains);
    },
    onCommitGains: (next) => {
      gains = normalizeGains(next);
      preset = 'custom';
      syncEqualizerUI(gains, preset);
      persistGains(gains);
    },
    onPresetSelect: (name) => {
      ctx.setConfig({ preset: name, gains: presetGains(name) });
    },
  });
};

export const onConfigChange = (newConfig: EqualizerPluginConfig) => {
  gains = normalizeGains(newConfig.gains);
  preset =
    typeof newConfig.preset === 'string' ? newConfig.preset : FLAT_PRESET;
  setEqualizerGains(gains);
  syncEqualizerUI(gains, preset);
};
