import { mountApp } from '@learn/platform-web/mount.tsx';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import './index.css';
import './app-i18n.ts';
import { MATH_APP_CONFIG } from '@learn/subject-math';
import { mathWeb } from '@learn/subject-math/web/math-pack.ts';

mountApp({ pack: mathWeb, app: MATH_APP_CONFIG, registerSW });
