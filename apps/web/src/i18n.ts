import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@chess-kids/content/locales/en.json';

// Resources are bundled at build time, so init completes synchronously: the
// first render already has translated text (no loading flash, no suspense).
void i18next.use(initReactI18next).init({
  resources: { en },
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common', 'lessons', 'characters', 'journey'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18next;
