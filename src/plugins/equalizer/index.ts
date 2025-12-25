// index.ts

import { createPlugin } from '@/utils';
import { t } from '@/i18n';

import {
  defaultPresets,
  presetConfigs,
  type Preset,
  type FilterConfig,
} from './presets';

import type { MenuContext } from '@/types/contexts';
import type { MenuTemplate } from '@/menu';

export type EqualizerPluginConfig = {
  enabled: boolean;
  filters: FilterConfig[];
  presets: { [preset in Preset]: boolean };
};

let appliedNodes: AudioNode[] = [];

// 预设名称映射 (如果你不想改 i18n 文件，可以在这里直接用中文)
const presetNames: Record<string, string> = {
  // --- 原有的 ---
  'flat': '原声 (Flat)',
  'pop': '流行 (Pop)',
  'rock': '摇滚 (Rock)',
  'jazz': '爵士 (Jazz)',
  'classical': '古典 (Classical)',
  'electronic': '电子 (Electronic)',
  'dance': '舞曲 (Dance)',
  'r-n-b': 'R&B',
  'hip-hop': '嘻哈 (Hip-Hop)',
  'heavy-metal': '重金属 (Heavy Metal)',
  'acoustic': '原声吉他 (Acoustic)',
  'vocal-boost': '人声增强 (Vocal Boost)',
  'treble-boost': '高音增强 (Treble Boost)',
  'bass-extreme': '重低音 (Bass Extreme)',
  'deep': '深邃 (Deep)',
  'lounge': '休闲 (Lounge)',
  'piano': '钢琴 (Piano)',
  'gaming': '游戏/脚步 (Gaming)',
  'movie': '电影/剧场 (Movie)',
  'spoken-word': '有声书/播客 (Spoken Word)',
  'old-radio': '老式收音机 (Old Radio)',
  
  // --- 新增的 ---
  'reggae': '雷鬼 (Reggae)',
  'folk': '民谣 (Folk)',
  'blues': '布鲁斯 (Blues)',
  'trance': '出神舞曲 (Trance)',
  'dubstep': '回响贝斯 (Dubstep)',
  'ambient': '氛围乐 (Ambient)',
  'clarity': '清晰人声 (Clarity)',
  'warmth': '温暖醇厚 (Warmth)',
  'punchy': '冲击力 (Punchy)',
  'airy': '空气感 (Airy)',
  'loudness': '响度补偿 (Loudness)',
  'vinyl-classic': '经典黑胶 (Vinyl)',
  'female-vocal': '聚焦女声 (Female Vocal)',
  'male-vocal': '聚焦男声 (Male Vocal)',
  'drum-and-bass': '鼓与贝斯 (D&B)',
  'violin-focus': '聚焦弦乐 (Violin)',
  'car-stereo': '汽车音响 (Car Stereo)',
  'headphones-open': '开放式耳机 (Open)',
  'headphones-closed': '封闭式耳机 (Closed)',
  'small-speakers': '小型音箱 (Small)',
};

