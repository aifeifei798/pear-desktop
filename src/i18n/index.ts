import i18next, { init, t as i18t, changeLanguage } from 'i18next';
import { languageResource } from 'virtual:i18n';

export const APPLICATION_NAME =
  '\u0059\u006f\u0075\u0054\u0075\u0062\u0065\u0020\u004d\u0075\u0073\u0069\u0063';

export const loadI18n = async () =>
  await init({
    resources: await languageResource('en'),
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

const loadedLanguages = new Set<string>(['en']);

export const setLanguage = async (language: string) => {
  if (!loadedLanguages.has(language)) {
    try {
      const bundle = await languageResource(language);
      const translation = (bundle as Record<string, { translation: object }>)[
        language
      ]?.translation;
      if (translation) {
        i18next.addResourceBundle(
          language,
          'translation',
          translation,
          true,
          true,
        );
        loadedLanguages.add(language);
      }
    } catch {
      // Unknown language or failed load: fall back to English
      await changeLanguage('en');
      return;
    }
  }

  await changeLanguage(language);
};

export const t = i18t.bind(i18next);
