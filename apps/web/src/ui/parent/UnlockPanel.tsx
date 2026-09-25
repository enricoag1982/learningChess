import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Journey, Lesson } from '@chess-kids/core';
import { loadJourney } from '@chess-kids/core';
import { useAppStore, useServices } from '../../app/store.ts';
import { characterName, tContent } from '../../content-text.ts';
import { characterPieceOrNull } from '../art/character-meta.ts';
import { PARENT_NOTE, PARENT_SECONDARY_BUTTON } from './parent-styles.ts';

/** Locked-lesson name: title for an Owl-taught lesson (no piece character), else its character's name. */
function lessonName(t: TFunction, lesson: Lesson): string {
  return characterPieceOrNull(lesson.character) === null
    ? tContent(t, lesson.titleKey)
    : characterName(t, lesson.character);
}

export interface UnlockPanelProps {
  readonly profileId: string;
}

/**
 * Parent area "Unlock lessons & worlds" (app-structure.md §11, domain-model.md §3.2 "Parent
 * unlock"): a small list of this child's locked worlds and locked lessons, each with an unlock
 * toggle (`masteredVia: 'parent'`). Loads this profile's own `Journey` directly (bypassing the
 * store's `journey`, which only ever holds the *active kid session's* profile).
 */
export function UnlockPanel({ profileId }: UnlockPanelProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const parentUnlockTarget = useAppStore((state) => state.parentUnlockTarget);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    const loaded = await loadJourney(services.deps, profileId);
    setJourney(loaded);
  }

  useEffect(() => {
    let cancelled = false;
    void loadJourney(services.deps, profileId).then((loaded) => {
      if (!cancelled) setJourney(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [services, profileId]);

  async function unlockWorld(worldId: string): Promise<void> {
    setBusyId(worldId);
    await parentUnlockTarget(profileId, { type: 'world', worldId });
    await refresh();
    setBusyId(null);
  }

  async function unlockLesson(lessonId: string): Promise<void> {
    setBusyId(lessonId);
    await parentUnlockTarget(profileId, { type: 'lesson', lessonId });
    await refresh();
    setBusyId(null);
  }

  if (!journey) {
    return <p className={PARENT_NOTE}>{t('parent.unlock-lessons-worlds')}…</p>;
  }

  const lockedWorlds = journey.worlds.filter((entry) => entry.status === 'locked');
  const lockedLessons = journey.lessons.filter(
    (lesson) => journey.statuses.get(lesson.id) === 'locked',
  );

  if (lockedWorlds.length === 0 && lockedLessons.length === 0) {
    return <p className={PARENT_NOTE}>{t('parent.unlock-empty')}</p>;
  }

  return (
    <div className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-xl border border-line bg-cream p-3">
      {lockedWorlds.map(({ world }) => (
        <div
          key={world.id}
          className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2"
        >
          <span className="flex-1 text-sm font-bold text-ink">
            {tContent(t, 'journey:ui.world-heading', {
              order: world.order,
              name: tContent(t, world.titleKey),
            })}
          </span>
          <button
            type="button"
            disabled={busyId === world.id}
            onClick={() => {
              void unlockWorld(world.id);
            }}
            className={PARENT_SECONDARY_BUTTON}
          >
            {t('parent.unlock-world')}
          </button>
        </div>
      ))}
      {lockedLessons.map((lesson) => {
        const world = journey.worlds.find((entry) => entry.world.id === lesson.world)?.world;
        return (
          <div
            key={lesson.id}
            className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2"
          >
            <span className="flex-1 text-sm text-ink">
              {lessonName(t, lesson)}
              {world && <span className="text-muted"> · {tContent(t, world.titleKey)}</span>}
            </span>
            <button
              type="button"
              disabled={busyId === lesson.id}
              onClick={() => {
                void unlockLesson(lesson.id);
              }}
              className={PARENT_SECONDARY_BUTTON}
            >
              {t('parent.unlock-lesson')}
            </button>
          </div>
        );
      })}
    </div>
  );
}
