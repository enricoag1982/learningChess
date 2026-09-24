import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Lesson, PieceType, Square, VersusMiniGame, VersusState } from '@chess-kids/core';
import {
  canTakeBack,
  chessJsRules,
  isKidTurn,
  kidMoveCount,
  playVersusMove,
  recordBossResult,
  startVersus,
  takeBackVersusMove,
  versusGameState,
  versusPosition,
  versusStars,
} from '@chess-kids/core';
import { useAppStore, useServices } from '../../app/store.ts';
import { tContent } from '../../content-text.ts';
import { Board } from '../board/Board.tsx';
import { ReplayButton } from '../ReplayButton.tsx';
import { SpeechBubble } from '../SpeechBubble.tsx';
import { StarsRow } from '../StarsRow.tsx';
import { useNarratedText } from '../useNarratedText.ts';
import { SECONDARY_BUTTON } from './button-styles.ts';
import { UndoIcon } from './exercise-icons.tsx';
import { GameLayout } from './GameLayout.tsx';
import { NextButton } from './NextButton.tsx';

export interface VersusStepProps {
  readonly lesson: Lesson;
  readonly game: VersusMiniGame;
  readonly nextStepIndex: number;
}

/** localStorage key for a deterministic bot seed and a shortened "thinking" pause (tests only). */
const TEST_SEED_KEY = 'chess-kids:test-seed';

