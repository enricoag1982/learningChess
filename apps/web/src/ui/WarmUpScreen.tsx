import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../app/store.ts';
import { ReviewTaskRunner } from './session/ReviewTaskRunner.tsx';

/** A Today session's warm-up activity (domain-model.md §3.1, §3.3): up to 3 review tasks. */
export function WarmUpScreen(): JSX.Element {
  const { t } = useTranslation();
  const todayPlan = useAppStore((state) => state.todayPlan);
  const todayActivityIndex = useAppStore((state) => state.todayActivityIndex);
  const advanceToday = useAppStore((state) => state.advanceToday);
  const leaveToday = useAppStore((state) => state.leaveToday);

  const activity = todayPlan?.activities[todayActivityIndex];
  const tasks = activity?.kind === 'warmup' ? activity.tasks : [];

  if (tasks.length === 0) {
    return <main className="min-h-screen bg-cream" />;
  }

  return (
    <ReviewTaskRunner
      tasks={tasks}
      headerText={(current, total) => t('session.warmup-of', { current, total })}
      closeAriaLabel={t('session.leave')}
      onDone={() => {
        void advanceToday();
      }}
      onClose={leaveToday}
    />
  );
}
