import type { JSX } from 'react';
import { OwlIcon } from './art/characters.tsx';

/** The narrator's round avatar, shown beside every speech bubble. */
export function Owl({ className = 'h-16 w-16' }: { readonly className?: string }): JSX.Element {
  return (
    <div className={`flex-shrink-0 overflow-hidden rounded-full bg-[#E9DFF3] p-2 ${className}`}>
      <OwlIcon />
    </div>
  );
}
