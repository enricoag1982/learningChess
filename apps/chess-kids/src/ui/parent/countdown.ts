/** `ms` (≥ 0) as `m:ss`, e.g. `60_000` → `"1:00"`, `42_300` → `"0:43"` (rounds up to the next second). */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}
