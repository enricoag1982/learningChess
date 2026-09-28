import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AnyKind, ExerciseDefBase, ExerciseStateBase, Stars } from '@learn/platform-core';
import { shouldOfferEasier } from '@learn/platform-core';
import { usePack } from '../app/subject.ts';
import { useServices } from '../app/store.ts';
import type { SpeechBubbleNote } from '../ui/ds/SpeechBubble.tsx';
import { useInstructionNarration } from '@learn/platform-web/ui/ds/useNarratedText.ts';
import { exerciseInstructionText, exerciseNote } from '../ui/lesson/exercise-text.ts';
import { prefersReducedMotion } from '@learn/platform-web/ui/useMediaQuery.ts';
import type { AnyExerciseKindUI, ExerciseUIState, SessionAction } from './kind-ui.ts';

/** mate-in-n: how long the scripted opponent reply stays hidden before it is shown and narrated. */
const REPLY_DELAY_MS = 600;
const REPLY_DELAY_REDUCED_MS = 150;

/** Fresh reducer state for a newly-started exercise; `kindUi.initUi(def)` seeds a kind's own extras
 * (a move kind: `def.lastMove`, if any). */
function initSessionState(
  def: ExerciseDefBase,
  kind: AnyKind<unknown>,
  kindUi: AnyExerciseKindUI,
): ExerciseUIState {
  return {
    core: kind.init(def),
    hint: null,
    feedback: { kind: 'instruction' },
    ...kindUi.initUi(def),
  };
}

/** The generic reducer every exercise kind shares: a `UiAction` is handled directly; any other
 * action goes through `kind.act` + `kindUi.toUi` — the one exercise-type dispatch left in session
 * plumbing, and it is the active pack's, not a local `switch`. */
function sessionReducer(
  ctx: unknown,
  kind: AnyKind<unknown>,
  kindUi: AnyExerciseKindUI,
): (state: ExerciseUIState, action: SessionAction) => ExerciseUIState {
  return function reduce(state, action) {
    if (action.type === 'tap-first') {
      return { ...state, feedback: { kind: 'tap-first' } };
    }
    if (action.type === 'hint') {
      const level = (state.core.hintLevel < 3 ? state.core.hintLevel + 1 : 3) as 1 | 2 | 3;
      const { state: core, hint } = kind.hint(state.core, level, ctx);
      return {
        ...state,
        core,
        hint,
        feedback: { kind: 'hint', hint },
        ...kindUi.clearWrongUi(),
      };
    }
    if (action.type === 'auto-hint') {
      const level = (state.core.hintLevel < 3 ? state.core.hintLevel + 1 : 3) as 1 | 2 | 3;
      const { state: core, hint } = kind.hint(state.core, level, ctx);
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
    const { state: core, outcome } = kind.act(state.core, action, ctx);
    const patch = kindUi.toUi(outcome, action, core);
    return { ...state, core, ...patch };
  };
}

export interface ExerciseSessionOptions {
  readonly character: string;
  /** Guided tries: hint level 1 auto-shown, never scored. */
  readonly guided?: boolean;
  /** Overrides the stars shown (an easier-variant attempt credits the original's fixed stars). */
  readonly shownStars?: Stars;
  /** Whether an easier variant exists, offered once errors pile up. */
  readonly easier?: boolean;
  /** Persists a solved attempt; a falsy result (e.g. no active profile) leaves `saved` false. */
  readonly save?: (core: ExerciseStateBase, ms: number) => Promise<void> | undefined | null;
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
  readonly elapsedMs: () => number;
}

/** One exercise attempt's whole session: the generic reducer, guided auto-hint, the mate-in-n
 * reply timer (generic here — F5 fix: a series round or review task no longer freezes on
 * mate-in-2+), the solved-save flow, and the instruction/note/narration the Owl bubble needs.
 * Shared by `ExerciseStep`, a `series` boss's round and `ReviewExerciseStep`. */
export function useExerciseSession(
  def: ExerciseDefBase,
  options: ExerciseSessionOptions,
): ExerciseSession {
  const { t } = useTranslation();
  const services = useServices();
  const pack = usePack();
  const { character, guided = false, shownStars, easier = false, save } = options;

  const kind = pack.core.kinds[def.type];
  const kindUi = pack.kinds[def.type];
  if (!kind || !kindUi) {
    throw new Error(`useExerciseSession: no kind registered for type "${def.type}"`);
  }

  const reducer = useMemo(
    () => sessionReducer(pack.core.context, kind, kindUi),
    [pack, kind, kindUi],
  );
  const [state, dispatch] = useReducer(reducer, def, (d) => initSessionState(d, kind, kindUi));

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
  const stars = shownStars ?? (solved ? kind.stars(state.core) : 0);
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

  const instruction = exerciseInstructionText(t, def);
  const note = exerciseNote(
    t,
    state.feedback,
    character,
    stars,
    offerEasier,
    pack.core.notes,
    pack.core.noteVars(character),
  );
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
    elapsedMs,
  };
}
