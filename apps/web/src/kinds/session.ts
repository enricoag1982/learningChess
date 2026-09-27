import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Stars } from '@chess-kids/core';
import type { ExerciseDef, ExerciseState, Square, VariantRules } from '@chess-kids/core/chess';
import { shouldOfferEasier } from '@chess-kids/core';
import {
  isInCheck,
  kindOf,
  kingSquare,
  requestHint,
  starsFor,
  startExercise,
} from '@chess-kids/core/chess';
import { useServices } from '../app/store.ts';
import type { SpeechBubbleNote } from '../ui/ds/SpeechBubble.tsx';
import { useInstructionNarration } from '../ui/ds/useNarratedText.ts';
import { exerciseInstructionText, exerciseNote } from '../ui/lesson/exercise-text.ts';
import { prefersReducedMotion } from '../ui/useMediaQuery.ts';
import type { ExerciseUIState, SessionAction } from './kind-ui.ts';
import { kindUiOf } from './ui-registry.ts';

/** mate-in-n: how long the scripted opponent reply stays hidden before it is shown and narrated. */
const REPLY_DELAY_MS = 600;
const REPLY_DELAY_REDUCED_MS = 150;

/** Fresh reducer state for a newly-started exercise. `def.lastMove` (the opponent's last move,
 * e.g. the double step before en passant) seeds the last-move highlight from the start. */
function initSessionState(def: ExerciseDef): ExerciseUIState {
  return {
    core: startExercise(def),
    hint: null,
    feedback: { kind: 'instruction' },
    wrongSquares: [],
    missedSquares: [],
    ...(def.lastMove ? { lastMove: def.lastMove } : {}),
  };
}

/** The generic reducer every exercise kind shares: a `UiAction` is handled directly; any other
 * action goes through `kindOf(def).act` + `kindUiOf(def).toUi` — the one exercise-type dispatch
 * left in session plumbing, and it is the registries', not a local `switch`. */
function sessionReducer(
  rules: VariantRules,
): (state: ExerciseUIState, action: SessionAction) => ExerciseUIState {
  return function reduce(state, action) {
    if (action.type === 'tap-first') {
      return { ...state, feedback: { kind: 'tap-first' } };
    }
    if (action.type === 'hint') {
      const { state: core, hint } = requestHint(state.core, rules);
      return { ...state, core, hint, feedback: { kind: 'hint', hint }, wrongSquares: [] };
    }
    if (action.type === 'auto-hint') {
      const { state: core, hint } = requestHint(state.core, rules);
      return { ...state, core, hint };
    }
    if (action.type === 'reveal') {
      if (!state.pending) return state;
      const { reveal } = state.pending;
      return { ...state, pending: undefined, ...reveal };
    }
    // The scripted reply has not been shown yet: ignore kid input until it is (F5 fix — generic,
    // not only inside `ExerciseStep` any more).
    if (state.pending) return state;
    const kind = kindOf(state.core.def);
    const { state: core, outcome } = kind.act(state.core, action, rules);
    const patch = kindUiOf(state.core.def).toUi(outcome, action, core);
    return { ...state, core, ...patch };
  };
}

export interface ExerciseSessionOptions {
  readonly character: string;
  /** Guided tries: hint level 1 auto-shown, never scored. */
  readonly guided?: boolean;
  /** Board's check ring (all exercise types); default `true`. Series rounds pass `false` to keep
   * today's behaviour (no ring there — `docs/refactor-v4.md` follow-up F6). */
  readonly showCheck?: boolean;
  /** Overrides the stars shown (an easier-variant attempt credits the original's fixed stars). */
  readonly shownStars?: Stars;
  /** Whether an easier variant exists, offered once errors pile up. */
  readonly easier?: boolean;
  /** Persists a solved attempt; a falsy result (e.g. no active profile) leaves `saved` false. */
  readonly save?: (core: ExerciseState, ms: number) => Promise<void> | undefined | null;
}

export interface ExerciseSession {
  readonly state: ExerciseUIState;
  readonly dispatch: (action: SessionAction) => void;
  readonly solved: boolean;
  readonly stars: Stars;
  readonly saved: boolean;
  readonly offerEasier: boolean;
  readonly instruction: string;
  readonly note: SpeechBubbleNote | undefined;
  readonly replay: () => void;
  readonly checkSquare: Square | undefined;
  readonly elapsedMs: () => number;
}

/** One exercise attempt's whole session: the generic reducer, guided auto-hint, the mate-in-n
 * reply timer (generic here — F5 fix: a series round or review task no longer freezes on
 * mate-in-2+), the solved-save flow, and the instruction/note/narration/check-ring the Owl bubble
 * and board need. Shared by `ExerciseStep`, a `series` boss's round and `ReviewExerciseStep`. */
export function useExerciseSession(
  def: ExerciseDef,
  options: ExerciseSessionOptions,
): ExerciseSession {
  const { t } = useTranslation();
  const services = useServices();
  const { character, guided = false, showCheck = true, shownStars, easier = false, save } = options;

  const reducer = useMemo(() => sessionReducer(services.rules), [services.rules]);
  const [state, dispatch] = useReducer(reducer, def, initSessionState);

  // A lazy `useState` initializer (not a direct `Date.now()` call) keeps render pure.
  const [startedAt] = useState(() => Date.now());
  const savedRef = useRef(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (guided) dispatch({ type: 'auto-hint' });
    // Runs once for this mounted exercise; the caller remounts a fresh instance per exercise id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mate-in-n: reveals the scripted opponent reply — held back in `state.pending` — after a short
  // delay, so the kid sees their own move complete first (teaching-process.md §3.3). Generic here
  // (not only in one host) is exactly the F5 fix.
  useEffect(() => {
    if (!state.pending) return;
    const delay = prefersReducedMotion() ? REPLY_DELAY_REDUCED_MS : REPLY_DELAY_MS;
    const timer = setTimeout(() => {
      dispatch({ type: 'reveal' });
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [state.pending, dispatch]);

  const solved = state.core.solved;
  const stars = shownStars ?? starsFor(state.core);
  const offerEasier = easier && shouldOfferEasier(state.core);

  function elapsedMs(): number {
    return Date.now() - startedAt;
  }

  useEffect(() => {
    if (!solved || savedRef.current) return;
    const result = save?.(state.core, elapsedMs());
    if (!result) return; // e.g. no active profile yet: retried whenever `save` next changes
    savedRef.current = true;
    void result.then(() => {
      setSaved(true);
    });
    // `save` is a fresh closure each render (captures the host's own deps, e.g. the active
    // profile); depending on it here reruns this until a save actually starts, same as before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, state.core, save]);

  // The board's own displayed position (mate-in-n stages the reply behind `pending`; every other
  // type always shows `state.core.position`) — same rule the check ring used to apply only inside
  // `ExerciseStep`/`ReviewExerciseStep`, now shared.
  const displayedPosition = state.pending ? state.pending.position : state.core.position;
  const checkSquare =
    showCheck && isInCheck(displayedPosition, services.rules.chess)
      ? kingSquare(displayedPosition, displayedPosition.toMove)
      : undefined;

  const instruction = exerciseInstructionText(t, def);
  const note = exerciseNote(t, state.feedback, character, stars, offerEasier);
  // Instruction spoken once; each note spoken alone, never with the instruction re-read.
  const replay = useInstructionNarration(services.narrator, instruction, note?.text);

  return {
    state,
    dispatch,
    solved,
    stars,
    saved,
    offerEasier,
    instruction,
    note,
    replay,
    checkSquare,
    elapsedMs,
  };
}
