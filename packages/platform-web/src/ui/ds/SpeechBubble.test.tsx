import { describe, expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { SpeechBubble } from './SpeechBubble.tsx';
import type { SpeechBubbleProps } from './SpeechBubble.tsx';

const i18n = createInstance();
await i18n.init({
  lng: 'en',
  resources: { en: { translation: { 'exercise.replay': 'Say it again' } } },
});

function bubble(props: SpeechBubbleProps): ReactElement {
  return (
    <I18nextProvider i18n={i18n}>
      <SpeechBubble {...props} />
    </I18nextProvider>
  );
}

describe('SpeechBubble', () => {
  it('without a note, is just the instruction', () => {
    render(bubble({ text: 'Tap the rook.' }));
    expect(screen.getByText('Tap the rook.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('puts the note inside the bubble under the instruction, never replacing it', () => {
    render(bubble({ text: 'Tap the rook.', note: { text: 'Look at Rhino.', tone: 'attention' } }));
    const instruction = screen.getByText('Tap the rook.');
    const note = screen.getByText('Look at Rhino.');
    expect(note.parentElement).toBe(instruction.parentElement);
    expect(instruction.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
      0,
    );
  });

  it('draws the note as a text line with a thin divider, not as a banner box', () => {
    render(bubble({ text: 'Tap.', note: { text: 'Not quite.', tone: 'attention' } }));
    const classes = screen.getByText('Not quite.').className.split(' ');
    expect(classes).toEqual(expect.arrayContaining(['border-t', 'text-base', 'font-semibold']));
    expect(classes).not.toContain('rounded-2xl');
    expect(classes.some((name) => name.startsWith('bg-'))).toBe(false);
  });

  it('colours a hint / error note orange and a praise note green', () => {
    const { rerender } = render(
      bubble({ text: 'Tap.', note: { text: 'A note.', tone: 'attention' } }),
    );
    expect(screen.getByText('A note.').className).toContain('text-[#8C4012]');
    rerender(bubble({ text: 'Tap.', note: { text: 'A note.', tone: 'praise' } }));
    expect(screen.getByText('A note.').className).toContain('text-[#1F5A41]');
  });

  it('adds no live-region role to the note', () => {
    render(bubble({ text: 'Tap.', note: { text: 'A note.', tone: 'attention' } }));
    expect(screen.getByText('A note.').getAttribute('role')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('with `onReplay`, shows a compact replay icon named "Say it again" in the avatar column', () => {
    const onReplay = vi.fn();
    render(bubble({ text: 'Tap.', onReplay }));
    const replay = screen.getByRole('button', { name: 'Say it again' });
    expect(replay.textContent).toBe('');
    expect(replay.className).toContain('w-14');
    // Stacked layouts: that column dissolves and `order` puts the icon after the bubble; from
    // `lg` it stacks under the owl and the bubble takes the whole remaining width.
    const column = replay.parentElement;
    expect(column?.className).toContain('contents');
    expect(column?.className).toContain('lg:flex-col');
    expect(column?.firstElementChild?.contains(replay)).toBe(false);
    expect(column?.parentElement?.contains(screen.getByText('Tap.'))).toBe(true);
    expect(replay.className).toContain('order-2');
    expect(screen.getByText('Tap.').closest('.order-1')).not.toBeNull();

    fireEvent.click(replay);
    expect(onReplay).toHaveBeenCalledOnce();
  });

  it('names the replay icon by `replayLabel` when given', () => {
    render(bubble({ text: 'Tap.', onReplay: vi.fn(), replayLabel: 'Listen again' }));
    expect(screen.getByRole('button', { name: 'Listen again' })).toBeTruthy();
  });
});
