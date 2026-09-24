import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../app/store.ts';
import { ReviewTaskRunner } from './session/ReviewTaskRunner.tsx';

/**
 * Practice's task run (domain-model.md §3.3 "Practice screen"): either the daily warm-up (tapped
 * from Practice's own card, `practiceConceptId: null`) or one topic's 5 review tasks.
 */
export function PracticeRunScreen(): JSX.Element {
  const { t } = useTranslation();
  const practiceConceptId = useAppStore((state) => state.practiceConceptId);
  const practiceTasks = useAppStore((state) => state.practiceTasks);
  const exitPracticeRun = useAppStore((state) => state.exitPracticeRun);

  if (practiceTasks.length === 0) {
    return <main className="min-h-screen bg-cream" />;
  }

  const headerText =
    practiceConceptId === null
      ? (current: number, total: number) => t('session.warmup-of', { current, total })
      : (current: number, total: number) => t('practice.topic-of', { current, total });

  return (
    <ReviewTaskRunner
      tasks={practiceTasks}
      headerText={headerText}
      closeAriaLabel={t('session.leave')}
      onDone={exitPracticeRun}
      onClose={exitPracticeRun}
    />
  );
}
