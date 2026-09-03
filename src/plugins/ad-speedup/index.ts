import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import type { MenuTemplate } from '@/menu';
import type { RendererContext } from '@/types/contexts';
import type { MusicPlayer } from '@/types/music-player';

export type AdSpeedupPluginConfig = {
  enabled: boolean;
  speed: number;
  muteAudio: boolean;
  autoSkip: boolean;
};

const ADVERT_CLASSES = ['ad-showing', 'ad-interrupting'];

const SKIP_BUTTON_SELECTORS = [
  'button.ytp-ad-skip-button-modern',
  'button.ytp-ad-skip-button',
  'button.ytp-skip-ad-button',
];

const SPEEDS = [2, 4, 8, 16];

const clickSkipButtons = (player: Element) => {
  for (const selector of SKIP_BUTTON_SELECTORS) {
    const button = player.querySelector<HTMLButtonElement>(selector);
    if (button && !button.disabled) {
      button.click();
    }
  }
};

let observer: MutationObserver | null = null;
let activeConfig: AdSpeedupPluginConfig | null = null;
let adActive = false;
let savedMuted = false;
let savedPlaybackRate = 1;

const applyState = (player: Element) => {
  const config = activeConfig;
  if (!config) {
    return;
  }

  const video = player.querySelector<HTMLVideoElement>('video');
  const isAd = ADVERT_CLASSES.some((cls) => player.classList.contains(cls));

  if (video) {
    if (isAd && !adActive) {
      adActive = true;
      savedMuted = video.muted;
      savedPlaybackRate = video.playbackRate || 1;
      video.playbackRate = config.speed;
      if (config.muteAudio) {
        video.muted = true;
      }
    } else if (isAd && adActive) {
      // YTM may reset these mid-ad, keep enforcing
      if (video.playbackRate !== config.speed) {
        video.playbackRate = config.speed;
      }

      if (config.muteAudio && !video.muted) {
        video.muted = true;
      }
    } else if (!isAd && adActive) {
      adActive = false;
      video.playbackRate = savedPlaybackRate;
      if (config.muteAudio) {
        video.muted = savedMuted;
      }
    }
  }

  if (config.autoSkip) {
    clickSkipButtons(player);
  }
};

const onPlayerApiReady = async (
  _api: MusicPlayer,
  ctx: RendererContext<AdSpeedupPluginConfig>,
) => {
  activeConfig = await ctx.getConfig();

  const player = document.querySelector('#movie_player');
  if (!player) {
    return;
  }

  applyState(player);

  observer?.disconnect();
  observer = new MutationObserver(() => {
    const current = document.querySelector('#movie_player');
    if (current) {
      applyState(current);
    }
  });
  observer.observe(player, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true,
  });
};

const onConfigChange = (newConfig: AdSpeedupPluginConfig) => {
  activeConfig = newConfig;

  const player = document.querySelector('#movie_player');
  if (player) {
    applyState(player);
  }
};

const onRendererStop = () => {
  observer?.disconnect();
  observer = null;

  if (adActive) {
    adActive = false;
    const video = document.querySelector<HTMLVideoElement>(
      '#movie_player video',
    );
    if (video && activeConfig?.muteAudio) {
      video.playbackRate = savedPlaybackRate;
      video.muted = savedMuted;
    }
  }

  activeConfig = null;
};

export default createPlugin({
  name: () => t('plugins.ad-speedup.name'),
  description: () => t('plugins.ad-speedup.description'),
  restartNeeded: false,
  config: {
    enabled: false,
    speed: 16,
    muteAudio: true,
    autoSkip: true,
  } as AdSpeedupPluginConfig,
  menu: async ({ getConfig, setConfig }): Promise<MenuTemplate> => {
    const config = await getConfig();

    return [
      {
        label: t('plugins.ad-speedup.menu.mute-audio'),
        type: 'checkbox',
        checked: config.muteAudio,
        click(item) {
          setConfig({ muteAudio: item.checked });
        },
      },
      {
        label: t('plugins.ad-speedup.menu.auto-skip'),
        type: 'checkbox',
        checked: config.autoSkip,
        click(item) {
          setConfig({ autoSkip: item.checked });
        },
      },
      {
        label: t('plugins.ad-speedup.menu.speed.label'),
        type: 'submenu',
        submenu: SPEEDS.map((speed) => ({
          label: `${speed}x`,
          type: 'radio',
          checked: config.speed === speed,
          click() {
            setConfig({ speed });
          },
        })),
      },
    ];
  },
  renderer: {
    onPlayerApiReady,
    onConfigChange,
    stop: onRendererStop,
  },
});
