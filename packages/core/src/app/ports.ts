import type { Profile } from '../domain/profile.ts';

/** Persistence of child profiles. Async so cloud adapters can replace local ones. */
export interface ProfileRepository {
  list(): Promise<Profile[]>;
  get(id: string): Promise<Profile | undefined>;
  save(profile: Profile): Promise<void>;
  delete(id: string): Promise<void>;
}

/** Current time; injected for deterministic tests. */
export interface Clock {
  now(): Date;
}

/** Randomness in [0, 1); seeded in tests. */
export interface Random {
  next(): number;
}

/** Online features are off in v1. */
export interface FeatureFlags {
  readonly login: boolean;
  readonly online: boolean;
}

export const v1FeatureFlags: FeatureFlags = { login: false, online: false };
