import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChoiceOptionBase } from '@learn/platform-core/domain/exercise/kinds/choice/def';
import { tContent } from '../../content-text.ts';

/** How a subject draws an option beside its text (chess: a piece icon; math: a numeral). */
export interface ChoiceLook<O extends ChoiceOptionBase = ChoiceOptionBase> {
  visual?(option: O): ReactNode;
  /** Accessible name of an option without text. */
  label?(option: O, text: (key: string) => string): string | undefined;
}

export interface ChoiceOptionsProps<O extends ChoiceOptionBase> {
  readonly options: readonly O[];
  readonly wrongOptionIds: readonly string[];
  readonly onPick: (optionId: string) => void;
  readonly look: ChoiceLook<O>;
}

/** Pickable options: tiles (visual over text) in a responsive grid, 2 per row on a phone up to 4.
 * Each tile is at least 56px tall (game screens, docs/screens.md §1). */
export function ChoiceOptions<O extends ChoiceOptionBase>({
  options,
  wrongOptionIds,
  onPick,
  look,
}: ChoiceOptionsProps<O>): JSX.Element {
  const { t } = useTranslation();
  const text = (key: string): string => tContent(t, key);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {options.map((option) => {
        const isWrong = wrongOptionIds.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            disabled={isWrong}
            aria-disabled={isWrong}
            aria-label={option.textKey === undefined ? look.label?.(option, text) : undefined}
            onClick={() => {
              onPick(option.id);
            }}
            className={`tap-raised flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 font-display text-sm font-semibold ${
              isWrong ? 'border-today text-today opacity-80' : 'bg-card text-ink'
            }`}
          >
            {look.visual?.(option)}
            {option.textKey && <span className="text-center">{text(option.textKey)}</span>}
          </button>
        );
      })}
    </div>
  );
}
