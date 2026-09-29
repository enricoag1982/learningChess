// Node's ESM loader (this file runs straight under Playwright, outside Vite) requires this
// attribute for a JSON import.
import en from '@learn/subject-chess/dist/locales/en.json' with { type: 'json' };
import { createE2ETexts } from '@learn/platform-web/e2e/i18n.ts';

/** The chess locale's texts, resolved as the app renders them (`contentText` keys: `lessons:rook.title`, `piece.r`). */
export const { contentText, interpolate } = createE2ETexts({ en });
