import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { PieceType, Square } from '../../core/chess/types.ts';
import type { VersusMiniGame } from '../../core/chess/lesson.ts';
import type { VersusState } from './def.ts';
import {
  canTakeBack,
  isKidTurn,
  kidMoveCount,
  playVersusMove,
  startVersus,
  takeBackVersusMove,
  versusEndReason,
  versusGameState,
  versusPosition,
} from './engine.ts';
import { chessJsRules } from '../../core/chess/chessjs-rules.ts';
import { isInCheck } from '../../core/chess/facts/position.ts';
import { kingSquare } from '../../core/chess/facts/pieces.ts';
import { bot } from '../../chess.ts';
import { useAppStore, useServices } from '@learn/platform-web/app/store.ts';
import { tContent } from '@learn/platform-web/content-text.ts';
import { UndoIcon } from '../../web/kinds/MovePlayArea.tsx';
import { Board } from '../../web/ui/board/Board.tsx';
import { isClassicOnlyContext, showPieceBadges } from '../../web/ui/board/piece-style.ts';
import { INFO_CHIP } from '@learn/platform-web/ui/ds/primitives-styles.ts';
import { SpeechBubble } from '@learn/platform-web/ui/ds/SpeechBubble.tsx';
import { useNarratedText } from '@learn/platform-web/ui/ds/useNarratedText.ts';
import { SECONDARY_BUTTON } from '@learn/platform-web/ui/lesson/button-styles.ts';
import { GameLayout } from '@learn/platform-web/ui/lesson/GameLayout.tsx';
import { prefersReducedMotion } from '@learn/platform-web/ui/useMediaQuery.ts';
import { BossResultPanel, useBossRun } from '@learn/platform-web/modes/boss-run.tsx';
import type { BossStepProps } from '@learn/platform-web/modes/mode-ui.ts';

export interface VersusStepProps extends BossStepProps<VersusMiniGame> {
  /** Fired after every ply with the latest state — for a caller that needs the in-progress game
   * outside `session.save`'s terminal-only call (recording an abandoned game on Leave). */
  readonly onStateChange?: (state: VersusState) => void;
}

/** localStorage key for a deterministic bot seed and a shortened "thinking" pause (tests only). */
const TEST_SEED_KEY = 'chess-kids:test-seed';

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

/** A seed for this bot move: the test override if set, else time-derived (never remote input). */
function nextBotSeed(): number {
  return readTestSeed() ?? Date.now() % 0xffffffff;
}

/** 0.8-1.5s normally; reduced motion or the test override shortens it, but never to instant. */
function botThinkDelayMs(): number {
  return readTestSeed() !== null || prefersReducedMotion() ? 300 : 800 + Math.random() * 700;
}

