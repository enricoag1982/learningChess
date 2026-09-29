// Chess's lazy parent-area panels (`SubjectWeb.loadParent`), part of the chess pack. Dynamically
// imported only once the parent area mounts, so this stays out of the initial bundle.
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameRecord } from '@learn/platform-core';
import { loadGameRecords, loadJourney } from '@learn/platform-core';
import { bot, computerLevelStatus } from '../chess.ts';
import type { ComputerLevelStatus } from '../chess.ts';
import type { PieceStyleSetting } from '../core/chess/settings.ts';
import { useServices } from '@learn/platform-web/app/store.ts';
import type { ParentSettingsProps, ReportSectionProps } from '@learn/platform-web/app/subject.ts';
import {
  PARENT_CHIP,
  PARENT_CHIP_LOCKED,
  PARENT_CHIP_SELECTED,
} from '@learn/platform-web/ui/ds/parent-styles-lazy.ts';
import { PARENT_INFO_PANEL } from '@learn/platform-web/ui/parent/parent-styles.ts';
import {
  formatDate,
  opponentLabel,
  resultLabel,
  Section,
} from '@learn/platform-web/ui/parent/ChildReport.tsx';

/** The computer-level + piece-style chips (`ChildSettings`'s generic settings section). */
export function SettingsPanel({
  profileId,
  settings,
  patchSettings,
}: ParentSettingsProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const [levelStatuses, setLevelStatuses] = useState<readonly ComputerLevelStatus[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadJourney(services.deps, profileId),
      loadGameRecords(services.deps, profileId),
    ]).then(([journey, records]) => {
      if (!cancelled) setLevelStatuses(computerLevelStatus(records, journey));
    });
    return () => {
      cancelled = true;
    };
  }, [services, profileId]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-extrabold text-ink">{t('parent.computer-level-heading')}</h3>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('parent.computer-level-heading')}
        >
          <button
            type="button"
            aria-pressed={settings.computerLevel === 'auto'}
            onClick={() => {
              void patchSettings({ computerLevel: 'auto' });
            }}
            className={settings.computerLevel === 'auto' ? PARENT_CHIP_SELECTED : PARENT_CHIP}
          >
            {t('parent.computer-level-auto')}
          </button>
          {levelStatuses.map((status) => (
            <button
              key={status.level}
              type="button"
              disabled={status.locked}
              aria-pressed={settings.computerLevel === status.level}
              onClick={() => {
                void patchSettings({ computerLevel: status.level });
              }}
              className={
                status.locked
                  ? PARENT_CHIP_LOCKED
                  : settings.computerLevel === status.level
                    ? PARENT_CHIP_SELECTED
                    : PARENT_CHIP
              }
            >
              {t(`boss.versus.bot-name.${status.name}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-extrabold text-ink">{t('parent.piece-style-heading')}</h3>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('parent.piece-style-heading')}
        >
          {(['animal', 'classic'] satisfies PieceStyleSetting[]).map((style) => (
            <button
              key={style}
              type="button"
              aria-pressed={settings.pieceStyle === style}
              onClick={() => {
                void patchSettings({ pieceStyle: style });
              }}
              className={settings.pieceStyle === style ? PARENT_CHIP_SELECTED : PARENT_CHIP}
            >
              {t(`parent.piece-style-${style}`)}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/** `ChildReport`'s "games played" section: opponent (bot name via `bot.BOT_LEVELS`, else the
 * platform's own `opponentLabel`), result, date — same DOM as before the seam. */
export function ReportSection({ games, profilesById }: ReportSectionProps): JSX.Element {
  const { t } = useTranslation();

  function opponent(record: GameRecord): string {
    if (record.opponent.startsWith('computer:')) {
      const level = Number(record.opponent.slice('computer:'.length));
      const name = bot.BOT_LEVELS.find((entry) => entry.level === level)?.name;
      return name ? t(`boss.versus.bot-name.${name}`) : record.opponent;
    }
    return opponentLabel(t, record.opponent, profilesById);
  }

  return (
    <Section title={t('parent.report.games-heading')}>
      {games.length === 0 ? (
        <p className={PARENT_INFO_PANEL}>{t('parent.report.games-empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {games.map((game) => (
            <li key={game.id} className={`${PARENT_INFO_PANEL} flex items-center gap-3`}>
              <span className="flex-1 text-sm font-bold text-ink">{opponent(game)}</span>
              <span className="text-xs text-muted">{resultLabel(t, game.result)}</span>
              <span className="text-xs text-muted">{formatDate(game.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
