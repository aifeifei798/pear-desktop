import { For, Show, createSignal } from 'solid-js';
import { render } from 'solid-js/web';

import { t } from '@/i18n';

import {
  EQUALIZER_FREQUENCIES,
  EQUALIZER_GAIN_STEP,
  EQUALIZER_MAX_GAIN,
  EQUALIZER_MIN_GAIN,
  FLAT_PRESET,
  equalizerPresetNames,
} from './presets';

export interface EqualizerUIHooks {
  onLiveGains: (gains: number[]) => void;
  onCommitGains: (gains: number[]) => void;
  onPresetSelect: (preset: string) => void;
}

const [gains, setGains] = createSignal<number[]>([]);
const [preset, setPreset] = createSignal<string>(FLAT_PRESET);
const [visible, setVisible] = createSignal(false);

let hooks: EqualizerUIHooks | null = null;
let disposers: (() => void)[] = [];
let containers: HTMLElement[] = [];

const formatFrequency = (freq: number) =>
  freq >= 1000 ? `${freq / 1000}k` : `${freq}`;

const formatGain = (gain: number) => `${gain > 0 ? '+' : ''}${gain}dB`;

const handleGainInput = (index: number, value: number) => {
  const next = [...gains()];
  next[index] = value;
  setGains(next);
  setPreset('custom');
  hooks?.onLiveGains(next);
};

const handleGainCommit = () => {
  hooks?.onCommitGains([...gains()]);
};

const EqualizerButton = () => (
  <yt-icon-button
    aria-disabled={false}
    aria-label={t('plugins.equalizer.renderer.button.label')}
    class="player-equalizer-button style-scope ytmusic-player"
    icon={'yt-icons:tune'}
    on:click={() => setVisible(!visible())}
    role={'button'}
    tabindex={0}
    title={t('plugins.equalizer.renderer.button.label')}
  >
    <span class="yt-icon-shape style-scope yt-icon yt-spec-icon-shape">
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          fill: 'currentcolor',
        }}
      >
        <svg
          class="style-scope yt-icon"
          preserveAspectRatio="xMidYMid meet"
          style={{
            'pointer-events': 'none',
            'display': 'block',
            'width': '100%',
            'height': '100%',
          }}
          viewBox="0 0 24 24"
        >
          <g class="style-scope yt-icon">
            <path
              class="style-scope yt-icon"
              d="M3 5h2v14H3zM7 5h2v7H7zM11 5h2v4h-2zM15 5h2v10h-2zM19 5h2v14h-2zM1 3v2h4V3zm6 4v2h4V7zm6-4v2h4V3zm4 8v2h4v-2zM1 15v2h4v-2zm10 2v2h4v-2z"
            />
          </g>
        </svg>
      </div>
    </span>
  </yt-icon-button>
);

const EqualizerPanel = () => (
  <Show when={visible()}>
    <div class="peard-eq-panel">
      <div class="peard-eq-panel-header">
        <span>{t('plugins.equalizer.renderer.panel.title')}</span>
        <button
          class="peard-eq-panel-close"
          onClick={() => setVisible(false)}
          type="button"
        >
          ✕
        </button>
      </div>
      <div class="peard-eq-preset-row">
        <span>{t('plugins.equalizer.renderer.panel.preset')}</span>
        <select
          class="peard-eq-preset-select"
          onChange={(event) => hooks?.onPresetSelect(event.currentTarget.value)}
          value={preset()}
        >
          <For each={equalizerPresetNames}>
            {(name) => (
              <option value={name}>
                {t(`plugins.equalizer.menu.presets.list.${name}`)}
              </option>
            )}
          </For>
          <option value="custom">
            {t('plugins.equalizer.menu.presets.list.custom')}
          </option>
        </select>
        <button
          class="peard-eq-reset"
          onClick={() => hooks?.onPresetSelect(FLAT_PRESET)}
          type="button"
        >
          {t('plugins.equalizer.renderer.panel.reset')}
        </button>
      </div>
      <For each={EQUALIZER_FREQUENCIES}>
        {(freq, index) => (
          <div class="peard-eq-band">
            <span class="peard-eq-freq">{formatFrequency(freq)}</span>
            <input
              max={EQUALIZER_MAX_GAIN}
              min={EQUALIZER_MIN_GAIN}
              onChange={handleGainCommit}
              onInput={(event) =>
                handleGainInput(index(), Number(event.currentTarget.value))
              }
              step={EQUALIZER_GAIN_STEP}
              type="range"
              value={gains()[index()] ?? 0}
            />
            <span class="peard-eq-gain">
              {formatGain(gains()[index()] ?? 0)}
            </span>
          </div>
        )}
      </For>
    </div>
  </Show>
);

export const mountEqualizerUI = (
  initialGains: number[],
  initialPreset: string,
  uiHooks: EqualizerUIHooks,
) => {
  if (disposers.length > 0) {
    return;
  }

  hooks = uiHooks;
  setGains([...initialGains]);
  setPreset(initialPreset);
  setVisible(false);

  const buttonContainer = document.createElement('div');
  const panelContainer = document.createElement('div');
  containers = [buttonContainer, panelContainer];

  disposers = [
    render(() => <EqualizerButton />, buttonContainer),
    render(() => <EqualizerPanel />, panelContainer),
  ];

  document
    .querySelector('.top-row-buttons.ytmusic-player')
    ?.prepend(buttonContainer);
  document.body.append(panelContainer);
};

export const syncEqualizerUI = (nextGains: number[], nextPreset: string) => {
  setGains([...nextGains]);
  setPreset(nextPreset);
};

export const unmountEqualizerUI = () => {
  for (const dispose of disposers) {
    dispose();
  }
  disposers = [];

  for (const container of containers) {
    container.remove();
  }
  containers = [];

  hooks = null;
};
