import type { InitOptions } from 'i18next';

/** i18next init options for `resources` (the active subject's compiled locale bundle) — split out
 * of `i18n.ts` so the e2e kit's own standalone instance can init with the exact same options and
 * resolve identical strings. */
export function i18nOptions(resources: InitOptions['resources']): InitOptions {
  return {
    resources,
    lng: 'en',
    fallbackLng: 'en',
    ns: ['common', 'lessons', 'characters', 'journey', 'rewards'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  };
}
