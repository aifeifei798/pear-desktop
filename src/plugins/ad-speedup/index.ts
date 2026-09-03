import { t } from '@/i18n';
import { debounce } from '@/providers/decorators';
import { createPlugin } from '@/utils';

import type { MenuTemplate } from '@/menu';
import type { RendererContext } from '@/types/contexts';
import type { MusicPlayer } from '@/types/music-player';

export type AdSpeedupPluginConfig = {
  enabled: boolean;
  speed: number;
  muteAudio: boolean;
  autoSkip: boolean;
  blockPremiumPromo: boolean;
};

const ADVERT_CLASSES = ['ad-showing', 'ad-interrupting'];

const SKIP_BUTTON_SELECTORS = [
  'button.ytp-ad-skip-button-modern',
  'button.ytp-ad-skip-button',
  'button.ytp-skip-ad-button',
  '.ytp-ad-skip-button-container button',
  '.ytp-ad-skip-button-slot button',
  '.ytp-ad-overlay-close-button',
];

const SPEEDS = [2, 4, 8, 16];

// Premium upsell surfaces: bottom promo bar + modal trial dialogs
const PROMO_STYLE_ID = 'peard-ad-speedup-promo-style';
const MEALBAR_CSS = 'ytmusic-mealbar-promo-renderer{display:none!important}';

const DIALOG_SELECTORS = [
  'yt-confirm-dialog-renderer',
  'yt-dialog-renderer',
  'tp-yt-paper-dialog',
];
const DIALOG_SELECTOR = DIALOG_SELECTORS.map(
  (selector) => `ytmusic-popup-container ${selector}`,
).join(',');

// Matches e.g. "想要畅享无广告干扰的音乐体验？" / "Try Premium free"
const PREMIUM_RE = /premium|无广告|去广告|ad-free|ad free/i;
// Negative/dismiss buttons only — never touch the confirm action
const DISMISS_RE =
  /不用|不要|不了|谢谢|关闭|取消|稍后|以后|dismiss|close|no thanks|not now|maybe later/i;

const clickSkipButtons = (player: Element) => {
  for (const selector of SKIP_BUTTON_SELECTORS) {
    const button = player.querySelector<HTMLButtonElement>(selector);
    if (button && !button.disabled) {
      button.click();
    }
  }
};

let observer: MutationObserver | null = null;
let promoObserver: MutationObserver | null = null;
let scanTimer: number | null = null;
let activeConfig: AdSpeedupPluginConfig | null = null;
let adActive = false;
let savedMuted = false;
let savedPlaybackRate = 1;

const scanPlayer = () => {
  const current = document.querySelector('#movie_player');
  if (current) {
    applyState(current);
  }
};

const startScanTimer = () => {
  stopScanTimer();
  // Safety net: mutations alone can miss the skip button
  // (e.g. it flips from disabled to enabled without observable churn)
  scanTimer = window.setInterval(scanPlayer, 500);
};

const stopScanTimer = () => {
  if (scanTimer !== null) {
    window.clearInterval(scanTimer);
    scanTimer = null;
  }
};

const updatePromoStyle = () => {
  const existing = document.getElementById(PROMO_STYLE_ID);
  if (activeConfig?.blockPremiumPromo) {
    if (!existing) {
      const style = document.createElement('style');
      style.id = PROMO_STYLE_ID;
      style.textContent = MEALBAR_CSS;
      document.head.append(style);
    }
  } else {
    existing?.remove();
  }
};

const dismissPremiumDialogs = () => {
  if (!activeConfig?.blockPremiumPromo) {
    return;
  }

  const dialogs = document.querySelectorAll(DIALOG_SELECTOR);
  for (const dialog of dialogs) {
    if (!PREMIUM_RE.test(dialog.textContent ?? '')) {
      continue;
    }

    const buttons = dialog.querySelectorAll('button');
    for (const button of buttons) {
      const label = `${button.textContent ?? ''} ${button.getAttribute('aria-label') ?? ''}`;
      if (DISMISS_RE.test(label)) {
        button.click();
        break;
      }
    }
  }
};

const schedulePromoScan = debounce(() => {
  dismissPremiumDialogs();
}, 300);

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

  updatePromoStyle();
  dismissPremiumDialogs();
  scanPlayer();

  observer?.disconnect();
  observer = new MutationObserver(() => {
    scanPlayer();
  });
  observer.observe(
    document.querySelector('#movie_player') ?? document.documentElement,
    {
      attributes: true,
      attributeFilter: ['class', 'disabled', 'hidden'],
      childList: true,
      subtree: true,
    },
  );
  startScanTimer();

  updatePromoStyle();
  dismissPremiumDialogs();

  promoObserver?.disconnect();
  promoObserver = new MutationObserver(() => {
    schedulePromoScan();
  });
  const popupRoot = document.querySelector('ytmusic-popup-container');
  promoObserver.observe(popupRoot ?? document.documentElement, {
    childList: true,
    subtree: true,
  });
};

const onConfigChange = (newConfig: AdSpeedupPluginConfig) => {
  activeConfig = newConfig;

  updatePromoStyle();
  dismissPremiumDialogs();

  const player = document.querySelector('#movie_player');
  if (player) {
    applyState(player);
  }
};

const onRendererStop = () => {
  observer?.disconnect();
  observer = null;
  promoObserver?.disconnect();
  promoObserver = null;
  stopScanTimer();
  document.getElementById(PROMO_STYLE_ID)?.remove();

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
    blockPremiumPromo: true,
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
        label: t('plugins.ad-speedup.menu.block-premium-promo'),
        type: 'checkbox',
        checked: config.blockPremiumPromo,
        click(item) {
          setConfig({ blockPremiumPromo: item.checked });
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
