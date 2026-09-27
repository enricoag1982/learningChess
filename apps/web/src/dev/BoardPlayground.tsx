import { useState } from 'react';
import type { JSX } from 'react';
import type { Color, Piece, PieceType, Position, Square } from '@chess-kids/core';
import { chessJsRules, parseDiagram } from '@chess-kids/core';
import { Board } from '../ui/board/Board.tsx';
import { PieceIcon } from '../ui/board/pieces.tsx';

const PIECE_TYPES: readonly PieceType[] = ['k', 'q', 'r', 'b', 'n', 'p'];
const COLORS: readonly Color[] = ['w', 'b'];

const INITIAL_DIAGRAM = `
. . . . . . . .
. . . p . . . .
. * . . . * . .
. . . . . . . .
x . . R . . . x
. . . . . . . .
. . . . . . . .
. . . * . . . .
`;

const HIGHLIGHT_SAMPLE_POSITION: Position = parseDiagram(INITIAL_DIAGRAM);

function PieceGallery(): JSX.Element {
  return (
    <div id="piece-gallery" className="rounded-2xl border-2 border-line bg-card p-4">
      <h2 className="mb-3 font-display text-xl text-ink">All 12 pieces, 40px</h2>
      <div className="flex flex-wrap gap-4">
        {COLORS.flatMap((color) =>
          PIECE_TYPES.map((type) => {
            const piece: Piece = { color, type };
            return (
              <div key={`${color}-${type}`} className="flex flex-col items-center gap-1">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-board-light">
                  <PieceIcon piece={piece} size={40} />
                </div>
                <span className="text-xs text-muted">
                  {color} {type}
                </span>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

function InteractiveBoardDemo(): JSX.Element {
  const [position, setPosition] = useState<Position>(() => parseDiagram(INITIAL_DIAGRAM));
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | undefined>(undefined);
  const [orientation, setOrientation] = useState<Color>('w');
  const [status, setStatus] = useState('Drag or tap-tap a piece.');

  const legalMoves = chessJsRules.legalMoves(position);

  function handleMove({ from, to }: { from: Square; to: Square }): void {
    const result = chessJsRules.play(position, { from, to });
    if (!result) return;
    // The variant layer (star collection, blocked squares) arrives in M1.2; for this playground,
    // simulate "collecting" a star so the Board's star-pop animation has something to show.
    const collectedStar = position.markers.stars.includes(to);
    const nextPosition: Position = collectedStar
      ? {
          ...result.position,
          markers: {
            ...result.position.markers,
            stars: result.position.markers.stars.filter((square) => square !== to),
          },
        }
      : result.position;
    setPosition(nextPosition);
    setLastMove({ from, to });
    setStatus(`Move: ${result.move.san}`);
  }

  function handleIllegal({ from, to }: { from: Square | null; to: Square }): void {
    setStatus(`Illegal: ${from ?? '?'} → ${to}`);
  }

  function reset(): void {
    setPosition(parseDiagram(INITIAL_DIAGRAM));
    setLastMove(undefined);
    setStatus('Reset.');
  }

  return (
    <div className="rounded-2xl border-2 border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-ink">Interactive board</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border-2 border-line bg-cream px-3 py-1 text-sm"
            onClick={() => {
              setOrientation((current) => (current === 'w' ? 'b' : 'w'));
            }}
          >
            Flip ({orientation === 'w' ? 'white' : 'black'} at bottom)
          </button>
          <button
            type="button"
            className="rounded-lg border-2 border-line bg-cream px-3 py-1 text-sm"
            onClick={reset}
          >
            Reset
          </button>
        </div>
      </div>
      <div className="mx-auto h-[360px] w-[360px]">
        <Board
          position={position}
          legalMoves={legalMoves}
          orientation={orientation}
          onMove={handleMove}
          onIllegal={handleIllegal}
          highlights={lastMove ? { lastMove } : undefined}
          label="Interactive demo board"
        />
      </div>
      <p className="mt-2 text-sm text-muted">{status}</p>
    </div>
  );
}

function SquareModeDemo(): JSX.Element {
  const emptyPosition: Position = {
    pieces: {},
    markers: { stars: [], blocked: [] },
    toMove: 'w',
    castling: '-',
    enPassant: null,
  };
  const [selected, setSelected] = useState<readonly Square[]>([]);

  function toggle(square: Square): void {
    setSelected((current) =>
      current.includes(square) ? current.filter((s) => s !== square) : [...current, square],
    );
  }

  return (
    <div className="rounded-2xl border-2 border-line bg-card p-4">
      <h2 className="mb-3 font-display text-xl text-ink">Square mode (select-squares exercise)</h2>
      <div className="mx-auto h-[320px] w-[320px]">
        <Board
          position={emptyPosition}
          legalMoves={[]}
          onSquareTap={toggle}
          highlights={{ selectedSquares: selected }}
          label="Square-mode demo board"
        />
      </div>
      <p className="mt-2 text-sm text-muted">
        Selected: {selected.length === 0 ? 'none' : selected.join(', ')}
      </p>
    </div>
  );
}

function HighlightSamples(): JSX.Element {
  return (
    <div className="rounded-2xl border-2 border-line bg-card p-4">
      <h2 className="mb-3 font-display text-xl text-ink">Highlight samples</h2>
      <div className="mx-auto h-[320px] w-[320px]">
        <Board
          position={HIGHLIGHT_SAMPLE_POSITION}
          legalMoves={[]}
          highlights={{ hint: ['e6'], wrong: ['c2'], lastMove: { from: 'g1', to: 'f3' } }}
          label="Highlight samples board"
        />
      </div>
      <p className="mt-2 text-sm text-muted">
        e6: hint (pulsing) · c2: wrong (static) · g1–f3: last move tint
      </p>
    </div>
  );
}

/** Dev-only visual harness for the board component, at `/#board` in development. */
export function BoardPlayground(): JSX.Element {
  return (
    <main className="min-h-dvh bg-cream p-6">
      <h1 className="mb-4 font-display text-3xl text-ink">Board playground (dev only)</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PieceGallery />
        <InteractiveBoardDemo />
        <SquareModeDemo />
        <HighlightSamples />
      </div>
    </main>
  );
}
