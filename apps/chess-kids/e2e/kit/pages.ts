import { createPages } from '@learn/platform-web/e2e/pages.ts';
import { contentText } from './i18n.ts';

/** The shared page flows bound to the chess app's title and locale. */
export const {
  completeFirstRunToPlacementOffer,
  completeFirstRun,
  dismissCelebrationIfShown,
  pickProfileFromPicker,
  startLessonToFirstGuided,
  openParentArea,
} = createPages({ appTitle: contentText('app.title'), texts: { contentText } });
