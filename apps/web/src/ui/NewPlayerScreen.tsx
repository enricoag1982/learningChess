import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { validateNickname } from '@chess-kids/core';
import { useAppStore } from '../app/store.ts';
import { avatarName } from '../content-text.ts';
import type { Avatar } from './art/avatar-meta.ts';
import { AVATARS, avatarBackground } from './art/avatar-meta.ts';
import { AvatarIcon } from './art/avatars.tsx';

type Step = 'nickname' | 'avatar';

function NicknameStep({
  nickname,
  onChange,
  onNext,
}: {
  readonly nickname: string;
  readonly onChange: (value: string) => void;
  readonly onNext: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);
  const valid = validateNickname(nickname);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-cream px-4 py-8 text-center sm:px-10">
      <h1 className="font-display text-3xl text-ink sm:text-4xl">
        {t('new-player.nickname.title')}
      </h1>
      <input
        type="text"
        value={nickname}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onBlur={() => {
          setTouched(true);
        }}
        placeholder={t('new-player.nickname.placeholder')}
        maxLength={20}
        autoFocus
        className="h-20 w-full max-w-sm rounded-3xl border-2 border-line bg-card px-6 text-center font-display text-3xl text-ink outline-none focus:border-go"
      />
      {touched && !valid && (
        <p className="font-display text-lg font-semibold text-[#7A3A0F]">
          {t('new-player.nickname.invalid')}
        </p>
      )}
      <button
        type="button"
        disabled={!valid}
        onClick={onNext}
        className="tap-raised tap-go flex h-16 w-full max-w-sm items-center justify-center rounded-[2rem] bg-go px-8 font-display text-xl font-semibold text-white disabled:opacity-40 sm:h-20 sm:text-2xl"
      >
        {t('new-player.nickname.primary')}
      </button>
    </main>
  );
}

function AvatarStep({
  avatar,
  onChange,
  onFinish,
}: {
  readonly avatar: Avatar;
  readonly onChange: (value: Avatar) => void;
  readonly onFinish: () => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-cream px-4 py-8 text-center sm:px-10">
      <h1 className="font-display text-3xl text-ink sm:text-4xl">{t('new-player.avatar.title')}</h1>
      <div className="grid grid-cols-4 gap-4 sm:gap-6">
        {AVATARS.map((id) => {
          const selected = id === avatar;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              aria-label={avatarName(t, id)}
              onClick={() => {
                onChange(id);
              }}
              className={`flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full p-3 sm:h-24 sm:w-24 ${
                selected ? 'ring-4 ring-go' : ''
              }`}
              style={{ backgroundColor: avatarBackground(id) }}
            >
              <AvatarIcon avatar={id} />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onFinish}
        className="tap-raised tap-go flex h-16 w-full max-w-sm items-center justify-center rounded-[2rem] bg-go px-8 font-display text-xl font-semibold text-white sm:h-20 sm:text-2xl"
      >
        {t('new-player.avatar.primary')}
      </button>
    </main>
  );
}

/** New-player wizard (kid style): nickname, then avatar; last step creates the profile
 * (store.finishNewPlayer decides whether that goes to Home or back to the parent area). */
export function NewPlayerScreen(): JSX.Element {
  const finishNewPlayer = useAppStore((state) => state.finishNewPlayer);
  const [step, setStep] = useState<Step>('nickname');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<Avatar>(AVATARS[0]);

  if (step === 'nickname') {
    return (
      <NicknameStep
        nickname={nickname}
        onChange={setNickname}
        onNext={() => {
          setStep('avatar');
        }}
      />
    );
  }
  return (
    <AvatarStep
      avatar={avatar}
      onChange={setAvatar}
      onFinish={() => {
        void finishNewPlayer(nickname, avatar);
      }}
    />
  );
}
