import { describe, expect, it } from 'vitest';
import { tapClass } from './tap.ts';

// Touch-target sizes (docs/screens.md §1): game screens 56px, everything else keeps 64px+.
describe('tapClass looks', () => {
  it('compact: a 56px game action that shares a row (icon + short label)', () => {
    const classes = tapClass('compact', 'neutral').split(' ');
    expect(classes).toEqual(
      expect.arrayContaining(['tap-raised', 'h-14', 'min-w-14', 'flex-1', 'gap-2', 'text-base']),
    );
    expect(classes).not.toContain('h-16');
  });

  it('compact takes a tone like every other look', () => {
    expect(tapClass('compact', 'go')).toContain('tap-go');
  });

  it('round-md: a 56px round icon button (game header close, replay)', () => {
    const classes = tapClass('round-md').split(' ');
    expect(classes).toEqual(expect.arrayContaining(['h-14', 'w-14', 'rounded-full']));
    expect(tapClass('round').split(' ')).toEqual(expect.arrayContaining(['h-16', 'w-16']));
  });

  it('next: the forward action is 64px tall at text-xl, down from 80px / text-2xl', () => {
    const classes = tapClass('next', 'go').split(' ');
    expect(classes).toEqual(expect.arrayContaining(['h-16', 'text-xl']));
    expect(classes).not.toContain('h-20');
    expect(classes).not.toContain('text-2xl');
  });

  it('wide (vs Friend strip) is 56px', () => {
    expect(tapClass('wide').split(' ')).toContain('h-14');
  });

  it('non-game looks keep their 64px+ size', () => {
    expect(tapClass('cta').split(' ')).toContain('h-20');
    expect(tapClass('block').split(' ')).toContain('h-20');
    expect(tapClass('hero').split(' ')).toContain('h-16');
    expect(tapClass('primary').split(' ')).toContain('h-16');
  });
});
