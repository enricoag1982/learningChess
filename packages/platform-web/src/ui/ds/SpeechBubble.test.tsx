import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpeechBubble } from './SpeechBubble.tsx';

describe('SpeechBubble', () => {
  it('without a note, is just the instruction', () => {
    render(<SpeechBubble text="Tap the rook." />);
    expect(screen.getByText('Tap the rook.')).toBeTruthy();
  });

  it('puts the note inside the bubble under the instruction, never replacing it', () => {
    render(
      <SpeechBubble text="Tap the rook." note={{ text: 'Look at Rhino.', tone: 'attention' }} />,
    );
    const instruction = screen.getByText('Tap the rook.');
    const note = screen.getByText('Look at Rhino.');
    expect(note.parentElement).toBe(instruction.parentElement);
    expect(instruction.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
      0,
    );
  });

  it('draws the note as a text line with a thin divider, not as a banner box', () => {
    render(<SpeechBubble text="Tap." note={{ text: 'Not quite.', tone: 'attention' }} />);
    const classes = screen.getByText('Not quite.').className.split(' ');
    expect(classes).toEqual(expect.arrayContaining(['border-t', 'text-base', 'font-semibold']));
    expect(classes).not.toContain('rounded-2xl');
    expect(classes.some((name) => name.startsWith('bg-'))).toBe(false);
  });

  it('colours a hint / error note orange and a praise note green', () => {
    const { rerender } = render(
      <SpeechBubble text="Tap." note={{ text: 'A note.', tone: 'attention' }} />,
    );
    expect(screen.getByText('A note.').className).toContain('text-[#7A3A0F]');
    rerender(<SpeechBubble text="Tap." note={{ text: 'A note.', tone: 'praise' }} />);
    expect(screen.getByText('A note.').className).toContain('text-edge-go');
  });

  it('adds no live-region role to the note', () => {
    render(<SpeechBubble text="Tap." note={{ text: 'A note.', tone: 'attention' }} />);
    expect(screen.getByText('A note.').getAttribute('role')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('puts `action` at the right end of the owl row, after the bubble', () => {
    render(<SpeechBubble text="Tap." action={<button type="button">Speak</button>} />);
    const action = screen.getByRole('button', { name: 'Speak' });
    const row = action.parentElement;
    expect(row?.lastElementChild).toBe(action);
    expect(row?.contains(screen.getByText('Tap.'))).toBe(true);
  });
});
