import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../app/store.ts';
import { ReviewTaskRunner } from './session/ReviewTaskRunner.tsx';
import { BlankScreen } from './ds/Screen.tsx';

export function WarmUpScreen(): JSX.Element {
  const { t } = useTranslation();
  const todayPlan = useAppStore((state) => state.todayPlan);
  const todayActivityIndex = useAppStore((state) => state.todayActivityIndex);
  const advanceToday = useAppStore((state) => state.advanceToday);
  const leaveToday = useAppStore((state) => state.leaveToday);

  const activity = todayPlan?.activities[todayActivityIndex];
  const tasks = activity?.kind === 'warmup' ? activity.tasks : [];

  if (tasks.length === 0) {
    return <BlankScreen />;
  }

  return (
    <ReviewTaskRunner
      tasks={tasks}
      headerText={(current, total) => t('session.warmup-of', { current, total })}
      closeAriaLabel={t('session.leave')}
      reviewSource="warmup"
      onDone={() => {
        void advanceToday();
      }}
      onClose={leaveToday}
    />
  );
}
