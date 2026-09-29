import { useEffect } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, useRoute, useServices } from '../app/store.ts';
import { Owl } from './ds/Owl.tsx';

/** 5-minute warning banner; re-runs `checkTimeNotice` on every screen change, incl. reaching the lesson-complete step. */
export function AppNotice(): JSX.Element | null {
  const { t } = useTranslation();
  const services = useServices();
  const screen = useAppStore((state) => state.screen);
  const lessonId = useRoute('lesson')?.lessonId ?? null;
  const stepIndex = useAppStore((state) => state.stepIndex);
  const visible = useAppStore((state) => state.timeNoticeVisible);
  const checkTimeNotice = useAppStore((state) => state.checkTimeNotice);

  useEffect(() => {
    void checkTimeNotice('screen');
  }, [screen, lessonId, stepIndex, checkTimeNotice]);

  const text = t('notice.five-minutes');
  // Spoken once when it appears. Never cancels on hide: the hide happens on a screen change, and a
  // cancel here (this runs after the new screen's own narration effect) would silence that screen.
  useEffect(() => {
    if (visible) void services.narrator.speak(text);
  }, [visible, text, services.narrator]);

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
