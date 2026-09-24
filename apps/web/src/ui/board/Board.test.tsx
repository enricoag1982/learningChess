import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { chessJsRules, parseDiagram } from '@chess-kids/core';
import type { Move, Square } from '@chess-kids/core';
import '../../i18n.ts';
import { Board } from './Board.tsx';

afterEach(cleanup);

// White rook d5 (movable), white knight b1 (movable), star on e8, blocked square on e3.
// No kings: chessJsRules accepts this (lessons/mini-games routinely omit them).
const DIAGRAM = `
. . . . * . . .
. . . . . . . .
. . . . . . . .
. . . R . . . .
. . . . . . . .
. . . . x . . .
. . . . . . . .
. N . . . . . .
`;
const POSITION = parseDiagram(DIAGRAM);
const LEGAL_MOVES: readonly Move[] = chessJsRules.legalMoves(POSITION);

function cell(square: Square): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${square},`) });
}

describe('Board — rendering', () => {
  it('renders a role=grid of 64 gridcells', () => {
    render(<Board position={POSITION} legalMoves={LEGAL_MOVES} label="Chess board" />);
    expect(screen.getByRole('grid', { name: 'Chess board' })).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(8);
    expect(screen.getAllByRole('gridcell')).toHaveLength(64);
    expect(screen.getAllByRole('button')).toHaveLength(64);
  });

  it('names piece, star, blocked and empty squares (white orientation)', () => {
    render(<Board position={POSITION} legalMoves={LEGAL_MOVES} label="Chess board" />);
    expect(cell('d5').getAttribute('aria-label')).toBe('d5, white rook');
    expect(cell('b1').getAttribute('aria-label')).toBe('b1, white knight');
    expect(cell('e8').getAttribute('aria-label')).toBe('e8, star');
    expect(cell('e3').getAttribute('aria-label')).toBe('e3, blocked');
    expect(cell('a1').getAttribute('aria-label')).toBe('a1, empty');
  });

  it('keeps the same names when the board is flipped (black orientation)', () => {
    render(
      <Board position={POSITION} legalMoves={LEGAL_MOVES} orientation="b" label="Chess board" />,
    );
    expect(cell('d5').getAttribute('aria-label')).toBe('d5, white rook');
    expect(cell('e8').getAttribute('aria-label')).toBe('e8, star');
    expect(cell('e3').getAttribute('aria-label')).toBe('e3, blocked');
    expect(cell('h1').getAttribute('aria-label')).toBe('h1, empty');
  });
});

describe('Board — tap-tap', () => {
  it('selects a movable piece, then moves it to a legal target', () => {
    const onMove = vi.fn();
    render(
      <Board position={POSITION} legalMoves={LEGAL_MOVES} onMove={onMove} label="Chess board" />,
    );

    fireEvent.click(cell('d5'));
    expect(cell('d5').getAttribute('aria-label')).toBe('d5, white rook, selected');
    // Empty legal target square along the rook's file: dot shown via "possible move".
    expect(cell('d1').getAttribute('aria-label')).toBe('d1, empty, possible move');

    fireEvent.click(cell('d1'));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith({ from: 'd5', to: 'd1' });
  });

  it('only marks actual legalMoves targets, not arbitrary squares', () => {
    render(<Board position={POSITION} legalMoves={LEGAL_MOVES} label="Chess board" />);
    fireEvent.click(cell('d5'));
    // a8 is not reachable by a rook on d5.
    expect(cell('a8').getAttribute('aria-label')).toBe('a8, empty');
  });

  it('calls onIllegal with from=null when tapping a square with no movable piece', () => {
    const onIllegal = vi.fn();
    render(
      <Board
        position={POSITION}
        legalMoves={LEGAL_MOVES}
        onIllegal={onIllegal}
        label="Chess board"
      />,
    );
    fireEvent.click(cell('a1'));
    expect(onIllegal).toHaveBeenCalledTimes(1);
    expect(onIllegal).toHaveBeenCalledWith({ from: null, to: 'a1' });
  });

  it('calls onIllegal and keeps the selection when tapping a non-target square', () => {
    const onMove = vi.fn();
    const onIllegal = vi.fn();
    render(
      <Board
        position={POSITION}
        legalMoves={LEGAL_MOVES}
        onMove={onMove}
        onIllegal={onIllegal}
        label="Chess board"
      />,
    );
    fireEvent.click(cell('d5'));
    fireEvent.click(cell('a8')); // not a legal rook move from d5
    expect(onIllegal).toHaveBeenCalledTimes(1);
    expect(onIllegal).toHaveBeenCalledWith({ from: 'd5', to: 'a8' });
    expect(onMove).not.toHaveBeenCalled();
    expect(cell('d5').getAttribute('aria-label')).toBe('d5, white rook, selected');
  });

  it('reselects when tapping another movable piece', () => {
    render(<Board position={POSITION} legalMoves={LEGAL_MOVES} label="Chess board" />);
    fireEvent.click(cell('d5'));
    fireEvent.click(cell('b1'));
    expect(cell('b1').getAttribute('aria-label')).toBe('b1, white knight, selected');
    expect(cell('d5').getAttribute('aria-label')).toBe('d5, white rook');
  });

  it('deselects when tapping the selected piece again', () => {
    render(<Board position={POSITION} legalMoves={LEGAL_MOVES} label="Chess board" />);
    fireEvent.click(cell('d5'));
    fireEvent.click(cell('d5'));
    expect(cell('d5').getAttribute('aria-label')).toBe('d5, white rook');
    expect(cell('d1').getAttribute('aria-label')).toBe('d1, empty');
  });
});

describe('Board — square mode', () => {
  it('calls onSquareTap for every tap and never onMove, even on a movable piece', () => {
    const onSquareTap = vi.fn();
    const onMove = vi.fn();
    render(
      <Board
        position={POSITION}
        legalMoves={LEGAL_MOVES}
        onMove={onMove}
        onSquareTap={onSquareTap}
        label="Chess board"
      />,
    );
    fireEvent.click(cell('d5'));
    fireEvent.click(cell('a1'));
    expect(onSquareTap.mock.calls).toEqual([['d5'], ['a1']]);
    expect(onMove).not.toHaveBeenCalled();
    // No tap-tap selection visuals in square mode.
    expect(cell('d5').getAttribute('aria-label')).toBe('d5, white rook');
  });
});

describe('Board — highlights', () => {
  it('marks a focus square with "look here", independent of hint/wrong', () => {
    render(
      <Board
        position={POSITION}
        legalMoves={[]}
        highlights={{ focus: ['d5'] }}
        label="Chess board"
      />,
    );
    expect(cell('d5').getAttribute('aria-label')).toBe('d5, white rook, look here');
    expect(cell('a1').getAttribute('aria-label')).toBe('a1, empty');
  });

  it('best-move: a new wrongMove bounces the piece to `to` and back, without moving it in the data', async () => {
    const { rerender } = render(
      <Board position={POSITION} legalMoves={LEGAL_MOVES} label="Chess board" />,
    );
    expect(cell('d5').getAttribute('aria-label')).toBe('d5, white rook');

    rerender(
      <Board
        position={POSITION}
        legalMoves={LEGAL_MOVES}
        highlights={{ wrongMove: { from: 'd5', to: 'd1' } }}
        label="Chess board"
      />,
    );

    // The piece still lives at d5 in `position`; the animation is purely visual.
    await waitFor(() => {
      expect(cell('d5').querySelector('.chess-piece-bounce')).not.toBeNull();
    });
    expect(cell('d1').getAttribute('aria-label')).toBe('d1, empty');
  });
});

describe('Board — keyboard', () => {
  it('starts with one tabbable cell, moves focus with arrow keys, and activates with Enter', () => {
    const onMove = vi.fn();
    render(
      <Board position={POSITION} legalMoves={LEGAL_MOVES} onMove={onMove} label="Chess board" />,
    );

    const tabbable = screen.getAllByRole('button').filter((button) => button.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toBe(cell('a8'));

    fireEvent.keyDown(cell('a8'), { key: 'ArrowRight' });
    expect(cell('a8').tabIndex).toBe(-1);
    expect(cell('b8').tabIndex).toBe(0);

    fireEvent.keyDown(cell('b8'), { key: 'ArrowDown', code: 'ArrowDown' });
    expect(cell('b7').tabIndex).toBe(0);

    // Enter on the rook selects it, then Enter on a legal target plays the move.
    fireEvent.keyDown(cell('d5'), { key: 'Enter' });
    expect(cell('d5').getAttribute('aria-label')).toBe('d5, white rook, selected');
    fireEvent.keyDown(cell('d1'), { key: 'Enter' });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith({ from: 'd5', to: 'd1' });
  });

  it('does not move focus past the edge of the board', () => {
    render(<Board position={POSITION} legalMoves={LEGAL_MOVES} label="Chess board" />);
    fireEvent.keyDown(cell('a8'), { key: 'ArrowUp' });
    fireEvent.keyDown(cell('a8'), { key: 'ArrowLeft' });
    expect(cell('a8').tabIndex).toBe(0);
  });
});
