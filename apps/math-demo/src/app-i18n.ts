// The app's own locale bundle, loaded before `App` so the first render has its texts.
import en from '@learn/subject-math/dist/locales/en.json';
import { initI18n } from '@learn/platform-web/i18n.ts';

initI18n({ en });
