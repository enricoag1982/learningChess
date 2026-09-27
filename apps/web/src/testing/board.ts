import { fireEvent, screen } from '@testing-library/react';

/** The board cell named "<square>, ..." (Board.tsx's accessible square names). */
export function boardCell(square: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${square},`) });
}

/** Clicks the board cell named "<square>, ...". */
export function clickSquare(square: string): void {
  fireEvent.click(boardCell(square));
}
