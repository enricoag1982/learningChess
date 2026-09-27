import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, useRoute } from '../app/store.ts';
import { ReviewTaskRunner } from './session/ReviewTaskRunner.tsx';
import { BlankScreen } from './ds/Screen.tsx';

/**
 * Practice's task run (domain-model.md §3.3 "Practice screen"): either the daily warm-up (tapped
 * from Practice's own card, `practiceConceptId: null`) or one topic's 5 review tasks.
 */
export function PracticeRunScreen(): JSX.Element {
  const { t } = useTranslation();
  const route = useRoute('practice-run');
  const exitPracticeRun = useAppStore((state) => state.exitPracticeRun);

  if (!route || route.tasks.length === 0) {
    return <BlankScreen />;
  }
  const practiceConceptId = route.conceptId;
  const practiceTasks = route.tasks;

  const headerText =
    practiceConceptId === null
      ? (current: number, total: number) => t('session.warmup-of', { current, total })
      : (current: number, total: number) => t('practice.topic-of', { current, total });

  return (
    <ReviewTaskRunner
      tasks={practiceTasks}
      headerText={headerText}
      closeAriaLabel={t('session.leave')}
      reviewSource={practiceConceptId === null ? 'warmup' : 'practice'}
      onDone={exitPracticeRun}
      onClose={exitPracticeRun}
    />
  );
}
