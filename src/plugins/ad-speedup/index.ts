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

// 扩充现代 YouTube / YTM 的各种跳过按钮类名
const SKIP_BUTTON_SELECTORS = [
  '.ytp-ad-skip-button-modern',
  '.ytp-ad-skip-button',
  '.ytp-skip-ad-button',
  '.ytp-ad-skip-button-container',
  '.ytp-ad-skip-button-slot',
  '.ytp-ad-overlay-close-button',
  '[class*="skip-button"]',
];

const SPEEDS = [2, 4, 8, 16];

// Premium 弹窗与横幅样式兜底
const PROMO_STYLE_ID = 'peard-ad-speedup-promo-style';
const MEALBAR_CSS = `
  ytmusic-mealbar-promo-renderer,
  ytmusic-bubble-renderer,
  ytmusic-guide-entry-renderer:has(path[d*="M12 3L2 12h3v8h14v-8h3L12 3z"]), /* Premium 推广入口 */
  .ytmusic-mealbar-promo-renderer {
    display: none !important;
  }
`;

const PREMIUM_RE = /premium|无广告|去广告|ad-free|ad free|试用|trial/i;
const DISMISS_RE =
  /不用|不要|不了|谢谢|关闭|取消|稍后|以后|dismiss|close|no thanks|not now|maybe later|skip/i;

let observer: MutationObserver | null = null;
let promoObserver: MutationObserver | null = null;
let scanTimer: number | null = null;
let activeConfig: AdSpeedupPluginConfig | null = null;
let adActive = false;
let savedMuted = false;
let savedPlaybackRate = 1;

/**
 * 尝试点击跳过按钮
 */
const clickSkipButtons = (player: Element) => {
  for (const selector of SKIP_BUTTON_SELECTORS) {
    const el = player.querySelector<HTMLElement>(selector);
    if (el) {
      // 触发真实点击事件（有的元素是 div 而不是 button，需要派发完整事件）
      el.click();
    }
  }
};

const scanPlayer = () => {
  const current = document.querySelector<HTMLElement>('#movie_player');
  if (current) {
    applyState(current);
  }
};

const startScanTimer = () => {
  stopScanTimer();
  // 每 200ms 轮询一次以确保广告期间播放不被暂停、跳过按钮能最快被点中
  scanTimer = window.setInterval(scanPlayer, 200);
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

/**
 * 处理弹窗（全文档扫描，处理包含 Web Components 的结构）
 */
const dismissPremiumDialogs = () => {
  if (!activeConfig?.blockPremiumPromo) {
    return;
  }

  // 弹窗可能直接在 body 下，也可能在 popup-container 下
  const dialogs = document.querySelectorAll(
    'ytmusic-popup-container yt-confirm-dialog-renderer, ytmusic-popup-container yt-dialog-renderer, tp-yt-paper-dialog, ytmusic-you-there-renderer',
  );

  for (const dialog of dialogs) {
    // 处理“你还在听吗？”直接点确定继续听
    if (dialog.tagName.toLowerCase() === 'ytmusic-you-there-renderer') {
      const confirmBtn = dialog.querySelector<HTMLElement>('#button, button, yt-button-renderer');
      confirmBtn?.click();
      continue;
    }

    const text = dialog.textContent ?? '';
    if (!PREMIUM_RE.test(text)) {
      continue;
    }

    // 优先寻找取消/拒绝按钮
    const buttons = dialog.querySelectorAll<HTMLElement>('button, yt-button-renderer');
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
}, 200);

/**
 * 广告加速、静音与跳过核心处理
 */
const applyState = (player: HTMLElement) => {
  const config = activeConfig;
  if (!config) {
    return;
  }

  const video = player.querySelector<HTMLVideoElement>('video');
  const moviePlayer = player as unknown as {
    isMuted?: () => boolean;
    mute?: () => void;
    unMute?: () => void;
  };

  // 判断是否处于广告状态
  const isAd =
    ADVERT_CLASSES.some((cls) => player.classList.contains(cls)) ||
    Boolean(player.querySelector('.ad-showing, .ad-interrupting'));

  if (video) {
    if (isAd) {
      // 1. 刚进入广告时，备份状态
      if (!adActive) {
        adActive = true;
        savedMuted = moviePlayer.isMuted ? moviePlayer.isMuted() : video.muted;
        savedPlaybackRate = video.playbackRate || 1;
      }

      // 2. 关键修复：防止广告由于极高倍速被 YouTube 自动暂停，强行恢复播放
      if (video.paused) {
        video.play().catch(() => {});
      }

      // 3. 静音：同时设置 video 属性并调用 YTM API
      if (config.muteAudio) {
        if (!video.muted) {
          video.muted = true;
        }
        if (moviePlayer.mute && !moviePlayer.isMuted?.()) {
          moviePlayer.mute();
        }
      }

      // 4. 保持倍速
      if (video.playbackRate !== config.speed) {
        video.playbackRate = config.speed;
      }

      // 5. 强力秒跳：如果视频时长允许，直接把当前播放头推到最后
      if (Number.isFinite(video.duration) && video.duration > 0) {
        if (video.currentTime < video.duration) {
          video.currentTime = video.duration;
        }
      }
    } else if (adActive) {
      // 广告刚结束，恢复原状态
      adActive = false;
      video.playbackRate = savedPlaybackRate;

      if (config.muteAudio) {
        video.muted = savedMuted;
        if (moviePlayer.unMute && !savedMuted) {
          moviePlayer.unMute();
        }
      }
    }
  }

  // 尝试点击跳过按钮
  if (config.autoSkip && isAd) {
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

  // 广告期间的高频定时器（负责防暂停和极速跳过）
  startScanTimer();

  promoObserver?.disconnect();
  promoObserver = new MutationObserver(() => {
    schedulePromoScan();
  });
  promoObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
};

const onConfigChange = (newConfig: AdSpeedupPluginConfig) => {
  activeConfig = newConfig;

  updatePromoStyle();
  dismissPremiumDialogs();

  const player = document.querySelector<HTMLElement>('#movie_player');
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
    if (video) {
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
