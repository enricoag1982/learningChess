import type { Move } from '../../../chess/rules.ts';

export type { MateInNDef } from '../../types.ts';
export type { MoveAction } from '../base.ts';

/** Result of a kid move in a `mate-in-n` exercise. */
export type MateInNOutcome =
  | { readonly kind: 'illegal' }
  /** A legal move that neither mates nor matches the scripted line for this ply. Position unchanged. */
  | { readonly kind: 'wrong'; readonly move: Move }
  /** The scripted kid move was played and its scripted opponent reply was applied too. */
  | { readonly kind: 'moved'; readonly move: Move; readonly reply: Move }
  /** Delivered checkmate — any mating move, not only the scripted one. */
  | { readonly kind: 'solved'; readonly move: Move };
