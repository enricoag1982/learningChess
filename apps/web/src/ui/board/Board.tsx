import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Color, Move, Piece, PieceType, Position, Square } from '@chess-kids/core';
import { BlockedIcon, PieceIcon, StarIcon } from './pieces.tsx';
import { cellToSquare, distance, squareAt, squareToCell } from './geometry.ts';
import './board.css';

/** A move the board asks its parent to play (legality already came from `legalMoves`). */
export interface BoardMove {
  readonly from: Square;
  readonly to: Square;
}

/** A tap that could not be turned into a move. */
export interface IllegalAttempt {
  readonly from: Square | null;
  readonly to: Square;
}

/** Visual marks layered on top of the board; none of them affect legality. */
export interface BoardHighlights {
  /** Select-squares exercises: the kid's current selection (ring). */
  readonly selectedSquares?: readonly Square[];
  /** Pulsing orange ring: the hint ladder. */
  readonly hint?: readonly Square[];
  /** Orange mark for a wrong try — never red. */
  readonly wrong?: readonly Square[];
  /** Squares of the move just played, for the slide/fade animation and a soft tint. */
  readonly lastMove?: { readonly from: Square; readonly to: Square };
}

export interface BoardProps {
  readonly position: Position;
  /** Legal moves the kid may play now (from the engine); empty = board not interactive for moves. */
  readonly legalMoves: readonly Move[];
  /** Which side sits at the bottom. Default `'w'` (rank 1 at bottom). */
  readonly orientation?: Color;
  readonly onMove?: (move: BoardMove) => void;
  /** Tap on a square that is not a legal target of the selected piece (for spoken feedback). */
  readonly onIllegal?: (attempt: IllegalAttempt) => void;
  /** Square mode (select-squares exercises): every tap toggles a square. When set, piece moving is off. */
  readonly onSquareTap?: (square: Square) => void;
  readonly highlights?: BoardHighlights;
  /** Show file/rank labels on the edge squares. Default `false` (kids: no notation). */
  readonly showCoordinates?: boolean;
  /** Accessible name of the board, e.g. "Chess board". */
  readonly label: string;
}

const PIECE_NAMES: Record<PieceType, string> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};

const COLOR_NAMES: Record<Color, string> = { w: 'white', b: 'black' };

const CELLS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7];

/** Real chess boards put a dark square on a1. */
function isLightSquare(square: Square): boolean {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square[1]);
  return (file + rank) % 2 === 0;
}

function describeSquare(
  square: Square,
  position: Position,
  selected: boolean,
  target: boolean,
): string {
  const piece = position.pieces[square];
  let base: string;
  if (piece) {
    base = `${square}, ${COLOR_NAMES[piece.color]} ${PIECE_NAMES[piece.type]}`;
  } else if (position.markers.stars.includes(square)) {
    base = `${square}, star`;
  } else if (position.markers.blocked.includes(square)) {
    base = `${square}, blocked`;
  } else {
    base = `${square}, empty`;
  }
  if (selected) return `${base}, selected`;
  if (target) return `${base}, possible move`;
  return base;
}

interface DragState {
  readonly pointerId: number;
  readonly from: Square;
  readonly startX: number;
  readonly startY: number;
  readonly x: number;
  readonly y: number;
  readonly dragging: boolean;
  /** Board square size in CSS px at pick-up time, for sizing the floating piece. */
  readonly squareSize: number;
}

interface SlideState {
  readonly square: Square;
  readonly dx: number;
  readonly dy: number;
}

interface CaptureFadeState {
  readonly square: Square;
  readonly piece: Piece;
}

/** A drag/tap threshold in CSS pixels: smaller pointer movements count as a tap. */
const DRAG_THRESHOLD_PX = 6;

/**
 * The chess board: an 8x8 grid of squares that renders `position`, supports tap-tap and drag
 * moves constrained to `legalMoves`, and exposes itself to screen readers as a `role="grid"` with
 * one labelled button per square. It holds no chess rules of its own.
 */