/** Aids per bot level (`docs/computer-opponent.md` §4); Mouse's for an unknown level (never: `opponentLevel` is 1-5). */
function aidsForLevel(level: number): bot.BotAids {
  return (
    bot.BOT_LEVELS.find((entry) => entry.level === level)?.aids ??
    (bot.BOT_LEVELS[0] as (typeof bot.BOT_LEVELS)[number]).aids
  );
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

/** A `versus` boss: the kid plays their colour against the computer (in a worker) with level-based aids, and Owl narrates moves and the result. */
export function Step({
  lesson,
  game: minigame,
  nextStepIndex,
  session,
  onStateChange,
}: VersusStepProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const pieceStyle = useAppStore((state) => state.activeProfileSettings.pieceStyle);
  const goToStep = useAppStore((state) => state.goToStep);
  const pieceBadges = showPieceBadges(
    pieceStyle,
    isClassicOnlyContext({
      worldId: lesson.world,
      kings: minigame.rules.kings,
      position: minigame.position,
    }),
  );

  const [versus, setVersus] = useState<VersusState>(() => startVersus(minigame));
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | undefined>(undefined);
  const [thinking, setThinking] = useState(false);
  const [takeBacksUsed, setTakeBacksUsed] = useState(0);
  const [spokenText, setSpokenText] = useState(() => tContent(t, minigame.goalKey));
  const [hint, setHint] = useState<{ from: Square; to: Square } | null>(null);

  useEffect(() => {
    onStateChange?.(versus);
    // Only `versus` should re-trigger this; `onStateChange` may not be memoized by every caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versus]);

  const run = useBossRun(versus, { lesson, nextStepIndex, session });
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
      void services.subject.botPlayer
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
          setHint(null);
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
    setHint(null);
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
    setHint(null);
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
    setHint(null);
    run.restart();
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleMateHint(): void {
    void bot.mateHint(versusGameState(versus), chessJsRules).then((found) => {
      if (found !== null) {
        setHint(found);
      }
    });
  }

  const position = versusPosition(versus);
  const kidTurn = !thinking && versus.status === 'playing' && isKidTurn(versus);
  const legalMoves = kidTurn ? chessJsRules.legalMoves(position) : [];
  const danger = aids.danger && versus.status === 'playing' ? dangerSquares(versus) : [];
  const moves = kidMoveCount(versus);
  // The checked king's square, whichever side (kid or bot): `Board`'s check ring applies to any exercise type.
  const checkSquare = isInCheck(position, chessJsRules)
    ? kingSquare(position, position.toMove)
    : undefined;
  const showHintOffer = kidTurn && bot.shouldOfferMateHint(moves);
  const drawReasonKey = drawReasonI18nKey(versusEndReason(versus));

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
              ...(checkSquare === undefined ? {} : { check: checkSquare }),
              ...(hint ? { hint: [hint.from, hint.to] } : {}),
            }}
            label={t('lesson.board-label')}
            pieceBadges={pieceBadges}
          />
        }
        panel={
          <>
            <SpeechBubble text={spokenText} onReplay={replay} />
            <div className={INFO_CHIP}>
              {thinking && <span>{t('boss.versus.thinking', { name: botName() })}</span>}
              <span>{t('boss.versus.moves', { count: moves })}</span>
            </div>
            {versus.status === 'playing' && (
              // `SECONDARY_BUTTON` bakes in `flex-1`: wrapped in its own row so it governs width,
              // not this column's main axis (which would shrink the button's height instead).
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleTakeBack}
                  disabled={!canTakeBackNow()}
                  className={`${SECONDARY_BUTTON} disabled:opacity-40`}
                >
                  <UndoIcon />
                  {t('boss.versus.take-back')}
                </button>
                {showHintOffer && (
                  <button type="button" onClick={handleMateHint} className={SECONDARY_BUTTON}>
                    {t('boss.versus.hint-offer')}
                  </button>
                )}
              </div>
            )}
            {versus.status !== 'playing' && (
              <BossResultPanel
                stars={run.stars}
                saved={run.saved}
                alwaysPlayAgain={versus.status !== 'won'}
                note={
                  versus.status === 'draw' && drawReasonKey ? (
                    <p className="text-center text-base font-bold text-muted">{t(drawReasonKey)}</p>
                  ) : undefined
                }
                session={session}
                onPlayAgain={handlePlayAgain}
                onNext={() => {
                  goToStep(nextStepIndex);
                }}
              />
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

/** A second, explaining line for a draw result (docs/computer-opponent.md §6): `undefined` for a
 * reason with no kid-friendly explanation, or no draw at all. */
function drawReasonI18nKey(
  reason: string | undefined,
):
  | 'boss.versus.draw-reason.stalemate'
  | 'boss.versus.draw-reason.insufficient-material'
  | 'boss.versus.draw-reason.threefold-repetition'
  | 'boss.versus.draw-reason.fifty-move'
  | undefined {
  switch (reason) {
    case 'stalemate':
      return 'boss.versus.draw-reason.stalemate';
    case 'insufficient-material':
      return 'boss.versus.draw-reason.insufficient-material';
    case 'threefold-repetition':
      return 'boss.versus.draw-reason.threefold-repetition';
    case 'fifty-move':
      return 'boss.versus.draw-reason.fifty-move';
    default:
      return undefined;
  }
}
