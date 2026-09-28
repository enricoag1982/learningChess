import { useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lesson, MiniGameStateBase, Stars } from '@chess-kids/core';
import { recordBossResult } from '@chess-kids/core';
import { useAppStore, useServices } from '../app/store.ts';
import { StarsRow } from '../ui/StarsRow.tsx';
import { SECONDARY_BUTTON } from '../ui/lesson/button-styles.ts';
import { NextButton } from '../ui/lesson/NextButton.tsx';
import type { BossPlaySession } from './mode-ui.ts';

export interface UseBossRunOptions {
  readonly lesson: Lesson;
  readonly nextStepIndex: number;
  readonly session?: BossPlaySession;
}

export interface BossRun {
  readonly isOver: boolean;
  readonly isWin: boolean;
  readonly stars: Stars;
  readonly saved: boolean;
  /** Resets this run's clock/save-guard for a standalone "Play again" — call once, alongside
   * resetting the mode's own state (`modeOf(state).start(def)`) and any of the step's own UI state. */
  readonly restart: () => void;
}

/** The save effect + result fields shared by every boss step (`static`/`series`/`versus`): saves
 * once play is over (`session.save`, else `recordBossResult`), exposes `isOver`/`isWin`/`stars` via
 * the mode registry, and a `restart` for a standalone session's own "Play again". */
// eslint-disable-next-line react-refresh/only-export-components -- paired with BossResultPanel below
export function useBossRun(state: MiniGameStateBase, options: UseBossRunOptions): BossRun {
  const { lesson, nextStepIndex, session } = options;
  const services = useServices();
  const profile = useAppStore((appState) => appState.profile);
  const refreshProgress = useAppStore((appState) => appState.refreshProgress);

  const mode = services.deps.subject.modes[state.mode];
  if (!mode) throw new Error(`useBossRun: no mode registered for "${state.mode}"`);
  const isOver = mode.isOver(state);

  // A lazy `useState` initializer (not a direct `Date.now()` call) keeps render pure; the ref
  // exists because "Play again" needs to reset the clock later, which `useState` can't do.
  const [initialStartedAt] = useState(() => Date.now());
  const startedAtRef = useRef(initialStartedAt);
  const savedRef = useRef(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOver || savedRef.current || !profile) return;
    savedRef.current = true;
    const durationMs = Date.now() - startedAtRef.current;
    const persist = session
      ? session.save(state, durationMs)
      : recordBossResult(services.deps, {
          profileId: profile.id,
          lesson,
          state,
          durationMs,
          nextStep: nextStepIndex,
        }).then(() => {
          // Keeps the store's `progress` current: the Complete step reads it straight from the store.
          void refreshProgress();
        });
    void persist.then(() => {
      setSaved(true);
    });
  }, [isOver, profile, services.deps, lesson, nextStepIndex, state, refreshProgress, session]);

  function restart(): void {
    startedAtRef.current = Date.now();
    savedRef.current = false;
    setSaved(false);
  }

  return { isOver, isWin: mode.isWin(state), stars: mode.stars(state), saved, restart };
}

export interface BossResultPanelProps {
  readonly stars: Stars;
  readonly saved: boolean;
  /** True when "Play again" shows even without a standalone session — a lesson boss that did not
   * win outright (static's move-limit end, versus lost/draw). A win always offers it once there is
   * a session, never on its own inside a lesson. */
  readonly alwaysPlayAgain: boolean;
  /** Extra line shown above the stars (static's "ended" text, versus's draw reason). */
  readonly note?: ReactNode;
  readonly session?: BossPlaySession;
  readonly onPlayAgain: () => void;
  /** Lesson-boss "Next" target; ignored once `session` is set (its own `onPrimary` wins). */
  readonly onNext: () => void;
}

/** The result block every boss step ends on: stars, then — once the play is saved — either a plain
 * "Next" (a lesson boss that won outright, no session) or "Play again" + "Next"/session's primary
 * action. Same DOM every boss mode rendered by hand before this (dedup target of C6). */
export function BossResultPanel({
  stars,
  saved,
  alwaysPlayAgain,
  note,
  session,
  onPlayAgain,
  onNext,
}: BossResultPanelProps): JSX.Element {
  const { t } = useTranslation();
  const showPlayAgain = alwaysPlayAgain || session !== undefined;
  const nextClick = session ? session.onPrimary : onNext;
  return (
    <div className="mt-auto flex flex-col items-center gap-4">
      {note}
      <StarsRow earned={stars} animate />
      {saved &&
        (showPlayAgain ? (
          <div className="flex w-full gap-3">
            <button type="button" onClick={onPlayAgain} className={SECONDARY_BUTTON}>
              {t('play-again')}
            </button>
            <NextButton onClick={nextClick} label={session?.primaryLabel} className="flex-1" />
          </div>
        ) : (
          <NextButton onClick={nextClick} className="w-full" />
        ))}
    </div>
  );
}
