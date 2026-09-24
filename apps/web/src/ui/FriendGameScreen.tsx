import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Color, ContentSource, LocalPlayer, Position, Square } from '@chess-kids/core';
import {
  chessJsRules,
  game,
  isInCheck,
  kingSquare,
  parseFen,
  recordLocalMatch,
} from '@chess-kids/core';
import type { FriendBoardMode, FriendOpponentChoice } from '../app/store.ts';
import { useAppStore, useServices } from '../app/store.ts';
import { avatarBackground } from './art/avatar-meta.ts';
import { AvatarIcon } from './art/avatars.tsx';
import { Board } from './board/Board.tsx';
import type { BoardHighlights } from './board/Board.tsx';

/** Standard starting position, castling rights included — same as `FullGameScreen`'s vs-computer one. */
const FULL_GAME_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FULL_GAME_MOVE_LIMIT = 100;

/**
 * Sizes `children` to the largest square that fits this wrapper's own available space —
 * `size = min(available width, available height)`, centred (docs/screens.md §1 "Board >= 75% of
 * screen height"). The lesson / versus screens get a square board from `GameLayout`'s own
 * viewport-tuned CSS caps, tuned around a panel that is always at least as tall as the board's
 * `42–46vh` cap; a vs Friend match's per-player strips are much shorter (and, in face-to-face,
 * there are two of them), so that fixed cap would either overflow or leave dead space depending on
 * the strip heights actually rendered. This measures the real box instead, via `ResizeObserver`,
 * and sets an explicit pixel size — exact regardless of strip height or viewport. No-op (renders
 * unsized, `flex-1`, `aspect-square`) where `ResizeObserver` is unavailable (jsdom in RTL tests,
 * which never exercises real layout/geometry, only DOM structure and interaction).
 */
function SquareArea({ children }: { readonly children: ReactNode }): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize(Math.max(0, Math.min(entry.contentRect.width, entry.contentRect.height)));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
      <div
        className={size === null ? 'aspect-square h-full max-h-full w-full max-w-full' : undefined}
        style={size === null ? undefined : { width: size, height: size }}
      >
        {children}
      </div>
    </div>
  );
}

function GuestIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
      <circle cx={50} cy={38} r={20} fill="#B7C2CB" />
      <path d="M18 88c0-20 14-32 32-32s32 12 32 32Z" fill="#B7C2CB" />
    </svg>
  );
}

/** One local player, as the friend game screen displays it (both sides read alike). */
type PlayerDisplay =
  | {
      readonly kind: 'profile';
      readonly profileId: string;
      readonly nickname: string;
      readonly avatar: string;
    }
  | { readonly kind: 'guest'; readonly nickname: string };

function toLocalPlayer(player: PlayerDisplay): LocalPlayer {
  return player.kind === 'profile'
    ? { kind: 'profile', profileId: player.profileId }
    : { kind: 'guest' };
}

function PlayerAvatar({ player }: { readonly player: PlayerDisplay }): JSX.Element {
  return (
    <span
      className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full p-1.5"
      style={{
        backgroundColor: player.kind === 'profile' ? avatarBackground(player.avatar) : '#EDEFF1',
      }}
    >
      {player.kind === 'profile' ? <AvatarIcon avatar={player.avatar} /> : <GuestIcon />}
    </span>
  );
}

interface FriendGameDef {
  readonly rules: game.GameRulesDef;
  readonly position: Position;
}

/** The rules/position for `gameId`: the full game (built the same way as `FullGameScreen`'s vs
 * computer one), or an unlocked `versus` mini-game's own content — `null` for an unknown id
 * (defensive only: the setup sheet only ever offers ids `friendGameOptions` already unlocked). */
function gameDefFor(gameId: string, content: ContentSource): FriendGameDef | null {
  if (gameId === 'full') {
    return {
      rules: {
        kings: true,
        checkRules: true,
        noMoves: 'draw',
        win: { w: [{ kind: 'checkmate' }], b: [{ kind: 'checkmate' }] },
        moveLimit: FULL_GAME_MOVE_LIMIT,
      },
      position: parseFen(FULL_GAME_START_FEN),
    };
  }
  const minigame = content.minigame(gameId);
  if (!minigame || minigame.mode !== 'versus') return null;
  return { rules: minigame.rules, position: minigame.position };
}

