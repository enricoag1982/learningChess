import 'i18next';
import type en from '@chess-kids/content/locales/en.json';

// Types `t()` against the real English locale: unknown keys fail typecheck.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: typeof en;
  }
}
