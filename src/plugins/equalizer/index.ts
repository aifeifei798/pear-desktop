import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import equalizerStyle from './equalizer.css?inline';
import { equalizerPresetNames, flatGains, presetGains } from './presets';
import {
  onConfigChange,
  onPlayerApiReady,
  onRendererStart,
  onRendererStop,
} from './renderer';

import type { MenuTemplate } from '@/menu';
import type { MenuContext } from '@/types/contexts';

export type EqualizerPluginConfig = {
  enabled: boolean;
  gains: number[];
  preset: string;
};

export default createPlugin({
  name: () => t('plugins.equalizer.name'),
  description: () => t('plugins.equalizer.description'),
  restartNeeded: false,
  config: {
    enabled: false,
    gains: flatGains(),
    preset: 'flat',
  } as EqualizerPluginConfig,
  stylesheets: [equalizerStyle],
  menu: async ({
    getConfig,
    setConfig,
  }: MenuContext<EqualizerPluginConfig>): Promise<MenuTemplate> => {
    const config = await getConfig();

    return [
      {
        label: t('plugins.equalizer.menu.presets.label'),
        type: 'submenu',
        submenu: equalizerPresetNames.map((preset) => ({
          label: t(`plugins.equalizer.menu.presets.list.${preset}`),
          type: 'radio',
          checked: (config.preset || 'flat') === preset,
          click() {
            setConfig({ preset, gains: presetGains(preset) });
          },
        })),
      },
    ];
  },
  renderer: {
    start: onRendererStart,
    stop: onRendererStop,
    onPlayerApiReady,
    onConfigChange,
  },
});
