import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import './i18n.ts';
import App from './App.tsx';

afterEach(cleanup);

describe('App', () => {
  it('renders the title, greeting and coming-soon text from the real locale', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Chess for Kids');
    expect(screen.getByText("Hi! I'm Owl. Let's learn chess together!")).toBeTruthy();
    expect(screen.getByText('Lessons are coming soon.')).toBeTruthy();
  });

  it('hides the offline status when service workers are unavailable (e.g. jsdom)', () => {
    render(<App />);
    expect(screen.queryByText('Ready to play offline.')).toBeNull();
  });
});
