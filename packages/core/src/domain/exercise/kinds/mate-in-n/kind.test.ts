import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../../../chess/chessjs-rules.ts';
import { parseDiagram } from '../../../chess/diagram.ts';
import { createVariantRules } from '../../../variant/rules.ts';
import { requestHint, starsFor } from '../index.ts';
import { initState } from '../../state.ts';
import { playMateInN } from './engine.ts';
import type { MateInNDef } from '../../types.ts';

const rules = createVariantRules(chessJsRules);

describe('mate-in-n', () => {
  // Black king h8 alone; two white rooks (b1, d1) can each independently deliver back-rank mate
  // once Ra7 has cut off the 7th rank — Rb8# and Rd8# are both legal mating moves.
  const mateIn1Position = parseDiagram(
    [
      '. . . . . . . k',
      'R . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . K .',
      '. R . R . . . .',
    ].join('\n'),
  );
  const mateIn1: MateInNDef = {
    id: 'mate1',
    concept: 'mate-in-1',
    textKey: 'mate1.text',
    type: 'mate-in-n',
    position: mateIn1Position,
    n: 1,
    line: ['Rb8#'],
  };

  it('a mating move solves it even when it is not the scripted one', () => {
    const state = initState(mateIn1);
    const { state: next, outcome } = playMateInN(state, chessJsRules, { from: 'd1', to: 'd8' });

    expect(outcome).toMatchObject({ kind: 'solved' });
    expect(next.solved).toBe(true);
    expect(starsFor(next)).toBe(3);
  });

  it('a legal but non-mating, non-scripted move counts an error and leaves the position unchanged', () => {
    const state = initState(mateIn1);
    const { state: next, outcome } = playMateInN(state, chessJsRules, { from: 'b1', to: 'b2' });

    expect(outcome).toMatchObject({ kind: 'wrong' });
    expect(next.errors).toBe(1);
    expect(next.solved).toBe(false);
    expect(next.position).toEqual(mateIn1Position);
  });

  it('an illegal move counts an error without touching the position', () => {
    const state = initState(mateIn1);
    const { state: next, outcome } = playMateInN(state, chessJsRules, { from: 'g2', to: 'g5' });

    expect(outcome).toEqual({ kind: 'illegal' });
    expect(next.errors).toBe(1);
  });

  it('is a no-op once solved', () => {
    let state = initState(mateIn1);
    state = playMateInN(state, chessJsRules, { from: 'b1', to: 'b8' }).state;
    expect(state.solved).toBe(true);

    const { state: next, outcome } = playMateInN(state, chessJsRules, { from: 'g2', to: 'g3' });
    expect(outcome).toEqual({ kind: 'illegal' });
    expect(next).toBe(state);
  });

  // Fool's-mate-shaped mate-in-2 (kid = White): 1.Ne7+ Kh8 2.Qa8# — Kf8 is also legal but the
  // line scripts Kh8.
  const mateIn2Position = parseDiagram(
    [
      '. . . . . . k .',
      '. . . . . p p p',
      '. . N . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      'Q K . . . . . .',
    ].join('\n'),
  );
  const mateIn2: MateInNDef = {
    id: 'mate2',
    concept: 'mate-in-2',
    textKey: 'mate2.text',
    type: 'mate-in-n',
    position: mateIn2Position,
    n: 2,
    line: ['Ne7+', 'Kh8', 'Qa8#'],
  };

  it('the scripted kid move applies the scripted opponent reply too', () => {
    const state = initState(mateIn2);
    const { state: next, outcome } = playMateInN(state, chessJsRules, { from: 'c6', to: 'e7' });

    expect(outcome).toMatchObject({
      kind: 'moved',
      move: { from: 'c6', to: 'e7' },
      reply: { from: 'g8', to: 'h8' },
    });
    expect(next.solved).toBe(false);
    expect(next.position.pieces.h8).toEqual({ color: 'b', type: 'k' });
    expect(next.position.toMove).toBe('w');
  });

  it('finishes with the final kid move after the scripted reply', () => {
    let state = initState(mateIn2);
    state = playMateInN(state, chessJsRules, { from: 'c6', to: 'e7' }).state;
    const { state: next, outcome } = playMateInN(state, chessJsRules, { from: 'a1', to: 'a8' });

    expect(outcome).toMatchObject({ kind: 'solved' });
    expect(next.solved).toBe(true);
  });

  it('a move that neither mates nor matches the scripted line is wrong', () => {
    const state = initState(mateIn2);
    const { state: next, outcome } = playMateInN(state, chessJsRules, { from: 'b1', to: 'b2' });

    expect(outcome).toMatchObject({ kind: 'wrong' });
    expect(next.errors).toBe(1);
    expect(next.position).toEqual(mateIn2Position);
  });

  it('hint ladder: piece, then target square, then the scripted move', () => {
    const state = initState(mateIn2);

    const hint1 = requestHint(state, rules);
    expect(hint1.hint).toEqual({ kind: 'squares', level: 1, squares: ['c6'] });

    const hint2 = requestHint(hint1.state, rules);
    expect(hint2.hint).toEqual({ kind: 'squares', level: 2, squares: ['e7'] });

    const hint3 = requestHint(hint2.state, rules);
    expect(hint3.hint).toEqual({
      kind: 'squares',
      level: 3,
      squares: ['c6', 'e7'],
      move: { from: 'c6', to: 'e7' },
    });
  });

  it('hints the second kid move once the first ply has been played', () => {
    let state = initState(mateIn2);
    state = playMateInN(state, chessJsRules, { from: 'c6', to: 'e7' }).state;

    const { hint } = requestHint(state, rules);
    expect(hint).toEqual({ kind: 'squares', level: 1, squares: ['a1'] });
  });

  it('grades stars like best-move: 3 clean, capped by errors/hints', () => {
    let clean = initState(mateIn1);
    clean = playMateInN(clean, chessJsRules, { from: 'b1', to: 'b8' }).state;
    expect(starsFor(clean)).toBe(3);

    let oneError = initState(mateIn1);
    oneError = playMateInN(oneError, chessJsRules, { from: 'b1', to: 'b2' }).state; // wrong
    oneError = playMateInN(oneError, chessJsRules, { from: 'b1', to: 'b8' }).state; // mates
    expect(oneError.errors).toBe(1);
    expect(starsFor(oneError)).toBe(2);
  });
});