function resolveOpponent(
  choice: FriendOpponentChoice | null,
  profiles: readonly { readonly id: string; readonly nickname: string; readonly avatar: string }[],
  guestName: string,
): PlayerDisplay {
  if (choice?.kind === 'profile') {
    const found = profiles.find((candidate) => candidate.id === choice.profileId);
    if (found) {
      return {
        kind: 'profile',
        profileId: found.id,
        nickname: found.nickname,
        avatar: found.avatar,
      };
    }
  }
  return { kind: 'guest', nickname: guestName };
}

interface PlayerStripProps {
  readonly player: PlayerDisplay;
  readonly isTurn: boolean;
  readonly ongoing: boolean;
  readonly canTakeBack: boolean;
  readonly onTakeBack: () => void;
  readonly onStop: () => void;
  readonly resultText: string;
  readonly saved: boolean;
  readonly onPlayAgain: () => void;
  readonly onBackToPlay: () => void;
  /** Face-to-face only: rotates this whole strip 180° so the far side reads it upright. */
  readonly rotate?: boolean;
}

/** One player's own turn indicator + Take back / Stop (ongoing) or result + Play again / Back to
 * Play (ended) — `docs/screens.md` #8 "take back + exit per player". Reused for face-to-face's two
 * mirrored strips and pass-and-play's single one. */