export default createPlugin({
  name: () => t('plugins.equalizer.name'),
  description: () => t('plugins.equalizer.description'),
  restartNeeded: false,
  addedVersion: '3.7.X',
  config: {
    enabled: true, 
    filters: [],
    presets: {
      // --- 原有的 ---
      'flat': false, 'pop': true, 'rock': false, 'jazz': false, 'classical': false, 
      'electronic': false, 'dance': false, 'r-n-b': false, 'hip-hop': false, 
      'heavy-metal': false, 'acoustic': false, 'vocal-boost': false, 
      'treble-boost': false, 'bass-extreme': false, 'deep': false, 'lounge': false, 
      'piano': false, 'gaming': false, 'movie': false, 'spoken-word': false, 'old-radio': false,

      // --- 新增的 ---
      'reggae': false, 'folk': false, 'blues': false, 'trance': false, 
      'dubstep': false, 'ambient': false, 'clarity': false, 'warmth': false, 
      'punchy': false, 'airy': false, 'loudness': false, 'vinyl-classic': false,
      'female-vocal': false, 'male-vocal': false, 'drum-and-bass': false, 
      'violin-focus': false, 'car-stereo': false, 'headphones-open': false, 
      'headphones-closed': false, 'small-speakers': false,
    },
  } as EqualizerPluginConfig,
  menu: async ({
    getConfig,
    setConfig,
  }: MenuContext<EqualizerPluginConfig>): Promise<MenuTemplate> => {
    const config = await getConfig();

    return [
      {
        label: t('plugins.equalizer.menu.presets.label'),
        type: 'submenu',
        submenu: defaultPresets.map((preset) => ({
          // label: t(`plugins.equalizer.menu.presets.list.${preset}`),
		  label: presetNames[preset] || t(`plugins.equalizer.menu.presets.list.${preset}`) || preset,
          type: 'radio',
          checked: config.presets[preset],
          click() {
            const newPresets = { ...config.presets };
            (Object.keys(newPresets) as Preset[]).forEach(k => newPresets[k] = false);
            newPresets[preset] = true;
            
            setConfig({
              enabled: true,
              presets: newPresets,
            });
          },
        })),
      },
    ];
  },
  renderer: {
    async start({ getConfig }) {
      // 1. 自动刷新逻辑
      let lastAppliedConfig = await getConfig();
      setInterval(async () => {
        const currentConfig = await getConfig();
        const lastPreset = defaultPresets.find(p => lastAppliedConfig.presets[p]);
        // [修复] 这里是关键的拼写错误修复
        const currentPreset = defaultPresets.find(p => currentConfig.presets[p]);
        if (lastPreset !== currentPreset) {
          window.location.reload();
        }
      }, 1000);

      // 2. 音频处理逻辑
      const config = await getConfig();
      document.addEventListener(
        'peard:audio-can-play',
        ({ detail: { audioSource, audioContext } }) => {
          const activePresetKey = defaultPresets.find(p => config.presets[p]);
          if (!activePresetKey && config.filters.length === 0) return;

          const filtersToApply = config.filters.concat(
             activePresetKey ? presetConfigs[activePresetKey] : []
          );
          if (filtersToApply.length === 0) return;

          // --- 步骤 1: 更精确的前置增益 (Pre-amp) ---
          const maxGain = Math.max(0, ...filtersToApply.map(f => f.gain));
          const preampNode = audioContext.createGain();
          
          const preampValue = Math.pow(10, -maxGain / 20); 
          preampNode.gain.value = preampValue;

          // --- 建立基础链路 ---
          audioSource.connect(preampNode);
          appliedNodes.push(preampNode);
          let previousNode: AudioNode = preampNode;

          // --- 串联所有EQ滤波器 ---
          filtersToApply.forEach((filter) => {
            const biquadFilter = audioContext.createBiquadFilter();
            biquadFilter.type = filter.type;
            biquadFilter.frequency.value = filter.frequency;
            biquadFilter.Q.value = filter.Q;
            biquadFilter.gain.value = filter.gain;
            previousNode.connect(biquadFilter);
            previousNode = biquadFilter;
            appliedNodes.push(biquadFilter);
          });

          // --- 步骤 2: 添加限制器 (Limiter) 作为最后防线 ---
          const limiterNode = audioContext.createDynamicsCompressor();
          limiterNode.threshold.setValueAtTime(-0.1, audioContext.currentTime);
          limiterNode.knee.setValueAtTime(0, audioContext.currentTime);
          limiterNode.ratio.setValueAtTime(20, audioContext.currentTime);
          limiterNode.attack.setValueAtTime(0.001, audioContext.currentTime);
          limiterNode.release.setValueAtTime(0.1, audioContext.currentTime);

          // --- 连接最后链路 ---
          previousNode.connect(limiterNode);
          limiterNode.connect(audioContext.destination);
          appliedNodes.push(limiterNode);
          
          console.log(`[EQ] Applied preset "${activePresetKey}" | Preamp: ${preampValue.toFixed(2)} (-${maxGain.toFixed(1)}dB) | Limiter: ON`);
        },
        { once: true, passive: true },
      );
    },
    stop() {
      appliedNodes.forEach((node) => node.disconnect());
      appliedNodes = [];
    },
  },
});