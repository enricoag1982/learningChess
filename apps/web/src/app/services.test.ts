import { beforeEach, describe, expect, it } from 'vitest';
import { createServices } from './services.ts';

beforeEach(() => {
  localStorage.clear();
});

describe('createServices', () => {
  it('wires deps, rules and narrator over the given storage', async () => {
    const services = createServices(localStorage);

    expect(services.narrator).toBeDefined();
    expect(typeof services.rules.legalMoves).toBe('function');
    expect(typeof services.deps.clock.now).toBe('function');
    expect(services.deps.ids.next()).not.toBe(services.deps.ids.next());

    expect(await services.deps.profiles.list()).toEqual([]);
    expect(services.deps.content.lesson('rook')?.id).toBe('rook');

    const now = services.deps.clock.now().toISOString();
    await services.deps.progress.saveLesson({
      id: 'p1',
      profileId: 'profile-1',
      lessonId: 'rook',
      bestStars: {},
      bossStars: 0,
      resumeStep: 0,
      createdAt: now,
      updatedAt: now,
    });
    expect(await services.deps.progress.getLesson('profile-1', 'rook')).toBeDefined();
  });

  it('persists profile data across separate createServices calls over the same storage', async () => {
    const first = createServices(localStorage);
    await first.deps.profiles.save({
      id: 'p1',
      accountId: 'local',
      nickname: 'Rex',
      avatar: 'fox',
      locale: 'en',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const second = createServices(localStorage);
    expect(await second.deps.profiles.get('p1')).toMatchObject({ nickname: 'Rex' });
  });

  it('defaults to window.localStorage', () => {
    const services = createServices();
    expect(services.deps).toBeDefined();
  });
});
