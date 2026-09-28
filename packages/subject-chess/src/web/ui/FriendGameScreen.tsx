import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Color, LocalPlayer, Position, Square } from '../../chess.ts';
import type { ChessContentSource } from '../adapters/content/bundled-content-source.ts';
import {
  chessJsRules,
  game,
  isInCheck,
  kingSquare,
  parseFen,
  recordLocalMatch,
} from '../../chess.ts';
import type { FriendBoardMode, FriendOpponentChoice } from '../slices/play.ts';
import { useAppStore, useServices } from '@learn/platform-web/app/store.ts';
import { Board } from './board/Board.tsx';
import type { BoardHighlights } from './board/Board.tsx';
import { isClassicOnlyContext, showPieceBadges } from './board/piece-style.ts';
import { GuestIcon } from '@learn/platform-web/ui/ds/icons-lazy.tsx';
import { tapClass } from '@learn/platform-web/ui/ds/tap.ts';
import { BlankScreen } from '@learn/platform-web/ui/ds/Screen.tsx';
import { ConfirmDialog } from '@learn/platform-web/ui/ds/ConfirmDialog.tsx';
import { AvatarBadge } from '@learn/platform-web/ui/ds/AvatarBadge.tsx';

/** Standard starting position, castling rights included — same as `FullGameScreen`'s vs-computer one. */
const FULL_GAME_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FULL_GAME_MOVE_LIMIT = 100;

/** Sizes `children` to the largest square that fits this wrapper's space (docs/screens.md §1),
 * measured via `ResizeObserver`; no-op in jsdom. */
function SquareArea({ children }: { readonly children: ReactNode }): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    // First size now, before paint: the observer's first callback lands a frame later, and until
    // then the unsized fallback fills the whole area (not square).
    const rect = element.getBoundingClientRect();
    setSize(Math.max(0, Math.min(rect.width, rect.height)));
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
  if (player.kind === 'profile') {
    return (
      <AvatarBadge
        avatar={player.avatar}
        className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full p-1.5"
      />
    );
  }
  return (
    <span
      className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full p-1.5"
      style={{ backgroundColor: '#EDEFF1' }}
    >
      <GuestIcon />
    </span>
  );
}

interface FriendGameDef {
  readonly rules: game.GameRulesDef;
  readonly position: Position;
}

/** The rules/position for `gameId`: the full game, or an unlocked `versus` mini-game's own
 * content; `null` for an unknown id (defensive only). */
function gameDefFor(gameId: string, content: ChessContentSource): FriendGameDef | null {
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

/** One player's turn indicator + Take back/Stop (ongoing) or result + Play again/Back to Play
 * (ended), reused for face-to-face's two strips and pass-and-play's single one. */
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
            className={tapClass('wide', 'neutral', 'disabled:opacity-40')}
          >
            {t('friend-play.take-back')}
          </button>
          <button type="button" onClick={onStop} className={tapClass('wide')}>
            {t('friend-play.stop')}
          </button>
        </div>
      ) : (
        saved && (
          <div className="flex flex-col items-end gap-2">
            <p className="font-display text-base font-semibold text-ink">{resultText}</p>
            <div className="flex gap-2">
              <button type="button" onClick={onPlayAgain} className={tapClass('wide')}>
                {t('play-again')}
              </button>
              <button type="button" onClick={onBackToPlay} className={tapClass('wide', 'go')}>
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
 * every hook here runs unconditionally). */
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
  const pieceStyle = useAppStore((state) => state.activeProfileSettings.pieceStyle);
  const pieceBadges = showPieceBadges(
    pieceStyle,
    isClassicOnlyContext({ kings: def.rules.kings, position: def.position }),
  );

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
    // Only `match` should re-trigger this; `services.deps`/players are stable for this screen.
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
              pieceBadges={pieceBadges}
            />
          </SquareArea>
          <PlayerStrip player={whitePlayer} isTurn={position.toMove === 'w'} {...stripCommon} />
        </div>
      ) : (
        // Pass-and-play: a single strip; board fills the height (not `GameLayout`, tuned for a
        // richer panel than this screen has).
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
              pieceBadges={pieceBadges}
            />
          </SquareArea>
          <PlayerStrip player={toMovePlayer} isTurn {...stripCommon} />
        </div>
      )}

      {takeBackAsk && (
        <ConfirmDialog
          title={t('friend-play.take-back-ask-title')}
          message={t('friend-play.take-back-ask', { name: toMovePlayer.nickname })}
          cancelLabel={t('exercise.no')}
          confirmLabel={t('exercise.yes')}
          confirmTone="go"
          onCancel={() => {
            respondTakeBack(false);
          }}
          onConfirm={() => {
            respondTakeBack(true);
          }}
        />
      )}

      {confirmStop && (
        <ConfirmDialog
          title={t('boss.versus.stop-game-title')}
          cancelLabel={t('boss.versus.stop-game-cancel')}
          confirmLabel={t('boss.versus.stop-game-confirm')}
          confirmTone="today"
          onCancel={() => {
            setConfirmStop(false);
          }}
          onConfirm={confirmStopNow}
        />
      )}
    </main>
  );
}

/** Play's vs Friend game screen (`docs/app-structure.md` §6): pass-and-play (board flips to the
 * mover) or face-to-face (fixed orientation, top side rotated 180°); per-player Take back + Stop. */
export function FriendGameScreen(): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const profile = useAppStore((state) => state.profile);
  const profiles = useAppStore((state) => state.profiles);
  const friendSetup = useAppStore((state) => state.friendSetup);
  const exitFriendGame = useAppStore((state) => state.exitFriendGame);

  if (!profile) {
    return <BlankScreen />;
  }
  const gameId = friendSetup.gameId ?? 'full';
  const def = gameDefFor(gameId, services.subject.content);
  if (!def) {
    return <BlankScreen />;
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
