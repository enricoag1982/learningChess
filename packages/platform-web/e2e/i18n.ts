import i18next, { type ResourceLanguage } from 'i18next';
import { i18nOptions } from '../src/i18n-options.ts';

export interface E2ETexts {
  /** Resolves a text key (`lessons:x.title`, or a namespace-less `common` key) to the compiled English string. */
  contentText: (key: string) => string;
  /** Fills every `{{key}}` of a compiled template (no plural handling). */
  interpolate: (template: string, vars: Readonly<Record<string, string | number>>) => string;
}

/**
 * A standalone i18next instance for specs, built from the app's own options so it resolves the
 * strings the app renders. Resources are bundled, so init completes synchronously.
 */
export function createE2ETexts(resources: { readonly en: ResourceLanguage }): E2ETexts {
  const instance = i18next.createInstance();
  void instance.init(i18nOptions(resources));
  return {
    contentText: (key) => {
      // Dynamic keys (read from built content) cannot satisfy the literal key union of `t()`.
      const dynamic = instance.t as unknown as (
        k: string,
        opts?: Readonly<Record<string, unknown>>,
      ) => string;
      return dynamic(key, { interpolation: { skipOnVariables: true } });
    },
    interpolate: (template, vars) => {
      return instance.services.interpolator.interpolate(template, vars, instance.language, {});
    },
  };
}
