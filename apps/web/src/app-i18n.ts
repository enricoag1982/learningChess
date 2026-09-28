// The app's own locale bundle, loaded before `App` so the first render has its texts.
import en from '@chess-kids/content/locales/en.json';
import { initI18n } from './i18n.ts';

initI18n({ en });