/** Reads the test-only seed override, if any; never throws (private browsing, disabled storage). */
function readTestSeed(): number | null {
  try {
    const raw = window.localStorage.getItem(TEST_SEED_KEY);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  } catch {
    return null;
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** A seed for this bot move: the test override if set, else time-derived (never remote input). */
function nextBotSeed(): number {
  return readTestSeed() ?? Date.now() % 0xffffffff;
}

/** 0.8-1.5s normally; reduced motion or the test override shortens it, but never to instant. */
function botThinkDelayMs(): number {
  return readTestSeed() !== null || prefersReducedMotion() ? 300 : 800 + Math.random() * 700;
}

/** Aids per bot level (`docs/computer-opponent.md` §4): Mouse/Rabbit, Fox, Wolf/Bear. */
interface VersusAids {
  readonly takeBack: 'unlimited' | 'limited' | 'none';
  readonly takeBackLimit: number;
  readonly danger: boolean;
}

function aidsForLevel(level: number): VersusAids {
  if (level <= 2) return { takeBack: 'unlimited', takeBackLimit: Infinity, danger: true };
  if (level === 3) return { takeBack: 'limited', takeBackLimit: 3, danger: true };
  return { takeBack: 'none', takeBackLimit: 0, danger: false };
}

function other(color: 'w' | 'b'): 'w' | 'b' {
  return color === 'w' ? 'b' : 'w';
}

/** Kid pieces that are attacked and defended by no other kid piece (Mouse/Rabbit/Fox aid). */
function dangerSquares(state: VersusState): readonly Square[] {
  const position = versusPosition(state);
  const kidColor = state.def.kidColor;
  const opponentColor = other(kidColor);
  return Object.entries(position.pieces)
    .filter(([, piece]) => piece.color === kidColor)
    .map(([square]) => square as Square)
    .filter(
      (square) =>
        chessJsRules.attackers(position, square, opponentColor).length > 0 &&
        chessJsRules.attackers(position, square, kidColor).length === 0,
    );
}

/**
 * A `versus` boss mini-game (Pawn Wars, …): the kid plays their colour against the computer
 * opponent (`BotPlayer`, running in a worker), with Mouse-level aids (take back, danger ring,
 * legal-move dots) and Owl narrating the bot's moves and the result.
 */
export function VersusStep({
  lesson,
  game: minigame,
  nextStepIndex,
}: VersusStepProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const goToStep = useAppStore((state) => state.goToStep);
  const refreshProgress = useAppStore((state) => state.refreshProgress);

  const [versus, setVersus] = useState<VersusState>(() => startVersus(minigame));
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | undefined>(undefined);
  const [thinking, setThinking] = useState(false);
  const [takeBacksUsed, setTakeBacksUsed] = useState(0);
  const [spokenText, setSpokenText] = useState(() => tContent(t, minigame.goalKey));
  // A lazy `useState` initializer (not a direct `Date.now()` call) keeps render pure; the ref
  // exists because "Play again" needs to reset the clock later, which `useState` can't do.
  const [initialStartedAt] = useState(() => Date.now());
  const startedAtRef = useRef(initialStartedAt);
  const savedRef = useRef(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const aids = aidsForLevel(minigame.opponentLevel);
  const replay = useNarratedText(services.narrator, spokenText);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (versus.status === 'playing' || savedRef.current || !profile) return;
    savedRef.current = true;
    void recordBossResult(services.deps, {
      profileId: profile.id,
      lesson,
      state: versus,
      durationMs: Date.now() - startedAtRef.current,
      nextStep: nextStepIndex,
    }).then(() => {
      setSaved(true);
      void refreshProgress();
    });
  }, [versus, profile, services.deps, lesson, nextStepIndex, refreshProgress]);

  function pieceLabel(type: PieceType): string {
    return t(`board.piece.${type}`);
  }

  function botName(): string {
    return t(`boss.versus.bot-name.${botNameKey(minigame.opponentLevel)}`);
  }

  function scheduleBotReply(after: VersusState): void {
    setThinking(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void services.botPlayer
        .chooseMove(versusGameState(after), minigame.opponentLevel, nextBotSeed())
        .then((botMove) => {
          if (botMove === null) {
            setThinking(false);
            return;
          }
          const { state: afterBot, outcome } = playVersusMove(after, chessJsRules, {
            from: botMove.from,
            to: botMove.to,
            promotion: botMove.promotion,
          });
          setVersus(afterBot);
          setLastMove({ from: botMove.from, to: botMove.to });
          setThinking(false);
          if (outcome.kind === 'ended') {
            setSpokenText(resultText(t, outcome.status));
          } else if (botMove.captured) {
            setSpokenText(
              t('boss.versus.bot-captured', {
                name: botName(),
                piece: pieceLabel(botMove.captured),
              }),
            );
          } else {
            setSpokenText(
              t('boss.versus.bot-moved', { name: botName(), piece: pieceLabel(botMove.piece) }),
            );
          }
        })
        .catch((error: unknown) => {
          // The search itself never throws in normal play; surfaces a worker/adapter failure
          // instead of leaving the kid stuck on "thinking" forever.
          console.error('versus boss: bot move failed', error);
          setThinking(false);
        });
    }, botThinkDelayMs());
  }

  function handleMove(move: { from: Square; to: Square }): void {
    if (thinking || versus.status !== 'playing' || !isKidTurn(versus)) return;
    const { state: afterKid, outcome } = playVersusMove(versus, chessJsRules, move);
    if (outcome.kind === 'illegal') return;
    setVersus(afterKid);
    setLastMove(move);
    if (outcome.kind === 'ended') {
      setSpokenText(resultText(t, outcome.status));
      return;
    }
    if (outcome.move.captured) {
      setSpokenText(t('boss.versus.kid-captured', { piece: pieceLabel(outcome.move.captured) }));
    }
    scheduleBotReply(afterKid);
  }

  function handleTakeBack(): void {
    if (!canTakeBackNow()) return;
    setVersus((current) => takeBackVersusMove(current));
    setLastMove(undefined);
    setTakeBacksUsed((count) => count + 1);
    setSpokenText(tContent(t, minigame.goalKey));
  }

  function canTakeBackNow(): boolean {
    if (aids.takeBack === 'none') return false;
    if (aids.takeBack === 'limited' && takeBacksUsed >= aids.takeBackLimit) return false;
    return canTakeBack(versus);
  }

  function handlePlayAgain(): void {
    setVersus(startVersus(minigame));
    setLastMove(undefined);
    setThinking(false);
    setTakeBacksUsed(0);
    setSpokenText(tContent(t, minigame.goalKey));
    startedAtRef.current = Date.now();
    savedRef.current = false;
    setSaved(false);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  const position = versusPosition(versus);
  const kidTurn = !thinking && versus.status === 'playing' && isKidTurn(versus);
  const legalMoves = kidTurn ? chessJsRules.legalMoves(position) : [];
  const danger = aids.danger && versus.status === 'playing' ? dangerSquares(versus) : [];
  const stars = versusStars(versus);
  const moves = kidMoveCount(versus);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-4"
      data-versus-status={versus.status}
      data-versus-turn={isKidTurn(versus) && !thinking ? 'kid' : 'bot'}
    >
      <h2 className="text-center font-display text-xl text-ink sm:text-3xl">
        {tContent(t, minigame.titleKey)}
      </h2>
      <GameLayout
        board={
          <Board
            position={position}
            legalMoves={legalMoves}
            orientation={minigame.kidColor}
            onMove={handleMove}
            highlights={{
              ...(lastMove ? { lastMove } : {}),
              ...(danger.length > 0 ? { danger } : {}),
            }}
            label={t('lesson.board-label')}
          />
        }
        panel={
          <>
            <SpeechBubble text={spokenText} />
            <ReplayButton onClick={replay} label={t('exercise.replay')} />
            <div className="flex flex-col gap-1 rounded-3xl border-2 border-line bg-card px-5 py-4 font-display text-lg text-ink">
              {thinking && <span>{t('boss.versus.thinking', { name: botName() })}</span>}
              <span>{t('boss.versus.moves', { count: moves })}</span>
            </div>
            {versus.status === 'playing' && (
              // `SECONDARY_BUTTON` bakes in `flex-1` for its usual row-of-buttons context (e.g.
              // Hint + Undo sharing a row's width); wrapped here in its own row so that `flex-1`
              // governs width, not this column's main axis, which would otherwise let the
              // button's height shrink to share space with everything above it.
              <div className="flex">
                <button
                  type="button"
                  onClick={handleTakeBack}
                  disabled={!canTakeBackNow()}
                  className={`${SECONDARY_BUTTON} disabled:opacity-40`}
                >
                  <UndoIcon />
                  {t('boss.versus.take-back')}
                </button>
              </div>
            )}
            {versus.status === 'won' && (
              <div className="mt-auto flex flex-col items-center gap-4">
                <StarsRow earned={stars} animate />
                {saved && (
                  <NextButton
                    onClick={() => {
                      goToStep(nextStepIndex);
                    }}
                    className="w-full"
                  />
                )}
              </div>
            )}
            {(versus.status === 'lost' || versus.status === 'draw') && (
              <div className="mt-auto flex flex-col items-center gap-4">
                <StarsRow earned={stars} animate />
                {saved && (
                  <div className="flex w-full gap-3">
                    <button type="button" onClick={handlePlayAgain} className={SECONDARY_BUTTON}>
                      {t('play-again')}
                    </button>
                    <NextButton
                      onClick={() => {
                        goToStep(nextStepIndex);
                      }}
                      className="flex-1"
                    />
                  </div>
                )}
              </div>
            )}
          </>
        }
      />
    </div>
  );
}

function botNameKey(level: number): 'mouse' | 'rabbit' | 'fox' | 'wolf' | 'bear' {
  if (level <= 1) return 'mouse';
  if (level === 2) return 'rabbit';
  if (level === 3) return 'fox';
  if (level === 4) return 'wolf';
  return 'bear';
}

function resultText(t: TFunction, status: 'won' | 'lost' | 'draw'): string {
  if (status === 'won') return t('boss.versus.won');
  if (status === 'draw') return t('boss.versus.draw');
  return t('boss.versus.lost');
}
