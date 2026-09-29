// Import order fixes the entry chunk's module order, which moves the initial JS by ~0.5 KB.
import { mountApp } from '@learn/platform-web/mount.tsx';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import './index.css';
import './app-i18n.ts';
import { CHESS_APP_CONFIG } from '@learn/subject-chess';
import { chessWeb } from '@learn/subject-chess/web/chess-pack.ts';

mountApp({ pack: chessWeb, app: CHESS_APP_CONFIG, registerSW });
