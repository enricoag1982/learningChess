import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { i18nOptions } from './i18n-options.ts';

// Resources are bundled at build time, so init completes synchronously: the
// first render already has translated text (no loading flash, no suspense).
void i18next.use(initReactI18next).init(i18nOptions);

export default i18next;
