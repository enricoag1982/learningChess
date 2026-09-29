import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createProfile, selectProfile, setupParentPassword } from '@learn/platform-core';
import App from '@learn/platform-web/App.tsx';
import { createServices } from '@learn/platform-web/app/services.ts';
import type { Services } from '@learn/platform-web/app/services.ts';
import { createFakePasswordFileWriter } from '@learn/platform-web/testing/fake-password-file-writer.ts';
import { createMemoryStorage } from '@learn/platform-web/testing/memory-storage.ts';
import { MATH_APP_CONFIG } from '@learn/subject-math';
import { mathWeb } from '@learn/subject-math/web/math-pack.ts';

/** The real services over `storage`, except the parent-code file (a browser download, none in jsdom). */
function testServices(storage: Storage): Services {
  const services = createServices(mathWeb, MATH_APP_CONFIG, storage);
  return { ...services, deps: { ...services.deps, passwordFile: createFakePasswordFileWriter() } };
}

function storageKeys(storage: Storage): readonly string[] {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index) ?? '');
}

function notPrefixed(storage: Storage): readonly string[] {
  return storageKeys(storage).filter((key) => !key.startsWith('math-demo:'));
}

describe('math demo App', () => {
  it('boots to the first-run screen on an empty storage, under its own key prefix', async () => {
    const storage = createMemoryStorage();
    render(<App services={testServices(storage)} pack={mathWeb} app={MATH_APP_CONFIG} />);

    await screen.findByRole('heading', { level: 1, name: 'Math for Kids' });
    expect(screen.getByRole('button', { name: 'Start setup' })).toBeTruthy();
    expect(storageKeys(storage).length).toBeGreaterThan(0);
    expect(notPrefixed(storage)).toEqual([]);
  });

  it('picker → Home → the first lesson story card; every stored key starts with math-demo:', async () => {
    const storage = createMemoryStorage();
    const services = testServices(storage);
    await setupParentPassword(services.deps, '1234');
    const profile = await createProfile(services.deps, 'Mia', 'fox');
    await selectProfile(services.deps, profile.id);
    render(<App services={services} pack={mathWeb} app={MATH_APP_CONFIG} />);

    fireEvent.click(await screen.findByRole('button', { name: /Mia/ }));
    await screen.findByRole('heading', { level: 1, name: 'Math for Kids' });
    fireEvent.click(await screen.findByRole('button', { name: /Start/ }));
    await screen.findByRole('button', { name: /Let me try/ });
    await screen.findByText('2 + 1 = ?');

    expect(storageKeys(storage).length).toBeGreaterThan(1);
    expect(notPrefixed(storage)).toEqual([]);
  });
});