export function Board({
  position,
  legalMoves,
  orientation = 'w',
  onMove,
  onIllegal,
  onSquareTap,
  highlights,
  showCoordinates = false,
  label,
}: BoardProps): JSX.Element {
  const squareMode = onSquareTap !== undefined;

  const [selected, setSelected] = useState<Square | null>(null);
  const [focusSquare, setFocusSquare] = useState<Square>('a8');
  const [drag, setDrag] = useState<DragState | null>(null);
  const [slide, setSlide] = useState<SlideState | null>(null);
  const [captureFade, setCaptureFade] = useState<CaptureFadeState | null>(null);
  const [starPop, setStarPop] = useState<Square | null>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Partial<Record<Square, HTMLButtonElement | null>>>({});
  const justInteractedRef = useRef(false);
  const shouldFocusRef = useRef(false);

  const legalTargets = new Set<Square>(
    squareMode || selected === null
      ? []
      : legalMoves.filter((move) => move.from === selected).map((move) => move.to),
  );
  const draggableFroms = new Set<Square>(squareMode ? [] : legalMoves.map((move) => move.from));

  // Adjusting state during render (React's documented pattern for "reset state when a prop
  // changes"): a new `position` reference is the signal that the game state advanced (move, undo,
  // new lesson). We drop any stale tap-tap selection and, from `highlights.lastMove`, work out
  // the slide / capture-fade / star-pop animation for the move that just happened.
  const [prevPosition, setPrevPosition] = useState(position);
  if (position !== prevPosition) {
    setPrevPosition(position);
    setSelected(null);

    const lastMove = highlights?.lastMove;
    if (lastMove) {
      const fromCell = squareToCell(lastMove.from, orientation);
      const toCell = squareToCell(lastMove.to, orientation);
      const dx = fromCell.col - toCell.col;
      const dy = fromCell.row - toCell.row;
      setSlide(dx !== 0 || dy !== 0 ? { square: lastMove.to, dx, dy } : null);

      const captured = prevPosition.pieces[lastMove.to];
      const moverNow = position.pieces[lastMove.to];
      setCaptureFade(
        captured &&
          moverNow &&
          (captured.color !== moverNow.color || captured.type !== moverNow.type)
          ? { square: lastMove.to, piece: captured }
          : null,
      );

      setStarPop(
        prevPosition.markers.stars.includes(lastMove.to) &&
          !position.markers.stars.includes(lastMove.to)
          ? lastMove.to
          : null,
      );
    } else {
      setSlide(null);
      setCaptureFade(null);
      setStarPop(null);
    }
  }

  useEffect(() => {
    if (shouldFocusRef.current) {
      shouldFocusRef.current = false;
      buttonRefs.current[focusSquare]?.focus();
    }
  }, [focusSquare]);

  function handleActivate(square: Square): void {
    if (squareMode) {
      onSquareTap(square);
      return;
    }
    if (selected === null) {
      if (draggableFroms.has(square)) {
        setSelected(square);
      } else {
        onIllegal?.({ from: null, to: square });
      }
      return;
    }
    if (square === selected) {
      setSelected(null);
      return;
    }
    if (legalMoves.some((move) => move.from === selected && move.to === square)) {
      onMove?.({ from: selected, to: square });
      setSelected(null);
      return;
    }
    if (draggableFroms.has(square)) {
      setSelected(square);
      return;
    }
    onIllegal?.({ from: selected, to: square });
  }

  function handleClick(square: Square): void {
    if (justInteractedRef.current) {
      justInteractedRef.current = false;
      return;
    }
    handleActivate(square);
  }

  // Real pointer/touch interactions (handled below) resolve to a tap or a drag themselves; a
  // browser then often follows up with a synthetic `click` on the same element, which would
  // otherwise reach `handleClick` and re-run the same activation a second time. This suppresses
  // exactly that follow-up click. It self-expires on a timer rather than waiting for that click,
  // because a genuine drag gesture does not reliably produce one — leaving the flag stuck `true`
  // would silently swallow the *next*, unrelated click instead.
  function suppressNextClick(): void {
    justInteractedRef.current = true;
    setTimeout(() => {
      justInteractedRef.current = false;
    }, 0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, square: Square): void {
    // Handled explicitly (rather than relying on the browser's native button activation) so it
    // behaves the same as click/tap, including click-suppression right after a drag.
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      suppressNextClick();
      handleActivate(square);
      return;
    }
    const { row, col } = squareToCell(square, orientation);
    let nextRow = row;
    let nextCol = col;
    switch (event.key) {
      case 'ArrowUp':
        nextRow -= 1;
        break;
      case 'ArrowDown':
        nextRow += 1;
        break;
      case 'ArrowLeft':
        nextCol -= 1;
        break;
      case 'ArrowRight':
        nextCol += 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = cellToSquare(nextRow, nextCol, orientation);
    if (next && next !== square) {
      shouldFocusRef.current = true;
      setFocusSquare(next);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, square: Square): void {
    if (squareMode || !draggableFroms.has(square)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    // Selecting only happens once this turns into an actual drag (see handlePointerMove) — not
    // here — so a plain tap still goes through the ordinary tap-tap state machine in
    // `handleActivate` exactly once, from pointerup, instead of this pre-selecting the square and
    // then immediately reading that as "tap the already-selected piece" (deselect).
    const rect = boardRef.current?.getBoundingClientRect();
    setDrag({
      pointerId: event.pointerId,
      from: square,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      dragging: false,
      squareSize: rect ? rect.width / 8 : 0,
    });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.dragging) {
      const movedEnough =
        distance({ x: drag.startX, y: drag.startY }, { x: event.clientX, y: event.clientY }) >=
        DRAG_THRESHOLD_PX;
      if (movedEnough) {
        // The gesture just became a drag: select the piece now (so target dots appear) instead
        // of eagerly on pointerdown.
        setSelected(drag.from);
        setDrag({ ...drag, x: event.clientX, y: event.clientY, dragging: true });
        return;
      }
    }
    setDrag({ ...drag, x: event.clientX, y: event.clientY });
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>): void {
    const current = drag;
    if (!current || current.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    suppressNextClick();
    setDrag(null);

    if (!current.dragging) {
      handleActivate(current.from);
      return;
    }

    const rect = boardRef.current?.getBoundingClientRect();
    const dropSquare = rect
      ? squareAt({ x: event.clientX, y: event.clientY }, rect, orientation)
      : null;
    if (dropSquare === null) return; // dropped off the board: snap back silently

    if (legalMoves.some((move) => move.from === current.from && move.to === dropSquare)) {
      onMove?.({ from: current.from, to: dropSquare });
      setSelected(null);
    } else {
      onIllegal?.({ from: current.from, to: dropSquare });
    }
  }

  const draggedPiece = drag?.dragging ? position.pieces[drag.from] : undefined;

  return (
    <div className="aspect-square h-full max-h-full w-full max-w-full">
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-board-frame p-3">
        <div
          ref={boardRef}
          role="grid"
          aria-label={label}
          className="grid h-full w-full grid-cols-8 grid-rows-8"
        >
          {CELLS.map((row) => (
            <div role="row" className="contents" key={`row-${String(row)}`}>
              {CELLS.map((col) => {
                const square = cellToSquare(row, col, orientation);
                if (square === null) return null;
                const piece = position.pieces[square];
                const light = isLightSquare(square);
                const tapSelected = !squareMode && selected === square;
                const squareModeSelected =
                  squareMode && (highlights?.selectedSquares?.includes(square) ?? false);
                const isTarget = legalTargets.has(square);
                const lastMove = highlights?.lastMove;
                const isLastMoveSquare =
                  lastMove !== undefined && (lastMove.from === square || lastMove.to === square);
                const isHint = highlights?.hint?.includes(square) ?? false;
                const isWrong = highlights?.wrong?.includes(square) ?? false;
                const isStar = position.markers.stars.includes(square);
                const isBlocked = position.markers.blocked.includes(square);
                const isDraggingThis = drag?.from === square && drag.dragging;
                const accessibleName = describeSquare(
                  square,
                  position,
                  tapSelected || squareModeSelected,
                  isTarget,
                );

                return (
                  <div role="gridcell" key={square} className="relative">
                    <button
                      ref={(element) => {
                        buttonRefs.current[square] = element;
                      }}
                      type="button"
                      aria-label={accessibleName}
                      tabIndex={focusSquare === square ? 0 : -1}
                      className={`relative flex h-full w-full items-center justify-center border-0 p-0 ${
                        light ? 'bg-board-light' : 'bg-board-dark'
                      } ${tapSelected ? 'bg-[#F4D35E]' : ''}`}
                      onClick={() => {
                        handleClick(square);
                      }}
                      onKeyDown={(event) => {
                        handleKeyDown(event, square);
                      }}
                      onFocus={() => {
                        setFocusSquare(square);
                      }}
                      onPointerDown={(event) => {
                        handlePointerDown(event, square);
                      }}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={() => {
                        setDrag(null);
                      }}
                    >
                      {isLastMoveSquare && !tapSelected && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-[#F4D35E]/35"
                        />
                      )}

                      {captureFade && captureFade.square === square && (
                        <span
                          aria-hidden="true"
                          className="chess-capture-fade pointer-events-none absolute inset-[2%]"
                          onAnimationEnd={() => {
                            setCaptureFade(null);
                          }}
                        >
                          <PieceIcon piece={captureFade.piece} />
                        </span>
                      )}

                      {piece && !isDraggingThis && (
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute inset-[2%] ${
                            slide?.square === square ? 'chess-piece-slide' : ''
                          }`}
                          style={
                            slide?.square === square
                              ? ({
                                  '--slide-from': `translate(${String(slide.dx * 100)}%, ${String(slide.dy * 100)}%)`,
                                } as CSSProperties)
                              : undefined
                          }
                          onAnimationEnd={() => {
                            setSlide((current) => (current?.square === square ? null : current));
                          }}
                        >
                          <PieceIcon piece={piece} />
                        </span>
                      )}

                      {!piece && isStar && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-[15%]"
                        >
                          <StarIcon />
                        </span>
                      )}
                      {!piece && !isStar && isBlocked && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-[10%]"
                        >
                          <BlockedIcon />
                        </span>
                      )}

                      {starPop === square && (
                        <span
                          aria-hidden="true"
                          className="chess-star-pop pointer-events-none absolute inset-[15%]"
                          onAnimationEnd={() => {
                            setStarPop(null);
                          }}
                        >
                          <StarIcon />
                        </span>
                      )}

                      {isTarget && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 flex items-center justify-center"
                        >
                          {piece !== undefined || isStar ? (
                            <span className="h-[72%] w-[72%] rounded-full border-4 border-go/70" />
                          ) : (
                            <span className="h-[28%] w-[28%] rounded-full bg-go/60" />
                          )}
                        </span>
                      )}

                      {squareModeSelected && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-[6%] rounded-md border-4 border-[#F4D35E]"
                        />
                      )}
                      {isHint && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-[6%] animate-pulse rounded-md border-4 border-dashed border-today"
                        />
                      )}
                      {isWrong && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-[6%] rounded-md border-4 border-today"
                        />
                      )}

                      {showCoordinates && row === 7 && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute bottom-0.5 right-1 text-[10px] font-semibold text-ink/50"
                        >
                          {square[0]}
                        </span>
                      )}
                      {showCoordinates && col === 0 && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute left-0.5 top-0.5 text-[10px] font-semibold text-ink/50"
                        >
                          {square[1]}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {draggedPiece && drag && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 scale-110 drop-shadow-xl"
            style={{ left: drag.x, top: drag.y, width: drag.squareSize, height: drag.squareSize }}
          >
            <PieceIcon piece={draggedPiece} />
          </div>
        )}
      </div>
    </div>
  );
}
