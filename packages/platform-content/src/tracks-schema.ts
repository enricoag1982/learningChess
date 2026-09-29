import { HABITATS } from '@learn/platform-core';
import { z } from 'zod';
import { KEY_PATTERN, keySchema, textRefSchema } from './schema.ts';

export const habitatSchema = z.enum(HABITATS);

/** One world: order in its track, habitat, title key, optional boss (cross-checked against mini-games / lessons in `loadTracks`). */
export const worldSchema = z
  .object({
    id: keySchema,
    order: z.number().int().positive(),
    habitat: habitatSchema,
    title: textRefSchema,
    boss: keySchema.optional(),
  })
  .strict();

export type WorldYaml = z.infer<typeof worldSchema>;

/** One track (`main` = Basics road, `branch` = Openings / Tactics / Endgames), 1+ worlds. */
export const trackSchema = z
  .object({
    id: keySchema,
    kind: z.enum(['main', 'branch']),
    title: textRefSchema,
    worlds: z.array(worldSchema).min(1),
  })
  .strict();

export type TrackYaml = z.infer<typeof trackSchema>;

/** A rank's unlock condition (domain-model.md §1): `start`, `all-tracks`, `world:<id>` or `track:<id>`. */
const RANK_AFTER_PATTERN = new RegExp(
  `^(start|all-tracks|world:${KEY_PATTERN.source.slice(1, -1)}|track:${KEY_PATTERN.source.slice(1, -1)})$`,
);

export const rankSchema = z
  .object({
    id: keySchema,
    after: z.string().regex(RANK_AFTER_PATTERN),
  })
  .strict();

export type RankYaml = z.infer<typeof rankSchema>;

export const tracksFileSchema = z
  .object({
    tracks: z.array(trackSchema).min(1),
    ranks: z.array(rankSchema).min(1),
  })
  .strict();
