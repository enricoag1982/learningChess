import { toFen } from '../chess/fen.ts';
import type { ChessRules, Move, MoveInput } from '../chess/rules.ts';
import type { Position } from '../chess/types.ts';
import type { GameBoardView } from './terminal.ts';
import { evaluateTerminal } from './terminal.ts';
import type { GameResult, GameRulesDef, GameState, WinCondition } from './types.ts';

/** Starts a new variant game at `position` under `def`. */
export function startGame(def: GameRulesDef, position: Position): GameState {
  return { position, history: [], def, positions: [position], halfmoveClock: 0 };
}

/** Legal moves for the side to move. Games use no walls, so this is plain chess legality. */
export function legalGameMoves(state: GameState, rules: ChessRules): Move[] {
  return rules.legalMoves(state.position);
}

/** Plays a move, or returns `null` if it is illegal or the game has already ended. */
export function playGameMove(
  state: GameState,
  rules: ChessRules,
  move: MoveInput,
): { readonly state: GameState; readonly move: Move } | null {
  if (gameResult(state, rules).kind !== 'ongoing') {
    return null;
  }
  const played = rules.play(state.position, move);
  if (played === null) {
    return null;
  }
  const resetsClock = played.move.piece === 'p' || played.move.captured !== undefined;
  const nextState: GameState = {
    position: played.position,
    history: [...state.history, played.move],
    def: state.def,
    positions: [...state.positions, played.position],
    halfmoveClock: resetsClock ? 0 : state.halfmoveClock + 1,
  };
  return { state: nextState, move: played.move };
}

/** Occurrences of the current position (piece placement, side to move, castling, en passant). */
function repetitionCount(state: GameState): number {
  const key = toFen(state.position);
  return state.positions.filter((position) => toFen(position) === key).length;
}

function fullMovesPlayed(state: GameState): number {
  return Math.floor(state.history.length / 2);
}

function findSurvive(
  conditions: readonly WinCondition[],
): Extract<WinCondition, { kind: 'survive' }> | undefined {
  return conditions.find(
    (condition): condition is Extract<WinCondition, { kind: 'survive' }> =>
      condition.kind === 'survive',
  );
}

/** Current outcome: ongoing, a win (with a reason), or a draw (with a reason). */
export function gameResult(state: GameState, rules: ChessRules): GameResult {
  const { position, def, history } = state;
  const lastMove = history[history.length - 1];
  const legalMoves = rules.legalMoves(position);
  const status = rules.status(position);

  const view: GameBoardView = {
    toMove: position.toMove,
    pieces: position.pieces,
    legalMoveCount: legalMoves.length,
    inCheck: status.check,
  };
  const terminal = evaluateTerminal(def, view, lastMove);
  if (terminal.kind !== 'ongoing') {
    return terminal;
  }

  if (def.checkRules && status.insufficientMaterial) {
    return { kind: 'draw', reason: 'insufficient-material' };
  }
  if (repetitionCount(state) >= 3) {
    return { kind: 'draw', reason: 'threefold-repetition' };
  }
  if (state.halfmoveClock >= 100) {
    return { kind: 'draw', reason: 'fifty-move' };
  }

  if (def.moveLimit !== undefined) {
    const fullMoves = fullMovesPlayed(state);
    if (fullMoves >= def.moveLimit) {
      for (const color of ['w', 'b'] as const) {
        const survive = findSurvive(def.win[color]);
        if (survive !== undefined && fullMoves >= survive.moves) {
          return { kind: 'win', winner: color, reason: 'survive' };
        }
      }
      return { kind: 'draw', reason: 'move-limit' };
    }
  }

  return { kind: 'ongoing' };
}
