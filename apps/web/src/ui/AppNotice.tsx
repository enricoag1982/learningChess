import { useEffect } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, useServices } from '../app/store.ts';
import { Owl } from './Owl.tsx';
import { useNarratedText } from './useNarratedText.ts';

/**
 * 5-minute warning banner (M7.1, app-structure.md §13 "5-min warning"): the store's
 * `timeNoticeVisible` (`checkTimeNotice`) decides whether it shows — this component only re-runs
 * that check on every screen change (mounted once in `App.tsx` alongside `TimeTracker`/
 * `AppUpdater`; `TimeTracker`'s own minute tick runs the other trigger). "Screen change" includes
 * reaching the lesson screen's own lesson-complete step — `lessonId`/`stepIndex` are also
 * dependencies here, since that step alone turns `screen: 'lesson'` calm without the `Screen`
 * value itself ever changing (`isCalmScreen`, `app/store.ts`). Owl, info style (`docs/screens.md`
 * §1 "Info only": flat, no border/ledge, not tappable), spoken once via `useNarratedText` (fires
 * exactly when `visible` flips from `false` to `true`, since that is the only moment its own text
 * argument changes from `''`), gone on the next screen change.
 */
export function AppNotice(): JSX.Element | null {
  const { t } = useTranslation();
  const services = useServices();
  const screen = useAppStore((state) => state.screen);
  const lessonId = useAppStore((state) => state.lessonId);
  const stepIndex = useAppStore((state) => state.stepIndex);
  const visible = useAppStore((state) => state.timeNoticeVisible);
  const checkTimeNotice = useAppStore((state) => state.checkTimeNotice);

  useEffect(() => {
    void checkTimeNotice('screen');
  }, [screen, lessonId, stepIndex, checkTimeNotice]);

  const text = t('notice.five-minutes');
  useNarratedText(services.narrator, visible ? text : '');

  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="notice-slide-down info-flat fixed inset-x-0 top-0 z-30 flex items-center gap-3 px-4 py-3"
      style={{ backgroundColor: '#EAF1FB' }}
    >
      <Owl className="h-10 w-10" />
      <p className="flex-1 font-display text-sm font-semibold text-ink sm:text-base">{text}</p>
    </div>
  );
}
