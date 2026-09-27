import type { InitOptions } from 'i18next';
// Node's ESM loader (this file is also imported straight from `e2e/kit/i18n.ts`, outside Vite)
// requires this attribute for a JSON import.
import en from '@chess-kids/content/locales/en.json' with { type: 'json' };

/** i18next init options, split out of `i18n.ts` so the e2e kit's own standalone instance can init
 * with the exact same options and resolve identical strings. */
export const i18nOptions: InitOptions = {
  resources: { en },
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common', 'lessons', 'characters', 'journey', 'rewards'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
};