function PlayerStrip({
  player,
  isTurn,
  ongoing,
  canTakeBack,
  onTakeBack,
  onStop,
  resultText,
  saved,
  onPlayAgain,
  onBackToPlay,
  rotate = false,
}: PlayerStripProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 px-4 py-3 ${
        isTurn && ongoing ? 'border-go bg-white' : 'border-line bg-card'
      } ${rotate ? 'rotate-180' : ''}`}
    >
      <div className="flex items-center gap-3">
        <PlayerAvatar player={player} />
        <span className="flex flex-col">
          <span className="font-display text-lg font-semibold text-ink">{player.nickname}</span>
          {isTurn && ongoing && (
            <span className="text-sm font-bold text-go">{t('friend-play.turn')}</span>
          )}
        </span>
      </div>
      {ongoing ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onTakeBack}
            disabled={!canTakeBack}
            className="flex h-16 items-center justify-center rounded-2xl border-2 border-line bg-card px-4 font-display text-base font-semibold text-ink disabled:opacity-40"
          >
            {t('friend-play.take-back')}
          </button>
          <button
            type="button"
            onClick={onStop}
            className="flex h-16 items-center justify-center rounded-2xl border-2 border-line bg-card px-4 font-display text-base font-semibold text-ink"
          >
            {t('friend-play.stop')}
          </button>
        </div>
      ) : (
        saved && (
          <div className="flex flex-col items-end gap-2">
            <p className="font-display text-base font-semibold text-ink">{resultText}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onPlayAgain}
                className="flex h-16 items-center justify-center rounded-2xl border-2 border-line bg-card px-4 font-display text-base font-semibold text-ink"
              >
                {t('play-again')}
              </button>
              <button
                type="button"
                onClick={onBackToPlay}
                className="flex h-16 items-center justify-center rounded-2xl bg-go px-4 font-display text-base font-semibold text-white"
              >
                {t('play.back-to-play')}
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

interface FriendMatchProps {
  readonly gameId: string;
  readonly def: FriendGameDef;
  readonly activePlayer: PlayerDisplay;
  readonly opponent: PlayerDisplay;
  readonly boardMode: FriendBoardMode;
  readonly legalMoveDots: boolean;
  readonly initialSwapColours: boolean;
  readonly onExit: () => void;
}

/** The live match + result, once a valid game/def/players are resolved (a separate component so
 * every hook here runs unconditionally, same split as `FullGameScreen` / `VersusStep`). */
function FriendMatch({
  gameId,
  def,
  activePlayer,
  opponent,
  boardMode,
  legalMoveDots,
  initialSwapColours,
  onExit,
}: FriendMatchProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();

  const [swapped, setSwapped] = useState(initialSwapColours);
  const [match, setMatch] = useState<game.LocalMatchState>(() =>
    game.startLocalMatch(def.rules, def.position),
  );
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | undefined>(undefined);
  const [takeBackAsk, setTakeBackAsk] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const savedRef = useRef(false);
  const [saved, setSaved] = useState(false);

  const whitePlayer = swapped ? opponent : activePlayer;
  const blackPlayer = swapped ? activePlayer : opponent;

  const position = game.localMatchPosition(match);
  const result = game.localMatchResult(match, chessJsRules);
  const ongoing = result.kind === 'ongoing';
  const faceToFace = boardMode === 'face-to-face';
  const orientation: Color = faceToFace ? 'w' : position.toMove;
  const legalMoves = ongoing ? chessJsRules.legalMoves(position) : [];
  const checkSquare = isInCheck(position, chessJsRules)
    ? kingSquare(position, position.toMove)
    : undefined;
  const toMovePlayer = position.toMove === 'w' ? whitePlayer : blackPlayer;

  useEffect(() => {
    if (ongoing || savedRef.current) return;
    savedRef.current = true;
    void recordLocalMatch(services.deps, {
      game: gameId,
      white: toLocalPlayer(whitePlayer),
      black: toLocalPlayer(blackPlayer),
      outcome: { kind: 'result', result },
      moves: game.localMatchGameState(match).history.map((move) => move.san),
    }).then(() => {
      setSaved(true);
    });
    // Only the match itself should re-trigger this (mirrors `VersusStep`'s own save effect):
    // `services.deps`/players are stable for the life of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match]);

  function handleMove(move: { readonly from: Square; readonly to: Square }): void {
    if (!ongoing) return;
    const played = game.playLocalMove(match, chessJsRules, move);
    if (played.outcome.kind === 'illegal') return;
    setMatch(played.state);
    setLastMove(move);
  }

  function requestTakeBack(): void {
    if (!game.canTakeBack(match, chessJsRules)) return;
    setTakeBackAsk(true);
  }

  function respondTakeBack(allow: boolean): void {
    setTakeBackAsk(false);
    if (!allow) return;
    setMatch((current) => game.takeBack(current, chessJsRules));
    setLastMove(undefined);
  }

  function requestStop(): void {
    if (!ongoing) {
      onExit();
      return;
    }
    setConfirmStop(true);
  }

  function confirmStopNow(): void {
    setConfirmStop(false);
    void recordLocalMatch(services.deps, {
      game: gameId,
      white: toLocalPlayer(whitePlayer),
      black: toLocalPlayer(blackPlayer),
      outcome: { kind: 'abandoned' },
      moves: game.localMatchGameState(match).history.map((move) => move.san),
    }).then(onExit);
  }

  function playAgain(): void {
    setSwapped((value) => !value);
    setMatch(game.startLocalMatch(def.rules, def.position));
    setLastMove(undefined);
    savedRef.current = false;
    setSaved(false);
    setConfirmStop(false);
    setTakeBackAsk(false);
  }

  function resultText(): string {
    if (result.kind === 'draw') return t('friend-play.result-draw');
    if (result.kind === 'win') {
      const winner = result.winner === 'w' ? whitePlayer : blackPlayer;
      return t('friend-play.result-win', { name: winner.nickname });
    }
    return '';
  }

  const highlights: BoardHighlights = {
    ...(lastMove ? { lastMove } : {}),
    ...(checkSquare === undefined ? {} : { check: checkSquare }),
  };

  const stripCommon = {
    ongoing,
    canTakeBack: game.canTakeBack(match, chessJsRules),
    onTakeBack: requestTakeBack,
    onStop: requestStop,
    resultText: resultText(),
    saved,
    onPlayAgain: playAgain,
    onBackToPlay: onExit,
  };

  return (
    <main
      className="flex h-dvh flex-col gap-3 overflow-y-auto bg-cream px-3 py-3 sm:px-8 sm:py-6"
      data-friend-match-status={ongoing ? 'ongoing' : result.kind}
      data-friend-match-turn={position.toMove}
    >
      {faceToFace ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <PlayerStrip
            player={blackPlayer}
            isTurn={position.toMove === 'b'}
            rotate
            {...stripCommon}
          />
          <SquareArea>
            <Board
              position={position}
              legalMoves={legalMoves}
              orientation="w"
              rotateTopPieces
              showLegalMoveDots={legalMoveDots}
              onMove={handleMove}
              highlights={highlights}
              label={t('lesson.board-label')}
            />
          </SquareArea>
          <PlayerStrip player={whitePlayer} isTurn={position.toMove === 'w'} {...stripCommon} />
        </div>
      ) : (
        // Pass-and-play: a single strip (the board itself flips to face whoever moves next), laid
        // out the same board-fills-the-height way as face-to-face — `GameLayout`'s side-by-side /
        // capped-height shape is tuned for a richer panel (speech bubble, replay, …) than this
        // screen has, and would otherwise leave the board small with dead space beneath it.
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <SquareArea>
            <Board
              position={position}
              legalMoves={legalMoves}
              orientation={orientation}
              showLegalMoveDots={legalMoveDots}
              onMove={handleMove}
              highlights={highlights}
              label={t('lesson.board-label')}
            />
          </SquareArea>
          <PlayerStrip player={toMovePlayer} isTurn {...stripCommon} />
        </div>
      )}

      {takeBackAsk && (
        <div
          role="alertdialog"
          aria-label={t('friend-play.take-back-ask-title')}
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4"
        >
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border-2 border-line bg-card p-6 text-center">
            <p className="font-display text-xl text-ink">
              {t('friend-play.take-back-ask', { name: toMovePlayer.nickname })}
            </p>
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={() => {
                  respondTakeBack(false);
                }}
                className="flex h-14 flex-1 items-center justify-center rounded-2xl border-2 border-line bg-card font-display text-lg font-semibold text-ink"
              >
                {t('exercise.no')}
              </button>
              <button
                type="button"
                onClick={() => {
                  respondTakeBack(true);
                }}
                className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-go font-display text-lg font-semibold text-white"
              >
                {t('exercise.yes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmStop && (
        <div
          role="alertdialog"
          aria-label={t('boss.versus.stop-game-title')}
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4"
        >
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border-2 border-line bg-card p-6 text-center">
            <p className="font-display text-xl text-ink">{t('boss.versus.stop-game-title')}</p>
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmStop(false);
                }}
                className="flex h-14 flex-1 items-center justify-center rounded-2xl border-2 border-line bg-card font-display text-lg font-semibold text-ink"
              >
                {t('boss.versus.stop-game-cancel')}
              </button>
              <button
                type="button"
                onClick={confirmStopNow}
                className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-today font-display text-lg font-semibold text-white"
              >
                {t('boss.versus.stop-game-confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * Play's vs Friend game screen (M4.3, `docs/app-structure.md` §6 / `docs/screens.md` #8):
 * pass-and-play (board flips to the mover each move) or face-to-face (fixed orientation, the top
 * side's pieces + strip rotated 180°); per-player Take back (with the other player's Yes/No) and
 * Stop; result names the winner by nickname ("Guest" for a guest).
 */
export function FriendGameScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const profiles = useAppStore((state) => state.profiles);
  const friendSetup = useAppStore((state) => state.friendSetup);
  const exitFriendGame = useAppStore((state) => state.exitFriendGame);

  if (!profile) {
    return <main className="min-h-screen bg-cream" />;
  }
  const gameId = friendSetup.gameId ?? 'full';
  const def = gameDefFor(gameId, services.deps.content);
  if (!def) {
    return <main className="min-h-screen bg-cream" />;
  }

  const opponent = resolveOpponent(friendSetup.opponent, profiles, t('friend-play.guest'));
  const activePlayer: PlayerDisplay = {
    kind: 'profile',
    profileId: profile.id,
    nickname: profile.nickname,
    avatar: profile.avatar,
  };

  return (
    <FriendMatch
      key={gameId}
      gameId={gameId}
      def={def}
      activePlayer={activePlayer}
      opponent={opponent}
      boardMode={friendSetup.boardMode}
      legalMoveDots={friendSetup.legalMoveDots}
      initialSwapColours={friendSetup.swapColours}
      onExit={exitFriendGame}
    />
  );
}
