import type { JSX } from 'react';
import { ChoiceOptions as PlatformChoiceOptions } from '@learn/platform-web/kinds/choice/ChoiceOptions.tsx';
import type { ChoiceOptionsProps } from '@learn/platform-web/kinds/choice/ChoiceOptions.tsx';
import type { ChoiceOption } from '../../core/exercise/types.ts';
import { CHESS_CHOICE_LOOK } from './look.tsx';

export function ChoiceOptions(props: Omit<ChoiceOptionsProps<ChoiceOption>, 'look'>): JSX.Element {
  return <PlatformChoiceOptions {...props} look={CHESS_CHOICE_LOOK} />;
}
