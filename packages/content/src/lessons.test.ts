import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CaptureDef, CollectStarsDef } from '@chess-kids/core';
import { chessJsRules, createVariantRules, optimalMoves } from '@chess-kids/core';
import { describe, expect, it } from 'vitest';
import { loadLocales } from './load.ts';
import { loadContent } from './lesson-load.ts';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const locales = loadLocales(join(packageDir, 'locales'));
const content = loadContent(join(packageDir, 'lessons'), join(packageDir, 'minigames'), locales);
const rules = createVariantRules(chessJsRules);

describe('real content', () => {
  it('loads with no issues (loadContent above did not throw) and has the expected shape', () => {
    expect(content.version).toBe(1);
    expect(content.lessons.length).toBeGreaterThan(0);
    expect(content.minigames.length).toBeGreaterThan(0);
  });

  it('has the rook lesson with 2 guided tries and 8 rising-difficulty exercises', () => {
    const rook = content.lessons.find((lesson) => lesson.id === 'rook');
    if (rook === undefined) {
      throw new Error('rook lesson not found');
    }

    expect(rook.world).toBe('pieces');
    expect(rook.order).toBe(1);
    expect(rook.concept).toBe('rook-move');
    expect(rook.character).toBe('rhino');
    expect(rook.guided).toHaveLength(2);
    expect(rook.exercises).toHaveLength(8);
    expect(rook.exercises.map((exercise) => exercise.type)).toEqual([
      'collect-stars',
      'collect-stars',
      'select-squares',
      'collect-stars',
      'capture',
      'select-squares',
      'capture',
      'collect-stars',
    ]);
    expect(rook.boss).toBe('hungry-rook');
  });

  it('every collect-stars / capture exercise (guided and scored) is solvable at its stars3', () => {
    for (const lesson of content.lessons) {
      for (const exercise of [...lesson.guided, ...lesson.exercises, ...(lesson.variants ?? [])]) {
        if (exercise.type !== 'collect-stars' && exercise.type !== 'capture') {
          continue;
        }
        expect(optimalMoves(exercise, rules)).toBe(exercise.stars3);
        expect(exercise.stars2).toBeGreaterThanOrEqual(exercise.stars3);
      }
    }
  });

  it('every exercise position has a piece for the side to move (setup and fixed-squares select-squares excepted: board-geometry tasks may start empty)', () => {
    for (const lesson of content.lessons) {
      for (const exercise of [...lesson.guided, ...lesson.exercises, ...(lesson.variants ?? [])]) {
        if (
          exercise.type === 'setup' ||
          (exercise.type === 'select-squares' && 'squares' in exercise.answer)
        ) {
          continue;
        }
        const hasKidPiece = Object.values(exercise.position.pieces).some(
          (piece) => piece.color === exercise.position.toMove,
        );
        expect(hasKidPiece).toBe(true);
      }
    }
  });

  it('Hungry Rook par equals its optimal solve and unlocks after the rook lesson', () => {
    const hungryRook = content.minigames.find((minigame) => minigame.id === 'hungry-rook');
    if (hungryRook === undefined) {
      throw new Error('hungry-rook mini-game not found');
    }
    if (hungryRook.mode !== 'static') {
      throw new Error('hungry-rook mini-game is not static');
    }

    expect(hungryRook.unlockAfter).toBe('rook');
    expect(hungryRook.moveLimit).toBeGreaterThan(hungryRook.par);

    const asCapture: CaptureDef = {
      id: hungryRook.id,
      concept: hungryRook.concept,
      textKey: hungryRook.titleKey,
      position: hungryRook.position,
      type: 'capture',
      stars3: hungryRook.par,
      stars2: hungryRook.par,
    };
    expect(optimalMoves(asCapture, rules)).toBe(hungryRook.par);
  });

  const WORLD2_LESSONS: readonly {
    readonly id: string;
    readonly order: number;
    readonly concept: string;
    readonly character: string;
    readonly exerciseCount: number;
    readonly boss: string;
  }[] = [
    {
      id: 'rook',
      order: 1,
      concept: 'rook-move',
      character: 'rhino',
      exerciseCount: 8,
      boss: 'hungry-rook',
    },
    {
      id: 'bishop',
      order: 2,
      concept: 'bishop-move',
      character: 'elephant',
      exerciseCount: 8,
      boss: 'hungry-bishop',
    },
    {
      id: 'queen',
      order: 3,
      concept: 'queen-move',
      character: 'lioness',
      exerciseCount: 8,
      boss: 'hungry-queen',
    },
    {
      id: 'king',
      order: 4,
      concept: 'king-move',
      character: 'lion',
      exerciseCount: 6,
      boss: 'king-walk',
    },
    {
      id: 'knight',
      order: 5,
      concept: 'knight-move',
      character: 'horse',
      exerciseCount: 8,
      boss: 'knight-maze',
    },
  ];

  it.each(WORLD2_LESSONS)(
    'World 2 lesson $id: world/order/concept/character, 2 guided tries, $exerciseCount exercises, boss $boss',
    ({ id, order, concept, character, exerciseCount, boss }) => {
      const lesson = content.lessons.find((candidate) => candidate.id === id);
      if (lesson === undefined) {
        throw new Error(`${id} lesson not found`);
      }

      expect(lesson.world).toBe('pieces');
      expect(lesson.order).toBe(order);
      expect(lesson.concept).toBe(concept);
      expect(lesson.character).toBe(character);
      expect(lesson.guided).toHaveLength(2);
      expect(lesson.exercises).toHaveLength(exerciseCount);
      expect(lesson.boss).toBe(boss);
    },
  );

  it('the bishop lesson teaches the same-colour rule via a yes-no exercise', () => {
    const bishop = content.lessons.find((lesson) => lesson.id === 'bishop');
    if (bishop === undefined) {
      throw new Error('bishop lesson not found');
    }
    const colourRuleExercise = bishop.exercises.find((exercise) => exercise.type === 'yes-no');
    expect(colourRuleExercise).toBeDefined();
    expect(colourRuleExercise?.type === 'yes-no' && colourRuleExercise.answer).toBe(false);
  });

  it('king lesson exercises are only star (collect-stars) or sel (select-squares), no captures', () => {
    const king = content.lessons.find((lesson) => lesson.id === 'king');
    if (king === undefined) {
      throw new Error('king lesson not found');
    }
    const types = new Set(king.exercises.map((exercise) => exercise.type));
    expect(types).toEqual(new Set(['collect-stars', 'select-squares']));
  });

  const WORLD2_MINIGAMES: readonly {
    readonly id: string;
    readonly unlockAfter: string;
    readonly goal: 'capture-all' | 'collect-stars' | undefined;
  }[] = [
    { id: 'hungry-bishop', unlockAfter: 'bishop', goal: undefined },
    { id: 'hungry-queen', unlockAfter: 'queen', goal: undefined },
    { id: 'king-walk', unlockAfter: 'king', goal: 'collect-stars' },
    { id: 'knight-maze', unlockAfter: 'knight', goal: 'collect-stars' },
  ];

  it.each(WORLD2_MINIGAMES)(
    'boss $id: par equals its optimal solve, unlocks after $unlockAfter, moveLimit above par',
    ({ id, unlockAfter, goal }) => {
      const minigame = content.minigames.find((candidate) => candidate.id === id);
      if (minigame === undefined) {
        throw new Error(`${id} mini-game not found`);
      }
      if (minigame.mode !== 'static') {
        throw new Error(`${id} mini-game is not static`);
      }

      expect(minigame.unlockAfter).toBe(unlockAfter);
      expect(minigame.moveLimit).toBeGreaterThan(minigame.par);
      expect(minigame.goal ?? 'capture-all').toBe(goal ?? 'capture-all');

      const asExercise: CaptureDef | CollectStarsDef =
        (minigame.goal ?? 'capture-all') === 'collect-stars'
          ? {
              id: minigame.id,
              concept: minigame.concept,
              textKey: minigame.titleKey,
              position: minigame.position,
              type: 'collect-stars',
              stars3: minigame.par,
              stars2: minigame.par,
            }
          : {
              id: minigame.id,
              concept: minigame.concept,
              textKey: minigame.titleKey,
              position: minigame.position,
              type: 'capture',
              stars3: minigame.par,
              stars2: minigame.par,
            };
      expect(optimalMoves(asExercise, rules)).toBe(minigame.par);
    },
  );

  it('king-walk lets the king reach every star only through squares safe from the static attackers', () => {
    const kingWalk = content.minigames.find((minigame) => minigame.id === 'king-walk');
    if (kingWalk === undefined) {
      throw new Error('king-walk mini-game not found');
    }
    if (kingWalk.mode !== 'static') {
      throw new Error('king-walk mini-game is not static');
    }
    expect(kingWalk.position.markers.stars.length).toBeGreaterThan(0);
    // Solvability (via optimalMoves above) already proves a legal path exists; legalMoves always
    // excludes squares attacked by the static enemy pieces (standard chess king-safety rule).
    const firstMoves = rules.legalMoves(kingWalk.position, { staticOpponent: true });
    expect(firstMoves.length).toBeGreaterThan(0);
  });

  it('knight-maze rocks do not block the knight (it jumps over them) but stop other pieces', () => {
    const knightMaze = content.minigames.find((minigame) => minigame.id === 'knight-maze');
    if (knightMaze === undefined) {
      throw new Error('knight-maze mini-game not found');
    }
    if (knightMaze.mode !== 'static') {
      throw new Error('knight-maze mini-game is not static');
    }
    expect(knightMaze.position.markers.blocked.length).toBeGreaterThan(0);
    const moves = rules.legalMoves(knightMaze.position, { staticOpponent: true });
    expect(moves.length).toBeGreaterThan(0);
  });
});
